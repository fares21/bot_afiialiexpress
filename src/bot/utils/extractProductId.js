/**
 * يحاول استخراج productId من جميع أنواع روابط Aliexpress الشائعة.
 * يدعم أنماطاً مثل:
 * - https://www.aliexpress.com/item/1005001234567890.html
 * - https://a.aliexpress.com/_mProductShortLink
 * - روابط تحوي المعامل productId أو itemId أو objId
 */

function extractProductIdFromQuery(urlObj) {
  const params = urlObj.searchParams;
  const keys = ['productId', 'itemId', 'objId', 'sku_id', 'spm'];
  for (const key of keys) {
    if (params.has(key)) {
      const val = params.get(key);
      const match = val.match(/\d{6,}/);
      if (match) return match[0];
    }
  }
  return null;
}

function extractProductId(rawUrl) {
  try {
    const normalized = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      return null;
    }

    const urlObj = new URL(normalized.toLowerCase());

    const host = urlObj.hostname;
    const isAli = host.includes('aliexpress.com') || host.includes('a.aliexpress.com') || host.includes('m.aliexpress.com');

    if (!isAli) {
      return null;
    }

    // 1) محاولة الاستخراج من المسار
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // مثال: /item/1005001234567890.html
    const itemIndex = pathParts.indexOf('item');
    if (itemIndex !== -1 && pathParts[itemIndex + 1]) {
      const idPart = pathParts[itemIndex + 1];
      const match = idPart.match(/\d{6,}/);
      if (match) return match[0];
    }

    // مثال: /i/1005001234567890.html أو /1005001234567890.html
    for (const part of pathParts) {
      const match = part.match(/\d{6,}/);
      if (match) return match[0];
    }

    // 2) من الاستعلام
    const fromQuery = extractProductIdFromQuery(urlObj);
    if (fromQuery) return fromQuery;

    return null;
  } catch (err) {
    return null;
  }
}

module.exports = extractProductId;
