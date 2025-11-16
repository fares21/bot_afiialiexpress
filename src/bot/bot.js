const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');

const handleWelcome = require('./handlers/welcome');
const validateLink = require('./handlers/validateLink');
const handleAnalyzeProduct = require('./handlers/analyzeProduct');
const handleUnsupportedLink = require('./handlers/unsupportedLink');

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN غير محدد في ملف .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// /start
bot.start(async (ctx) => {
  try {
    await handleWelcome(ctx);
  } catch (err) {
    console.error('خطأ في معالجة /start:', err);
    await ctx.reply('حدث خطأ غير متوقع أثناء تنفيذ الأمر /start، يرجى المحاولة لاحقاً.');
  }
});

// استقبال أي نص (روابط + نصوص)
bot.on('text', async (ctx) => {
  try {
    const validation = await validateLink(ctx);
    if (!validation.ok) {
      // تم الرد داخل validateLink بالفعل
      return;
    }

    await handleAnalyzeProduct(ctx, {
      productId: validation.productId,
      url: validation.url
    });
  } catch (err) {
    console.error('خطأ أثناء معالجة الرسالة النصية:', err);
    await handleUnsupportedLink(ctx);
  }
});

// معالجة الأخطاء العامة
bot.catch((err, ctx) => {
  console.error(`خطأ غير متوقع في التحديث ${ctx.update.update_id}:`, err);
});

module.exports = bot;
