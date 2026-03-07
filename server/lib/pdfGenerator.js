// --- Supervisor Grading Layout Helpers ---
const drawSummaryCard = (doc, x, y, w, stats) => {
  const pad = 14;
  const rowH = 16;
  const rows = [
    ['Total Weeks Submitted', stats.total],
    ['Approved', stats.approved],
    ['Rejected', stats.rejected],
    ['Pending', stats.pending],
  ];
  const titleH = 18;
  const h = pad + titleH + 10 + rows.length * rowH + pad;
  doc.save();
  doc.roundedRect(x, y, w, h, 14).fill('#FFFFFF');
  doc.roundedRect(x, y, w, h, 14).strokeColor('#E5E7EB').lineWidth(1).stroke();
  doc.restore();
  setFont(doc, 'semibold');
  doc.fontSize(11).fillColor(UI.primary).text('Weekly Reports Summary', x + pad, y + pad);
  let ry = y + pad + titleH + 10;
  for (const [label, value] of rows) {
    setFont(doc, 'regular');
    doc.fontSize(10).fillColor(UI.secondary).text(label, x + pad, ry, { width: w * 0.65 });
    setFont(doc, 'semibold');
    doc.fontSize(10).fillColor(UI.primary).text(String(value), x + pad, ry, {
      width: w - pad * 2,
      align: 'right',
    });
    ry += rowH;
  }
  return y + h + 18;
};

const drawWeekStatusTable = async (doc, weeksData, addPageWithHeader, logoPath) => {
  const x = 50;
  const tableW = doc.page.width - 100;
  const col = {
    week: 50,
    status: 110,
    comments: tableW - (50 + 110),
  };
  const rowH = 18;
  const drawHeader = () => {
    setFont(doc, 'bold');
    doc.fontSize(14).fillColor(UI.primary).text('Week-by-Week Status', x, doc.y);
    doc.moveDown(0.6);
    const hy = doc.y;
    setFont(doc, 'semibold');
    doc.fontSize(10).fillColor(UI.accent);
    doc.text('Week', x, hy, { width: col.week });
    doc.text('Status', x + col.week, hy, { width: col.status });
    doc.text('Comments', x + col.week + col.status, hy, { width: col.comments });
    doc.y = hy + 16;
    doc.strokeColor('#E5E7EB').lineWidth(1)
      .moveTo(x, doc.y)
      .lineTo(x + tableW, doc.y)
      .stroke();
    doc.moveDown(0.4);
  };
  const ensureSpace = async (need) => {
    const bottom = doc.page.height - 90;
    if (doc.y + need > bottom) {
      doc.addPage();
      await addMTUHeader(doc, logoPath);
      drawHeader();
    }
  };
  const statusToPill = (statusRaw) => {
    const st = (statusRaw || 'draft').toLowerCase();
    if (st === 'approved') return { bg: '#DCFCE7', fg: '#166534', text: 'APPROVED' };
    if (st === 'rejected') return { bg: '#FEE2E2', fg: '#991B1B', text: 'REJECTED' };
    if (st === 'submitted') return { bg: '#DBEAFE', fg: '#1D4ED8', text: 'PENDING' };
    return { bg: '#F3F4F6', fg: '#374151', text: 'PENDING' };
  };
  const drawPill = (px, py, pill) => {
    const pillW = 86;
    const pillH = 14;
    doc.save();
    doc.roundedRect(px, py + 2, pillW, pillH, 7).fill(pill.bg);
    setFont(doc, 'medium');
    doc.fontSize(8).fillColor(pill.fg).text(pill.text, px, py + 5, { width: pillW, align: 'center' });
    doc.restore();
  };
  drawHeader();
  for (const w of weeksData) {
    await ensureSpace(rowH + 6);
    const y = doc.y;
    setFont(doc, 'regular');
    doc.fontSize(9).fillColor(UI.primary).text(String(w.week_number), x, y, { width: col.week });
    const pill = statusToPill(w.status);
    drawPill(x + col.week, y, pill);
    const comment = (w.supervisor_comment || 'N/A').replace(/\s+/g, ' ').trim();
    const commentShort = comment.length > 80 ? comment.slice(0, 77) + '...' : comment;
    setFont(doc, 'regular');
    doc.fontSize(9).fillColor(UI.primary).text(commentShort, x + col.week + col.status, y, {
      width: col.comments,
    });
    doc.strokeColor('#F3F4F6').lineWidth(1)
      .moveTo(x, y + rowH)
      .lineTo(x + tableW, y + rowH)
      .stroke();
    doc.y = y + rowH + 4;
  }
};
// --- PDFKit Flow Helpers ---
const ensureSpace = async (doc, neededHeight, addPageWithHeader) => {
  const bottomLimit = doc.page.height - (doc.page.margins.bottom || 50);
  if (doc.y + neededHeight > bottomLimit) {
    await addPageWithHeader();
  }
};

// Draw footer on EVERY page safely
const addFooterAllPages = (doc, drawFooter) => {
  const range = doc.bufferedPageRange(); // { start, count }
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(i + 1, range.count);
  }
};
/**
 * PDF Generation Service
 * Generates MTU-branded PDFs for student summaries and supervisor grading
 */



import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- UI THEME & FONTS ---
const UI = {
  primary: '#1f2937',     // near-black (modern)
  secondary: '#6b7280',   // gray text
  accent: '#612E89',      // MTU purple
  soft: '#f9fafb',        // card background
  border: '#e5e7eb',      // subtle lines
};

// ------------------------- 
// Fonts (Poppins) - SAFE
// -------------------------
const FONT_DIR = path.join(__dirname, '../assets/fonts');

const POPPINS = {
  regular: path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  medium: path.join(FONT_DIR, 'Poppins-Medium.ttf'),
  semibold: path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
  bold: path.join(FONT_DIR, 'Poppins-Bold.ttf'),
};

const hasFont = (p) => {
  try { return fs.existsSync(p); } catch { return false; }
};

const registerFonts = (doc) => {
  if (hasFont(POPPINS.regular)) doc.registerFont('Poppins', POPPINS.regular);
  if (hasFont(POPPINS.medium)) doc.registerFont('Poppins-Medium', POPPINS.medium);
  if (hasFont(POPPINS.semibold)) doc.registerFont('Poppins-SemiBold', POPPINS.semibold);
  if (hasFont(POPPINS.bold)) doc.registerFont('Poppins-Bold', POPPINS.bold);
};

const setFont = (doc, which = 'regular') => {
  const map = {
    regular: 'Poppins',
    medium: 'Poppins-Medium',
    semibold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
  };
  const name = map[which] || 'Poppins';
  try {
    doc.font(name);
  } catch {
    doc.font(which === 'bold' || which === 'semibold' ? 'Helvetica-Bold' : 'Helvetica');
  }
};

// =========================
// Premium Layout Helpers
// =========================
const SPACING = {
  pageX: 50,
  topAfterHeader: 110,
  cardPad: 16,
  gap: 12,
};

const safeText = (v, fallback = 'N/A') => (v === null || v === undefined || String(v).trim() === '' ? fallback : String(v));

const hr = (doc, y, color = UI.border) => {
  doc.save();
  doc.strokeColor(color).lineWidth(1);
  doc.moveTo(SPACING.pageX, y).lineTo(doc.page.width - SPACING.pageX, y).stroke();
  doc.restore();
};

const pill = (doc, x, y, text, { bg = '#EEF2FF', fg = UI.accent } = {}) => {
  setFont(doc, 'medium');
  doc.fontSize(9);
  const padX = 10, padY = 4;
  const w = doc.widthOfString(text) + padX * 2;
  const h = 16;
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fill(bg);
  doc.fillColor(fg).text(text, x + padX, y + 4, { lineBreak: false });
  doc.restore();
  return { w, h };
};

const sectionTitle = (doc, title, subtitle = null) => {
  setFont(doc, 'bold');
  doc.fontSize(14).fillColor(UI.primary).text(title);
  if (subtitle) {
    setFont(doc, 'regular');
    doc.fontSize(10).fillColor(UI.secondary).text(subtitle);
  }
  doc.moveDown(0.6);
};

const card = (doc, { x, y, w, h }) => {
  doc.save();
  doc.roundedRect(x, y, w, h, 14).fill('#FFFFFF');
  doc.roundedRect(x, y, w, h, 14).strokeColor(UI.border).lineWidth(1).stroke();
  doc.restore();
};

const cardHeader = (doc, x, y, title) => {
  setFont(doc, 'semibold');
  doc.fontSize(11).fillColor(UI.accent).text(title, x, y);
};

const kvRow = (doc, x, y, label, value, { labelW = 150, valueW = 320 } = {}) => {
  setFont(doc, 'medium');
  doc.fontSize(10).fillColor(UI.secondary).text(label, x, y, { width: labelW });
  setFont(doc, 'regular');
  doc.fontSize(10).fillColor(UI.primary).text(safeText(value), x + labelW, y, { width: valueW });
};

const statusStyle = (statusRaw) => {
  const status = (statusRaw || '').toLowerCase();
  if (status === 'approved') return { bg: '#DCFCE7', fg: '#166534', text: 'APPROVED' };
  if (status === 'rejected') return { bg: '#FEE2E2', fg: '#991B1B', text: 'REJECTED' };
  if (status === 'submitted') return { bg: '#DBEAFE', fg: '#1D4ED8', text: 'SUBMITTED' };
  return { bg: '#F3F4F6', fg: '#374151', text: (statusRaw || 'DRAFT').toUpperCase() };
};


/**
 * Fetch an image from a URL and return as a buffer
 * Used for embedding profile pictures in PDFs
 * @param {string} imageUrl - URL of the image to fetch
 * @returns {Promise<Buffer|null>} - Image buffer or null if fetch fails
 */
const fetchImageBuffer = async (imageUrl) => {
  if (!imageUrl) return null;
  
  return new Promise((resolve) => {
    try {
      const protocol = imageUrl.startsWith('https') ? https : http;
      const request = protocol.get(imageUrl, { timeout: 5000 }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return fetchImageBuffer(response.headers.location).then(resolve);
        }
        
        if (response.statusCode !== 200) {
          console.log(`[PDF] Failed to fetch image: HTTP ${response.statusCode}`);
          return resolve(null);
        }
        
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // Basic validation - check if it looks like an image
          if (buffer.length > 100) {
            resolve(buffer);
          } else {
            console.log('[PDF] Image buffer too small, likely invalid');
            resolve(null);
          }
        });
        response.on('error', () => resolve(null));
      });
      
      request.on('error', (err) => {
        console.log('[PDF] Error fetching image:', err.message);
        resolve(null);
      });
      
      request.on('timeout', () => {
        console.log('[PDF] Image fetch timed out');
        request.destroy();
        resolve(null);
      });
    } catch (err) {
      console.log('[PDF] Exception fetching image:', err.message);
      resolve(null);
    }
  });
};

/**
 * Add MTU header to PDF page
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {string} logoPath - Path to MTU logo image
 */
export const addMTUHeader = async (doc, logoPath = null) => {
  const pageWidth = doc.page.width;
  const headerH = 86;

  // White header
  doc.save();
  doc.rect(0, 0, pageWidth, headerH).fill('#FFFFFF');

  // Accent bar
  doc.rect(0, 0, pageWidth, 6).fill(UI.accent);

  // Divider
  doc.strokeColor(UI.border).lineWidth(1);
  doc.moveTo(0, headerH).lineTo(pageWidth, headerH).stroke();

  // Logo
  if (logoPath && fs.existsSync(logoPath)) {
    try { doc.image(logoPath, SPACING.pageX, 18, { width: 44 }); } catch {}
  }

  // Text
  const textX = SPACING.pageX + 58;
  setFont(doc, 'bold');
  doc.fontSize(16).fillColor(UI.primary).text('Mountain Top University', textX, 24);

  setFont(doc, 'regular');
  doc.fontSize(9).fillColor(UI.secondary).text('Empowered to Excel', textX, 46);

  doc.restore();

  // Content start
  doc.y = headerH + 22;
};

/**
 * Generate Student 24-Week Summary PDF
 * @param {Object} studentData - Student information
 * @param {Array} weeksData - Array of weekly reports (24 weeks)
 * @param {Object} industrySupervisor - Industry supervisor info
 * @param {string} outputPath - Path to save PDF
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generateStudentPDF = async (
  studentData,
  weeksData,
  industrySupervisor,
  outputPath
) => {
  console.log('[PDF] Using new Student Summary PDF design');
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 50, left: 50, right: 50 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Register fonts safely
      registerFonts(doc);

      // ...existing code...

      // First page header
      await addMTUHeader(doc, logoPath);

      // Title Card (modern editorial look)
      drawCard(doc, 40, doc.y, doc.page.width - 80, 120);
      doc.font('Poppins-Bold')
        .fontSize(26)
        .fillColor(UI.primary)
        .text('SIWES 24-Week Summary Report', 40, doc.y + 32, { align: 'center' });
      doc.font('Poppins')
        .fontSize(13)
        .fillColor(UI.secondary)
        .text('Generated on: ' + new Date().toLocaleDateString(), { align: 'center' });
      doc.moveDown(5);

      // Student Information Card (modern grid feel)
      drawCard(doc, 40, doc.y, doc.page.width - 80, 150);
      doc.font('Poppins-Bold')
        .fontSize(14)
        .fillColor(UI.primary)
        .text('Student Information', 60, doc.y + 16);
      doc.font('Poppins')
        .fontSize(11)
        .fillColor(UI.secondary)
        .text(`Name: ${studentData.full_name || studentData.name}`, 60, doc.y + 48)
        .text(`Matriculation Number: ${studentData.matric_no}`, 60, doc.y + 70)
        .text(`Department: ${studentData.department}`, 60, doc.y + 92)
        .text(`Faculty: ${studentData.faculty}`, 60, doc.y + 114);
      doc.moveDown(7);

      // Weekly Activities Card (modern look)
      drawCard(doc, 40, doc.y, doc.page.width - 80, 80);
      doc.font('Poppins-Bold')
        .fontSize(15)
        .fillColor(UI.primary)
        .text('Weekly Activities Summary', 60, doc.y + 16);
      doc.moveDown(5);
      
      // Create a condensed weekly summary table to fit in 3 pages max
      // Page 1: Student info + Weeks 1-12 (table format)
      // Page 2: Weeks 13-24 (table format)  
      // Page 3: Supervisor sections + signatures
      
      // Create table for weeks 1-12 on first page
      const tableTop = doc.y + 10;
      const tableLeft = 50;
      const colWidths = { week: 40, activities: doc.page.width - 150, score: 40 };
      
      // Table header
      doc.font('Poppins-Bold')
        .fontSize(10)
        .fillColor(UI.accent)
        .text('Week', tableLeft, tableTop)
        .text('Activities Summary', tableLeft + colWidths.week + 10, tableTop)
        .text('Score', doc.page.width - 90, tableTop);
      doc.moveDown(0.3);
      doc.strokeColor(UI.border)
        .moveTo(tableLeft, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();
      
      // Weeks 1-12 (first page)
      let weekRow = 0;
      let totalScore = 0;
      let scoredWeeks = 0;

      for (let i = 0; i < Math.min(12, weeksData.length); i++) {
        const week = weeksData[i];
        
        if (week.score !== null && week.score !== undefined) {
          totalScore += Number(week.score);
          scoredWeeks++;
        }

        // Check if we need new page (max 12 weeks per page)
        if (weekRow > 0 && weekRow % 12 === 0) {
          await addPageWithHeader();
          // Redraw table header
          const newTableTop = doc.y + 10;
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor('#612E89')
             .text('Week', tableLeft, newTableTop)
             .text('Activities Summary', tableLeft + colWidths.week + 10, newTableTop)
             .text('Score', doc.page.width - 90, newTableTop);
          doc.moveDown(0.3);
          doc.strokeColor('#cccccc')
             .moveTo(tableLeft, doc.y)
             .lineTo(doc.page.width - 50, doc.y)
             .stroke();
        }
        
        // Combine activities into very short summary (max 70 chars)
        const activities = [
          week.monday_activity,
          week.tuesday_activity,
          week.wednesday_activity,
          week.thursday_activity,
          week.friday_activity,
          week.saturday_activity
        ].filter(Boolean);
        
        const summary = activities.length > 0 
          ? activities.join('; ').substring(0, 70) + (activities.join('; ').length > 70 ? '...' : '')
          : 'No activities';
        
        doc.font('Poppins')
           .fontSize(9)
           .fillColor(UI.secondary)
           .text(`${week.week_number}`, tableLeft, doc.y)
           .text(summary, tableLeft + colWidths.week + 10, doc.y, {
             width: colWidths.activities - 40,
             continued: false
           })
           .text(week.score !== null && week.score !== undefined ? week.score : '-', doc.page.width - 90, doc.y);
        doc.moveDown(0.25);
        weekRow++;
      }
      
      // Weeks 13-24 on second page (if needed)
      if (weeksData.length > 12) {
        await addPageWithHeader();
        
        // Table header for page 2
        const tableTop2 = doc.y + 10;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#612E89')
           .text('Week', tableLeft, tableTop2)
           .text('Activities Summary', tableLeft + colWidths.week + 10, tableTop2)
           .text('Score', doc.page.width - 90, tableTop2);
        
        doc.moveDown(0.3);
        doc.strokeColor('#cccccc')
           .moveTo(tableLeft, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke();
        
        for (let i = 12; i < Math.min(24, weeksData.length); i++) {
          const week = weeksData[i];
          
          if (week.score !== null && week.score !== undefined) {
            totalScore += Number(week.score);
            scoredWeeks++;
          }

          const activities = [
            week.monday_activity,
            week.tuesday_activity,
            week.wednesday_activity,
            week.thursday_activity,
            week.friday_activity,
            week.saturday_activity
          ].filter(Boolean);
          
          const summary = activities.length > 0 
            ? activities.join('; ').substring(0, 70) + (activities.join('; ').length > 70 ? '...' : '')
            : 'No activities';
          
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor('black')
             .text(`${week.week_number}`, tableLeft, doc.y)
             .text(summary, tableLeft + colWidths.week + 10, doc.y, {
               width: colWidths.activities - 40,
               continued: false
             })
             .text(week.score !== null && week.score !== undefined ? week.score : '-', doc.page.width - 90, doc.y);
          
          doc.moveDown(0.25);
        }
      }

      // Add Average Score
      if (scoredWeeks > 0) {
        const averageScore = (totalScore / scoredWeeks).toFixed(1);
        doc.moveDown();
            doc.font('Poppins-Bold')
              .fontSize(12)
              .fillColor(UI.primary)
              .text(`Average Score: ${averageScore} / 100`, { align: 'right' });
      }
      
      // Page 3: Supervisor sections and signatures
      await addPageWithHeader();
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Industry Supervisor Section', doc.x, doc.y);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');
      
      // Industry Supervisor Name
      doc.text(`Supervisor Name: ${industrySupervisor.name || '___________________'}`, { indent: 20 });
      doc.moveDown(0.3);
      
      // Phone Number
      doc.text(`Phone Number: ${industrySupervisor.phone || '___________________'}`, { indent: 20 });
      doc.moveDown(0.5);
      
      // Signature and Stamp Box
      doc.text('Signature & Stamp:', { indent: 20 });
      doc.rect(50, doc.y, 200, 80)
         .stroke();
      doc.moveDown(4);
      
      // General Performance Evaluation
      doc.text('General Performance Evaluation:', { indent: 20 });
      doc.rect(50, doc.y, doc.page.width - 100, 100)
         .stroke();
      doc.moveDown(5);
      
      // ITF Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('ITF Verification Section', doc.x, doc.y);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text('ITF Signature & Stamp:', { indent: 20 });
      doc.rect(50, doc.y, 200, 80)
         .stroke();
      
      doc.moveDown(4);
      
      // School Supervisor Grading Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('School Supervisor Grading', doc.x, doc.y);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text('Grade: ___________ (A/B/C/D/F)', { indent: 20 });
      doc.moveDown(0.3);
      doc.text('Score: ___________ / 100', { indent: 20 });
      doc.moveDown(0.5);
      doc.text('Grading Scale:', { indent: 20 });
      doc.fontSize(10)
         .text('A = 70-100 | B = 60-69 | C = 50-59 | D = 45-49 | F = Below 40', { indent: 40 });
      doc.moveDown(0.5);
      doc.text('Supervisor Signature:', { indent: 20 });
      doc.rect(50, doc.y, 200, 60)
         .stroke();
      
      // Footer on each page (minimal, premium)
      const addFooter = (pageNum = 1, totalPages = 1) => {
        doc.font('Poppins')
           .fontSize(8)
           .fillColor('#9ca3af')
           .text(
             `Mountain Top University • SIWES Logbook • Page ${pageNum}/${totalPages}`,
             50,
             doc.page.height - 28,
             { align: 'center', width: doc.page.width - 100 }
           );
      };
      // Add footer to all pages
      const pageCount = doc.pageCount || 1;
      for (let i = 0; i < pageCount; i++) {
        addFooter(i + 1, pageCount);
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(outputPath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Supervisor Grading PDF
 * @param {Object} supervisorData - Supervisor information
 * @param {Object} studentData - Student information (including profile_image_url)
 * @param {Array} weeksData - Array of all weekly reports with status
 * @param {Object} gradeData - Grading information
 * @param {string} outputPath - Path to save PDF
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generateSupervisorPDF = async (
  supervisorData,
  studentData,
  weeksData,
  gradeData,
  outputPath
) => {
  console.log('[PDF] Using new Supervisor Grading PDF design (premium UI)');
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 60, left: 50, right: 50 },
        bufferPages: true,
      });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      registerFonts(doc);
      const possiblePaths = [
        path.join(__dirname, '../../public/mtu-logo.png'),
        path.join(__dirname, '../../../public/mtu-logo.png'),
        path.join(__dirname, '../../../../public/mtu-logo.png'),
        path.join(process.cwd(), 'public/mtu-logo.png'),
        path.join(process.cwd(), 'src/assets/mtu-logo.png'),
      ];
      let logoPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { logoPath = p; break; }
      }
      // Pre-fetch student profile image if available
      let profileImageBuffer = null;
      if (studentData.profile_image_url) {
        profileImageBuffer = await fetchImageBuffer(studentData.profile_image_url);
      }
      const addPageWithHeader = async () => {
        doc.addPage();
        await addMTUHeader(doc, logoPath);
      };
      await addMTUHeader(doc, logoPath);
      // Title
      setFont(doc, 'bold');
      doc.fontSize(20).fillColor(UI.accent).text('SIWES Supervisor Grading Report', { align: 'center' });
      doc.moveDown(0.8);
      // Student Card (with photo)
      const x = SPACING.pageX;
      const w = doc.page.width - SPACING.pageX * 2;
      const y = doc.y;
      const h = 120;
      card(doc, { x, y, w, h });
      cardHeader(doc, x + SPACING.cardPad, y + 14, 'Student Information');
      // Photo (right)
      const photoSize = 70;
      const photoX = x + w - SPACING.cardPad - photoSize;
      const photoY = y + 24;
      if (profileImageBuffer) {
        try {
          doc.save();
          doc.rect(photoX, photoY, photoSize, photoSize).strokeColor(UI.accent).lineWidth(2).stroke();
          doc.image(profileImageBuffer, photoX + 2, photoY + 2, { fit: [photoSize - 4, photoSize - 4] });
          doc.restore();
        } catch {
          doc.rect(photoX, photoY, photoSize, photoSize).strokeColor('#cccccc').lineWidth(1).stroke();
        }
      } else {
        doc.rect(photoX, photoY, photoSize, photoSize).strokeColor('#cccccc').lineWidth(1).stroke();
        setFont(doc, 'regular');
        doc.fontSize(8).fillColor('#999999').text('No Photo', photoX, photoY + photoSize/2 - 5, { width: photoSize, align: 'center' });
      }
      // Details (left)
      let rowY = y + 44;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Name', studentData.full_name || studentData.name); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Matric Number', studentData.matric_no); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Department', studentData.department);
      doc.y = y + h + 16;
      doc.moveDown(1); // Add vertical gap after student info
      // --- Summary Card (dynamic height, always fits) ---
      const approvedCount = weeksData.filter(w => w.status === 'approved').length;
      const rejectedCount = weeksData.filter(w => w.status === 'rejected').length;
      const pendingCount = weeksData.filter(w => w.status === 'submitted' || w.status === 'draft').length;
      doc.y = drawSummaryCard(doc, 50, doc.y, doc.page.width - 100, {
        total: weeksData.length,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
      });

      // --- PAGE BREAK: Start page 2 for table and grading ---
      doc.addPage();
      await addMTUHeader(doc, logoPath);

      // --- Week-by-Week Table (fixed columns, pills, paging) ---
      await drawWeekStatusTable(doc, weeksData, addPageWithHeader, logoPath);

      // Grading Section Card
      await ensureSpace(doc, 220, addPageWithHeader);
      const y3 = doc.y;
      const h3 = 120;
      card(doc, { x, y: y3, w, h: h3 });
      cardHeader(doc, x + SPACING.cardPad, y3 + 14, 'Supervisor Grading');
      let gY = y3 + 44;
      setFont(doc, 'regular');
      doc.fontSize(11).fillColor('#374151')
        .text(`Final Grade: ${gradeData.grade || 'N/A'}`, x + SPACING.cardPad, gY)
        .text(`Score: ${gradeData.score ?? 'N/A'}/100`, x + SPACING.cardPad, gY + 18);
      gY += 38;
      setFont(doc, 'medium');
      doc.fontSize(10).fillColor(UI.secondary).text('Grading Scale:', x + SPACING.cardPad, gY); gY += 16;
      setFont(doc, 'regular');
      doc.fontSize(9).fillColor(UI.primary)
        .text('A = 70-100', x + SPACING.cardPad + 20, gY)
        .text('B = 60-69', x + SPACING.cardPad + 100, gY)
        .text('C = 50-59', x + SPACING.cardPad + 180, gY)
        .text('D = 45-49', x + SPACING.cardPad + 260, gY)
        .text('F = Below 40', x + SPACING.cardPad + 340, gY);
      doc.y = y3 + h3 + 16;

      // Remarks Card
      if (gradeData.remarks && gradeData.remarks.trim()) {
        await ensureSpace(doc, 90, addPageWithHeader);
        const y4 = doc.y;
        const h4 = 70;
        card(doc, { x, y: y4, w, h: h4 });
        cardHeader(doc, x + SPACING.cardPad, y4 + 14, 'Supervisor Remarks');
        setFont(doc, 'regular');
        doc.fontSize(10).fillColor(UI.primary).text(gradeData.remarks, x + SPACING.cardPad, y4 + 44, { width: w - SPACING.cardPad * 2 });
        doc.y = y4 + h4 + 16;
      }

      // --- Signature block ---
      await ensureSpace(doc, 140, addPageWithHeader); // make sure we have room
      const sigTop = doc.y + 10;
      setFont(doc, 'semibold');
      doc.fontSize(11).fillColor(UI.primary).text('Supervisor Signature:', 50, sigTop);
      // Box
      const boxY = sigTop + 18;
      doc.save();
      doc.roundedRect(50, boxY, 220, 70, 10).strokeColor(UI.border).lineWidth(1).stroke();
      doc.restore();
      // Extra spacing BEFORE the line below (this fixes your screenshot)
      const infoY = boxY + 85; // <-- this is the key spacing control
      setFont(doc, 'regular');
      doc.fontSize(10).fillColor(UI.secondary);
      doc.text(`Supervisor: ${supervisorData.name || 'N/A'}`, 50, infoY);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, doc.page.width - 270, infoY, {
        width: 220,
        align: 'right',
      });
      doc.y = infoY + 22;

      // --- Footer: Add to all pages at the end, no extra blank pages ---
      const addFooterAllPages = (doc) => {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.save();
          doc.fontSize(8).fillColor('#9ca3af')
            .text('Mountain Top University • SIWES Supervisor Grading Report', 50, doc.page.height - 35, {
              width: doc.page.width - 100,
              align: 'left'
            });
          doc.fontSize(8).fillColor('#9ca3af')
            .text(`Page ${i + 1} / ${range.count}`, 50, doc.page.height - 35, {
              width: doc.page.width - 100,
              align: 'right'
            });
          doc.restore();
        }
      };
      addFooterAllPages(doc);
      // Only call doc.end() and set handlers once
      doc.end();
      stream.on('finish', () => { resolve(outputPath); });
      stream.on('error', (error) => { reject(error); });
    } catch (error) { reject(error); }
  });
};

export default {
  generateStudentPDF,
  generateSupervisorPDF,
  addMTUHeader,
};

/**
 * Generate Individual Weekly Report PDF
 * @param {Object} weekData - Week information with activities
 * @param {Object} studentData - Student information
 * @param {Array} imageUrls - Array of evidence image URLs
 * @param {Array} stamps - Array of stamp/signature data
 * @param {string} outputPath - Path to save PDF
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generateWeeklyReportPDF = async (
  weekData,
  studentData,
  imageUrls = [],
  stamps = [],
  outputPath
) => {
  console.log('[PDF] Using new Weekly Report PDF design');
  // Dynamic import of node-fetch for fetching images
  const fetch = (await import('node-fetch')).default;
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 50, left: 50, right: 50 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Register fonts safely
      registerFonts(doc);
      // Try multiple possible locations for logo
      const possiblePaths = [
        path.join(__dirname, '../../public/mtu-logo.png'),
        path.join(__dirname, '../../../public/mtu-logo.png'),
        path.join(__dirname, '../../../../public/mtu-logo.png'),
        path.join(process.cwd(), 'public/mtu-logo.png'),
        path.join(process.cwd(), 'src/assets/mtu-logo.png'),
      ];
      
      let logoPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          logoPath = p;
          break;
        }
      }
      
      // First page header
      await addMTUHeader(doc, logoPath);
      
      // Title
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text(`SIWES Weekly Report - Week ${weekData.week_number}`, 50, doc.y, {
           align: 'center',
           width: doc.page.width - 100
         });
      
      doc.moveDown(0.5);
      
      // Date range
      const startDate = new Date(weekData.start_date);
      const endDate = new Date(weekData.end_date);
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#666666')
         .text(`${startDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`, {
           align: 'center',
         });
      
      doc.moveDown();
      doc.fillColor('black');
      
      // Student Information Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Student Information', doc.x, doc.y);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Name: ${studentData.full_name || studentData.name || 'N/A'}`, { indent: 20 })
         .text(`Matriculation Number: ${studentData.matric_no || 'N/A'}`, { indent: 20 })
         .text(`Department: ${studentData.department || 'N/A'}`, { indent: 20 })
         .text(`Organisation: ${studentData.organisation_name || 'N/A'}`, { indent: 20 });
      
      doc.moveDown();
      
      // Daily Activities
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Daily Activities', doc.x, doc.y);
      
      doc.moveDown(0.5);
      
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach((day, index) => {
        const activity = weekData[`${day}_activity`];
        
        // Calculate date for this day
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + index);
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#612E89')
           .text(`${dayNames[index]} (${dayDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })})`, { indent: 20 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('black')
           .text(activity || 'No activity logged', { indent: 30, width: doc.page.width - 100 });
        
        doc.moveDown(0.5);
      });
      
      // Student Comments
      if (weekData.comments) {
        doc.moveDown();
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Student Comments:');
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(weekData.comments, { indent: 20, width: doc.page.width - 100 });
      }
      
      // Evidence Images (if any)
      if (imageUrls && imageUrls.length > 0) {
        doc.addPage();
        await addMTUHeader(doc, logoPath);
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Evidence Photos', doc.x, doc.y);
        
        doc.moveDown();
        
        let imageY = doc.y;
        let imageX = 50;
        const imageWidth = 200;
        const imageHeight = 150;
        const imagesPerRow = 2;
        let imageCount = 0;
        
        for (const imageUrl of imageUrls) {
          try {
            // Fetch image from URL
            const response = await fetch(imageUrl);
            if (!response.ok) continue;
            
            const buffer = await response.buffer();
            
            // Check if we need a new page
            if (imageY + imageHeight > doc.page.height - 80) {
              doc.addPage();
              await addMTUHeader(doc, logoPath);
              imageY = doc.y;
              imageX = 50;
              imageCount = 0;
            }
            
            // Add image
            doc.image(buffer, imageX, imageY, {
              fit: [imageWidth, imageHeight],
            });
            
            imageCount++;
            
            // Move to next position
            if (imageCount % imagesPerRow === 0) {
              imageY += imageHeight + 20;
              imageX = 50;
            } else {
              imageX += imageWidth + 40;
            }
          } catch (imgError) {
            console.error('Failed to load image:', imageUrl, imgError.message);
          }
        }
      }
      
      // Stamps & Signatures (if any)
      if (stamps && stamps.length > 0) {
        // Check if we need a new page
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
          await addMTUHeader(doc, logoPath);
        }
        
        doc.moveDown(2);
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Digital Stamps & Signatures', doc.x, doc.y);
        
        doc.moveDown();
        
        let stampX = 50;
        const stampWidth = 150;
        const stampHeight = 100;
        
        for (const stamp of stamps) {
          if (!stamp.image_path) continue;
          
          try {
            const response = await fetch(stamp.image_path);
            if (!response.ok) continue;
            
            const buffer = await response.buffer();
            
            doc.image(buffer, stampX, doc.y, {
              fit: [stampWidth, stampHeight],
            });
            
            stampX += stampWidth + 30;
            
            if (stampX > doc.page.width - stampWidth) {
              stampX = 50;
              doc.y += stampHeight + 20;
            }
          } catch (stampError) {
            console.error('Failed to load stamp:', stamp.image_path, stampError.message);
          }
        }
      }
      
      // Status and Score Section
      doc.moveDown(2);
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Report Status', doc.x, doc.y);
      
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black');
      
      const statusColors = {
        draft: '#6B7280',
        submitted: '#3B82F6',
        approved: '#22C55E',
        rejected: '#EF4444'
      };
      
      doc.fillColor(statusColors[weekData.status] || '#000000')
         .text(`Status: ${(weekData.status || 'Unknown').toUpperCase()}`, { indent: 20 });
      
      doc.fillColor('black');
      
      if (weekData.score !== null && weekData.score !== undefined) {
        doc.text(`Score: ${weekData.score}/100`, { indent: 20 });
      }
      
      if (weekData.school_supervisor_approved_at) {
        doc.text(`Approved on: ${new Date(weekData.school_supervisor_approved_at).toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`, { indent: 20 });
      }
      
      // Footer on each page
      const addFooter = () => {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(
             `Generated on ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
             })} | Mountain Top University SIWES Tracking System`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      };
      
      // Add footer to all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
     
        addFooter();
      }
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(outputPath);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Complete 24-Week Logbook PDF
 * Compiles all weeks (approved + rejected) into one comprehensive logbook
 * @param {Object} studentData - Student information
 * @param {Array} weeksData - Array of all weeks with activities, images, stamps
 * @param {Object} industrySupervisor - Industry supervisor info
 * @param {string} outputPath - Path to save PDF
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generateLogbookPDF = async (
  studentData,
  weeksData,
  industrySupervisor,
  outputPath,
  schoolSignatureUrl = null,
  industrySignatureUrl = null
) => {
  console.log('[PDF] Using new Logbook PDF design');
  const fetch = (await import('node-fetch')).default;
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 60, left: SPACING.pageX, right: SPACING.pageX },
        bufferPages: true,
      });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      registerFonts(doc);
      const possiblePaths = [
        path.join(__dirname, '../../public/mtu-logo.png'),
        path.join(__dirname, '../../../public/mtu-logo.png'),
        path.join(__dirname, '../../../../public/mtu-logo.png'),
        path.join(process.cwd(), 'public/mtu-logo.png'),
        path.join(process.cwd(), 'src/assets/mtu-logo.png'),
      ];
      let logoPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { logoPath = p; break; }
      }
      const addPageWithHeader = async () => {
        doc.addPage();
        await addMTUHeader(doc, logoPath);
      };

      // COVER PAGE
      await addMTUHeader(doc, logoPath);
      doc.moveDown(1.2);
      setFont(doc, 'bold');
      doc.fontSize(24).fillColor(UI.accent).text('SIWES LOGBOOK', { align: 'center' });
      setFont(doc, 'regular');
      doc.fontSize(12).fillColor(UI.secondary).text('24-Week Training Record', { align: 'center' });
      doc.moveDown(1.4);
      // Student Card
      const x = SPACING.pageX;
      const w = doc.page.width - SPACING.pageX * 2;
      const y = doc.y;
      const h = 190;
      card(doc, { x, y, w, h });
      cardHeader(doc, x + SPACING.cardPad, y + 14, 'Student Information');
      let rowY = y + 44;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Name', studentData.full_name || studentData.name); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Matric Number', studentData.matric_no); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Department', studentData.department); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Faculty', studentData.faculty); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Level', studentData.level); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Organisation', studentData.organisation_name); rowY += 18;
      kvRow(doc, x + SPACING.cardPad, rowY, 'Training Period', studentData.period_of_training);
      // Supervisor Card
      doc.y = y + h + 16;
      const y2 = doc.y;
      const h2 = 120;
      card(doc, { x, y: y2, w, h: h2 });
      cardHeader(doc, x + SPACING.cardPad, y2 + 14, 'Industry Supervisor');
      let sY = y2 + 44;
      kvRow(doc, x + SPACING.cardPad, sY, 'Name', industrySupervisor.name); sY += 18;
      kvRow(doc, x + SPACING.cardPad, sY, 'Email', industrySupervisor.email); sY += 18;
      kvRow(doc, x + SPACING.cardPad, sY, 'Phone', industrySupervisor.phone);
      doc.moveDown(1);

      // WEEKLY REPORTS
      // For each week, fetch associated photo URLs and attach as image_urls
      for (const week of weeksData) {
        if (!week.image_urls) {
          // Fetch photos for this week from DB (assuming a getPhotosForWeek function exists)
          try {
            const photos = await options.getPhotosForWeek?.(week.id);
            week.image_urls = Array.isArray(photos) ? photos.map(p => p.image_url) : [];
          } catch {
            week.image_urls = []; 
          }
        }
      }
      const sortedWeeks = [...weeksData].sort((a, b) => a.week_number - b.week_number);
      // Helper to check if at top of a fresh page (after header)
      const atTopOfFreshPage = (doc) => doc.y <= 130;
      for (const week of sortedWeeks) {
        // Only add a new page if not already at top of a fresh page
        if (!atTopOfFreshPage(doc)) {
          await addPageWithHeader();
        }
        // Title row
        setFont(doc, 'bold');
        doc.fontSize(18).fillColor(UI.primary).text(`Week ${week.week_number}`, SPACING.pageX, doc.y);
        // Status pill (absolute right, never collides)
        const st = statusStyle(week.status);
        const pillW = 110;
        const pillH = 18;
        const pillX = doc.page.width - SPACING.pageX - pillW;
        const pillY = doc.y - 18;
        doc.save();
        doc.roundedRect(pillX, pillY, pillW, pillH, 9).fill(st.bg);
        setFont(doc, 'medium');
        doc.fontSize(9).fillColor(st.fg).text(st.text, pillX, pillY + 5, { width: pillW, align: 'center' });
        doc.restore();
        doc.moveDown(0.6);
        // Date range (always on new line)
        const startDate = week.start_date ? new Date(week.start_date) : null;
        const endDate = week.end_date ? new Date(week.end_date) : null;
        setFont(doc, 'regular');
        doc.fontSize(10).fillColor(UI.secondary).text(
          startDate && endDate
            ? `${startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Date range: N/A'
        );
        doc.moveDown(0.8);
        // Activities card
        const x = SPACING.pageX;
        const w = doc.page.width - SPACING.pageX * 2;
        const y = doc.y;
        const h = 240;
        card(doc, { x, y, w, h });
        cardHeader(doc, x + SPACING.cardPad, y + 14, 'Daily Activities');
        const days = [
          { key: 'monday_activity', label: 'Monday' },
          { key: 'tuesday_activity', label: 'Tuesday' },
          { key: 'wednesday_activity', label: 'Wednesday' },
          { key: 'thursday_activity', label: 'Thursday' },
          { key: 'friday_activity', label: 'Friday' },
          { key: 'saturday_activity', label: 'Saturday' },
        ];
        let dY = y + 44;
        for (const d of days) {
          setFont(doc, 'medium');
          doc.fontSize(10).fillColor(UI.accent).text(d.label, x + SPACING.cardPad, dY, { width: 90 });
          setFont(doc, 'regular');
          doc.fontSize(10).fillColor(UI.primary).text(
            safeText(week[d.key], 'No activity logged'),
            x + SPACING.cardPad + 90,
            dY,
            { width: w - SPACING.cardPad * 2 - 90 }
          );
          dY += 28;
        }
        doc.y = y + h + 14;
        // Comments card (optional)
        const comments = week.comments || '';
        const sup = week.school_supervisor_comments || '';
        if (comments.trim() || sup.trim()) {
          const yC = doc.y;
          const hC = 120;
          card(doc, { x, y: yC, w, h: hC });
          cardHeader(doc, x + SPACING.cardPad, yC + 14, 'Comments & Feedback');
          let cY = yC + 44;
          if (comments.trim()) {
            setFont(doc, 'medium');
            doc.fontSize(10).fillColor(UI.secondary).text('Student:', x + SPACING.cardPad, cY);
            setFont(doc, 'regular');
            doc.fontSize(10).fillColor(UI.primary).text(comments, x + SPACING.cardPad + 60, cY, { width: w - 90 });
            cY += 44;
          }
          if (sup.trim()) {
            setFont(doc, 'medium');
            doc.fontSize(10).fillColor(UI.secondary).text('Supervisor:', x + SPACING.cardPad, cY);
            setFont(doc, 'regular');
            doc.fontSize(10).fillColor(UI.primary).text(sup, x + SPACING.cardPad + 60, cY, { width: w - 90 });
          }
          doc.y = yC + hC + 12;
        }
        // Evidence Images (improved layout)
        if (week.image_urls && week.image_urls.length > 0) {
          const numImages = week.image_urls.length;
          if (numImages === 1) {
            // One large image (hero style)
            if (doc.y > doc.page.height - 220) {
              await addPageWithHeader();
            }
            doc.moveDown();
            setFont(doc, 'semibold');
            doc.fontSize(12).fillColor(UI.accent).text(`Evidence Photo (Week ${week.week_number})`);
            doc.moveDown(0.5);
            try {
              const response = await fetch(week.image_urls[0]);
              if (response.ok) {
                const buffer = await response.buffer();
                doc.image(buffer, x + 10, doc.y, { fit: [220, 160] });
                doc.y += 170;
              }
            } catch (imgError) {
              console.error('Failed to load image:', week.image_urls[0], imgError.message);
            }
          } else if (numImages <= 3) {
            // 2-column grid for 2-3 images
            if (doc.y > doc.page.height - 220) {
              await addPageWithHeader();
            }
            doc.moveDown();
            setFont(doc, 'semibold');
            doc.fontSize(12).fillColor(UI.accent).text(`Evidence Photos (Week ${week.week_number})`);
            doc.moveDown(0.5);
            let imageX = x + 10;
            let imageY = doc.y;
            const imageWidth = 200;
            const imageHeight = 140;
            let imageCount = 0;
            for (const imageUrl of week.image_urls) {
              try {
                const response = await fetch(imageUrl);
                if (!response.ok) continue;
                const buffer = await response.buffer();
                doc.image(buffer, imageX, imageY, { fit: [imageWidth, imageHeight] });
                imageCount++;
                if (imageCount % 2 === 0) {
                  imageY += imageHeight + 15;
                  imageX = x + 10;
                } else {
                  imageX += imageWidth + 20;
                }
              } catch (imgError) {
                console.error('Failed to load image:', imageUrl, imgError.message);
              }
            }
            doc.y = imageY + (imageCount % 2 === 0 ? 0 : imageHeight + 15);
          } else {
            // 4+ images: new page, full-width grid
            await addPageWithHeader();
            setFont(doc, 'semibold');
            doc.fontSize(12).fillColor(UI.accent).text(`Evidence Photos – Week ${week.week_number}`);
            doc.moveDown(0.5);
            let imageX = x + 10;
            let imageY = doc.y;
            const imageWidth = 180;
            const imageHeight = 120;
            let imageCount = 0;
            for (const imageUrl of week.image_urls) {
              try {
                const response = await fetch(imageUrl);
                if (!response.ok) continue;
                const buffer = await response.buffer();
                doc.image(buffer, imageX, imageY, { fit: [imageWidth, imageHeight] });
                imageCount++;
                if (imageCount % 3 === 0) {
                  imageY += imageHeight + 15;
                  imageX = x + 10;
                } else {
                  imageX += imageWidth + 20;
                }
              } catch (imgError) {
                console.error('Failed to load image:', imageUrl, imgError.message);
              }
            }
            doc.y = imageY + (imageCount % 3 === 0 ? 0 : imageHeight + 15);
          }
        }
        // Stamps/Signatures for this week (existing logic)
        if (week.stamps && week.stamps.length > 0) {
          if (doc.y > doc.page.height - 150) {
            await addPageWithHeader();
          }
          doc.moveDown();
          setFont(doc, 'semibold');
          doc.fontSize(12).fillColor('#22C55E').text('Digital Stamps & Signatures');
          doc.fillColor('black');
          doc.moveDown(0.5);
          let stampX = SPACING.pageX;
          const stampWidth = 120;
          const stampHeight = 80;
          for (const stamp of week.stamps) {
            if (!stamp.image_path) continue;
            try {
              const response = await fetch(stamp.image_path);
              if (!response.ok) continue;
              const buffer = await response.buffer();
              doc.image(buffer, stampX, doc.y, { fit: [stampWidth, stampHeight] });
              stampX += stampWidth + 20;
              if (stampX > doc.page.width - stampWidth) {
                stampX = SPACING.pageX;
                doc.y += stampHeight + 10;
              }
            } catch (stampError) {
              console.error('Failed to load stamp:', stamp.image_path, stampError.message);
            }
          }
        }
      }

      // FINAL PAGE: Summary & Signatures
      await addPageWithHeader();
      setFont(doc, 'bold');
      doc.fontSize(18).fillColor(UI.accent).text('Logbook Summary', { align: 'center' });
      doc.moveDown();
      // Calculate summary statistics
      const approvedCount = sortedWeeks.filter(w => w.status === 'approved').length;
      const rejectedCount = sortedWeeks.filter(w => w.status === 'rejected').length;
      const submittedCount = sortedWeeks.filter(w => w.status === 'submitted').length;
      const draftCount = sortedWeeks.filter(w => w.status === 'draft').length;
      const totalScore = sortedWeeks.filter(w => w.score !== null && w.score !== undefined).reduce((sum, w) => sum + Number(w.score), 0);
      const scoredWeeks = sortedWeeks.filter(w => w.score !== null && w.score !== undefined).length;
      const averageScore = scoredWeeks > 0 ? (totalScore / scoredWeeks).toFixed(1) : 'N/A';
      setFont(doc, 'regular');
      doc.fontSize(12).fillColor(UI.primary)
        .text(`Total Weeks: ${sortedWeeks.length}`, { indent: 20 })
        .text(`Approved: ${approvedCount}`, { indent: 20 })
        .text(`Rejected: ${rejectedCount}`, { indent: 20 })
        .text(`Pending: ${submittedCount}`, { indent: 20 })
        .text(`Draft: ${draftCount}`, { indent: 20 })
        .text(`Average Score: ${averageScore}`, { indent: 20 });
      doc.moveDown(2);
      setFont(doc, 'bold');
      doc.fontSize(14).fillColor(UI.accent).text('Signatures');
      doc.moveDown();
      setFont(doc, 'regular');
      doc.fontSize(11).fillColor(UI.primary).text('Industry Supervisor Signature & Stamp:');
        const indBoxY = doc.y + 5;
        doc.rect(SPACING.pageX, indBoxY, 200, 80).strokeColor('#cccccc').stroke();
        
        if (industrySignatureUrl) {
          try {
            const response = await fetch(industrySignatureUrl);
            if (response.ok) {
              const buffer = await response.buffer();
              doc.image(buffer, SPACING.pageX + 5, indBoxY + 5, { width: 190, height: 70, fit: [190, 70], align: 'center', valign: 'center' });
            }
          } catch (e) {
            console.error("Failed to load industry signature image:", e);
          }
        }
        
        doc.text(`Name: ${industrySupervisor.name || '_______________'}`, SPACING.pageX, indBoxY + 90);
        doc.text('Date: _______________', SPACING.pageX, doc.y + 15);
        
        doc.moveDown(3);
        doc.text('School Supervisor Signature:');
        const schBoxY = doc.y + 5;
        doc.rect(SPACING.pageX, schBoxY, 200, 80).strokeColor('#cccccc').stroke();
        
        if (schoolSignatureUrl) {
          try {
            const response = await fetch(schoolSignatureUrl);
            if (response.ok) {
              const buffer = await response.buffer();
              doc.image(buffer, SPACING.pageX + 5, schBoxY + 5, { width: 190, height: 70, fit: [190, 70], align: 'center', valign: 'center' });
            }
          } catch (e) {
            console.error("Failed to load school signature image:", e);
          }
        }
        
        doc.text('Name: _______________', SPACING.pageX, schBoxY + 90);
          doc.switchToPage(i);
          doc.save();
          doc.fontSize(8).fillColor('#9ca3af')
            .text('Mountain Top University • SIWES Logbook', 50, doc.page.height - 35, {
              width: doc.page.width - 100,
              align: 'left'
            });
          doc.fontSize(8).fillColor('#9ca3af')
            .text(`Page ${i + 1} / ${range.count}`, 50, doc.page.height - 35, {
              width: doc.page.width - 100,
              align: 'right'
            });
          doc.restore();
        }
      };
      addLogbookFooterAllPages(doc);
      doc.end();
      stream.on('finish', () => { resolve(outputPath); });
      stream.on('error', (error) => { reject(error); });
    } catch (error) { reject(error); }
  });
};