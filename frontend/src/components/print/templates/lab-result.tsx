/**
 * Hasil Laboratorium (Lab Result Report)
 * Template cetakan E2 - Laporan hasil pemeriksaan laboratorium
 */

import { generatePrintHeaderHTML } from "@/components/print/print-header";
import type { HospitalInfo } from "@/components/print/print-header";
import {
  formatDateTimeID,
  formatGenderID,
  calculateAge,
  openPrintWindow,
} from "@/lib/print-utils";
import type { PatientPrintInfo, VisitPrintInfo } from "@/lib/print-utils";

export interface LabResultItem {
  parameter_name: string;
  parameter_code?: string;
  category?: string;
  result: string;
  unit?: string;
  normal_min?: number;
  normal_max?: number;
  normal_text?: string;
  is_abnormal?: boolean;
  is_critical?: boolean;
  flag?: "L" | "H" | "LL" | "HH" | "N"; // Low, High, Critical Low, Critical High, Normal
}

export interface LabResultData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  visit: VisitPrintInfo;
  order_number: string;
  sample_date?: string;
  sample_type?: string;
  result_date: string;
  items: LabResultItem[];
  result_summary?: string;
  conclusion?: string;
  suggestion?: string;
  critical_notes?: string;
  performed_by: string;
  validated_by?: string;
}

function formatNormalRange(item: LabResultItem): string {
  if (item.normal_text) return item.normal_text;
  if (item.normal_min !== undefined && item.normal_max !== undefined) {
    return `${item.normal_min} - ${item.normal_max}`;
  }
  if (item.normal_min !== undefined) return `> ${item.normal_min}`;
  if (item.normal_max !== undefined) return `< ${item.normal_max}`;
  return "-";
}

function getFlagStyle(flag?: string, isAbnormal?: boolean, isCritical?: boolean): string {
  if (isCritical || flag === "LL" || flag === "HH") {
    return "background: #ffebee; color: #c62828; font-weight: bold;";
  }
  if (isAbnormal || flag === "L" || flag === "H") {
    return "background: #fff3e0; color: #e65100; font-weight: bold;";
  }
  return "";
}

function getFlagLabel(flag?: string): string {
  const labels: Record<string, string> = {
    L: "↓",
    H: "↑",
    LL: "↓↓",
    HH: "↑↑",
    N: "",
  };
  return labels[flag || ""] || "";
}

function groupResultsByCategory(items: LabResultItem[]): Record<string, LabResultItem[]> {
  return items.reduce((acc, item) => {
    const category = item.category || "Lainnya";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, LabResultItem[]>);
}

export function generateLabResultHTML(data: LabResultData): string {
  const header = generatePrintHeaderHTML(data.hospital, "Hasil Pemeriksaan Laboratorium", data.order_number);
  const age = calculateAge(data.patient.tanggal_lahir);
  const grouped = groupResultsByCategory(data.items);
  const hasCritical = data.items.some(i => i.is_critical || i.flag === "LL" || i.flag === "HH");
  
  return `
    ${header}
    
    <div style="display: flex; gap: 15px; margin-top: 15px;">
      <div style="flex: 1; padding: 10px; border: 1px solid #ddd;">
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td style="width: 100px;">No. RM</td>
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
            <td>Ruangan</td>
            <td>: ${data.visit.room_name}</td>
          </tr>
        </table>
      </div>
      <div style="width: 200px; padding: 10px; border: 1px solid #ddd;">
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td>Tgl Pengambilan</td>
            <td>: ${data.sample_date ? formatDateTimeID(data.sample_date) : "-"}</td>
          </tr>
          <tr>
            <td>Jenis Sampel</td>
            <td>: ${data.sample_type || "-"}</td>
          </tr>
          <tr>
            <td>Tgl Hasil</td>
            <td>: ${formatDateTimeID(data.result_date)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    ${hasCritical ? `
      <div style="margin-top: 10px; padding: 10px; background: #ffebee; border: 2px solid #c62828; font-weight: bold; color: #c62828;">
        ⚠️ PERHATIAN: Terdapat nilai kritis yang memerlukan tindakan segera!
        ${data.critical_notes ? `<br/><span style="font-weight: normal;">${data.critical_notes}</span>` : ""}
      </div>
    ` : ""}
    
    <div style="margin-top: 15px;">
      ${Object.entries(grouped).map(([category, items]) => `
        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 12px; background: #f5f5f5; padding: 5px 10px; margin-bottom: 5px;">
            ${category}
          </div>
          <table class="print-table" style="font-size: 11px;">
            <thead>
              <tr>
                <th style="width: 35%;">Parameter</th>
                <th style="width: 20%;">Hasil</th>
                <th style="width: 15%;">Satuan</th>
                <th style="width: 25%;">Nilai Rujukan</th>
                <th style="width: 5%;">Flag</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const flagStyle = getFlagStyle(item.flag, item.is_abnormal, item.is_critical);
                return `
                  <tr style="${flagStyle}">
                    <td>${item.parameter_name}</td>
                    <td style="text-align: center; font-weight: bold;">${item.result}</td>
                    <td style="text-align: center;">${item.unit || "-"}</td>
                    <td style="text-align: center;">${formatNormalRange(item)}</td>
                    <td style="text-align: center; font-size: 14px;">${getFlagLabel(item.flag)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `).join("")}
    </div>
    
    ${data.result_summary ? `
      <div style="margin-top: 15px; padding: 10px; border: 1px solid #ddd;">
        <div style="font-weight: bold; margin-bottom: 5px;">Ringkasan Hasil:</div>
        <div style="white-space: pre-line;">${data.result_summary}</div>
      </div>
    ` : ""}
    
    ${data.conclusion ? `
      <div style="margin-top: 10px; padding: 10px; border: 1px solid #ddd;">
        <div style="font-weight: bold; margin-bottom: 5px;">Kesan:</div>
        <div>${data.conclusion}</div>
      </div>
    ` : ""}
    
    ${data.suggestion ? `
      <div style="margin-top: 10px; padding: 10px; border: 1px solid #ddd;">
        <div style="font-weight: bold; margin-bottom: 5px;">Saran:</div>
        <div>${data.suggestion}</div>
      </div>
    ` : ""}
    
    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div style="text-align: center; width: 180px;">
        <div style="font-size: 10px;">Dikerjakan oleh</div>
        <div style="height: 50px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px;">
          <strong>${data.performed_by}</strong>
        </div>
      </div>
      ${data.validated_by ? `
        <div style="text-align: center; width: 180px;">
          <div style="font-size: 10px;">Divalidasi oleh</div>
          <div style="height: 50px;"></div>
          <div style="border-top: 1px solid #000; padding-top: 3px;">
            <strong>${data.validated_by}</strong>
          </div>
        </div>
      ` : ""}
    </div>
    
    <div style="margin-top: 30px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
      <div>Keterangan: ↓ = di bawah normal, ↑ = di atas normal, ↓↓ = kritis rendah, ↑↑ = kritis tinggi</div>
      <div>Dicetak: ${formatDateTimeID(new Date())}</div>
    </div>
  `;
}

export function printLabResult(data: LabResultData): void {
  const content = generateLabResultHTML(data);
  openPrintWindow(content, `Hasil Lab - ${data.order_number} - ${data.patient.nama_lengkap}`);
}
