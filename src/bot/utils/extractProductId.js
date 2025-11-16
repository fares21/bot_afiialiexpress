const axios = require('axios');

/**
 * استخراج productId من رابط AliExpress (يدعم الروابط الكاملة والروابط المختصرة s.click.aliexpress.com).
 * تعيد الدالة:
 *  - معرّف المنتج كسلسلة نصية عند النجاح
 *  - null عند الفشل أو عدم تطابق الرابط مع AliExpress
 */
async function extractProductId(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return null;
    }

    let normalized = rawUrl.trim();

    // التحقق من وجود بروتوكول
    if (!/^https?:///i.test(normalized)) {
      return null;
    }

    let urlObj = new URL(normalized);
    let host = urlObj.hostname.toLowerCase();

    // التحقق من أن الرابط يتبع نطاقات AliExpress المعروفة (بما في ذلك الروابط المختصرة)
    const isAliExpressHost =
      host.includes('aliexpress.com') ||
      host.includes('a.aliexpress.com') ||
      host.includes('m.aliexpress.com') ||
      host.includes('s.click.aliexpress.com');

    if (!isAliExpressHost) {
      return null;
    }

    // إذا كان الرابط من نوع s.click.aliexpress.com، نحاول فك الرابط أولاً
    if (host.includes('s.click.aliexpress.com')) {
      console.log('🔗 تم اكتشاف رابط مختصر من AliExpress، جاري فك التوجيه...');

      try {
        const response = await axios.get(normalized, {
          maxRedirects: 10,
          timeout: 10000,
          validateStatus: (status) => status >= 200 && status < 400
        });

        const finalUrl =
          (response.request &&
            response.request.res &&
            response.request.res.responseUrl) ||
          response.config.url;

        console.log('✅ تم فك الرابط المختصر بنجاح:', finalUrl);

        normalized = finalUrl;
        urlObj = new URL(normalized);
        host = urlObj.hostname.toLowerCase();
      } catch (err) {
        console.error('❌ فشل في فك الرابط المختصر من AliExpress:', err.message);
        return null;
      }
    }

    // 1) محاولة استخراج productId من مسار الرابط
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // مثال: /item/1005001234567890.html
    const itemIndex = pathParts.indexOf('item');
    if (itemIndex !== -1 && pathParts[itemIndex + 1]) {
      const idPart = pathParts[itemIndex + 1];
      const match = idPart.match(/d{6,}/);
      if (match) {
        return match[0];
      }
    }

    // مثال: /i/1005001234567890.html أو /1005001234567890.html
    for (const part of pathParts) {
      if (!part) continue;
      const match = part.match(/d{6,}/);
      if (match) {
        return match[0];
      }
    }

    // 2) محاولة استخراج productId من معاملات الاستعلام
    const params = urlObj.searchParams;
    const keys = ['productId', 'itemId', 'objId', 'sku_id', 'spm', 'pdp_npi'];

    for (const key of keys) {
      if (params.has(key)) {
        const val = params.get(key);
        if (!val) continue;
        const match = val.match(/d{6,}/);
        if (match) {
          return match[0];
        }
      }
    }

    // إذا لم نجد أي شيء
    return null;
  } catch (err) {
    console.error('❌ خطأ في دالة extractProductId:', err.message);
    return null;
  }
}

module.exports = extractProductId;
