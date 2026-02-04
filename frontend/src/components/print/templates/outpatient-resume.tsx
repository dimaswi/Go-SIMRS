/**
 * Resume Medis Rawat Jalan (Outpatient Medical Resume)
 * Template cetakan H1 - komprehensif untuk kunjungan rawat jalan
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  generatePatientInfoHTML,
  generateVisitInfoHTML,
  generateSignatureHTML,
  formatDateID,
  openPrintWindow,
} from "@/lib/print-utils";
import type { PatientPrintInfo, VisitPrintInfo } from "@/lib/print-utils";

export interface OutpatientResumeData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  visit: VisitPrintInfo;
  // Anamnesis
  anamnesis?: {
    chief_complaint?: string;
    history_of_present_illness?: string;
    past_medical_history?: string;
    family_history?: string;
    social_history?: string;
    allergies?: string;
    current_medications?: string;
  };
  // Physical Examination
  physical_exam?: {
    general_condition?: string;
    consciousness?: string;
    blood_pressure?: string;
    heart_rate?: string;
    respiratory_rate?: string;
    temperature?: string;
    oxygen_saturation?: string;
    weight?: string;
    height?: string;
    bmi?: number;
    findings?: string;
  };
  // Diagnosis
  diagnoses?: Array<{
    icd10_code: string;
    icd10_name: string;
    type: string;
  }>;
  clinical_impression?: string;
  // Procedures
  procedures?: Array<{
    name: string;
    performed_at?: string;
    result?: string;
  }>;
  // Medications
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration?: string;
    instructions?: string;
  }>;
  // Assessment Plan
  assessment_plan?: {
    clinical_assessment?: string;
    prognosis?: string;
    treatment_plan?: string;
    education_plan?: string;
  };
  // Disposition
  disposition?: {
    type?: string;
    instructions?: string;
    follow_up_date?: string;
    follow_up_room?: string;
    referral_facility?: string;
    referral_reason?: string;
  };
  // Supporting examinations
  lab_results?: Array<{
    name: string;
    result: string;
    unit?: string;
    normal_range?: string;
    is_abnormal?: boolean;
  }>;
  radiology_results?: Array<{
    name: string;
    result: string;
    conclusion?: string;
  }>;
}

function generateVitalSignsHTML(exam: OutpatientResumeData["physical_exam"]): string {
  if (!exam) return "<em>Tidak ada data</em>";
  
  const items = [];
  if (exam.blood_pressure) items.push(`TD: ${exam.blood_pressure} mmHg`);
  if (exam.heart_rate) items.push(`Nadi: ${exam.heart_rate} x/menit`);
  if (exam.respiratory_rate) items.push(`RR: ${exam.respiratory_rate} x/menit`);
  if (exam.temperature) items.push(`Suhu: ${exam.temperature} °C`);
  if (exam.oxygen_saturation) items.push(`SpO2: ${exam.oxygen_saturation} %`);
  if (exam.weight) items.push(`BB: ${exam.weight} kg`);
  if (exam.height) items.push(`TB: ${exam.height} cm`);
  if (exam.bmi) items.push(`IMT: ${exam.bmi.toFixed(1)} kg/m²`);
  
  return items.length > 0 ? items.join(" | ") : "-";
}

function generateDiagnosesHTML(diagnoses?: OutpatientResumeData["diagnoses"]): string {
  if (!diagnoses || diagnoses.length === 0) {
    return "<em>Tidak ada diagnosis</em>";
  }
  
  const primary = diagnoses.filter(d => d.type === "primary");
  const secondary = diagnoses.filter(d => d.type === "secondary" || d.type === "complication");
  
  let html = "";
  
  if (primary.length > 0) {
    html += `<div style="margin-bottom: 8px;">
      <strong>Diagnosis Utama:</strong><br/>
      ${primary.map(d => `<span style="color: #0066cc;">• ${d.icd10_code}</span> - ${d.icd10_name}`).join("<br/>")}
    </div>`;
  }
  
  if (secondary.length > 0) {
    html += `<div>
      <strong>Diagnosis Sekunder:</strong><br/>
      ${secondary.map(d => `<span style="color: #666;">• ${d.icd10_code}</span> - ${d.icd10_name}`).join("<br/>")}
    </div>`;
  }
  
  return html;
}

function generateMedicationsHTML(medications?: OutpatientResumeData["medications"]): string {
  if (!medications || medications.length === 0) {
    return "<em>Tidak ada resep obat</em>";
  }
  
  return `
    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th>Nama Obat</th>
          <th style="width: 100px;">Dosis</th>
          <th style="width: 100px;">Frekuensi</th>
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
            <td>${m.instructions || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function generateLabResultsHTML(results?: OutpatientResumeData["lab_results"]): string {
  if (!results || results.length === 0) {
    return "";
  }
  
  return `
    <div class="section-title">Hasil Laboratorium</div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th style="width: 100px;">Hasil</th>
          <th style="width: 80px;">Satuan</th>
          <th style="width: 120px;">Nilai Normal</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
          <tr style="${r.is_abnormal ? "background: #fff3cd;" : ""}">
            <td>${r.name}</td>
            <td style="text-align: center;${r.is_abnormal ? " font-weight: bold; color: #d63384;" : ""}">${r.result}</td>
            <td>${r.unit || "-"}</td>
            <td>${r.normal_range || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function generateRadiologyResultsHTML(results?: OutpatientResumeData["radiology_results"]): string {
  if (!results || results.length === 0) {
    return "";
  }
  
  return `
    <div class="section-title">Hasil Radiologi</div>
    ${results.map(r => `
      <div style="margin-bottom: 8px;">
        <strong>${r.name}</strong><br/>
        ${r.result}<br/>
        ${r.conclusion ? `<em>Kesan: ${r.conclusion}</em>` : ""}
      </div>
    `).join("")}
  `;
}

function generateDispositionHTML(disposition?: OutpatientResumeData["disposition"]): string {
  if (!disposition) return "<em>Belum ada disposisi</em>";
  
  const typeLabels: Record<string, string> = {
    pulang: "Pulang",
    rawat_inap: "Rawat Inap",
    rujuk: "Rujuk",
    kontrol: "Kontrol Ulang",
  };
  
  let html = `<div><strong>Status:</strong> ${typeLabels[disposition.type || ""] || disposition.type || "-"}</div>`;
  
  if (disposition.instructions) {
    html += `<div style="margin-top: 8px;"><strong>Instruksi Pulang:</strong><br/>${disposition.instructions}</div>`;
  }
  
  if (disposition.follow_up_date) {
    html += `<div style="margin-top: 8px;"><strong>Jadwal Kontrol:</strong> ${formatDateID(disposition.follow_up_date)}${disposition.follow_up_room ? ` di ${disposition.follow_up_room}` : ""}</div>`;
  }
  
  if (disposition.referral_facility) {
    html += `<div style="margin-top: 8px;"><strong>Dirujuk ke:</strong> ${disposition.referral_facility}<br/><strong>Alasan:</strong> ${disposition.referral_reason || "-"}</div>`;
  }
  
  return html;
}

export function generateOutpatientResumeHTML(data: OutpatientResumeData): string {
  const header = generatePrintHeaderHTML(data.hospital, "Resume Medis Rawat Jalan", data.visit.visit_number);
  const patientInfo = generatePatientInfoHTML(data.patient);
  const visitInfo = generateVisitInfoHTML(data.visit);
  
  return `
    ${header}
    
    <div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; background: #fafafa;">
      ${patientInfo}
      ${visitInfo}
    </div>
    
    <div class="section-title">Anamnesis</div>
    <div class="section-content">
      ${data.anamnesis?.chief_complaint ? `
        <div><span class="label">Keluhan Utama:</span></div>
        <div style="margin-bottom: 8px;">${data.anamnesis.chief_complaint}</div>
      ` : ""}
      ${data.anamnesis?.history_of_present_illness ? `
        <div><span class="label">Riwayat Penyakit Sekarang:</span></div>
        <div style="margin-bottom: 8px;">${data.anamnesis.history_of_present_illness}</div>
      ` : ""}
      ${data.anamnesis?.allergies ? `
        <div><span class="label">Alergi:</span> <span style="color: #dc3545; font-weight: bold;">${data.anamnesis.allergies}</span></div>
      ` : ""}
    </div>
    
    <div class="section-title">Pemeriksaan Fisik</div>
    <div class="section-content">
      <div><span class="label">Keadaan Umum:</span> ${data.physical_exam?.general_condition || "-"}, 
           <span class="label">Kesadaran:</span> ${data.physical_exam?.consciousness || "-"}</div>
      <div style="margin-top: 5px;"><span class="label">Tanda Vital:</span> ${generateVitalSignsHTML(data.physical_exam)}</div>
      ${data.physical_exam?.findings ? `
        <div style="margin-top: 5px;"><span class="label">Temuan:</span></div>
        <div>${data.physical_exam.findings}</div>
      ` : ""}
    </div>
    
    <div class="section-title">Diagnosis</div>
    <div class="section-content">
      ${generateDiagnosesHTML(data.diagnoses)}
      ${data.clinical_impression ? `
        <div style="margin-top: 8px;"><span class="label">Kesan Klinis:</span> ${data.clinical_impression}</div>
      ` : ""}
    </div>
    
    ${data.procedures && data.procedures.length > 0 ? `
      <div class="section-title">Tindakan</div>
      <div class="section-content">
        ${data.procedures.map(p => `<div>• ${p.name}${p.result ? `: ${p.result}` : ""}</div>`).join("")}
      </div>
    ` : ""}
    
    ${generateLabResultsHTML(data.lab_results)}
    ${generateRadiologyResultsHTML(data.radiology_results)}
    
    <div class="section-title">Terapi / Resep</div>
    <div class="section-content">
      ${generateMedicationsHTML(data.medications)}
    </div>
    
    ${data.assessment_plan ? `
      <div class="section-title">Rencana</div>
      <div class="section-content">
        ${data.assessment_plan.treatment_plan ? `<div><span class="label">Rencana Terapi:</span> ${data.assessment_plan.treatment_plan}</div>` : ""}
        ${data.assessment_plan.education_plan ? `<div><span class="label">Edukasi:</span> ${data.assessment_plan.education_plan}</div>` : ""}
        ${data.assessment_plan.prognosis ? `<div><span class="label">Prognosis:</span> ${data.assessment_plan.prognosis}</div>` : ""}
      </div>
    ` : ""}
    
    <div class="section-title">Disposisi</div>
    <div class="section-content">
      ${generateDispositionHTML(data.disposition)}
    </div>
    
    ${generateSignatureHTML({
      leftTitle: "Pasien/Keluarga",
      rightTitle: "Dokter Pemeriksa",
      rightName: data.visit.doctor_name,
      location: data.hospital.hospital_city,
    })}
  `;
}

export function printOutpatientResume(data: OutpatientResumeData): void {
  const content = generateOutpatientResumeHTML(data);
  openPrintWindow(content, `Resume Medis - ${data.patient.nama_lengkap} - ${data.visit.visit_number}`);
}
