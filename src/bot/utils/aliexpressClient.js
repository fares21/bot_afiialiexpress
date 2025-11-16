const crypto = require('crypto');
const axios = require('axios');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const API_GATEWAY = process.env.ALIEXPRESS_API_GATEWAY || 'https://api-sg.aliexpress.com/sync';
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

if (!APP_KEY || !APP_SECRET) {
  console.error('ALIEXPRESS_APP_KEY و ALIEXPRESS_APP_SECRET مطلوبان في ملف .env');
}

/**
 * توليد توقيع HMAC-SHA256 حسب متطلبات AliExpress Open Platform
 * @param {string} apiName - اسم الـ API مثل: aliexpress.affiliate.productdetail.get
 * @param {object} params - معاملات الطلب
 * @returns {string} التوقيع بصيغة HEX كبيرة
 */
function generateSignature(apiName, params) {
  // ترتيب المعاملات أبجدياً حسب المفاتيح (ASCII)
  const sortedKeys = Object.keys(params).sort();
  
  // دمج المفاتيح والقيم
  let concatenated = '';
  sortedKeys.forEach((key) => {
    concatenated += key + params[key];
  });

  // إضافة اسم الـ API في البداية
  const stringToSign = apiName + concatenated;

  // توليد التوقيع باستخدام HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(stringToSign, 'utf8')
    .digest('hex')
    .toUpperCase();

  return signature;
}

/**
 * استدعاء AliExpress API مع التوقيع الصحيح
 * @param {string} apiName - اسم الـ API
 * @param {object} apiParams - معاملات الـ API المحددة
 * @returns {Promise<object>} استجابة الـ API
 */
async function callAliexpressAPI(apiName, apiParams = {}) {
  const timestamp = Date.now().toString();

  // المعاملات الأساسية المطلوبة في كل طلب
  const baseParams = {
    app_key: APP_KEY,
    timestamp: timestamp,
    sign_method: 'sha256',
    format: 'json',
    v: '2.0',
    method: apiName
  };

  // دمج معاملات الـ API مع المعاملات الأساسية
  const allParams = { ...baseParams, ...apiParams };

  // توليد التوقيع
  const sign = generateSignature(apiName, allParams);

  // إضافة التوقيع للمعاملات النهائية
  const finalParams = { ...allParams, sign };

  try {
    const response = await axios.get(API_GATEWAY, {
      params: finalParams,
      timeout: 15000
    });

    // التحقق من الأخطاء في الاستجابة
    if (response.data && response.data.error_response) {
      throw new Error(
        `AliExpress API Error: ${response.data.error_response.msg || 'Unknown error'}`
      );
    }

    return response.data;
  } catch (error) {
    console.error('خطأ أثناء استدعاء AliExpress API:', error.message);
    throw error;
  }
}

/**
 * الحصول على تفاصيل منتج من AliExpress
 * @param {string} productId - معرّف المنتج
 * @param {string} targetCurrency - العملة المطلوبة (مثل USD)
 * @param {string} targetLanguage - اللغة المطلوبة (مثل AR)
 * @param {string} country - كود الدولة (مثل DZ للجزائر)
 * @returns {Promise<object>} بيانات المنتج
 */
async function getProductDetails(productId, targetCurrency = 'USD', targetLanguage = 'AR', country = 'DZ') {
  const apiName = 'aliexpress.affiliate.productdetail.get';

  const apiParams = {
    product_ids: productId,
    target_currency: targetCurrency,
    target_language: targetLanguage,
    country: country,
    tracking_id: TRACKING_ID || ''
  };

  const response = await callAliexpressAPI(apiName, apiParams);

  // استخراج بيانات المنتج من الاستجابة
  if (
    response &&
    response.aliexpress_affiliate_productdetail_get_response &&
    response.aliexpress_affiliate_productdetail_get_response.resp_result
  ) {
    const result = response.aliexpress_affiliate_productdetail_get_response.resp_result;
    const resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;

    if (resultData && resultData.products && resultData.products.product) {
      return resultData.products.product[0]; // أول منتج في القائمة
    }
  }

  throw new Error('فشل في الحصول على بيانات المنتج من AliExpress API');
}

module.exports = {
  generateSignature,
  callAliexpressAPI,
  getProductDetails
};
