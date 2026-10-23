import { methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';

const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
  if (!requireSession(request, response)) return;

  try {
    const registrations = await prisma.registration.findMany({
      orderBy: { createdAt: 'asc' },
      include: { members: { orderBy: { position: 'asc' } } },
    });

    const header = [
      'Order Ref',
      'Team name',
      'Amount',
      'Payment status',
      'UTR',
      'Screenshot Path',
      'Ticket ID',
      'Ticket Token',
      'Created at',
      'Checked in at',
      'Email Status',
      'Email Send Count',
      'Is Comp',
      'Comp Reason',
      'Reject Reason',
      'Member 1 name', 'Member 1 email', 'Member 1 phone', 'Member 1 college',
      'Member 2 name', 'Member 2 email', 'Member 2 phone', 'Member 2 college',
      'Member 3 name', 'Member 3 email', 'Member 3 phone', 'Member 3 college',
    ];

    const rows = registrations.map((r) => [
      r.orderRef || '',
      r.teamName,
      r.amount,
      r.paymentStatus,
      r.utr || r.paymentReference || '',
      r.screenshotPath || '',
      r.ticketId || '',
      r.ticketToken || '',
      r.createdAt.toISOString(),
      r.checkedInAt?.toISOString() || '',
      r.emailStatus || '',
      r.emailSentCount || 0,
      r.isComp ? 'YES' : 'NO',
      r.compReason || '',
      r.rejectReason || '',
      ...r.members.flatMap((m) => [m.fullName, m.email, m.phone, m.college]),
    ]);

    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="hack-o-lantern-registrations.csv"')
      .send([header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n'));
  } catch (error) {
    console.error('CSV export error', error);
    response.status(500).send('Could not export registrations.');
  }
}
