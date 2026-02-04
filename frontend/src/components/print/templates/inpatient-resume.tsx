/**
 * Resume Medis Rawat Inap (Inpatient Discharge Summary)
 * Template cetakan H2 - Resume medis lengkap untuk pasien rawat inap
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  formatDateID,
  formatDateTimeID,
  formatGenderID,
  calculateAge,
  openPrintWindow,
} from "@/lib/print-utils";
import type { PatientPrintInfo, VisitPrintInfo } from "@/lib/print-utils";

export interface InpatientResumeData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  visit: VisitPrintInfo;
  // Admission info
  admission_date: string;
  discharge_date: string;
  length_of_stay: number;
  ward_name: string;
  bed_number?: string;
  inpatient_class?: string;
  // Diagnoses
  admission_diagnosis?: string;
  final_diagnoses: Array<{
    icd10_code: string;
    icd10_name: string;
    type: string;
  }>;
  // Clinical summary
  clinical_summary?: string;
  // Procedures performed
  procedures?: Array<{
    name: string;
    date?: string;
    result?: string;
    operator?: string;
  }>;
  // Surgery (if any)
  surgeries?: Array<{
    name: string;
    date: string;
    surgeon: string;
    findings?: string;
  }>;
  // Important lab results
  lab_results?: Array<{
    name: string;
    result: string;
    date?: string;
  }>;
  // Medications during stay
  medications_during_stay?: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  // Discharge info
  discharge_status: string; // sembuh, membaik, belum_sembuh, meninggal, APS
  discharge_condition?: string;
  condition_at_discharge?: string;
  // Discharge medications
  discharge_medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration?: string;
    instructions?: string;
  }>;
  // Instructions
  discharge_instructions?: string;
  diet_instructions?: string;
  activity_instructions?: string;
  // Follow up
  follow_up_date?: string;
  follow_up_room?: string;
  follow_up_instructions?: string;
  // Attending physicians
  primary_doctor: string;
  attending_doctors?: string[];
}

function generateDiagnosesHTML(diagnoses: InpatientResumeData["final_diagnoses"]): string {
  if (!diagnoses || diagnoses.length === 0) {
    return "<em>Tidak ada diagnosis</em>";
  }
  
  const primary = diagnoses.filter(d => d.type === "primary");
  const secondary = diagnoses.filter(d => d.type !== "primary");
  
  let html = "";
  
  if (primary.length > 0) {
    html += `<div style="margin-bottom: 5px;">
      <strong>Diagnosis Utama:</strong><br/>
      ${primary.map(d => `• <strong>${d.icd10_code}</strong> - ${d.icd10_name}`).join("<br/>")}
    </div>`;
  }
  
  if (secondary.length > 0) {
    html += `<div>
      <strong>Diagnosis Sekunder:</strong><br/>
      ${secondary.map(d => `• ${d.icd10_code} - ${d.icd10_name}`).join("<br/>")}
    </div>`;
  }
  
  return html;
}

function generateDischargeMedicationsHTML(medications?: InpatientResumeData["discharge_medications"]): string {
  if (!medications || medications.length === 0) {
    return "<em>Tidak ada obat pulang</em>";
  }
  
  return `
    <table class="print-table" style="font-size: 10px;">
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th>Nama Obat</th>
          <th style="width: 80px;">Dosis</th>
          <th style="width: 80px;">Frekuensi</th>
          <th style="width: 80px;">Durasi</th>
          <th>Instruksi</th>
        </tr>
      </thead>
      <tbody>
        ${medications.map((m, i) => `
          <tr>
            <td style="text-align: center;">${i + 1}</td>
            <td>${m.name}</td>
            <td>${m.dosage || "-"}</td>
            <td>${m.frequency || "-"}</td>
            <td>${m.duration || "-"}</td>
            <td>${m.instructions || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function getDischargeStatusLabel(status: string): { label: string; style: string } {
  const statusMap: Record<string, { label: string; style: string }> = {
    sembuh: { label: "Sembuh", style: "color: #2e7d32; background: #e8f5e9;" },
    membaik: { label: "Membaik", style: "color: #1565c0; background: #e3f2fd;" },
    belum_sembuh: { label: "Belum Sembuh", style: "color: #e65100; background: #fff3e0;" },
    meninggal: { label: "Meninggal", style: "color: #c62828; background: #ffebee;" },
    aps: { label: "Atas Permintaan Sendiri", style: "color: #6a1b9a; background: #f3e5f5;" },
    pulang_paksa: { label: "Pulang Paksa", style: "color: #6a1b9a; background: #f3e5f5;" },
    rujuk: { label: "Dirujuk", style: "color: #00695c; background: #e0f2f1;" },
  };
  return statusMap[status] || { label: status, style: "" };
}

export function generateInpatientResumeHTML(data: InpatientResumeData): string {
  const header = generatePrintHeaderHTML(data.hospital, "Resume Medis Rawat Inap", data.visit.visit_number);
  const age = calculateAge(data.patient.tanggal_lahir);
  const dischargeStatus = getDischargeStatusLabel(data.discharge_status);
  
  return `
    ${header}
    
    <div style="display: flex; gap: 10px; margin-top: 15px;">
      <div style="flex: 1; padding: 10px; border: 1px solid #ddd; background: #fafafa;">
        <div style="font-weight: bold; color: #0066cc; margin-bottom: 8px;">DATA PASIEN</div>
        <table style="width: 100%; font-size: 10px;">
          <tr><td style="width: 100px;">No. RM</td><td>: <strong>${data.patient.no_rm}</strong></td></tr>
          <tr><td>Nama</td><td>: <strong>${data.patient.nama_lengkap}</strong></td></tr>
          <tr><td>Tgl Lahir</td><td>: ${formatDateID(data.patient.tanggal_lahir)} (${age})</td></tr>
          <tr><td>JK</td><td>: ${formatGenderID(data.patient.jenis_kelamin)}</td></tr>
          <tr><td>Alamat</td><td>: ${data.patient.alamat || "-"}</td></tr>
        </table>
      </div>
      <div style="flex: 1; padding: 10px; border: 1px solid #ddd; background: #fafafa;">
        <div style="font-weight: bold; color: #0066cc; margin-bottom: 8px;">DATA PERAWATAN</div>
        <table style="width: 100%; font-size: 10px;">
          <tr><td style="width: 100px;">Tgl Masuk</td><td>: ${formatDateTimeID(data.admission_date)}</td></tr>
          <tr><td>Tgl Keluar</td><td>: ${formatDateTimeID(data.discharge_date)}</td></tr>
          <tr><td>Lama Rawat</td><td>: <strong>${data.length_of_stay} hari</strong></td></tr>
          <tr><td>Ruangan</td><td>: ${data.ward_name}${data.bed_number ? ` / Bed ${data.bed_number}` : ""}</td></tr>
          <tr><td>Kelas</td><td>: ${data.inpatient_class || "-"}</td></tr>
          <tr><td>DPJP</td><td>: <strong>${data.primary_doctor}</strong></td></tr>
        </table>
      </div>
    </div>
    
    <div style="margin-top: 10px; padding: 10px; border: 1px solid #ddd;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>Status Pulang:</strong> 
          <span style="padding: 3px 10px; ${dischargeStatus.style}">${dischargeStatus.label}</span>
        </div>
        ${data.condition_at_discharge ? `
          <div><strong>Kondisi:</strong> ${data.condition_at_discharge}</div>
        ` : ""}
      </div>
    </div>
    
    <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
      DIAGNOSIS
    </div>
    ${data.admission_diagnosis ? `
      <div style="margin-bottom: 8px; font-size: 10px;">
        <strong>Diagnosis Masuk:</strong> ${data.admission_diagnosis}
      </div>
    ` : ""}
    <div style="font-size: 10px;">
      ${generateDiagnosesHTML(data.final_diagnoses)}
    </div>
    
    ${data.clinical_summary ? `
      <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
        RINGKASAN PERJALANAN PENYAKIT
      </div>
      <div style="font-size: 10px; white-space: pre-line;">${data.clinical_summary}</div>
    ` : ""}
    
    ${data.procedures && data.procedures.length > 0 ? `
      <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
        TINDAKAN / PROSEDUR
      </div>
      <table class="print-table" style="font-size: 10px;">
        <thead>
          <tr>
            <th>Tindakan</th>
            <th style="width: 100px;">Tanggal</th>
            <th>Hasil</th>
          </tr>
        </thead>
        <tbody>
          ${data.procedures.map(p => `
            <tr>
              <td>${p.name}</td>
              <td>${p.date ? formatDateID(p.date) : "-"}</td>
              <td>${p.result || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""}
    
    ${data.surgeries && data.surgeries.length > 0 ? `
      <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
        OPERASI
      </div>
      ${data.surgeries.map(s => `
        <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #ddd; font-size: 10px;">
          <div><strong>${s.name}</strong></div>
          <div>Tanggal: ${formatDateID(s.date)} | Operator: ${s.surgeon}</div>
          ${s.findings ? `<div>Temuan: ${s.findings}</div>` : ""}
        </div>
      `).join("")}
    ` : ""}
    
    ${data.lab_results && data.lab_results.length > 0 ? `
      <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
        HASIL PENUNJANG PENTING
      </div>
      <div style="font-size: 10px;">
        ${data.lab_results.map(l => `• ${l.name}: <strong>${l.result}</strong>${l.date ? ` (${formatDateID(l.date)})` : ""}`).join("<br/>")}
      </div>
    ` : ""}
    
    <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
      OBAT PULANG
    </div>
    ${generateDischargeMedicationsHTML(data.discharge_medications)}
    
    <div class="section-title" style="font-weight: bold; font-size: 11px; margin: 12px 0 8px; padding-bottom: 3px; border-bottom: 1px solid #ccc;">
      INSTRUKSI PULANG
    </div>
    <div style="font-size: 10px;">
      ${data.discharge_instructions ? `<div style="margin-bottom: 5px;"><strong>Instruksi Umum:</strong><br/>${data.discharge_instructions}</div>` : ""}
      ${data.diet_instructions ? `<div style="margin-bottom: 5px;"><strong>Diet:</strong> ${data.diet_instructions}</div>` : ""}
      ${data.activity_instructions ? `<div style="margin-bottom: 5px;"><strong>Aktivitas:</strong> ${data.activity_instructions}</div>` : ""}
    </div>
    
    ${data.follow_up_date ? `
      <div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border: 1px solid #1976d2; font-size: 10px;">
        <strong>KONTROL ULANG:</strong> ${formatDateID(data.follow_up_date)}${data.follow_up_room ? ` di ${data.follow_up_room}` : ""}
        ${data.follow_up_instructions ? `<br/>${data.follow_up_instructions}` : ""}
      </div>
    ` : ""}
    
    <div style="display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid;">
      <div style="text-align: center; width: 180px;">
        <div style="font-size: 9px;">Pasien/Keluarga</div>
        <div style="height: 45px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 10px;">
          <strong>(..............................)</strong>
        </div>
      </div>
      <div style="text-align: center; font-size: 10px;">
        ${data.hospital.hospital_city}, ${formatDateID(data.discharge_date)}
      </div>
      <div style="text-align: center; width: 180px;">
        <div style="font-size: 9px;">DPJP</div>
        <div style="height: 45px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 10px;">
          <strong>${data.primary_doctor}</strong>
        </div>
      </div>
    </div>
  `;
}

export function printInpatientResume(data: InpatientResumeData): void {
  const content = generateInpatientResumeHTML(data);
  openPrintWindow(content, `Resume Ranap - ${data.patient.nama_lengkap} - ${data.visit.visit_number}`);
}
