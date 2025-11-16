const axios = require('axios');

/**
 * استخراج productId من معاملات URL
 */
function extractProductIdFromQuery(urlObj) {
  const params = urlObj.searchParams;
  const keys = ['productId', 'itemId', 'objId', 'sku_id', 'spm', 'pdp_npi'];
  for (const key of keys) {
    if (params.has(key)) {
      const val = params.get(key);
      const match = val.match(/\d{6,}/);
      if (match) return match[0];
    }
  }
  return null;
}

/**
 * فك الروابط المختصرة من نوع s.click.aliexpress.com وإرجاع الرابط الكامل
 */
async function resolveShortLink(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 10,
      timeout: 10000,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    // الرابط النهائي بعد التوجيهات
    return response.request.res.responseUrl || response.config.url;
  } catch (error) {
    // في حالة الفشل، نحاول استخراج الرابط من header Location
    if (error.response && error.response.headers.location) {
      return error.response.headers.location;
    }
    throw error;
  }
}

/**
 * استخراج productId من رابط AliExpress (يدعم الروابط المختصرة والكاملة)
 */
async function extractProductId(rawUrl) {
  try {
    let normalized = rawUrl.trim();
    
    // التحقق من وجود بروتوكول
    if (!/^https?:\/\//i.test(normalized)) {
      return null;
    }

    let urlObj = new URL(normalized.toLowerCase());
    const host = urlObj.hostname;

    // التحقق من أن الرابط من AliExpress
    const isAli = host.includes('aliexpress.com') || 
                  host.includes('a.aliexpress.com') || 
                  host.includes('m.aliexpress.com') ||
                  host.includes('s.click.aliexpress.com');

    if (!isAli) {
      return null;
    }

    // إذا كان رابطاً مختصراً من نوع s.click.aliexpress.com
    if (host.includes('s.click.aliexpress.com')) {
      console.log('🔗 اكتشاف رابط مختصر، جاري فك التشفير...');
      
      try {
        const resolvedUrl = await resolveShortLink(normalized);
        console.log('✅ تم فك الرابط المختصر:', resolvedUrl);
        
        // استخدام الرابط المفكوك للمعالجة
        normalized = resolvedUrl;
        urlObj = new URL(normalized.toLowerCase());
      } catch (err) {
        console.error('❌ فشل في فك الرابط المختصر:', err.message);
        return null;
      }
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

    // مثال: /i/1005001234567890.html
    for (const part of pathParts) {
      const match = part.match(/\d{6,}/);
      if (match) return match[0];
    }

    // 2) محاولة الاستخراج من معاملات الاستعلام
    const fromQuery = extractProductIdFromQuery(urlObj);
    if (fromQuery) return fromQuery;

    return null;
  } catch (err) {
    console.error('خطأ في استخراج productId:', err.message);
    return null;
  }
}

module.exports = extractProductId;
