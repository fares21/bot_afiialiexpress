const crypto = require('crypto');
const axios = require('axios');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID || '';

if (!APP_KEY || !APP_SECRET) {
  console.error('⚠️ ALIEXPRESS_APP_KEY و ALIEXPRESS_APP_SECRET غير محددين في متغيرات البيئة، لن يعمل استدعاء AliExpress API بشكل صحيح.');
}

// =======================
// Rate Limiting بسيط
// =======================

let lastCallTimestamp = 0;
// فاصل زمني أدنى بين أي استدعاءين للـ API (يمكنك تعديله حسب الحاجة)
const MIN_INTERVAL_MS = 1200; // 1.2 ثانية تقريباً

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =======================
// Cache بسيط لنتائج المنتجات
// =======================

const productCache = new Map();
// مدة صلاحية الكاش (مثلاً 5 دقائق)
const CACHE_TTL_MS = 5 * 60 * 1000;

function setCache(productId, data) {
  productCache.set(productId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function getCache(productId) {
  const entry = productCache.get(productId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    productCache.delete(productId);
    return null;
  }
  return entry.data;
}

// =======================
// دالة التوقيع MD5 الرسمية
// =======================

/**
 * توليد توقيع MD5 حسب وثائق AliExpress Open Platform:
 * 1) ترتيب جميع المعاملات (system + application) تصاعدياً حسب اسم المفتاح (ASCII).
 * 2) تكوين سلسلة: key1value1key2value2...
 * 3) تكوين السلسلة النهائية: appSecret + السلسلة السابقة + appSecret
 * 4) حساب MD5 وتحويله إلى حروف كبيرة.
 */
function generateSignMD5(params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let concatStr = '';

  for (const key of sortedKeys) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    concatStr += key + String(value);
  }

  const stringToSign = appSecret + concatStr + appSecret;

  const sign = crypto
    .createHash('md5')
    .update(stringToSign, 'utf8')
    .digest('hex')
    .toUpperCase();

  return sign;
}

// =======================
// دالة عامة لاستدعاء AliExpress API
// =======================

/**
 * استدعاء AliExpress Affiliate API مع:
 * - توقيع MD5
 * - Rate limiting
 * - تسجيل واضح في الـ Logs
 *
 * @param {string} method - اسم الـ API، مثل: aliexpress.affiliate.productdetail.get
 * @param {object} params - معاملات الـ API (application parameters)
 * @returns {Promise<object>} - استجابة الـ API الكاملة
 */
async function callAliexpressAPI(method, params = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('إعدادات AliExpress API غير مكتملة (APP_KEY أو APP_SECRET مفقود).');
  }

  // Rate limiting: ضمان فاصل زمني أدنى بين الطلبات
  const now = Date.now();
  const diff = now - lastCallTimestamp;
  if (diff < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - diff);
  }
  lastCallTimestamp = Date.now();

  // المعاملات النظامية الأساسية
  const baseParams = {
    method,
    app_key: APP_KEY,
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5'
  };

  // دمج معاملات الـ API مع المعاملات النظامية
  const allParams = { ...baseParams, ...params };

  // حساب التوقيع
  const sign = generateSignMD5(allParams, APP_SECRET);

  // المعاملات النهائية المرسلة
  const finalParams = { ...allParams, sign };

  // Endpoint الرسمي لواجهة AliExpress Open Platform (Business/System API)
  const endpoint = 'https://api-sg.aliexpress.com/sync';

  try {
    console.log('📡 AliExpress API call:', method);
    console.log('🔑 Params:', JSON.stringify(finalParams, null, 2));

    const response = await axios.get(endpoint, {
      params: finalParams,
      timeout: 20000
    });

    console.log('✅ AliExpress API response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.error_response) {
      const error = response.data.error_response;
      const code = error.code || 'UnknownCode';
      const msg = error.msg || error.sub_msg || 'Unknown error';

      // إعادة رمي الخطأ بصيغة موحّدة
      throw new Error(`AliExpress API Error [${code}]: ${msg}`);
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('❌ AliExpress API error body:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('❌ AliExpress API call failed:', error.message);
    throw error;
  }
}

// =======================
// دالة متخصصة للحصول على تفاصيل منتج
// =======================

/**
 * الحصول على تفاصيل منتج من AliExpress عبر aliexpress.affiliate.productdetail.get
 *
 * @param {string|number|Promise<string|number>} productId - معرّف المنتج (يمكن أن يكون Promise تم حله مسبقاً)
 * @param {string} targetCurrency - العملة المطلوبة (مثل USD)
 * @param {string} targetLanguage - اللغة المطلوبة (مثل AR)
 * @param {string} country - كود الدولة (مثل DZ للجزائر)
 * @returns {Promise<object>} - كائن بيانات المنتج
 */
async function getProductDetails(
  productId,
  targetCurrency = 'USD',
  targetLanguage = 'AR',
  country = 'DZ'
) {
  // التأكد من حل Promise إن وجد
  const resolvedId = await Promise.resolve(productId);

  if (
    !resolvedId ||
    (typeof resolvedId !== 'string' && typeof resolvedId !== 'number')
  ) {
    throw new Error('معرّف المنتج غير صالح بعد التحليل.');
  }

  const productIdStr = String(resolvedId);

  // محاولة جلب من الكاش أولاً
  const cached = getCache(productIdStr);
  if (cached) {
    console.log('💾 AliExpress cache hit for product:', productIdStr);
    return cached;
  }

  const method = 'aliexpress.affiliate.productdetail.get';

  // معاملات الـ API للمنتج
  const params = {
    product_ids: productIdStr,
    target_currency: targetCurrency,
    target_language: targetLanguage,
    country
  };

  if (TRACKING_ID) {
    params.tracking_id = TRACKING_ID;
  }

  const data = await callAliexpressAPI(method, params);

  const apiResponse = data.aliexpress_affiliate_productdetail_get_response;
  if (!apiResponse || !apiResponse.resp_result) {
    throw new Error('استجابة AliExpress غير متوقعة (لا تحتوي على resp_result).');
  }

  const result = apiResponse.resp_result;

  if (result.resp_code !== 200) {
    throw new Error(
      `AliExpress API returned code ${result.resp_code}: ${result.resp_msg || 'Unknown'}`
    );
  }

  const resultData =
    typeof result.result === 'string' ? JSON.parse(result.result) : result.result;

  if (
    !resultData ||
    !resultData.products ||
    !Array.isArray(resultData.products.product) ||
    resultData.products.product.length === 0
  ) {
    throw new Error('لم يتم العثور على بيانات المنتج في استجابة AliExpress.');
  }

  const product = resultData.products.product[0];

  // تخزين النتيجة في الكاش
  setCache(productIdStr, product);

  return product;
}

module.exports = {
  callAliexpressAPI,
  getProductDetails
};
