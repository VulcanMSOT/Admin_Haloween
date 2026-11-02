import { prisma } from './_lib/prisma.js';
import { generateCertificateId, generateCertificateSvg, generateCertificatePng } from './_lib/certificate-generator.js';

export default async function handler(request, response) {
  const certId = String(request.query.certId || '').trim();
  const memberId = String(request.query.memberId || '').trim();
  const format = String(request.query.format || 'html').toLowerCase();

  try {
    let member = null;

    if (memberId) {
      member = await prisma.teamMember.findUnique({
        where: { id: memberId },
        include: { registration: true },
      });
    } else if (certId) {
      // 1. Find by matching certificate record in DB
      try {
        const certRows = await prisma.$queryRawUnsafe(`
          SELECT member_id FROM certificates WHERE id = $1 LIMIT 1
        `, certId);

        if (certRows.length > 0 && certRows[0].member_id) {
          member = await prisma.teamMember.findUnique({
            where: { id: certRows[0].member_id },
            include: { registration: true },
          });
        }
      } catch {
        // certificates table might be empty or unmigrated yet
      }

      // 2. Fallback: Parse certId formatted as HOL26-PART-<teamId>-<position>
      if (!member) {
        const match = certId.match(/^HOL26-PART-(.+?)-(\d+)$/i);
        if (match) {
          const rawTeamCode = match[1];
          const pos = parseInt(match[2], 10);
          const reg = await prisma.registration.findFirst({
            where: {
              OR: [
                { teamId: rawTeamCode },
                { teamId: rawTeamCode.replace('-', '') },
                { teamId: rawTeamCode.replace('VHK', 'VHK-') },
                { teamId: { contains: rawTeamCode.replace('VHK', '') } },
              ],
            },
            include: { members: true },
          });
          if (reg && reg.members && reg.members.length > 0) {
            member = reg.members.find((m) => m.position === pos) || reg.members[0];
            if (member) member.registration = reg;
          }
        }
      }
    }

    // Fallback: If not found in certificates table, pick first member or demo
    if (!member) {
      member = await prisma.teamMember.findFirst({
        include: { registration: true },
      });
    }

    if (!member) {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end('<h1>Participant record not found</h1>');
    }

    const registration = member.registration || { teamId: 'VHK-1011', teamName: 'ZomByte' };
    const effectiveCertId = certId || generateCertificateId(registration.teamId, member.position);

    const certParams = {
      certificateId: effectiveCertId,
      participantName: member.fullName,
      collegeName: member.college,
      teamName: registration.teamName,
      teamId: registration.teamId,
      trackName: 'Open Innovation & Systems',
      issueDate: 'November 1, 2026',
    };

    if (format === 'png') {
      const pngBuffer = await generateCertificatePng(certParams, 2240);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'image/png');
      response.setHeader('Content-Disposition', `attachment; filename="${effectiveCertId}.png"`);
      return response.end(pngBuffer);
    }

    const svg = await generateCertificateSvg(certParams);

    if (format === 'svg') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'image/svg+xml');
      response.setHeader('Content-Disposition', `inline; filename="${effectiveCertId}.svg"`);
      return response.end(svg);
    }

    // Default: Printable HTML Page
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Certificate — ${escapeHtml(member.fullName)} • Hack-O-Lantern 2026</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,700&family=Montserrat:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #060509;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      width: 100%;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 20px 24px 60px;
      overflow-x: hidden;
    }
    .toolbar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      background: rgba(18, 14, 25, 0.92);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 122, 26, 0.45);
      border-radius: 999px;
      padding: 7px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    }
    .toolbar span {
      font-size: 12.5px;
      font-family: monospace;
      color: #ff9a3c;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .btn {
      padding: 7px 16px;
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, #ff7a1a 0%, #e05e00 100%);
      color: #000;
      font-size: 12.5px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 150ms ease;
      box-shadow: 0 4px 12px rgba(255, 122, 26, 0.25);
    }
    .btn:hover { background: #ffa95c; transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      box-shadow: none;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.22); }
    .cert-frame {
      box-sizing: border-box;
      width: min(95vw, 1320px);
      max-width: 1320px;
      margin: 64px auto 30px;
      padding: 0;
      display: block;
      filter: drop-shadow(0 25px 60px rgba(0,0,0,0.9));
    }
    .cert-frame svg {
      display: block;
      width: 100% !important;
      height: auto !important;
      max-width: 100%;
      aspect-ratio: 1120 / 792;
      border-radius: 14px;
      box-shadow: 0 0 50px rgba(255, 122, 26, 0.2), 0 0 0 1px rgba(255, 122, 26, 0.35);
    }
    @page {
      size: A4 landscape;
      margin: 0;
    }
    @media print {
      html, body {
        width: 297mm !important;
        height: 210mm !important;
        max-width: 297mm !important;
        max-height: 210mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #FAF6EE !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
        overflow: hidden !important;
      }
      .toolbar {
        display: none !important;
      }
      .cert-frame {
        width: 297mm !important;
        height: 210mm !important;
        max-width: 297mm !important;
        max-height: 210mm !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        filter: none !important;
        box-shadow: none !important;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: avoid;
      }
      .cert-frame svg {
        width: 297mm !important;
        height: 210mm !important;
        max-width: 297mm !important;
        max-height: 210mm !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>📜 ${effectiveCertId}</span>
    <a class="btn" href="/api/certificate-render?certId=${encodeURIComponent(effectiveCertId)}&memberId=${encodeURIComponent(member.id)}&format=png" download="${effectiveCertId}.png">🖼️ Download PNG</a>
    <button class="btn btn-secondary" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>

  <div class="cert-frame">
    ${svg}
  </div>
</body>
</html>`;

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end(html);
  } catch (err) {
    console.error('Certificate render error:', err);
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end(`<h1>Error generating certificate</h1><p>${err.message}</p>`);
  }
}

function escapeHtml(val) {
  return String(val || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
