import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MembershipSubscription } from '../api/membership';
import { formatTimeTo12h } from './time';

/**
 * Generates a professional PDF invoice for a membership subscription.
 */
export const generateMembershipInvoicePDF = async (subscription: MembershipSubscription) => {
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
  doc.text('MEMBERSHIP INVOICE', 120, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#MEM-${subscription.id.slice(-6).toUpperCase()}`, 120, 32);
  doc.text(`Issued: ${new Date().toLocaleDateString()}`, 120, 38);
  
  // --- Billing Info ---
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMBER DETAILS', 15, 70);
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 72, 40, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(subscription.user?.name || 'Valued Member', 15, 82);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${subscription.user?.phoneNumber || 'N/A'}`, 15, 88);
  if (subscription.user?.email) {
    doc.text(`Email: ${subscription.user.email}`, 15, 94);
  }
  
  // Membership Summary Right Side
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMBERSHIP SUMMARY', 130, 70);
  doc.line(130, 72, 185, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Plan: ${subscription.plan.name}`, 130, 82);
  doc.text(`Valid From: ${new Date(subscription.startDate).toLocaleDateString()}`, 130, 88);
  doc.text(`Valid Until: ${new Date(subscription.endDate).toLocaleDateString()}`, 130, 94);
  if (subscription.timeSlot) {
    doc.text(`Time Slot: ${formatTimeTo12h(subscription.timeSlot.split('-')[0])}`, 130, 100);
  }
  
  // --- Items Table ---
  autoTable(doc, {
    startY: 110,
    head: [['DESCRIPTION', 'DURATION', 'CATEGORY', 'AMOUNT']],
    body: [
      [
        { content: `${subscription.plan.name} Package`, styles: { fontStyle: 'bold' as const } },
        subscription.chosenDuration?.replace('_', ' ') || 'Standard',
        subscription.chosenCategory || 'General',
        `Rs. ${(subscription.totalPrice || subscription.plan.price).toLocaleString()}`
      ]
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
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // --- Calculation Section ---
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  const summaryX = 130;
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Total Price:', summaryX, finalY + 15);
  doc.text(`Rs. ${(subscription.totalPrice || subscription.plan.price).toLocaleString()}`, 180, finalY + 15, { align: 'right' });
  
  // Total Line
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, finalY + 19, 195, finalY + 19);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PAYABLE AMOUNT:', summaryX, finalY + 28);
  
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(16);
  doc.text(`Rs. ${(subscription.totalPrice || subscription.plan.price).toLocaleString()}`, 195, finalY + 28, { align: 'right' });
  
  // Status Badge
  const statusX = 15;
  const statusY = finalY + 15;
  const isActive = subscription.status === 'active';
  
  doc.setFillColor(isActive ? 220 : 254, isActive ? 252 : 242, isActive ? 231 : 242); 
  doc.roundedRect(statusX, statusY, 45, 12, 2, 2, 'F');
  
  doc.setTextColor(isActive ? 21 : 220, isActive ? 128 : 38, isActive ? 61 : 38);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(isActive ? 'MEMBERSHIP ACTIVE' : 'PENDING ACTIVATION', statusX + 22.5, statusY + 8, { align: 'center' });
  
  // --- Footer ---
  const footerY = 250;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(15, footerY, 195, footerY);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Membership Perks', 15, footerY + 10);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const perks = subscription.plan.perks || [];
  perks.slice(0, 4).forEach((perk, index) => {
    doc.text(`• ${perk}`, 15, footerY + 16 + (index * 4));
  });
  
  // Thank you note
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold italic');
  doc.text('Welcome to the Unique Futsal Community!', 105, 285, { align: 'center' });
  
  return doc;
};
