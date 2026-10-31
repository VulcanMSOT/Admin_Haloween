import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { prisma } from '../api/_lib/prisma.js';

async function generateQRPdf() {
  console.log('=== GENERATING EVALUATION & LEADERBOARD QR CODES PDF ===\n');

  // Fetch all confirmed (PAID) teams sorted by Team ID
  const teams = await prisma.registration.findMany({
    where: { paymentStatus: 'PAID' },
    orderBy: { teamId: 'asc' },
    include: {
      members: { orderBy: { position: 'asc' } },
    },
  });

  console.log(`Found ${teams.length} confirmed teams to generate QRs for.`);

  // -------------------------------------------------------------
  // PDF 1: 4 Cards per A4 Page (Grid 2x2) - Ideal for Badges & Table Stands
  // -------------------------------------------------------------
  const doc4 = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 10;
  const marginY = 12;
  const cardGapX = 8;
  const cardGapY = 8;
  const cardWidth = (pageWidth - 2 * marginX - cardGapX) / 2; // ~91 mm
  const cardHeight = (pageHeight - 2 * marginY - cardGapY) / 2; // ~132.5 mm

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const pageIndex = Math.floor(i / 4);
    const cardSlot = i % 4; // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right

    if (i > 0 && cardSlot === 0) {
      doc4.addPage();
    }

    const col = cardSlot % 2;
    const row = Math.floor(cardSlot / 2);
    const cardX = marginX + col * (cardWidth + cardGapX);
    const cardY = marginY + row * (cardHeight + cardGapY);

    // Generate high-resolution QR code encoding exact team name (220px is razor sharp for ~20 module QR)
    const qrDataUrl = await QRCode.toDataURL(team.teamName, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 220,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // 1. Outer card border (dashed cut line)
    doc4.setDrawColor(180, 180, 180);
    doc4.setLineDashPattern([2, 2], 0);
    doc4.rect(cardX, cardY, cardWidth, cardHeight, 'S');
    doc4.setLineDashPattern([], 0); // reset to solid

    // 2. Card header background
    doc4.setFillColor(24, 24, 24);
    doc4.roundedRect(cardX + 2, cardY + 2, cardWidth - 4, 18, 2, 2, 'F');

    // Header Title
    doc4.setTextColor(255, 122, 26); // Orange
    doc4.setFont('helvetica', 'bold');
    doc4.setFontSize(9);
    doc4.text('HACK-O-LANTERN 2026', cardX + cardWidth / 2, cardY + 8, { align: 'center' });

    doc4.setTextColor(200, 200, 200);
    doc4.setFont('helvetica', 'normal');
    doc4.setFontSize(6.5);
    doc4.text('EVALUATION & LEADERBOARD QR PASS', cardX + cardWidth / 2, cardY + 14, { align: 'center' });

    // 3. Team ID Pill
    const teamIdText = team.teamId || team.orderRef || 'TEAM';
    doc4.setFillColor(235, 240, 245);
    doc4.roundedRect(cardX + (cardWidth - 28) / 2, cardY + 23, 28, 6.5, 3, 3, 'F');
    doc4.setTextColor(20, 20, 20);
    doc4.setFont('helvetica', 'bold');
    doc4.setFontSize(8.5);
    doc4.text(teamIdText, cardX + cardWidth / 2, cardY + 27.5, { align: 'center' });

    // 4. Team Name (Large & Centered with dynamic sizing)
    doc4.setTextColor(15, 23, 42);
    doc4.setFont('helvetica', 'bold');
    let teamNameFontSize = 14;
    if (team.teamName.length > 20) teamNameFontSize = 10.5;
    else if (team.teamName.length > 14) teamNameFontSize = 12;
    doc4.setFontSize(teamNameFontSize);
    doc4.text(team.teamName, cardX + cardWidth / 2, cardY + 36, { align: 'center', maxWidth: cardWidth - 8 });

    // 5. QR Code Image (Centered)
    const qrSize = 52;
    const qrX = cardX + (cardWidth - qrSize) / 2;
    const qrY = cardY + 41;
    doc4.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // 6. Scan Value Label
    doc4.setTextColor(70, 70, 70);
    doc4.setFont('helvetica', 'normal');
    doc4.setFontSize(7);
    doc4.text('Scan value:', cardX + cardWidth / 2, cardY + 97, { align: 'center' });

    doc4.setTextColor(0, 100, 0);
    doc4.setFont('helvetica', 'bold');
    doc4.setFontSize(7.5);
    doc4.text(`"${team.teamName}"`, cardX + cardWidth / 2, cardY + 101, { align: 'center', maxWidth: cardWidth - 8 });

    // 7. Divider
    doc4.setDrawColor(220, 220, 220);
    doc4.line(cardX + 6, cardY + 104, cardX + cardWidth - 6, cardY + 104);

    // 8. Roster Summary at Bottom
    const leader = team.members.find((m) => m.position === 1) || team.members[0];
    const otherMembers = team.members.filter((m) => m !== leader);

    doc4.setTextColor(40, 40, 40);
    doc4.setFont('helvetica', 'bold');
    doc4.setFontSize(6.5);
    doc4.text(`Leader: ${leader?.fullName || '—'}`, cardX + 6, cardY + 109, { maxWidth: cardWidth - 12 });

    doc4.setFont('helvetica', 'normal');
    doc4.setTextColor(100, 100, 100);
    const membersSummary = otherMembers.map((m) => m.fullName).join(', ');
    if (membersSummary) {
      doc4.text(`Members: ${membersSummary}`, cardX + 6, cardY + 114, { maxWidth: cardWidth - 12 });
    }

    const college = leader?.college || 'Mirai School of Technology';
    doc4.text(`Org: ${college}`, cardX + 6, cardY + 119, { maxWidth: cardWidth - 12 });

    // Footer note
    doc4.setFontSize(5.5);
    doc4.setTextColor(150, 150, 150);
    doc4.text('Mirai Floor · 31 Oct - 1 Nov 2026', cardX + cardWidth / 2, cardY + cardHeight - 3, { align: 'center' });
  }

  const outDir = path.resolve(import.meta.dirname, '../public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const pdfPath4 = path.join(outDir, 'hack_o_lantern_team_qrs_4per_page.pdf');
  const buffer4 = Buffer.from(doc4.output('arraybuffer'));
  fs.writeFileSync(pdfPath4, buffer4);
  console.log(`✓ 4-Cards-per-page PDF successfully created: ${pdfPath4} (${(buffer4.length / 1024).toFixed(1)} KB, ${Math.ceil(teams.length / 4)} pages)`);

  // -------------------------------------------------------------
  // PDF 2: 1 Large Table Tent per A4 Page (Landscape)
  // -------------------------------------------------------------
  const doc1 = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const lsWidth = 297;
  const lsHeight = 210;

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    if (i > 0) doc1.addPage();

    const qrDataUrl = await QRCode.toDataURL(team.teamName, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Dark sleek frame
    doc1.setDrawColor(255, 122, 26);
    doc1.setLineWidth(1.5);
    doc1.roundedRect(12, 12, lsWidth - 24, lsHeight - 24, 6, 6, 'S');
    doc1.setLineWidth(0.2);

    // Top banner
    doc1.setFillColor(18, 18, 18);
    doc1.roundedRect(14, 14, lsWidth - 28, 26, 4, 4, 'F');

    doc1.setTextColor(255, 154, 77);
    doc1.setFont('helvetica', 'bold');
    doc1.setFontSize(14);
    doc1.text('HACK-O-LANTERN 2026', lsWidth / 2, 24, { align: 'center' });

    doc1.setTextColor(220, 220, 220);
    doc1.setFont('helvetica', 'normal');
    doc1.setFontSize(9);
    doc1.text('OFFICIAL PROJECT EVALUATION & LEADERBOARD PLACARD', lsWidth / 2, 33, { align: 'center' });

    // Team ID
    doc1.setFillColor(240, 244, 248);
    doc1.roundedRect(25, 48, 50, 12, 3, 3, 'F');
    doc1.setTextColor(0, 0, 0);
    doc1.setFont('helvetica', 'bold');
    doc1.setFontSize(14);
    doc1.text(team.teamId || 'TEAM', 50, 56, { align: 'center' });

    // Big Team Name
    doc1.setTextColor(15, 23, 42);
    doc1.setFont('helvetica', 'bold');
    let bigFontSize = 26;
    if (team.teamName.length > 20) bigFontSize = 18;
    else if (team.teamName.length > 15) bigFontSize = 22;
    doc1.setFontSize(bigFontSize);
    doc1.text(team.teamName, 85, 57);

    // QR Code on the right side
    const largeQrSize = 105;
    const largeQrX = lsWidth - largeQrSize - 25;
    const largeQrY = 70;
    doc1.addImage(qrDataUrl, 'PNG', largeQrX, largeQrY, largeQrSize, largeQrSize);

    // Label under QR
    doc1.setTextColor(80, 80, 80);
    doc1.setFont('helvetica', 'normal');
    doc1.setFontSize(10);
    doc1.text('Scan for evaluation / leaderboard:', largeQrX + largeQrSize / 2, largeQrY + largeQrSize + 7, { align: 'center' });

    doc1.setTextColor(0, 128, 0);
    doc1.setFont('helvetica', 'bold');
    doc1.setFontSize(11);
    doc1.text(`"${team.teamName}"`, largeQrX + largeQrSize / 2, largeQrY + largeQrSize + 13, { align: 'center' });

    // Left Side Details Box
    doc1.setFillColor(248, 249, 250);
    doc1.roundedRect(25, 70, 130, 95, 4, 4, 'F');
    doc1.setDrawColor(230, 230, 230);
    doc1.roundedRect(25, 70, 130, 95, 4, 4, 'S');

    doc1.setTextColor(20, 20, 20);
    doc1.setFont('helvetica', 'bold');
    doc1.setFontSize(12);
    doc1.text('Registered Team Roster', 32, 82);

    doc1.setFont('helvetica', 'normal');
    doc1.setFontSize(10);
    let memberY = 93;
    team.members.forEach((m, idx) => {
      doc1.setFont('helvetica', 'bold');
      doc1.text(`${idx + 1}. ${m.fullName}`, 32, memberY);
      doc1.setFont('helvetica', 'normal');
      doc1.setTextColor(100, 100, 100);
      doc1.text(`(${m.college || 'Mirai School of Technology'})`, 32, memberY + 5);
      doc1.setTextColor(20, 20, 20);
      memberY += 12;
    });

    // Venue footer
    doc1.setTextColor(120, 120, 120);
    doc1.setFontSize(9);
    doc1.text('Venue: Mirai Floor, Bengaluru · Night of 31 Oct - 1 Nov 2026', 25, 185);
  }

  const pdfPath1 = path.join(outDir, 'hack_o_lantern_team_qrs_large_placards.pdf');
  const buffer1 = Buffer.from(doc1.output('arraybuffer'));
  fs.writeFileSync(pdfPath1, buffer1);
  console.log(`✓ 1-Card-per-page Placard PDF successfully created: ${pdfPath1} (${(buffer1.length / 1024).toFixed(1)} KB, ${teams.length} pages)`);

  const adminPublicDir = path.resolve(import.meta.dirname, '../public');
  if (!fs.existsSync(adminPublicDir)) {
    fs.mkdirSync(adminPublicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(adminPublicDir, 'hack_o_lantern_team_qrs_4per_page.pdf'), buffer4);
  fs.writeFileSync(path.join(adminPublicDir, 'hack_o_lantern_team_qrs_large_placards.pdf'), buffer1);

  const rootPublicDir = path.resolve(import.meta.dirname, '../../public');
  if (fs.existsSync(rootPublicDir)) {
    fs.writeFileSync(path.join(rootPublicDir, 'hack_o_lantern_team_qrs_4per_page.pdf'), buffer4);
    fs.writeFileSync(path.join(rootPublicDir, 'hack_o_lantern_team_qrs_large_placards.pdf'), buffer1);
  }
  console.log('✓ Copied PDFs to both Vulcan-admin/public and root public/ for web downloads!');

  process.exit(0);
}

generateQRPdf().catch((err) => {
  console.error('Error generating QR PDF:', err);
  process.exit(1);
});
