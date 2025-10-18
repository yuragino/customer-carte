import { CASUAL_PRICES } from "../constants.js";
export function calculateCustomerPayment(app, customer, type, withDiscount = false) {
  let total = 0;
  const formData = app.formData;
  // 基本料金 ----------------------------
  const isPrepayment = type === 'prepayment';
  const isOnSite = type === 'onSite' || type === 'onSiteAdjusted';

  if (isPrepayment && formData.representative.reservationMethod !== null) {
    // 前払い（予約サイト経由など）
    if (customer.dressingType === 'レンタル&着付') total += CASUAL_PRICES.RENTAL_DRESSING;
    else if (customer.dressingType === '着付のみ') total += CASUAL_PRICES.DRESSING_ONLY;
  }

  if (isOnSite && formData.representative.reservationMethod === null) {
    // 現地払い（直接予約など）
    if (customer.dressingType === 'レンタル&着付') total += CASUAL_PRICES.RENTAL_DRESSING;
    else if (customer.dressingType === '着付のみ') total += CASUAL_PRICES.DRESSING_ONLY;
  }

  // オプション料金 ----------------------
  if (customer.options.footwear) total += CASUAL_PRICES.FOOTWEAR;
  if (customer.gender === 'female' && customer.options.obiBag) total += CASUAL_PRICES.BAG;

  // 追加レンタル -------------------------
  total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);

  // 値引き補正 --------------------------
  if (withDiscount && customer.discountAmount) {
    total -= customer.discountAmount;
  }

  return total;
}
