import QRCode from 'qrcode';
import { Resend } from 'resend';
import { prisma } from './prisma.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function configurationError() {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY is not configured.';
  if (!process.env.RESEND_FROM) return 'RESEND_FROM is not configured.';
  return '';
}

function ticketCopy(registration) {
  const leader = registration.members.find((member) => member.position === 1) || registration.members[0];
  const members = registration.members.map((member, index) => `${index === 0 ? 'Leader: ' : ''}${member.fullName}`).join('\n');
  const htmlMembers = registration.members.map((member, index) => `<li>${index === 0 ? '<strong>Leader · </strong>' : ''}${escapeHtml(member.fullName)}</li>`).join('');
  return {
    recipient: leader?.email,
    subject: `Your Hack-O-Lantern ticket · ${registration.ticketId}`,
    text: `Your Hack-O-Lantern ticket is ready.\n\nTeam: ${registration.teamName}\nTicket ID: ${registration.ticketId}\nDate: 30 October 2026, 7:00 PM to 31 October, 8:00 AM\nVenue: Mirai Floor, Mirai School of Technology\n\n${members}\n\nShow the attached QR code or this ticket ID at the entrance. Keep this email private.`,
    html: `<!doctype html><html><body style="margin:0;background:#0b0b0b;color:#f6efe4;font:16px/1.55 Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #ff7a1a;border-radius:18px;background:#15120f;padding:30px"><p style="margin:0 0 8px;color:#ff9a4d;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Vulcan Club presents</p><h1 style="margin:0 0 12px;font:700 34px/1.05 Georgia,serif">Hack-O-Lantern</h1><p style="margin:0 0 24px;color:#d9d2c8">Your entry ticket is ready.</p><div style="border-top:1px solid #4a3523;border-bottom:1px solid #4a3523;padding:18px 0"><p style="margin:0 0 8px"><strong>Team</strong><br>${escapeHtml(registration.teamName)}</p><p style="margin:0 0 8px"><strong>Ticket ID</strong><br><code style="color:#7cff4f;font-size:18px">${escapeHtml(registration.ticketId)}</code></p><p style="margin:0"><strong>When and where</strong><br>30 October 2026, 7:00 PM – 31 October, 8:00 AM<br>Mirai Floor, Mirai School of Technology</p></div><h2 style="margin:24px 0 8px;font-size:17px">Admit team of 3</h2><ul style="margin:0;padding-left:20px">${htmlMembers}</ul><p style="margin:24px 0 0;color:#d9d2c8">Show the attached QR code or this ticket ID at the entrance. Keep this email private.</p></div></main></body></html>`,
  };
}

export async function sendTicketEmail(registration) {
  const configuration = configurationError();
  if (configuration) return { sent: false, error: configuration };
  if (!registration.ticketId || registration.paymentStatus !== 'PAID') return { sent: false, error: 'A paid ticket is required before sending email.' };

  const copy = ticketCopy(registration);
  if (!copy.recipient) return { sent: false, error: 'The team leader does not have an email address.' };
  const qr = await QRCode.toDataURL(registration.ticketId, { errorCorrectionLevel: 'M', margin: 4, width: 720, color: { dark: '#111111', light: '#FFFFFF' } });
  const payload = {
    from: process.env.RESEND_FROM,
    to: [copy.recipient],
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
    attachments: [{ filename: `${registration.ticketId}-qr.png`, content: qr.split(',')[1] }],
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(payload, { idempotencyKey: `hack-o-lantern-ticket/${registration.ticketId}` });
  if (error) return { sent: false, error: String(error.message || 'Resend rejected the email.').slice(0, 500) };
  return { sent: true, emailId: String(data?.id || '') };
}

export async function sendAndRecordTicketEmail(registration) {
  const result = await sendTicketEmail(registration);
  await prisma.registration.update({
    where: { id: registration.id },
    data: result.sent
      ? { ticketEmailSentAt: new Date(), ticketEmailError: null, ticketEmailId: result.emailId || null }
      : { ticketEmailError: result.error, ticketEmailId: null },
  });
  return result;
}
