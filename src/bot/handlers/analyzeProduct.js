const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

/**
 * يبني رسالة بسيطة بالعربية بدون رموز emoji
 */
function buildArabicAnalysisMessage({ productId, productData, affiliateLink }) {
  const originalPrice = Number(
    productData.target_original_price ||
    productData.original_price ||
    productData.effective_original_price ||
    0
  );

  const salePrice = Number(
    productData.target_sale_price ||
    productData.sale_price ||
    productData.effective_sale_price ||
    originalPrice
  );

  const shipping = Number(productData.shipping_fee || 0);
  const couponValue = Number(
    productData.coupon_amount ||
    productData.coupon_value ||
    0
  );

  const discount = originalPrice > salePrice ? originalPrice - salePrice : 0;
  const finalPrice = calculateFinalPrice(salePrice, shipping, couponValue);

  const title = productData.product_title || 'منتج بدون اسم';

  const mainImage = productData.product_main_image_url || null;

  // نصوص قصيرة، سطر واحد لكل string، بدون emoji
  let message = '';
  message += 'تم تحليل رابط المنتج.

';
  message += 'اسم المنتج: ' + title + '
';
  message += 'معرف المنتج: ' + productId + '

';

  message += 'تفاصيل السعر بالدولار:
';
  message += 'السعر الاصلي: ' + formatCurrencyUSD(originalPrice) + '
';
  message += 'السعر الحالي: ' + formatCurrencyUSD(salePrice) + '
';

  if (discount > 0) {
    message += 'قيمة التخفيض: ' + formatCurrencyUSD(discount) + '
';
  }

  message += 'سعر الشحن التقريبي: ' + formatCurrencyUSD(shipping) + '
';
  message += 'قيمة الكوبونات: ' + formatCurrencyUSD(couponValue) + '

';

  message += 'السعر النهائي التقريبي: ' + formatCurrencyUSD(finalPrice) + '

';

  message += 'ملاحظة: الاسعار تقريبية ويمكن ان تختلف داخل موقع او تطبيق علي اكسبريس.
';

  if (affiliateLink) {
    message += '
رابط الشراء:
' + affiliateLink + '
';
  }

  return { message, mainImage };
}

/**
 * المعالج الذي يستدعي AliExpress API ويعرض النتيجة للمستخدم
 */
async function handleAnalyzeProduct(ctx, { productId, url }) {
  const chatId = ctx.chat.id;

  try {
    await updateUserActivity(chatId, true);

    await ctx.reply(
      'جاري تحليل رابط المنتج من AliExpress، يرجى الانتظار قليلا...'
    );

    const productData = await getProductDetails(productId, 'USD', 'AR', 'DZ');

    const affiliateLink =
      productData.promotion_link || buildAffiliateLink(productId);

    const { message, mainImage } = buildArabicAnalysisMessage({
      productId,
      productData,
      affiliateLink
    });

    if (mainImage) {
      await ctx.replyWithPhoto(mainImage, { caption: message });
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    console.error('خطأ اثناء تحليل المنتج:', err);
    const msg = String(err.message || '');

    // رسالة قصيرة عند ApiCallLimit
    if (
      msg.includes('ApiCallLimit') ||
      msg.includes('access frequency exceeds the limit')
    ) {
      await ctx.reply(
        'تم الوصول مؤقتا الى حد طلبات AliExpress. حاول بعد ثوان قليلة.'
      );
      return;
    }

    await ctx.reply(
      'حدث خطأ غير متوقع اثناء تحليل المنتج. حاول لاحقا او تحقق من الرابط.

' +
      'تفاصيل للمطور: ' + msg
    );
  }
}

module.exports = handleAnalyzeProduct;
