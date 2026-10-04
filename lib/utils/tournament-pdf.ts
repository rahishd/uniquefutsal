import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tournament } from '../api/tournaments';

/**
 * Generates a professional PDF invoice for a tournament agreement.
 */
export const generateTournamentPDF = async (tournament: Tournament) => {
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
  doc.text('AGREEMENT', 140, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#TR-${tournament.id.slice(-6).toUpperCase()}`, 140, 32);
  doc.text(`Date: ${tournament.registeredDate || new Date().toISOString().split('T')[0]}`, 140, 38);
  
  // --- Billing Info ---
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ORGANIZER', 15, 70);
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 72, 45, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(tournament.organizerName || 'Valued Organizer', 15, 82);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tournament: ${tournament.name}`, 15, 88);
  
  // Event Info Right Side
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('EVENT DETAILS', 130, 70);
  doc.line(130, 72, 175, 72);
  
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Duration: ${tournament.startDate} to ${tournament.endDate}`, 130, 82);
  doc.text(`Time: ${tournament.startTime || '-'} to ${tournament.endTime || '-'}`, 130, 88);
  doc.text(`Teams: ${tournament.minTeams} - ${tournament.maxTeams}`, 130, 94);
  
  // --- Items Table ---
  const body = [
    [
      { content: 'Tournament Pitch Booking', styles: { fontStyle: 'bold' as const } },
      `${tournament.bookedHours || 0} Hours`,
      `Rs. ${(tournament.hourlyRate || 0).toLocaleString()}`,
      `Rs. ${((tournament.bookedHours || 0) * (tournament.hourlyRate || 0)).toLocaleString()}`
    ]
  ];

  if (tournament.hasMineralWater) {
    body.push([
      { content: 'Mineral Water Supply', styles: { fontStyle: 'bold' as const } },
      `${tournament.waterQuantity || 0} Units`,
      `Rs. ${(tournament.waterUnitPrice || 25).toLocaleString()}`,
      `Rs. ${(tournament.waterCharge || 0).toLocaleString()}`
    ]);
  }

  if (tournament.hasSkyRoofSpectator) {
    body.push([
      { content: 'Sky Roof Spectator Facility', styles: { fontStyle: 'bold' as const } },
      'Flat Rate',
      'Rs. 2,000',
      `Rs. ${(tournament.skyRoofCharge || 2000).toLocaleString()}`
    ]);
  }

  if (tournament.hasHealthInsurance) {
    body.push([
      { content: `Health Insurance (${tournament.insurancePercent}%)`, styles: { fontStyle: 'bold' as const } },
      'Coverage',
      '-',
      `Rs. ${(tournament.insuranceCharge || 0).toLocaleString()}`
    ]);
  }

  // Add empty lines for better spacing
  body.push(['', '', '', '']);
  body.push(['', '', '', '']);

  autoTable(doc, {
    startY: 110,
    head: [['DESCRIPTION', 'QTY / TYPE', 'UNIT PRICE', 'AMOUNT']],
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold' as const,
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
      3: { halign: 'right', fontStyle: 'bold' as const }
    }
  });
  
  // --- Calculation Section ---
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  const summaryX = 120; // Moved left to avoid overlap
  const summaryValueX = 195;
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Subtotal:', summaryX, finalY + 15);
  doc.text(`Rs. ${(tournament.totalAmount || 0).toLocaleString()}`, summaryValueX, finalY + 15, { align: 'right' });
  
  doc.text('Advance Paid:', summaryX, finalY + 23);
  doc.text(`Rs. ${(tournament.advancePayment || 0).toLocaleString()}`, summaryValueX, finalY + 23, { align: 'right' });
  
  // Total Line
  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX, finalY + 28, summaryValueX, finalY + 28);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL AMOUNT:', summaryX, finalY + 38);
  
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(16);
  doc.text(`Rs. ${(tournament.totalAmount || 0).toLocaleString()}`, summaryValueX, finalY + 38, { align: 'right' });

  // Remaining Balance
  const remainingAmount = (tournament.totalAmount || 0) - (tournament.advancePayment || 0);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(11); // Slightly smaller to fit
  doc.setFont('helvetica', 'bold');
  doc.text('REMAINING BALANCE:', summaryX, finalY + 48);
  doc.text(`Rs. ${remainingAmount.toLocaleString()}`, summaryValueX, finalY + 48, { align: 'right' });
  
  // --- Footer ---
  // Ensure footer is always below the summary, with at least a 260 starting point
  const footerY = Math.max(265, finalY + 65);
  
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(1);
  doc.line(15, footerY, 195, footerY);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Agreement Terms', 15, footerY + 10);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const terms = [
    '1. The organizer is responsible for team discipline and conduct.',
    '2. Any damage to the property will be charged to the organizer.',
    '3. Proper futsal shoes are mandatory for all participants.',
    '4. Final payment must be settled before the tournament concludes.'
  ];
  terms.forEach((term, index) => {
    doc.text(term, 15, footerY + 16 + (index * 4));
  });
  
  // Thank you note
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold italic');
  doc.text('Unique Futsal - Where Champions Play', 105, footerY + 35, { align: 'center' });
  
  return doc;
};
