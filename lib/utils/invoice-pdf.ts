import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Booking } from '../api/bookings';
import { formatTimeTo12h } from './time';

/**
 * Generates a professional PDF invoice for a booking.
 */
export const generateInvoicePDF = async (booking: Booking) => {
  const doc = new jsPDF();
  
  // Colors - Matching Unique Futsal Branding
  const primaryColor: [number, number, number] = [12, 11, 93]; // #0c0b5d (Deep Blue)
  const secondaryColor: [number, number, number] = [250, 100, 0]; // #FA6400 (Orange)
  const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
  
  // Page Background (Subtle)
  doc.setFillColor(252, 252, 252);
  doc.rect(0, 0, 210, 297, 'F');
  
  // --- Header ---
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 50, 'F');
  
  // Brand Text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIQUE FUTSAL', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('The Ultimate Arena for Futsal Lovers', 15, 32);
  doc.text('Manigram, Tilottama-05, Rupandehi, Nepal', 15, 38);
  doc.text('Phone: +977 9811940018 | Email: info.uniquefutsal@gmail.com', 15, 44);
  
  // Invoice Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 160, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#BK-${booking.id.slice(-6).toUpperCase()}`, 160, 32);
  doc.text(`Date: ${booking.date}`, 160, 38);
  
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
  doc.text(booking.customerName || 'Valued Player', 15, 82);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${booking.customerPhone || 'N/A'}`, 15, 88);
  if (booking.customerEmail) {
    doc.text(`Email: ${booking.customerEmail}`, 15, 94);
  }
  
  // Booking Info Right Side
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOKING SUMMARY', 130, 70);
  doc.line(130, 72, 175, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ground: Main Arena`, 130, 82);
  doc.text(`Reservation: ${booking.date}`, 130, 88);
  doc.text(`Start Time: ${formatTimeTo12h(booking.startTime)}`, 130, 94);
  
  // --- Items Table ---
  autoTable(doc, {
    startY: 110,
    head: [['DESCRIPTION', 'DURATION', 'UNIT PRICE', 'AMOUNT']],
    body: [
      [
        { content: 'Futsal Court Rental (Premium Turf)', styles: { fontStyle: 'bold' as const } },
        `${booking.duration} Hour(s)`,
        `Rs. ${(booking.basePrice / (booking.duration || 1)).toLocaleString()}`,
        `Rs. ${booking.basePrice.toLocaleString()}`
      ],
      ...(booking.waterBottles && booking.waterBottles > 0 ? [[
        { content: `Mineral Water Bottles (${booking.waterBottles} units)`, styles: { fontStyle: 'normal' as const } },
        `${booking.waterBottles} Units`,
        booking.waterBottles > 2 ? `Rs. 25` : `Rs. 0`,
        `Rs. ${(Math.max(0, booking.waterBottles - 2) * 25).toLocaleString()}`
      ]] : []),
      ...(booking.addOns ? [[
        { content: `${booking.addOns}`, styles: { fontStyle: 'normal' as const } },
        `1 Unit`,
        `Rs. ${booking.addOnsPrice.toLocaleString()}`,
        `Rs. ${booking.addOnsPrice.toLocaleString()}`
      ]] : []),
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
  const isPaid = booking.paymentStatus === 'completed';
  
  doc.text('Subtotal:', summaryX, finalY + 15);
  doc.text(`Rs. ${booking.totalPrice.toLocaleString()}`, 180, finalY + 15, { align: 'right' });
  
  doc.text('Discount:', summaryX, finalY + 22);
  doc.text(`Rs. ${(booking.discountAmount || 0).toLocaleString()}`, 180, finalY + 22, { align: 'right' });
  
  // Total Line
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, finalY + 26, 195, finalY + 26);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL BILL:', summaryX, finalY + 34);
  doc.text(`Rs. ${booking.totalPrice.toLocaleString()}`, 180, finalY + 34, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(isPaid ? 21 : 120, isPaid ? 128 : 120, isPaid ? 61 : 120);
  doc.text('AMOUNT PAID:', summaryX, finalY + 41);
  doc.text(`Rs. ${(booking.amountPaidNow || 0).toLocaleString()}`, 180, finalY + 41, { align: 'right' });

  const remaining = booking.remainingAmount || (booking.totalPrice - (booking.amountPaidNow || 0));
  if (remaining > 0) {
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('BALANCE DUE:', summaryX, finalY + 48);
    doc.text(`Rs. ${remaining.toLocaleString()}`, 180, finalY + 48, { align: 'right' });
  }

  // Payment Status Badge
  const statusX = 15;
  const statusY = finalY + 20;
  const paymentStatus = booking.paymentStatus || 'pending';
  
  let badgeColor: [number, number, number] = [220, 38, 38]; // Red
  let badgeBg: [number, number, number] = [254, 242, 242];
  let statusText = 'PAYMENT DUE';

  if (paymentStatus === 'completed') {
    badgeColor = [21, 128, 61]; // Green
    badgeBg = [220, 252, 231];
    statusText = 'PAID / SETTLED';
  } else if (paymentStatus === 'partially_paid') {
    badgeColor = [180, 83, 9]; // Amber
    badgeBg = [255, 251, 235];
    statusText = 'PARTIALLY PAID';
  }
  
  doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
  doc.roundedRect(statusX, statusY, 50, 12, 2, 2, 'F');
  
  doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, statusX + 25, statusY + 8, { align: 'center' });
  
  // --- Footer ---
  const footerY = 260;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(15, footerY, 195, footerY);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions', 15, footerY + 10);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const terms = [
    '1. Please arrive at least 15 minutes before your scheduled time.',
    '2. Proper futsal/sports shoes are mandatory on the turf.',
    '3. Cancellations must be made at least 24 hours in advance.',
    '4. The management is not responsible for loss of personal belongings.'
  ];
  terms.forEach((term, index) => {
    doc.text(term, 15, footerY + 16 + (index * 4));
  });
  
  // Thank you note
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold italic');
  doc.text('Thank you for playing at Unique Futsal! See you on the pitch.', 105, 290, { align: 'center' });
  
  return doc;
};
