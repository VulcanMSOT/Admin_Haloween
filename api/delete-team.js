import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { logAdminAction } from './_lib/audit.js';
import { getSupabaseAdmin } from './_lib/supabase-admin.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'DELETE', 'OPTIONS'])) return;
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return methodNotAllowed(response, ['POST', 'DELETE']);
  }

  const session = requireSession(request, response);
  if (!session) return;

  const body = parseBody(request);
  const registrationId = body.registrationId || request.query?.id;
  const reason = String(body.reason || '').trim() || 'Deleted by admin';

  if (!registrationId) {
    return json(response, 400, { error: 'Registration ID is required to delete a team.' });
  }

  try {
    const existing = await prisma.registration.findUnique({
      where: { id: String(registrationId) },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    if (!existing) {
      return json(response, 404, { error: 'Team / Registration not found.' });
    }

    // 1. If team had a confirmed payment with a coupon, restore the coupon used count
    if (existing.couponCode && existing.paymentStatus === 'PAID') {
      try {
        await prisma.coupon.updateMany({
          where: { code: existing.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      } catch (couponErr) {
        console.warn('Could not decrement coupon used count:', couponErr);
      }
    }

    // 2. If there was an uploaded screenshot in Supabase storage, attempt cleanup
    if (existing.screenshotPath) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.storage.from('payment-screenshots').remove([existing.screenshotPath]);
        }
      } catch (storageErr) {
        console.warn('Could not remove screenshot file from storage:', storageErr);
      }
    }

    // 3. Delete registration from database (TeamMember rows are deleted via Cascade)
    await prisma.registration.delete({
      where: { id: existing.id },
    });

    // 4. Log admin audit action with full team details snapshot
    await logAdminAction({
      adminEmail: session.email,
      action: 'delete_team',
      targetId: existing.id,
      details: {
        teamId: existing.teamId || existing.orderRef,
        teamName: existing.teamName,
        paymentRef: existing.paymentRef,
        paymentStatus: existing.paymentStatus,
        utr: existing.utr,
        amount: existing.amount,
        couponCode: existing.couponCode,
        reason,
        memberCount: existing.members.length,
        members: existing.members.map((m) => ({
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          college: m.college,
        })),
      },
    });

    return json(response, 200, {
      ok: true,
      deletedId: existing.id,
      teamName: existing.teamName,
      teamId: existing.teamId || existing.orderRef,
      message: `Team "${existing.teamName}" (${existing.teamId || existing.orderRef}) deleted permanently.`,
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return json(response, 500, { error: error.message || 'Could not delete team.' });
  }
}
