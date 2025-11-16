const crypto = require('crypto');
const axios = require('axios');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

if (!APP_KEY || !APP_SECRET) {
  console.error('⚠️ تحذير: ALIEXPRESS_APP_KEY و ALIEXPRESS_APP_SECRET غير محددين في متغيرات البيئة');
}

/**
 * توليد توقيع MD5 حسب متطلبات AliExpress (البديل الأبسط)
 */
function generateSignatureMD5(apiName, params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  
  let concatenated = apiName;
  sortedKeys.forEach((key) => {
    concatenated += key + params[key];
  });

  const signature = crypto
    .createHash('md5')
    .update(appSecret + concatenated + appSecret, 'utf8')
    .digest('hex')
    .toUpperCase();

  return signature;
}

/**
 * استدعاء AliExpress API
 */
async function callAliexpressAPI(apiName, apiParams = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('إعدادات API الخاصة بـ AliExpress غير مكتملة في ملف .env');
  }

  const timestamp = Date.now().toString();

  // المعاملات الأساسية
  const baseParams = {
    app_key: APP_KEY,
    method: apiName,
    timestamp: timestamp,
    format: 'json',
    v: '2.0',
    sign_method: 'md5'
  };

  // دمج معاملات الـ API
  const allParams = { ...baseParams, ...apiParams };

  // توليد التوقيع
  const sign = generateSignatureMD5(apiName, allParams, APP_SECRET);
  const finalParams = { ...allParams, sign };

  const endpoint = 'https://api-sg.aliexpress.com/sync';

  try {
    console.log('📡 إرسال طلب إلى:', endpoint);
    console.log('📝 API Name:', apiName);
    console.log('🔑 Parameters:', JSON.stringify(finalParams, null, 2));

    const response = await axios.get(endpoint, {
      params: finalParams,
      timeout: 15000
    });

    console.log('✅ استجابة API:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.error_response) {
      throw new Error(
        `AliExpress API Error: ${response.data.error_response.msg || response.data.error_response.sub_msg || 'Unknown error'}`
      );
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ خطأ في استجابة API:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('❌ خطأ أثناء استدعاء AliExpress API:', error.message);
    throw error;
  }
}

/**
 * الحصول على تفاصيل منتج من AliExpress
 */
async function getProductDetails(productId, targetCurrency = 'USD', targetLanguage = 'AR', country = 'DZ') {
  // ⚠️ التأكد من أن productId ليس Promise
  const resolvedProductId = await Promise.resolve(productId);
  
  if (!resolvedProductId || resolvedProductId === '[object Promise]') {
    throw new Error('productId غير صالح أو غير محلول');
  }

  const apiName = 'aliexpress.affiliate.productdetail.get';

  const apiParams = {
    product_ids: String(resolvedProductId),
    target_currency: targetCurrency,
    target_language: targetLanguage,
    country: country
  };

  if (TRACKING_ID) {
    apiParams.tracking_id = TRACKING_ID;
  }

  const response = await callAliexpressAPI(apiName, apiParams);

  if (
    response &&
    response.aliexpress_affiliate_productdetail_get_response &&
    response.aliexpress_affiliate_productdetail_get_response.resp_result
  ) {
    const result = response.aliexpress_affiliate_productdetail_get_response.resp_result;
    
    if (result.resp_code !== 200) {
      throw new Error(`AliExpress API returned error code: ${result.resp_code}, message: ${result.resp_msg}`);
    }

    const resultData = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;

    if (resultData && resultData.products && resultData.products.product && resultData.products.product.length > 0) {
      return resultData.products.product[0];
    } else {
      throw new Error('لم يتم العثور على بيانات المنتج في استجابة API');
    }
  }

  throw new Error('فشل في الحصول على بيانات المنتج من AliExpress API');
}

module.exports = {
  callAliexpressAPI,
  getProductDetails
};
