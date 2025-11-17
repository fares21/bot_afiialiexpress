const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

/**
 * بناء رسالة تحليل المنتج بالعربية باستخدام Template Literal (backticks)
 * لتفادي مشاكل الأسطر المتعددة داخل النص.
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

  const mainImage = productData.product_main_image_url || null;

  // ⚠️ هنا نستخدم backticks وليس single quotes، ويمكننا وضع أسطر متعددة بشكل آمن
  let message = `✅ تم تحليل رابط المنتج بنجاح.

📦 اسم المنتج: ${title}
🆔 معرّف المنتج: ${productId}

💰 التفاصيل المالية (بالدولار الأمريكي):
• السعر الأصلي التقريبي: ${formatCurrencyUSD(originalPrice)}
• السعر الحالي بعد التخفيضات: ${formatCurrencyUSD(salePrice)}
`;

  if (discount > 0) {
    message += `• قيمة التوفير التقريبية: ${formatCurrencyUSD(discount)}
`;
  }

  message += `• تكلفة الشحن التقديرية إلى الجزائر: ${formatCurrencyUSD(shipping)}
• مجموع الكوبونات المطبقة (إن وُجدت): ${formatCurrencyUSD(couponValue)}

🎯 السعر النهائي التقريبي بعد احتساب الشحن والكوبونات:
→ ${formatCurrencyUSD(finalPrice)}

ℹ️ ملاحظات مهمة:
- قد تختلف الأسعار الفعلية والكوبونات المتاحة حسب حسابك، والمنطقة، وتاريخ الشراء.
- يرجى التحقق من التفاصيل النهائية داخل تطبيق أو موقع AliExpress قبل إتمام الطلب.
`;

  if (affiliateLink) {
    message += `

🔗 رابط الشراء (قد يكون رابط أفلييت يتضمن تتبّعاً للزيارات):
${affiliateLink}
`;
  }

  return { message, mainImage };
}

/**
 * المعالج الرئيسي الذي يستدعي AliExpress API ويعرض النتيجة للمستخدم.
 */
async function handleAnalyzeProduct(ctx, { productId, url }) {
  const chatId = ctx.chat.id;

  try {
    await updateUserActivity(chatId, true);

    await ctx.reply(
      '⏳ جاري تحليل رابط المنتج وجلب البيانات من AliExpress، يرجى الانتظار للحظات...'
    );

    // جلب بيانات المنتج من AliExpress API
    const productData = await getProductDetails(productId, 'USD', 'AR', 'DZ');

    // بناء رابط الأفلييت
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
    console.error('❌ خطأ أثناء تحليل المنتج:', err);
    const msg = String(err.message || '');

    if (
      msg.includes('ApiCallLimit') ||
      msg.includes('access frequency exceeds the limit')
    ) {
      await ctx.reply(
        '⚠️ تم الوصول مؤقتاً إلى الحد الأقصى لعدد الطلبات المسموح بها من واجهة AliExpress.
' +
        'يرجى الانتظار لثوانٍ قليلة ثم إعادة المحاولة.'
      );
      return;
    }

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
