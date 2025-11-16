const crypto = require('crypto');
const axios = require('axios');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

if (!APP_KEY || !APP_SECRET) {
  console.error('⚠️ ALIEXPRESS_APP_KEY و ALIEXPRESS_APP_SECRET مطلوبان في متغيرات البيئة');
}

/**
 * توليد توقيع MD5 حسب وثائق AliExpress الرسمية
 * الصيغة: MD5(app_secret + sorted_params_concatenated + app_secret)
 */
function generateSignMD5(params, appSecret) {
  // ترتيب المفاتيح أبجدياً (ASCII order)
  const sortedKeys = Object.keys(params).sort();
  
  // دمج القيم: key1value1key2value2...
  let concatenated = '';
  sortedKeys.forEach((key) => {
    const value = params[key];
    concatenated += key + value;
  });

  // التوقيع: MD5(secret + params + secret)
  const stringToSign = appSecret + concatenated + appSecret;
  
  const sign = crypto
    .createHash('md5')
    .update(stringToSign, 'utf8')
    .digest('hex')
    .toUpperCase();

  return sign;
}

/**
 * استدعاء AliExpress Affiliate API
 */
async function callAliexpressAPI(method, params = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('إعدادات AliExpress API غير مكتملة');
  }

  // المعاملات الأساسية المطلوبة
  const baseParams = {
    method: method,
    app_key: APP_KEY,
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5'
  };

  // دمج معاملات الـ API
  const allParams = { ...baseParams, ...params };

  // حساب التوقيع
  const sign = generateSignMD5(allParams, APP_SECRET);

  // المعاملات النهائية مع التوقيع
  const finalParams = { ...allParams, sign };

  const endpoint = 'https://api-sg.aliexpress.com/sync';

  try {
    console.log('📡 طلب API:', method);
    console.log('🔑 معاملات:', JSON.stringify(finalParams, null, 2));

    const response = await axios.get(endpoint, {
      params: finalParams,
      timeout: 20000
    });

    console.log('✅ استجابة:', JSON.stringify(response.data, null, 2));

    // فحص الأخطاء
    if (response.data && response.data.error_response) {
      const error = response.data.error_response;
      throw new Error(`AliExpress API Error [${error.code}]: ${error.msg || error.sub_msg}`);
    }

    return response.data;

  } catch (error) {
    if (error.response && error.response.data) {
      console.error('❌ خطأ API:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('❌ خطأ:', error.message);
    throw error;
  }
}

/**
 * الحصول على تفاصيل منتج
 */
async function getProductDetails(productId, targetCurrency = 'USD', targetLanguage = 'AR', country = 'DZ') {
  // التأكد من حل Promise
  const resolvedId = await Promise.resolve(productId);
  
  if (!resolvedId || typeof resolvedId !== 'string' || resolvedId.includes('Promise')) {
    throw new Error('معرف المنتج غير صالح');
  }

  const method = 'aliexpress.affiliate.productdetail.get';
  const params = {
    product_ids: resolvedId,
    target_currency: targetCurrency,
    target_language: targetLanguage,
    country: country
  };

  // إضافة tracking_id إذا كان موجوداً
  if (TRACKING_ID) {
    params.tracking_id = TRACKING_ID;
  }

  const response = await callAliexpressAPI(method, params);

  // استخراج النتيجة
  const apiResponse = response.aliexpress_affiliate_productdetail_get_response;
  
  if (!apiResponse || !apiResponse.resp_result) {
    throw new Error('استجابة API غير صالحة');
  }

  const result = apiResponse.resp_result;

  if (result.resp_code !== 200) {
    throw new Error(`API Error Code ${result.resp_code}: ${result.resp_msg || 'Unknown'}`);
  }

  // تحليل النتيجة (قد تكون string أو object)
  const resultData = typeof result.result === 'string' 
    ? JSON.parse(result.result) 
    : result.result;

  if (!resultData || !resultData.products || !resultData.products.product || resultData.products.product.length === 0) {
    throw new Error('لم يتم العثور على بيانات المنتج');
  }

  return resultData.products.product[0];
}

module.exports = {
  callAliexpressAPI,
  getProductDetails
};
