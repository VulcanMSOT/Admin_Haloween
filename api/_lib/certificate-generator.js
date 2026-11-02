import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';
import {
  JP_KATAKANA_PATH,
  PRESENTS_DIVIDER_PATH,
  CERTIFICATE_TITLE_PATH,
  OF_PARTICIPATION_PATH,
  HACK_LANTERN_PATH,
  SUBTITLE_PATH,
  PRESENTED_TO_SCRIPT_PATH,
} from './certificate-paths.js';

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
 * Exactly matches the official event certificate template:
 * - Warm parchment cream canvas (#FAF6EE)
 * - Top-right harvest blood-orange moon with flying bats
 * - Vertical Japanese Katakana title on left margin (ハッカーのランタン)
 * - Dual black & orange borders with bottom-left corner star accents
 * - Pure Vector Vulcan Club {V} brand logo (geometric angular braces & digital rising pixel sparks)
 * - "MIRAI SCHOOL OF TECHNOLOGY PRESENTS"
 * - "CERTIFICATE OF PARTICIPATION" in Didone modern display serif & orange tracked sans-serif
 * - "HACK- 🎃 -LANTERN / A HALLOWEEN OVERNIGHT HACKATHON"
 * - Cursive script "This certificate is proudly presented to"
 * - Participant Name with official underline & citation paragraph
 * - "CODE / CREATE / CELEBRATE"
 * - Official Orange Participant Star Badge (without signatories)
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 792" width="1120" height="792" style="background:#FAF6EE; aspect-ratio:1120/792; width:100%; height:auto; display:block;">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,700&amp;family=Cinzel:wght@700;800;900&amp;family=Caveat:wght@700&amp;family=Montserrat:wght@500;600;700;800;900&amp;family=Inter:wght@400;500;600;700&amp;display=swap');
    </style>
  </defs>

  <!-- 1. Background Cream Parchment Canvas -->
  <rect width="1120" height="792" fill="#FAF6EE"/>

  <!-- 2. Top-Right Orange Harvest Moon & Bats -->
  <g>
    <circle cx="1010" cy="50" r="140" fill="#EF541E"/>
    <!-- Bat 1 (Upper Left) -->
    <path d="M935,92 Q942,82 952,84 Q947,90 950,95 Q944,93 940,99 Q938,93 936,92 Q934,93 932,99 Q928,93 922,95 Q925,90 920,84 Q930,82 935,92 Z" fill="#1A1A1A"/>
    <!-- Bat 2 (Lower Right) -->
    <path d="M1015,162 Q1021,154 1029,155 Q1025,160 1027,164 Q1022,162 1019,167 Q1017,162 1016,162 Q1015,162 1013,167 Q1010,162 1005,164 Q1007,160 1003,155 Q1011,154 1015,162 Z" fill="#1A1A1A"/>
  </g>

  <!-- 3. Double Outer Border Lines -->
  <!-- Outer Black Frame -->
  <rect x="24" y="24" width="1072" height="744" fill="none" stroke="#1A1A1A" stroke-width="1.8"/>
  <!-- Inner Orange Frame -->
  <rect x="34" y="34" width="1052" height="724" fill="none" stroke="#EF541E" stroke-width="1.2"/>

  <!-- Bottom-Left Decorative Corner Bracket & Stars -->
  <path d="M22,692 L22,770 L100,770" fill="none" stroke="#EF541E" stroke-width="4"/>
  <!-- Two Orange Sparkle Stars -->
  <g transform="translate(112, 736) scale(0.85)" fill="#EF541E">
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"/>
    <polygon points="-8,-8 0,-4 8,-8 4,0 8,8 0,4 -8,8 -4,0"/>
  </g>
  <g transform="translate(132, 746) scale(0.65)" fill="#EF541E">
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"/>
    <polygon points="-8,-8 0,-4 8,-8 4,0 8,8 0,4 -8,8 -4,0"/>
  </g>

  <!-- 4. Left Margin Vertical Japanese Katakana: ハッカーのランタン (EXACT VECTOR PATH) -->
  <path d="${JP_KATAKANA_PATH}" fill="#FF7A50"/>

  <!-- 5. Top Brand Header: Pure Vector Official Vulcan Club Logo -->
  <g transform="translate(560, 68) scale(0.33) translate(-205, -120)">
    <!-- Left Angular Brace { -->
    <g fill="#1A1A1A">
      <path d="M73.208 24.25C72.63 26.587 71.378 31.65 70.427 35.5c-2.29 9.267-5.824 20.128-9.022 27.726-7.472 17.751-18.904 28.124-34.081 30.922-3.203.591-6.499 1.41-7.324 1.82l-1.5.747-.277 15.258-.276 15.258 1.054 1.27 1.053 1.269 6.223.426 6.223.425 5.5 2.735c9.624 4.785 15.29 10.937 21.323 23.154 4.51 9.131 10.29 26.275 12.583 37.317.608 2.93 1.569 6.192 2.135 7.25l1.029 1.923h20.496 20.496l-.281-12.185-.281-12.186-4-.203c-2.2-.111-7.208-.253-11.129-.314L93.243 178l-1.029-2.75c-.566-1.512-1.779-5.225-2.697-8.25-2.826-9.322-8.62-22.165-13.288-29.455-5.044-7.876-14.66-17.912-20.979-21.893-2.337-1.472-4.25-3.024-4.25-3.449 0-.424 1.4-1.599 3.11-2.609 1.711-1.01 6.256-4.805 10.101-8.432 9.86-9.302 14.138-15.77 20.084-30.369 1.858-4.561 4.162-10.993 5.121-14.293.959-3.3 2.213-7.237 2.785-8.75L93.243 45h10.178 10.179l1.2 1.2 1.2 1.2V33.7 20H95.13 74.26l-1.052 4.25Z"/>
    </g>

    <!-- Center V -->
    <g fill="#1A1A1A">
      <path d="M116 34.516v14.517l5.05 12.233c2.777 6.729 7.475 18.084 10.441 25.234 2.965 7.15 7.687 18.625 10.492 25.5 2.805 6.875 5.513 13.4 6.018 14.5.505 1.1 3.891 9.2 7.524 18 12.931 31.318 17.812 43.099 20.924 50.5l3.154 7.5 24.165.268 24.166.267 1.898-4.267c1.044-2.348 2.712-6.518 3.705-9.268.994-2.75 2.102-5.45 2.463-6 .361-.55 1.465-3.25 2.455-6 .989-2.75 2.386-6.35 3.105-8 .718-1.65 2.927-7.05 4.908-12.0 1.981-4.95 4.02-9.9 4.532-11 .512-1.1 2.551-6.05 4.532-11 3.401-8.497 5.446-13.408 7.496-18 .491-1.1 3.382-8.192 6.424-15.76 8.021-19.954 10.502-25.968 11.726-28.423l1.088-2.182-.616-1.604-.615-1.604-9.768.287-9.767.286-.5 14.5-.5 14.5-6.205.297-6.206.296-.294 6.704-.295 6.703-6.5.5-6.5.5-.5 7-.5 7-14.616.276-14.615.276-2.265-5.276c-1.246-2.902-3.498-7.976-5.004-11.276-8.889-19.48-22.504-52.557-32.105-78-1.66-4.4-3.431-9.012-3.935-10.25L160.043 20h-22.022H116v14.516Z"/>
    </g>

    <!-- Rising Red Digital Pixel Blocks -->
    <g>
      <rect x="220" y="20" width="12" height="11" fill="#E11D48"/>
      <rect x="194" y="35" width="12" height="11" fill="#F87171"/>
      <rect x="213" y="54" width="12" height="11" fill="#EF4444"/>
      <rect x="212" y="71" width="15" height="13" fill="#E11D48"/>
      <rect x="195" y="88" width="15" height="13" fill="#E11D48"/>
    </g>

    <!-- Right Angular Brace } -->
    <g transform="translate(408 0) scale(-1 1)" fill="#1A1A1A">
      <path d="M73.208 24.25C72.63 26.587 71.378 31.65 70.427 35.5c-2.29 9.267-5.824 20.128-9.022 27.726-7.472 17.751-18.904 28.124-34.081 30.922-3.203.591-6.499 1.41-7.324 1.82l-1.5.747-.277 15.258-.276 15.258 1.054 1.27 1.053 1.269 6.223.426 6.223.425 5.5 2.735c9.624 4.785 15.29 10.937 21.323 23.154 4.51 9.131 10.29 26.275 12.583 37.317.608 2.93 1.569 6.192 2.135 7.25l1.029 1.923h20.496 20.496l-.281-12.185-.281-12.186-4-.203c-2.2-.111-7.208-.253-11.129-.314L93.243 178l-1.029-2.75c-.566-1.512-1.779-5.225-2.697-8.25-2.826-9.322-8.62-22.165-13.288-29.455-5.044-7.876-14.66-17.912-20.979-21.893-2.337-1.472-4.25-3.024-4.25-3.449 0-.424 1.4-1.599 3.11-2.609 1.711-1.01 6.256-4.805 10.101-8.432 9.86-9.302 14.138-15.77 20.084-30.369 1.858-4.561 4.162-10.993 5.121-14.293.959-3.3 2.213-7.237 2.785-8.75L93.243 45h10.178 10.179l1.2 1.2 1.2 1.2V33.7 20H95.13 74.26l-1.052 4.25Z"/>
    </g>

    <!-- vulcan club Typography -->
    <text x="204" y="242" font-family="'Montserrat', 'Inter', -apple-system, sans-serif" font-size="34" font-weight="800" fill="#1A1A1A" letter-spacing="0.5" text-anchor="middle">vulcan club</text>
  </g>

  <!-- Presents Divider Rule (BÉZIER VECTOR PATH & FLANKING LINES) -->
  <line x1="270" y1="133" x2="380" y2="133" stroke="#1A1A1A" stroke-width="1.0"/>
  <path d="${PRESENTS_DIVIDER_PATH}" fill="#1A1A1A"/>
  <line x1="740" y1="133" x2="850" y2="133" stroke="#1A1A1A" stroke-width="1.0"/>

  <!-- 6. Main Certificate Title: CERTIFICATE OF PARTICIPATION (BÉZIER VECTOR PATHS) -->
  <path d="${CERTIFICATE_TITLE_PATH}" fill="#1A1A1A"/>
  <!-- OF PARTICIPATION with flanking orange rules -->
  <line x1="385" y1="245" x2="450" y2="245" stroke="#EF541E" stroke-width="1.8"/>
  <path d="${OF_PARTICIPATION_PATH}" fill="#EF541E"/>
  <line x1="670" y1="245" x2="735" y2="245" stroke="#EF541E" stroke-width="1.8"/>

  <!-- 7. Event Title: HACK- 🎃 -LANTERN (EXACT VECTOR PATHS) -->
  <path d="${HACK_LANTERN_PATH}" fill="#1A1A1A"/>
  <!-- Jack-o'-Lantern Pumpkin at Center -->
  <g transform="translate(560, 302)">
    <ellipse cx="0" cy="0" rx="15" ry="13" fill="#EF541E"/>
    <ellipse cx="-7.5" cy="0" rx="9" ry="12.5" fill="#F0602D"/>
    <ellipse cx="7.5" cy="0" rx="9" ry="12.5" fill="#F0602D"/>
    <ellipse cx="0" cy="0" rx="6.5" ry="13" fill="#F47545"/>
    <!-- Stem -->
    <path d="M-1,-11 Q-2,-17 3,-18 Q2,-13 1,-11 Z" fill="#65a30d"/>
    <!-- Carved Eyes -->
    <polygon points="-7,-4 -2,-3 -5,1" fill="#1A1A1A"/>
    <polygon points="7,-4 2,-3 5,1" fill="#1A1A1A"/>
    <!-- Nose -->
    <polygon points="0,-1 -2,2 2,2" fill="#1A1A1A"/>
    <!-- Sawtooth Smile -->
    <path d="M-9,5 L-6,4 L-4,7 L-2,4 L0,7 L2,4 L4,7 L6,4 L9,5 Q6,11 0,11 Q-6,11 -9,5 Z" fill="#1A1A1A"/>
  </g>
  <path d="${SUBTITLE_PATH}" fill="#1A1A1A"/>

  <!-- 8. Presented To Cursive Line (EXACT VECTOR PATH) -->
  <path d="${PRESENTED_TO_SCRIPT_PATH}" fill="#EF541E"/>

  <!-- 9. Participant Name Section -->
  <g transform="translate(560, 444)" text-anchor="middle">
    <!-- Recipient Name -->
    <text x="0" y="0" font-family="'Playfair Display', 'Didot', 'Bodoni 72', 'Cinzel', 'Georgia', serif" font-size="36" font-weight="800" fill="#1A1A1A" letter-spacing="1.5">
      ${name}
    </text>

    <!-- Participant Line -->
    <line x1="-270" y1="14" x2="270" y2="14" stroke="#1A1A1A" stroke-width="1.2"/>

    <!-- Subtitle Label -->
    <text x="0" y="30" font-family="'Montserrat', 'Inter', -apple-system, sans-serif" font-size="9" font-weight="700" fill="#1A1A1A" letter-spacing="3.5">
      NAME OF PARTICIPANT
    </text>
  </g>

  <!-- 10. Citation Paragraph Text -->
  <g transform="translate(560, 516)" text-anchor="middle" font-family="'Inter', 'Montserrat', -apple-system, sans-serif" font-size="12.5" fill="#1A1A1A" letter-spacing="0.25">
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
    <text x="0" y="86" font-family="'Montserrat', 'Inter', -apple-system, sans-serif" font-size="10.5" font-weight="800" fill="#1A1A1A" letter-spacing="4.5">
      CODE   <tspan fill="#EF541E">/</tspan>   CREATE   <tspan fill="#EF541E">/</tspan>   CELEBRATE
    </text>
  </g>

  <!-- 11. Bottom Center Official Participant Medal (NO Signatures / Signatories) -->
  <g transform="translate(560, 680)" text-anchor="middle">
    <!-- Orange Circular Badge -->
    <circle cx="0" cy="0" r="38" fill="#EF541E"/>
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
  <div style="max-width:640px;margin:30px auto;background:#FFFFFF;border:2px solid #EF541E;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.12);">
    <!-- Header Banner -->
    <div style="background:#FAF6EE;padding:36px 32px 24px;text-align:center;border-bottom:1px solid #FFD8CC;">
      <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(239,84,30,0.1);border:1px solid #EF541E;color:#EF541E;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        VULCAN CLUB × MIRAI SCHOOL OF TECHNOLOGY
      </div>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#1A1A1A;letter-spacing:1px;font-family:Georgia,serif;">
        HACK-O-LANTERN 2026
      </h1>
      <p style="margin:0;color:#EF541E;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
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
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#EF541E;">${tName}</td>
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
        <a href="${dUrl}&format=png" target="_blank" style="display:inline-block;background:#EF541E;color:#FFFFFF;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(239,84,30,0.3);">
          🖼️ Download High-Res Certificate (PNG)
        </a>
      </div>

      <div style="background:#FAF6EE;border-radius:12px;padding:14px;border:1px dashed #EF541E;text-align:center;">
        <p style="margin:0;font-size:12px;color:#666;">
          Your certificate includes a cryptographic verification QR code that links to the official Vulcan verification ledger. You can share your PNG directly on LinkedIn, Twitter/X, resume, or portfolio!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#FAF6EE;padding:20px 32px;border-top:1px solid #EAD8C7;text-align:center;font-size:11px;color:#777;">
      <p style="margin:0 0 6px;">Hack-O-Lantern 2026 • Organised by Vulcan Club × Mirai School of Technology</p>
      <p style="margin:0;">For any certificate corrections, reach out to <a href="mailto:nexcell_rathinam@msot.org" style="color:#EF541E;text-decoration:none;">nexcell_rathinam@msot.org</a></p>
    </div>
  </div>
</body>
</html>`;
}
