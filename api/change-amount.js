import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, listPrice, couponCode, discountAmount, amount, reason } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });

  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    return json(response, 400, { error: 'A reason is required to adjust pricing or coupon for audit purposes.' });
  }

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    let finalCoupon = null;
    let finalDiscount = Number(discountAmount ?? existing.discountAmount ?? 0);
    const finalListPrice = Number(listPrice ?? existing.listPrice ?? 300);

    if (couponCode && String(couponCode).trim()) {
      const normalised = String(couponCode).trim().toLowerCase();
      const couponRecord = await prisma.coupon.findUnique({
        where: { code: normalised },
      });
      if (!couponRecord) {
        return json(response, 400, { error: `Coupon code "${normalised}" not found in database.` });
      }
      finalCoupon = couponRecord.code;
      if (discountAmount === undefined) {
        finalDiscount = couponRecord.type === 'percent'
          ? Math.round((finalListPrice * couponRecord.value) / 100)
          : Math.min(finalListPrice, couponRecord.value);
      }
    } else if (couponCode === '' || couponCode === null) {
      finalCoupon = null;
      if (discountAmount === undefined) {
        finalDiscount = 0;
      }
    }

    const calculatedAmount = Math.max(0, finalListPrice - finalDiscount);
    const finalAmount = amount !== undefined && !isNaN(Number(amount))
      ? Number(amount)
      : calculatedAmount;

    if (finalAmount <= 0) {
      return json(response, 400, {
        error: 'Amount cannot be zero or negative. Use Comp Ticket action if granting complimentary entry.',
      });
    }

    const updated = await prisma.registration.update({
      where: { id: existing.id },
      data: {
        listPrice: finalListPrice,
        couponCode: finalCoupon,
        discountAmount: finalDiscount,
        amount: finalAmount,
      },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    await logAdminAction({
      adminEmail: session.email,
      action: 'change_amount_or_coupon',
      targetId: updated.id,
      details: {
        teamId: updated.teamId || updated.orderRef,
        previous: {
          listPrice: existing.listPrice,
          couponCode: existing.couponCode,
          discountAmount: existing.discountAmount,
          amount: existing.amount,
        },
        updated: {
          listPrice: updated.listPrice,
          couponCode: updated.couponCode,
          discountAmount: updated.discountAmount,
          amount: updated.amount,
        },
        reason: cleanReason,
      },
    });

    return json(response, 200, {
      ok: true,
      registration: updated,
      message: 'Pricing and coupon updated successfully.',
    });
  } catch (error) {
    console.error('Change amount error:', error);
    return json(response, 500, { error: 'Could not change pricing or coupon.' });
  }
}
