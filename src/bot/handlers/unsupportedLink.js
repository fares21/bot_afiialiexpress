/**
 * رد رسمي على الروابط غير المدعومة أو النصوص التي لا تحتوي على رابط AliExpress.
 */

async function handleUnsupportedLink(ctx) {
  await ctx.reply(
    'عذراً، الرابط الذي أرسلته غير مدعوم حالياً.\n' +
    'هذا البوت مخصص فقط لتحليل روابط المنتجات من موقع AliExpress.\n' +
    'يرجى التأكد من أن الرابط يتبع نطاق AliExpress ثم المحاولة مجدداً.'
  );
}

module.exports = handleUnsupportedLink;
