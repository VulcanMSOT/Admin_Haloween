import { handleCors, json, methodNotAllowed } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { generateCertificateId } from './_lib/certificate-generator.js';

export default async function handler(request, response) {
  if (handleCors(request, response, ['GET', 'POST', 'OPTIONS'])) return;

  const session = requireSession(request, response);
  if (!session) return;

  // GET: Fetch participants and certificate status
  if (request.method === 'GET') {
    const search = String(request.query.search || '').trim().toLowerCase();
    const filter = String(request.query.filter || 'all'); // 'all' | 'emailed' | 'pending' | 'admitted'

    try {
      // 1. Fetch paid registrations and team members
      const registrations = await prisma.registration.findMany({
        where: { paymentStatus: 'PAID' },
        include: { members: true },
        orderBy: [{ teamId: 'asc' }],
      });

      // 2. Fetch all certificates from database
      const certRows = await prisma.$queryRawUnsafe(`
        SELECT id, member_id, certificate_type, issued_at, email_status, email_sent_at, email_error, email_id
        FROM certificates
      `);

      const certMap = new Map();
      for (const c of certRows) {
        certMap.set(c.member_id, c);
      }

      // 3. Assemble participant list
      const participants = [];
      let totalEmailed = 0;
      let totalIssued = 0;

      for (const reg of registrations) {
        for (const m of reg.members) {
          const cert = certMap.get(m.id);
          const certId = cert ? cert.id : generateCertificateId(reg.teamId, m.position);
          const isIssued = Boolean(cert);
          const isEmailed = cert?.email_status === 'sent';

          if (isIssued) totalIssued++;
          if (isEmailed) totalEmailed++;

          participants.push({
            memberId: m.id,
            fullName: m.fullName,
            email: m.email,
            college: m.college,
            position: m.position,
            isLeader: m.position === 1,
            teamId: reg.teamId,
            teamName: reg.teamName,
            checkedInAt: reg.checkedInAt,
            isAdmitted: Boolean(reg.checkedInAt),
            certificateId: certId,
            isIssued,
            emailStatus: cert?.email_status || 'not_sent',
            emailSentAt: cert?.email_sent_at || null,
            emailError: cert?.email_error || null,
            emailId: cert?.email_id || null,
          });
        }
      }

      // 4. Apply search & filter
      let filtered = participants;

      if (filter === 'emailed') {
        filtered = filtered.filter((p) => p.emailStatus === 'sent');
      } else if (filter === 'pending') {
        filtered = filtered.filter((p) => p.emailStatus !== 'sent');
      } else if (filter === 'admitted') {
        filtered = filtered.filter((p) => p.isAdmitted);
      }

      if (search) {
        filtered = filtered.filter((p) =>
          p.fullName.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search) ||
          (p.teamId && p.teamId.toLowerCase().includes(search)) ||
          p.teamName.toLowerCase().includes(search) ||
          p.college.toLowerCase().includes(search) ||
          p.certificateId.toLowerCase().includes(search)
        );
      }

      return json(response, 200, {
        ok: true,
        stats: {
          totalParticipants: participants.length,
          totalIssued,
          totalEmailed,
          totalPending: participants.length - totalEmailed,
          filteredCount: filtered.length,
        },
        participants: filtered,
      });
    } catch (err) {
      console.error('Certificates GET error:', err);
      return json(response, 500, { error: err.message || 'Failed to load certificates.' });
    }
  }

  // POST: Issue or sync all certificate records
  if (request.method === 'POST') {
    try {
      const registrations = await prisma.registration.findMany({
        where: { paymentStatus: 'PAID' },
        include: { members: true },
      });

      let createdCount = 0;

      for (const reg of registrations) {
        for (const m of reg.members) {
          const certId = generateCertificateId(reg.teamId, m.position);
          const res = await prisma.$executeRawUnsafe(`
            INSERT INTO certificates (id, team_id, member_id, recipient_name, recipient_email, team_name, college, certificate_type, issued_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'participation', NOW())
            ON CONFLICT (member_id) DO UPDATE SET
              recipient_name = EXCLUDED.recipient_name,
              recipient_email = EXCLUDED.recipient_email,
              team_name = EXCLUDED.team_name,
              college = EXCLUDED.college
          `, certId, reg.teamId || 'TEAM', m.id, m.fullName, m.email, reg.teamName, m.college || 'Mirai School of Technology');

          createdCount++;
        }
      }

      return json(response, 200, {
        ok: true,
        message: `Successfully synchronized ${createdCount} participation certificates!`,
        count: createdCount,
      });
    } catch (err) {
      console.error('Certificates POST error:', err);
      return json(response, 500, { error: err.message || 'Failed to issue certificates.' });
    }
  }

  return methodNotAllowed(response, ['GET', 'POST']);
}

