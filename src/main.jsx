import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './styles.css';

const statusLabels = {
  PENDING_PAYMENT: 'Awaiting payment',
  PENDING_REVIEW: 'Review payment',
  PAID: 'Ticket issued',
  REJECTED: 'Payment rejected',
  EXPIRED: 'Expired',
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function api(path, options) {
  return fetch(`/api/${path}`, options).then(async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : {};
    if (!isJson) throw new Error('API route returned non-JSON response.');
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
        body: JSON.stringify({ passcode, email: email.trim() || undefined }),
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
            Organiser email (optional)
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="organiser@msot.org"
              autoComplete="username"
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

      <article className="stat-card" onClick={() => onNavigate('payments')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Awaiting review</span>
        <strong className="stat-card__value stat-card__value--warn">{stats.pendingReview || 0}</strong>
        <span className="stat-card__sub">Pending UTR submissions →</span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('tickets')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Tickets issued</span>
        <strong className="stat-card__value stat-card__value--valid">{stats.confirmed || 0}</strong>
        <span className="stat-card__sub">Confirmed entries →</span>
      </article>

      <article className="stat-card" onClick={() => onNavigate('checkin')} style={{ cursor: 'pointer' }}>
        <span className="stat-card__label">Door check-in</span>
        <strong className="stat-card__value">{stats.checkedIn || 0}</strong>
        <span className="stat-card__sub">Admitted at entrance →</span>
      </article>

      <article className="stat-card">
        <span className="stat-card__label">Total teams registered</span>
        <strong className="stat-card__value">{stats.total || 0}</strong>
        <span className="stat-card__sub">{stats.pendingPayment || 0} unpaid · {stats.rejected || 0} rejected</span>
      </article>
    </div>
  );
}

// -------------------------------------------------------------
// Payments Queue Component (with duplicate UTR & screenshot view)
// -------------------------------------------------------------
function PaymentQueue({ registrations, onActionComplete }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState('');

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
      setNotice(result.message || 'Payment confirmed and ticket email sent.');
      onActionComplete();
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
      setRejectingItem(null);
      setRejectReason('');
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="queue">
      <div className="section-head">
        <div>
          <h2>Payment Review Queue</h2>
          <p>Verify that the 12-digit UTR and amount match club account logs before approving.</p>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {registrations.length === 0 ? (
        <p className="empty">No payment references are currently waiting for review.</p>
      ) : (
        <div className="queue__list">
          {registrations.map((registration) => (
            <article className="queue-row" key={registration.id}>
              <div className="queue-row__team">
                <span className="order-badge">{registration.orderRef || 'NO-REF'}</span>
                <strong>{registration.teamName}</strong>
                <span className="members-inline">
                  {registration.members.map((m) => `${m.fullName} (${m.college})`).join(' · ')}
                </span>
                {registration.duplicateUtr && (
                  <span className="warn-badge">⚠️ Duplicate UTR submitted on multiple teams!</span>
                )}
              </div>

              <div className="queue-row__utr">
                <span className="row-label">12-digit UTR</span>
                <code>{registration.utr || registration.paymentReference}</code>
                <span className="amount-label">Amount: ₹{registration.amount || 300}</span>
              </div>

              <div className="queue-row__proof">
                <span className="row-label">Screenshot</span>
                {registration.screenshotSignedUrl ? (
                  <button
                    type="button"
                    className="proof-thumb-btn"
                    onClick={() => setLightboxUrl(registration.screenshotSignedUrl)}
                  >
                    <img src={registration.screenshotSignedUrl} alt="Receipt proof" />
                    <span>View proof</span>
                  </button>
                ) : (
                  <span className="no-proof">None attached</span>
                )}
              </div>

              <div className="queue-row__time">
                <span className="row-label">Submitted</span>
                <time>{formatDate(registration.paymentSubmittedAt || registration.createdAt)}</time>
              </div>

              <div className="queue-row__actions">
                <button
                  className="btn-approve"
                  onClick={() => approve(registration)}
                  disabled={busyId === registration.id}
                >
                  {busyId === registration.id ? 'Approving…' : 'Confirm & Issue Ticket'}
                </button>
                <button
                  className="btn-reject"
                  onClick={() => {
                    setRejectingItem(registration);
                    setRejectReason('UTR not reflected in club account.');
                  }}
                  disabled={busyId === registration.id}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>Reject payment for {rejectingItem.teamName}</h3>
            <p>The team leader will receive an email with this reason and a link to resubmit their details.</p>
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
// Tickets View Component (Resend, Comp, Revoke, Retry)
// -------------------------------------------------------------
function TicketsList({ registrations, onActionComplete }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revokingItem, setRevokingItem] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [compTeamId, setCompTeamId] = useState('');
  const [compReason, setCompReason] = useState('Organiser invite / sponsor pass');
  const [showCompModal, setShowCompModal] = useState(false);

  const issued = registrations.filter((r) => r.paymentStatus === 'PAID');

  const resend = async (registration) => {
    setBusyId(registration.id);
    setError('');
    setNotice('');
    try {
      const res = await api('resend-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: registration.id }),
      });
      setNotice(res.message || 'Ticket re-sent.');
      onActionComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

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
      setRevokeReason('');
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
      await api('comp-ticket', {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const retryFailed = async () => {
    setBusyId('retry');
    setError('');
    setNotice('');
    try {
      const res = await api('retry-failed-emails', { method: 'POST' });
      setNotice(res.message);
      onActionComplete();
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
          <button className="quiet" onClick={retryFailed} disabled={busyId === 'retry'}>
            {busyId === 'retry' ? 'Retrying…' : 'Retry failed emails'}
          </button>
          <button onClick={() => setShowCompModal(true)}>
            + Issue comp ticket
          </button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}

      {issued.length === 0 ? (
        <p className="empty">No tickets have been confirmed yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Order Ref</th>
                <th>Team & Leader</th>
                <th>Email Status</th>
                <th>Entry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issued.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code className="code--green">{r.ticketId}</code>
                    {r.isComp && <span className="comp-tag">COMP</span>}
                  </td>
                  <td><code>{r.orderRef || '—'}</code></td>
                  <td>
                    <strong>{r.teamName}</strong>
                    <span className="muted-text">{r.members[0]?.email}</span>
                  </td>
                  <td>
                    <span className={`email-badge email-badge--${r.emailStatus || 'pending'}`}>
                      {r.emailStatus || 'pending'} ({r.emailSentCount || 0} sent)
                    </span>
                  </td>
                  <td>
                    {r.checkedInAt ? (
                      <span className="checked-badge">✓ Admitted {new Date(r.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <span className="muted-text">Not checked in</span>
                    )}
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="table-action"
                        onClick={() => resend(r)}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? 'Sending…' : 'Resend'}
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
        <div className="modal-backdrop">
          <div className="modal-content">
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
        <div className="modal-backdrop">
          <div className="modal-content">
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
                        {r.teamName} ({r.orderRef || r.id}) - {statusLabels[r.paymentStatus]}
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
      (err) => {
        // Continuous scanning errors are normal while frame does not contain a QR
      }
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
          <p>Scan attendee QR pass or enter their Ticket ID / Order Ref.</p>
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
            Ticket ID / Token / Order Ref
            <input
              id="ticket-id"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. VULCAN-XXXX-XXXX or VLC-XXXXXX"
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
          <p>Order: <code>{result.registration.orderRef || '—'}</code> · Ticket: <code>{result.registration.ticketId}</code></p>
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
// Registrations Table & Attendee Editor Component
// -------------------------------------------------------------
function RegistrationTable({ registrations, search, setSearch, status, setStatus, onActionComplete }) {
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ fullName: '', college: '', email: '', phone: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [notice, setNotice] = useState('');

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

  return (
    <section className="registrations">
      <div className="section-head">
        <div>
          <h2>All Teams ({registrations.length})</h2>
          <p>Search team, attendee, college, reference, UTR, or ticket ID.</p>
        </div>
        <a className="export" href="/api/export">Export CSV ↗</a>
      </div>

      <div className="table-tools">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registrations…"
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
                <th>Order Ref</th>
                <th>Team</th>
                <th>Status</th>
                <th>UTR Reference</th>
                <th>Ticket ID</th>
                <th>Members & Colleges</th>
                <th>Entry</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.orderRef || '—'}</code></td>
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
                  <td>{r.checkedInAt ? formatDate(r.checkedInAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Attendee Modal */}
      {editingMember && (
        <div className="modal-backdrop">
          <div className="modal-content">
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
      if (['dashboard', 'payments', 'tickets', 'checkin', 'teams'].includes(h)) {
        setTab(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    window.location.hash = nextTab;
  };

  const logout = async () => {
    await api('auth-logout', { method: 'POST' });
    setAuthenticated(false);
    setAdminUser(null);
  };

  if (authenticated === null) return <main className="loading">Loading operations console…</main>;
  if (!authenticated) return <Login onSignedIn={() => setAuthenticated(true)} />;

  const paymentReview = registrations.filter((r) => r.paymentStatus === 'PENDING_REVIEW');

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
            Payment review <span>{totals.PENDING_REVIEW || 0}</span>
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
            <p>Real-time payments, ticketing, and gate check-in desk.</p>
          </div>
          <div className="counts">
            <span><b>{totals.PENDING_REVIEW || 0}</b> awaiting review</span>
            <span><b>{totals.PAID || 0}</b> tickets issued</span>
            <span><b>{stats.checkedIn || 0}</b> checked in</span>
          </div>
        </div>

        {loadError && <p className="form-error" role="alert">{loadError}</p>}

        {tab === 'dashboard' && <Dashboard stats={stats} onNavigate={changeTab} />}
        {tab === 'payments' && <PaymentQueue registrations={paymentReview} onActionComplete={load} />}
        {tab === 'tickets' && <TicketsList registrations={registrations} onActionComplete={load} />}
        {tab === 'checkin' && <TicketScan onCheckedIn={load} />}
        {tab === 'teams' && (
          <RegistrationTable
            registrations={registrations}
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            onActionComplete={load}
          />
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
