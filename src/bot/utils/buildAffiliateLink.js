/**
 * بناء رابط أفلييت لمنتج Aliexpress اعتماداً على productId
 * يمكنك تعديل منطق بناء الرابط حسب برنامج الأفلييت الخاص بك.
 */

function buildAffiliateLink(productId) {
  const affiliateId = process.env.AFFILIATE_ID || '';
  // مثال تقريبي، عدّل حسب متطلباتك الفعلية:
  // https://s.click.aliexpress.com/deep_link.htm?aff_short_key=XXXX&dl_target_url=...
  const baseProductUrl = `https://www.aliexpress.com/item/${productId}.html`;
  if (!affiliateId) {
    // في حال لم يتم ضبط معرف الأفلييت، نرجع الرابط الأصلي
    return baseProductUrl;
  }

  const encodedTarget = encodeURIComponent(baseProductUrl);
  const affiliateLink = `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${affiliateId}&dl_target_url=${encodedTarget}`;
  return affiliateLink;
}

module.exports = buildAffiliateLink;
