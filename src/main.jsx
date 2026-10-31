import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './styles.css';

const statusLabels = {
  PENDING_PAYMENT: 'Awaiting payment',
  PENDING_REVIEW: 'Review payment',
  PAID: 'Ticket confirmed',
  REJECTED: 'Payment rejected',
  EXPIRED: 'Expired',
};

const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.vulcanclub.in';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function api(path, options = {}) {
  return fetch(`/api/${path}`, options).then(async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : {};
    if (!isJson && !response.ok) throw new Error('API route returned non-JSON response.');
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  });
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">V</span>
      <span>vulcan <b>operations</b></span>
    </div>
  );
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// Helper to build standardized Event Reminder & Rules Email
// -------------------------------------------------------------
function buildReminderEmail(registration) {
  const leader = registration?.members?.find((m) => m.position === 1) || registration?.members?.[0] || {};
  const recipient = leader.email || '';
  const teamId = registration?.teamId || registration?.orderRef || 'VHK-TEAM';
  const teamName = registration?.teamName || 'Your Team';
  const ticketId = registration?.ticketId || teamId;
  const ticketLookupUrl = 'https://www.vulcanclub.in/halloween-hack';

  const membersListText = (registration?.members || [])
    .map((m, idx) => `  ${idx + 1}. ${m.fullName} (${m.college || 'Participant'})`)
    .join('\n');

  const subject = `HACK-O-LANTERN — PARTICIPANT RULES & TIMINGS · Team ${teamId} (${teamName})`;
  const body = `Hi ${leader.fullName || 'Team Leader'},

*HACK-O-LANTERN — PARTICIPANT RULES & TIMINGS*

Please read and follow the following rules carefully:

*1. Stay Within the Mirai Floor*
Participants are required to remain within the designated *Mirai floor/event area* throughout the hackathon. Leaving the designated floor will not be permitted.

*2. Entry Only With Valid Tickets*
Entry will be permitted *only with a valid event ticket*. Each team must ensure that all members have their tickets ready for verification.

Your Team Credentials:
• Team ID: ${teamId}
• Team Name: ${teamName}
• Official Ticket ID: ${ticketId}
${membersListText ? `• Registered Members:\n${membersListText}\n` : ''}
Tickets can be downloaded from:
*https://www.vulcanclub.in/halloween-hack*
(On the page, click "Already registered? Check status", enter your Team ID ${teamId} and this email address ${recipient}, and download your ticket pass).

*3. Event Timings*
*Entry:* 31st October, *7:00 PM*
*Event Ends:* 1st November, *11:00 AM*

*4. Contact*
For any queries or assistance, contact:
*9907004089*
*+91 70133 26831*

Please arrive on time and keep your ticket ready at the entry checkpoint.

*Strict adherence to these rules is mandatory for all participants.*

Best regards,
Vulcan Club Organizing Team
https://www.vulcanclub.in/halloween-hack`;

  return { recipient, subject, body, ticketLookupUrl, teamId, teamName, ticketId, leader };
}

// -------------------------------------------------------------
// Manual Email Modal Component (Section 5)
// -------------------------------------------------------------
function ManualEmailModal({ registration, initialType = 'confirmed', onClose, onActionComplete }) {
  const [templateType, setTemplateType] = useState(initialType);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markedSent, setMarkedSent] = useState(registration.emailStatus === 'sent');
  const [error, setError] = useState('');

  const leader = registration.members?.find((m) => m.position === 1) || registration.members?.[0] || {};
  const recipient = leader.email || '';
  const teamId = registration.teamId || registration.orderRef || 'VHK-TEAM';
  const paymentRef = registration.paymentRef || 'PAY-REF';
  const teamName = registration.teamName || 'Your Team';
  const ticketId = registration.ticketId || teamId;
  const rejectReason = registration.rejectReason || 'UTR transaction could not be located in club statement.';

  const ticketLookupUrl = `${PUBLIC_SITE_URL}/halloween-hack`;

  let subject = '';
  let body = '';

  if (templateType === 'reminder_event') {
    const reminderData = buildReminderEmail(registration);
    subject = reminderData.subject;
    body = reminderData.body;
  } else if (templateType === 'confirmed') {
    subject = `Hack-O-Lantern Ticket Confirmed · Team ${teamId}`;
    body = `Hi ${leader.fullName || 'Team Leader'},

Great news! Your payment for Hack-O-Lantern (12-Hour Overnight Hackathon) has been verified and confirmed.

Team Name: ${teamName}
Team ID: ${teamId}
Payment Reference: ${paymentRef}
Official Ticket ID: ${ticketId}

Event Schedule: Night of 31 October 2026, 7:00 PM – 1 November 2026, 11:00 AM (16 Hours)
Venue: Mirai Floor, Bengaluru

View and download your official entry pass & ticket QR code here:
${ticketLookupUrl}

(On the page, click "Already registered? Check status" and enter your Team ID ${teamId} and this email address).

Show your ticket QR code at the entrance check-in desk for admission. Keep this email handy!

Your team's referral codes are on your status page.

Best regards,
Vulcan Club Organizing Team
Official Site: https://www.vulcanclub.in/halloween-hack
Sender: nexcell_rathinam@msot.org`;
  } else if (templateType === 'rejected') {
    subject = `Action Required: Hack-O-Lantern Payment Update · Team ${teamId}`;
    body = `Hi ${leader.fullName || 'Team Leader'},

We reviewed the UPI reference submitted for your team "${teamName}" (${teamId}), but our organizers were unable to verify the transfer in our bank logs.

Reason:
${rejectReason}

What to do next:
Please double-check your UPI transaction receipt from your payment app, and resubmit your 12-digit UTR reference here:
${ticketLookupUrl}

(Your Team ID ${teamId} and Payment Reference ${paymentRef} remain unchanged. No need to register a new team).

If you have already transferred the ₹${registration.amount || 300}, please upload a clear screenshot of the completed transfer so we can approve it promptly.

Best regards,
Vulcan Club Organizing Team
Official Site: https://www.vulcanclub.in/halloween-hack
Sender: nexcell_rathinam@msot.org`;
  } else {
    subject = `Reminder: Complete your Hack-O-Lantern Registration · Team ${teamId}`;
    body = `Hi ${leader.fullName || 'Team Leader'},

This is a reminder from Vulcan Club regarding your team "${teamName}" (${teamId}).

Your registration is currently awaiting UPI payment (₹${registration.amount || 300} for team of 3).
To confirm your slots before capacity fills, please open the event portal and enter your 12-digit UTR reference:
${ticketLookupUrl}

Team ID: ${teamId}
Payment Reference: ${paymentRef}

Best regards,
Vulcan Club Organizing Team
Official Site: https://www.vulcanclub.in/halloween-hack
Sender: nexcell_rathinam@msot.org`;
  }

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyMessage = () => {
    const textToCopy = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard?.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMarkAsSent = async () => {
    setBusy(true);
    setError('');
    try {
      if (templateType === 'reminder_event') {
        await api('mark-reminder-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId: registration.id, status: 'sent' }),
        });
      } else {
        await api('mark-email-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId: registration.id }),
        });
      }
      setMarkedSent(true);
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content email-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h3>Send Email via Gmail</h3>
            <p style={{ fontSize: '13px', color: '#b4b4b4', margin: 0 }}>
              Sender: <strong>nexcell_rathinam@msot.org</strong> · Team: <code>{teamId}</code> ({teamName})
            </p>
          </div>
          <button className="quiet" onClick={onClose} style={{ minHeight: '28px', padding: '0 8px' }}>✕</button>
        </div>

        <div className="email-template-tabs">
          <button
            type="button"
            className={`email-tab-btn ${templateType === 'reminder_event' ? 'is-active' : ''}`}
            onClick={() => setTemplateType('reminder_event')}
          >
            📢 Reminder & Rules
          </button>
          <button
            type="button"
            className={`email-tab-btn ${templateType === 'confirmed' ? 'is-active' : ''}`}
            onClick={() => setTemplateType('confirmed')}
          >
            Payment Confirmed + Ticket
          </button>
          <button
            type="button"
            className={`email-tab-btn ${templateType === 'rejected' ? 'is-active' : ''}`}
            onClick={() => setTemplateType('rejected')}
          >
            Payment Rejected + Reason
          </button>
          <button
            type="button"
            className={`email-tab-btn ${templateType === 'reminder' ? 'is-active' : ''}`}
            onClick={() => setTemplateType('reminder')}
          >
            Payment Reminder
          </button>
        </div>

        <div className="email-preview-box">
          <div className="email-preview-field">
            <span>To:</span>
            <strong>{recipient || '—'}</strong>
          </div>
          <div className="email-preview-field">
            <span>Subject:</span>
            <strong>{subject}</strong>
          </div>
          <div className="email-body-text">{body}</div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="email-actions-bar">
          <button type="button" className="quiet" onClick={copyMessage}>
            {copied ? '✓ Message Copied!' : 'Copy message'}
          </button>
          <a
            className="btn-gmail"
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ borderRadius: '999px', padding: '0 16px', minHeight: '36px', fontSize: '13px', fontWeight: 600 }}
          >
            Open in Gmail ↗
          </a>
          <a
            className="quiet"
            href={mailtoUrl}
            style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0 12px', fontSize: '12px' }}
          >
            Mail app
          </a>
          <button
            type="button"
            className="btn-sent-mark"
            onClick={handleMarkAsSent}
            disabled={busy || markedSent}
          >
            {markedSent ? '✓ Marked as sent' : busy ? 'Saving…' : 'Mark as sent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Login Component with Allow-list & Passcode
// -------------------------------------------------------------
function Login({ onSignedIn }) {
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, email: email.trim() }),
      });
      onSignedIn();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="login__panel">
        <Logo />
        <h1>Event operations</h1>
        <p>Hack-O-Lantern · Organiser access only</p>
        <form onSubmit={submit}>
          <label htmlFor="admin-email">
            Organiser email (required for audit log)
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. nexcell_rathinam@msot.org"
              autoComplete="username"
              required
            />
          </label>
          <label htmlFor="passcode">
            Organiser passcode
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Verifying access…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// Dashboard Overview Component
// -------------------------------------------------------------
function Dashboard({ stats, referralSummary, onNavigate }) {
  return (
    <div className="dashboard-grid">
      <article className="stat-card stat-card--accent">
        <span className="stat-card__label">Confirmed revenue</span>
        <strong className="stat-card__value">₹{stats.revenue?.toLocaleString('en-IN') || 0}</strong>
        <span className="stat-card__sub">{stats.confirmed || 0} teams confirmed (calculated sum)</span>
        {Boolean(stats.discountsGiven) && (
          <span className="stat-card__sub" style={{ color: '#c6f24e', marginTop: '2px' }}>
            ₹{stats.discountsGiven?.toLocaleString('en-IN')} discounts given ({stats.couponTeamsCount || 0} teams)
          </span>
        )}
      </article>

      <article className="stat-card" onClick={() => onNavigate('referrals')} style={{ cursor: 'pointer', borderColor: 'rgba(198, 242, 78, 0.3)' }}>
        <span className="stat-card__label">Confirmed Referrals</span>
        <strong className="stat-card__value" style={{ color: '#c6f24e' }}>
          {referralSummary?.totalReferrals?.confirmed ?? 0}
        </strong>
        <span className="stat-card__sub">
          {referralSummary?.conversionRate ? `${referralSummary.conversionRate} of confirmed teams from referrals →` : 'Referral leaderboard →'}
        </span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('referrals')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Active Referrers</span>
        <strong className="stat-card__value">{referralSummary?.activeReferrers ?? 0}</strong>
        <span className="stat-card__sub">
          {referralSummary?.clubMembersCount || 0} club · {referralSummary?.miraiStudentsCount || 0} mirai →
        </span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('coupons')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Coupons Redeemed</span>
        <strong className="stat-card__value" style={{ color: '#ff9a4d' }}>{stats.couponTeamsCount || 0}</strong>
        <span className="stat-card__sub">
          {stats.discountsGiven ? `₹${stats.discountsGiven?.toLocaleString('en-IN')} saved by teams →` : 'Manage coupons →'}
        </span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('payments', 'PENDING_REVIEW')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Awaiting review</span>
        <strong className="stat-card__value stat-card__value--warn">{stats.pendingReview || 0}</strong>
        <span className="stat-card__sub">Pending UTR submissions →</span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('payments', 'PENDING_PAYMENT')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Awaiting payment</span>
        <strong className="stat-card__value">{stats.pendingPayment || 0}</strong>
        <span className="stat-card__sub">Registered but no UTR yet →</span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('tickets')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Tickets issued</span>
        <strong className="stat-card__value stat-card__value--valid">{stats.confirmed || 0}</strong>
        <span className="stat-card__sub">Confirmed team passes →</span>
      </article>

      <article
        className="stat-card"
        onClick={() => onNavigate('tickets', '', 'not_sent')}
        style={{ cursor: 'pointer', borderColor: stats.confirmedEmailNotSent > 0 ? 'rgba(255, 122, 26, 0.4)' : undefined }}
      >
        <span className="stat-card__label">Needs Email Sent</span>
        <strong className="stat-card__value" style={{ color: stats.confirmedEmailNotSent > 0 ? '#ff9a4d' : '#888' }}>
          {stats.confirmedEmailNotSent || 0}
        </strong>
        <span className="stat-card__sub">Confirmed, email not sent →</span>
      </article>

      <article className="stat-card stat-card--accent" onClick={() => onNavigate('admitted')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Gate Attendance / Admitted</span>
        <strong className="stat-card__value" style={{ color: stats.checkedIn > 0 ? '#c6f24e' : '#fff' }}>
          {stats.checkedIn || 0}
        </strong>
        <span className="stat-card__sub">View admitted list ({stats.checkedIn || 0}/{stats.PAID || 0} teams) →</span>
      </article>

      <article className="stat-card">
        <span className="stat-card__label">Total teams registered</span>
        <strong className="stat-card__value">{stats.total || 0}</strong>
        <span className="stat-card__sub">{stats.rejected || 0} rejected registrations</span>
      </article>
    </div>
  );
}

// -------------------------------------------------------------
// Delete Team Confirmation Modal
// -------------------------------------------------------------
function DeleteTeamModal({ team, onClose, onDeleted }) {
  const [reason, setReason] = useState('Duplicate or test registration');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!team) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('delete-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: team.id,
          reason: reason.trim() || 'Deleted by admin',
        }),
      });
      onDeleted(result.message || `Team "${team.teamName}" deleted permanently.`);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not delete team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontSize: '26px' }} role="img" aria-label="warning">⚠️</span>
          <div>
            <h3 style={{ margin: 0, color: '#ff8888', fontSize: '18px' }}>Delete Team Permanently</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>
              Database records & credentials will be destroyed
            </p>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', margin: '0 0 14px' }}>
          Are you sure you want to delete <strong style={{ color: '#fff' }}>{team.teamName}</strong> (<code>{team.teamId || team.orderRef}</code>)?
          This action is <strong style={{ color: '#ff8888' }}>permanent and cannot be undone</strong>.
        </p>

        <div style={{
          background: 'rgba(255, 70, 70, 0.08)',
          border: '1px solid rgba(255, 70, 70, 0.25)',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '12px',
          color: '#ffa0a0',
          marginBottom: '16px',
          lineHeight: '1.45',
        }}>
          <strong>What will happen:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            <li>The registration and all {team.members?.length || 3} member profiles will be wiped.</li>
            <li>Members' emails and phone numbers will be released for fresh registration.</li>
            {team.paymentStatus === 'PAID' && team.couponCode && (
              <li>Coupon <code>{team.couponCode}</code> usage count will be refunded/restored.</li>
            )}
            {team.ticketId && (
              <li>Issued ticket <code>{team.ticketId}</code> will be permanently destroyed.</li>
            )}
          </ul>
        </div>

        <div className="pricing-summary-card" style={{ marginBottom: '16px' }}>
          <div className="summary-line">
            <span>Team:</span>
            <strong style={{ color: '#fff' }}>{team.teamName}</strong>
          </div>
          <div className="summary-line">
            <span>Team ID:</span>
            <code>{team.teamId || team.orderRef}</code>
          </div>
          <div className="summary-line">
            <span>Payment Status:</span>
            <span className={`status status--${team.paymentStatus?.toLowerCase()}`}>
              {statusLabels[team.paymentStatus] || team.paymentStatus}
            </span>
          </div>
          {team.utr && (
            <div className="summary-line">
              <span>UTR:</span>
              <code>{team.utr}</code>
            </div>
          )}
          {team.members && team.members.length > 0 && (
            <div className="summary-line" style={{ display: 'block', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#888' }}>Members:</span>
              {team.members.map((m) => (
                <div key={m.id || m.position} style={{ fontSize: '11px', color: '#bbb', padding: '1px 0' }}>
                  • {m.fullName} ({m.college || '—'}) · {m.email}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="form-error" role="alert" style={{ marginBottom: '12px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="delete-reason" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Reason for deletion (recorded in Audit Log)
            <input
              id="delete-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate test registration, cancelled by student lead"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </label>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="quiet"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={busy}
            >
              {busy ? 'Deleting Team…' : 'Yes, Delete Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Payments Queue Component
// -------------------------------------------------------------
function PaymentQueue({ registrations, onActionComplete, onOpenEmail }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('UTR not found in club bank account statement.');
  const [approvingItem, setApprovingItem] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [amountReceivedInput, setAmountReceivedInput] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [couponCodeSearch, setCouponCodeSearch] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [filterMode, setFilterMode] = useState('review'); // 'review' | 'all' | 'unpaid' | 'not_sent' | 'coupon'

  const startApprove = (registration) => {
    setApprovingItem(registration);
    setAmountReceivedInput(String(registration.amount));
    setApproveNote('');
    setError('');
    setNotice('');
  };

  const handleConfirmApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approvingItem) return;
    setBusyId(approvingItem.id);
    setError('');
    setNotice('');
    try {
      const parsedAmountReceived = Number(amountReceivedInput);
      const result = await api('approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: approvingItem.id,
          amountReceived: parsedAmountReceived,
          note: approveNote,
        }),
      });
      setNotice(result.message || 'Payment confirmed and ticket generated.');
      const itemToEmail = result.registration || approvingItem;
      setApprovingItem(null);
      onActionComplete();
      onOpenEmail(itemToEmail, 'confirmed');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId('');
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingItem) return;
    setBusyId(rejectingItem.id);
    setError('');
    setNotice('');
    try {
      const result = await api('reject-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: rejectingItem.id,
          rejectReason,
        }),
      });
      setNotice(result.message || 'Payment rejected.');
      const itemToEmail = { ...rejectingItem, rejectReason };
      setRejectingItem(null);
      onActionComplete();
      // Prompt admin to send rejection email with reason
      onOpenEmail(itemToEmail, 'rejected');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const filtered = registrations.filter((r) => {
    if (filterMode === 'review' && r.paymentStatus !== 'PENDING_REVIEW') return false;
    if (filterMode === 'unpaid' && r.paymentStatus !== 'PENDING_PAYMENT') return false;
    if (filterMode === 'not_sent' && !(r.paymentStatus === 'PAID' && r.emailStatus !== 'sent')) return false;
    if (filterMode === 'coupon' && !r.couponCode) return false;
    if (couponCodeSearch) {
      const q = couponCodeSearch.toLowerCase();
      const matchCoupon = r.couponCode && r.couponCode.toLowerCase().includes(q);
      const matchTeam = (r.teamName && r.teamName.toLowerCase().includes(q)) || (r.teamId && r.teamId.toLowerCase().includes(q));
      if (!matchCoupon && !matchTeam) return false;
    }
    return true;
  });

  return (
    <section className="queue">
      <div className="section-head">
        <div>
          <h2>Payment Review & Approvals</h2>
          <p>Verify that the 12-digit UTR and amount match club account logs before approving.</p>
        </div>
      </div>

      <div className="filter-chips">
        <button
          type="button"
          className={`chip-btn ${filterMode === 'review' ? 'is-active' : ''}`}
          onClick={() => setFilterMode('review')}
        >
          Awaiting Review (UTR Submitted)
        </button>
        <button
          type="button"
          className={`chip-btn ${filterMode === 'unpaid' ? 'is-active' : ''}`}
          onClick={() => setFilterMode('unpaid')}
        >
          Awaiting Payment (No UTR)
        </button>
        <button
          type="button"
          className={`chip-btn ${filterMode === 'not_sent' ? 'is-active chip-btn--warn' : ''}`}
          onClick={() => setFilterMode('not_sent')}
        >
          Confirmed but Email Not Sent
        </button>
        <button
          type="button"
          className={`chip-btn ${filterMode === 'coupon' ? 'is-active' : ''}`}
          onClick={() => setFilterMode('coupon')}
        >
          Coupons Applied
        </button>
        <button
          type="button"
          className={`chip-btn ${filterMode === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilterMode('all')}
        >
          All Payments ({registrations.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '10px 0 16px' }}>
        <input
          type="text"
          value={couponCodeSearch}
          onChange={(e) => setCouponCodeSearch(e.target.value)}
          placeholder="Filter queue by coupon code or team…"
          style={{ maxWidth: '320px', minHeight: '34px', fontSize: '13px' }}
        />
        {couponCodeSearch && (
          <button type="button" className="quiet" onClick={() => setCouponCodeSearch('')} style={{ minHeight: '34px', fontSize: '12px' }}>
            Clear filter
          </button>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {filtered.length === 0 ? (
        <p className="empty">No registrations found in this view.</p>
      ) : (
        <div className="queue__list">
          {filtered.map((r) => (
            <article className="queue-row" key={r.id}>
              <div className="queue-row__team">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="order-badge">{r.teamId || r.orderRef}</span>
                  {r.paymentRef && (
                    <span style={{ fontSize: '11px', color: '#b4b4b4', fontFamily: 'monospace' }}>
                      {r.paymentRef}
                    </span>
                  )}
                </div>
                <strong>{r.teamName}</strong>
                <span className="members-inline">
                  {r.members.map((m) => `${m.fullName} (${m.college})`).join(' · ')}
                </span>
                {r.referral?.referrer && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#c6f24e', background: 'rgba(198, 242, 78, 0.1)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(198, 242, 78, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Referred by: {r.referral.referrer.name} (<code>{r.referral.referrer.code}</code>)
                    </span>
                  </div>
                )}
                {r.duplicateUtr && (
                  <span className="warn-badge">⚠️ Duplicate UTR submitted on multiple teams!</span>
                )}
                {r.amountReceived !== null && r.amountReceived !== undefined && r.amountReceived !== r.amount && (
                  <span className="warn-badge" style={{ background: 'rgba(255, 70, 70, 0.15)', color: '#ff8888', borderColor: 'rgba(255, 70, 70, 0.3)' }}>
                    ⚠️ Received ₹{r.amountReceived} (Expected ₹{r.amount})
                  </span>
                )}
                {!r.couponCode && r.amount !== 300 && (
                  <span className="warn-badge">⚠️ Non-standard amount: ₹{r.amount} (base ₹300)</span>
                )}
              </div>

              <div className="queue-row__utr">
                <span className="row-label">Payment & UTR</span>
                <code>{r.utr || <span className="muted-text">None submitted</span>}</code>
                <div style={{ marginTop: '6px', fontSize: '13px' }}>
                  {r.couponCode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ textDecoration: 'line-through', color: '#777', fontSize: '12px' }}>₹{r.listPrice || 300}</span>
                      <span className="coupon-badge">🏷️ {r.couponCode} (-₹{r.discountAmount})</span>
                      <strong style={{ color: '#ff9a4d' }}>₹{r.amount}</strong>
                    </div>
                  ) : (
                    <strong>₹{r.amount}</strong>
                  )}
                  {r.amountReceived !== null && r.amountReceived !== undefined && (
                    <span style={{ fontSize: '11px', color: '#c6f24e', display: 'block', marginTop: '2px' }}>
                      Received: ₹{r.amountReceived}
                    </span>
                  )}
                </div>
                <span className="amount-label">Status: {statusLabels[r.paymentStatus]}</span>
              </div>

              <div className="queue-row__proof">
                <span className="row-label">Screenshot</span>
                {r.screenshotSignedUrl ? (
                  <button
                    type="button"
                    className="proof-thumb-btn"
                    onClick={() => setLightboxUrl(r.screenshotSignedUrl)}
                  >
                    <img src={r.screenshotSignedUrl} alt="Receipt proof" />
                    <span>View proof</span>
                  </button>
                ) : (
                  <span className="no-proof">None attached</span>
                )}
              </div>

              <div className="queue-row__time">
                <span className="row-label">Email Status</span>
                <span className={`email-badge email-badge--${r.emailStatus === 'sent' ? 'sent' : 'pending'}`}>
                  {r.emailStatus === 'sent' ? '✓ Sent' : 'Not sent'}
                </span>
                <span className="muted-text" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>
                  {formatDate(r.paymentSubmittedAt || r.createdAt)}
                </span>
              </div>

              <div className="queue-row__actions">
                {r.paymentStatus !== 'PAID' && (
                  <button
                    className="btn-approve"
                    onClick={() => startApprove(r)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? 'Approving…' : 'Confirm & Issue'}
                  </button>
                )}
                {r.paymentStatus !== 'REJECTED' && (
                  <button
                    className="btn-reject"
                    onClick={() => setRejectingItem(r)}
                    disabled={busyId === r.id}
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  className="table-action"
                  onClick={() => onOpenEmail(r, r.paymentStatus === 'PAID' ? 'confirmed' : 'reminder')}
                >
                  ✉ Send email
                </button>
                <button
                  type="button"
                  className="table-action table-action--danger"
                  onClick={() => setDeletingTeam(r)}
                  disabled={busyId === r.id}
                  title={`Delete team ${r.teamName}`}
                >
                  🗑 Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Confirm Payment Approval Modal */}
      {approvingItem && (
        <div className="modal-backdrop" onClick={() => setApprovingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Payment for {approvingItem.teamName}</h3>
            <p style={{ fontSize: '13px', color: '#b4b4b4', marginBottom: '16px' }}>
              Verify that the transfer is visible in the club account statement before approving.
            </p>

            <div className="pricing-summary-card">
              <div className="summary-line">
                <span>Team ID:</span>
                <code>{approvingItem.teamId || approvingItem.orderRef}</code>
              </div>
              <div className="summary-line">
                <span>UTR Reference:</span>
                <code>{approvingItem.utr || 'None submitted'}</code>
              </div>
              <div className="summary-line">
                <span>List Price:</span>
                <span>₹{approvingItem.listPrice ?? 300}</span>
              </div>
              {approvingItem.couponCode && (
                <div className="summary-line" style={{ color: '#ff9a4d' }}>
                  <span>Coupon Applied:</span>
                  <span><code>{approvingItem.couponCode}</code> (-₹{approvingItem.discountAmount})</span>
                </div>
              )}
              <div className="summary-line summary-line--total">
                <strong>Expected Amount:</strong>
                <strong style={{ color: '#c6f24e', fontSize: '16px' }}>₹{approvingItem.amount}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmApproveSubmit} style={{ marginTop: '16px' }}>
              <label htmlFor="amount-received">
                Amount received in bank account (INR) *
                <input
                  id="amount-received"
                  type="number"
                  min="0"
                  step="1"
                  value={amountReceivedInput}
                  onChange={(e) => setAmountReceivedInput(e.target.value)}
                  required
                />
              </label>

              {Number(amountReceivedInput) !== approvingItem.amount && (
                <div className="diff-alert" role="alert">
                  ⚠️ <strong>Amount Discrepancy:</strong> Amount received (₹{amountReceivedInput}) does not match expected amount (₹{approvingItem.amount}). This difference will be recorded on the team's record and in the audit log.
                </div>
              )}

              <label htmlFor="approve-note">
                Organiser note (optional)
                <textarea
                  id="approve-note"
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="e.g. Verified in ICICI bank statement at 14:32"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setApprovingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-approve" disabled={Boolean(busyId)}>
                  {busyId ? 'Confirming…' : 'Confirm & Issue Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="modal-backdrop" onClick={() => setRejectingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject payment for {rejectingItem.teamName}</h3>
            <p style={{ fontSize: '13px', color: '#b4b4b4' }}>
              The Team ID ({rejectingItem.teamId || rejectingItem.orderRef}) and Payment Ref will remain unchanged so the attendee can resubmit their payment reference.
            </p>
            <form onSubmit={handleRejectSubmit}>
              <label htmlFor="reject-reason">
                Rejection reason (required)
                <textarea
                  id="reject-reason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. UTR reference not found in bank statement."
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setRejectingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-reject" disabled={Boolean(busyId)}>
                  {busyId ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox */}
      {lightboxUrl && (
        <div className="modal-backdrop" onClick={() => setLightboxUrl('')}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Payment receipt proof" />
            <button className="quiet close-lightbox" onClick={() => setLightboxUrl('')}>Close</button>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {deletingTeam && (
        <DeleteTeamModal
          team={deletingTeam}
          onClose={() => setDeletingTeam(null)}
          onDeleted={(msg) => {
            setNotice(msg);
            onActionComplete();
          }}
        />
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Tickets View Component
// -------------------------------------------------------------
function TicketsList({ registrations, onActionComplete, onOpenEmail }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revokingItem, setRevokingItem] = useState(null);
  const [revokeReason, setRevokeReason] = useState('Payment reversed or attendee cancelled.');
  const [compTeamId, setCompTeamId] = useState('');
  const [compReason, setCompReason] = useState('Organiser invite / sponsor pass');
  const [showCompModal, setShowCompModal] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [filterEmailNotSent, setFilterEmailNotSent] = useState(false);

  const issued = registrations.filter((r) => r.paymentStatus === 'PAID');
  const displayed = filterEmailNotSent
    ? issued.filter((r) => r.emailStatus !== 'sent')
    : issued;

  const handleRevoke = async (e) => {
    e.preventDefault();
    if (!revokingItem) return;
    setBusyId(revokingItem.id);
    setError('');
    try {
      await api('revoke-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: revokingItem.id,
          reason: revokeReason,
        }),
      });
      setNotice('Ticket has been revoked.');
      setRevokingItem(null);
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const handleIssueComp = async (e) => {
    e.preventDefault();
    if (!compTeamId) return;
    setBusyId('comp');
    setError('');
    try {
      const res = await api('comp-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: compTeamId,
          reason: compReason,
        }),
      });
      setNotice('Complimentary ticket issued.');
      setShowCompModal(false);
      onActionComplete();
      if (res.registration) {
        onOpenEmail(res.registration, 'confirmed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="tickets-section">
      <div className="section-head">
        <div>
          <h2>Issued Tickets ({issued.length})</h2>
          <p>Official passes with tamper-proof QR codes admitted at entrance.</p>
        </div>
        <div className="section-head__actions">
          <button
            className={`chip-btn ${filterEmailNotSent ? 'is-active chip-btn--warn' : ''}`}
            onClick={() => setFilterEmailNotSent(!filterEmailNotSent)}
          >
            {filterEmailNotSent ? 'Show All Tickets' : 'Filter: Email Not Sent'}
          </button>
          <button onClick={() => setShowCompModal(true)}>
            + Issue comp ticket
          </button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {displayed.length === 0 ? (
        <p className="empty">No tickets matching this filter.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team ID</th>
                <th>Ticket ID</th>
                <th>Payment Ref</th>
                <th>Team & Leader</th>
                <th>Email Status</th>
                <th>Entry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code className="order-badge">{r.teamId || r.orderRef}</code>
                    {r.isComp && <span className="comp-tag">COMP</span>}
                  </td>
                  <td><code className="code--green">{r.ticketId}</code></td>
                  <td><code>{r.paymentRef || '—'}</code></td>
                  <td>
                    <strong>{r.teamName}</strong>
                    <span className="muted-text">{r.members[0]?.email}</span>
                  </td>
                  <td>
                    <span className={`email-badge email-badge--${r.emailStatus === 'sent' ? 'sent' : 'pending'}`}>
                      {r.emailStatus === 'sent' ? `Sent (${r.emailSentCount || 1}x)` : 'Not sent'}
                    </span>
                    {r.emailSentBy && (
                      <span className="muted-text" style={{ fontSize: '11px', display: 'block' }}>
                        by {r.emailSentBy}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.checkedInAt ? (
                      <span className="checked-badge">
                        ✓ Admitted {new Date(r.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="muted-text">Not checked in</span>
                    )}
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="table-action"
                        onClick={() => onOpenEmail(r, 'confirmed')}
                      >
                        ✉ Send email
                      </button>
                      <button
                        className="table-action table-action--danger"
                        onClick={() => {
                          setRevokingItem(r);
                          setRevokeReason('Disqualified or payment reversed.');
                        }}
                        disabled={busyId === r.id}
                      >
                        Revoke
                      </button>
                      <button
                        type="button"
                        className="table-action table-action--danger"
                        onClick={() => setDeletingTeam(r)}
                        disabled={busyId === r.id}
                        title={`Delete team ${r.teamName}`}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke Modal */}
      {revokingItem && (
        <div className="modal-backdrop" onClick={() => setRevokingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Revoke ticket {revokingItem.ticketId}</h3>
            <p>Revoking this ticket invalidates its QR code. Gate scanners will block entry.</p>
            <form onSubmit={handleRevoke}>
              <label htmlFor="revoke-reason">
                Revocation reason (required)
                <input
                  id="revoke-reason"
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setRevokingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-reject" disabled={Boolean(busyId)}>
                  Confirm Revoke
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Comp Modal */}
      {showCompModal && (
        <div className="modal-backdrop" onClick={() => setShowCompModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Issue Complimentary Ticket</h3>
            <p>Select any registered team to issue a confirmed ticket without requiring a UPI payment.</p>
            <form onSubmit={handleIssueComp}>
              <label htmlFor="comp-select">
                Choose team
                <select
                  id="comp-select"
                  value={compTeamId}
                  onChange={(e) => setCompTeamId(e.target.value)}
                  required
                >
                  <option value="">Select a registered team…</option>
                  {registrations
                    .filter((r) => r.paymentStatus !== 'PAID')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.teamName} ({r.teamId || r.orderRef || r.id}) - {statusLabels[r.paymentStatus]}
                      </option>
                    ))}
                </select>
              </label>
              <label htmlFor="comp-reason">
                Reason
                <input
                  id="comp-reason"
                  type="text"
                  value={compReason}
                  onChange={(e) => setCompReason(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setShowCompModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={!compTeamId || busyId === 'comp'}>
                  {busyId === 'comp' ? 'Issuing…' : 'Issue Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {deletingTeam && (
        <DeleteTeamModal
          team={deletingTeam}
          onClose={() => setDeletingTeam(null)}
          onDeleted={(msg) => {
            setNotice(msg);
            onActionComplete();
          }}
        />
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Door Check-in Component (html5-qrcode integration + attendance)
// -------------------------------------------------------------
function TicketScan({ onCheckedIn, onNavigate }) {
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [autoAdmit, setAutoAdmit] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const scannerRef = useRef(null);

  const performAction = useCallback(async (candidate, action = 'checkin') => {
    const clean = String(candidate || ticketId).trim();
    if (!clean) {
      setError('Enter or scan a ticket ID, Team ID, or leader phone.');
      return;
    }
    setError('');
    setBusyAction(true);
    try {
      const nextResult = await api('checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: clean, action }),
      });
      setTicketId(clean);
      setResult(nextResult);

      if (action === 'checkin' && nextResult.status === 'valid') {
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        if (nextResult.registration) {
          setRecentScans((prev) => [
            { ...nextResult.registration, admittedAt: new Date() },
            ...prev.filter((r) => r.id !== nextResult.registration.id),
          ].slice(0, 5));
        }
        onCheckedIn();
      } else if (action === 'undo' && nextResult.status === 'undone') {
        if (nextResult.registration) {
          setRecentScans((prev) => prev.filter((r) => r.id !== nextResult.registration.id));
        }
        onCheckedIn();
      }
    } catch (nextError) {
      setError(nextError.message || 'Could not process request.');
    } finally {
      setBusyAction(false);
    }
  }, [ticketId, onCheckedIn]);

  useEffect(() => {
    if (!scannerActive) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.warn);
        scannerRef.current = null;
      }
      return;
    }

    const html5QrcodeScanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      false
    );
    scannerRef.current = html5QrcodeScanner;

    html5QrcodeScanner.render(
      (decodedText) => {
        html5QrcodeScanner.clear().catch(console.warn);
        setScannerActive(false);
        performAction(decodedText, autoAdmit ? 'checkin' : 'lookup');
      },
      () => {}
    );

    return () => {
      html5QrcodeScanner.clear().catch(console.warn);
    };
  }, [scannerActive, autoAdmit, performAction]);

  const handleScanNext = () => {
    setResult(null);
    setError('');
    setTicketId('');
    setScannerActive(true);
  };

  return (
    <section className="checkin">
      <div className="section-head">
        <div>
          <h2>Door Check-in Desk</h2>
          <p>Scan attendee QR pass or enter Team ID, Ticket Token, or Leader Phone.</p>
        </div>
        {onNavigate && (
          <button
            type="button"
            className="quiet"
            onClick={() => onNavigate('admitted')}
            style={{ fontSize: '12px' }}
          >
            View Admitted Teams →
          </button>
        )}
      </div>

      {/* Checkin Mode Controls */}
      <div className="checkin-controls">
        <div className="checkin-mode-toggle">
          <label className="toggle-switch" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoAdmit}
              onChange={(e) => setAutoAdmit(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
          <div>
            <strong>Instant Auto-Admit on Scan</strong>
            <small>
              {autoAdmit
                ? 'ON: Scans will immediately admit attendees.'
                : 'OFF: Scans will display team details first for verification.'}
            </small>
          </div>
        </div>
      </div>

      <div className="checkin__body">
        <div className="scan-box">
          {scannerActive ? (
            <div className="scan-camera-container">
              <div id="qr-reader" />
              <button
                type="button"
                className="quiet"
                onClick={() => setScannerActive(false)}
                style={{ marginTop: '8px' }}
              >
                Close camera
              </button>
            </div>
          ) : (
            <div className="scan-box__idle">
              <span className="scan-box__icon">📷</span>
              <p>Camera ready for gate check-in</p>
              <button
                type="button"
                className="btn-approve"
                style={{ minHeight: '44px', padding: '0 20px' }}
                onClick={() => setScannerActive(true)}
              >
                Start camera scanner
              </button>
            </div>
          )}
        </div>

        <form
          className="checkin-form"
          onSubmit={(e) => {
            e.preventDefault();
            performAction(ticketId, 'lookup');
          }}
        >
          <label htmlFor="ticket-id">
            Manual Lookup / Verify
            <div className="checkin-input-group">
              <input
                id="ticket-id"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="Team ID (e.g. VHK-1001), Ticket Token, or Phone"
                autoCapitalize="characters"
                autoCorrect="off"
                disabled={busyAction}
              />
            </div>
          </label>

          <div className="checkin-actions-row">
            <button
              type="button"
              className="quiet"
              disabled={busyAction || !ticketId.trim()}
              onClick={() => performAction(ticketId, 'lookup')}
              style={{ minHeight: '44px', fontWeight: 600 }}
            >
              {busyAction ? 'Checking…' : '🔍 Inspect Team'}
            </button>
            <button
              type="button"
              className="btn-approve"
              disabled={busyAction || !ticketId.trim()}
              onClick={() => performAction(ticketId, 'checkin')}
              style={{ minHeight: '44px' }}
            >
              {busyAction ? 'Admitting…' : '✓ Quick Admit'}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginTop: '16px' }}>{error}</p>}

      {result && (
        <CheckinResult
          result={result}
          busyAction={busyAction}
          onAdmit={(candidate) => performAction(candidate, 'checkin')}
          onUndo={(candidate) => performAction(candidate, 'undo')}
          onScanNext={handleScanNext}
        />
      )}

      {/* Recent Gate Activity Feed */}
      {recentScans.length > 0 && (
        <div className="recent-feed">
          <h3>Recently Admitted at this Desk</h3>
          <div className="recent-list">
            {recentScans.map((team) => (
              <div key={team.id} className="recent-item">
                <div>
                  <strong>{team.teamName}</strong> <code>({team.teamId || team.orderRef})</code>
                  <small style={{ display: 'block' }}>
                    Admitted at {new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(team.admittedAt))} · {team.members?.length || 0} members
                  </small>
                </div>
                <button
                  type="button"
                  className="table-action table-action--danger"
                  disabled={busyAction}
                  onClick={() => performAction(team.id, 'undo')}
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CheckinResult({ result, busyAction, onAdmit, onUndo, onScanNext }) {
  const isReady = result.status === 'ready';
  const isValid = result.status === 'valid';
  const isAlready = result.status === 'already';
  const isUnpaid = result.status === 'unpaid';
  const isRevoked = result.status === 'revoked';
  const isInvalid = result.status === 'invalid';
  const isUndone = result.status === 'undone';

  const reg = result.registration;

  return (
    <div
      className={`checkin-result ${
        isReady
          ? 'ready'
          : isValid
            ? 'valid'
            : isAlready
              ? 'already'
              : 'invalid'
      }`}
      role="status"
    >
      <div className="checkin-result__header">
        <strong>
          {isReady && '🔍 VERIFIED — READY FOR ADMISSION'}
          {isValid && '✓ ENTRY RECORDED — WELCOME!'}
          {isAlready && '• ALREADY ADMITTED'}
          {isUndone && '↺ ADMISSION UNDONE (MARKED ABSENT)'}
          {isUnpaid && '× PAYMENT UNCONFIRMED'}
          {isRevoked && '× TICKET REVOKED'}
          {isInvalid && '× INVALID TICKET'}
        </strong>
        <span>{result.message}</span>
      </div>

      {reg && (
        <div className="checkin-result__details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '20px' }}>{reg.teamName}</h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                background: reg.paymentStatus === 'PAID' ? 'rgba(198, 242, 78, 0.15)' : 'rgba(255, 70, 70, 0.15)',
                color: reg.paymentStatus === 'PAID' ? '#c6f24e' : '#ff9aa0',
              }}
            >
              {reg.paymentStatus} {reg.isComp ? '(COMP)' : `(₹${reg.amount})`}
            </span>
          </div>

          <p style={{ marginTop: '8px', color: '#b4b4b4', fontSize: '13px' }}>
            Team ID: <code>{reg.teamId || reg.orderRef}</code> ·
            Ticket ID: <code>{reg.ticketId || '—'}</code>
            {reg.checkedInAt && (
              <span style={{ display: 'block', marginTop: '4px', color: '#c6f24e' }}>
                Checked in at:{' '}
                {new Intl.DateTimeFormat('en-IN', {
                  timeStyle: 'medium',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(reg.checkedInAt))}
              </span>
            )}
          </p>

          <div style={{ marginTop: '14px' }}>
            <span style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#888', fontWeight: 600 }}>
              Team Members ({reg.members?.length || 0})
            </span>
            <ul className="checkin-members">
              {reg.members?.map((m) => (
                <li key={m.id || m.position} style={{ padding: '6px 0', borderBottom: '1px solid #222' }}>
                  <div>
                    <strong>{m.position === 1 ? '👑 ' : ''}{m.fullName}</strong>
                    <small style={{ display: 'block', color: '#888' }}>
                      {m.college} {m.phone ? `· ${m.phone}` : ''}
                    </small>
                  </div>
                  <span style={{ color: '#aaa', fontSize: '12px' }}>Pos #{m.position}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interactive Attendance Action Buttons */}
          <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
            {(isReady || (!reg.checkedInAt && reg.paymentStatus === 'PAID')) && (
              <button
                type="button"
                className="btn-admit-big"
                disabled={busyAction}
                onClick={() => onAdmit(reg.id)}
              >
                {busyAction ? 'Admitting…' : '✓ Mark as Present / Admit Team'}
              </button>
            )}

            {reg.checkedInAt && (
              <button
                type="button"
                className="btn-undo-big"
                disabled={busyAction}
                onClick={() => {
                  if (window.confirm(`Undo admission for "${reg.teamName}" and mark as absent?`)) {
                    onUndo(reg.id);
                  }
                }}
              >
                {busyAction ? 'Updating…' : '↺ Mark as Absent (Undo Admission)'}
              </button>
            )}

            <button
              type="button"
              className="btn-scan-next"
              onClick={onScanNext}
            >
              📷 Scan Next Attendee
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// -------------------------------------------------------------
// Admitted Teams & Gate Attendance View Component
// -------------------------------------------------------------
function AdmittedView({ registrations, onActionComplete, onNavigate }) {
  const [search, setSearch] = useState('');
  const [undoBusyId, setUndoBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Extract all checked-in registrations
  const admittedList = registrations.filter((r) => Boolean(r.checkedInAt));
  const paidCount = registrations.filter((r) => r.paymentStatus === 'PAID').length;
  const totalAttendeesInside = admittedList.reduce((sum, r) => sum + (r.members?.length || 0), 0);
  const percentAdmitted = paidCount > 0 ? Math.round((admittedList.length / paidCount) * 100) : 0;

  // Filter admitted teams by query
  const filtered = admittedList.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const teamId = (r.teamId || r.orderRef || '').toLowerCase();
    const teamName = (r.teamName || '').toLowerCase();
    const memberMatch = r.members?.some(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.college.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.email.toLowerCase().includes(q)
    );
    return teamId.includes(q) || teamName.includes(q) || memberMatch;
  });

  const handleUndo = async (team) => {
    if (!window.confirm(`Mark team "${team.teamName}" (${team.teamId || team.orderRef}) as absent / undo admission?`)) {
      return;
    }
    setUndoBusyId(team.id);
    setNotice('');
    setError('');
    try {
      const res = await api('checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: team.id, action: 'undo' }),
      });
      setNotice(res.message || `Admission undone for ${team.teamName}. Marked as absent.`);
      onActionComplete();
    } catch (err) {
      setError(err.message || 'Could not undo check-in.');
    } finally {
      setUndoBusyId(null);
    }
  };

  const exportAdmittedCsv = () => {
    window.open('/api/export?filter=admitted', '_blank');
  };

  const exportAdmittedExcel = () => {
    // Generate Excel-friendly format directly in browser
    const header = [
      'Team ID', 'Team Name', 'Admitted At (IST)', 'Payment Status', 'Amount',
      'Leader Name', 'Leader Phone', 'Leader Email', 'Leader College',
      'Member 2 Name', 'Member 2 Phone', 'Member 2 College',
      'Member 3 Name', 'Member 3 Phone', 'Member 3 College',
      'Member 4 Name', 'Member 4 Phone', 'Member 4 College',
    ];

    const rows = admittedList.map((r) => {
      const leader = r.members?.find((m) => m.position === 1) || r.members?.[0] || {};
      const m2 = r.members?.find((m) => m.position === 2) || {};
      const m3 = r.members?.find((m) => m.position === 3) || {};
      const m4 = r.members?.find((m) => m.position === 4) || {};

      const admittedTime = r.checkedInAt
        ? new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
          }).format(new Date(r.checkedInAt))
        : '';

      return [
        r.teamId || r.orderRef || '',
        r.teamName || '',
        admittedTime,
        r.paymentStatus || '',
        r.amount || 0,
        leader.fullName || '', leader.phone || '', leader.email || '', leader.college || '',
        m2.fullName || '', m2.phone || '', m2.college || '',
        m3.fullName || '', m3.phone || '', m3.college || '',
        m4.fullName || '', m4.phone || '', m4.college || '',
      ];
    });

    const escapeCsv = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
    const csvContent = '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hack-o-lantern-admitted-teams-${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="admitted-section">
      <div className="section-head">
        <div>
          <h2>Admitted Teams & Attendance</h2>
          <p>Live attendance roster of checked-in hackathon teams and members.</p>
        </div>
        <div className="section-head__actions" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-approve"
            onClick={() => onNavigate('checkin')}
            style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
          >
            ⚡ Door Check-in
          </button>
          <a
            className="export"
            href="/hack_o_lantern_team_qrs_4per_page.pdf"
            download="hack_o_lantern_team_qrs_4per_page.pdf"
            style={{
              minHeight: '38px',
              padding: '0 16px',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Printable evaluation & leaderboard QR code passes (4 cards per A4 page)"
          >
            🖨️ Evaluation QRs (4/page)
          </a>
          <a
            className="quiet"
            href="/hack_o_lantern_team_qrs_large_placards.pdf"
            download="hack_o_lantern_team_qrs_large_placards.pdf"
            style={{
              minHeight: '38px',
              padding: '0 14px',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Large horizontal table tent placards (1 per A4 page)"
          >
            🏷️ Large Placards (1/page)
          </a>
          <button
            type="button"
            className="export"
            onClick={exportAdmittedCsv}
            style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="quiet"
            onClick={exportAdmittedExcel}
            style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
          >
            📊 Export for Excel
          </button>
        </div>
      </div>

      {notice && <p className="form-notice" style={{ marginTop: '14px' }}>{notice}</p>}
      {error && <p className="form-error" style={{ marginTop: '14px' }}>{error}</p>}

      {/* Attendance Stats Cards */}
      <div className="admitted-stats-grid">
        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Admitted Teams</span>
          <strong className="admitted-stat-box__value admitted-stat-box__value--green">
            {admittedList.length} <small style={{ fontSize: '16px', color: '#888' }}>/ {paidCount}</small>
          </strong>
          <span className="admitted-stat-box__sub">{percentAdmitted}% of confirmed teams admitted</span>
        </div>

        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Total Attendees Inside</span>
          <strong className="admitted-stat-box__value">{totalAttendeesInside}</strong>
          <span className="admitted-stat-box__sub">Physical participants inside venue</span>
        </div>

        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Pending Gate Admission</span>
          <strong className="admitted-stat-box__value" style={{ color: paidCount - admittedList.length > 0 ? '#ff9a4d' : '#888' }}>
            {Math.max(0, paidCount - admittedList.length)}
          </strong>
          <span className="admitted-stat-box__sub">Confirmed teams yet to arrive</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="table-tools">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search admitted teams, members, colleges, phones…"
          style={{ width: '100%', maxWidth: '420px', minHeight: '40px' }}
        />
        {search && (
          <button
            type="button"
            className="quiet"
            onClick={() => setSearch('')}
            style={{ minHeight: '40px', padding: '0 14px', fontSize: '12px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Admitted List */}
      {admittedList.length === 0 ? (
        <div className="empty" style={{ textAlign: 'center', padding: '40px 20px', background: '#141414', borderRadius: '8px' }}>
          <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>🚪</span>
          <h3 style={{ margin: '0 0 6px', color: '#fff' }}>No Teams Admitted Yet</h3>
          <p style={{ color: '#888', maxWidth: '400px', margin: '0 auto 20px' }}>
            Door check-in desk will populate this attendance roster as teams arrive and scan their tickets.
          </p>
          <button
            type="button"
            className="btn-approve"
            onClick={() => onNavigate('checkin')}
            style={{ minHeight: '44px', padding: '0 24px' }}
          >
            Open Door Check-in Desk →
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty">No admitted teams match &quot;{search}&quot;.</p>
      ) : (
        <div className="admitted-cards-list">
          {filtered.map((team) => {
            const leader = team.members?.find((m) => m.position === 1) || team.members?.[0] || {};
            const admittedTimeStr = team.checkedInAt
              ? new Intl.DateTimeFormat('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(team.checkedInAt))
              : '—';

            return (
              <div key={team.id} className="admitted-card">
                <div className="admitted-card__header">
                  <div className="admitted-card__title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <code className="code--green" style={{ fontSize: '14px' }}>
                        {team.teamId || team.orderRef}
                      </code>
                      <h3>{team.teamName}</h3>
                      {team.isComp && <span className="comp-tag">COMP</span>}
                    </div>
                  </div>
                  <span className="admitted-card__time">
                    ✓ Admitted at {admittedTimeStr}
                  </span>
                </div>

                {/* Team Members Grid */}
                <div className="admitted-members-grid">
                  {team.members?.map((m) => (
                    <div key={m.id || m.position} className="admitted-member-item">
                      <strong>{m.position === 1 ? '👑 ' : ''}{m.fullName}</strong>
                      <span>{m.college}</span>
                      {m.phone && <a href={`tel:${m.phone}`}>📞 {m.phone}</a>}
                    </div>
                  ))}
                </div>

                <div className="admitted-card__footer">
                  <small style={{ color: '#888', fontSize: '12px' }}>
                    Leader: {leader.fullName || '—'} · {leader.email ? <a href={`mailto:${leader.email}`} style={{ color: '#38bdf8' }}>{leader.email}</a> : '—'}
                  </small>
                  <button
                    type="button"
                    className="table-action table-action--danger"
                    disabled={undoBusyId === team.id}
                    onClick={() => handleUndo(team)}
                    style={{ minHeight: '34px', padding: '0 14px' }}
                  >
                    {undoBusyId === team.id ? 'Updating…' : '↺ Undo Admission'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Reminders & Rules Broadcast View Component
// -------------------------------------------------------------
function RemindersView({ registrations, onActionComplete, onOpenEmail }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'sent'
  const [copiedBcc, setCopiedBcc] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  // Only confirmed (PAID) teams get the final event reminder & rules
  const paidTeams = registrations.filter((r) => r.paymentStatus === 'PAID');
  const sentTeams = paidTeams.filter((r) => Boolean(r.reminderSent));
  const pendingTeams = paidTeams.filter((r) => !r.reminderSent);

  const filtered = paidTeams.filter((r) => {
    if (filter === 'sent' && !r.reminderSent) return false;
    if (filter === 'pending' && r.reminderSent) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const teamId = (r.teamId || r.orderRef || '').toLowerCase();
    const teamName = (r.teamName || '').toLowerCase();
    const leader = r.members?.find((m) => m.position === 1) || r.members?.[0] || {};
    const leaderName = (leader.fullName || '').toLowerCase();
    const leaderEmail = (leader.email || '').toLowerCase();
    const leaderPhone = (leader.phone || '').toLowerCase();

    return (
      teamId.includes(q) ||
      teamName.includes(q) ||
      leaderName.includes(q) ||
      leaderEmail.includes(q) ||
      leaderPhone.includes(q)
    );
  });

  const allLeaderEmails = Array.from(
    new Set(
      paidTeams
        .map((r) => {
          const leader = r.members?.find((m) => m.position === 1) || r.members?.[0];
          return leader?.email;
        })
        .filter(Boolean)
    )
  );

  const handleCopyBcc = () => {
    navigator.clipboard?.writeText(allLeaderEmails.join(', ')).then(() => {
      setCopiedBcc(true);
      setTimeout(() => setCopiedBcc(false), 2500);
    });
  };

  const handleResetAll = async () => {
    if (!window.confirm('Reset reminder status for all teams back to Pending?')) return;
    try {
      await api('mark-reminder-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_all' }),
      });
      setNotice('All teams have been reset to pending reminder.');
      onActionComplete();
    } catch (err) {
      alert(err.message || 'Could not reset reminders');
    }
  };

  const handleToggleSent = async (team) => {
    setBusyId(team.id);
    const nextStatus = team.reminderSent ? 'pending' : 'sent';
    try {
      await api('mark-reminder-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: team.id, status: nextStatus }),
      });
      setNotice(`Updated reminder status for ${team.teamName} to "${nextStatus}".`);
      onActionComplete();
    } catch (err) {
      alert(err.message || 'Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopySingle = (team) => {
    const { subject, body } = buildReminderEmail(team);
    navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
      setCopiedId(team.id);
      setTimeout(() => setCopiedId(''), 2000);
    });
  };

  // Master email template preview for mass broadcast
  const masterSubject = 'HACK-O-LANTERN — PARTICIPANT RULES & TIMINGS';
  const masterGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(allLeaderEmails.join(','))}&su=${encodeURIComponent(masterSubject)}&body=${encodeURIComponent(
`*HACK-O-LANTERN — PARTICIPANT RULES & TIMINGS*

Please read and follow the following rules carefully:

*1. Stay Within the Mirai Floor*
Participants are required to remain within the designated *Mirai floor/event area* throughout the hackathon. Leaving the designated floor will not be permitted.

*2. Entry Only With Valid Tickets*
Entry will be permitted *only with a valid event ticket*. Each team must ensure that all members have their tickets ready for verification.

Tickets can be downloaded from:
*https://www.vulcanclub.in/halloween-hack*
(Click "Already registered? Check status", enter your Team ID and email to view/download your ticket pass).

*3. Event Timings*
*Entry:* 31st October, *7:00 PM*
*Event Ends:* 1st November, *11:00 AM*

*4. Contact*
For any queries or assistance, contact:
*9907004089*
*+91 70133 26831*

Please arrive on time and keep your ticket ready at the entry checkpoint.

*Strict adherence to these rules is mandatory for all participants.*

Best regards,
Vulcan Club Organizing Team
https://www.vulcanclub.in/halloween-hack`
  )}`;

  return (
    <section className="reminders-section">
      <div className="section-head">
        <div>
          <h2>Event Reminders & Rules Dispatch</h2>
          <p>
            Send the official event reminder, rules, what-to-bring checklist, and ticket URL (<code>https://www.vulcanclub.in/halloween-hack</code>) to confirmed teams.
          </p>
        </div>
        <div className="section-head__actions" style={{ flexWrap: 'wrap' }}>
          {sentTeams.length > 0 && (
            <button
              type="button"
              className="quiet"
              onClick={handleResetAll}
              style={{ minHeight: '38px', padding: '0 14px', fontSize: '13px', color: '#ff9a4d' }}
            >
              ↺ Reset All to Pending
            </button>
          )}
          <button
            type="button"
            className="quiet"
            onClick={handleCopyBcc}
            style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
          >
            {copiedBcc ? '✓ Copied All Emails (BCC)!' : `📋 Copy All Emails (${allLeaderEmails.length} BCC)`}
          </button>
          <a
            className="btn-gmail"
            href={masterGmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              borderRadius: '999px',
              padding: '0 16px',
              minHeight: '38px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ✉️ Open Mass BCC in Gmail ↗
          </a>
        </div>
      </div>

      {notice && <p className="form-notice" style={{ marginTop: '14px' }}>{notice}</p>}

      {/* Stats Grid */}
      <div className="reminders-stats-grid">
        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Confirmed Teams</span>
          <strong className="admitted-stat-box__value">{paidTeams.length}</strong>
          <span className="admitted-stat-box__sub">Eligible for final event reminder</span>
        </div>
        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Reminders Dispatched</span>
          <strong className="admitted-stat-box__value admitted-stat-box__value--green">{sentTeams.length}</strong>
          <span className="admitted-stat-box__sub">Marked as sent</span>
        </div>
        <div className="admitted-stat-box">
          <span className="admitted-stat-box__label">Pending Reminder</span>
          <strong className="admitted-stat-box__value" style={{ color: pendingTeams.length > 0 ? '#ff9a4d' : '#888' }}>
            {pendingTeams.length}
          </strong>
          <span className="admitted-stat-box__sub">Teams awaiting reminder</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-chips">
        <button
          type="button"
          className={`chip-btn ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Confirmed ({paidTeams.length})
        </button>
        <button
          type="button"
          className={`chip-btn ${filter === 'pending' ? 'is-active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          ⏳ Pending Reminder ({pendingTeams.length})
        </button>
        <button
          type="button"
          className={`chip-btn ${filter === 'sent' ? 'is-active' : ''}`}
          onClick={() => setFilter('sent')}
        >
          ✓ Sent ({sentTeams.length})
        </button>
      </div>

      <div className="table-tools">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search confirmed teams, leader name, email, or phone…"
          style={{ width: '100%', maxWidth: '420px', minHeight: '40px' }}
        />
        {search && (
          <button
            type="button"
            className="quiet"
            onClick={() => setSearch('')}
            style={{ minHeight: '40px', padding: '0 14px', fontSize: '12px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <p className="empty">No confirmed teams match the selected filter.</p>
      ) : (
        <div className="reminders-cards-list">
          {filtered.map((team) => {
            const { subject, body, recipient, teamId, teamName, ticketId } = buildReminderEmail(team);
            const leader = team.members?.find((m) => m.position === 1) || team.members?.[0] || {};
            const isSent = Boolean(team.reminderSent);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            return (
              <div key={team.id} className={`reminder-card ${isSent ? 'reminder-card--sent' : 'reminder-card--pending'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <code className="code--green" style={{ fontSize: '14px' }}>{teamId}</code>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{teamName}</h3>
                      {team.isComp && <span className="comp-tag">COMP</span>}
                    </div>
                    <small style={{ display: 'block', color: '#aaa', marginTop: '4px' }}>
                      Official Ticket: <code>{ticketId}</code> · Leader: <strong>{leader.fullName || '—'}</strong> ({leader.college || '—'})
                    </small>
                  </div>

                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: isSent ? 'rgba(198, 242, 78, 0.15)' : 'rgba(255, 154, 77, 0.15)',
                      color: isSent ? '#c6f24e' : '#ff9a4d',
                      border: `1px solid ${isSent ? 'rgba(198, 242, 78, 0.3)' : 'rgba(255, 154, 77, 0.3)'}`,
                    }}
                  >
                    {isSent ? '✓ Reminder Sent' : '⏳ Pending Reminder'}
                  </span>
                </div>

                <div style={{ background: '#0d0d0d', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid #1c1c1c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span>Email: <strong>{recipient || '—'}</strong></span>
                    {leader.phone && <span>Phone: <a href={`tel:${leader.phone}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>{leader.phone}</a></span>}
                    <span>Members: <strong>{team.members?.length || 0}</strong></span>
                  </div>
                </div>

                <div className="reminder-actions">
                  <a
                    className="btn-gmail"
                    href={gmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      borderRadius: '999px',
                      padding: '0 16px',
                      minHeight: '34px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    ✉️ Open in Gmail ↗
                  </a>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => handleCopySingle(team)}
                    style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
                  >
                    {copiedId === team.id ? '✓ Message Copied!' : '📋 Copy Message'}
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => onOpenEmail(team, 'reminder_event')}
                    style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
                  >
                    👁 Preview / Edit
                  </button>
                  <button
                    type="button"
                    className={`table-action ${isSent ? '' : 'btn-approve'}`}
                    disabled={busyId === team.id}
                    onClick={() => handleToggleSent(team)}
                    style={{ minHeight: '34px', padding: '0 14px', fontSize: '12px', marginLeft: 'auto' }}
                  >
                    {busyId === team.id ? 'Saving…' : isSent ? '↺ Mark Pending' : '✓ Mark Sent'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Registrations Table & Bulk Helper Component
// -------------------------------------------------------------
function RegistrationTable({ registrations, search, setSearch, status, setStatus, onActionComplete, onOpenEmail }) {
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ fullName: '', college: '', email: '', phone: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedBulk, setCopiedBulk] = useState('');

  const [changingAmountItem, setChangingAmountItem] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [changeAmountForm, setChangeAmountForm] = useState({ listPrice: 300, couponCode: '', discountAmount: 0, amount: 300, reason: '' });
  const [changeAmountBusy, setChangeAmountBusy] = useState(false);
  const [changeAmountError, setChangeAmountError] = useState('');

  const openChangeAmount = (reg) => {
    setChangingAmountItem(reg);
    setChangeAmountForm({
      listPrice: reg.listPrice ?? 300,
      couponCode: reg.couponCode || '',
      discountAmount: reg.discountAmount ?? 0,
      amount: reg.amount,
      reason: '',
    });
    setChangeAmountError('');
  };

  const handleChangeAmountSubmit = async (e) => {
    e.preventDefault();
    if (!changingAmountItem) return;
    setChangeAmountBusy(true);
    setChangeAmountError('');
    try {
      await api('change-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: changingAmountItem.id,
          listPrice: Number(changeAmountForm.listPrice),
          couponCode: changeAmountForm.couponCode ? changeAmountForm.couponCode.trim() : null,
          discountAmount: Number(changeAmountForm.discountAmount),
          amount: Number(changeAmountForm.amount),
          reason: changeAmountForm.reason,
        }),
      });
      setNotice(`Pricing and coupon updated for ${changingAmountItem.teamName}.`);
      setChangingAmountItem(null);
      onActionComplete();
    } catch (err) {
      setChangeAmountError(err.message);
    } finally {
      setChangeAmountBusy(false);
    }
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setMemberForm({
      fullName: member.fullName,
      college: member.college,
      email: member.email,
      phone: member.phone,
    });
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditBusy(true);
    setEditError('');
    try {
      await api('attendee-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.id,
          ...memberForm,
        }),
      });
      setNotice('Attendee details updated.');
      setEditingMember(null);
      onActionComplete();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  };

  const copyEmailsByStatus = (statusToCopy) => {
    const matching = registrations.filter((r) => !statusToCopy || r.paymentStatus === statusToCopy);
    const emails = matching
      .flatMap((r) => r.members.map((m) => m.email))
      .filter(Boolean);
    const unique = Array.from(new Set(emails));

    navigator.clipboard?.writeText(unique.join(', ')).then(() => {
      setCopiedBulk(`Copied ${unique.length} emails!`);
      setTimeout(() => setCopiedBulk(''), 2500);
    });
  };

  return (
    <section className="registrations">
      <div className="section-head">
        <div>
          <h2>All Teams ({registrations.length})</h2>
          <p>Search Team ID, Payment Ref, attendee, college, UTR, or ticket ID.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="quiet"
            onClick={() => copyEmailsByStatus(status)}
            style={{ fontSize: '12px', minHeight: '32px' }}
          >
            {copiedBulk || '📋 Copy attendee emails'}
          </button>
          <a
            className="export"
            href="/hack_o_lantern_team_qrs_4per_page.pdf"
            download="hack_o_lantern_team_qrs_4per_page.pdf"
            title="Download printable evaluation & leaderboard QR codes PDF (4 per A4 page)"
          >
            🖨️ Evaluation QRs ↗
          </a>
          <a className="export" href="/api/export">Export CSV ↗</a>
        </div>
      </div>

      <div className="table-tools">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, ID, UTR, email…"
          aria-label="Search registrations"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter registrations by status"
        >
          <option value="">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {notice && <p className="form-notice" role="status">{notice}</p>}

      {registrations.length === 0 ? (
        <p className="empty">No matching teams.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team ID</th>
                <th>Payment Ref</th>
                <th>Team</th>
                <th>Status</th>
                <th>Pricing & Coupon</th>
                <th>UTR Reference</th>
                <th>Ticket ID</th>
                <th>Members & Colleges</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td><code className="order-badge">{r.teamId || r.orderRef}</code></td>
                  <td><code>{r.paymentRef || '—'}</code></td>
                  <td>
                    <strong>{r.teamName}</strong>
                    <span className="muted-text">{formatDate(r.createdAt)}</span>
                    {r.referral?.referrer && (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ fontSize: '11px', color: '#c6f24e', background: 'rgba(198, 242, 78, 0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(198, 242, 78, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Ref: {r.referral.referrer.name} (<code>{r.referral.referrer.code}</code>)
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status status--${r.paymentStatus.toLowerCase()}`}>
                      {statusLabels[r.paymentStatus]}
                    </span>
                    {r.rejectReason && <small className="reject-inline">{r.rejectReason}</small>}
                  </td>
                  <td>
                    <div>
                      <strong>₹{r.amount}</strong>
                      {r.couponCode ? (
                        <div style={{ marginTop: '3px' }}>
                          <span className="coupon-badge">
                            🏷️ {r.couponCode} (-₹{r.discountAmount})
                          </span>
                        </div>
                      ) : (
                        <span className="muted-text" style={{ fontSize: '11px', display: 'block' }}>Base ₹{r.listPrice || 300}</span>
                      )}
                      {r.amountReceived !== null && r.amountReceived !== undefined && (
                        <span style={{ fontSize: '11px', color: '#c6f24e', display: 'block', marginTop: '2px' }}>
                          Recv: ₹{r.amountReceived}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <code>{r.utr || r.paymentReference || '—'}</code>
                    {r.screenshotSignedUrl && (
                      <a href={r.screenshotSignedUrl} target="_blank" rel="noreferrer" className="proof-link">
                        [View receipt]
                      </a>
                    )}
                  </td>
                  <td><code>{r.ticketId || '—'}</code></td>
                  <td>
                    {r.members.map((m) => (
                      <div className="member-row" key={m.position}>
                        <span>
                          <strong>{m.fullName}</strong>
                          <small>({m.college}) · {m.email}</small>
                        </span>
                        <button type="button" className="edit-mini-btn" onClick={() => openEdit(m)}>
                          Edit
                        </button>
                      </div>
                    ))}
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => openChangeAmount(r)}
                      >
                        ⚙ Adjust price
                      </button>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => onOpenEmail(r, r.paymentStatus === 'PAID' ? 'confirmed' : 'reminder')}
                      >
                        ✉ Email
                      </button>
                      <button
                        type="button"
                        className="table-action table-action--danger"
                        onClick={() => setDeletingTeam(r)}
                        title={`Delete team ${r.teamName}`}
                      >
                        🗑 Delete team
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Attendee Modal */}
      {editingMember && (
        <div className="modal-backdrop" onClick={() => setEditingMember(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Attendee Details</h3>
            <form onSubmit={handleEditSubmit}>
              <label htmlFor="edit-name">
                Full Name
                <input
                  id="edit-name"
                  value={memberForm.fullName}
                  onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
                  required
                />
              </label>
              <label htmlFor="edit-college">
                College / Organisation
                <input
                  id="edit-college"
                  value={memberForm.college}
                  onChange={(e) => setMemberForm({ ...memberForm, college: e.target.value })}
                  required
                />
              </label>
              <label htmlFor="edit-email">
                Email
                <input
                  id="edit-email"
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  required
                />
              </label>
              <label htmlFor="edit-phone">
                Phone
                <input
                  id="edit-phone"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  required
                />
              </label>
              {editError && <p className="form-error" role="alert">{editError}</p>}
              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setEditingMember(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={editBusy}>
                  {editBusy ? 'Saving…' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Amount or Coupon Modal */}
      {changingAmountItem && (
        <div className="modal-backdrop" onClick={() => setChangingAmountItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust Pricing & Coupon for {changingAmountItem.teamName}</h3>
            <p style={{ fontSize: '13px', color: '#b4b4b4', marginBottom: '14px' }}>
              Team ID: <code>{changingAmountItem.teamId || changingAmountItem.orderRef}</code> · Current Status: <code>{statusLabels[changingAmountItem.paymentStatus]}</code>
            </p>

            {changeAmountError && <p className="form-error" role="alert">{changeAmountError}</p>}

            <form onSubmit={handleChangeAmountSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  List Price (INR)
                  <input
                    type="number"
                    min="0"
                    value={changeAmountForm.listPrice}
                    onChange={(e) => {
                      const lp = Number(e.target.value);
                      setChangeAmountForm((prev) => ({
                        ...prev,
                        listPrice: lp,
                        amount: Math.max(0, lp - Number(prev.discountAmount || 0)),
                      }));
                    }}
                    required
                  />
                </label>
                <label>
                  Coupon Code (optional)
                  <input
                    type="text"
                    value={changeAmountForm.couponCode}
                    placeholder="e.g. halloween_night"
                    onChange={(e) => setChangeAmountForm((prev) => ({ ...prev, couponCode: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Discount Amount (INR)
                  <input
                    type="number"
                    min="0"
                    value={changeAmountForm.discountAmount}
                    onChange={(e) => {
                      const disc = Number(e.target.value);
                      setChangeAmountForm((prev) => ({
                        ...prev,
                        discountAmount: disc,
                        amount: Math.max(0, Number(prev.listPrice || 300) - disc),
                      }));
                    }}
                    required
                  />
                </label>
                <label>
                  Final Amount to Pay (INR) *
                  <input
                    type="number"
                    min="1"
                    value={changeAmountForm.amount}
                    onChange={(e) => setChangeAmountForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                    required
                  />
                </label>
              </div>

              <label>
                Reason for modification (required for audit trail) *
                <textarea
                  rows={3}
                  value={changeAmountForm.reason}
                  onChange={(e) => setChangeAmountForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Approved sponsor partner concession, confirmed with organizing lead."
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setChangingAmountItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-approve" disabled={changeAmountBusy}>
                  {changeAmountBusy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {deletingTeam && (
        <DeleteTeamModal
          team={deletingTeam}
          onClose={() => setDeletingTeam(null)}
          onDeleted={(msg) => {
            setNotice(msg);
            onActionComplete();
          }}
        />
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Settings Page Component (Section 1)
// -------------------------------------------------------------
function SettingsView({ onActionComplete }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const data = await api('settings');
      setSettings(data.settings);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api('settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setNotice(result.message || 'Settings saved successfully.');
      setSettings(result.settings);
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="loading">Loading settings…</p>;

  return (
    <section className="settings-section">
      <div className="section-head">
        <div>
          <h2>Event Configuration & Registration Control</h2>
          <p>Controls event capacity, ticket price, UPI payee ID, and public registration state.</p>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      <form onSubmit={handleSubmit} className="settings-grid">
        <div className="settings-card">
          <h3>Registration Status</h3>
          <div className="toggle-row">
            <span>Open for new registrations:</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(settings?.registrationsOpen)}
                onChange={(e) => setSettings({ ...settings, registrationsOpen: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <small style={{ color: settings?.registrationsOpen ? '#c6f24e' : '#ff9aa0' }}>
            {settings?.registrationsOpen ? '● Public registration is ACTIVE' : '○ Registration is PAUSED / CLOSED'}
          </small>

          <label htmlFor="capacity-input" style={{ marginTop: '12px' }}>
            Maximum Team Capacity
            <input
              id="capacity-input"
              type="number"
              min="1"
              max="5000"
              value={settings?.maxCapacity || 100}
              onChange={(e) => setSettings({ ...settings, maxCapacity: Number(e.target.value) })}
              required
            />
          </label>
        </div>

        <div className="settings-card">
          <h3>Payment & Pricing</h3>
          <label htmlFor="price-input">
            Team Ticket Price (INR)
            <input
              id="price-input"
              type="number"
              min="0"
              value={settings?.ticketPrice || 300}
              onChange={(e) => setSettings({ ...settings, ticketPrice: Number(e.target.value) })}
              required
            />
          </label>

          <label htmlFor="upi-input">
            Payee UPI VPA ID
            <input
              id="upi-input"
              type="text"
              value={settings?.upiId || 'himangshuyadav2@oksbi'}
              onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
              required
            />
          </label>
        </div>

        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Event Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <label htmlFor="event-name-input">
              Event Name
              <input
                id="event-name-input"
                type="text"
                value={settings?.eventName || 'Hack-O-Lantern'}
                onChange={(e) => setSettings({ ...settings, eventName: e.target.value })}
                required
              />
            </label>

            <label htmlFor="event-date-input">
              Event Date & Timing
              <input
                id="event-date-input"
                type="text"
                value={settings?.eventDate || '31 Oct 2026, 7:00 PM – 1 Nov 2026, 11:00 AM'}
                onChange={(e) => setSettings({ ...settings, eventDate: e.target.value })}
                required
              />
            </label>

            <label htmlFor="event-venue-input">
              Venue
              <input
                id="event-venue-input"
                type="text"
                value={settings?.eventVenue || 'Mirai Floor, Bengaluru'}
                onChange={(e) => setSettings({ ...settings, eventVenue: e.target.value })}
                required
              />
            </label>
          </div>
        </div>

        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Referral Program Configuration</h3>
          <div className="toggle-row">
            <span>Referral program active:</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(settings?.referralProgramActive ?? true)}
                onChange={(e) => setSettings({ ...settings, referralProgramActive: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <small style={{ color: settings?.referralProgramActive !== false ? '#c6f24e' : '#ff9aa0' }}>
            {settings?.referralProgramActive !== false ? '● Referral validation and code generation is ACTIVE' : '○ Referral program is PAUSED'}
          </small>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <label htmlFor="eligible-college-input">
              Eligible College Name (strict match)
              <input
                id="eligible-college-input"
                type="text"
                value={settings?.eligibleCollegeName || 'Mirai School of Technology'}
                onChange={(e) => setSettings({ ...settings, eligibleCollegeName: e.target.value })}
                required
              />
            </label>

            <label htmlFor="mirai-domain-input">
              Mirai Student Email Domain
              <input
                id="mirai-domain-input"
                type="text"
                value={settings?.miraiEmailDomain || '@mirai.edu.in'}
                onChange={(e) => setSettings({ ...settings, miraiEmailDomain: e.target.value })}
                required
              />
            </label>
          </div>

          <label htmlFor="reward-text-input" style={{ marginTop: '16px' }}>
            Public Referral Reward Notice (optional)
            <input
              id="reward-text-input"
              type="text"
              placeholder="Leave empty to hide from public pages"
              value={settings?.referralRewardText || ''}
              onChange={(e) => setSettings({ ...settings, referralRewardText: e.target.value })}
            />
            <small className="muted-text" style={{ display: 'block', marginTop: '4px' }}>
              If left empty, no reward message or promise is shown on public registration or ticket pages.
            </small>
          </label>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving changes…' : 'Save Event & Referral Settings'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// -------------------------------------------------------------
// Coupons Management View
// -------------------------------------------------------------
function toLocalDatetimeInput(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function CouponsView({ onActionComplete }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'flat',
    value: 180,
    maxUses: '',
    expiresAt: '',
    active: true,
  });

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('coupons');
      setCoupons(res.coupons || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const openEditModal = (coupon) => {
    setError('');
    setNotice('');
    setEditingCoupon({
      id: coupon.id,
      originalCode: coupon.code,
      code: coupon.code,
      type: coupon.type || 'flat',
      value: coupon.value,
      maxUses: coupon.maxUses !== null && coupon.maxUses !== undefined ? String(coupon.maxUses) : '',
      expiresAt: coupon.expiresAt ? toLocalDatetimeInput(coupon.expiresAt) : '',
      active: Boolean(coupon.active),
      usedCount: coupon.usedCount || 0,
      registrationsCount: coupon.registrationsCount || 0,
    });
  };

  const toggleActive = async (coupon) => {
    setBusyId(coupon.id);
    setError('');
    setNotice('');
    try {
      const res = await api('coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: coupon.id,
          active: !coupon.active,
        }),
      });
      setNotice(res.message);
      await loadCoupons();
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const deleteCoupon = async (coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) return;
    setBusyId(coupon.id);
    setError('');
    setNotice('');
    try {
      const res = await api(`coupons?id=${encodeURIComponent(coupon.id)}`, {
        method: 'DELETE',
      });
      setNotice(res.message);
      await loadCoupons();
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setBusyId('create');
    setError('');
    setNotice('');
    try {
      const res = await api('coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCoupon.code,
          type: newCoupon.type,
          value: Number(newCoupon.value),
          maxUses: newCoupon.maxUses ? parseInt(newCoupon.maxUses, 10) : null,
          expiresAt: newCoupon.expiresAt ? new Date(newCoupon.expiresAt).toISOString() : null,
          active: newCoupon.active,
        }),
      });
      setNotice(res.message);
      setShowCreateModal(false);
      setNewCoupon({ code: '', type: 'flat', value: 180, maxUses: '', expiresAt: '', active: true });
      await loadCoupons();
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCoupon) return;
    setBusyId(`edit-${editingCoupon.id}`);
    setError('');
    setNotice('');
    try {
      const res = await api('coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCoupon.id,
          code: editingCoupon.code,
          type: editingCoupon.type,
          value: Number(editingCoupon.value),
          maxUses: editingCoupon.maxUses !== '' && editingCoupon.maxUses !== null ? parseInt(editingCoupon.maxUses, 10) : null,
          expiresAt: editingCoupon.expiresAt ? new Date(editingCoupon.expiresAt).toISOString() : null,
          active: editingCoupon.active,
        }),
      });
      setNotice(res.message || 'Coupon updated successfully.');
      setEditingCoupon(null);
      await loadCoupons();
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="coupons-section">
      <div className="section-head">
        <div>
          <h2>Event Coupon Management</h2>
          <p>Create, configure, monitor usage, or deactivate discount codes for Hack-O-Lantern.</p>
        </div>
        <button
          type="button"
          className="btn-approve"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Coupon
        </button>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginTop: '16px' }}>{error}</p>}
      {notice && <p className="form-notice" role="status" style={{ marginTop: '16px' }}>{notice}</p>}

      {loading ? (
        <p className="empty">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="empty">No coupons configured.</p>
      ) : (
        <div className="coupons-grid">
          {coupons.map((c) => (
            <article className={`coupon-card ${c.active ? 'coupon-card--active' : 'coupon-card--inactive'}`} key={c.id}>
              <div className="coupon-card__header">
                <div>
                  <span className="coupon-code-badge">{c.code}</span>
                  <strong className="coupon-value-title">
                    {c.type === 'percent' ? `${c.value}% OFF` : `₹${c.value} FLAT OFF`}
                  </strong>
                </div>
                <span className={`coupon-status-pill ${c.active ? 'coupon-status-pill--active' : 'coupon-status-pill--inactive'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="coupon-card__stats">
                <div className="coupon-stat-item">
                  <span className="stat-label">Used count:</span>
                  <strong>{c.usedCount} {c.maxUses ? `/ ${c.maxUses}` : '(Unlimited)'}</strong>
                </div>
                <div className="coupon-stat-item">
                  <span className="stat-label">Referenced by:</span>
                  <span>{c.registrationsCount} team(s)</span>
                </div>
                <div className="coupon-stat-item">
                  <span className="stat-label">Expires:</span>
                  <span>{c.expiresAt ? formatDate(c.expiresAt) : 'No expiration'}</span>
                </div>
              </div>

              <div className="coupon-card__actions">
                <button
                  type="button"
                  className="table-action"
                  onClick={() => openEditModal(c)}
                  disabled={busyId === c.id || busyId === `edit-${c.id}`}
                >
                  ✎ Edit
                </button>
                <button
                  type="button"
                  className="table-action"
                  onClick={() => toggleActive(c)}
                  disabled={busyId === c.id}
                >
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
                {c.usedCount === 0 && c.registrationsCount === 0 ? (
                  <button
                    type="button"
                    className="table-action table-action--danger"
                    onClick={() => deleteCoupon(c)}
                    disabled={busyId === c.id}
                  >
                    Delete
                  </button>
                ) : (
                  <span className="muted-text" style={{ fontSize: '11px', alignSelf: 'center' }}>
                    Used (Cannot delete)
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit Coupon Modal */}
      {editingCoupon && (
        <div className="modal-backdrop" onClick={() => setEditingCoupon(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>
                Edit Coupon: <span className="coupon-code-badge" style={{ verticalAlign: 'middle', margin: 0 }}>{editingCoupon.originalCode}</span>
              </h3>
              <button
                type="button"
                className="quiet"
                style={{ border: 'none', fontSize: '18px', cursor: 'pointer', padding: '0 4px', minHeight: 'auto' }}
                onClick={() => setEditingCoupon(null)}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#b4b4b4', marginBottom: '14px' }}>
              Update coupon code, discount rate, max uses, or expiration date. Used: <strong>{editingCoupon.usedCount}</strong> time(s).
            </p>

            <form onSubmit={handleEditSubmit}>
              <label>
                Coupon Code * (3-32 characters: letters, numbers, _, -)
                <input
                  type="text"
                  value={editingCoupon.code}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value })}
                  placeholder="e.g. last_minute"
                  pattern="^[a-zA-Z0-9_-]{3,32}$"
                  title="3-32 characters, only alphanumeric, hyphens, and underscores"
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Discount Type
                  <select
                    value={editingCoupon.type}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, type: e.target.value })}
                  >
                    <option value="flat">Flat amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </label>
                <label>
                  Discount Value *
                  <input
                    type="number"
                    min="1"
                    max={editingCoupon.type === 'percent' ? '100' : undefined}
                    value={editingCoupon.value}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, value: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Max Uses (optional)
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty for unlimited"
                    value={editingCoupon.maxUses}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, maxUses: e.target.value })}
                  />
                </label>
                <label>
                  Expiration Date (optional)
                  <input
                    type="datetime-local"
                    value={editingCoupon.expiresAt}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, expiresAt: e.target.value })}
                  />
                </label>
              </div>

              <label className="toggle-row" style={{ cursor: 'pointer', margin: '8px 0' }}>
                <span>Coupon active (available to participants)</span>
                <input
                  type="checkbox"
                  style={{ width: 'auto', minHeight: 'auto' }}
                  checked={editingCoupon.active}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, active: e.target.checked })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setEditingCoupon(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-approve" disabled={busyId === `edit-${editingCoupon.id}`}>
                  {busyId === `edit-${editingCoupon.id}` ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Coupon</h3>
            <p style={{ fontSize: '13px', color: '#b4b4b4', marginBottom: '14px' }}>
              Add a discount code that participants can apply on the payment screen.
            </p>

            <form onSubmit={handleCreateSubmit}>
              <label>
                Coupon Code * (3-32 characters: letters, numbers, _, -)
                <input
                  type="text"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                  placeholder="e.g. halloween_night"
                  pattern="^[a-zA-Z0-9_-]{3,32}$"
                  title="3-32 characters, only alphanumeric, hyphens, and underscores"
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Discount Type
                  <select
                    value={newCoupon.type}
                    onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value })}
                  >
                    <option value="flat">Flat amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </label>
                <label>
                  Discount Value *
                  <input
                    type="number"
                    min="1"
                    max={newCoupon.type === 'percent' ? '100' : undefined}
                    value={newCoupon.value}
                    onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Max Uses (optional)
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={newCoupon.maxUses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })}
                  />
                </label>
                <label>
                  Expiration Date (optional)
                  <input
                    type="datetime-local"
                    value={newCoupon.expiresAt}
                    onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })}
                  />
                </label>
              </div>

              <label className="toggle-row" style={{ cursor: 'pointer', margin: '8px 0' }}>
                <span>Activate immediately upon creation</span>
                <input
                  type="checkbox"
                  style={{ width: 'auto', minHeight: 'auto' }}
                  checked={newCoupon.active}
                  onChange={(e) => setNewCoupon({ ...newCoupon, active: e.target.checked })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="quiet" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-approve" disabled={busyId === 'create'}>
                  {busyId === 'create' ? 'Creating…' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Referrals Management & Leaderboard View
// -------------------------------------------------------------
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      className={`copy-mini-btn ${copied ? 'copy-mini-btn--copied' : ''}`}
      onClick={handleCopy}
      title={`Copy ${text}`}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function AddClubMemberModal({ onClose, onAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_club_member', name, email, phone }),
      });
      onAdded(result.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Add Vulcan Club Member</h3>
          <p>Club members get an active referral code (VULCAN-XXXXXX) to share with teams.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            Full Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aditi Sharma"
            />
          </label>
          <label>
            Email Address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aditi@example.com"
            />
          </label>
          <label>
            Phone Number (optional)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-approve" disabled={busy}>
              {busy ? 'Adding…' : 'Add Club Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportClubMembersModal({ onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const firstLower = lines[0].toLowerCase();
    const startIndex = (firstLower.includes('name') || firstLower.includes('email')) ? 1 : 0;
    const parsed = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        parsed.push({
          name: parts[0],
          email: parts[1],
          phone: parts[2] || '',
        });
      }
    }
    return parsed;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const members = parseCsv(csvText);
    if (!members.length) {
      setError('Please provide at least one valid row in "name, email, phone" format.');
      return;
    }
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_club_members', members }),
      });
      setSummary(result.summary);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const parsedCount = parseCsv(csvText).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Bulk Import Vulcan Club Members</h3>
          <p>Paste CSV content or select a file with columns: <code>name, email, phone</code></p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {summary && (
          <div className="pricing-summary-card" style={{ marginBottom: '16px' }}>
            <span style={{ color: '#c6f24e', fontWeight: 600 }}>Import Results:</span>
            <span className="summary-line"><span>New Club Members Added:</span> <strong>{summary.added}</strong></span>
            <span className="summary-line"><span>Existing Mirai Students Upgraded to Both:</span> <strong>{summary.upgraded}</strong></span>
            <span className="summary-line"><span>Already Active Club Members (Skipped):</span> <strong>{summary.skipped}</strong></span>
            {summary.errors?.length > 0 && (
              <div style={{ marginTop: '8px', color: '#ff9aa0', fontSize: '12px' }}>
                <strong>Errors ({summary.errors.length}):</strong>
                <ul>{summary.errors.slice(0, 5).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleImport}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <span className="edit-mini-btn" style={{ padding: '6px 12px' }}>Choose CSV File</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: '12px', color: '#888' }}>{parsedCount} valid rows detected</span>
          </div>

          <label style={{ marginTop: '10px' }}>
            CSV Data (Header optional: <code>name, email, phone</code>)
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Aditi Sharma, aditi@example.com, 9876543210&#10;Rahul Varma, rahul@example.com, 9876543211"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="quiet" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button type="submit" className="btn-approve" disabled={busy || parsedCount === 0}>
              {busy ? 'Importing…' : `Import ${parsedCount} Members`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivateReferrerModal({ referrer, onClose, onUpdated }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!referrer) return null;

  const handleDeactivate = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required to deactivate a referrer.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          referrerId: referrer.id,
          active: false,
          reason,
        }),
      });
      onUpdated(result.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Deactivate Referrer</h3>
          <p>Deactivating <strong>{referrer.name}</strong> ({referrer.code}) prevents this code from being used for any new registrations.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={handleDeactivate}>
          <label>
            Reason for Deactivation (required)
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Member left club, code compromised, or misuse detected"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? 'Deactivating…' : 'Deactivate Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReissueCodeModal({ referrer, onClose, onUpdated }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!referrer) return null;

  const handleReissue = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required to reissue a referral code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reissue_code',
          referrerId: referrer.id,
          reason,
        }),
      });
      onUpdated(result.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Reissue Referral Code</h3>
          <p>Generate a brand-new code for <strong>{referrer.name}</strong>. Their previous code (<code>{referrer.code}</code>) will become invalid.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={handleReissue}>
          <label>
            Reason for Reissue (required)
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Code publicly leaked, spelling corrected, or user request"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-approve" disabled={busy}>
              {busy ? 'Reissuing…' : 'Generate New Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReferralDrilldownModal({ referrerId, onClose, onActionComplete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideItem, setOverrideItem] = useState(null);
  const [notice, setNotice] = useState('');

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`referrals-admin?referrerId=${referrerId}`);
      setData(res.referrer);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [referrerId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>Referral Drill-Down: {data?.name || 'Loading…'}</h3>
            <p>
              Code: <code className="code-display">{data?.code}</code> · Email: {data?.email}
            </p>
          </div>
          <button type="button" className="quiet" onClick={onClose} style={{ minHeight: '30px', padding: '0 10px' }}>✕</button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}

        {loading ? (
          <p className="loading" style={{ minHeight: '120px' }}>Loading referred teams…</p>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '12px', margin: '14px 0', fontSize: '13px' }}>
              <span><b>{data?.referrals?.filter((r) => r.status === 'confirmed').length || 0}</b> Confirmed</span>
              <span><b>{data?.referrals?.filter((r) => r.status === 'pending').length || 0}</b> Pending</span>
              <span><b>{data?.referrals?.filter((r) => r.status === 'reversed').length || 0}</b> Reversed</span>
            </div>

            <div className="table-wrap drilldown-table">
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Leader</th>
                    <th>Payment</th>
                    <th>Referral Status</th>
                    <th>Timestamps</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data?.referrals || data.referrals.length === 0) ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#777', padding: '24px' }}>No teams have registered using this code yet.</td>
                    </tr>
                  ) : (
                    data.referrals.map((ref) => {
                      const team = ref.referredTeam;
                      const leader = team?.members?.[0];
                      return (
                        <tr key={ref.id}>
                          <td>
                            <strong>{team?.teamName || 'Unknown'}</strong>
                            <small className="muted-text" style={{ display: 'block' }}>{team?.teamId || team?.id}</small>
                          </td>
                          <td>
                            <span>{leader?.fullName || '—'}</span>
                            <small className="muted-text" style={{ display: 'block' }}>{leader?.email || '—'}</small>
                          </td>
                          <td>
                            <span className={`status status--${team?.paymentStatus?.toLowerCase()}`}>
                              {statusLabels[team?.paymentStatus] || team?.paymentStatus}
                            </span>
                            <small className="muted-text" style={{ display: 'block' }}>₹{team?.amount}</small>
                          </td>
                          <td>
                            <span className={`status ${ref.status === 'confirmed' ? 'status--paid' : ref.status === 'reversed' ? 'status--rejected' : 'status--pending_review'}`}>
                              {ref.status}
                            </span>
                            {ref.reversedReason && (
                              <small className="reject-inline" style={{ display: 'block' }}>{ref.reversedReason}</small>
                            )}
                          </td>
                          <td style={{ fontSize: '11px', color: '#888' }}>
                            <div>Reg: {formatDate(ref.createdAt)}</div>
                            {ref.confirmedAt && <div style={{ color: '#c6f24e' }}>Conf: {formatDate(ref.confirmedAt)}</div>}
                            {ref.reversedAt && <div style={{ color: '#ff8888' }}>Rev: {formatDate(ref.reversedAt)}</div>}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => setOverrideItem(ref)}
                            >
                              Override
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="quiet" onClick={onClose}>Close</button>
        </div>

        {overrideItem && (
          <ManualOverrideModal
            referral={overrideItem}
            onClose={() => setOverrideItem(null)}
            onUpdated={(msg) => {
              setNotice(msg);
              loadDetails();
              onActionComplete();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ManualOverrideModal({ referral, onClose, onUpdated }) {
  const [targetStatus, setTargetStatus] = useState(referral.status === 'confirmed' ? 'reversed' : 'confirmed');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required for manual override.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_override',
          referralId: referral.id,
          status: targetStatus,
          reason,
        }),
      });
      onUpdated(result.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Manual Referral Status Override</h3>
          <p>Current status: <strong>{referral.status}</strong></p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={handleOverride}>
          <label>
            New Status
            <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
              <option value="confirmed">confirmed (Count as successful referral)</option>
              <option value="reversed">reversed (Disqualify referral)</option>
              <option value="pending">pending (Await payment review)</option>
            </select>
          </label>
          <label>
            Reason for Override (required, recorded in Audit Log)
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Offline verification, organizer exception, or disputed referral"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="quiet" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-approve" disabled={busy}>
              {busy ? 'Updating…' : 'Apply Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReferralsView({ onActionComplete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [drilldownReferrerId, setDrilldownReferrerId] = useState(null);
  const [deactivatingReferrer, setDeactivatingReferrer] = useState(null);
  const [reissuingReferrer, setReissuingReferrer] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('referrals-admin');
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = async (exportType) => {
    try {
      setExporting(true);
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export_csv', exportType }),
      });
      const blob = new Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', result.filename || `export-${exportType}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleToggleReactivate = async (ref) => {
    try {
      const result = await api('referrals-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', referrerId: ref.id, active: true }),
      });
      setNotice(result.message);
      loadData();
      onActionComplete();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredLeaderboard = (data?.leaderboard || []).filter((ref) => {
    if (typeFilter !== 'all' && ref.type !== typeFilter) return false;
    if (statusFilter === 'active' && !ref.active) return false;
    if (statusFilter === 'deactivated' && ref.active) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = ref.name.toLowerCase().includes(q);
      const matchEmail = ref.email.toLowerCase().includes(q);
      const matchPhone = ref.phone && ref.phone.includes(q);
      const matchCode = ref.code.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchCode) return false;
    }
    return true;
  });

  return (
    <section className="referrals-section">
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Referrals & Leaderboard</h2>
          <p>
            Ranked primarily by confirmed team referrals. Ties are automatically broken by earliest confirmed referral time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-approve" onClick={() => setShowAddModal(true)}>
            + Add Club Member
          </button>
          <button type="button" className="table-action" onClick={() => setShowImportModal(true)}>
            Bulk Import CSV
          </button>
          <button
            type="button"
            className="table-action"
            onClick={() => handleExportCsv('leaderboard')}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export Leaderboard (CSV)'}
          </button>
          <button
            type="button"
            className="table-action"
            onClick={() => handleExportCsv('all_referrals')}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export All Referrals (CSV)'}
          </button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {/* Summary Cards */}
      <div className="referrals-grid">
        <div className="referral-stat-box">
          <span className="referral-stat-box__label">Total Referrers</span>
          <strong className="referral-stat-box__value">{data?.summary?.totalReferrers || 0}</strong>
          <span className="referral-stat-box__sub">
            {data?.summary?.clubMembersCount || 0} club · {data?.summary?.miraiStudentsCount || 0} mirai
          </span>
        </div>

        <div className="referral-stat-box">
          <span className="referral-stat-box__label">Active Referrers</span>
          <strong className="referral-stat-box__value" style={{ color: '#c6f24e' }}>
            {data?.summary?.activeReferrers || 0}
          </strong>
          <span className="referral-stat-box__sub">
            {data?.summary?.deactivatedReferrers || 0} deactivated
          </span>
        </div>

        <div className="referral-stat-box">
          <span className="referral-stat-box__label">Confirmed Referrals</span>
          <strong className="referral-stat-box__value" style={{ color: '#c6f24e' }}>
            {data?.summary?.totalReferrals?.confirmed || 0}
          </strong>
          <span className="referral-stat-box__sub">
            {data?.summary?.totalReferrals?.pending || 0} pending · {data?.summary?.totalReferrals?.reversed || 0} reversed
          </span>
        </div>

        <div className="referral-stat-box">
          <span className="referral-stat-box__label">Referral Conversion</span>
          <strong className="referral-stat-box__value" style={{ color: '#ff9a4d' }}>
            {data?.summary?.conversionRate || '0.0%'}
          </strong>
          <span className="referral-stat-box__sub">
            {data?.summary?.confirmedTeamsFromReferrals || 0} of {data?.summary?.totalPaidRegistrations || 0} confirmed teams
          </span>
        </div>
      </div>

      {/* Filter Tools */}
      <div className="table-tools" style={{ marginTop: '24px' }}>
        <input
          type="search"
          placeholder="Search by name, email, phone, or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Referrer Types</option>
            <option value="club_member">Vulcan Club Members</option>
            <option value="mirai_student">Mirai Students</option>
            <option value="both">Club Member & Mirai</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="table-wrap" style={{ marginTop: '12px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Rank</th>
              <th>Referrer</th>
              <th>Referral Code</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Confirmed</th>
              <th style={{ textAlign: 'right' }}>Pending</th>
              <th style={{ textAlign: 'right' }}>Reversed</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Earliest Confirmed</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px' }}>Loading referral leaderboard…</td></tr>
            ) : filteredLeaderboard.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#777' }}>No referrers found matching your filters.</td></tr>
            ) : (
              filteredLeaderboard.map((ref) => {
                const rankClass = ref.rank <= 3 ? `rank-badge--${ref.rank}` : '';
                return (
                  <tr key={ref.id} style={{ opacity: ref.active ? 1 : 0.6 }}>
                    <td>
                      <span className={`rank-badge ${rankClass}`}>{ref.rank}</span>
                    </td>
                    <td>
                      <strong>{ref.name}</strong>
                      <span className="muted-text" style={{ fontSize: '11px', display: 'block' }}>{ref.email}</span>
                      {ref.phone && <span className="muted-text" style={{ fontSize: '11px', display: 'block' }}>{ref.phone}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <code className="code-display">{ref.code}</code>
                        <CopyButton text={ref.code} />
                      </div>
                    </td>
                    <td>
                      <span className={`type-pill ${ref.type === 'both' ? 'type-pill--both' : ref.type === 'club_member' ? 'type-pill--club' : 'type-pill--mirai'}`}>
                        {ref.type === 'both' ? 'Club & Mirai' : ref.type === 'club_member' ? 'Club Member' : 'Mirai Student'}
                      </span>
                    </td>
                    <td>
                      <span className={`status ${ref.active ? 'status--paid' : 'status--rejected'}`}>
                        {ref.active ? 'Active' : 'Deactivated'}
                      </span>
                      {ref.deactivatedReason && (
                        <small className="reject-inline" style={{ display: 'block', maxWidth: '160px' }}>
                          {ref.deactivatedReason}
                        </small>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#c6f24e', fontSize: '15px' }}>
                      {ref.confirmedCount}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ffbd80' }}>
                      {ref.pendingCount}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ff9aa0' }}>
                      {ref.reversedCount}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {ref.totalCount}
                    </td>
                    <td style={{ fontSize: '11px', color: '#888' }}>
                      {formatDate(ref.earliestConfirmedAt)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setDrilldownReferrerId(ref.id)}
                          title="View all teams referred by this person"
                        >
                          Teams ({ref.totalCount})
                        </button>
                        {ref.active ? (
                          <button
                            type="button"
                            className="table-action table-action--danger"
                            onClick={() => setDeactivatingReferrer(ref)}
                            title="Deactivate this referral code"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="table-action"
                            style={{ color: '#c6f24e' }}
                            onClick={() => handleToggleReactivate(ref)}
                            title="Reactivate this referral code"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setReissuingReferrer(ref)}
                          title="Generate a new referral code for this person"
                        >
                          Reissue
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddClubMemberModal
          onClose={() => setShowAddModal(false)}
          onAdded={(msg) => {
            setNotice(msg);
            loadData();
            onActionComplete();
          }}
        />
      )}

      {showImportModal && (
        <ImportClubMembersModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            loadData();
            onActionComplete();
          }}
        />
      )}

      {drilldownReferrerId && (
        <ReferralDrilldownModal
          referrerId={drilldownReferrerId}
          onClose={() => setDrilldownReferrerId(null)}
          onActionComplete={() => {
            loadData();
            onActionComplete();
          }}
        />
      )}

      {deactivatingReferrer && (
        <DeactivateReferrerModal
          referrer={deactivatingReferrer}
          onClose={() => setDeactivatingReferrer(null)}
          onUpdated={(msg) => {
            setNotice(msg);
            loadData();
            onActionComplete();
          }}
        />
      )}

      {reissuingReferrer && (
        <ReissueCodeModal
          referrer={reissuingReferrer}
          onClose={() => setReissuingReferrer(null)}
          onUpdated={(msg) => {
            setNotice(msg);
            loadData();
            onActionComplete();
          }}
        />
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Main App Component with Tabs
// -------------------------------------------------------------
export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({});
  const [totals, setTotals] = useState({});
  const [referralSummary, setReferralSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [emailModalItem, setEmailModalItem] = useState(null);
  const [emailModalType, setEmailModalType] = useState('confirmed');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api(
        `registrations?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`
      );
      setRegistrations(result.registrations || []);
      setStats(result.stats || {});
      setTotals(result.totals || {});
      setLoadError('');

      api('referrals-admin')
        .then((refRes) => setReferralSummary(refRes.summary))
        .catch(() => {});
    } catch (error) {
      setLoadError(error.message);
    }
  }, [search, status]);

  useEffect(() => {
    api('session')
      .then((res) => {
        setAuthenticated(res.authenticated);
        if (res.authenticated) {
          setAdminUser({ email: res.email, role: res.role });
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (authenticated) {
      const timer = window.setTimeout(load, 150);
      return () => window.clearTimeout(timer);
    }
  }, [authenticated, load]);

  // Sync hash with tab
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (['dashboard', 'payments', 'tickets', 'checkin', 'admitted', 'reminders', 'teams', 'coupons', 'referrals', 'settings'].includes(h)) {
        setTab(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const changeTab = (nextTab, nextStatus = '') => {
    setTab(nextTab);
    setMobileDrawerOpen(false);
    window.location.hash = nextTab;
    if (nextStatus !== undefined) setStatus(nextStatus);
  };

  const logout = async () => {
    await api('auth-logout', { method: 'POST' });
    setAuthenticated(false);
    setAdminUser(null);
  };

  const openEmailModal = (reg, type = 'confirmed') => {
    setEmailModalItem(reg);
    setEmailModalType(type);
  };

  if (authenticated === null) return <main className="loading">Loading operations console…</main>;
  if (!authenticated) return <Login onSignedIn={() => setAuthenticated(true)} />;

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar (Desktop fixed, Mobile slide-over drawer) */}
      <aside className={mobileDrawerOpen ? 'mobile-drawer-open' : ''}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo />
          {mobileDrawerOpen && (
            <button
              type="button"
              className="quiet"
              onClick={() => setMobileDrawerOpen(false)}
              style={{ minHeight: '32px', padding: '0 10px', fontSize: '13px' }}
            >
              ✕ Close
            </button>
          )}
        </div>

        <nav aria-label="Operations navigation">
          <a
            href="#dashboard"
            className={tab === 'dashboard' ? 'is-active' : ''}
            onClick={() => changeTab('dashboard')}
          >
            Dashboard
          </a>
          <a
            href="#checkin"
            className={tab === 'checkin' ? 'is-active' : ''}
            onClick={() => changeTab('checkin')}
            style={{ fontWeight: tab === 'checkin' ? 700 : 500 }}
          >
            📷 Door check-in
          </a>
          <a
            href="#admitted"
            className={tab === 'admitted' ? 'is-active' : ''}
            onClick={() => changeTab('admitted')}
          >
            ✓ Admitted roster <span>{stats.checkedIn || 0}</span>
          </a>
          <a
            href="#reminders"
            className={tab === 'reminders' ? 'is-active' : ''}
            onClick={() => changeTab('reminders')}
          >
            📢 Reminders & Rules <span>{totals.PAID || 0}</span>
          </a>
          <a
            href="#payments"
            className={tab === 'payments' ? 'is-active' : ''}
            onClick={() => changeTab('payments')}
          >
            Payments <span>{totals.PENDING_REVIEW || 0}</span>
          </a>
          <a
            href="#tickets"
            className={tab === 'tickets' ? 'is-active' : ''}
            onClick={() => changeTab('tickets')}
          >
            Tickets <span>{totals.PAID || 0}</span>
          </a>
          <a
            href="#teams"
            className={tab === 'teams' ? 'is-active' : ''}
            onClick={() => changeTab('teams')}
          >
            All teams <span>{registrations.length}</span>
          </a>
          <a
            href="#coupons"
            className={tab === 'coupons' ? 'is-active' : ''}
            onClick={() => changeTab('coupons')}
          >
            Coupons <span>{stats.couponTeamsCount || 0}</span>
          </a>
          <a
            href="#referrals"
            className={tab === 'referrals' ? 'is-active' : ''}
            onClick={() => changeTab('referrals')}
          >
            Referrals <span>{referralSummary?.totalReferrals?.confirmed || 0}</span>
          </a>
          <a
            href="#settings"
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => changeTab('settings')}
          >
            Settings
          </a>
        </nav>

        <div className="aside-footer">
          {adminUser?.email && <small className="admin-badge">{adminUser.email}</small>}
          <button className="logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Sticky Header with Mobile Menu Button & Live Gate Pill */}
      <header>
        <div className="header-left">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>
          <span style={{ fontWeight: 600, color: '#fff' }}>Hack-O-Lantern</span>
        </div>
        <div className="header-right">
          <span
            className="live-gate-pill"
            onClick={() => changeTab('admitted')}
            title="Click to view gate admitted teams"
          >
            <span className="live-dot" /> Admitted: <b>{stats.checkedIn || 0}</b> / {totals.PAID || 0}
          </span>
        </div>
      </header>

      <main className="workspace">
        <div className="page-title">
          <div>
            <h1>Event Operations</h1>
            <p>Real-time payments, ticketing, manual email dispatch, and gate check-in desk.</p>
          </div>
          <div className="counts">
            <span><b>{totals.PENDING_REVIEW || 0}</b> awaiting review</span>
            <span><b>{totals.PAID || 0}</b> tickets issued</span>
            <span><b style={{ color: '#c6f24e' }}>{stats.checkedIn || 0}</b> admitted</span>
          </div>
        </div>

        {loadError && <p className="form-error" role="alert">{loadError}</p>}

        {tab === 'dashboard' && <Dashboard stats={stats} referralSummary={referralSummary} onNavigate={changeTab} />}
        {tab === 'checkin' && <TicketScan onCheckedIn={load} onNavigate={changeTab} />}
        {tab === 'admitted' && (
          <AdmittedView
            registrations={registrations}
            onActionComplete={load}
            onNavigate={changeTab}
          />
        )}
        {tab === 'reminders' && (
          <RemindersView
            registrations={registrations}
            onActionComplete={load}
            onOpenEmail={openEmailModal}
          />
        )}
        {tab === 'payments' && (
          <PaymentQueue
            registrations={registrations}
            onActionComplete={load}
            onOpenEmail={openEmailModal}
          />
        )}
        {tab === 'tickets' && (
          <TicketsList
            registrations={registrations}
            onActionComplete={load}
            onOpenEmail={openEmailModal}
          />
        )}
        {tab === 'teams' && (
          <RegistrationTable
            registrations={registrations}
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            onActionComplete={load}
            onOpenEmail={openEmailModal}
          />
        )}
        {tab === 'coupons' && <CouponsView onActionComplete={load} />}
        {tab === 'referrals' && <ReferralsView onActionComplete={load} />}
        {tab === 'settings' && <SettingsView onActionComplete={load} />}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-item mobile-nav-item--checkin ${tab === 'checkin' ? 'is-active' : ''}`}
          onClick={() => changeTab('checkin')}
        >
          <span className="mobile-nav-icon">📷</span>
          <span>Check-in</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${tab === 'admitted' ? 'is-active' : ''}`}
          onClick={() => changeTab('admitted')}
        >
          <span className="mobile-nav-icon">✓</span>
          <span>Admitted</span>
          {Boolean(stats.checkedIn) && (
            <span className="mobile-nav-badge mobile-nav-badge--green">{stats.checkedIn}</span>
          )}
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${tab === 'reminders' ? 'is-active' : ''}`}
          onClick={() => changeTab('reminders')}
        >
          <span className="mobile-nav-icon">📢</span>
          <span>Reminders</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${tab === 'teams' ? 'is-active' : ''}`}
          onClick={() => changeTab('teams')}
        >
          <span className="mobile-nav-icon">👥</span>
          <span>Teams</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${['dashboard', 'payments', 'tickets', 'coupons', 'referrals', 'settings'].includes(tab) ? 'is-active' : ''}`}
          onClick={() => setMobileDrawerOpen(true)}
        >
          <span className="mobile-nav-icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* Manual Email Modal */}
      {emailModalItem && (
        <ManualEmailModal
          registration={emailModalItem}
          initialType={emailModalType}
          onClose={() => setEmailModalItem(null)}
          onActionComplete={load}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
