/**
 * Resep Obat (Prescription)
 * Template cetakan F1 - Resep obat untuk farmasi
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  formatGenderID,
  calculateAge,
  generateSignatureHTML,
  openPrintWindow,
} from "@/lib/print-utils";
import type { PatientPrintInfo, VisitPrintInfo } from "@/lib/print-utils";

export interface PrescriptionItem {
  medicine_name: string;
  medicine_code?: string;
  strength?: string;
  form?: string; // tablet, kapsul, sirup, etc.
  quantity: number;
  unit: string;
  dosage?: string; // 500mg, etc.
  frequency?: string; // 3x1, etc.
  route?: string; // oral, IV, etc.
  duration?: string; // 5 hari
  instructions?: string; // sesudah makan, dll
  is_prn?: boolean; // bila perlu
}

export interface PrescriptionData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  visit: VisitPrintInfo;
  prescription_number: string;
  prescription_type: "regular" | "racikan" | "prn";
  items: PrescriptionItem[];
  diagnosis?: string;
  allergies?: string;
  notes?: string;
  doctor_name: string;
  doctor_sip?: string;
}

function formatQuantity(qty: number): string {
  // Roman numerals for traditional prescription format
  const roman: Record<number, string> = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
    6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
  };
  return roman[qty] || qty.toString();
}

function generatePrescriptionItemsHTML(items: PrescriptionItem[]): string {
  return items.map((item, index) => `
    <div style="margin-bottom: 15px; padding: 10px; border-left: 3px solid #0066cc; background: #f8f9fa;">
      <div style="font-size: 10px; color: #666;">R/ ${index + 1}</div>
      <div style="font-weight: bold; font-size: 13px; margin: 5px 0;">
        ${item.medicine_name}${item.strength ? ` ${item.strength}` : ""}${item.form ? ` (${item.form})` : ""}
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <div>
          <span style="color: #0066cc;">Jumlah:</span> 
          <strong>${formatQuantity(item.quantity)} ${item.unit}</strong>
        </div>
        ${item.duration ? `<div><span style="color: #666;">Durasi:</span> ${item.duration}</div>` : ""}
      </div>
      <div style="margin-top: 8px; padding: 5px; background: #e3f2fd; border-radius: 3px;">
        <span style="font-weight: bold;">S</span> 
        ${item.frequency || ""} 
        ${item.dosage || ""} 
        ${item.route ? `(${item.route})` : ""} 
        ${item.instructions ? `- ${item.instructions}` : ""}
        ${item.is_prn ? " <em>(bila perlu)</em>" : ""}
      </div>
    </div>
  `).join("");
}

export function generatePrescriptionHTML(data: PrescriptionData): string {
  const header = generatePrintHeaderHTML(data.hospital, "RESEP", data.prescription_number);
  const age = calculateAge(data.patient.tanggal_lahir);
  
  const typeLabels: Record<string, string> = {
    regular: "Regular",
    racikan: "Racikan",
    prn: "PRN (Bila Perlu)",
  };
  
  return `
    ${header}
    
    <div style="display: flex; gap: 20px; margin-top: 15px;">
      <div style="flex: 1; padding: 10px; border: 1px solid #ddd; background: #fafafa;">
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td style="width: 80px;">No. RM</td>
            <td>: <strong>${data.patient.no_rm}</strong></td>
          </tr>
          <tr>
            <td>Nama</td>
            <td>: <strong>${data.patient.nama_lengkap}</strong></td>
          </tr>
          <tr>
            <td>Umur/JK</td>
            <td>: ${age} / ${formatGenderID(data.patient.jenis_kelamin)}</td>
          </tr>
          <tr>
            <td>Alamat</td>
            <td>: ${data.patient.alamat || "-"}</td>
          </tr>
        </table>
      </div>
      <div style="width: 200px; padding: 10px; border: 1px solid #ddd; background: #fafafa;">
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td>Tanggal</td>
            <td>: ${data.visit.visit_date}</td>
          </tr>
          <tr>
            <td>Ruangan</td>
            <td>: ${data.visit.room_name}</td>
          </tr>
          <tr>
            <td>Jenis</td>
            <td>: ${typeLabels[data.prescription_type] || data.prescription_type}</td>
          </tr>
        </table>
      </div>
    </div>
    
    ${data.allergies ? `
      <div style="margin-top: 10px; padding: 8px; background: #ffebee; border: 1px solid #ef9a9a; color: #c62828; font-weight: bold;">
        ⚠️ ALERGI: ${data.allergies}
      </div>
    ` : ""}
    
    ${data.diagnosis ? `
      <div style="margin-top: 10px; font-size: 11px;">
        <span style="color: #666;">Diagnosis:</span> ${data.diagnosis}
      </div>
    ` : ""}
    
    <div style="margin-top: 20px;">
      ${generatePrescriptionItemsHTML(data.items)}
    </div>
    
    ${data.notes ? `
      <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; font-size: 11px;">
        <strong>Catatan untuk Farmasi:</strong><br/>
        ${data.notes}
      </div>
    ` : ""}
    
    ${generateSignatureHTML({
      rightTitle: "Dokter Penulis Resep",
      rightName: data.doctor_name + (data.doctor_sip ? `<br/><span style="font-size: 10px; font-weight: normal;">SIP: ${data.doctor_sip}</span>` : ""),
      location: data.hospital.hospital_city,
    })}
    
    <div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px;">
      <div style="font-size: 9px; color: #666;">
        <strong>Untuk Apotek:</strong><br/>
        Tanggal dilayani: ...................... | Petugas: ...................... | TTD: ......................
      </div>
    </div>
  `;
}

export function printPrescription(data: PrescriptionData): void {
  const content = generatePrescriptionHTML(data);
  openPrintWindow(content, `Resep - ${data.prescription_number} - ${data.patient.nama_lengkap}`);
}
