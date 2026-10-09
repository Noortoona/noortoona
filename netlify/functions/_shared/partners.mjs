export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{4,24}$/.test(code) ? code : '';
}

export function referralAmounts(baseAmount, addonAmount, profile) {
  const base = Number(baseAmount);
  const addon = Number(addonAmount);
  if (!Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(addon) || addon < 0) throw new Error('INVALID_PRICE');
  const discountBps = profile?.kind === 'influencer' ? Number(profile.discount_bps) : 0;
  const commissionBps = profile ? Number(profile.commission_bps) : 0;
  if (![discountBps, commissionBps].every(bps => Number.isInteger(bps) && bps >= 0 && bps <= 10000)) throw new Error('INVALID_PARTNER_RATE');
  const discountAmount = Math.round(base * discountBps / 10000);
  const discountedBase = base - discountAmount;
  return {
    discountAmount,
    commissionAmount: Math.round(discountedBase * commissionBps / 10000),
    total: discountedBase + addon,
  };
}

export async function activePartner(db, rawCode, customerId) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const rows = await db.sql`
    SELECT p.user_id,p.kind,p.code,p.commission_bps,p.discount_bps
    FROM partner_profiles p JOIN users u ON u.id=p.user_id
    WHERE p.code=${code} AND p.status='active' AND u.status='active' AND p.user_id<>${customerId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function recordAcquisition(db, order) {
  if (!order?.user_id || !order?.id) return;
  const inserted = await db.sql`
    INSERT INTO customer_acquisitions(customer_user_id,first_order_id,partner_user_id)
    VALUES (${order.user_id},${order.id},${order.referral_partner_id || null})
    ON CONFLICT(customer_user_id) DO NOTHING
    RETURNING first_order_id,partner_user_id
  `;
  const acquisition = inserted[0] || (await db.sql`
    SELECT first_order_id,partner_user_id FROM customer_acquisitions WHERE customer_user_id=${order.user_id} LIMIT 1
  `)[0];
  if (acquisition?.first_order_id !== order.id || !acquisition.partner_user_id || !order.commission_amount) return;
  await db.sql`
    INSERT INTO partner_commissions(id,customer_user_id,partner_user_id,order_id,amount)
    VALUES (${crypto.randomUUID()},${order.user_id},${acquisition.partner_user_id},${order.id},${order.commission_amount})
    ON CONFLICT(customer_user_id) DO NOTHING
  `;
}
