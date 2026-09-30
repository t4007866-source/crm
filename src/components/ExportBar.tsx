"use client";

import React from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

interface ExportColumn {
  header: string;
  key: string;
}

interface ExportBarProps {
  title: string;
  data: any[];
  columns: ExportColumn[];
  printableId?: string;
  customHeader?: string;
}

export default function ExportBar({ title, data, columns, printableId, customHeader }: ExportBarProps) {
  const exportToExcel = () => {
    if (!data || data.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const exportData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        row[col.header] = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : "";
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
    XLSX.writeFile(workbook, `${title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPdf = () => {
    if (!data || data.length === 0) {
      alert("אין נתונים לייצוא");
      return;
    }

    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    
    // Header
    doc.setFontSize(16);
    doc.text(`Shi Sachar - ${title}`, 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString("he-IL")}`, 105, 22, { align: "center" });

    let y = 32;
    const pageHeight = 280;

    // Render simple structured table in PDF
    data.forEach((item, index) => {
      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`#${index + 1}`, 15, y);

      let x = 25;
      columns.forEach((col) => {
        const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : "";
        doc.setFont("helvetica", "normal");
        doc.text(`${col.header}: ${val}`, x, y);
        x += 45;
        if (x > 185) {
          x = 25;
          y += 5;
        }
      });

      y += 8;
      doc.setDrawColor(220, 220, 220);
      doc.line(15, y - 3, 195, y - 3);
    });

    doc.save(`${title}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const printData = () => {
    if (printableId) {
      const el = document.getElementById(printableId);
      if (el) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html dir="rtl" lang="he">
              <head>
                <title>${title}</title>
                <style>
                  body { font-family: system-ui, sans-serif; padding: 20px; color: #111; }
                  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                  th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                  th { background-color: #f3f4f6; font-weight: bold; }
                  .header { margin-bottom: 20px; border-bottom: 2px solid #3b2b76; padding-bottom: 10px; }
                  @media print {
                    button { display: none; }
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>שי סחר — ${title}</h2>
                  <div>תאריך הדפסה: ${new Date().toLocaleDateString("he-IL")}</div>
                </div>
                ${el.outerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          printWindow.close();
          return;
        }
      }
    }

    // Default window print
    window.print();
  };

  return (
    <div className="flex items-center gap-2 my-3 p-2.5 rounded-xl border bg-card text-card-foreground shadow-sm no-print">
      <span className="text-xs font-semibold text-muted-foreground mr-1">ייצוא והדפסה:</span>
      <button
        onClick={exportToExcel}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 transition-colors flex items-center gap-1"
      >
        📊 ייצוא Excel
      </button>
      <button
        onClick={exportToPdf}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 transition-colors flex items-center gap-1"
      >
        📄 ייצוא PDF
      </button>
      <button
        onClick={printData}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1"
      >
        🖨️ הדפסה
      </button>
    </div>
  );
}

