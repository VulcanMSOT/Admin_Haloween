import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function api(path, options) {
  return fetch(`/api/${path}`, options).then(async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : {};
    if (!isJson) throw new Error('The secure admin service is not available here. Use the deployed admin URL.');
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  });
}

function Logo() { return <div className="brand"><span className="brand__mark" aria-hidden="true">V</span><span>vulcan <b>operations</b></span></div>; }

function Login({ onSignedIn }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('auth-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }) }); onSignedIn(); }
    catch (nextError) { setError(nextError.message); }
    finally { setBusy(false); }
  };
  return <main className="login"><div className="login__panel"><Logo /><h1>Event operations</h1><p>Hack-O-Lantern · organiser access only</p><form onSubmit={submit}><label htmlFor="passcode">Organiser passcode<input id="passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" autoFocus required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button></form></div></main>;
}

function PaymentQueue({ registrations, onApproved }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const approve = async (registration) => {
    setBusyId(registration.id); setError(''); setNotice('');
    try { const result = await api('approve-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: registration.id }) }); setNotice(result.email?.sent ? 'Payment approved and ticket email sent to the team leader.' : `Payment approved. ${result.email?.error || 'Ticket email needs attention.'}`); onApproved(); }
    catch (nextError) { setError(nextError.message); }
    finally { setBusyId(''); }
  };
  return <section className="queue"><div className="section-head"><div><h2>Payment review</h2><p>Approve only after the UPI reference matches the club account.</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}{registrations.length === 0 ? <p className="empty">No payment references are waiting for review.</p> : <div className="queue__list">{registrations.map((registration) => <article className="queue-row" key={registration.id}><div><strong>{registration.teamName}</strong><span>{registration.members.map((member) => member.fullName).join(' · ')}</span></div><div><span className="row-label">UPI reference</span><code>{registration.paymentReference}</code></div><div><span className="row-label">Submitted</span><time>{formatDate(registration.paymentSubmittedAt)}</time></div><button onClick={() => approve(registration)} disabled={busyId === registration.id}>{busyId === registration.id ? 'Approving…' : 'Approve ₹300'}</button></article>)}</div>}</section>;
}

function TicketScan({ onCheckedIn }) {
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stopScanner = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setScanning(false);
  }, []);
  useEffect(() => stopScanner, [stopScanner]);
  const checkIn = async (candidate) => {
    const clean = String(candidate || ticketId).trim().split('/').pop().toUpperCase();
    if (!clean) { setError('Enter or scan a ticket ID.'); return; }
    stopScanner(); setError(''); setResult(null);
    try { const nextResult = await api('checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: clean }) }); setTicketId(clean); setResult(nextResult); onCheckedIn(); }
    catch (nextError) { setError(nextError.message); }
  };
  const startScanner = async () => {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) { setError('Camera scanning is not available in this browser. Use the ticket ID instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play(); setError(''); setScanning(true);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      timerRef.current = window.setInterval(async () => { const codes = await detector.detect(videoRef.current); if (codes[0]?.rawValue) checkIn(codes[0].rawValue); }, 450);
    } catch { setError('Camera access was not available. Use the ticket ID instead.'); }
  };
  return <section className="checkin"><div className="section-head"><div><h2>Door check-in</h2><p>Scan a paid ticket once, or use its printed ID.</p></div></div><div className="checkin__body"><div className="scan-box"><video ref={videoRef} muted playsInline className={scanning ? 'is-live' : ''} aria-label="Camera preview for ticket scanning" />{!scanning && <p>Camera ready when you are.</p>}<div className="scan-actions">{scanning ? <button className="quiet" onClick={stopScanner}>Stop camera</button> : <button onClick={startScanner}>Use camera</button>}</div></div><form onSubmit={(event) => { event.preventDefault(); checkIn(); }}><label htmlFor="ticket-id">Ticket ID<input id="ticket-id" value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder="VULCAN-XXXX-XXXX" autoCapitalize="characters" /></label><button type="submit">Check in ticket</button></form></div>{error && <p className="form-error" role="alert">{error}</p>}{result && <CheckinResult result={result} />}</section>;
}

function CheckinResult({ result }) {
  const isValid = result.status === 'valid'; const isAlready = result.status === 'already';
  return <div className={`checkin-result ${isValid ? 'valid' : isAlready ? 'already' : 'invalid'}`} role="status"><strong>{isValid ? '✓ Valid — entry recorded' : isAlready ? '• Already checked in' : '× Invalid ticket'}</strong>{result.registration && <><span>{result.registration.teamName}</span><small>{result.registration.members.map((member) => member.fullName).join(' · ')}</small>{isAlready && <small>First entry: {formatDate(result.registration.checkedInAt)}</small>}</>}</div>;
}

function RegistrationTable({ registrations, search, setSearch, status, setStatus, onEmailSent }) {
  const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const resend = async (registration) => { setBusyId(registration.id); setError(''); setNotice(''); try { await api('resend-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: registration.id }) }); setNotice(`Ticket email sent to ${registration.members[0]?.email || 'the team leader'}.`); onEmailSent(); } catch (nextError) { setError(nextError.message); } finally { setBusyId(''); } };
  return <section className="registrations"><div className="section-head"><div><h2>All teams</h2><p>Search team, attendee, college, reference, or ticket ID.</p></div><a className="export" href="/api/export">Export CSV</a></div><div className="table-tools"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search registrations" aria-label="Search registrations" /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter registrations by payment status"><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}{registrations.length === 0 ? <p className="empty">No matching teams.</p> : <div className="table-wrap"><table><thead><tr><th>Team</th><th>Payment</th><th>Reference</th><th>Ticket</th><th>Members and colleges</th><th>Entry</th><th>Email</th></tr></thead><tbody>{registrations.map((registration) => <tr key={registration.id}><td><strong>{registration.teamName}</strong><span>{formatDate(registration.createdAt)}</span></td><td><span className={`status status--${registration.paymentStatus.toLowerCase()}`}>{statusLabels[registration.paymentStatus]}</span></td><td><code>{registration.paymentReference || '—'}</code></td><td><code>{registration.ticketId || '—'}</code></td><td>{registration.members.map((member) => <span className="member" key={member.position}><strong>{member.fullName}</strong><small>{member.college}</small></span>)}</td><td>{registration.checkedInAt ? formatDate(registration.checkedInAt) : '—'}</td><td>{registration.paymentStatus === 'PAID' ? <button className="table-action" onClick={() => resend(registration)} disabled={busyId === registration.id}>{busyId === registration.id ? 'Sending…' : registration.ticketEmailSentAt ? 'Resend' : 'Send ticket'}</button> : '—'}</td></tr>)}</tbody></table></div>}</section>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [totals, setTotals] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    try { const result = await api(`registrations?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`); setRegistrations(result.registrations); setTotals(result.totals); setLoadError(''); }
    catch (error) { setLoadError(error.message); }
  }, [search, status]);
  useEffect(() => { api('session').then((result) => setAuthenticated(result.authenticated)).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { if (authenticated) { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); } }, [authenticated, load]);
  if (authenticated === null) return <main className="loading">Loading operations…</main>;
  if (!authenticated) return <Login onSignedIn={() => setAuthenticated(true)} />;
  const paymentReview = registrations.filter((registration) => registration.paymentStatus === 'PENDING_REVIEW');
  const logout = async () => { await api('auth-logout', { method: 'POST' }); setAuthenticated(false); };
  return <div className="app-shell"><aside><Logo /><nav aria-label="Operations navigation"><a href="#review">Payment review <span>{totals.PENDING_REVIEW || 0}</span></a><a href="#checkin">Door check-in</a><a href="#teams">All teams</a></nav><button className="logout" onClick={logout}>Sign out</button></aside><header><span>Hack-O-Lantern · 30 Oct 2026</span><strong>Mirai Floor</strong></header><main className="workspace"><div className="page-title"><div><h1>Event desk</h1><p>Approve ₹300 UPI payments, then admit teams at the door.</p></div><div className="counts"><span><b>{totals.PENDING_REVIEW || 0}</b> awaiting review</span><span><b>{totals.PAID || 0}</b> tickets issued</span><span><b>{registrations.filter((item) => item.checkedInAt).length}</b> checked in</span></div></div>{loadError && <p className="form-error" role="alert">{loadError}</p>}<div id="review"><PaymentQueue registrations={paymentReview} onApproved={load} /></div><div id="checkin"><TicketScan onCheckedIn={load} /></div><div id="teams"><RegistrationTable registrations={registrations} search={search} setSearch={setSearch} status={status} setStatus={setStatus} onEmailSent={load} /></div></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
