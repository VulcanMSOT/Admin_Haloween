import { handleCors, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'OPTIONS'])) return;
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

  if (!requireSession(request, response)) return;

  const onlyAdmitted = request.query?.filter === 'admitted' || request.query?.only === 'admitted';

  try {
    const registrations = await prisma.registration.findMany({
      where: onlyAdmitted ? { checkedInAt: { not: null } } : {},
      orderBy: onlyAdmitted ? { checkedInAt: 'desc' } : { createdAt: 'asc' },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    const header = [
      'Team ID',
      'Team Name',
      'Admission Status',
      'Checked In Time (IST)',
      'Payment Status',
      'Payment Ref',
      'Order Ref',
      'Ticket ID',
      'Ticket Token',
      'List Price',
      'Coupon Code',
      'Discount Amount',
      'Final Amount',
      'Amount Received',
      'UTR',
      'Created At',
      'Email Status',
      'Leader Name', 'Leader Email', 'Leader Phone', 'Leader College',
      'Member 2 Name', 'Member 2 Email', 'Member 2 Phone', 'Member 2 College',
      'Member 3 Name', 'Member 3 Email', 'Member 3 Phone', 'Member 3 College',
      'Member 4 Name', 'Member 4 Email', 'Member 4 Phone', 'Member 4 College',
    ];

    const rows = registrations.map((r) => {
      const teamId = r.teamId || r.orderRef || '';
      const checkedInTimeStr = r.checkedInAt
        ? new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
          }).format(new Date(r.checkedInAt))
        : 'Not Admitted';

      const memberCells = [];
      for (let i = 0; i < 4; i++) {
        const m = r.members[i];
        if (m) {
          memberCells.push(m.fullName, m.email, m.phone, m.college);
        } else {
          memberCells.push('', '', '', '');
        }
      }

      return [
        teamId,
        r.teamName,
        r.checkedInAt ? 'PRESENT / ADMITTED' : 'NOT ADMITTED',
        checkedInTimeStr,
        r.paymentStatus,
        r.paymentRef || '',
        r.orderRef || '',
        r.ticketId || '',
        r.ticketToken || '',
        r.listPrice ?? 300,
        r.couponCode || '—',
        r.discountAmount ?? 0,
        r.amount,
        r.amountReceived !== null && r.amountReceived !== undefined ? r.amountReceived : (r.paymentStatus === 'PAID' ? r.amount : ''),
        r.utr || r.paymentReference || '',
        r.createdAt.toISOString(),
        r.emailStatus || 'not_sent',
        ...memberCells,
      ];
    });

    const filename = onlyAdmitted
      ? `hack-o-lantern-admitted-teams-${new Date().toISOString().slice(0, 10)}.csv`
      : 'hack-o-lantern-teams.csv';

    const csvContent = '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.end(csvContent);
  } catch (error) {
    console.error('CSV export error', error);
    response.statusCode = 500;
    response.end('Could not export registrations.');
  }
}
