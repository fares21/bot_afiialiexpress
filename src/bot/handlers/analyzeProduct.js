const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

/**
 * بناء رسالة تحليل المنتج بالعربية الرسمية، اعتماداً على البيانات العائدة من AliExpress API.
 * تم افتراض شكل استجابة قريب من aliexpress.affiliate.productdetail.get
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

  const title = productData.product_title || 'منتج بدون اسم محدد';

  let message = '';

  // ⚠️ هذا السطر أهم واحد: كله في سطر واحد، والنزول سطرين يتم عبر 


  message += '✅ تم تحليل رابط المنتج بنجاح.

';
  message += `📦 اسم المنتج: ${title}
`;
  message += `🆔 معرّف المنتج: ${productId}

`;

  message += '💰 التفاصيل المالية (بالدولار الأمريكي):
';
  message += `• السعر الأصلي التقريبي: ${formatCurrencyUSD(originalPrice)}
`;
  message += `• السعر الحالي بعد التخفيضات: ${formatCurrencyUSD(salePrice)}
`;

  if (discount > 0) {
    message += `• قيمة التوفير التقريبية: ${formatCurrencyUSD(discount)}
`;
  }

  message += `• تكلفة الشحن التقديرية إلى الجزائر: ${formatCurrencyUSD(shipping)}
`;
  message += `• مجموع الكوبونات المطبقة (إن وُجدت): ${formatCurrencyUSD(couponValue)}

`;

  message += '🎯 السعر النهائي التقريبي بعد احتساب الشحن والكوبونات:
';
  message += `→ ${formatCurrencyUSD(finalPrice)}

`;

  message += 'ℹ️ ملاحظات مهمة:
';
  message += '- قد تختلف الأسعار الفعلية والكوبونات المتاحة حسب حسابك، والمنطقة، وتاريخ الشراء.
';
  message += '- يرجى التحقق من التفاصيل النهائية داخل تطبيق أو موقع AliExpress قبل إتمام الطلب.

';

  if (affiliateLink) {
    message += '🔗 رابط الشراء (قد يكون رابط أفلييت يتضمن تتبعاً للزيارات):
';
    message += affiliateLink + '
';
  }

  const mainImage = productData.product_main_image_url || null;

  return { message, mainImage };
}/**
 * المعالج الرئيسي الذي يستدعي AliExpress API ويعرض النتيجة للمستخدم.
 * يعتمد على getProductDetails من aliexpressClient، والتي تحتوي على Rate Limiting وCache داخلي.
 */
async function handleAnalyzeProduct(ctx, { productId, url }) {
  const chatId = ctx.chat.id;

  try {
    // تحديث نشاط المستخدم
    await updateUserActivity(chatId, true);

    // رسالة انتظار للمستخدم
    await ctx.reply(
      '⏳ جاري تحليل رابط المنتج وجلب البيانات من AliExpress، يرجى الانتظار للحظات...'
    );

    // جلب بيانات المنتج من AliExpress API (مع كاش وريـت ليميت داخل aliexpressClient)
    const productData = await getProductDetails(productId, 'USD', 'AR', 'DZ');

    // إذا كان لدى AliExpress رابط ترويج جاهز، نستخدمه، وإلا نبني واحداً من productId
    const affiliateLink =
      productData.promotion_link || buildAffiliateLink(productId);

    const { message, mainImage } = buildArabicAnalysisMessage({
      productId,
      productData,
      affiliateLink
    });

    if (mainImage) {
      await ctx.replyWithPhoto(mainImage, {
        caption: message
      });
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    console.error('❌ خطأ أثناء تحليل المنتج:', err);

    const msg = String(err.message || '');

    // معالجة خاصة لخطأ ApiCallLimit (تجاوز حدّ التردد)
    if (
      msg.includes('ApiCallLimit') ||
      msg.includes('access frequency exceeds the limit')
    ) {
      await ctx.reply(
        '⚠️ يبدو أنه تم الوصول مؤقتاً إلى الحد الأقصى لعدد الطلبات المسموح بها من واجهة AliExpress.
' +
        'يرجى الانتظار لثوانٍ قليلة ثم إعادة المحاولة.
' +
        'هذه مشكلة تقنية مؤقتة تتعلق بسرعة الاتصال بالمخدم، وليست مرتبطة بصحة الرابط نفسه.'
      );
      return;
    }

    // باقي الأخطاء: رسالة عامة مع إظهار التفاصيل للمطور
    await ctx.reply(
      '❌ عذراً، حدث خطأ غير متوقع أثناء محاولة تحليل هذا المنتج.
' +
      'يرجى المحاولة مرة أخرى لاحقاً، أو التأكد من صحة الرابط.

' +
      'تفاصيل الخطأ (للمطورين): ' + msg
    );
  }
}

module.exports = handleAnalyzeProduct;
