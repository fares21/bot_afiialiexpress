const { createUserIfNotExists, updateUserActivity } = require('../../db/queries');

/**
 * إرسال رسالة ترحيبية رسمية مرة واحدة لكل مستخدم جديد.
 */

async function handleWelcome(ctx) {
  const chatId = ctx.chat.id;
  const username = ctx.from.username || null;

  const user = await createUserIfNotExists(chatId, username);
  await updateUserActivity(chatId, true);

  if (!user || !user.last_active) {
    // احتياط فقط، ولكن في منطقنا الحالي user دائماً موجود
  }

  // رسالة ترحيب رسمية باللغة العربية
  await ctx.reply(
    'مرحباً بك في البوت المتخصص في تحليل منتجات موقع AliExpress.\n\n' +
    'يمكنك إرسال أي رابط منتج من AliExpress، وسنقوم بتحليل السعر، والشحن إلى الجزائر بالدولار، والكوبونات المتاحة، ثم حساب السعر النهائي وإظهاره لك بصورة واضحة.\n\n' +
    'يرجى استخدام الروابط المباشرة للمنتجات فقط.'
  );
}

module.exports = handleWelcome;
