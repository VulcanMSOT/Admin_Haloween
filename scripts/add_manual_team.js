import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../api/_lib/prisma.js';

function createTicketId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
  return `VULCAN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

function createPaymentRef() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let chars = '';
  while (chars.length < 6) {
    const bytes = randomBytes(16);
    for (let i = 0; i < bytes.length && chars.length < 6; i++) {
      const char = alphabet[bytes[i] % alphabet.length];
      if (!char.match(/[0O1I]/g)) {
        chars += char;
      }
    }
  }
  return `PAY-${chars.slice(0, 6)}`;
}

async function run() {
  console.log('=== ADDING TEAM MONARCH MANUALLY ===\n');

  // 1. Generate Next Team ID from Sequence
  const seqRes = await prisma.$queryRaw`SELECT nextval('public.team_id_seq') AS seq`;
  const seq = seqRes[0]?.seq || 1082;
  const teamId = `VHK-${String(seq).padStart(4, '0')}`;
  console.log(`Generated Team ID: ${teamId}`);

  // 2. Generate Ticket ID, Token, and Payment Ref
  const ticketId = createTicketId();
  const ticketToken = randomBytes(24).toString('base64url');
  const paymentRef = createPaymentRef();
  const paymentToken = randomBytes(24).toString('base64url');
  const paymentTokenHash = createHash('sha256').update(paymentToken).digest('hex');

  console.log(`Generated Ticket ID: ${ticketId}`);
  console.log(`Generated Payment Ref: ${paymentRef}`);

  // 3. Create Registration and Members in Database
  const result = await prisma.registration.create({
    data: {
      teamName: 'Monarch',
      normalizedTeamName: 'monarch',
      teamId,
      orderRef: teamId,
      paymentRef,
      amount: 300,
      listPrice: 300,
      discountAmount: 0,
      amountReceived: 300,
      ticketId,
      ticketToken,
      paymentStatus: 'PAID',
      paymentSubmittedAt: new Date(),
      paymentApprovedAt: new Date(),
      paymentApprovedBy: 'admin@vulcan.club',
      paymentNote: 'Manual registration & ticket issuance by admin',
      isComp: true,
      compReason: 'Manual addition by admin',
      emailStatus: 'not_sent',
      emailSentCount: 0,
      paymentTokenHash,
      members: {
        create: [
          {
            position: 1,
            fullName: 'Raj Jadhav',
            email: 'sj41244124@gmail.com',
            normalizedEmail: 'sj41244124@gmail.com',
            phone: '98215578023',
            normalizedPhone: '8215578023',
            college: 'Mirai School of Technology',
          },
          {
            position: 2,
            fullName: 'Ayush Upadhyay',
            email: 'uvishnu2008@gmail.com',
            normalizedEmail: 'uvishnu2008@gmail.com',
            phone: '7668695212',
            normalizedPhone: '7668695212',
            college: 'Mirai School of Technology',
          },
          {
            position: 3,
            fullName: 'Aryan kadam',
            email: 'kadamaryan2233@gmail.com',
            normalizedEmail: 'kadamaryan2233@gmail.com',
            phone: '9209950372',
            normalizedPhone: '9209950372',
            college: 'Mirai School of Technology',
          },
        ],
      },
    },
    include: {
      members: { orderBy: { position: 'asc' } },
    },
  });

  // 4. Log in AuditLog
  await prisma.auditLog.create({
    data: {
      adminEmail: 'admin@vulcan.club',
      action: 'manual_team_creation',
      targetId: result.id,
      details: {
        teamId: result.teamId,
        teamName: result.teamName,
        ticketId: result.ticketId,
        membersCount: result.members.length,
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log('\n✓ Team successfully created:');
  console.log({
    id: result.id,
    teamId: result.teamId,
    teamName: result.teamName,
    ticketId: result.ticketId,
    paymentStatus: result.paymentStatus,
    members: result.members.map((m) => `${m.position}. ${m.fullName} (${m.phone}, ${m.email})`),
  });

  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to create team:', err);
  process.exit(1);
});

