import { DEFAULT_PRICES } from "./price-config-utils.js";
export function calculateCustomerPayment(app, customer, type, withDiscount = false) {
  let total = 0;
  const formData = app.formData;
  const prices = app.prices ?? DEFAULT_PRICES;
  // 基本料金 ----------------------------
  const isPrepayment = type === 'prepayment';
  const isOnSite = type === 'onSite' || type === 'onSiteAdjusted';

  const isOnSitePaymentMethod = formData.representative.reservationMethod === null || formData.representative.reservationMethod === 'ホームページ';

  if (isPrepayment && !isOnSitePaymentMethod) {
    // 前払い（予約サイト経由など）
    if (customer.dressingType === 'レンタル&着付') total += customer.isChild ? prices.childRentalDressing : prices.rentalDressing;
    else if (customer.dressingType === '着付のみ') total += prices.dressingOnly;
  }

  if (isOnSite && isOnSitePaymentMethod) {
    // 現地払い（直接予約・ホームページ経由など）
    if (customer.dressingType === 'レンタル&着付') total += customer.isChild ? prices.childRentalDressing : prices.rentalDressing;
    else if (customer.dressingType === '着付のみ') total += prices.dressingOnly;
  }

  // オプション料金 ----------------------
  if (customer.options.footwear) total += prices.footwear;
  if (customer.gender === 'female' && customer.options.obiBag) total += prices.bag;

  // 追加レンタル -------------------------
  total += customer.additionalRentals.reduce((sum, item) => sum + (item.price || 0), 0);

  // 値引き補正 --------------------------
  if (withDiscount && customer.discountAmount) {
    total -= customer.discountAmount;
  }

  return total;
}
