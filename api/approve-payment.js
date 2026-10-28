import { randomBytes } from 'node:crypto';
import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { confirmTeamReferral, ensureMiraiReferrersForRegistration } from './_lib/referral.js';

function ticketId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
  return `VULCAN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const { registrationId, note } = parseBody(request);
  if (!registrationId) return json(response, 400, { error: 'Choose a registration first.' });

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!existing) return json(response, 404, { error: 'Registration not found.' });

    // Idempotent: if already paid, do not regenerate ticket
    if (existing.paymentStatus === 'PAID') {
      return json(response, 200, {
        ok: true,
        registration: existing,
        alreadyApproved: true,
        message: 'This payment was already confirmed.',
      });
    }

    const { amountReceived } = parseBody(request);
    const parsedAmountReceived = (amountReceived !== undefined && amountReceived !== null && String(amountReceived).trim() !== '' && !isNaN(Number(amountReceived)))
      ? Number(amountReceived)
      : existing.amount;

    const nextTicketId = existing.ticketId || ticketId();
    const nextTicketToken = existing.ticketToken || randomBytes(24).toString('base64url');

    const updated = await prisma.$transaction(async (tx) => {
      // 1. If a coupon code is applied, validate that it is active and within usage limits
      if (existing.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: existing.couponCode },
        });

        if (coupon) {
          if (!coupon.active) {
            throw new Error(`Coupon ${existing.couponCode} is no longer active.`);
          }
          if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            throw new Error(`Coupon ${existing.couponCode} has reached its maximum uses.`);
          }
          if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
            throw new Error(`Coupon ${existing.couponCode} has expired.`);
          }

          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      // 2. Update registration status
      const reg = await tx.registration.update({
        where: { id: existing.id },
        data: {
          paymentStatus: 'PAID',
          amountReceived: parsedAmountReceived,
          paymentApprovedAt: new Date(),
          paymentApprovedBy: session.email || 'organiser',
          paymentNote: note ? String(note).slice(0, 500) : null,
          ticketId: nextTicketId,
          ticketToken: nextTicketToken,
        },
        include: { members: { orderBy: { position: 'asc' } } },
      });

      // 3. Confirm referral if this team was referred
      await confirmTeamReferral(existing.id, tx);

      // 4. Automatically generate referral codes for any Mirai student members
      await ensureMiraiReferrersForRegistration(existing.id, tx);

      return reg;
    }, { maxWait: 10000, timeout: 20000 });

    await logAdminAction({
      adminEmail: session.email,
      action: 'confirm_payment',
      targetId: updated.id,
      details: {
        teamId: updated.teamId || updated.orderRef,
        paymentRef: updated.paymentRef,
        utr: updated.utr,
        ticketId: updated.ticketId,
        listPrice: updated.listPrice,
        couponCode: updated.couponCode,
        discountAmount: updated.discountAmount,
        amount: updated.amount,
        amountReceived: updated.amountReceived,
      },
    });

    return json(response, 200, {
      ok: true,
      registration: updated,
      message: 'Payment confirmed and official ticket generated.',
    });
  } catch (error) {
    console.error('Payment approval error', error);
    return json(response, 500, { error: error.message || 'Could not approve this payment.' });
  }
}
