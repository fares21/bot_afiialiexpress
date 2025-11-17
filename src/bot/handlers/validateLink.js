const extractProductId = require('../utils/extractProductId');
const handleUnsupportedLink = require('./unsupportedLink');

async function validateLink(ctx) {
  const text =
    ctx.message && typeof ctx.message.text === 'string'
      ? ctx.message.text.trim()
      : '';

  console.log('validateLink text:', text);

  const urlRegex = new RegExp('https?://\\S+', 'i');
  const match = text.match(urlRegex);

  console.log('validateLink match:', match);

  if (!match) {
    await handleUnsupportedLink(ctx);
    return { ok: false, reason: 'no_url' };
  }

  const url = match[0];
  console.log('validateLink url:', url);

  let productId;
  try {
    console.log('calling extractProductId with:', url);
    productId = await extractProductId(url);
    console.log('extractProductId result:', productId);
  } catch (err) {
    console.error('خطأ أثناء استخراج productId من الرابط:', err.message);
    await handleUnsupportedLink(ctx);
    return { ok: false, reason: 'extract_error' };
  }

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
