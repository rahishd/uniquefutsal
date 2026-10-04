// Simple table-to-PDF export for the Profile page (bookings, games, payments).
// jsPDF is loaded only when a customer taps "Download PDF", so it doesn't weigh down the page.

export interface PdfColumn {
  header: string;
  width: number; // points; all columns together should fit in about 515
}

export interface PdfTable {
  filename: string;
  title: string;
  lines?: string[]; // small grey lines under the title (name, totals, ...)
  columns: PdfColumn[];
  rows: string[][];
}

export async function downloadPdf(t: PdfTable) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const pageH = doc.internal.pageSize.getHeight();
  const lineH = 13;
  let y = M;

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(12, 11, 93);
  doc.text("Unique Futsal", M, y);
  y += 22;
  doc.setFontSize(13).setTextColor(30, 41, 59);
  doc.text(t.title, M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 116, 139);
  for (const l of [...(t.lines ?? []), `Generated ${new Date().toLocaleString("en-GB")}`]) {
    doc.text(l, M, y);
    y += 12;
  }
  y += 8;

  const xs = t.columns.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? M : acc[i - 1] + t.columns[i - 1].width], []);

  const header = () => {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(100, 116, 139);
    t.columns.forEach((c, i) => doc.text(c.header.toUpperCase(), xs[i], y));
    y += 5;
    doc.setDrawColor(203, 213, 225).line(M, y, 555, y);
    y += 12;
  };
  header();

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30, 41, 59);
  for (const row of t.rows) {
    const cells = row.map((cell, i) => doc.splitTextToSize(cell, t.columns[i].width - 8) as string[]);
    const h = Math.max(...cells.map((c) => c.length)) * lineH;
    if (y + h > pageH - M) {
      doc.addPage();
      y = M;
      header();
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30, 41, 59);
    }
    cells.forEach((c, i) => doc.text(c, xs[i], y));
    y += h + 4;
    doc.setDrawColor(241, 245, 249).line(M, y - 2, 555, y - 2);
  }

  doc.save(t.filename);
}
