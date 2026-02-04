/**
 * Label Pasien (Patient Label/Sticker)
 * Ukuran label: 50x20mm - 2 kolom per baris
 * Output: PDF langsung
 */

import type { HospitalInfo } from "@/components/print/print-header";
import { calculateAge, formatDateID, formatGenderID } from "@/lib/print-utils";
import type { PatientPrintInfo } from "@/lib/print-utils";
import jsPDF from "jspdf";

export interface PatientLabelData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  allergies?: string[];
  copies?: number;
}

// Label dimensions in mm
const LABEL_WIDTH = 50;
const LABEL_HEIGHT = 20;
const COLUMNS = 2;
const MARGIN_X = 5; // margin dari tepi kertas
const MARGIN_Y = 10; // margin dari tepi kertas
const GAP_X = 5; // jarak antar kolom
const GAP_Y = 2; // jarak antar baris

export function printPatientLabels(data: PatientLabelData): void {
  const copies = data.copies || 4;
  const age = calculateAge(data.patient.tanggal_lahir);
  
  // Create PDF dengan ukuran A4
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Calculate labels per page
  const pageWidth = 210;
  const pageHeight = 297;
  const usableHeight = pageHeight - (2 * MARGIN_Y);
  
  const labelsPerRow = COLUMNS;
  const rowsPerPage = Math.floor((usableHeight + GAP_Y) / (LABEL_HEIGHT + GAP_Y));
  const labelsPerPage = labelsPerRow * rowsPerPage;

  // Generate labels
  for (let i = 0; i < copies; i++) {
    const positionOnPage = i % labelsPerPage;
    
    const col = positionOnPage % labelsPerRow;
    const row = Math.floor(positionOnPage / labelsPerRow);

    // Add new page if needed
    if (i > 0 && positionOnPage === 0) {
      pdf.addPage();
    }

    // Calculate position
    const x = MARGIN_X + col * (LABEL_WIDTH + GAP_X);
    const y = MARGIN_Y + row * (LABEL_HEIGHT + GAP_Y);

    // Draw label border (dashed)
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.rect(x, y, LABEL_WIDTH, LABEL_HEIGHT);
    pdf.setLineDashPattern([], 0);

    // Label content
    const padding = 2;
    const contentX = x + padding;
    const contentY = y + padding;
    const contentWidth = LABEL_WIDTH - (padding * 2);

    // Patient name (bold, larger)
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    const name = data.patient.nama_lengkap.length > 20 
      ? data.patient.nama_lengkap.substring(0, 20) + "..."
      : data.patient.nama_lengkap;
    pdf.text(name, contentX, contentY + 3);

    // No RM
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text(`RM: ${data.patient.no_rm}`, contentX, contentY + 7);

    // Birth date and age
    pdf.setFont("helvetica", "normal");
    const birthInfo = `${formatDateID(data.patient.tanggal_lahir)} (${age})`;
    pdf.text(birthInfo.length > 25 ? birthInfo.substring(0, 25) : birthInfo, contentX, contentY + 10.5);

    // Gender and blood type
    const genderBlood = `${formatGenderID(data.patient.jenis_kelamin)} | ${data.patient.golongan_darah || "-"}${data.patient.rhesus ? data.patient.rhesus : ""}`;
    pdf.text(genderBlood, contentX, contentY + 14);

    // Allergy warning if exists
    if (data.allergies && data.allergies.length > 0) {
      pdf.setFillColor(255, 235, 238);
      pdf.setDrawColor(198, 40, 40);
      pdf.rect(contentX, contentY + 15, contentWidth, 3, "FD");
      pdf.setFontSize(5);
      pdf.setTextColor(198, 40, 40);
      pdf.setFont("helvetica", "bold");
      const allergyText = "⚠ ALERGI: " + data.allergies.slice(0, 2).join(", ");
      pdf.text(allergyText.substring(0, 35), contentX + 0.5, contentY + 17);
      pdf.setTextColor(0, 0, 0);
    }
  }

  // Add title at the top of first page
  pdf.setPage(1);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Label Pasien - ${data.hospital.hospital_name}`, pageWidth / 2, 6, { align: "center" });

  // Open PDF in new tab
  const pdfBlob = pdf.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");

  // Clean up after 10 seconds
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
}

// Legacy HTML generator for backwards compatibility
export function generatePatientLabelHTML(data: PatientLabelData): string {
  const copies = data.copies || 4;
  const age = calculateAge(data.patient.tanggal_lahir);
  
  const labels = Array(copies).fill(null).map(() => `
    <div class="label-item" style="
      width: 50mm;
      height: 20mm;
      border: 1px dashed #ccc;
      padding: 2mm;
      font-family: Arial, sans-serif;
      font-size: 7px;
      position: relative;
      page-break-inside: avoid;
      box-sizing: border-box;
    ">
      <div style="font-weight: bold; font-size: 9px; margin-bottom: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${data.patient.nama_lengkap}
      </div>
      <div style="font-weight: bold;">RM: ${data.patient.no_rm}</div>
      <div>${formatDateID(data.patient.tanggal_lahir)} (${age})</div>
      <div>${formatGenderID(data.patient.jenis_kelamin)} | ${data.patient.golongan_darah || "-"}${data.patient.rhesus || ""}</div>
      ${data.allergies && data.allergies.length > 0 ? `
        <div style="
          background: #ffebee;
          color: #c62828;
          padding: 0.5mm 1mm;
          font-size: 5px;
          font-weight: bold;
          margin-top: 1mm;
        ">⚠ ALERGI: ${data.allergies.slice(0, 2).join(", ")}</div>
      ` : ""}
    </div>
  `).join("");
  
  return `
    <style>
      .labels-container {
        display: grid;
        grid-template-columns: repeat(2, 50mm);
        gap: 2mm 5mm;
        padding: 10mm;
      }
    </style>
    <div style="text-align: center; margin-bottom: 5mm; font-size: 10px; font-weight: bold;">
      Label Pasien - ${data.hospital.hospital_name}
    </div>
    <div class="labels-container">
      ${labels}
    </div>
  `;
}
