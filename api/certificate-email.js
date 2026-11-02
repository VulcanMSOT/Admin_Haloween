import { Resend } from 'resend';
import { handleCors, json, methodNotAllowed, parseBody } from './_lib/http.js';
import { prisma } from './_lib/prisma.js';
import { requireSession } from './_lib/session.js';
import { generateCertificateId, generateCertificateSvg, generateCertificatePng, buildCertificateEmailHtml } from './_lib/certificate-generator.js';

function getSender() {
  return process.env.RESEND_FROM || 'onboarding@resend.dev';
}

function getSiteUrl() {
  return process.env.SITE_URL || process.env.VITE_PUBLIC_SITE_URL || 'https://www.vulcanclub.in';
}

export default async function handler(request, response) {
  if (handleCors(request, response, ['POST', 'OPTIONS'])) return;
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

  const session = requireSession(request, response);
  if (!session) return;

  const body = parseBody(request);
  const action = body.action || 'send_single'; // 'send_single' | 'send_team' | 'send_all' | 'test_preview' | 'mark_sent' | 'mark_team_sent'

  // 1. Mark as sent via Gmail
  if (action === 'mark_sent') {
    const { memberId, certId } = body;
    if (!memberId) {
      return json(response, 400, { error: 'memberId is required.' });
    }

    try {
      const member = await prisma.teamMember.findUnique({
        where: { id: memberId },
        include: { registration: true },
      });

      if (!member) {
        return json(response, 404, { error: 'Participant not found.' });
      }

      const reg = member.registration || {};
      const effectiveCertId = certId || generateCertificateId(reg.teamId, member.position);

      await prisma.$executeRawUnsafe(`
        INSERT INTO certificates (id, team_id, member_id, recipient_name, recipient_email, team_name, college, certificate_type, issued_at, email_status, email_sent_at, email_id, email_error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'participation', NOW(), 'sent', NOW(), 'gmail-manual', NULL)
        ON CONFLICT (member_id) DO UPDATE SET
          id = EXCLUDED.id,
          email_status = 'sent',
          email_sent_at = NOW(),
          email_id = 'gmail-manual',
          email_error = NULL
      `, effectiveCertId, reg.teamId || 'TEAM', member.id, member.fullName, member.email, reg.teamName, member.college || 'Mirai School of Technology');

      return json(response, 200, {
        ok: true,
        message: `Marked certificate ${effectiveCertId} as sent via Gmail!`,
        certId: effectiveCertId,
      });
    } catch (err) {
      console.error('Mark sent error:', err);
      return json(response, 500, { error: err.message || 'Failed to mark certificate as sent.' });
    }
  }

  // 2. Mark all members of a team as sent via Gmail
  if (action === 'mark_team_sent') {
    const { teamId } = body;
    if (!teamId) {
      return json(response, 400, { error: 'teamId is required.' });
    }

    try {
      const registration = await prisma.registration.findFirst({
        where: { teamId },
        include: { members: true },
      });

      if (!registration) {
        return json(response, 404, { error: `Team ${teamId} not found.` });
      }

      for (const m of registration.members) {
        const certId = generateCertificateId(registration.teamId, m.position);
        await prisma.$executeRawUnsafe(`
          INSERT INTO certificates (id, team_id, member_id, recipient_name, recipient_email, team_name, college, certificate_type, issued_at, email_status, email_sent_at, email_id, email_error)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'participation', NOW(), 'sent', NOW(), 'gmail-manual', NULL)
          ON CONFLICT (member_id) DO UPDATE SET
            id = EXCLUDED.id,
            email_status = 'sent',
            email_sent_at = NOW(),
            email_id = 'gmail-manual',
            email_error = NULL
        `, certId, registration.teamId || 'TEAM', m.id, m.fullName, m.email, registration.teamName, m.college || 'Mirai School of Technology');
      }

      return json(response, 200, {
        ok: true,
        message: `Marked Team ${registration.teamName} (${teamId}) certificates as sent via Gmail!`,
      });
    } catch (err) {
      return json(response, 500, { error: err.message || 'Failed to mark team certificates as sent.' });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return json(response, 200, {
      ok: true,
      mode: 'gmail',
      message: 'RESEND_API_KEY is not configured on the server. Certificates are dispatched via Gmail.',
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const siteUrl = getSiteUrl();

  // Helper function to send one participant's certificate
  async function sendOneParticipant(member, registration, targetEmail = null) {
    const recipientEmail = targetEmail || member.email;
    if (!recipientEmail) {
      throw new Error(`No email address available for ${member.fullName}`);
    }

    const certId = generateCertificateId(registration.teamId, member.position);
    const downloadUrl = `${siteUrl}/api/certificate-render?certId=${encodeURIComponent(certId)}&memberId=${encodeURIComponent(member.id)}`;

    // 1. Generate High-Res PNG & SVG certificate
    const certOptions = {
      certificateId: certId,
      participantName: member.fullName,
      collegeName: member.college,
      teamName: registration.teamName,
      teamId: registration.teamId,
      trackName: 'Open Innovation & Systems',
      issueDate: 'November 1, 2026',
    };

    const pngBuffer = await generateCertificatePng(certOptions, 2240);

    // 2. Build HTML email
    const htmlEmail = buildCertificateEmailHtml({
      participantName: member.fullName,
      teamName: registration.teamName,
      teamId: registration.teamId,
      certificateId: certId,
      downloadUrl,
    });

    const emailSubject = `🎓 Your Official Hack-O-Lantern 2026 Certificate · ${certId}`;

    // 3. Send email via Resend with high-res PNG attachment
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: [recipientEmail],
      subject: emailSubject,
      html: htmlEmail,
      text: `Congratulations ${member.fullName}!\n\nHere is your official Certificate of Participation for Hack-O-Lantern 2026 (Team: ${registration.teamName}, Team ID: ${registration.teamId}).\n\nCertificate ID: ${certId}\n\nYour high-resolution certificate image (PNG) is attached.\n\nView and verify your certificate online:\n${downloadUrl}\n\nVulcan Club × Mirai School of Technology`,
      attachments: [
        {
          filename: `${certId}.png`,
          content: pngBuffer.toString('base64'),
          contentType: 'image/png',
        },
      ],
      ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
    });

    if (error) {
      throw new Error(error.message || 'Resend error while dispatching certificate email.');
    }

    // 4. Record in certificates table (if not a test email override)
    if (!targetEmail) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO certificates (id, team_id, member_id, recipient_name, recipient_email, team_name, college, certificate_type, issued_at, email_status, email_sent_at, email_id, email_error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'participation', NOW(), 'sent', NOW(), $8, NULL)
        ON CONFLICT (member_id) DO UPDATE SET
          id = EXCLUDED.id,
          email_status = 'sent',
          email_sent_at = NOW(),
          email_id = EXCLUDED.email_id,
          email_error = NULL
      `, certId, registration.teamId || 'TEAM', member.id, member.fullName, member.email, registration.teamName, member.college, String(data?.id || ''));
    }

    return { sent: true, emailId: data?.id, certId, recipientEmail };
  }

  // 1. Single Participant Email
  if (action === 'send_single') {
    const { memberId, targetEmail } = body;
    if (!memberId) {
      return json(response, 400, { error: 'memberId is required.' });
    }

    try {
      const member = await prisma.teamMember.findUnique({
        where: { id: memberId },
        include: { registration: true },
      });

      if (!member) {
        return json(response, 404, { error: 'Participant not found.' });
      }

      const res = await sendOneParticipant(member, member.registration, targetEmail);
      return json(response, 200, {
        ok: true,
        message: `Certificate successfully sent to ${targetEmail || member.email}!`,
        result: res,
      });
    } catch (err) {
      console.error('Send single certificate error:', err);
      // Record failure if memberId exists
      if (body.memberId && !targetEmail) {
        await prisma.$executeRawUnsafe(`
          UPDATE certificates SET email_status = 'failed', email_error = $1 WHERE member_id = $2
        `, err.message, body.memberId).catch(() => {});
      }
      return json(response, 500, { error: err.message || 'Failed to send certificate.' });
    }
  }

  // 2. Team Email (All members of a team)
  if (action === 'send_team') {
    const { teamId } = body;
    if (!teamId) {
      return json(response, 400, { error: 'teamId is required.' });
    }

    try {
      const registration = await prisma.registration.findFirst({
        where: { teamId },
        include: { members: true },
      });

      if (!registration) {
        return json(response, 404, { error: `Team ${teamId} not found.` });
      }

      const results = [];
      const errors = [];

      for (const m of registration.members) {
        try {
          const res = await sendOneParticipant(m, registration);
          results.push(res);
        } catch (err) {
          errors.push({ member: m.fullName, email: m.email, error: err.message });
        }
      }

      return json(response, 200, {
        ok: true,
        message: `Sent certificates to ${results.length} members of Team ${registration.teamName} (${teamId}).`,
        sentCount: results.length,
        errors,
      });
    } catch (err) {
      return json(response, 500, { error: err.message || 'Failed to send team certificates.' });
    }
  }

  // 3. Batch Send All Certificates
  if (action === 'send_all') {
    const { onlyPending = true, onlyAdmitted = false } = body;

    try {
      const registrations = await prisma.registration.findMany({
        where: {
          paymentStatus: 'PAID',
          ...(onlyAdmitted ? { checkedInAt: { not: null } } : {}),
        },
        include: { members: true },
      });

      // Get already sent certificates
      const sentCerts = await prisma.$queryRawUnsafe(`
        SELECT member_id FROM certificates WHERE email_status = 'sent'
      `);
      const sentSet = new Set(sentCerts.map((c) => c.member_id));

      const queue = [];
      for (const reg of registrations) {
        for (const m of reg.members) {
          if (onlyPending && sentSet.has(m.id)) {
            continue; // Skip already sent
          }
          queue.push({ member: m, registration: reg });
        }
      }

      if (queue.length === 0) {
        return json(response, 200, {
          ok: true,
          message: 'All eligible participants have already received their certificates!',
          sentCount: 0,
        });
      }

      const results = [];
      const errors = [];

      // Process in controlled batches to avoid rate limits
      for (const item of queue) {
        try {
          const res = await sendOneParticipant(item.member, item.registration);
          results.push(res);
          // 250ms spacing between emails
          await new Promise((resolve) => setTimeout(resolve, 250));
        } catch (err) {
          errors.push({ member: item.member.fullName, email: item.member.email, error: err.message });
        }
      }

      return json(response, 200, {
        ok: true,
        message: `Batch complete: ${results.length} certificates dispatched! ${errors.length > 0 ? `(${errors.length} errors)` : ''}`,
        sentCount: results.length,
        errorCount: errors.length,
        errors,
      });
    } catch (err) {
      return json(response, 500, { error: err.message || 'Failed in batch certificate delivery.' });
    }
  }

  // 4. Test Preview Email (Send sample certificate to admin's own email)
  if (action === 'test_preview') {
    const { testEmail } = body;
    const recipient = testEmail || session.email;
    if (!recipient) {
      return json(response, 400, { error: 'Test recipient email is required.' });
    }

    try {
      // Pick first member as sample
      const sampleMember = await prisma.teamMember.findFirst({
        include: { registration: true },
      });

      if (!sampleMember) {
        return json(response, 404, { error: 'No participants available for test preview.' });
      }

      const res = await sendOneParticipant(sampleMember, sampleMember.registration, recipient);
      return json(response, 200, {
        ok: true,
        message: `Sample preview certificate successfully emailed to ${recipient}!`,
        result: res,
      });
    } catch (err) {
      return json(response, 500, { error: err.message || 'Failed to send test preview email.' });
    }
  }

  return json(response, 400, { error: `Unknown action: ${action}` });
}

