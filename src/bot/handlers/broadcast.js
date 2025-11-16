const { getActiveSubscribedUsers, markUserUnsubscribed } = require('../../db/queries');

const DEFAULT_BATCH_SIZE = Number(process.env.BROADCAST_BATCH_SIZE || 30);
const DEFAULT_BATCH_DELAY_MS = Number(process.env.BROADCAST_BATCH_DELAY_MS || 1200);

/**
 * إرسال رسالة Broadcast يدوية إلى جميع المستخدمين النشطين المشتركين،
 * مع تقسيم الإرسال إلى دفعات ثابتة واحترام حدود Telegram.
 *
 * يتم استدعاء هذه الدالة من لوحة الإدارة، حيث نستقبل كائن Telegraf bot
 * ونص الرسالة المراد إرسالها.
 */

async function sendBroadcast(bot, text) {
  const users = await getActiveSubscribedUsers();

  const batchSize = DEFAULT_BATCH_SIZE;
  const delayMs = DEFAULT_BATCH_DELAY_MS;

  let sentCount = 0;
  let failedCount = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    const promises = batch.map(async (user) => {
      try {
        await bot.telegram.sendMessage(user.chat_id, text, {
          disable_web_page_preview: false
        });
        sentCount += 1;
      } catch (err) {
        failedCount += 1;
        console.error(`فشل إرسال الرسالة للمستخدم ${user.chat_id}:`, err.message);
        // في حال كان المستخدم حظر البوت أو لم يعد متاحاً
        if (
          err.response &&
          err.response.error_code &&
          [403, 400].includes(err.response.error_code)
        ) {
          await markUserUnsubscribed(user.chat_id);
        }
      }
    });

    await Promise.all(promises);

    // انتظار بين الدفعات لحماية البوت من Flood Limits
    if (i + batchSize < users.length) {
      await sleep(delayMs);
    }
  }

  return { sentCount, failedCount, total: users.length };
}

module.exports = {
  sendBroadcast
};
