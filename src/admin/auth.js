const express = require('express');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const dotenv = require('dotenv');
const pool = require('../db/connect');
const { createAdminUserIfNotExists, verifyAdminCredentials } = require('../db/queries');

dotenv.config();

// إعداد الجلسات
function createSessionMiddleware() {
  const store = new pgSession({
    pool,
    tableName: 'session'
  });

  const sessionMiddleware = session({
    store,
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // اجعلها true عند استخدام HTTPS
      maxAge: 1000 * 60 * 60 * 24 // يوم واحد
    }
  });

  return sessionMiddleware;
}

// إعداد حماية CSRF
const csrfProtection = csrf();

// Rate limiting لمحاولات تسجيل الدخول
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5,
  message: 'عدد محاولات تسجيل الدخول تجاوز الحد المسموح، يرجى المحاولة لاحقاً.'
});

// التأكد من وجود حساب المشرف الرئيسي عند بدء التطبيق
async function ensureDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'Fares21';
  const password = process.env.ADMIN_PASSWORD || 'Bouaffar@@1987';
  await createAdminUserIfNotExists(username, password);
}

// Middleware للتحقق من تسجيل الدخول
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.adminUser) {
    return next();
  }
  return res.redirect('/admin/login');
}

// مسار تسجيل الدخول (POST)
async function handleLoginPost(req, res) {
  const { username, password } = req.body;

  try {
    const admin = await verifyAdminCredentials(username, password);
    if (!admin) {
      return res.render('login', {
        csrfToken: req.csrfToken(),
        error: 'بيانات الدخول غير صحيحة، يرجى التحقق من اسم المستخدم وكلمة المرور.'
      });
    }

    req.session.adminUser = {
      id: admin.id,
      username: admin.username
    };

    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('خطأ أثناء تسجيل الدخول:', err);
    return res.render('login', {
      csrfToken: req.csrfToken(),
      error: 'حدث خطأ غير متوقع أثناء عملية تسجيل الدخول، يرجى المحاولة لاحقاً.'
    });
  }
}

// مسار تسجيل الخروج
function handleLogout(req, res) {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
}

module.exports = {
  createSessionMiddleware,
  csrfProtection,
  loginLimiter,
  ensureAuthenticated,
  ensureDefaultAdmin,
  handleLoginPost,
  handleLogout
};
