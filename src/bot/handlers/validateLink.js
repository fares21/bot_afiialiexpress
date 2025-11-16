const extractProductId = require('../utils/extractProductId');
const handleUnsupportedLink = require('./unsupportedLink');

/**
 * يتحقق من كون الرسالة تحتوي على رابط AliExpress صالح،
 * ويحاول استخراج productId باستخدام extractProductId (التي تدعم الروابط المختصرة).
 * إذا لم يكن الرابط مدعوماً، يتم إرسال رد رسمي للمستخدم عبر handleUnsupportedLink.
 */
async function validateLink(ctx) {
  const text =
    ctx.message && typeof ctx.message.text === 'string'
      ? ctx.message.text.trim()
      : '';

  // البحث عن أول رابط داخل النص
  // ملاحظة مهمة: يجب الهروب من / في https:// واستخدام s لمسافة بيضاء
  const urlRegex = /(https?://[^s]+)/i;
  const match = text.match(urlRegex);

  if (!match) {
    await handleUnsupportedLink(ctx);
    return { ok: false, reason: 'no_url' };
  }

  const url = match[0];

  // extractProductId أصبحت async لأنها قد تفك الروابط المختصرة عبر axios
  let productId;
  try {
    productId = await extractProductId(url);
  } catch (err) {
    console.error('❌ خطأ أثناء استخراج productId من الرابط:', err.message);
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
