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

const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://vulcan-club.vercel.app';

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

  if (templateType === 'confirmed') {
    subject = `Hack-O-Lantern Ticket Confirmed · Team ${teamId}`;
    body = `Hi ${leader.fullName || 'Team Leader'},

Great news! Your payment for Hack-O-Lantern (12-Hour Overnight Hackathon) has been verified and confirmed.

Team Name: ${teamName}
Team ID: ${teamId}
Payment Reference: ${paymentRef}
Official Ticket ID: ${ticketId}

Event Schedule: Night of 31 October 2026, 7:00 PM – 1 November 2026, 7:00 AM (12 Hours)
Venue: Mirai Floor, Bengaluru

View and download your official entry pass & ticket QR code here:
${ticketLookupUrl}

(On the page, click "Already registered? Check status" and enter your Team ID ${teamId} and this email address).

Show your ticket QR code at the entrance check-in desk for admission. Keep this email handy!

Best regards,
Vulcan Club Organizing Team
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

If you have already transferred the ₹300, please upload a clear screenshot of the completed transfer so we can approve it promptly.

Best regards,
Vulcan Club Organizing Team
Sender: nexcell_rathinam@msot.org`;
  } else {
    subject = `Reminder: Complete your Hack-O-Lantern Registration · Team ${teamId}`;
    body = `Hi ${leader.fullName || 'Team Leader'},

This is a reminder from Vulcan Club regarding your team "${teamName}" (${teamId}).

Your registration is currently awaiting UPI payment (₹300 for team of 3).
To confirm your slots before capacity fills, please open the event portal and enter your 12-digit UTR reference:
${ticketLookupUrl}

Team ID: ${teamId}
Payment Reference: ${paymentRef}

Best regards,
Vulcan Club Organizing Team
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
      await api('mark-email-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: registration.id }),
      });
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
            General Reminder
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
function Dashboard({ stats, onNavigate }) {
  return (
    <div className="dashboard-grid">
      <article className="stat-card stat-card--accent">
        <span className="stat-card__label">Confirmed revenue</span>
        <strong className="stat-card__value">₹{stats.revenue?.toLocaleString('en-IN') || 0}</strong>
        <span className="stat-card__sub">{stats.confirmed || 0} teams confirmed @ ₹300</span>
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

      <article className="stat-card" onClick={() => onNavigate('checkin')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Door check-in</span>
        <strong className="stat-card__value">{stats.checkedIn || 0}</strong>
        <span className="stat-card__sub">Admitted at gate →</span>
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
// Payments Queue Component
// -------------------------------------------------------------
function PaymentQueue({ registrations, onActionComplete, onOpenEmail }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('UTR not found in club bank account statement.');
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [filterMode, setFilterMode] = useState('review'); // 'review' | 'all' | 'unpaid' | 'not_sent'

  const approve = async (registration) => {
    setBusyId(registration.id);
    setError('');
    setNotice('');
    try {
      const result = await api('approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: registration.id }),
      });
      setNotice(result.message || 'Payment confirmed and ticket generated.');
      onActionComplete();
      // Prompt admin to send confirmation email
      onOpenEmail(result.registration || registration, 'confirmed');
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
    if (filterMode === 'review') return r.paymentStatus === 'PENDING_REVIEW';
    if (filterMode === 'unpaid') return r.paymentStatus === 'PENDING_PAYMENT';
    if (filterMode === 'not_sent') return r.paymentStatus === 'PAID' && r.emailStatus !== 'sent';
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
          className={`chip-btn ${filterMode === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilterMode('all')}
        >
          All Payments ({registrations.length})
        </button>
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
                {r.duplicateUtr && (
                  <span className="warn-badge">⚠️ Duplicate UTR submitted on multiple teams!</span>
                )}
                {r.amount !== 300 && (
                  <span className="warn-badge">⚠️ Amount mismatch: ₹{r.amount} (expected ₹300)</span>
                )}
              </div>

              <div className="queue-row__utr">
                <span className="row-label">12-digit UTR</span>
                <code>{r.utr || <span className="muted-text">None submitted</span>}</code>
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
                    onClick={() => approve(r)}
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
              </div>
            </article>
          ))}
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
    </section>
  );
}

// -------------------------------------------------------------
// Door Check-in Component (html5-qrcode integration)
// -------------------------------------------------------------
function TicketScan({ onCheckedIn }) {
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);

  const checkIn = async (candidate) => {
    const clean = String(candidate || ticketId).trim();
    if (!clean) {
      setError('Enter or scan a ticket ID.');
      return;
    }
    setError('');
    setResult(null);
    try {
      const nextResult = await api('checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: clean }),
      });
      setTicketId(clean);
      setResult(nextResult);
      onCheckedIn();
    } catch (nextError) {
      setError(nextError.message);
    }
  };

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
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current = html5QrcodeScanner;

    html5QrcodeScanner.render(
      (decodedText) => {
        checkIn(decodedText);
        html5QrcodeScanner.clear().catch(console.warn);
        setScannerActive(false);
      },
      () => {}
    );

    return () => {
      html5QrcodeScanner.clear().catch(console.warn);
    };
  }, [scannerActive]);

  return (
    <section className="checkin">
      <div className="section-head">
        <div>
          <h2>Door Check-in Desk</h2>
          <p>Scan attendee QR pass or enter their Team ID / Ticket Token.</p>
        </div>
      </div>

      <div className="checkin__body">
        <div className="scan-box">
          {scannerActive ? (
            <div id="qr-reader" style={{ width: '100%', maxWidth: '400px' }} />
          ) : (
            <div className="scan-box__idle">
              <span className="scan-box__icon">📷</span>
              <p>Camera ready for gate check-in</p>
              <button onClick={() => setScannerActive(true)}>Start camera scanner</button>
            </div>
          )}
          {scannerActive && (
            <button className="quiet" onClick={() => setScannerActive(false)}>Stop camera</button>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); checkIn(); }}>
          <label htmlFor="ticket-id">
            Team ID / Ticket Token / Ticket ID
            <input
              id="ticket-id"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. VHK-1001 or VULCAN-XXXX-XXXX"
              autoCapitalize="characters"
            />
          </label>
          <button type="submit">Verify & Check in</button>
        </form>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <CheckinResult result={result} />}
    </section>
  );
}

function CheckinResult({ result }) {
  const isValid = result.status === 'valid';
  const isAlready = result.status === 'already';
  const isInvalid = result.status === 'invalid';

  return (
    <div className={`checkin-result ${isValid ? 'valid' : isAlready ? 'already' : 'invalid'}`} role="status">
      <div className="checkin-result__header">
        <strong>
          {isValid && '✓ VALID — ENTRY RECORDED'}
          {isAlready && '• ALREADY CHECKED IN'}
          {isInvalid && '× INVALID TICKET'}
        </strong>
        <span>{result.message}</span>
      </div>

      {result.registration && (
        <div className="checkin-result__details">
          <h3>{result.registration.teamName}</h3>
          <p>
            Team ID: <code>{result.registration.teamId || result.registration.orderRef}</code> ·
            Ticket: <code>{result.registration.ticketId}</code>
          </p>
          <ul className="checkin-members">
            {result.registration.members.map((m) => (
              <li key={m.id || m.position}>
                <strong>{m.fullName}</strong>
                <small>{m.college}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
                  </td>
                  <td>
                    <span className={`status status--${r.paymentStatus.toLowerCase()}`}>
                      {statusLabels[r.paymentStatus]}
                    </span>
                    {r.rejectReason && <small className="reject-inline">{r.rejectReason}</small>}
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
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => onOpenEmail(r, r.paymentStatus === 'PAID' ? 'confirmed' : 'reminder')}
                    >
                      ✉ Email
                    </button>
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
                value={settings?.eventDate || '31 Oct 2026, 7:00 PM – 1 Nov 2026, 7:00 AM'}
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

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving changes…' : 'Save Event Settings'}
            </button>
          </div>
        </div>
      </form>
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
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({});
  const [totals, setTotals] = useState({});
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
      if (['dashboard', 'payments', 'tickets', 'checkin', 'teams', 'settings'].includes(h)) {
        setTab(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const changeTab = (nextTab, nextStatus = '') => {
    setTab(nextTab);
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
      <aside>
        <Logo />
        <nav aria-label="Operations navigation">
          <a
            href="#dashboard"
            className={tab === 'dashboard' ? 'is-active' : ''}
            onClick={() => changeTab('dashboard')}
          >
            Dashboard
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
            href="#checkin"
            className={tab === 'checkin' ? 'is-active' : ''}
            onClick={() => changeTab('checkin')}
          >
            Door check-in
          </a>
          <a
            href="#teams"
            className={tab === 'teams' ? 'is-active' : ''}
            onClick={() => changeTab('teams')}
          >
            All teams <span>{registrations.length}</span>
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

      <header>
        <span>Hack-O-Lantern · 31 Oct 2026</span>
        <strong>Mirai Floor, Bengaluru</strong>
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
            <span><b>{stats.checkedIn || 0}</b> admitted</span>
          </div>
        </div>

        {loadError && <p className="form-error" role="alert">{loadError}</p>}

        {tab === 'dashboard' && <Dashboard stats={stats} onNavigate={changeTab} />}
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
        {tab === 'checkin' && <TicketScan onCheckedIn={load} />}
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
        {tab === 'settings' && <SettingsView onActionComplete={load} />}
      </main>

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
