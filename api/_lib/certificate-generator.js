import QRCode from 'qrcode';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function generateCertificateId(teamId, position = 1) {
  const cleanTeam = String(teamId || 'TEAM').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const pos = String(position).padStart(2, '0');
  return `HOL26-PART-${cleanTeam}-${pos}`;
}

/**
 * Generates an ultra-crisp, printable vector SVG for the Hack-O-Lantern 2026 Participation Certificate.
 * Standard A4 Landscape Aspect Ratio (1120 x 792).
 */
export async function generateCertificateSvg({
  certificateId,
  participantName,
  collegeName,
  teamName,
  teamId,
  trackName,
  issueDate = 'November 1, 2026',
}) {
  const certId = certificateId || generateCertificateId(teamId, 1);
  const verifyUrl = `https://www.vulcanclub.in/certificate/${certId}`;

  // Generate QR code data URL (embedded as image inside SVG)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 140,
    color: {
      dark: '#ff8522',
      light: '#0c0a12',
    },
  });

  const name = escapeHtml(participantName || 'Participant Name');
  const college = escapeHtml(collegeName || 'Mirai School of Technology');
  const team = escapeHtml(teamName || 'Team');
  const tid = escapeHtml(teamId || 'VHK-XXXX');
  const track = escapeHtml(trackName || 'Open Innovation & Systems');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 792" width="100%" height="100%" style="background:#07060a; font-family:'Cinzel', 'Georgia', -apple-system, serif;">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#1c1228" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="#100b18" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#07060a" stop-opacity="1"/>
    </radialGradient>

    <!-- Pumpkin Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe299"/>
      <stop offset="30%" stop-color="#ff9a3c"/>
      <stop offset="70%" stop-color="#ff7a1a"/>
      <stop offset="100%" stop-color="#c85600"/>
    </linearGradient>

    <!-- Metallic Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffb86c"/>
      <stop offset="25%" stop-color="#e06000"/>
      <stop offset="50%" stop-color="#ffe6a3"/>
      <stop offset="75%" stop-color="#e06000"/>
      <stop offset="100%" stop-color="#ff8e30"/>
    </linearGradient>

    <!-- Purple Nebula Accent -->
    <radialGradient id="purpleNebula" cx="15%" cy="85%" r="35%">
      <stop offset="0%" stop-color="#7928ca" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#07060a" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="orangeNebula" cx="85%" cy="15%" r="40%">
      <stop offset="0%" stop-color="#ff7a1a" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#07060a" stop-opacity="0"/>
    </radialGradient>

    <!-- Glow Filter -->
    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- 1. Background Fill & Atmospheric Glows -->
  <rect width="1120" height="792" fill="url(#bgGlow)"/>
  <rect width="1120" height="792" fill="url(#purpleNebula)"/>
  <rect width="1120" height="792" fill="url(#orangeNebula)"/>

  <!-- Watermark: Subtle Jack-O-Lantern & Constellation in Background Center -->
  <g opacity="0.04" transform="translate(460, 270) scale(1.4)">
    <circle cx="70" cy="70" r="65" fill="#ff7a1a"/>
    <path d="M40 55 L55 35 L70 55 Z M70 55 L85 35 L100 55 Z" fill="#000"/>
    <polygon points="70,65 62,80 78,80" fill="#000"/>
    <path d="M35 90 Q70 120 105 90 Q90 105 70 105 Q50 105 35 90 Z" fill="#000"/>
    <path d="M66 5 Q70 -10 82 -12 Q78 -5 74 5 Z" fill="#ff7a1a"/>
  </g>

  <!-- 2. Outer Ornate Border -->
  <rect x="28" y="28" width="1064" height="736" rx="8" fill="none" stroke="url(#borderGrad)" stroke-width="2.5" opacity="0.85"/>
  <rect x="36" y="36" width="1048" height="720" rx="6" fill="none" stroke="#ff7a1a" stroke-width="0.75" stroke-dasharray="4, 4" opacity="0.4"/>
  <rect x="46" y="46" width="1028" height="700" rx="4" fill="none" stroke="url(#borderGrad)" stroke-width="1.2" opacity="0.65"/>

  <!-- Corner Flourishes (Top-Left, Top-Right, Bottom-Left, Bottom-Right) -->
  <!-- Top-Left -->
  <g transform="translate(28, 28)" stroke="url(#goldGrad)" fill="none" stroke-width="1.5">
    <path d="M0,40 L0,12 Q0,0 12,0 L40,0"/>
    <circle cx="16" cy="16" r="3" fill="#ff9a3c"/>
    <path d="M6,6 L26,26"/>
    <path d="M0,24 Q24,24 24,0"/>
  </g>
  <!-- Top-Right -->
  <g transform="translate(1092, 28) scale(-1, 1)" stroke="url(#goldGrad)" fill="none" stroke-width="1.5">
    <path d="M0,40 L0,12 Q0,0 12,0 L40,0"/>
    <circle cx="16" cy="16" r="3" fill="#ff9a3c"/>
    <path d="M6,6 L26,26"/>
    <path d="M0,24 Q24,24 24,0"/>
  </g>
  <!-- Bottom-Left -->
  <g transform="translate(28, 764) scale(1, -1)" stroke="url(#goldGrad)" fill="none" stroke-width="1.5">
    <path d="M0,40 L0,12 Q0,0 12,0 L40,0"/>
    <circle cx="16" cy="16" r="3" fill="#ff9a3c"/>
    <path d="M6,6 L26,26"/>
    <path d="M0,24 Q24,24 24,0"/>
  </g>
  <!-- Bottom-Right -->
  <g transform="translate(1092, 764) scale(-1, -1)" stroke="url(#goldGrad)" fill="none" stroke-width="1.5">
    <path d="M0,40 L0,12 Q0,0 12,0 L40,0"/>
    <circle cx="16" cy="16" r="3" fill="#ff9a3c"/>
    <path d="M6,6 L26,26"/>
    <path d="M0,24 Q24,24 24,0"/>
  </g>

  <!-- 3. Top Organization & Event Banner -->
  <g transform="translate(560, 95)" text-anchor="middle">
    <!-- Mini Brand Crest -->
    <g transform="translate(0, 0)">
      <circle cx="0" cy="0" r="18" fill="#140f1c" stroke="#ff7a1a" stroke-width="1.5"/>
      <text x="0" y="6" font-size="14" font-weight="900" fill="#ff7a1a" font-family="'Cinzel', Georgia, serif">&#123;V&#125;</text>
    </g>

    <!-- Subtitle Banner -->
    <text x="0" y="32" font-size="11" font-weight="700" fill="#d89e68" letter-spacing="4" text-transform="uppercase">
      VULCAN CLUB &amp; MIRAI SCHOOL OF TECHNOLOGY
    </text>
    <text x="0" y="48" font-size="9" font-weight="600" fill="#8c7a9c" letter-spacing="2" text-transform="uppercase">
      OCTOBER 31 – NOVEMBER 1, 2026 • BENGALURU
    </text>
  </g>

  <!-- 4. Certificate Header -->
  <g transform="translate(560, 200)" text-anchor="middle">
    <text x="0" y="0" font-size="34" font-weight="900" fill="url(#goldGrad)" letter-spacing="6" filter="url(#subtleGlow)">
      CERTIFICATE OF PARTICIPATION
    </text>
    <line x1="-160" y1="16" x2="160" y2="16" stroke="url(#goldGrad)" stroke-width="1.2" opacity="0.8"/>
    <circle cx="0" cy="16" r="4" fill="#ff9a3c"/>
    <circle cx="-160" cy="16" r="2.5" fill="#ff7a1a"/>
    <circle cx="160" cy="16" r="2.5" fill="#ff7a1a"/>
  </g>

  <!-- 5. Conferred Upon Section -->
  <g transform="translate(560, 260)" text-anchor="middle">
    <text x="0" y="0" font-size="12" font-weight="500" fill="#a595b3" letter-spacing="3" text-transform="uppercase">
      THIS IS PROUDLY PRESENTED TO
    </text>

    <!-- Recipient Name (Highlight) -->
    <text x="0" y="52" font-size="36" font-weight="800" fill="#ffffff" letter-spacing="1.5" font-family="'Cinzel', 'Georgia', serif">
      ${name}
    </text>

    <!-- Recipient Underline Accent -->
    <path d="M-180,68 Q0,76 180,68" stroke="url(#goldGrad)" stroke-width="1.5" fill="none" opacity="0.9"/>

    <!-- College Name -->
    <text x="0" y="94" font-size="15" font-weight="600" fill="#e8cfa6" letter-spacing="1">
      ${college}
    </text>
  </g>

  <!-- 6. Citation / Achievement Statement -->
  <g transform="translate(560, 410)" text-anchor="middle">
    <text x="0" y="0" font-size="13" font-weight="400" fill="#cfc2db" letter-spacing="0.5">
      for actively participating and demonstrating technical ingenuity, collaboration, and endurance
    </text>
    <text x="0" y="24" font-size="13" font-weight="400" fill="#cfc2db" letter-spacing="0.5">
      in the 16-Hour Overnight Halloween Hackathon
    </text>

    <!-- Event Title Glow -->
    <text x="0" y="60" font-size="22" font-weight="900" fill="url(#goldGrad)" letter-spacing="3">
      HACK-O-LANTERN 2026
    </text>

    <!-- Team & Track Details Pill -->
    <g transform="translate(0, 95)">
      <rect x="-260" y="-18" width="520" height="36" rx="18" fill="#150f21" stroke="#ff7a1a" stroke-width="1" opacity="0.8"/>
      <text x="0" y="5" font-size="12" font-weight="700" fill="#ffffff" letter-spacing="0.5">
        Team: <tspan fill="#ff9a3c">${team}</tspan> • <tspan fill="#d4c0e2">${tid}</tspan>
      </text>
    </g>
  </g>

  <!-- 7. Footer: Official Holographic Verification Seal & Dynamic QR Code (No signatures) -->
  <!-- Flanking Ornamental Accent Lines -->
  <line x1="180" y1="630" x2="470" y2="630" stroke="url(#goldGrad)" stroke-width="1" opacity="0.35"/>
  <circle cx="180" cy="630" r="2.5" fill="#f59e0b" opacity="0.6"/>
  <line x1="650" y1="630" x2="940" y2="630" stroke="url(#goldGrad)" stroke-width="1" opacity="0.35"/>
  <circle cx="940" cy="630" r="2.5" fill="#f59e0b" opacity="0.6"/>

  <!-- Center: Official Holographic Verification Seal & Dynamic QR Code -->
  <g transform="translate(560, 630)" text-anchor="middle">
    <!-- Outer Starburst/Rosette Seal -->
    <circle cx="0" cy="-10" r="50" fill="#171024" stroke="url(#borderGrad)" stroke-width="2"/>
    <circle cx="0" cy="-10" r="44" fill="none" stroke="#ff7a1a" stroke-width="0.75" stroke-dasharray="3, 2"/>

    <!-- Seal Inner QR Code -->
    <image href="${qrDataUrl}" x="-30" y="-40" width="60" height="60"/>

    <!-- Seal Ribbons -->
    <path d="M-18,34 L-30,68 L-14,60 L2,68 L-6,34 Z" fill="#b34900" opacity="0.85"/>
    <path d="M18,34 L6,68 L22,60 L38,68 L26,34 Z" fill="#b34900" opacity="0.85"/>

    <text x="0" y="48" font-size="8.5" font-weight="800" fill="#ff9a3c" letter-spacing="1.2">
      OFFICIAL SEAL
    </text>
    <text x="0" y="61" font-size="7.5" font-weight="700" fill="#8c7a9c" letter-spacing="0.5" font-family="monospace">
      ${certId}
    </text>
  </g>

  <!-- Bottom Verification Footer -->
  <g transform="translate(560, 748)" text-anchor="middle">
    <text x="0" y="0" font-size="8" font-weight="500" fill="#665975" letter-spacing="1">
      VERIFIABLE CERTIFICATE • ISSUED ON ${escapeHtml(issueDate)} • VULCAN CLUB MIRAI CHAPTER
    </text>
  </g>
</svg>`;
}

/**
 * Builds the Halloween-themed HTML email containing the certificate, congratulations message, and download link.
 */
export function buildCertificateEmailHtml({
  participantName,
  teamName,
  teamId,
  certificateId,
  downloadUrl,
}) {
  const pName = escapeHtml(participantName);
  const tName = escapeHtml(teamName);
  const cId = escapeHtml(certificateId);
  const dUrl = escapeHtml(downloadUrl);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Hack-O-Lantern 2026 Certificate</title>
</head>
<body style="margin:0;padding:0;background-color:#07060a;color:#f3edf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
  <div style="max-width:640px;margin:30px auto;background:#100d17;border:1px solid rgba(255,122,26,0.35);border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,0.6);">
    <!-- Header Banner -->
    <div style="background:linear-gradient(135deg, #201333 0%, #100b1a 100%);padding:36px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,122,26,0.2);">
      <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,122,26,0.15);border:1px solid rgba(255,122,26,0.4);color:#ff9a3c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        VULCAN CLUB × MIRAI SCHOOL OF TECHNOLOGY
      </div>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:1px;font-family:Georgia,serif;">
        HACK-O-LANTERN 2026
      </h1>
      <p style="margin:0;color:#ff9a3c;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">
        Official Certificate of Participation
      </p>
    </div>

    <!-- Body Content -->
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:17px;color:#ffffff;">
        Dear <strong>${pName}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#cfc5d8;line-height:1.7;">
        Congratulations on participating in <strong>Hack-O-Lantern 2026</strong>! Through 16 intense overnight hours, your team <strong>${tName}</strong> (<code style="color:#ff9a3c;background:rgba(255,122,26,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;">${escapeHtml(teamId)}</code>) engineered, designed, and presented an incredible hackathon solution.
      </p>
      
      <p style="margin:0 0 24px;font-size:14px;color:#cfc5d8;line-height:1.7;">
        In recognition of your technical skill, collaborative drive, and endurance, the Vulcan Club and Mirai School of Technology have officially conferred your verified Certificate of Participation.
      </p>

      <!-- Certificate Summary Box -->
      <div style="background:#161220;border:1px solid rgba(255,122,26,0.25);border-radius:16px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Recipient</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#ffffff;">${pName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Team Name</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#ff9a3c;">${tName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Team ID</td>
            <td style="padding:6px 0;text-align:right;color:#ffffff;font-family:monospace;">${escapeHtml(teamId)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Certificate ID</td>
            <td style="padding:6px 0;text-align:right;"><code style="color:#c6f24e;font-weight:700;font-family:monospace;">${cId}</code></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Event Dates</td>
            <td style="padding:6px 0;text-align:right;color:#ffffff;">31 Oct – 1 Nov 2026</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8f829d;">Venue</td>
            <td style="padding:6px 0;text-align:right;color:#ffffff;">Mirai Floor, Bengaluru</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${dUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg, #ff7a1a 0%, #e05e00 100%);color:#000000;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(255,122,26,0.35);">
          📜 View &amp; Download Certificate (PDF / SVG)
        </a>
      </div>

      <div style="background:rgba(0,0,0,0.35);border-radius:12px;padding:14px;border:1px dashed rgba(255,122,26,0.25);text-align:center;">
        <p style="margin:0;font-size:12px;color:#a99cb5;">
          Your certificate includes a cryptographic verification QR code that links to the official Vulcan verification ledger. You can add it to your LinkedIn, resume, or portfolio!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0b0910;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;font-size:11px;color:#6b5f77;">
      <p style="margin:0 0 6px;">Hack-O-Lantern 2026 • Organised by Vulcan Club × Mirai School of Technology</p>
      <p style="margin:0;">For any certificate corrections, reach out to <a href="mailto:nexcell_rathinam@msot.org" style="color:#ff9a3c;text-decoration:none;">nexcell_rathinam@msot.org</a></p>
    </div>
  </div>
</body>
</html>`;
}

