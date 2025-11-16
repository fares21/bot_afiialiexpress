const axios = require('axios');
const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');

/**
 * يستدعي API خارجي (تقوم أنت بضبطه) للحصول على بيانات منتج من AliExpress.
 * المتغيرات المستخدمة:
 * - ALIEXPRESS_API_BASE_URL
 * - ALIEXPRESS_API_KEY
 *
 * يجب أن يعيد الـ API بيانات شبيهة بالتالي (يمكنك تعديل الكود حسب استجابتك الفعلية):
 * {
 *   "price": 10.5,
 *   "shipping_to_dz": 3.2,
 *   "currency": "USD",
 *   "global_coupon": 2.0,
 *   "seller_coupon": 1.0,
 *   "title": "Product title ...",
 *   "image_url": "https://..."
 * }
 */

async function fetchProductData(productId) {
  const baseUrl = process.env.ALIEXPRESS_API_BASE_URL;
  const apiKey = process.env.ALIEXPRESS_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('إعدادات API الخاصة بـ AliExpress غير مكتملة في ملف .env');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/product`;
  const res = await axios.get(url, {
    params: {
      productId,
      country: 'DZ',
      currency: 'USD'
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    timeout: 15000
  });

  return res.data;
}

function buildArabicAnalysisMessage({ productId, productData, affiliateLink }) {
  const price = Number(productData.price || 0);
  const shipping = Number(productData.shipping_to_dz || 0);
  const globalCoupon = Number(productData.global_coupon || 0);
  const sellerCoupon = Number(productData.seller_coupon || 0);
  const totalCoupons = globalCoupon + sellerCoupon;

  const finalPrice = calculateFinalPrice(price, shipping, totalCoupons);

  const title = productData.title || 'منتج بدون اسم محدد';
  const currency = 'دولار أمريكي';

  let message = '';
  message += '✅ تم تحليل رابط المنتج بنجاح.\n\n';
  message += `معرّف المنتج (productId): ${productId}\n`;
  message += `اسم المنتج: ${title}\n\n`;

  message += '🔹 الأسعار بالتفصيل:\n';
  message += `• السعر الأساسي: ${price.toFixed(2)} ${currency}\n`;
  message += `• تكلفة الشحن إلى الجزائر: ${shipping.toFixed(2)} ${currency}\n`;
  message += `• مجموع الكوبونات المطبقة: ${totalCoupons.toFixed(2)} ${currency}\n\n`;

  message += '💰 السعر النهائي التقريبي بعد احتساب الشحن والكوبونات:\n';
  message += `→ ${finalPrice.toFixed(2)} ${currency}\n\n`;

  message += 'ℹ️ تنبيه مهم:\n';
  message += '- قد تختلف الأسعار الفعلية والكوبونات المتاحة حسب حسابك، والمنطقة، وتاريخ الشراء.\n';
  message += '- يرجى التأكد من التفاصيل النهائية مباشرة داخل موقع AliExpress قبل إتمام الطلب.\n\n';

  if (affiliateLink) {
    message += '🔗 رابط الشراء (قد يحتوي على تتبع أفلييت):\n';
    message += affiliateLink + '\n';
  }

  return message;
}

async function handleAnalyzeProduct(ctx, { productId, url }) {
  const chatId = ctx.chat.id;

  try {
    await updateUserActivity(chatId, true);

    await ctx.reply('جاري تحليل رابط المنتج وجلب البيانات من AliExpress، يرجى الانتظار للحظات...');

    const productData = await fetchProductData(productId);

    const affiliateLink = buildAffiliateLink(productId);
    const message = buildArabicAnalysisMessage({
      productId,
      productData,
      affiliateLink
    });

    if (productData.image_url) {
      await ctx.replyWithPhoto(productData.image_url, {
        caption: message
      });
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    console.error('خطأ أثناء تحليل المنتج:', err);
    await ctx.reply(
      'عذراً، حدث خطأ غير متوقع أثناء محاولة تحليل هذا المنتج.\n' +
      'يرجى المحاولة مرة أخرى لاحقاً، أو التأكد من صحة الرابط.'
    );
  }
}

module.exports = handleAnalyzeProduct;
