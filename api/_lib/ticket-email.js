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

function getFromSender() {
  // Use verified sender if provided, or fallback to onboarding@resend.dev during testing
  return process.env.RESEND_FROM || 'onboarding@resend.dev';
}

function ticketCopy(registration, isResend = false) {
  const leader = registration.members.find((member) => member.position === 1) || registration.members[0];
  const members = registration.members.map((member, index) => `${index === 0 ? 'Leader: ' : ''}${member.fullName} (${member.college})`).join('\n');
  const htmlMembers = registration.members.map((member, index) => `<li>${index === 0 ? '<strong>Leader · </strong>' : ''}${escapeHtml(member.fullName)} <span style="color:#a39e93">(${escapeHtml(member.college)})</span></li>`).join('');

  const prefix = isResend ? '[Resent] ' : '';
  const dateStr = 'Night of 31 October 2026, 7:00 PM – 1 November, 7:00 AM (12 Hours)';
  const venueStr = 'Mirai Floor, Mirai School of Technology, Bengaluru';

  return {
    recipient: leader?.email,
    subject: `${prefix}Your Hack-O-Lantern Ticket · ${registration.ticketId}`,
    text: `Your Hack-O-Lantern entry ticket is confirmed.\n\nTeam: ${registration.teamName}\nOrder Ref: ${registration.orderRef || '—'}\nTicket ID: ${registration.ticketId}\nDate: ${dateStr}\nVenue: ${venueStr}\n\nTeam Members:\n${members}\n\nShow the attached QR code or this Ticket ID at the check-in desk at entry. Keep this email safe.`,
    html: `<!doctype html><html><body style="margin:0;background:#06080a;color:#f7f4eb;font:16px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif"><main style="max-width:620px;margin:0 auto;padding:36px 20px"><div style="border:1px solid rgba(255,122,26,0.35);border-radius:20px;background:#120f0c;padding:32px;box-shadow:0 12px 32px rgba(0,0,0,0.5)"><div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff7a1a"></span><span style="color:#ff9a4d;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">Vulcan Club × Mirai School of Technology</span></div><h1 style="margin:0 0 10px;font:700 32px/1.1 Georgia,serif;color:#f7f4eb">Hack-O-Lantern</h1><p style="margin:0 0 24px;color:#d9d2c8;font-size:15px">Your entry ticket for the 12-hour overnight Halloween hackathon is ready.</p><div style="border-top:1px solid rgba(255,122,26,0.2);border-bottom:1px solid rgba(255,122,26,0.2);padding:20px 0;margin-bottom:24px"><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0;color:#a39e93">Team Name</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(registration.teamName)}</strong></td></tr><tr><td style="padding:6px 0;color:#a39e93">Order Reference</td><td style="padding:6px 0;text-align:right"><code style="color:#ff7a1a;font-family:monospace">${escapeHtml(registration.orderRef || '—')}</code></td></tr><tr><td style="padding:6px 0;color:#a39e93">Ticket ID</td><td style="padding:6px 0;text-align:right"><code style="color:#7cff4f;font-weight:700;font-size:16px;font-family:monospace">${escapeHtml(registration.ticketId)}</code></td></tr><tr><td style="padding:6px 0;color:#a39e93">Date & Time</td><td style="padding:6px 0;text-align:right;color:#f7f4eb">${escapeHtml(dateStr)}</td></tr><tr><td style="padding:6px 0;color:#a39e93">Venue</td><td style="padding:6px 0;text-align:right;color:#f7f4eb">${escapeHtml(venueStr)}</td></tr></table></div><h3 style="margin:0 0 12px;font-size:16px;color:#ff9a4d">Admit Team of 3</h3><ul style="margin:0 0 24px;padding-left:20px;line-height:1.7;color:#f7f4eb">${htmlMembers}</ul><div style="background:rgba(0,0,0,0.4);border-radius:12px;padding:16px;border:1px dashed rgba(255,122,26,0.3);text-align:center"><p style="margin:0;font-size:14px;color:#d9d2c8">Show the attached QR code or this Ticket ID at the entrance.<br><span style="color:#a39e93;font-size:12px">Do not share this ticket outside your team.</span></p></div></div></main></body></html>`,
  };
}

export async function sendTicketEmail(registration, { isResend = false } = {}) {
  const configuration = configurationError();
  if (configuration) return { sent: false, error: configuration };
  if (!registration.ticketId || registration.paymentStatus !== 'PAID') {
    return { sent: false, error: 'A paid ticket is required before sending email.' };
  }

  const copy = ticketCopy(registration, isResend);
  if (!copy.recipient) return { sent: false, error: 'The team leader does not have an email address.' };

  const qr = await QRCode.toDataURL(registration.ticketToken || registration.ticketId, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 720,
    color: { dark: '#111111', light: '#FFFFFF' },
  });

  const payload = {
    from: getFromSender(),
    to: [copy.recipient],
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
    attachments: [{ filename: `${registration.ticketId}-qr.png`, content: qr.split(',')[1] }],
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send(payload, {
      idempotencyKey: isResend
        ? `hack-o-lantern-ticket-resend/${registration.ticketId}/${Date.now()}`
        : `hack-o-lantern-ticket/${registration.ticketId}`,
    });

    if (error) {
      console.warn('Resend send returned error:', error);
      return { sent: false, error: String(error.message || 'Resend error.').slice(0, 500) };
    }
    return { sent: true, emailId: String(data?.id || '') };
  } catch (err) {
    console.error('Resend exception:', err);
    return { sent: false, error: String(err.message || 'Network error').slice(0, 500) };
  }
}

export async function sendAndRecordTicketEmail(registration, { isResend = false } = {}) {
  const result = await sendTicketEmail(registration, { isResend });
  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      emailStatus: result.sent ? 'sent' : 'failed',
      emailSentCount: { increment: result.sent ? 1 : 0 },
      ticketEmailSentAt: result.sent ? new Date() : undefined,
      ticketEmailError: result.sent ? null : result.error,
      ticketEmailId: result.sent ? result.emailId : undefined,
    },
  });
  return result;
}

export async function sendRejectionEmail(registration, rejectReason) {
  const configuration = configurationError();
  if (configuration) return { sent: false, error: configuration };

  const leader = registration.members?.find((m) => m.position === 1) || registration.members?.[0];
  if (!leader?.email) return { sent: false, error: 'Team leader email missing.' };

  const orderRef = registration.orderRef || 'your order';
  const reasonText = rejectReason ? `Organiser note: ${rejectReason}` : 'The transaction reference could not be verified.';
  const siteUrl = process.env.SITE_URL || 'https://vulcan-club.vercel.app';
  const resubmitUrl = `${siteUrl}/halloween-hack`;

  const payload = {
    from: getFromSender(),
    to: [leader.email],
    subject: `Action Required: Hack-O-Lantern payment status · ${orderRef}`,
    text: `Hello ${leader.fullName},\n\nWe were unable to verify the UPI payment for team "${registration.teamName}" (Order: ${orderRef}).\n\n${reasonText}\n\nPlease visit ${resubmitUrl} and click "Already registered? Check status" to enter your order reference (${orderRef}) and submit your 12-digit UTR and receipt.\n\n— Vulcan Club Organisers`,
    html: `<!doctype html><html><body style="margin:0;background:#06080a;color:#f7f4eb;font:16px/1.55 sans-serif"><main style="max-width:580px;margin:0 auto;padding:32px 18px"><div style="border:1px solid #ff5555;border-radius:18px;background:#140e0c;padding:28px"><h2 style="margin:0 0 12px;color:#ff8888">Action Required: Payment Verification</h2><p style="color:#d9d2c8">Hello ${escapeHtml(leader.fullName)},</p><p style="color:#d9d2c8">We were unable to verify the UPI payment for team <strong>${escapeHtml(registration.teamName)}</strong> (Order: <code>${escapeHtml(orderRef)}</code>).</p><div style="padding:14px;background:rgba(255,85,85,0.12);border-left:3px solid #ff5555;border-radius:4px;margin:18px 0;color:#ffb4b4"><strong>Reason:</strong> ${escapeHtml(rejectReason || 'Transaction ID not found in bank records.')}</div><p style="color:#d9d2c8">Please re-verify your 12-digit UPI reference (UTR) from your payment app and submit it again.</p><p style="margin:24px 0"><a href="${resubmitUrl}" style="display:inline-block;padding:12px 24px;background:#ff7a1a;color:#000;font-weight:700;text-decoration:none;border-radius:8px">Resubmit payment details ↗</a></p><p style="font-size:13px;color:#858076;margin-top:24px">Order reference: <code>${escapeHtml(orderRef)}</code></p></div></main></body></html>`,
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send(payload, {
      idempotencyKey: `hack-o-lantern-rejection/${registration.id}/${Date.now()}`,
    });
    if (error) {
      console.warn('Rejection email error:', error);
      return { sent: false, error: String(error.message || 'Resend error') };
    }
    return { sent: true, emailId: String(data?.id || '') };
  } catch (err) {
    console.error('Rejection email exception:', err);
    return { sent: false, error: String(err.message || 'Network error') };
  }
}
