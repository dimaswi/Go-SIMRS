/**
 * Surat Keterangan Sakit (Sick Letter)
 * Template cetakan B6 - Surat keterangan sakit untuk pasien
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  formatDateID,
  formatGenderID,
  calculateAge,
  generateSignatureHTML,
  openPrintWindow,
} from "@/lib/print-utils";
import type { PatientPrintInfo } from "@/lib/print-utils";

export interface SickLetterData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  letter_number?: string;
  visit_date: string;
  diagnosis: string;
  rest_days: number;
  rest_start_date: string;
  rest_end_date?: string;
  doctor_name: string;
  doctor_sip?: string;
  notes?: string;
}

export function generateSickLetterHTML(data: SickLetterData): string {
  const header = generatePrintHeaderHTML(data.hospital, "Surat Keterangan Sakit", data.letter_number);
  const age = calculateAge(data.patient.tanggal_lahir);
  
  // Calculate end date if not provided
  let endDate = data.rest_end_date;
  if (!endDate && data.rest_start_date && data.rest_days > 0) {
    const start = new Date(data.rest_start_date);
    start.setDate(start.getDate() + data.rest_days - 1);
    endDate = start.toISOString().split("T")[0];
  }
  
  return `
    ${header}
    
    <div style="margin-top: 25px; line-height: 1.8; text-align: justify;">
      <p>Yang bertanda tangan di bawah ini, dokter yang bertugas di ${data.hospital.hospital_name}, menerangkan bahwa:</p>
      
      <table style="margin: 20px 0 20px 40px; font-size: 12px;">
        <tr>
          <td style="width: 150px; padding: 5px 0;">Nama</td>
          <td style="width: 10px;">:</td>
          <td><strong>${data.patient.nama_lengkap}</strong></td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">No. Rekam Medis</td>
          <td>:</td>
          <td>${data.patient.no_rm}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Tempat/Tgl. Lahir</td>
          <td>:</td>
          <td>${data.patient.tanggal_lahir ? `${formatDateID(data.patient.tanggal_lahir)} (${age})` : "-"}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Jenis Kelamin</td>
          <td>:</td>
          <td>${formatGenderID(data.patient.jenis_kelamin)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">NIK</td>
          <td>:</td>
          <td>${data.patient.nik || "-"}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Alamat</td>
          <td>:</td>
          <td>${data.patient.alamat || "-"}</td>
        </tr>
      </table>
      
      <p>Berdasarkan hasil pemeriksaan pada tanggal <strong>${formatDateID(data.visit_date)}</strong>, yang bersangkutan dinyatakan <strong>SAKIT</strong> dan memerlukan istirahat selama <strong>${data.rest_days} (${numberToWords(data.rest_days)}) hari</strong>, terhitung mulai tanggal:</p>
      
      <p style="text-align: center; margin: 20px 0;">
        <strong style="font-size: 14px;">${formatDateID(data.rest_start_date)} s/d ${formatDateID(endDate)}</strong>
      </p>
      
      <p>Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
      
      ${data.notes ? `<p style="margin-top: 15px;"><em>Catatan: ${data.notes}</em></p>` : ""}
    </div>
    
    ${generateSignatureHTML({
      rightTitle: "Dokter Pemeriksa",
      rightName: data.doctor_name + (data.doctor_sip ? `<br/><span style="font-size: 10px; font-weight: normal;">SIP: ${data.doctor_sip}</span>` : ""),
      location: data.hospital.hospital_city,
      date: formatDateID(data.visit_date),
    })}
    
    <div style="margin-top: 30px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
      <em>* Surat keterangan ini bukan merupakan alat bukti di pengadilan</em>
    </div>
  `;
}

function numberToWords(num: number): string {
  const words = [
    "", "satu", "dua", "tiga", "empat", "lima", 
    "enam", "tujuh", "delapan", "sembilan", "sepuluh",
    "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas"
  ];
  
  if (num <= 15) return words[num];
  if (num < 20) return words[num - 10] + " belas";
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    return words[tens] + " puluh" + (units > 0 ? " " + words[units] : "");
  }
  return num.toString();
}

export function printSickLetter(data: SickLetterData): void {
  const content = generateSickLetterHTML(data);
  openPrintWindow(content, `Surat Sakit - ${data.patient.nama_lengkap}`);
}
