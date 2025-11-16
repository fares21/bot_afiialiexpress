const express = require('express');
const { ensureAuthenticated, loginLimiter, csrfProtection, handleLoginPost, handleLogout } = require('./auth');
const { sendBroadcast } = require('../bot/handlers/broadcast');

function createAdminRouter(bot) {
  const router = express.Router();

  // صفحة تسجيل الدخول (GET)
  router.get('/login', csrfProtection, (req, res) => {
    if (req.session && req.session.adminUser) {
      return res.redirect('/admin/dashboard');
    }
    res.render('login', {
      csrfToken: req.csrfToken(),
      error: null
    });
  });

  // معالجة تسجيل الدخول (POST)
  router.post('/login', loginLimiter, csrfProtection, async (req, res) => {
    await handleLoginPost(req, res);
  });

  // لوحة التحكم (GET)
  router.get('/dashboard', ensureAuthenticated, csrfProtection, (req, res) => {
    res.render('dashboard', {
      csrfToken: req.csrfToken(),
      adminUser: req.session.adminUser,
      result: null,
      error: null
    });
  });

  // إرسال Broadcast (POST)
  router.post('/broadcast', ensureAuthenticated, csrfProtection, async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.render('dashboard', {
        csrfToken: req.csrfToken(),
        adminUser: req.session.adminUser,
        result: null,
        error: 'نص الرسالة مطلوب لإرسال البث.'
      });
    }

    try {
      const stats = await sendBroadcast(bot, message.trim());
      const resultMessage =
        `تمت عملية البث بنجاح.\n` +
        `إجمالي المستخدمين المستهدفين: ${stats.total}\n` +
        `تم الإرسال بنجاح إلى: ${stats.sentCount}\n` +
        `فشل الإرسال إلى: ${stats.failedCount}`;

      return res.render('dashboard', {
        csrfToken: req.csrfToken(),
        adminUser: req.session.adminUser,
        result: resultMessage,
        error: null
      });
    } catch (err) {
      console.error('خطأ أثناء إرسال البث:', err);
      return res.render('dashboard', {
        csrfToken: req.csrfToken(),
        adminUser: req.session.adminUser,
        result: null,
        error: 'حدث خطأ غير متوقع أثناء إرسال البث، يرجى المحاولة لاحقاً.'
      });
    }
  });

  // تسجيل الخروج
  router.post('/logout', ensureAuthenticated, csrfProtection, (req, res) => {
    handleLogout(req, res);
  });

  return router;
}

module.exports = createAdminRouter;
