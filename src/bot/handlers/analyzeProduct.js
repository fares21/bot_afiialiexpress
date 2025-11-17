const { updateUserActivity } = require('../../db/queries');
const buildAffiliateLink = require('../utils/buildAffiliateLink');
const { formatCurrencyUSD, calculateFinalPrice } = require('../utils/priceFormatting');
const { getProductDetails } = require('../utils/aliexpressClient');

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

  // إصلاح السطر المكسور: استخدام '\n' داخل نفس السطر
  const message = lines.join('\n');
  const mainImage = productData.product_main_image_url || null;

  return { message, mainImage };
}

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
      await ctx.replyWithPhoto(mainImage, { caption: message });
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    const msg = String(err.message || '');
    if (
      msg.includes('ApiCallLimit') ||
      msg.includes('access frequency exceeds the limit')
    ) {
      await ctx.reply('Limite de fréquence de l’API atteinte temporairement. Veuillez réessayer dans quelques secondes.');
      return;
    }

    // توحيد الرسالة في String واحد مع \n\n بدون كسر سطر في الكود
    await ctx.reply(
      'Erreur inattendue lors de l’analyse du produit. Veuillez réessayer plus tard ou vérifier le lien.\n\nDétails : ' + msg
    );
  }
}

module.exports = handleAnalyzeProduct;
