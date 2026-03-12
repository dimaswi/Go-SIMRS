/**
 * Print utilities for medical record documents
 * Provides helper functions for generating printable content
 * Generates PDF directly for consistent output
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface PatientPrintInfo {
  no_rm: string;
  nama_lengkap: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  status_perkawinan?: string;
  nik?: string;
  alamat?: string;
  no_hp?: string;
  golongan_darah?: string;
  rhesus?: string;
  nama_penanggung_jawab?: string;
  hubungan_penanggung_jawab?: string;
  telepon_penanggung_jawab?: string;
}

export interface VisitPrintInfo {
  visit_number: string;
  visit_date: string;
  room_name: string;
  doctor_name: string;
  visit_type: string;
  status: string;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate?: string): string {
  if (!birthDate) return "-";
  
  const birth = new Date(birthDate);
  const today = new Date();
  
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  
  if (days < 0) {
    months--;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years > 0) {
    return `${years} tahun`;
  } else if (months > 0) {
    return `${months} bulan`;
  } else {
    return `${days} hari`;
  }
}

/**
 * Format date to Indonesian locale
 */
export function formatDateID(date?: string | Date): string {
  if (!date) return "-";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format date and time to Indonesian locale
 */
export function formatDateTimeID(date?: string | Date): string {
  if (!date) return "-";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format gender to Indonesian
 */
export function formatGenderID(gender?: string): string {
  if (!gender) return "-";
  if (gender === "L" || gender.toLowerCase() === "laki-laki") return "Laki-laki";
  if (gender === "P" || gender.toLowerCase() === "perempuan") return "Perempuan";
  return gender;
}

/**
 * Calculate age in years from birth date string
 */
function getAgeInYears(birthDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get patient title based on gender, marital status, and age.
 * Indonesian medical record conventions:
 * - By. (Bayi) — baby under 1 year
 * - An. (Anak) — child under 18 years (male or female)
 * - Tn. (Tuan) — adult male (18+)
 * - Ny. (Nyonya) — married adult woman
 * - Nn. (Nona) — unmarried adult woman (18+)
 */
export function getPatientTitle(gender?: string, maritalStatus?: string, birthDate?: string): string {
  if (!gender) return "";
  
  const age = getAgeInYears(birthDate);
  
  // Baby (under 1 year)
  if (age !== null && age < 1) return "By.";
  
  // Child (1-17 years)
  if (age !== null && age < 18) return "An.";
  
  // Adult (18+ or age unknown)
  if (gender === "L") return "Tn.";
  if (gender === "P") {
    if (maritalStatus === "belum_menikah") return "Nn.";
    return "Ny.";
  }
  return "";
}

/**
 * Format patient name with title prefix (Tn./Ny./Nn./An./By.)
 */
export function formatPatientName(name?: string, gender?: string, maritalStatus?: string, birthDate?: string): string {
  if (!name) return "-";
  const title = getPatientTitle(gender, maritalStatus, birthDate);
  return title ? `${title} ${name}` : name;
}

/**
 * Generate patient info HTML table for print documents
 */
export function generatePatientInfoHTML(patient: PatientPrintInfo): string {
  const age = calculateAge(patient.tanggal_lahir);
  
  return `
    <table class="info-table" style="font-size: 11px;">
      <tr>
        <td style="width: 120px;">No. Rekam Medis</td>
        <td style="width: 10px;">:</td>
        <td><strong>${patient.no_rm || "-"}</strong></td>
        <td style="width: 100px;">Jenis Kelamin</td>
        <td style="width: 10px;">:</td>
        <td>${formatGenderID(patient.jenis_kelamin)}</td>
      </tr>
      <tr>
        <td>Nama Lengkap</td>
        <td>:</td>
        <td><strong>${formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</strong></td>
        <td>Gol. Darah</td>
        <td>:</td>
        <td>${patient.golongan_darah || "-"}${patient.rhesus ? ` (${patient.rhesus})` : ""}</td>
      </tr>
      <tr>
        <td>Tanggal Lahir</td>
        <td>:</td>
        <td>${formatDateID(patient.tanggal_lahir)} (${age})</td>
        <td>No. HP</td>
        <td>:</td>
        <td>${patient.no_hp || "-"}</td>
      </tr>
      <tr>
        <td>NIK</td>
        <td>:</td>
        <td>${patient.nik || "-"}</td>
        <td>Penanggung Jawab</td>
        <td>:</td>
        <td>${patient.nama_penanggung_jawab || "-"}${patient.hubungan_penanggung_jawab ? ` (${patient.hubungan_penanggung_jawab})` : ""}</td>
      </tr>
      <tr>
        <td>Alamat</td>
        <td>:</td>
        <td colspan="4">${patient.alamat || "-"}</td>
      </tr>
    </table>
  `;
}

/**
 * Generate visit info HTML for print documents
 */
export function generateVisitInfoHTML(visit: VisitPrintInfo): string {
  return `
    <table class="info-table" style="font-size: 11px; margin-top: 8px;">
      <tr>
        <td style="width: 120px;">No. Kunjungan</td>
        <td style="width: 10px;">:</td>
        <td><strong>${visit.visit_number || "-"}</strong></td>
        <td style="width: 100px;">Ruangan</td>
        <td style="width: 10px;">:</td>
        <td>${visit.room_name || "-"}</td>
      </tr>
      <tr>
        <td>Tanggal Kunjungan</td>
        <td>:</td>
        <td>${visit.visit_date || "-"}</td>
        <td>Dokter</td>
        <td>:</td>
        <td>${visit.doctor_name || "-"}</td>
      </tr>
    </table>
  `;
}

/**
 * Generate signature area HTML
 */
export function generateSignatureHTML(options: {
  leftTitle?: string;
  leftName?: string;
  rightTitle?: string;
  rightName?: string;
  date?: string;
  location?: string;
}): string {
  const { leftTitle, leftName, rightTitle, rightName, date, location } = options;
  const today = date || formatDateID(new Date());
  
  return `
    <div class="signature-area" style="display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid;">
      <div class="signature-box" style="text-align: center; width: 200px;">
        ${leftTitle ? `<div style="margin-bottom: 5px;">${leftTitle}</div>` : "<div style=\"height: 20px;\"></div>"}
        <div style="height: 60px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 4px;">
          <strong>${leftName || "(...................................)"}</strong>
        </div>
      </div>
      <div style="text-align: center;">
        ${location ? `<div>${location}, ${today}</div>` : `<div>${today}</div>`}
      </div>
      <div class="signature-box" style="text-align: center; width: 200px;">
        ${rightTitle ? `<div style="margin-bottom: 5px;">${rightTitle}</div>` : "<div style=\"height: 20px;\"></div>"}
        <div style="height: 60px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 4px;">
          <strong>${rightName || "(...................................)"}</strong>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate QR code data URL for patient identification
 */
export async function generatePatientQR(_noRM: string): Promise<string> {
  // Use a simple QR code library or canvas-based generation
  // For now, return empty - can be implemented with qrcode library
  return "";
}

/**
 * Convert image URL to base64 for reliable printing
 * This ensures logos appear correctly in print preview
 */
async function imageToBase64(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}

/**
 * Preprocess content: convert all images to base64
 */
async function preprocessContent(content: string): Promise<string> {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let processedContent = content;
  const matches = [...content.matchAll(imgRegex)];

  for (const match of matches) {
    const imgTag = match[0];
    const imgSrc = match[1];
    
    // Skip if already base64
    if (imgSrc.startsWith("data:")) continue;
    
    try {
      const base64 = await imageToBase64(imgSrc);
      if (base64) {
        const newImgTag = imgTag.replace(imgSrc, base64);
        processedContent = processedContent.replace(imgTag, newImgTag);
      }
    } catch {
      console.warn("Failed to convert image to base64:", imgSrc);
    }
  }

  return processedContent;
}

/**
 * Open print window with A4 fixed size
 * Generates PDF directly using html2canvas + jsPDF
 */
export async function openPrintWindow(content: string, title: string): Promise<void> {
  // Preprocess content to convert images to base64
  const processedContent = await preprocessContent(content);
  
  // Create hidden container for rendering
  const container = document.createElement("div");
  container.id = "pdf-render-container";
  container.innerHTML = `
    <div id="pdf-content" style="
      width: 794px;
      min-height: 1123px;
      padding: 40px 50px;
      background: white;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #000;
      box-sizing: border-box;
    ">
      <style>
        #pdf-content table.print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        #pdf-content table.print-table th,
        #pdf-content table.print-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: left;
          vertical-align: top;
        }
        #pdf-content table.print-table th {
          background: #f0f0f0;
          font-weight: bold;
        }
        #pdf-content table.info-table {
          width: 100%;
          font-size: 10px;
        }
        #pdf-content table.info-table td {
          padding: 2px 0;
          vertical-align: top;
        }
        #pdf-content .section-title {
          font-weight: bold;
          font-size: 12px;
          margin: 12px 0 6px 0;
          padding-bottom: 3px;
          border-bottom: 1px solid #ccc;
        }
        #pdf-content .section-content {
          margin-bottom: 10px;
        }
        #pdf-content .label {
          color: #555;
          font-weight: 500;
        }
        #pdf-content .signature-area {
          margin-top: 40px;
        }
        #pdf-content img {
          max-width: 100%;
          height: auto;
        }
      </style>
      ${processedContent}
    </div>
  `;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    const element = container.querySelector("#pdf-content") as HTMLElement;
    
    // Wait for images to load
    const images = element.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );
    
    // Small delay to ensure rendering is complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Capture with html2canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });

    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;
    const pdfMargin = 0; // Already included in content padding
    
    // Calculate scaling
    const imgWidth = pdfWidth - (pdfMargin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let heightLeft = imgHeight;
    let position = pdfMargin;
    const pageContentHeight = pdfHeight - (pdfMargin * 2);

    // Add first page
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      pdfMargin,
      position,
      imgWidth,
      imgHeight
    );
    heightLeft -= pageContentHeight;

    // Add more pages if needed
    while (heightLeft > 0) {
      pdf.addPage();
      position = pdfMargin - (imgHeight - heightLeft);
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        pdfMargin,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageContentHeight;
    }

    // Open PDF in new tab
    const pdfBlob = pdf.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const pdfWindow = window.open(pdfUrl, "_blank");
    
    if (!pdfWindow) {
      // Fallback: download the PDF
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `${title}.pdf`;
      link.click();
    }

    // Clean up after delay
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Print document types
 */
export type PrintDocumentType =
  | "general-consent"
  | "patient-label"
  | "anamnesis"
  | "physical-exam"
  | "diagnosis"
  | "assessment-plan"
  | "sick-letter"
  | "referral-letter"
  | "triage"
  | "emergency-summary"
  | "cppt"
  | "nursing-care"
  | "fluid-balance"
  | "vital-signs"
  | "lab-order"
  | "lab-result"
  | "radiology-order"
  | "radiology-result"
  | "consultation-request"
  | "consultation-answer"
  | "prescription"
  | "medicine-label"
  | "medicine-receipt"
  | "surgery-consent"
  | "surgery-report"
  | "surgery-checklist"
  | "outpatient-resume"
  | "inpatient-resume"
  | "hospitalization-letter"
  | "death-certificate";
