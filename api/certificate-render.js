import { prisma } from './_lib/prisma.js';
import { generateCertificateId, generateCertificateSvg } from './_lib/certificate-generator.js';

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

    const svg = await generateCertificateSvg({
      certificateId: effectiveCertId,
      participantName: member.fullName,
      collegeName: member.college,
      teamName: registration.teamName,
      teamId: registration.teamId,
      trackName: 'Open Innovation & Systems',
      issueDate: 'November 1, 2026',
    });

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
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #060509;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .toolbar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      background: rgba(18, 14, 25, 0.88);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 122, 26, 0.35);
      border-radius: 999px;
      padding: 6px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    .toolbar span {
      font-size: 12px;
      font-family: monospace;
      color: #ff9a3c;
      font-weight: 700;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 999px;
      border: none;
      background: #ff7a1a;
      color: #000;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 150ms ease;
    }
    .btn:hover { background: #ffa95c; transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.2); }
    .cert-frame {
      width: 100%;
      max-width: 1120px;
      margin: 80px auto 40px;
      padding: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      filter: drop-shadow(0 20px 50px rgba(0,0,0,0.8));
    }
    .cert-frame svg {
      width: 100%;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 0 40px rgba(255, 122, 26, 0.15);
    }
    @media print {
      body { background: transparent; }
      .toolbar { display: none !important; }
      .cert-frame {
        max-width: none;
        width: 100%;
        height: 100vh;
        margin: 0;
        padding: 0;
        filter: none;
      }
      .cert-frame svg {
        border-radius: 0;
        box-shadow: none;
      }
      @page {
        size: A4 landscape;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>📜 ${effectiveCertId}</span>
    <button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button>
    <a class="btn btn-secondary" href="/api/certificate-render?certId=${encodeURIComponent(effectiveCertId)}&memberId=${encodeURIComponent(member.id)}&format=svg" download="${effectiveCertId}.svg">⬇️ Download SVG</a>
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
