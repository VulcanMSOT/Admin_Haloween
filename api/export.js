import { handleCors, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'OPTIONS'])) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

  if (!requireSession(request, response)) return;

  const publicSiteUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://vulcan-club.vercel.app';

  try {
    const registrations = await prisma.registration.findMany({
      orderBy: { createdAt: 'asc' },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    const header = [
      'Team ID',
      'Payment Ref',
      'Order Ref',
      'Team Name',
      'List Price',
      'Coupon Code',
      'Discount Amount',
      'Final Amount',
      'Amount Received',
      'Payment Status',
      'UTR',
      'Ticket ID',
      'Ticket Token',
      'Status & Ticket Link',
      'Created At',
      'Checked In At',
      'Email Status',
      'Email Sent By',
      'Email Sent At',
      'Email Sent Count',
      'Is Comp',
      'Comp Reason',
      'Reject Reason',
      'Leader Name', 'Leader Email', 'Leader Phone', 'Leader College',
      'Member 2 Name', 'Member 2 Email', 'Member 2 Phone', 'Member 2 College',
      'Member 3 Name', 'Member 3 Email', 'Member 3 Phone', 'Member 3 College',
    ];

    const rows = registrations.map((r) => {
      const leader = r.members.find((m) => m.position === 1) || r.members[0];
      const teamId = r.teamId || r.orderRef || '';
      const ticketLink = leader?.email
        ? `${publicSiteUrl}/halloween-hack?status=lookup&teamId=${encodeURIComponent(teamId)}&email=${encodeURIComponent(leader.email)}`
        : `${publicSiteUrl}/halloween-hack`;

      return [
        teamId,
        r.paymentRef || '',
        r.orderRef || '',
        r.teamName,
        r.listPrice ?? 300,
        r.couponCode || '—',
        r.discountAmount ?? 0,
        r.amount,
        r.amountReceived !== null && r.amountReceived !== undefined ? r.amountReceived : (r.paymentStatus === 'PAID' ? r.amount : ''),
        r.paymentStatus,
        r.utr || r.paymentReference || '',
        r.ticketId || '',
        r.ticketToken || '',
        ticketLink,
        r.createdAt.toISOString(),
        r.checkedInAt?.toISOString() || '',
        r.emailStatus || 'not_sent',
        r.emailSentBy || '',
        r.emailSentAt?.toISOString() || '',
        r.emailSentCount || 0,
        r.isComp ? 'YES' : 'NO',
        r.compReason || '',
        r.rejectReason || '',
        ...r.members.flatMap((m) => [m.fullName, m.email, m.phone, m.college]),
      ];
    });

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="hack-o-lantern-teams.csv"');
    response.end([header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n'));
  } catch (error) {
    console.error('CSV export error', error);
    response.statusCode = 500;
    response.end('Could not export registrations.');
  }
}
