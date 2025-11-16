const crypto = require('crypto');
const axios = require('axios');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

// ⚠️ التعديل المهم: استخدام Business Interface بدلاً من System Interface
const API_GATEWAY = process.env.ALIEXPRESS_API_GATEWAY || 'https://api-sg.aliexpress.com/sync';

if (!APP_KEY || !APP_SECRET) {
  console.error('⚠️ تحذير: ALIEXPRESS_APP_KEY و ALIEXPRESS_APP_SECRET غير محددين في متغيرات البيئة');
}

/**
 * توليد توقيع HMAC-SHA256 حسب متطلبات AliExpress Open Platform
 */
function generateSignature(apiName, params) {
  // ترتيب المعاملات أبجدياً حسب المفاتيح (ASCII)
  const sortedKeys = Object.keys(params).sort();
  
  // دمج المفاتيح والقيم
  let concatenated = apiName; // ⚠️ مهم: البدء باسم الـ API
  sortedKeys.forEach((key) => {
    concatenated += key + params[key];
  });

  // توليد التوقيع باستخدام HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(concatenated, 'utf8')
    .digest('hex')
    .toUpperCase();

  return signature;
}

/**
 * استدعاء AliExpress API مع التوقيع الصحيح
 */
async function callAliexpressAPI(apiName, apiParams = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('إعدادات API الخاصة بـ AliExpress غير مكتملة في ملف .env');
  }

  const timestamp = Date.now().toString();

  // المعاملات الأساسية
  const baseParams = {
    app_key: APP_KEY,
    sign_method: 'sha256',
    timestamp: timestamp,
    format: 'json',
    v: '2.0',
    method: apiName
  };

  // دمج معاملات الـ API
  const allParams = { ...baseParams, ...apiParams };

  // توليد التوقيع (بدون sign في المعاملات)
  const sign = generateSignature(apiName, allParams);

  // إضافة التوقيع
  const finalParams = { ...allParams, sign };

  // ⚠️ تحديد نوع الـ Endpoint الصحيح
  let endpoint = API_GATEWAY;
  
  // إذا كان API من نوع Business (معظم APIs)، استخدم /sync
  // وإلا استخدم /rest لبعض الحالات الخاصة
  if (apiName.startsWith('aliexpress.affiliate')) {
    endpoint = 'https://api-sg.aliexpress.com/sync';
  }

  try {
    console.log('📡 إرسال طلب إلى:', endpoint);
    console.log('📝 API Name:', apiName);
    console.log('🔑 Parameters:', JSON.stringify(finalParams, null, 2));

    const response = await axios.get(endpoint, {
      params: finalParams,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ استجابة API:', JSON.stringify(response.data, null, 2));

    // التحقق من الأخطاء في الاستجابة
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
  const apiName = 'aliexpress.affiliate.productdetail.get';

  const apiParams = {
    product_ids: productId.toString(),
    target_currency: targetCurrency,
    target_language: targetLanguage,
    country: country
  };

  // إضافة tracking_id فقط إذا كان موجوداً
  if (TRACKING_ID) {
    apiParams.tracking_id = TRACKING_ID;
  }

  const response = await callAliexpressAPI(apiName, apiParams);

  // استخراج بيانات المنتج من الاستجابة
  if (
    response &&
    response.aliexpress_affiliate_productdetail_get_response &&
    response.aliexpress_affiliate_productdetail_get_response.resp_result
  ) {
    const result = response.aliexpress_affiliate_productdetail_get_response.resp_result;
    
    // التحقق من resp_code
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

  throw new Error('فشل في الحصول على بيانات المنتج من AliExpress API - استجابة غير صحيحة');
}

module.exports = {
  generateSignature,
  callAliexpressAPI,
  getProductDetails
};
