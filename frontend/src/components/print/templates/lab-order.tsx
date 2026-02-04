/**
 * Order Laboratorium (Lab Order Form)
 * Template cetakan E1 - Formulir permintaan pemeriksaan laboratorium
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

export interface LabOrderItem {
  procedure_name: string;
  procedure_code?: string;
  category?: string;
  notes?: string;
}

export interface LabOrderData {
  hospital: HospitalInfo;
  patient: PatientPrintInfo;
  visit: VisitPrintInfo;
  order_number: string;
  order_date: string;
  priority: "normal" | "urgent" | "cito";
  diagnosis?: string;
  clinical_notes?: string;
  fasting_required?: boolean;
  items: LabOrderItem[];
  target_lab?: string;
  ordered_by: string;
}

function groupItemsByCategory(items: LabOrderItem[]): Record<string, LabOrderItem[]> {
  return items.reduce((acc, item) => {
    const category = item.category || "Lainnya";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, LabOrderItem[]>);
}

export function generateLabOrderHTML(data: LabOrderData): string {
  const header = generatePrintHeaderHTML(data.hospital, "Formulir Permintaan Laboratorium", data.order_number);
  const age = calculateAge(data.patient.tanggal_lahir);
  
  const priorityLabels: Record<string, { label: string; style: string }> = {
    normal: { label: "Normal", style: "background: #e8f5e9; color: #2e7d32;" },
    urgent: { label: "Urgent", style: "background: #fff3e0; color: #e65100;" },
    cito: { label: "CITO", style: "background: #ffebee; color: #c62828; font-weight: bold;" },
  };
  
  const priority = priorityLabels[data.priority] || priorityLabels.normal;
  const grouped = groupItemsByCategory(data.items);
  
  return `
    ${header}
    
    <div style="display: flex; gap: 15px; margin-top: 15px;">
      <div style="flex: 1; padding: 10px; border: 1px solid #ddd;">
        <div style="font-weight: bold; margin-bottom: 8px; color: #0066cc;">Data Pasien</div>
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
            <td>Tgl Lahir/Umur</td>
            <td>: ${formatDateID(data.patient.tanggal_lahir)} (${age})</td>
          </tr>
          <tr>
            <td>Jenis Kelamin</td>
            <td>: ${formatGenderID(data.patient.jenis_kelamin)}</td>
          </tr>
        </table>
      </div>
      <div style="width: 200px; padding: 10px; border: 1px solid #ddd;">
        <div style="font-weight: bold; margin-bottom: 8px; color: #0066cc;">Info Order</div>
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td>Tanggal</td>
            <td>: ${formatDateTimeID(data.order_date)}</td>
          </tr>
          <tr>
            <td>Ruangan</td>
            <td>: ${data.visit.room_name}</td>
          </tr>
          <tr>
            <td>Prioritas</td>
            <td>: <span style="padding: 2px 8px; ${priority.style}">${priority.label}</span></td>
          </tr>
        </table>
      </div>
    </div>
    
    ${data.diagnosis ? `
      <div style="margin-top: 10px; padding: 8px; border: 1px solid #ddd; font-size: 11px;">
        <strong>Diagnosis:</strong> ${data.diagnosis}
      </div>
    ` : ""}
    
    ${data.clinical_notes ? `
      <div style="margin-top: 8px; padding: 8px; border: 1px solid #ddd; font-size: 11px;">
        <strong>Catatan Klinis:</strong> ${data.clinical_notes}
      </div>
    ` : ""}
    
    ${data.fasting_required ? `
      <div style="margin-top: 10px; padding: 8px; background: #fff3e0; border: 1px solid #ffb74d; font-size: 11px;">
        ⚠️ <strong>PASIEN HARUS PUASA</strong>
      </div>
    ` : ""}
    
    <div style="margin-top: 15px;">
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 12px; border-bottom: 2px solid #0066cc; padding-bottom: 5px;">
        Pemeriksaan yang Diminta
      </div>
      
      ${Object.entries(grouped).map(([category, items]) => `
        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 11px; color: #666; margin-bottom: 5px;">
            ${category}
          </div>
          <table class="print-table" style="font-size: 11px;">
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th>Nama Pemeriksaan</th>
                <th style="width: 100px;">Kode</th>
                <th style="width: 150px;">Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, i) => `
                <tr>
                  <td style="text-align: center;">${i + 1}</td>
                  <td>${item.procedure_name}</td>
                  <td style="text-align: center;">${item.procedure_code || "-"}</td>
                  <td>${item.notes || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `).join("")}
    </div>
    
    ${data.target_lab ? `
      <div style="margin-top: 10px; font-size: 11px;">
        <strong>Laboratorium Tujuan:</strong> ${data.target_lab}
      </div>
    ` : ""}
    
    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div style="text-align: center; width: 180px;">
        <div style="font-size: 10px;">Dokter Pengirim</div>
        <div style="height: 50px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px;">
          <strong>${data.ordered_by}</strong>
        </div>
      </div>
      <div style="text-align: center; width: 180px;">
        <div style="font-size: 10px;">Diterima oleh Lab</div>
        <div style="height: 50px;"></div>
        <div style="border-top: 1px solid #000; padding-top: 3px;">
          <strong>(.............................)</strong>
        </div>
        <div style="font-size: 9px; margin-top: 3px;">Tanggal: ..................</div>
      </div>
    </div>
    
    <div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 9px; color: #666;">
      Lembar ini harus disertakan saat pengambilan sampel
    </div>
  `;
}

export function printLabOrder(data: LabOrderData): void {
  const content = generateLabOrderHTML(data);
  openPrintWindow(content, `Order Lab - ${data.order_number}`);
}
