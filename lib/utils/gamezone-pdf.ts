import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GamezoneRecord } from '../api/gamezone';

/**
 * Generates a professional PDF invoice for a Gamezone record.
 */
export const generateGamezonePDF = async (record: GamezoneRecord) => {
  const doc = new jsPDF();
  
  // Colors - Matching Unique Futsal Branding
  const primaryColor: [number, number, number] = [12, 11, 93]; // #0c0b5d (Deep Blue)
  const secondaryColor: [number, number, number] = [250, 100, 0]; // #FA6400 (Orange)
  const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
  
  // Page Background
  doc.setFillColor(252, 252, 252);
  doc.rect(0, 0, 210, 297, 'F');
  
  // --- Header ---
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 50, 'F');
  
  // Brand Text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIQUE GAMEZONE', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Level Up Your Game at Unique Futsal', 15, 32);
  doc.text('Manigram, Tilottama-05, Rupandehi, Nepal', 15, 38);
  doc.text('Phone: +977 9811940018 | Email: info.uniquefutsal@gmail.com', 15, 44);
  
  // Invoice Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 160, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#GZ-${record.id.slice(-6).toUpperCase()}`, 160, 32);
  doc.text(`Date: ${record.date}`, 160, 38);
  
  // --- Billing Info ---
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 15, 70);
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 72, 40, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(record.customerName || 'Valued Gamer', 15, 82);
  
  // Session Summary Right Side
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SESSION SUMMARY', 130, 70);
  doc.line(130, 72, 175, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Activity: Gamezone Playtime`, 130, 82);
  doc.text(`Date: ${record.date}`, 130, 88);
  doc.text(`Recorded At: ${record.timestamp}`, 130, 94);
  
  // --- Items Table ---
  autoTable(doc, {
    startY: 110,
    head: [['DESCRIPTION', 'DURATION', 'RATE', 'AMOUNT']],
    body: [
      [
        { content: 'Gamezone Station Access (Gaming Session)', styles: { fontStyle: 'bold' } },
        `${record.hours} Hour(s)`,
        `Rs. ${record.rate.toLocaleString()}/hr`,
        `Rs. ${record.money.toLocaleString()}`
      ],
      ['', '', '', ''],
      ['', '', '', '']
    ],
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      textColor: textColor,
      cellPadding: 8
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // --- Calculation Section ---
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  const summaryX = 130;
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Subtotal:', summaryX, finalY + 15);
  doc.text(`Rs. ${record.money.toLocaleString()}`, 195, finalY + 15, { align: 'right' });
  
  // Total Line
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, finalY + 20, 195, finalY + 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL AMOUNT:', summaryX, finalY + 28);
  
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(16);
  doc.text(`Rs. ${record.money.toLocaleString()}`, 195, finalY + 28, { align: 'right' });
  
  // Paid Badge
  const statusX = 15;
  const statusY = finalY + 20;
  doc.setFillColor(220, 252, 231); // Green light bg
  doc.roundedRect(statusX, statusY, 35, 10, 2, 2, 'F');
  doc.setTextColor(21, 128, 61); // Green text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID', statusX + 17.5, statusY + 6.5, { align: 'center' });
  
  // --- Footer ---
  const footerY = 260;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(15, footerY, 195, footerY);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Unique Gamezone Rules', 15, footerY + 10);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const rules = [
    '1. Please treat the gaming equipment with care.',
    '2. No food or drinks near the consoles/PCs.',
    '3. Your session starts exactly at the booked time.',
    '4. Any damage to equipment will be charged to the customer.'
  ];
  rules.forEach((rule, index) => {
    doc.text(rule, 15, footerY + 16 + (index * 4));
  });
  
  // Thank you note
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold italic');
  doc.text('Level Up at Unique Futsal! See you in the Gamezone.', 105, 290, { align: 'center' });
  
  return doc;
};
