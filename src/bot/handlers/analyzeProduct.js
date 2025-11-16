const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

/**
 * بناء رسالة تحليل المنتج بالعربية الرسمية بناءً على بيانات من AliExpress API
 */
function buildArabicAnalysisMessage({ productId, productData, affiliateLink }) {
  // استخراج البيانات من استجابة AliExpress
  const price = Number(productData.target_sale_price || productData.sale_price || 0);
  const originalPrice = Number(productData.target_original_price || productData.original_price || 0);
  const shipping = 0; // يمكنك جلبها من API إذا كانت متوفرة
  
  // حساب الخصم
  const discount = originalPrice > price ? originalPrice - price : 0;
  
  // الكوبونات (إذا كانت متوفرة في الاستجابة)
  const couponValue = 0; // عدّله حسب البيانات المتاحة في API
  
  const finalPrice = calculateFinalPrice(price, shipping, couponValue);

  const title = productData.product_title || 'منتج بدون اسم محدد';
  const currency = 'دولار أمريكي';

  let message = '';
  message += '✅ تم تحليل رابط المنتج بنجاح.\n\n';
  message += `📦 اسم المنتج: ${title}\n`;
  message += `🆔 معرّف المنتج: ${productId}\n\n`;

  message += '💰 الأسعار بالتفصيل:\n';
  message += `• السعر الأصلي: ${originalPrice.toFixed(2)} ${currency}\n`;
  message += `• السعر بعد الخصم: ${price.toFixed(2)} ${currency}\n`;
  
  if (discount > 0) {
    message += `• قيمة التوفير: ${discount.toFixed(2)} ${currency}\n`;
  }
  
  message += `• تكلفة الشحن إلى الجزائر: ${shipping.toFixed(2)} ${currency}\n`;
  message += `• مجموع الكوبونات المطبقة: ${couponValue.toFixed(2)} ${currency}\n\n`;

  message += `🎯 السعر النهائي التقريبي: ${finalPrice.toFixed(2)} ${currency}\n\n`;

  message += 'ℹ️ تنبيه مهم:\n';
  message += '- قد تختلف الأسعار الفعلية والكوبونات المتاحة حسب حسابك، والمنطقة، وتاريخ الشراء.\n';
  message += '- يرجى التأكد من التفاصيل النهائية مباشرة داخل موقع AliExpress قبل إتمام الطلب.\n\n';

  if (affiliateLink) {
    message += '🔗 رابط الشراء (رابط أفلييت):\n';
    message += affiliateLink + '\n';
  }

  return message;
}

async function handleAnalyzeProduct(ctx, { productId, url }) {
  const chatId = ctx.chat.id;

  try {
    await updateUserActivity(chatId, true);

    await ctx.reply('⏳ جاري تحليل رابط المنتج وجلب البيانات من AliExpress، يرجى الانتظار للحظات...');

    // جلب بيانات المنتج من AliExpress API
    const productData = await getProductDetails(productId, 'USD', 'AR', 'DZ');

    // بناء رابط الأفلييت
    const affiliateLink = productData.promotion_link || buildAffiliateLink(productId);
    
    const message = buildArabicAnalysisMessage({
      productId,
      productData,
      affiliateLink
    });

    // إرسال الرسالة مع الصورة إذا كانت متوفرة
    if (productData.product_main_image_url) {
      await ctx.replyWithPhoto(productData.product_main_image_url, {
        caption: message
      });
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    console.error('خطأ أثناء تحليل المنتج:', err);
    await ctx.reply(
      '❌ عذراً، حدث خطأ غير متوقع أثناء محاولة تحليل هذا المنتج.\n' +
      'يرجى المحاولة مرة أخرى لاحقاً، أو التأكد من صحة الرابط.\n\n' +
      'تفاصيل الخطأ (للمطورين): ' + err.message
    );
  }
}

module.exports = handleAnalyzeProduct;
