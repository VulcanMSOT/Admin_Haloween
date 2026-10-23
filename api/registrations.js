import { json, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { createSignedScreenshotUrl } from './_lib/supabase-admin.js';

const validStatuses = new Set(['PENDING_PAYMENT', 'PENDING_REVIEW', 'PAID', 'REJECTED', 'EXPIRED']);

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  const session = requireSession(request, response);
  if (!session) return;

  const search = String(request.query.search || '').trim().slice(0, 80);
  const status = validStatuses.has(request.query.status) ? request.query.status : undefined;

  const where = {
    ...(status ? { paymentStatus: status } : {}),
    ...(search
      ? {
          OR: [
            { teamName: { contains: search, mode: 'insensitive' } },
            { orderRef: { contains: search, mode: 'insensitive' } },
            { ticketId: { contains: search, mode: 'insensitive' } },
            { utr: { contains: search, mode: 'insensitive' } },
            { paymentReference: { contains: search, mode: 'insensitive' } },
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
    const [registrations, grouped, totalCheckedIn] = await prisma.$transaction([
      prisma.registration.findMany({
        where,
        take: 200,
        orderBy: { createdAt: 'desc' },
        include: { members: { orderBy: { position: 'asc' } } },
      }),
      prisma.registration.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
      prisma.registration.count({ where: { checkedInAt: { not: null } } }),
    ]);

    const totals = Object.fromEntries(grouped.map((row) => [row.paymentStatus, row._count._all]));
    const totalCount = Object.values(totals).reduce((a, b) => a + b, 0);
    const paidCount = totals.PAID || 0;
    const confirmedRevenue = paidCount * 300;

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

        return {
          id: r.id,
          orderRef: r.orderRef,
          amount: r.amount,
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
          emailStatus: r.emailStatus,
          emailSentCount: r.emailSentCount,
          ticketEmailSentAt: r.ticketEmailSentAt,
          ticketEmailError: r.ticketEmailError,
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
        revenue: confirmedRevenue,
      },
    });
  } catch (error) {
    console.error('Admin registration list error', error);
    return json(response, 500, { error: 'Could not load registrations.' });
  }
}
