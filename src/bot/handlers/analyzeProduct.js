const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

/**
 * بناء رسالة تحليل المنتج بالفرنسية، بدون emoji وبدون strings متعددة الأسطر
 */
function buildFrenchMessage({ productId, productData, affiliateLink }) {
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

  const title = productData.product_title || 'Produit sans nom';
  const lines = [];

  // Pas d’emoji, pas de multilignes dans une seule chaîne
  lines.push('Analyse du produit terminée.');
  lines.push('');
  lines.push('Nom du produit : ' + title);
  lines.push('ID du produit : ' + productId);
  lines.push('');
  lines.push('Détails du prix (USD) :');
  lines.push('Prix initial : ' + formatCurrencyUSD(originalPrice));
  lines.push('Prix actuel : ' + formatCurrencyUSD(salePrice));
  if (discount > 0) {
    lines.push('Remise estimée : ' + formatCurrencyUSD(discount));
  }
  lines.push('Frais d’expédition estimés : ' + formatCurrencyUSD(shipping));
  lines.push('Valeur des coupons : ' + formatCurrencyUSD(couponValue));
  lines.push('');
  lines.push('Prix final estimé : ' + formatCurrencyUSD(finalPrice));
  lines.push('');
  lines.push('Note : les prix et coupons peuvent varier selon le compte et la région.');

  if (affiliateLink) {
    lines.push('');
    lines.push('Lien d’achat :');
    lines.push(affiliateLink);
  }

  const message = lines.join('\n');
  const mainImage = productData.product_main_image_url || null;

  return { message, mainImage };
}

/**
 * استدعاء AliExpress API، وبناء الرسالة، وإرسال النتيجة للمستخدم
 */
async function handleAnalyzeProduct(ctx, { productId }) {
  const chatId = ctx.chat.id;

  try {
    await updateUserActivity(chatId, true);

    await ctx.reply('Analyse en cours, veuillez patienter quelques instants...');

    const productData = await getProductDetails(productId, 'USD', 'FR', 'DZ');

    const affiliateLink =
      productData.promotion_link || buildAffiliateLink(productId);

    const { message, mainImage } = buildFrenchMessage({
      productId,
      productData,
      affiliateLink
    });

    if (mainImage) {
      // حماية من خطأ Telegram: "message caption is too long"
      const MAX_CAPTION = 900; // أقل من حد 1024 بحوالي هامش آمن
      let caption = message;
      let rest = '';

      if (message.length > MAX_CAPTION) {
        caption = message.slice(0, MAX_CAPTION);
        rest = message.slice(MAX_CAPTION);
      }

      await ctx.replyWithPhoto(mainImage, { caption });

      if (rest.trim().length > 0) {
        await ctx.reply(rest);
      }
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    const msg = String(err.message || '');
    if (
      msg.includes('ApiCallLimit') ||
      msg.includes('access frequency exceeds the limit')
    ) {
      await ctx.reply(
        'Limite de fréquence de l’API atteinte temporairement. Veuillez réessayer dans quelques secondes.'
      );
      return;
    }

    await ctx.reply(
      'Erreur inattendue lors de l’analyse du produit. Veuillez réessayer plus tard ou vérifier le lien.\n\nDétails : ' + msg
    );
  }
}

module.exports = handleAnalyzeProduct;
