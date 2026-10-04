import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DailyReportData {
  date: string;
  reportType?: string;
  subTitle?: string;
  futsalRevenue: {
    online: number;
    cash: number;
    tournaments: { name: string; amount: number }[];
  };
  gamezoneRevenue: number;
  playersCount: number;
  inventorySales: {
    items: { name: string; qty: number; cash: number; online: number; price?: number }[];
    totalCash: number;
    totalOnline: number;
  };
  inventoryStockLeft: { name: string; left: number; unit: string }[];
  promoCodes: { code: string; count: number; discount: number }[];
  expenses: { name: string; price: number }[];
  totalExpenses: number;
  loyaltyClaims: string[];
  visitors: { registered: number; guest: number };
}

export const generateDailyReportPDF = async (data: DailyReportData) => {
  const doc = new jsPDF();
  
  const reportType = data.reportType || 'DAILY REPORT';
  const subTitle = data.subTitle || 'Daily Business Operations Report';
  
  // Colors - Matching Unique Futsal Branding
  const primaryColor: [number, number, number] = [12, 11, 93]; // #0c0b5d (Deep Blue)
  const secondaryColor: [number, number, number] = [250, 100, 0]; // #FA6400 (Orange)
  const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
  
  // Page Background
  doc.setFillColor(252, 252, 252);
  doc.rect(0, 0, 210, 297, 'F');
  
  // --- Header ---
  const drawHeader = () => {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 50, 'F');
    
    // Brand Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIQUE FUTSAL', 15, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subTitle, 15, 27);
    doc.text('Manigram, Tilottama-05, Rupandehi, Nepal', 15, 33);
    doc.text('Phone: 9811940018', 15, 39);
    
    // Report Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(reportType, 140, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${data.date}`, 140, 27);
    doc.text(`Status: Generated Final`, 140, 33);
  };

  drawHeader();
  
  let currentY = 60;

  const checkPageBreak = (neededSpace: number) => {
    if (currentY + neededSpace > 275) {
      doc.addPage();
      // Draw running header background
      doc.setFillColor(252, 252, 252);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Running header bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('UNIQUE FUTSAL - DAILY REPORT CONTINUE', 15, 10);
      doc.text(`Date: ${data.date}`, 160, 10);
      
      currentY = 25;
    }
  };

  const drawSectionHeader = (title: string) => {
    checkPageBreak(15);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, currentY);
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineWidth(1);
    doc.line(15, currentY + 2, 45, currentY + 2);
    currentY += 8;
  };

  // --- Section 1: Futsal Revenue & Overview ---
  drawSectionHeader('1. FUTSAL REVENUE & OVERVIEW');
  checkPageBreak(35);

  doc.setFontSize(10);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Online Futsal Revenue:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${data.futsalRevenue.online.toLocaleString()}`, 65, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text(`Cash Futsal Revenue:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${data.futsalRevenue.cash.toLocaleString()}`, 65, currentY);
  currentY += 6;

  // Gamezone
  doc.setFont('helvetica', 'bold');
  doc.text(`Gamezone Revenue:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${data.gamezoneRevenue.toLocaleString()}`, 65, currentY);
  currentY += 6;

  // Players
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Players:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.playersCount.toString()}`, 65, currentY);
  currentY += 8;

  // Tournament
  if (data.futsalRevenue.tournaments.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Tournament Revenue:`, 15, currentY);
    currentY += 6;

    data.futsalRevenue.tournaments.forEach(t => {
      checkPageBreak(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`• ${t.name}:`, 20, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rs. ${t.amount.toLocaleString()}`, 75, currentY);
      currentY += 6;
    });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(`Tournament Revenue:`, 15, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(`None`, 65, currentY);
    currentY += 8;
  }

  currentY += 4;

  // --- Section 2: Inventory Sales Table ---
  drawSectionHeader('2. INVENTORY');
  checkPageBreak(30);

  const tableBody = data.inventorySales.items.map((item, idx) => {
    // Use cash/online from log if available, otherwise fallback to price * qty split
    const totalItemRevenue = item.cash + item.online;
    let displayCash = item.cash;
    let displayOnline = item.online;
    if (totalItemRevenue === 0 && item.price && item.price > 0) {
      // No payment split recorded — show price in cash column as fallback
      displayCash = item.price * item.qty;
    }
    return [
      (idx + 1).toString(),
      item.name,
      `${item.qty.toString()} Pcs`,
      displayCash > 0 ? `Rs. ${displayCash.toLocaleString()}` : '-',
      displayOnline > 0 ? `Rs. ${displayOnline.toLocaleString()}` : '-'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Sn.', 'Items', 'Quantity', 'Cash', 'Online']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 70 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;
  checkPageBreak(25);

  // Totals row right below the table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`Total:`, 75, currentY);
  doc.text(`Rs. ${data.inventorySales.totalCash.toLocaleString()}`, 130, currentY, { align: 'right' });
  doc.text(`Rs. ${data.inventorySales.totalOnline.toLocaleString()}`, 165, currentY, { align: 'right' });
  currentY += 10;

  // Inventory-only cash/online summary (NOT mixed with futsal/gamezone)
  checkPageBreak(15);
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(15, currentY - 2, 180, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Cash Transactions:`, 20, currentY + 5);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Amount  Rs. ${data.inventorySales.totalCash.toLocaleString()}`, 70, currentY + 5);
  currentY += 10;

  doc.setFillColor(245, 255, 247);
  doc.roundedRect(15, currentY - 2, 180, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Online Transactions:`, 20, currentY + 5);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Amount  Rs. ${data.inventorySales.totalOnline.toLocaleString()}`, 70, currentY + 5);
  currentY += 14;

  // --- Section 3: Inventory Details (Stock left) ---
  drawSectionHeader('3. INVENTORY DETAILS');
  checkPageBreak(20);

  if (data.inventoryStockLeft.length > 0) {
    const stockBody = data.inventoryStockLeft.map(p => [
      p.name,
      `${p.left} ${p.unit} left`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Product Name', 'Current Stock Levels']],
      body: stockBody,
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: textColor },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 90, fontStyle: 'bold' }
      },
      margin: { left: 15, right: 15 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No active products stock tracked.', 15, currentY);
    currentY += 10;
  }

  // --- Section 4: Promocodes Stats ---
  drawSectionHeader('4. PROMOCODES STATS');
  checkPageBreak(20);

  if (data.promoCodes.length > 0) {
    const promoBody = data.promoCodes.map(p => [
      p.code,
      p.count.toString(),
      `Rs. ${p.discount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Promo Code', 'Times Used', 'Total Discount Given']],
      body: promoBody,
      theme: 'striped',
      headStyles: { fillColor: [100, 100, 100], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: textColor },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 15, right: 15 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No promo codes used in this period.', 15, currentY);
    currentY += 10;
  }

  // --- Section 5: Expenses ---
  drawSectionHeader('5. EXPENSES');
  checkPageBreak(20);

  if (data.expenses.length > 0) {
    const expBody = data.expenses.map(e => [
      e.name,
      `Rs. ${e.price.toLocaleString()}`
    ]);
    expBody.push([
      'Total Expenses',
      `Rs. ${data.totalExpenses.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Expense Description', 'Amount']],
      body: expBody,
      theme: 'grid',
      headStyles: { fillColor: [180, 80, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: textColor },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData) => {
        // Highlight total row
        if (cellData.row.index === expBody.length - 1) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = [253, 242, 242];
        }
      },
      margin: { left: 15, right: 15 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No expenses recorded for this period.', 15, currentY);
    currentY += 10;
  }

  // --- Section 6: Loyalty Claims ---
  drawSectionHeader('6. LOYALTY CLAIM');
  checkPageBreak(20);

  if (data.loyaltyClaims.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Team Name:`, 15, currentY);
    currentY += 6;
    data.loyaltyClaims.forEach(claim => {
      checkPageBreak(6);
      doc.text(`-${claim}`, 15, currentY);
      currentY += 6;
    });
    currentY += 4;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No loyalty claims made.', 15, currentY);
    currentY += 10;
  }

  // --- Section 7: Daily Visitors ---
  drawSectionHeader('7. DAILY VISITORS');
  checkPageBreak(20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Registered Members:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.visitors.registered.toString()}`, 65, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.text(`Guest:`, 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.visitors.guest.toString()}`, 65, currentY);
  currentY += 12;

  // Footer / Performance margin indicator
  checkPageBreak(40);
  
  const totalIncome = data.futsalRevenue.online + data.futsalRevenue.cash + data.gamezoneRevenue + data.inventorySales.totalCash + data.inventorySales.totalOnline + data.futsalRevenue.tournaments.reduce((sum, t) => sum + t.amount, 0);
  const netProfit = Math.max(0, totalIncome - data.totalExpenses);
  const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(15, currentY, 180, 25, 4, 4, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFORMANCE SUMMARY', 25, currentY + 10);
  
  doc.setFontSize(14);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Net Profit: Rs. ${netProfit.toLocaleString()} (${margin}% Margin)`, 25, currentY + 18);
  
  currentY += 32;

  // Footer branding text
  const footerY = 285;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated report and does not require a physical signature.', 105, footerY, { align: 'center' });
  doc.text(`Generated at: ${new Date().toLocaleString()}`, 105, footerY + 4, { align: 'center' });
  
  return doc;
};
