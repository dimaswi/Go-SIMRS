/**
 * Surat Kontrol (SKDP)
 * Template cetakan Surat Keterangan Dalam Perawatan / Surat Kontrol
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  formatDateID,
  formatGenderID,
  calculateAge,
} from "@/lib/print-utils";
import type { PatientPrintInfo } from "@/lib/print-utils";

export interface SuratKontrolPrintData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  no_surat_kontrol: string;
  tgl_rencana_kontrol: string;
  tgl_terbit: string;
  poli_tujuan: string;
  dokter_tujuan: string;
  diagnosa?: string;
  keterangan?: string;
  
  // Signature info
  pasien_signature_img?: string;
  pasien_name?: string;
  dokter_signature_qr?: string;
}

export function generateSuratKontrolHTML(data: SuratKontrolPrintData): string {
  const header = generatePrintHeaderHTML(data.hospital, "SURAT KONTROL / SKDP", data.no_surat_kontrol);
  const age = calculateAge(data.patient.tanggal_lahir);
  
  // Custom signature area to support images/QRs
  const signatureHTML = `
    <div class="signature-area" style="display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid;">
      <div class="signature-box" style="text-align: center; width: 200px;">
        <div style="margin-bottom: 5px;">Pasien / Keluarga</div>
        <div style="height: 60px; display: flex; justify-content: center; align-items: center;">
          ${data.pasien_signature_img 
            ? `<img src="${data.pasien_signature_img}" style="max-height: 50px; max-width: 150px;" />` 
            : ``}
        </div>
        <div style="border-top: 1px solid #000; padding-top: 4px;">
          <strong>${data.pasien_name || data.patient.nama_lengkap}</strong>
        </div>
      </div>
      <div style="text-align: center;">
        <div>${data.hospital.hospital_city || ""}, ${formatDateID(data.tgl_terbit)}</div>
      </div>
      <div class="signature-box" style="text-align: center; width: 200px;">
        <div style="margin-bottom: 5px;">Mengetahui DPJP</div>
        <div style="height: 60px; display: flex; justify-content: center; align-items: center;">
           ${data.dokter_signature_qr
             ? `<img src="${data.dokter_signature_qr}" style="width: 50px; height: 50px;" />`
             : ``}
        </div>
        <div style="border-top: 1px solid #000; padding-top: 4px;">
          <strong>${data.dokter_tujuan || "(...................................)"}</strong>
        </div>
      </div>
    </div>
  `;

  return `
    ${header}
    
    <div style="margin-top: 25px; line-height: 1.8; text-align: justify; font-size: 13px;">
      <p>Telah diberikan surat kontrol (Surat Keterangan Dalam Perawatan) untuk pasien:</p>
      
      <table style="margin: 15px 0 20px 40px; font-size: 13px;">
        <tr>
          <td style="width: 150px; padding: 4px 0;">No. Rekam Medis</td>
          <td style="width: 10px;">:</td>
          <td><strong>${data.patient.no_rm}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Nama Lengkap</td>
          <td>:</td>
          <td><strong>${data.patient.nama_lengkap}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Tempat/Tgl. Lahir</td>
          <td>:</td>
          <td>${data.patient.tanggal_lahir ? `${formatDateID(data.patient.tanggal_lahir)} (${age})` : "-"}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Jenis Kelamin</td>
          <td>:</td>
          <td>${formatGenderID(data.patient.jenis_kelamin)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Diagnosa</td>
          <td>:</td>
          <td>${data.diagnosa || "-"}</td>
        </tr>
      </table>
      
      <p>Mohon datang untuk pemeriksaan/kontrol kembali pada:</p>
      
      <table style="margin: 15px 0 20px 40px; font-size: 13px;">
        <tr>
          <td style="width: 150px; padding: 4px 0;">Tanggal Rencana Kontrol</td>
          <td style="width: 10px;">:</td>
          <td><strong style="font-size: 14px;">${formatDateID(data.tgl_rencana_kontrol)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Poliklinik Tujuan</td>
          <td>:</td>
          <td><strong>${data.poli_tujuan}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Dokter Tujuan</td>
          <td>:</td>
          <td><strong>${data.dokter_tujuan}</strong></td>
        </tr>
      </table>

      ${data.keterangan ? `<p style="margin-top: 15px;"><strong>Keterangan:</strong><br/>${data.keterangan}</p>` : ""}
      
      <p style="margin-top: 20px; font-size: 11px; color: #555;">
        <em>Harap surat ini dibawa pada saat pemeriksaan kembali ke rumah sakit. Jika tidak dapat hadir pada tanggal tersebut, silakan menghubungi bagian pendaftaran untuk melakukan jadwal ulang (reschedule).</em>
      </p>
    </div>
    
    ${signatureHTML}
    
    <div style="margin-top: 40px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; text-align: center;">
      Dokumen ini dicetak secara otomatis dari sistem informasi rumah sakit.
    </div>
  `;
}
