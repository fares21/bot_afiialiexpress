const pool = require('./connect');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12; // إعداد قوي نسبياً للتشفير

// إنشاء الجداول إن لم تكن موجودة
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      subscribed BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      sid varchar NOT NULL COLLATE "default",
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    )
    WITH (OIDS=FALSE;
  `).catch(() => {
    // إذا كان الجدول موجوداً أو مخطط الجلسة مختلفاً، نتجاهل الخطأ
  });

  await pool.query(`
    ALTER TABLE "session" ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
  `).catch(() => {});
}

// المستخدمون (البوت)

async function findUserByChatId(chatId) {
  const res = await pool.query(
    'SELECT * FROM users WHERE chat_id = $1',
    [chatId]
  );
  return res.rows[0] || null;
}

async function createUserIfNotExists(chatId, username) {
  const existing = await findUserByChatId(chatId);
  if (existing) {
    return existing;
  }
  const res = await pool.query(
    `INSERT INTO users (chat_id, username)
     VALUES ($1, $2)
     ON CONFLICT (chat_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING *`,
    [chatId, username || null]
  );
  return res.rows[0];
}

async function updateUserActivity(chatId, subscribed = true) {
  await pool.query(
    `UPDATE users
     SET last_active = NOW(), subscribed = $2
     WHERE chat_id = $1`,
    [chatId, subscribed]
  );
}

async function getActiveSubscribedUsers() {
  // يمكن تعديل منطق النشاط حسب الحاجة (مثلاً آخر 90 يوماً)
  const res = await pool.query(
    `SELECT * FROM users
     WHERE subscribed = TRUE`
  );
  return res.rows;
}

async function markUserUnsubscribed(chatId) {
  await pool.query(
    `UPDATE users
     SET subscribed = FALSE
     WHERE chat_id = $1`,
    [chatId]
  );
}

// المشرفون (لوحة الإدارة)

async function findAdminByUsername(username) {
  const res = await pool.query(
    'SELECT * FROM admin_users WHERE username = $1',
    [username]
  );
  return res.rows[0] || null;
}

async function createAdminUserIfNotExists(username, passwordPlain) {
  const existing = await findAdminByUsername(username);
  if (existing) {
    return existing;
  }
  const hash = await bcrypt.hash(passwordPlain, SALT_ROUNDS);
  const res = await pool.query(
    `INSERT INTO admin_users (username, password_hash)
     VALUES ($1, $2)
     RETURNING *`,
    [username, hash]
  );
  return res.rows[0];
}

async function verifyAdminCredentials(username, passwordPlain) {
  const admin = await findAdminByUsername(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(passwordPlain, admin.password_hash);
  if (!ok) return null;
  return admin;
}

module.exports = {
  initDb,
  // users
  findUserByChatId,
  createUserIfNotExists,
  updateUserActivity,
  getActiveSubscribedUsers,
  markUserUnsubscribed,
  // admins
  createAdminUserIfNotExists,
  verifyAdminCredentials
};
