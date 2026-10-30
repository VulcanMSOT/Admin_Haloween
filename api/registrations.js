import { handleCors, json, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { createSignedScreenshotUrl } from './_lib/supabase-admin.js';

const validStatuses = new Set(['PENDING_PAYMENT', 'PENDING_REVIEW', 'PAID', 'REJECTED', 'EXPIRED']);

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'OPTIONS'])) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

  const session = requireSession(request, response);
  if (!session) return;

  const search = String(request.query.search || '').trim().slice(0, 80);
  const status = validStatuses.has(request.query.status) ? request.query.status : undefined;
  const emailFilter = String(request.query.emailFilter || '').trim();
  const couponFilter = String(request.query.couponFilter || '').trim();

  const where = {
    ...(status ? { paymentStatus: status } : {}),
    ...(emailFilter === 'not_sent' ? { paymentStatus: 'PAID', emailStatus: { not: 'sent' } } : {}),
    ...(couponFilter === 'has_coupon'
      ? { couponCode: { not: null } }
      : couponFilter
        ? { couponCode: { equals: couponFilter, mode: 'insensitive' } }
        : {}),
    ...(search
      ? {
          OR: [
            { teamId: { contains: search, mode: 'insensitive' } },
            { paymentRef: { contains: search, mode: 'insensitive' } },
            { teamName: { contains: search, mode: 'insensitive' } },
            { orderRef: { contains: search, mode: 'insensitive' } },
            { ticketId: { contains: search, mode: 'insensitive' } },
            { utr: { contains: search, mode: 'insensitive' } },
            { paymentReference: { contains: search, mode: 'insensitive' } },
            { couponCode: { contains: search, mode: 'insensitive' } },
            { referralCode: { contains: search, mode: 'insensitive' } },
            {
              members: {
                some: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { college: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  try {
    const [registrations, grouped, totalCheckedIn, confirmedEmailNotSent, paidRows, reminderLogs] = await Promise.all([
      prisma.registration.findMany({
        where,
        take: 300,
        orderBy: { createdAt: 'desc' },
        include: {
          members: { orderBy: { position: 'asc' } },
          referral: {
            include: {
              referrer: {
                select: { id: true, name: true, code: true, email: true, type: true },
              },
            },
          },
        },
      }),
      prisma.registration.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
      prisma.registration.count({ where: { checkedInAt: { not: null } } }),
      prisma.registration.count({ where: { paymentStatus: 'PAID', emailStatus: { not: 'sent' } } }),
      prisma.registration.findMany({
        where: { paymentStatus: 'PAID' },
        select: { amount: true, discountAmount: true, couponCode: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: ['reminder_sent', 'reminder_unmarked'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { targetId: true, action: true, createdAt: true },
      }),
    ]);

    const totals = Object.fromEntries(grouped.map((row) => [row.paymentStatus, row._count._all]));
    const totalCount = Object.values(totals).reduce((a, b) => a + b, 0);
    const paidCount = totals.PAID || 0;
    const confirmedRevenue = paidRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const discountsGiven = paidRows.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const couponTeamsCount = paidRows.filter((r) => Boolean(r.couponCode)).length;

    // Build latest reminder status map per targetId
    const reminderMap = new Map();
    for (const log of reminderLogs) {
      if (log.targetId && !reminderMap.has(log.targetId)) {
        reminderMap.set(log.targetId, {
          sent: log.action === 'reminder_sent',
          sentAt: log.createdAt,
        });
      }
    }

    let reminderSentCount = 0;
    for (const [, info] of reminderMap.entries()) {
      if (info.sent) reminderSentCount++;
    }

    // Detect duplicate UTRs across loaded registrations
    const utrCounts = {};
    for (const r of registrations) {
      if (r.utr) {
        utrCounts[r.utr] = (utrCounts[r.utr] || 0) + 1;
      }
    }

    // Attach signed screenshot URLs and duplicate flags
    const enriched = await Promise.all(
      registrations.map(async (r) => {
        let screenshotSignedUrl = null;
        if (r.screenshotPath) {
          screenshotSignedUrl = await createSignedScreenshotUrl(r.screenshotPath);
        }

        const reminderInfo = reminderMap.get(r.id);
        const reminderSent = Boolean(reminderInfo?.sent);
        const reminderSentAt = reminderInfo?.sentAt || null;

        return {
          id: r.id,
          teamId: r.teamId || r.orderRef,
          paymentRef: r.paymentRef,
          orderRef: r.orderRef,
          listPrice: r.listPrice,
          couponCode: r.couponCode,
          discountAmount: r.discountAmount,
          amount: r.amount,
          amountReceived: r.amountReceived,
          teamName: r.teamName,
          paymentStatus: r.paymentStatus,
          paymentReference: r.paymentReference,
          utr: r.utr,
          screenshotPath: r.screenshotPath,
          screenshotSignedUrl,
          duplicateUtr: r.utr ? utrCounts[r.utr] > 1 : false,
          rejectReason: r.rejectReason,
          ticketId: r.ticketId,
          ticketToken: r.ticketToken,
          emailStatus: r.emailStatus || 'not_sent',
          emailSentCount: r.emailSentCount || 0,
          emailSentBy: r.emailSentBy,
          emailSentAt: r.emailSentAt,
          ticketEmailSentAt: r.ticketEmailSentAt,
          ticketEmailError: r.ticketEmailError,
          reminderSent,
          reminderSentAt,
          isComp: r.isComp,
          compReason: r.compReason,
          checkedInAt: r.checkedInAt,
          createdAt: r.createdAt,
          paymentSubmittedAt: r.paymentSubmittedAt,
          paymentApprovedAt: r.paymentApprovedAt,
          paymentApprovedBy: r.paymentApprovedBy,
          members: r.members.map((m) => ({
            id: m.id,
            position: m.position,
            fullName: m.fullName,
            email: m.email,
            phone: m.phone,
            college: m.college,
          })),
        };
      })
    );

    return json(response, 200, {
      registrations: enriched,
      totals,
      stats: {
        total: totalCount,
        pendingReview: totals.PENDING_REVIEW || 0,
        pendingPayment: totals.PENDING_PAYMENT || 0,
        confirmed: paidCount,
        rejected: totals.REJECTED || 0,
        checkedIn: totalCheckedIn,
        confirmedEmailNotSent,
        revenue: confirmedRevenue,
        discountsGiven,
        couponTeamsCount,
        reminderSentCount,
        reminderPendingCount: Math.max(0, paidCount - reminderSentCount),
      },
    });
  } catch (error) {
    console.error('Admin registration list error', error);
    return json(response, 500, { error: 'Could not load registrations.' });
  }
}
