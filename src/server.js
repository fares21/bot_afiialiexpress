const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

const bot = require('./bot/bot');
const createAdminRouter = require('./admin/routes');
const { createSessionMiddleware, csrfProtection, ensureDefaultAdmin } = require('./admin/auth');
const { initDb } = require('./db/queries');

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const USE_WEBHOOK = String(process.env.USE_WEBHOOK || 'false').toLowerCase() === 'true';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

async function bootstrap() {
  // تهيئة قاعدة البيانات وإنشاء الجداول
  await initDb();
  await ensureDefaultAdmin();

  const app = express();

  // إعداد المحرك القالب EJS
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'admin', 'views'));

  // Middleware عام
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // الجلسات
  const sessionMiddleware = createSessionMiddleware();
  app.use(sessionMiddleware);

  // لتشغيل البوت مع Express (webhook أو polling)
  if (USE_WEBHOOK) {
    // وضع البوت خلف Express باستخدام webhook
    const webhookPath = `/bot${process.env.BOT_SECRET_PATH || ''}`;
    app.use(bot.webhookCallback(webhookPath));

    await bot.telegram.setWebhook(`${PUBLIC_URL}${webhookPath}`);
    console.log('تم تفعيل Webhook للبوت على:', `${PUBLIC_URL}${webhookPath}`);
  } else {
    // Polling عادي
    bot.launch().then(() => {
      console.log('تم تشغيل البوت بنجاح باستخدام وضع Polling.');
    }).catch((err) => {
      console.error('فشل تشغيل البوت:', err);
      process.exit(1);
    });
  }

  // مهم: مشاركة الجلسة مع Telegraf عند استخدام webhook
  if (USE_WEBHOOK) {
    app.use((req, res, next) => {
      sessionMiddleware(req, res, next);
    });
  }

  // مسارات لوحة الإدارة
  const adminRouter = createAdminRouter(bot);
  app.use('/admin', adminRouter);

  // صفحة بسيطة في الجذر
  app.get('/', (req, res) => {
    res.send('خادم البوت ولوحة الإدارة يعملان بنجاح.');
  });

  // معالجة الأخطاء العامة
  app.use((err, req, res, next) => {
    console.error('حدث خطأ في الخادم:', err);
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).send('رمز CSRF غير صالح أو مفقود.');
    }
    res.status(500).send('حدث خطأ داخلي في الخادم.');
  });

  app.listen(PORT, HOST, () => {
    console.log(`الخادم يعمل على http://${HOST}:${PORT}`);
  });

   // إيقاف البوت والخادم بشكل آمن بحسب وضع التشغيل
  if (!USE_WEBHOOK) {
    // وضع Polling: البوت يشغَّل بواسطة bot.launch()، فيمكن استدعاء bot.stop()
    process.once('SIGINT', () => {
      console.log('استلام SIGINT في وضع polling، يتم إيقاف البوت...');
      bot.stop('SIGINT');
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      console.log('استلام SIGTERM في وضع polling، يتم إيقاف البوت...');
      bot.stop('SIGTERM');
      process.exit(0);
    });
  } else {
    // وضع Webhook (Render): لا نستدعي bot.stop() لأنه لم يُشغَّل بـ bot.launch()
    process.once('SIGINT', () => {
      console.log('استلام SIGINT في وضع webhook، سيتم إنهاء العملية بدون مناداة bot.stop()...');
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      console.log('استلام SIGTERM في وضع webhook، سيتم إنهاء العملية بدون مناداة bot.stop()...');
      process.exit(0);
    });
  }
}

bootstrap().catch((err) => {
  console.error('فشل أثناء عملية الإقلاع:', err);
  process.exit(1);
});
