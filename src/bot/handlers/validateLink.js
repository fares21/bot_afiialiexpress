const extractProductId = require('../utils/extractProductId');
const handleUnsupportedLink = require('./unsupportedLink');

/**
 * يتحقق من كون الرابط رابط AliExpress صالح، ويستخرج منه productId.
 */
async function validateLink(ctx) {
  const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';

  // البحث عن أول رابط في النص
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  
  if (!match) {
    await handleUnsupportedLink(ctx);
    return { ok: false, reason: 'no_url' };
  }

  const url = match[0];
  
  // ⚠️ استخدام await لأن extractProductId أصبحت async
  const productId = await extractProductId(url);

  if (!productId) {
    await handleUnsupportedLink(ctx);
    return { ok: false, reason: 'not_aliexpress_or_no_product_id' };
  }

  return {
    ok: true,
    url,
    productId
  };
}

module.exports = validateLink;
