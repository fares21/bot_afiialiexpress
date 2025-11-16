/**
 * تنسيق الأسعار والقيم النقدية بالعربية الرسمية.
 */

function formatCurrencyUSD(value) {
  if (value == null || isNaN(value)) return 'غير متوفر';
  const num = Number(value);
  return `${num.toFixed(2)} دولار أمريكي`;
}

function formatPercentage(value) {
  if (value == null || isNaN(value)) return 'غير متوفر';
  const num = Number(value);
  return `${num.toFixed(0)}٪`;
}

/**
 * يحسب السعر النهائي بعد الخصومات.
 * price: السعر الأساسي
 * shipping: تكلفة الشحن
 * couponValue: مجموع قيمة الكوبونات المطبقة
 */
function calculateFinalPrice(price, shipping, couponValue) {
  const p = Number(price) || 0;
  const s = Number(shipping) || 0;
  const c = Number(couponValue) || 0;
  const final = Math.max(p + s - c, 0);
  return final;
}

module.exports = {
  formatCurrencyUSD,
  formatPercentage,
  calculateFinalPrice
};
