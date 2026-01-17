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
  const headerHeight = 80;
  
  // Header background - two-color split
  const leftColor = '#A8E6A3'; // Light Green
  const rightColor = '#612E89'; // Purple
  
  // Left half (Green)
  doc.rect(0, 0, pageWidth / 2, headerHeight)
     .fillColor(leftColor)
     .fill();
  
  // Right half (Purple)
  doc.rect(pageWidth / 2, 0, pageWidth / 2, headerHeight)
     .fillColor(rightColor)
     .fill();
  
  // Reset fill color
  doc.fillColor('black');
  
  // Logo placement (left side)
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, 20, 15, {
        fit: [50, 50],
        align: 'left',
        valign: 'top'
      });
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }
  
  // University name (to the right of logo)
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor('white')
     .text('Mountain Top University', 80, 25, {
       width: pageWidth - 100,
       align: 'left'
     });
  
  // Motto (under university name)
  doc.fontSize(11)
     .font('Helvetica')
     .text('"Empowered to Excel"', 80, 50, {
       width: pageWidth - 100,
       align: 'left'
     });
  
  // Reset text color
  doc.fillColor('black');
  
  // Add bottom border
  doc.moveTo(0, headerHeight)
     .lineTo(pageWidth, headerHeight)
     .strokeColor('#cccccc')
     .lineWidth(1)
     .stroke();
  
  // Set top margin for content
  doc.y = headerHeight + 30;
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
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 50, left: 50, right: 50 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Get logo path (adjust based on your setup)
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
      
      // Helper to add new page with header
      const addPageWithHeader = async () => {
        doc.addPage();
        await addMTUHeader(doc, logoPath);
      };
      
      // First page header
      await addMTUHeader(doc, logoPath);
      
      // Title
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('SIWES 24-Week Summary Report', 50, doc.y, {
           align: 'center',
           width: doc.page.width - 100
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
         .text(`Name: ${studentData.full_name || studentData.name}`, { indent: 20 })
         .text(`Matriculation Number: ${studentData.matric_no}`, { indent: 20 })
         .text(`Department: ${studentData.department}`, { indent: 20 })
         .text(`Faculty: ${studentData.faculty}`, { indent: 20 });
      
      doc.moveDown();
      
      // Weeks Summary (condensed to fit 3 pages)
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Weekly Activities Summary', doc.x, doc.y);
      
      doc.moveDown(0.5);
      
      // Create a condensed weekly summary table to fit in 3 pages max
      // Page 1: Student info + Weeks 1-12 (table format)
      // Page 2: Weeks 13-24 (table format)  
      // Page 3: Supervisor sections + signatures
      
      // Create table for weeks 1-12 on first page
      const tableTop = doc.y + 10;
      const tableLeft = 50;
      const colWidths = { week: 40, activities: doc.page.width - 150, score: 40 };
      
      // Table header
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Week', tableLeft, tableTop)
         .text('Activities Summary', tableLeft + colWidths.week + 10, tableTop)
         .text('Score', doc.page.width - 90, tableTop);
      
      doc.moveDown(0.3);
      doc.strokeColor('#cccccc')
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
        doc.fontSize(12)
           .font('Helvetica-Bold')
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
      
      // Footer on each page
      const addFooter = () => {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(
             `Generated on ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
             })}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      };
      
      // Add footer to all pages
      const pageCount = doc.pageCount;
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
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 50, left: 50, right: 50 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
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

      // Pre-fetch student profile image if available
      let profileImageBuffer = null;
      if (studentData.profile_image_url) {
        console.log('[PDF] Fetching student profile image...');
        profileImageBuffer = await fetchImageBuffer(studentData.profile_image_url);
        if (profileImageBuffer) {
          console.log('[PDF] Profile image loaded successfully');
        } else {
          console.log('[PDF] Profile image not available, using fallback');
        }
      }
      
      // First page header
      await addMTUHeader(doc, logoPath);
      
      // Title
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('SIWES Supervisor Grading Report', 50, doc.y, {
           align: 'center',
           width: doc.page.width - 100
         });
      
      doc.moveDown();
      doc.fillColor('black');
      
      // Student Information with Profile Picture
      const studentInfoY = doc.y;
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Student Information', doc.x, doc.y);
      
      doc.moveDown(0.5);
      
      // If profile image available, display it on the right
      const textStartX = 50;
      const photoSize = 80;
      const photoX = doc.page.width - 50 - photoSize;
      const photoY = doc.y;
      
      if (profileImageBuffer) {
        try {
          // Draw profile picture with border
          doc.save();
          doc.rect(photoX, photoY, photoSize, photoSize)
             .strokeColor('#612E89')
             .lineWidth(2)
             .stroke();
          doc.image(profileImageBuffer, photoX + 2, photoY + 2, {
            fit: [photoSize - 4, photoSize - 4],
            align: 'center',
            valign: 'center'
          });
          doc.restore();
        } catch (imgErr) {
          console.log('[PDF] Error embedding profile image:', imgErr.message);
          // Draw placeholder box if image fails
          doc.rect(photoX, photoY, photoSize, photoSize)
             .strokeColor('#cccccc')
             .lineWidth(1)
             .stroke();
          doc.fontSize(8)
             .fillColor('#999999')
             .text('Photo', photoX, photoY + photoSize/2 - 5, {
               width: photoSize,
               align: 'center'
             });
          doc.fillColor('black');
        }
      } else {
        // Draw placeholder if no profile image
        doc.rect(photoX, photoY, photoSize, photoSize)
           .strokeColor('#cccccc')
           .lineWidth(1)
           .stroke();
        doc.fontSize(8)
           .fillColor('#999999')
           .text('No Photo', photoX, photoY + photoSize/2 - 5, {
             width: photoSize,
             align: 'center'
           });
        doc.fillColor('black');
      }
      
      // Student details (left side, leaving room for photo)
      const detailsWidth = photoX - textStartX - 20;
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Name: ${studentData.full_name || studentData.name}`, { indent: 20 })
         .text(`Matriculation Number: ${studentData.matric_no}`, { indent: 20 })
         .text(`Department: ${studentData.department}`, { indent: 20 });
      
      // Ensure we're past the photo area before continuing
      if (doc.y < photoY + photoSize + 10) {
        doc.y = photoY + photoSize + 10;
      }
      
      doc.moveDown();
      
      // Weekly Reports Summary
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Weekly Reports Summary', doc.x, doc.y);
      
      doc.moveDown(0.5);
      
      const approvedCount = weeksData.filter(w => w.status === 'approved').length;
      const rejectedCount = weeksData.filter(w => w.status === 'rejected').length;
      const pendingCount = weeksData.filter(w => w.status === 'submitted' || w.status === 'draft').length;
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Total Weeks Submitted: ${weeksData.length}`, { indent: 20 })
         .text(`Approved: ${approvedCount}`, { indent: 20 })
         .text(`Rejected: ${rejectedCount}`, { indent: 20 })
         .text(`Pending: ${pendingCount}`, { indent: 20 });
      
      doc.moveDown();
      
      // Approval/Rejection History Table
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Week-by-Week Status', doc.x, doc.y);
      
      doc.moveDown(0.3);
      
      // Table header
      const tableTop = doc.y;
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Week', 50, tableTop)
         .text('Status', 100, tableTop)
         .text('Comments', 200, tableTop);
      
      doc.moveDown(0.3);
      doc.strokeColor('#cccccc')
         .moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke();
      
      // Table rows
      for (const week of weeksData) {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          await addMTUHeader(doc, logoPath);
          doc.y = 110;
        }
        
        const statusColor = week.status === 'approved' ? '#22c55e' : 
                           week.status === 'rejected' ? '#ef4444' : '#f59e0b';
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('black')
           .text(`${week.week_number}`, 50, doc.y)
           .fillColor(statusColor)
           .text(week.status.toUpperCase(), 100, doc.y)
           .fillColor('black')
           .text((week.supervisor_comment || 'N/A').substring(0, 40), 200, doc.y, {
             width: doc.page.width - 250
           });
        
        doc.moveDown(0.4);
      }
      
      doc.moveDown();
      
      // Grading Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Supervisor Grading', doc.x, doc.y);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Final Grade: ${gradeData.grade}`, { indent: 20 })
         .text(`Score: ${gradeData.score}/100`, { indent: 20 });
      
      // Grade scale
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Grading Scale:', { indent: 20 });
      
      doc.fontSize(9)
         .font('Helvetica')
         .text('A = 70-100', { indent: 40 })
         .text('B = 60-69', { indent: 40 })
         .text('C = 50-59', { indent: 40 })
         .text('D = 45-49', { indent: 40 })
         .text('F = Below 40', { indent: 40 });
      
      doc.moveDown();
      
      // Remarks
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Supervisor Remarks:', doc.x, doc.y);
      
      doc.moveDown(0.3);
      doc.fontSize(10)
         .font('Helvetica')
         .text(gradeData.remarks || 'No remarks provided', {
           indent: 20,
           width: doc.page.width - 100
         });
      
      doc.moveDown();
      
      // Signature Section
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Supervisor Signature:', doc.x, doc.y);
      
      doc.moveDown(0.3);
      doc.rect(50, doc.y, 200, 80)
         .stroke();
      
      doc.text(`Supervisor: ${supervisorData.name}`, 50, doc.y + 90);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, doc.y + 10);
      
      // Footer
      const addFooter = () => {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(
             `Generated on ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
             })}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      };
      
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
  outputPath
) => {
  // Dynamic import of node-fetch for fetching images
  const fetch = (await import('node-fetch')).default;
  
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 50, left: 50, right: 50 },
        bufferPages: true
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
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
      
      // Helper to add new page with header
      const addPageWithHeader = async () => {
        doc.addPage();
        await addMTUHeader(doc, logoPath);
      };
      
      // ==========================================
      // PAGE 1: Cover Page
      // ==========================================
      await addMTUHeader(doc, logoPath);
      
      doc.moveDown(3);
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('SIWES LOGBOOK', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#333333')
         .text('24-Week Training Record', { align: 'center' });
      
      doc.moveDown(3);
      
      // Student info box
      doc.rect(50, doc.y, doc.page.width - 100, 180)
         .strokeColor('#612E89')
         .lineWidth(2)
         .stroke();
      
      const boxY = doc.y + 15;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Student Information', 70, boxY);
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`Name: ${studentData.full_name || 'N/A'}`, 70)
         .text(`Matriculation Number: ${studentData.matric_no || 'N/A'}`, 70)
         .text(`Department: ${studentData.department || 'N/A'}`, 70)
         .text(`Faculty: ${studentData.faculty || 'N/A'}`, 70)
         .text(`Level: ${studentData.level || 'N/A'}`, 70)
         .text(`Organisation: ${studentData.organisation_name || 'N/A'}`, 70)
         .text(`Period of Training: ${studentData.period_of_training || 'N/A'}`, 70);
      
      doc.moveDown(2);
      
      // Industry Supervisor info
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Industry Supervisor', 50);
      
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`Name: ${industrySupervisor.name || 'N/A'}`, { indent: 20 })
         .text(`Email: ${industrySupervisor.email || 'N/A'}`, { indent: 20 })
         .text(`Phone: ${industrySupervisor.phone || 'N/A'}`, { indent: 20 });
      
      // ==========================================
      // WEEKLY REPORTS (1-24)
      // ==========================================
      
      // Sort weeks by week_number
      const sortedWeeks = [...weeksData].sort((a, b) => a.week_number - b.week_number);
      
      for (const week of sortedWeeks) {
        // New page for each week
        await addPageWithHeader();
        
        // Week header
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#612E89')
           .text(`Week ${week.week_number}`, 50, doc.y);
        
        // Date range
        const startDate = week.start_date ? new Date(week.start_date) : null;
        const endDate = week.end_date ? new Date(week.end_date) : null;
        
        if (startDate && endDate) {
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#666666')
             .text(`${startDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`);
        }
        
        // Status badge
        const statusColors = {
          draft: '#6B7280',
          submitted: '#3B82F6',
          approved: '#22C55E',
          rejected: '#EF4444'
        };
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor(statusColors[week.status] || '#000000')
           .text(`Status: ${(week.status || 'Unknown').toUpperCase()}`);
        
        if (week.score !== null && week.score !== undefined) {
          doc.fillColor('#612E89')
             .text(`Score: ${week.score}/100`);
        }
        
        doc.fillColor('black');
        doc.moveDown();
        
        // Daily Activities
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Daily Activities');
        
        doc.moveDown(0.5);
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach((day, index) => {
          const activity = week[`${day}_activity`];
          
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor('#612E89')
             .text(`${dayNames[index]}:`, { continued: true });
          
          doc.font('Helvetica')
             .fillColor('black')
             .text(` ${activity || 'No activity logged'}`);
          
          doc.moveDown(0.3);
        });
        
        // Student Comments
        if (week.comments) {
          doc.moveDown(0.5);
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('Student Comments:');
          
          doc.fontSize(10)
             .font('Helvetica')
             .text(week.comments, { indent: 20, width: doc.page.width - 120 });
        }
        
        // Supervisor Comments
        if (week.school_supervisor_comments) {
          doc.moveDown(0.5);
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('#612E89')
             .text('Supervisor Feedback:');
          
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor('black')
             .text(week.school_supervisor_comments, { indent: 20, width: doc.page.width - 120 });
        }
        
        // Evidence Images
        if (week.image_urls && week.image_urls.length > 0) {
          // Check if we need new page for images
          if (doc.y > doc.page.height - 250) {
            await addPageWithHeader();
          }
          
          doc.moveDown();
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text(`Evidence Photos (Week ${week.week_number})`);
          
          doc.moveDown(0.5);
          
          let imageX = 50;
          let imageY = doc.y;
          const imageWidth = 160;
          const imageHeight = 120;
          const imagesPerRow = 3;
          let imageCount = 0;
          
          for (const imageUrl of week.image_urls) {
            try {
              const response = await fetch(imageUrl);
              if (!response.ok) continue;
              
              const buffer = await response.buffer();
              
              // Check if we need new page
              if (imageY + imageHeight > doc.page.height - 80) {
                await addPageWithHeader();
                imageY = doc.y;
                imageX = 50;
                imageCount = 0;
              }
              
              doc.image(buffer, imageX, imageY, {
                fit: [imageWidth, imageHeight],
              });
              
              imageCount++;
              
              if (imageCount % imagesPerRow === 0) {
                imageY += imageHeight + 15;
                imageX = 50;
              } else {
                imageX += imageWidth + 15;
              }
            } catch (imgError) {
              console.error('Failed to load image:', imageUrl, imgError.message);
            }
          }
          
          // Update doc.y after images
          if (imageCount > 0) {
            doc.y = imageY + (imageCount % imagesPerRow === 0 ? 0 : imageHeight + 15);
          }
        }
        
        // Stamps/Signatures for this week
        if (week.stamps && week.stamps.length > 0) {
          if (doc.y > doc.page.height - 150) {
            await addPageWithHeader();
          }
          
          doc.moveDown();
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('#22C55E')
             .text('Digital Stamps & Signatures');
          
          doc.fillColor('black');
          doc.moveDown(0.5);
          
          let stampX = 50;
          const stampWidth = 120;
          const stampHeight = 80;
          
          for (const stamp of week.stamps) {
            if (!stamp.image_path) continue;
            
            try {
              const response = await fetch(stamp.image_path);
              if (!response.ok) continue;
              
              const buffer = await response.buffer();
              
              doc.image(buffer, stampX, doc.y, {
                fit: [stampWidth, stampHeight],
              });
              
              stampX += stampWidth + 20;
              
              if (stampX > doc.page.width - stampWidth) {
                stampX = 50;
                doc.y += stampHeight + 10;
              }
            } catch (stampError) {
              console.error('Failed to load stamp:', stamp.image_path, stampError.message);
            }
          }
        }
      }
      
      // ==========================================
      // FINAL PAGE: Summary & Signatures
      // ==========================================
      await addPageWithHeader();
      
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Logbook Summary', { align: 'center' });
      
      doc.moveDown();
      
      // Calculate summary statistics
      const approvedCount = sortedWeeks.filter(w => w.status === 'approved').length;
      const rejectedCount = sortedWeeks.filter(w => w.status === 'rejected').length;
      const submittedCount = sortedWeeks.filter(w => w.status === 'submitted').length;
      const draftCount = sortedWeeks.filter(w => w.status === 'draft').length;
      
      const totalScore = sortedWeeks
        .filter(w => w.score !== null && w.score !== undefined)
        .reduce((sum, w) => sum + Number(w.score), 0);
      const scoredWeeks = sortedWeeks.filter(w => w.score !== null && w.score !== undefined).length;
      const averageScore = scoredWeeks > 0 ? (totalScore / scoredWeeks).toFixed(1) : 'N/A';
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('black')
         .text(`Total Weeks: ${sortedWeeks.length}`, { indent: 20 })
         .text(`Approved: ${approvedCount}`, { indent: 20 })
         .text(`Rejected: ${rejectedCount}`, { indent: 20 })
         .text(`Pending: ${submittedCount}`, { indent: 20 })
         .text(`Draft: ${draftCount}`, { indent: 20 })
         .text(`Average Score: ${averageScore}`, { indent: 20 });
      
      doc.moveDown(2);
      
      // Signature boxes
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#612E89')
         .text('Signatures');
      
      doc.moveDown();
      
      // Industry Supervisor signature box
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text('Industry Supervisor Signature & Stamp:');
      
      doc.rect(50, doc.y + 5, 200, 80)
         .strokeColor('#cccccc')
         .stroke();
      
      doc.text(`Name: ${industrySupervisor.name || '_______________'}`, 50, doc.y + 95);
      doc.text('Date: _______________', 50, doc.y + 15);
      
      doc.moveDown(3);
      
      // School Supervisor signature box
      doc.text('School Supervisor Signature:');
      doc.rect(50, doc.y + 5, 200, 80)
         .stroke();
      
      doc.text('Name: _______________', 50, doc.y + 95);
      doc.text('Date: _______________', 50, doc.y + 15);
      
      // Footer on each page with page numbers
      const addLogbookFooter = (pageNum, totalPages) => {
        doc.fontSize(8)
           .fillColor('#666666')
           .text(
             `Page ${pageNum} of ${totalPages} | Generated on ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
             })} | Mountain Top University SIWES Logbook`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      };
      
      // Add footer to all pages
      const logbookPageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < logbookPageCount; i++) {
    
        addLogbookFooter(i + 1, logbookPageCount);
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