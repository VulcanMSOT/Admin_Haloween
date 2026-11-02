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
 * Generates an ultra-crisp, printable vector SVG for the Hack-O-Lantern 2026 Participation Certificate.
 * Standard A4 Landscape Aspect Ratio (1120 x 792) with rich Halloween visuals:
 * Glowing harvest moon, flying bats, ornate spiderwebs, carved Jack-O'-Lanterns, and gothic filigree.
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
      dark: '#ff7a1a',
      light: '#09070f',
    },
  });

  const name = escapeHtml(participantName || 'Participant Name');
  const college = escapeHtml(collegeName || 'Mirai School of Technology');
  const team = escapeHtml(teamName || 'Team');
  const tid = escapeHtml(teamId || 'VHK-XXXX');
  const track = escapeHtml(trackName || 'Open Innovation & Systems');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 792" width="1120" height="792" style="background:#06040a; aspect-ratio: 1120 / 792; width: 100%; height: auto; display: block; font-family:'Cinzel', 'Georgia', -apple-system, serif;">
  <defs>
    <!-- Background Radiant Sky -->
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1f1133" stop-opacity="1"/>
      <stop offset="35%" stop-color="#130a21" stop-opacity="1"/>
      <stop offset="70%" stop-color="#0a0512" stop-opacity="1"/>
      <stop offset="100%" stop-color="#050308" stop-opacity="1"/>
    </radialGradient>

    <!-- Harvest Blood Moon Gradient -->
    <radialGradient id="moonGlow" cx="42%" cy="42%" r="58%">
      <stop offset="0%" stop-color="#fff8e7"/>
      <stop offset="35%" stop-color="#fed7aa"/>
      <stop offset="70%" stop-color="#fb923c"/>
      <stop offset="92%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </radialGradient>

    <!-- Moon Atmospheric Fog Gradient -->
    <radialGradient id="moonFog" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="#a855f7" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#06040a" stop-opacity="0"/>
    </radialGradient>

    <!-- Fiery Pumpkin Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="25%" stop-color="#fdba74"/>
      <stop offset="55%" stop-color="#ff7a1a"/>
      <stop offset="85%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#b43403"/>
    </linearGradient>

    <!-- Metallic Ornate Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd280"/>
      <stop offset="20%" stop-color="#ea580c"/>
      <stop offset="50%" stop-color="#fef08a"/>
      <stop offset="80%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#ff9a3c"/>
    </linearGradient>

    <!-- Purple Nebula Accent -->
    <radialGradient id="purpleNebula" cx="15%" cy="85%" r="40%">
      <stop offset="0%" stop-color="#9333ea" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#6b21a8" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#06040a" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="orangeNebula" cx="85%" cy="20%" r="45%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#c2410c" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#06040a" stop-opacity="0"/>
    </radialGradient>

    <!-- Candle Glow Filter -->
    <filter id="candleGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Soft Glow Filter -->
    <filter id="headerGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Spiderweb Reusable Template -->
    <g id="spiderWeb">
      <!-- Radial Web Strands -->
      <line x1="0" y1="0" x2="150" y2="0" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <line x1="0" y1="0" x2="140" y2="35" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <line x1="0" y1="0" x2="115" y2="75" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <line x1="0" y1="0" x2="75" y2="115" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <line x1="0" y1="0" x2="35" y2="140" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <line x1="0" y1="0" x2="0" y2="150" stroke="#f97316" stroke-width="0.7" opacity="0.35"/>
      <!-- Concentric Sagging Arcs -->
      <path d="M28,0 Q26,8 24,10 Q20,17 15,22 Q10,26 6,28 L0,28" fill="none" stroke="#fed7aa" stroke-width="0.8" opacity="0.45"/>
      <path d="M58,0 Q53,16 48,20 Q40,34 30,44 Q20,52 12,56 L0,58" fill="none" stroke="#fed7aa" stroke-width="0.8" opacity="0.45"/>
      <path d="M92,0 Q84,26 76,32 Q64,54 48,70 Q32,82 19,89 L0,92" fill="none" stroke="#fed7aa" stroke-width="0.8" opacity="0.45"/>
      <path d="M132,0 Q121,37 110,46 Q92,77 69,100 Q46,117 27,127 L0,132" fill="none" stroke="#fed7aa" stroke-width="0.8" opacity="0.45"/>
    </g>

    <!-- Reusable Carved Jack-O'-Lantern Pumpkin -->
    <g id="jackPumpkin">
      <!-- Pumpkin Ribs / Body -->
      <ellipse cx="0" cy="0" rx="28" ry="24" fill="#9a3412"/>
      <ellipse cx="-14" cy="0" rx="18" ry="23" fill="#c2410c"/>
      <ellipse cx="14" cy="0" rx="18" ry="23" fill="#c2410c"/>
      <ellipse cx="-7" cy="0" rx="15" ry="23.5" fill="#ea580c"/>
      <ellipse cx="7" cy="0" rx="15" ry="23.5" fill="#ea580c"/>
      <ellipse cx="0" cy="0" rx="12" ry="24" fill="#f97316"/>
      <!-- Vine Stem -->
      <path d="M-2,-22 Q-4,-30 4,-33 Q3,-26 2,-22 Z" fill="#65a30d" stroke="#365314" stroke-width="0.5"/>
      <!-- Carved Fiery Eyes -->
      <polygon points="-13,-8 -4,-6 -9,0" fill="#fef08a" filter="url(#candleGlow)"/>
      <polygon points="13,-8 4,-6 9,0" fill="#fef08a" filter="url(#candleGlow)"/>
      <!-- Carved Nose -->
      <polygon points="0,-3 -4,3 4,3" fill="#fef08a" filter="url(#candleGlow)"/>
      <!-- Jagged Sawtooth Grin -->
      <path d="M-18,7 L-13,6 L-10,11 L-5,7 L0,11 L5,7 L10,11 L13,6 L18,7 Q14,18 0,18 Q-14,18 -18,7 Z" fill="#fef08a" filter="url(#candleGlow)"/>
    </g>

    <!-- Reusable Bat Silhouette -->
    <g id="batSilhouette">
      <path d="M0,0 Q6,-11 18,-9 Q12,-1 15,4 Q8,2 4,8 Q1,2 0,0 Q-1,2 -4,8 Q-8,2 -15,4 Q-12,-1 -18,-9 Q-6,-11 0,0 Z" fill="#ff7a1a" opacity="0.85"/>
      <circle cx="-1" cy="0" r="1.5" fill="#fef08a"/>
      <circle cx="1" cy="0" r="1.5" fill="#fef08a"/>
    </g>
  </defs>

  <!-- 1. Deep Space & Atmospheric Background -->
  <rect width="1120" height="792" fill="url(#bgGlow)"/>
  <rect width="1120" height="792" fill="url(#purpleNebula)"/>
  <rect width="1120" height="792" fill="url(#orangeNebula)"/>

  <!-- 2. Atmospheric Blood Harvest Moon (Top-Left Background) -->
  <circle cx="170" cy="130" r="110" fill="url(#moonFog)"/>
  <circle cx="170" cy="130" r="52" fill="url(#moonGlow)" opacity="0.9" filter="url(#candleGlow)"/>
  <!-- Moon Craters & Shadow Detail -->
  <ellipse cx="155" cy="118" rx="8" ry="6" fill="#ea580c" opacity="0.35"/>
  <ellipse cx="182" cy="138" rx="11" ry="8" fill="#ea580c" opacity="0.3"/>
  <ellipse cx="162" cy="150" rx="6" ry="5" fill="#ea580c" opacity="0.25"/>

  <!-- 3. Flocks of Flying Halloween Bats Across the Sky -->
  <use href="#batSilhouette" transform="translate(245, 95) scale(1.3) rotate(-15)"/>
  <use href="#batSilhouette" transform="translate(195, 62) scale(0.9) rotate(8)"/>
  <use href="#batSilhouette" transform="translate(310, 115) scale(1.0) rotate(-22)"/>
  <use href="#batSilhouette" transform="translate(130, 85) scale(0.7) rotate(20)"/>
  <use href="#batSilhouette" transform="translate(370, 75) scale(0.8) rotate(-10)"/>

  <!-- Right Sky Bats -->
  <use href="#batSilhouette" transform="translate(850, 90) scale(1.2) rotate(15)"/>
  <use href="#batSilhouette" transform="translate(920, 68) scale(0.85) rotate(-12)"/>
  <use href="#batSilhouette" transform="translate(980, 105) scale(0.95) rotate(18)"/>
  <use href="#batSilhouette" transform="translate(790, 80) scale(0.7) rotate(-20)"/>

  <!-- 4. Gnarled Spooky Graveyard & Haunted Trees Silhouette along Bottom Edge -->
  <g fill="#07040c" opacity="0.35">
    <!-- Left Haunted Tree Branches -->
    <path d="M40,760 C60,720 70,680 85,650 C95,670 110,660 120,640 C110,655 100,670 95,685 C115,670 135,665 150,650 C140,665 125,675 110,690 C125,710 145,730 160,760 Z"/>
    <path d="M60,760 C75,700 90,660 100,630 C105,620 115,615 125,610 C115,620 110,630 105,645 C120,640 130,635 140,625 C130,640 120,650 110,660 Z"/>
    <!-- Right Haunted Tree Branches -->
    <path d="M1080,760 C1060,720 1050,680 1035,650 C1025,670 1010,660 1000,640 C1010,655 1020,670 1025,685 C1005,670 985,665 970,650 C980,665 995,675 1010,690 C995,710 975,730 960,760 Z"/>
    <!-- Distant Tombstones along the bottom mist -->
    <rect x="220" y="738" width="16" height="24" rx="8" fill="#140b1e" opacity="0.4"/>
    <rect x="290" y="742" width="14" height="20" rx="7" fill="#140b1e" opacity="0.35"/>
    <rect x="830" y="740" width="15" height="22" rx="7" fill="#140b1e" opacity="0.35"/>
    <rect x="895" y="736" width="17" height="26" rx="8" fill="#140b1e" opacity="0.4"/>
  </g>

  <!-- 5. Floating Glowing Embers / Firefly Sparks -->
  <g opacity="0.75">
    <circle cx="180" cy="460" r="2.0" fill="#fde047" filter="url(#candleGlow)"/>
    <circle cx="230" cy="380" r="2.5" fill="#ff7a1a" filter="url(#candleGlow)"/>
    <circle cx="280" cy="520" r="1.5" fill="#fde047"/>
    <circle cx="340" cy="320" r="2.0" fill="#f97316" filter="url(#candleGlow)"/>
    <circle cx="780" cy="480" r="2.0" fill="#fde047" filter="url(#candleGlow)"/>
    <circle cx="840" cy="360" r="2.5" fill="#ff7a1a" filter="url(#candleGlow)"/>
    <circle cx="890" cy="530" r="1.5" fill="#fde047"/>
    <circle cx="940" cy="420" r="2.2" fill="#f97316" filter="url(#candleGlow)"/>
  </g>

  <!-- 6. Prominent Center Watermark: Carved Glowing Jack-O'-Lantern Face -->
  <g opacity="0.14" transform="translate(560, 420)">
    <!-- Pumpkin Outer Contour -->
    <ellipse cx="0" cy="0" rx="140" ry="118" fill="url(#goldGrad)"/>
    <!-- Glowing Sinister Eyes -->
    <polygon points="-75,-35 -20,-28 -48,0" fill="#fff59d"/>
    <polygon points="75,-35 20,-28 48,0" fill="#fff59d"/>
    <!-- Nose -->
    <polygon points="0,-12 -18,14 18,14" fill="#fff59d"/>
    <!-- Wide Sawtooth Grin -->
    <path d="M-90,32 L-65,28 L-52,48 L-30,30 L-10,48 L10,48 L30,30 L52,48 L65,28 L90,32 Q70,82 0,82 Q-70,82 -90,32 Z" fill="#fff59d"/>
  </g>

  <!-- 7. Ornate Gothic Borders with Spiderwebs in 4 Corners -->
  <!-- Outer Double Line Border -->
  <rect x="26" y="26" width="1068" height="740" rx="10" fill="none" stroke="url(#borderGrad)" stroke-width="2.5" opacity="0.9"/>
  <rect x="34" y="34" width="1052" height="724" rx="7" fill="none" stroke="#ff7a1a" stroke-width="0.8" stroke-dasharray="5, 4" opacity="0.5"/>
  <rect x="44" y="44" width="1032" height="704" rx="5" fill="none" stroke="url(#borderGrad)" stroke-width="1.2" opacity="0.75"/>

  <!-- Spiderwebs (Top-Left, Top-Right, Bottom-Left, Bottom-Right) -->
  <!-- Top-Left Spiderweb -->
  <use href="#spiderWeb" transform="translate(26, 26)"/>
  <!-- Dangling Spider from Top-Left Web -->
  <g transform="translate(108, 98)">
    <line x1="0" y1="-72" x2="0" y2="0" stroke="#f97316" stroke-width="0.6" stroke-dasharray="2, 2" opacity="0.6"/>
    <!-- Spider Body & Head -->
    <ellipse cx="0" cy="0" rx="3.5" ry="4.5" fill="#ea580c"/>
    <circle cx="0" cy="-3.5" r="2.2" fill="#c2410c"/>
    <!-- Spider Legs -->
    <path d="M-3,-1 Q-9,-4 -11,0 M-3,1 Q-9,1 -11,5 M-3,3 Q-8,6 -9,10" fill="none" stroke="#ea580c" stroke-width="0.8"/>
    <path d="M3,-1 Q9,-4 11,0 M3,1 Q9,1 11,5 M3,3 Q8,6 9,10" fill="none" stroke="#ea580c" stroke-width="0.8"/>
  </g>

  <!-- Top-Right Spiderweb (Mirrored) -->
  <use href="#spiderWeb" transform="translate(1094, 26) scale(-1, 1)"/>
  <!-- Bottom-Left Spiderweb (Mirrored vertically) -->
  <use href="#spiderWeb" transform="translate(26, 766) scale(1, -0.85)"/>
  <!-- Bottom-Right Spiderweb (Mirrored both) -->
  <use href="#spiderWeb" transform="translate(1094, 766) scale(-1, -0.85)"/>

  <!-- Ornate Corner Flame Brackets -->
  <g stroke="url(#goldGrad)" fill="none" stroke-width="1.8">
    <path d="M26,70 L26,40 Q26,26 40,26 L70,26"/>
    <path d="M1094,70 L1094,40 Q1094,26 1080,26 L1050,26"/>
    <path d="M26,722 L26,752 Q26,766 40,766 L70,766"/>
    <path d="M1094,722 L1094,752 Q1094,766 1080,766 L1050,766"/>
  </g>

  <!-- 8. Top Event Banner with Carved Pumpkins Flanking Crest -->
  <g transform="translate(560, 92)" text-anchor="middle">
    <!-- Left Carved Pumpkin -->
    <use href="#jackPumpkin" transform="translate(-175, 5) scale(0.72)"/>

    <!-- Central Gothic Crest -->
    <g transform="translate(0, 0)">
      <circle cx="0" cy="0" r="22" fill="#140a20" stroke="url(#goldGrad)" stroke-width="1.8" filter="url(#candleGlow)"/>
      <circle cx="0" cy="0" r="18" fill="none" stroke="#ff7a1a" stroke-width="0.75" stroke-dasharray="3, 2"/>
      <text x="0" y="7" font-size="16" font-weight="900" fill="#ff9a3c" font-family="'Cinzel', Georgia, serif">&#123;V&#125;</text>
    </g>

    <!-- Right Carved Pumpkin -->
    <use href="#jackPumpkin" transform="translate(175, 5) scale(0.72) scale(-1, 1)"/>

    <!-- Subtitle Banner -->
    <text x="0" y="36" font-size="11.5" font-weight="800" fill="#fde047" letter-spacing="4" text-transform="uppercase" filter="url(#candleGlow)">
      ✦ VULCAN CLUB × MIRAI SCHOOL OF TECHNOLOGY ✦
    </text>
    <text x="0" y="52" font-size="9" font-weight="600" fill="#a855f7" letter-spacing="2" text-transform="uppercase">
      ANNUAL HALLOWEEN HACKATHON • OCTOBER 31 – NOVEMBER 1, 2026
    </text>
  </g>

  <!-- 9. Certificate Header Title -->
  <g transform="translate(560, 200)" text-anchor="middle">
    <text x="0" y="0" font-size="35" font-weight="900" fill="url(#goldGrad)" letter-spacing="6" filter="url(#headerGlow)" font-family="'Cinzel', Georgia, serif">
      CERTIFICATE OF PARTICIPATION
    </text>
    <!-- Gothic Center Divider with Bats & Flames -->
    <line x1="-180" y1="18" x2="-25" y2="18" stroke="url(#goldGrad)" stroke-width="1.5" opacity="0.85"/>
    <use href="#batSilhouette" transform="translate(0, 18) scale(0.65)"/>
    <line x1="25" y1="18" x2="180" y2="18" stroke="url(#goldGrad)" stroke-width="1.5" opacity="0.85"/>
    <circle cx="-180" cy="18" r="3" fill="#ff7a1a"/>
    <circle cx="180" cy="18" r="3" fill="#ff7a1a"/>
  </g>

  <!-- 10. Conferred Upon Section -->
  <g transform="translate(560, 266)" text-anchor="middle">
    <text x="0" y="0" font-size="12" font-weight="700" fill="#c084fc" letter-spacing="3" text-transform="uppercase">
      THIS IS PROUDLY CONFERRED UPON
    </text>

    <!-- Recipient Name (Bold, Majestic, High-Contrast) -->
    <text x="0" y="54" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="2" font-family="'Cinzel', 'Georgia', serif" filter="url(#headerGlow)">
      ${name}
    </text>

    <!-- Recipient Underline Accent with Glowing Core -->
    <path d="M-220,70 Q0,80 220,70" stroke="url(#goldGrad)" stroke-width="2" fill="none" opacity="0.95"/>
    <circle cx="0" cy="75" r="3.5" fill="#fef08a" filter="url(#candleGlow)"/>

    <!-- College Name -->
    <text x="0" y="100" font-size="16" font-weight="700" fill="#fed7aa" letter-spacing="1">
      ${college}
    </text>
  </g>

  <!-- 11. Citation / Achievement Statement -->
  <g transform="translate(560, 420)" text-anchor="middle">
    <text x="0" y="0" font-size="13.5" font-weight="400" fill="#e9d5ff" letter-spacing="0.5">
      for actively competing and demonstrating exceptional engineering rigor, creativity, and nocturnal endurance
    </text>
    <text x="0" y="24" font-size="13.5" font-weight="400" fill="#e9d5ff" letter-spacing="0.5">
      during the 16-Hour Overnight Flagship Hackathon
    </text>

    <!-- Event Title Glow with Sinister Font Styling -->
    <text x="0" y="62" font-size="24" font-weight="900" fill="url(#goldGrad)" letter-spacing="3.5" filter="url(#candleGlow)">
      🎃 HACK-O-LANTERN 2026 🎃
    </text>

    <!-- Team & Track Details Pill -->
    <g transform="translate(0, 98)">
      <rect x="-270" y="-18" width="540" height="36" rx="18" fill="#140a20" stroke="url(#borderGrad)" stroke-width="1.2" opacity="0.95"/>
      <text x="0" y="5" font-size="12.5" font-weight="700" fill="#ffffff" letter-spacing="0.5">
        Team: <tspan fill="#ff9a3c">${team}</tspan> • <tspan fill="#fed7aa">${tid}</tspan> • <tspan fill="#c084fc">${track}</tspan>
      </text>
    </g>
  </g>

  <!-- 12. Footer: Central Holographic Talisman Seal & Dynamic QR Code -->
  <g transform="translate(560, 638)" text-anchor="middle">
    <!-- Flanking Carved Pumpkins Guarding the Seal -->
    <use href="#jackPumpkin" transform="translate(-115, -4) scale(0.68)"/>
    <use href="#jackPumpkin" transform="translate(115, -4) scale(0.68) scale(-1, 1)"/>

    <!-- Flanking Decorative Chains & Lines -->
    <line x1="-360" y1="-8" x2="-145" y2="-8" stroke="url(#goldGrad)" stroke-width="1.2" opacity="0.5"/>
    <circle cx="-360" cy="-8" r="3" fill="#ff7a1a"/>
    <line x1="145" y1="-8" x2="360" y2="-8" stroke="url(#goldGrad)" stroke-width="1.2" opacity="0.5"/>
    <circle cx="360" cy="-8" r="3" fill="#ff7a1a"/>

    <!-- Outer Seal Rosette / Talisman Medallion -->
    <circle cx="0" cy="-10" r="50" fill="#140a22" stroke="url(#borderGrad)" stroke-width="2.5" filter="url(#candleGlow)"/>
    <circle cx="0" cy="-10" r="44" fill="none" stroke="#ff7a1a" stroke-width="0.8" stroke-dasharray="4, 2"/>

    <!-- Seal Inner QR Code -->
    <image href="${qrDataUrl}" x="-30" y="-40" width="60" height="60"/>

    <!-- Seal Ribbons with Halloween Blood Orange Tone -->
    <path d="M-18,34 L-30,68 L-14,60 L2,68 L-6,34 Z" fill="#c2410c" opacity="0.9"/>
    <path d="M18,34 L6,68 L22,60 L38,68 L26,34 Z" fill="#c2410c" opacity="0.9"/>

    <text x="0" y="48" font-size="8.5" font-weight="900" fill="#fde047" letter-spacing="1.5">
      OFFICIAL SEAL
    </text>
    <text x="0" y="61" font-size="7.5" font-weight="700" fill="#fed7aa" letter-spacing="0.5" font-family="monospace">
      ${certId}
    </text>
  </g>

  <!-- 13. Bottom Verification Ledger Text -->
  <g transform="translate(560, 750)" text-anchor="middle">
    <text x="0" y="0" font-size="8.5" font-weight="600" fill="#9382a5" letter-spacing="1.5">
      CRYPTOGRAPHICALLY VERIFIABLE PARTICIPATION RECORD • ISSUED ON ${escapeHtml(issueDate)} • VULCAN CLUB MIRAI CHAPTER
    </text>
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
<body style="margin:0;padding:0;background-color:#07060a;color:#f3edf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
  <div style="max-width:640px;margin:30px auto;background:#100d17;border:1px solid rgba(255,122,26,0.35);border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,0.6);">
    <!-- Header Banner -->
    <div style="background:linear-gradient(135deg, #201333 0%, #100b1a 100%);padding:36px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,122,26,0.2);">
      <div style="display:inline-block;padding:4px 14px;border-radius:999px;background:rgba(255,122,26,0.15);border:1px solid rgba(255,122,26,0.4);color:#ff9a3c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
        VULCAN CLUB × MIRAI SCHOOL OF TECHNOLOGY
      </div>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:1px;font-family:Georgia,serif;">
        🎃 HACK-O-LANTERN 2026 🎃
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
        In recognition of your technical skill, collaborative drive, and nocturnal endurance, the Vulcan Club and Mirai School of Technology have officially conferred your verified Certificate of Participation.
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
            <td style="padding:6px 0;color:#8f829d;">Format</td>
            <td style="padding:6px 0;text-align:right;color:#ffffff;font-weight:600;">High-Resolution PNG Attached</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${dUrl}&format=png" target="_blank" style="display:inline-block;background:linear-gradient(135deg, #ff7a1a 0%, #e05e00 100%);color:#000000;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 6px 20px rgba(255,122,26,0.35);">
          🖼️ Download High-Res Certificate (PNG)
        </a>
      </div>

      <div style="background:rgba(0,0,0,0.35);border-radius:12px;padding:14px;border:1px dashed rgba(255,122,26,0.25);text-align:center;">
        <p style="margin:0;font-size:12px;color:#a99cb5;">
          Your certificate includes a cryptographic verification QR code that links to the official Vulcan verification ledger. You can share your PNG directly on LinkedIn, Twitter/X, resume, or portfolio!
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
