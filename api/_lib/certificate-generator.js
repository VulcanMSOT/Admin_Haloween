import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';

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
 * Generates the official vector SVG for Hack-O-Lantern 2026 Participation Certificate.
 * Exactly matches the event certificate layout:
 * - Warm parchment cream canvas (#FAF6EE)
 * - Top-right harvest blood-orange moon with flying bats
 * - Vertical Japanese Katakana title on left margin (ハッカーのランタン)
 * - Dual black & orange borders with bottom-left corner star accents
 * - Vulcan Club brand logo & "MIRAI SCHOOL OF TECHNOLOGY PRESENTS"
 * - "CERTIFICATE OF PARTICIPATION" in bold serif & orange letterspacing
 * - "HACK- 🎃 -LANTERN / A HALLOWEEN OVERNIGHT HACKATHON"
 * - Script "This certificate is proudly presented to"
 * - Participant Name with official underline & citation paragraph
 * - "CODE / CREATE / CELEBRATE"
 * - Official Orange Participant Star Badge (without signatures)
 * - Cryptographic verification QR code
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
    width: 120,
    color: {
      dark: '#1A1A1A',
      light: '#FAF6EE',
    },
  });

  const name = escapeHtml(participantName || 'Participant Name');
  const team = escapeHtml(teamName || 'Team');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 792" width="1120" height="792" style="background:#FAF6EE; aspect-ratio:1120/792; width:100%; height:auto; display:block; font-family:'Cinzel', 'Playfair Display', 'Georgia', serif;">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&amp;family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,700&amp;family=Caveat:wght@600;700&amp;family=Montserrat:wght@500;600;700;800;900&amp;display=swap');
    </style>
  </defs>

  <!-- 1. Background Cream Canvas -->
  <rect width="1120" height="792" fill="#FAF6EE"/>

  <!-- 2. Top-Right Orange Harvest Moon & Bats -->
  <g>
    <circle cx="1020" cy="50" r="140" fill="#FF521B"/>
    <!-- Bat 1 (Upper Left) -->
    <path d="M940,95 Q946,85 956,87 Q951,93 954,98 Q948,96 944,102 Q942,96 940,95 Q938,96 936,102 Q932,96 926,98 Q929,93 924,87 Q934,85 940,95 Z" fill="#1A1A1A"/>
    <!-- Bat 2 (Lower Right) -->
    <path d="M1020,165 Q1025,157 1033,158 Q1029,163 1031,167 Q1026,165 1023,170 Q1021,165 1020,165 Q1019,165 1017,170 Q1014,165 1009,167 Q1011,163 1007,158 Q1015,157 1020,165 Z" fill="#1A1A1A"/>
  </g>

  <!-- 3. Double Outer Border Lines -->
  <!-- Outer Black Frame -->
  <rect x="25" y="25" width="1070" height="742" rx="0" fill="none" stroke="#1A1A1A" stroke-width="1.8"/>
  <!-- Inner Orange Frame -->
  <rect x="36" y="36" width="1048" height="720" rx="0" fill="none" stroke="#FF521B" stroke-width="1.2"/>

  <!-- Bottom-Left Decorative Corner Bracket & Stars -->
  <path d="M22,695 L22,770 L100,770" fill="none" stroke="#FF521B" stroke-width="4.5"/>
  <!-- Two 8-pointed Orange Sparkle Stars -->
  <g transform="translate(112, 736) scale(0.85)" fill="#FF521B">
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"/>
    <polygon points="-8,-8 0,-4 8,-8 4,0 8,8 0,4 -8,8 -4,0"/>
  </g>
  <g transform="translate(132, 746) scale(0.65)" fill="#FF521B">
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"/>
    <polygon points="-8,-8 0,-4 8,-8 4,0 8,8 0,4 -8,8 -4,0"/>
  </g>

  <!-- 4. Left Margin Vertical Japanese Katakana: ハッカーのランタン -->
  <g fill="#FF7A50" font-family="'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif" font-size="15" font-weight="700" text-anchor="middle">
    <text x="58" y="80">ハ</text>
    <text x="58" y="110">ッ</text>
    <text x="58" y="140">カ</text>
    <text x="58" y="170">ー</text>
    <text x="58" y="200">の</text>
    <text x="58" y="230">ラ</text>
    <text x="58" y="260">ン</text>
    <text x="58" y="290">タ</text>
    <text x="58" y="320">ン</text>
  </g>

  <!-- 5. Top Brand Header: Vulcan Club Logo & Presents Rule -->
  <g transform="translate(560, 68)" text-anchor="middle">
    <!-- Vulcan {V} mark: Opening brace { on left, V in center, Closing brace } on right -->
    <!-- Left Opening Brace { -->
    <path d="M-13,-13 Q-20,-13 -20,-5 Q-20,-1 -24,0 Q-20,1 -20,5 Q-20,13 -13,13" fill="none" stroke="#1A1A1A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="-16" cy="-6" r="1.6" fill="#FF521B"/>
    <circle cx="-16" cy="6" r="1.6" fill="#FF521B"/>

    <!-- Center V -->
    <path d="M-7,-10 L0,10 L7,-10" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Right Closing Brace } -->
    <path d="M13,-13 Q20,-13 20,-5 Q20,-1 24,0 Q20,1 20,5 Q20,13 13,13" fill="none" stroke="#1A1A1A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="16" cy="-6" r="1.6" fill="#FF521B"/>
    <circle cx="16" cy="6" r="1.6" fill="#FF521B"/>

    <text x="0" y="28" font-family="'Montserrat', -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1A1A1A" letter-spacing="1.5">vulcan club</text>
  </g>

  <!-- Presents Divider Rule -->
  <g transform="translate(560, 134)" text-anchor="middle">
    <line x1="-250" y1="-4" x2="-175" y2="-4" stroke="#1A1A1A" stroke-width="1"/>
    <text x="0" y="0" font-family="'Montserrat', -apple-system, sans-serif" font-size="10" font-weight="700" fill="#1A1A1A" letter-spacing="3" text-transform="uppercase">MIRAI SCHOOL OF TECHNOLOGY PRESENTS</text>
    <line x1="175" y1="-4" x2="250" y2="-4" stroke="#1A1A1A" stroke-width="1"/>
  </g>

  <!-- 6. Main Certificate Title -->
  <g transform="translate(560, 215)" text-anchor="middle">
    <text x="0" y="0" font-family="'Cinzel', 'Playfair Display', 'Georgia', serif" font-size="56" font-weight="900" fill="#1A1A1A" letter-spacing="2">CERTIFICATE</text>
    <!-- OF PARTICIPATION with flanking orange lines -->
    <line x1="-195" y1="32" x2="-135" y2="32" stroke="#FF521B" stroke-width="1.8"/>
    <text x="0" y="37" font-family="'Montserrat', -apple-system, sans-serif" font-size="12" font-weight="800" fill="#FF521B" letter-spacing="4">OF PARTICIPATION</text>
    <line x1="135" y1="32" x2="195" y2="32" stroke="#FF521B" stroke-width="1.8"/>
  </g>

  <!-- 7. Event Title: HACK- 🎃 -LANTERN -->
  <g transform="translate(560, 312)" text-anchor="middle">
    <text x="-28" y="0" font-family="'Cinzel', 'Playfair Display', serif" font-size="32" font-weight="900" fill="#1A1A1A" letter-spacing="1.5" text-anchor="end">HACK-</text>
    
    <!-- Cute Carved Pumpkin at Center -->
    <g transform="translate(0, -10)">
      <ellipse cx="0" cy="0" rx="16" ry="14" fill="#FF521B"/>
      <ellipse cx="-8" cy="0" rx="10" ry="13.5" fill="#FF6B3D"/>
      <ellipse cx="8" cy="0" rx="10" ry="13.5" fill="#FF6B3D"/>
      <ellipse cx="0" cy="0" rx="7" ry="14" fill="#FF7D54"/>
      <!-- Stem -->
      <path d="M-1,-12 Q-2,-18 3,-19 Q2,-14 1,-12 Z" fill="#65a30d"/>
      <!-- Carved Eyes -->
      <polygon points="-7,-4 -2,-3 -5,1" fill="#1A1A1A"/>
      <polygon points="7,-4 2,-3 5,1" fill="#1A1A1A"/>
      <!-- Nose -->
      <polygon points="0,-1 -2,2 2,2" fill="#1A1A1A"/>
      <!-- Sawtooth Smile -->
      <path d="M-10,5 L-7,4 L-5,7 L-2,4 L0,7 L2,4 L5,7 L7,4 L10,5 Q7,11 0,11 Q-7,11 -10,5 Z" fill="#1A1A1A"/>
    </g>

    <text x="28" y="0" font-family="'Cinzel', 'Playfair Display', serif" font-size="32" font-weight="900" fill="#1A1A1A" letter-spacing="1.5" text-anchor="start">-LANTERN</text>

    <!-- Subtitle -->
    <text x="0" y="26" font-family="'Montserrat', -apple-system, sans-serif" font-size="10" font-weight="700" fill="#1A1A1A" letter-spacing="3.5">A HALLOWEEN OVERNIGHT HACKATHON</text>
  </g>

  <!-- 8. Presented To Cursive Line -->
  <g transform="translate(560, 388)" text-anchor="middle">
    <text x="0" y="0" font-family="'Caveat', 'Playball', 'Brush Script MT', cursive" font-size="27" font-weight="700" fill="#FF521B" font-style="italic">This certificate is proudly presented to</text>
  </g>

  <!-- 9. Participant Name Section -->
  <g transform="translate(560, 444)" text-anchor="middle">
    <!-- Recipient Name -->
    <text x="0" y="0" font-family="'Cinzel', 'Playfair Display', 'Georgia', serif" font-size="34" font-weight="800" fill="#1A1A1A" letter-spacing="1.5">
      ${name}
    </text>

    <!-- Participant Line -->
    <line x1="-280" y1="15" x2="280" y2="15" stroke="#1A1A1A" stroke-width="1.2"/>

    <!-- Subtitle Label -->
    <text x="0" y="32" font-family="'Montserrat', -apple-system, sans-serif" font-size="9.5" font-weight="700" fill="#1A1A1A" letter-spacing="3">
      NAME OF PARTICIPANT
    </text>
  </g>

  <!-- 10. Citation Paragraph Text -->
  <g transform="translate(560, 524)" text-anchor="middle" font-family="'Montserrat', -apple-system, sans-serif" font-size="12.5" fill="#1A1A1A" letter-spacing="0.3">
    <text x="0" y="0">
      for actively participating in <tspan font-weight="700">HACK-O-LANTERN</tspan>, the 12-hour overnight hackathon organised by Vulcan Club, Mirai
    </text>
    <text x="0" y="22">
      School of Technology, on 31 October &amp; 1 November 2026, and for building, learning and celebrating through the
    </text>
    <text x="0" y="44">
      night${team ? ` as a member of team "${team}".` : '.'}
    </text>

    <!-- Code / Create / Celebrate -->
    <text x="0" y="88" font-size="10.5" font-weight="800" fill="#1A1A1A" letter-spacing="4.5">
      CODE   /   CREATE   /   CELEBRATE
    </text>
  </g>

  <!-- 11. Bottom Center Official Participant Medal (NO Signatures) -->
  <g transform="translate(560, 680)" text-anchor="middle">
    <!-- Orange Circular Badge -->
    <circle cx="0" cy="0" r="38" fill="#FF521B"/>
    <circle cx="0" cy="0" r="32" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="3, 2.5"/>
    <!-- 5-Pointed White Star -->
    <polygon points="0,-16 4.7,-4.9 16.8,-4.9 7.1,2.1 10.8,13.7 0,6.7 -10.8,13.7 -7.1,2.1 -16.8,-4.9 -4.7,-4.9" fill="#FFFFFF"/>
    <!-- Bottom Badge Label -->
    <text x="0" y="23" font-family="'Montserrat', sans-serif" font-size="7.5" font-weight="900" fill="#FFFFFF" letter-spacing="1.2">PARTICIPANT</text>
  </g>

  <!-- 12. Discrete Verification Footer & Embedded QR Code -->
  <g transform="translate(1005, 715)" text-anchor="middle">
    <image href="${qrDataUrl}" x="-25" y="-25" width="50" height="50"/>
    <text x="0" y="34" font-family="monospace" font-size="6.5" font-weight="700" fill="#777777">${certId}</text>
  </g>
</svg>`;
}

/**
 * Generates an ultra-crisp, high-resolution PNG Buffer (2240 x 1584 at 300 DPI) using Resvg.
 */
export async function generateCertificatePng(options, width = 2240) {
  const svg = await generateCertificateSvg(options);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Georgia',
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
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
<body style="margin:0;padding:0;background-color:#FAF6EE;color:#1A1A1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
  <div style="max-width:640px;margin:30px auto;background:#FFFFFF;border:2px solid #FF521B;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.12);">
    <!-- Header Banner -->
    <div style="background:#FAF6EE;padding:36px 32px 24px;text-align:center;border-bottom:1px solid #FFD8CC;">
      <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,82,27,0.1);border:1px solid #FF521B;color:#FF521B;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        VULCAN CLUB × MIRAI SCHOOL OF TECHNOLOGY
      </div>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#1A1A1A;letter-spacing:1px;font-family:Georgia,serif;">
        HACK-O-LANTERN 2026
      </h1>
      <p style="margin:0;color:#FF521B;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Official Certificate of Participation
      </p>
    </div>

    <!-- Body Content -->
    <div style="padding:32px 32px 24px;">
      <p style="margin:0 0 16px;font-size:17px;color:#1A1A1A;">
        Dear <strong>${pName}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#4A4A4A;line-height:1.7;">
        Congratulations on participating in <strong>Hack-O-Lantern 2026</strong>! Through the overnight hackathon, your team <strong>${tName}</strong> engineered, designed, and presented an incredible hackathon solution.
      </p>
      
      <p style="margin:0 0 24px;font-size:14px;color:#4A4A4A;line-height:1.7;">
        In recognition of your active participation, the Vulcan Club and Mirai School of Technology proudly confer your official Certificate of Participation.
      </p>

      <!-- Certificate Summary Box -->
      <div style="background:#FAF6EE;border:1px solid #EAD8C7;border-radius:14px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:6px 0;color:#777;">Recipient</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#1A1A1A;">${pName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#777;">Team Name</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#FF521B;">${tName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#777;">Certificate ID</td>
            <td style="padding:6px 0;text-align:right;"><code style="color:#1A1A1A;font-weight:700;font-family:monospace;">${cId}</code></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#777;">Format</td>
            <td style="padding:6px 0;text-align:right;color:#1A1A1A;font-weight:600;">High-Resolution PNG Attached</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${dUrl}&format=png" target="_blank" style="display:inline-block;background:#FF521B;color:#FFFFFF;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(255,82,27,0.3);">
          🖼️ Download High-Res Certificate (PNG)
        </a>
      </div>

      <div style="background:#FAF6EE;border-radius:12px;padding:14px;border:1px dashed #FF521B;text-align:center;">
        <p style="margin:0;font-size:12px;color:#666;">
          Your certificate includes a cryptographic verification QR code that links to the official Vulcan verification ledger. You can share your PNG directly on LinkedIn, Twitter/X, resume, or portfolio!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#FAF6EE;padding:20px 32px;border-top:1px solid #EAD8C7;text-align:center;font-size:11px;color:#777;">
      <p style="margin:0 0 6px;">Hack-O-Lantern 2026 • Organised by Vulcan Club × Mirai School of Technology</p>
      <p style="margin:0;">For any certificate corrections, reach out to <a href="mailto:nexcell_rathinam@msot.org" style="color:#FF521B;text-decoration:none;">nexcell_rathinam@msot.org</a></p>
    </div>
  </div>
</body>
</html>`;
}
