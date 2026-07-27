import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { Visit } from "@/lib/api/visits";
import type { MedicalRecordSummary } from "@/lib/api/medical-records";
import { PrintHeader } from "@/components/print/print-header";
import { signatureApi, type DocumentSignatureStatus } from "@/lib/api/signature";
import { QRCodeSVG } from "qrcode.react";

interface ResumeMedisPreviewProps {
  visit: Visit;
  summary?: MedicalRecordSummary;
}

export function ResumeMedisPreview({ visit, summary }: ResumeMedisPreviewProps) {
  const [signatureStatus, setSignatureStatus] = useState<DocumentSignatureStatus | null>(null);

  useEffect(() => {
    signatureApi.getDocumentSignature('visit_resume', visit.id)
      .then(res => setSignatureStatus(res.data))
      .catch(console.error);
  }, [visit.id]);

  const patient = visit.registration?.Patient || visit.registration?.patient;
  const doctor = visit.doctor;
  const room = visit.room;
  
  const calculateAge = (dob?: string) => {
    if (!dob) return "-";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} th`;
  };

  const titleText = `RESUME MEDIS ${visit.visit_type === "inpatient" ? "RAWAT INAP" : visit.visit_type === "emergency" ? "IGD" : "RAWAT JALAN"}`;
  const visitNumber = visit.visit_number || "-";
  
  // Format dates
  const dobFormatted = patient?.tanggal_lahir || patient?.date_of_birth ? format(new Date(patient?.tanggal_lahir || patient?.date_of_birth), "dd-MM-yyyy", { locale: id }) : "-";
  const visitDateFormatted = visit.start_time ? format(new Date(visit.start_time), "dd-MM-yyyy", { locale: id }) : "-";

  // Data Pasien fallback
  const noRm = patient?.no_rm || patient?.medical_record_number || "-";
  const name = patient?.nama_lengkap || patient?.name || "-";
  const gender = patient?.jenis_kelamin === "P" || patient?.gender === "Perempuan" ? "Perempuan" : patient?.jenis_kelamin === "L" || patient?.gender === "Laki-laki" ? "Laki-laki" : patient?.gender || "-";
  const bloodType = patient?.golongan_darah || patient?.blood_type || "-";
  const phone = patient?.no_hp || patient?.phone_number || "-";
  const nik = patient?.nik || "-";
  const guarantor = patient?.nama_penanggung_jawab || patient?.guarantor_name || "-";
  const address = patient?.alamat_ktp || patient?.address || "-";
  
  // Clinical Snapshot
  const painScale: number = Number(summary?.triage?.pain_scale ?? summary?.physical_exam?.pain_scale ?? 0);
  const alertText = painScale >= 7 ? "Nyeri Berat" : painScale >= 4 ? "Nyeri Sedang" : painScale >= 1 ? "Nyeri Ringan" : "Tidak Ada Alert";
  const alertColor = painScale >= 4 ? "text-red-600" : "text-green-600";
  
  const primaryDiagObj = summary?.diagnosis?.items?.find(i => i.diagnosis_type === 'primary');
  let primaryDiag = "-";
  if (primaryDiagObj) {
    if (primaryDiagObj.icd10_code && primaryDiagObj.icd10_name) {
      primaryDiag = `${primaryDiagObj.icd10_code} - ${primaryDiagObj.icd10_name}`;
    } else {
      primaryDiag = primaryDiagObj.icd10_name || "-";
    }
  }
  
  // Vitals
  const td = summary?.physical_exam?.blood_pressure || "-";

  const n = summary?.physical_exam?.heart_rate || "-";
  const rr = summary?.physical_exam?.respiratory_rate || summary?.triage?.respiratory_rate || "-";
  const s = summary?.physical_exam?.temperature || summary?.triage?.temperature || "-";
  const spo2 = summary?.physical_exam?.oxygen_saturation || summary?.triage?.oxygen_saturation || "-";
  
  const painDesc = painScale ? `${painScale}/10 ${painScale >= 7 ? "(Berat)" : painScale >= 4 ? "(Sedang)" : "(Ringan)"}` : "-";
  
  // Alergi
  const allergies = patient?.alergi_obat || summary?.anamnesis?.allergies || "Tidak Ada";
  const allergyColor = allergies !== "Tidak Ada" && allergies !== "-" && allergies ? "text-red-600" : "text-green-600";
  
  // Kompleksitas (Dummy logic if not present, but using triage as reference if needed)
  const complexityText = "Ringan (1)";
  const complexityColor = "text-green-600";
  
  const disposition = summary?.disposition?.disposition_type || "Pulang";

  return (
    <div className="font-sans text-xs">
      <PrintHeader title={titleText} subtitle={visitNumber} />

      <style>{`
        .resume-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .resume-table th, .resume-table td { border: 1px solid #000; padding: 4px 6px; }
        .resume-table th { background-color: #e5e7eb; text-align: left; font-weight: bold; }
        .resume-table .label-col { width: 20%; font-weight: normal; }
        .resume-table .val-col { width: 30%; font-weight: normal; }
      `}</style>

      {/* DATA PASIEN */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={4}>DATA PASIEN</th>
          </tr>
          <tr>
            <td className="label-col">No. Rekam Medis</td>
            <td className="val-col font-bold">{noRm}</td>
            <td className="label-col">Jenis Kelamin</td>
            <td className="val-col">{gender}</td>
          </tr>
          <tr>
            <td className="label-col">Nama Lengkap</td>
            <td className="val-col font-bold">{name}</td>
            <td className="label-col">Gol. Darah</td>
            <td className="val-col">{bloodType}</td>
          </tr>
          <tr>
            <td className="label-col">Tanggal Lahir</td>
            <td className="val-col">{dobFormatted} ({calculateAge(patient?.tanggal_lahir || patient?.date_of_birth)})</td>
            <td className="label-col">No. HP</td>
            <td className="val-col">{phone}</td>
          </tr>
          <tr>
            <td className="label-col">NIK</td>
            <td className="val-col">{nik}</td>
            <td className="label-col">Penanggung Jawab</td>
            <td className="val-col">{guarantor}</td>
          </tr>
          <tr>
            <td className="label-col">Alamat</td>
            <td colSpan={3} className="val-col">{address}</td>
          </tr>
        </tbody>
      </table>

      {/* DATA KUNJUNGAN */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={4}>DATA KUNJUNGAN</th>
          </tr>
          <tr>
            <td className="label-col">No. Kunjungan</td>
            <td className="val-col font-bold">{visitNumber}</td>
            <td className="label-col">Ruangan</td>
            <td className="val-col">{room?.name || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Tgl Kunjungan</td>
            <td className="val-col">{visitDateFormatted}</td>
            <td className="label-col">Dokter</td>
            <td className="val-col">{doctor?.name || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* CLINICAL SNAPSHOT */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={2}>CLINICAL SNAPSHOT</th>
          </tr>
          <tr>
            <td className="label-col font-bold" style={{width: '25%'}}>Alert Utama</td>
            <td className={`font-bold ${alertColor}`}>{alertText}</td>
          </tr>
          <tr>
            <td className="label-col">Diagnosis Utama</td>
            <td>{primaryDiag}</td>
          </tr>
          <tr>
            <td className="label-col">Tanda Vital Inti</td>
            <td>TD {td} | N {n} | RR {rr} | S {s} | SpO2 {spo2}%</td>
          </tr>
          <tr>
            <td className="label-col font-bold">Ringkasan Nyeri</td>
            <td className={painScale >= 4 ? "text-red-600" : ""}>{painDesc}</td>
          </tr>
          <tr>
            <td className="label-col font-bold">Alergi</td>
            <td className={`font-bold ${allergyColor}`}>{allergies}</td>
          </tr>
          <tr>
            <td className="label-col font-bold">Kompleksitas Kasus</td>
            <td className={`font-bold ${complexityColor}`}>{complexityText}</td>
          </tr>
          <tr>
            <td className="label-col">Legend Skor</td>
            <td className="text-[10px]">0-1 Ringan | 2-3 Sedang | &gt;=4 Tinggi</td>
          </tr>
          <tr>
            <td className="label-col">Disposisi</td>
            <td>{disposition}</td>
          </tr>
        </tbody>
      </table>

      {/* ANAMNESIS */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={2}>ANAMNESIS</th>
          </tr>
          <tr>
            <td className="label-col">Keluhan Utama</td>
            <td>{summary?.anamnesis?.chief_complaint || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Riwayat Penyakit Sekarang</td>
            <td>{summary?.anamnesis?.history_of_present_illness || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Riwayat Penyakit Dahulu</td>
            <td>{summary?.anamnesis?.past_medical_history || "-"}</td>
          </tr>
          {summary?.anamnesis?.allergies && summary?.anamnesis?.allergies !== "Tidak Ada" && summary?.anamnesis?.allergies !== "-" && (
            <tr>
              <td className="label-col font-bold text-red-600">Alergi</td>
              <td className="font-bold text-red-600">{summary.anamnesis.allergies}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* PEMERIKSAAN FISIK */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={2}>PEMERIKSAAN FISIK</th>
          </tr>
          <tr>
            <td className="label-col">Keadaan Umum</td>
            <td>{summary?.physical_exam?.general_condition || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Kesadaran</td>
            <td>{summary?.physical_exam?.consciousness || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Tekanan Darah</td>
            <td>{summary?.physical_exam?.blood_pressure ? `${summary.physical_exam.blood_pressure} mmHg` : "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Nadi</td>
            <td>{summary?.physical_exam?.heart_rate ? `${summary.physical_exam.heart_rate} x/menit` : "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Frekuensi Napas</td>
            <td>{summary?.physical_exam?.respiratory_rate ? `${summary.physical_exam.respiratory_rate} x/menit` : "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Suhu</td>
            <td>{summary?.physical_exam?.temperature ? `${summary.physical_exam.temperature} °C` : "-"}</td>
          </tr>
          <tr>
            <td className="label-col">SpO2</td>
            <td>{summary?.physical_exam?.oxygen_saturation ? `${summary.physical_exam.oxygen_saturation} %` : "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* DIAGNOSIS */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th>DIAGNOSIS</th>
          </tr>
          {summary?.diagnosis?.items && summary.diagnosis.items.length > 0 ? (
            summary.diagnosis.items.map((diag, idx) => (
              <tr key={idx}>
                <td>
                  {diag.diagnosis_type === 'primary' ? '[Utama] ' : ''}
                  {diag.icd10_code ? `${diag.icd10_code} - ` : ''}{diag.icd10_name}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td>-</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* TERAPI / RESEP */}
      <table className="resume-table text-center">
        <thead>
          <tr>
            <th colSpan={5} className="text-left">TERAPI / RESEP</th>
          </tr>
          <tr className="bg-gray-100">
            <td className="font-bold border px-2 py-1 w-8">No</td>
            <td className="font-bold border px-2 py-1 text-left">Nama Obat</td>
            <td className="font-bold border px-2 py-1">Aturan Pakai</td>
            <td className="font-bold border px-2 py-1">Jumlah</td>
            <td className="font-bold border px-2 py-1">Instruksi</td>
          </tr>
        </thead>
        <tbody>
          {/* We don't have medicine items directly in summary, fallback to text or print placeholder */}
          <tr>
            <td colSpan={5} className="text-left">{summary?.assessment_plan?.medication_plan || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* RENCANA */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={2}>RENCANA</th>
          </tr>
          <tr>
            <td className="label-col">Rencana Tindakan</td>
            <td>{summary?.assessment_plan?.treatment_plan || summary?.assessment_plan?.procedure_plan || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Edukasi</td>
            <td>{summary?.assessment_plan?.education_plan || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* DISPOSISI */}
      <table className="resume-table">
        <tbody>
          <tr>
            <th colSpan={2}>DISPOSISI</th>
          </tr>
          <tr>
            <td className="label-col">Status Pulang</td>
            <td>{summary?.disposition?.disposition_type || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Kondisi Pulang</td>
            <td>{summary?.disposition?.discharge_condition || "-"}</td>
          </tr>
          <tr>
            <td className="label-col">Instruksi Pulang</td>
            <td>{summary?.disposition?.discharge_instruction || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* Signature Area */}
      <div className="flex justify-end mt-12 text-center text-xs">
        {signatureStatus?.slot_details && Object.keys(signatureStatus.slot_details).length > 0 ? (
          <div className="flex gap-8">
            {Object.entries(signatureStatus.slot_details).map(([slotKey, slotData]: [string, any]) => {
              // Format label
              const slotLabel = slotKey === 'doctor' ? 'Dokter Penanggung Jawab Pelayanan' 
                : slotKey === 'patient' ? 'Pasien' 
                : slotKey === 'nurse' ? 'Perawat' 
                : slotKey === 'family' ? 'Keluarga Pasien' 
                : slotKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <div key={slotKey} className="w-64 flex flex-col items-center">
                  <p className="mb-1">
                    Kedungadem, {slotData.signed_at ? format(new Date(slotData.signed_at), "dd MMMM yyyy", { locale: id }) : format(new Date(), "dd MMMM yyyy", { locale: id })}
                  </p>
                  <p className="mb-2">{slotLabel}</p>
                  
                  <div className="h-20 flex items-center justify-center mb-2">
                    {slotData.signature_hash ? (
                      <QRCodeSVG value={slotData.signature_hash} size={72} />
                    ) : (
                      <div className="h-16" />
                    )}
                  </div>
                  
                  <div className="border-b border-black w-48 mx-auto relative pb-1">
                    <div id={`signature-anchor-${slotKey}`} className="absolute bottom-1 left-0 w-full h-16 pointer-events-none" />
                    ( {slotData.signer_name || "...................................."} )
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-64">
            <p className="mb-1">
              Kedungadem, {visit.end_time ? format(new Date(visit.end_time), "dd MMMM yyyy", { locale: id }) : format(new Date(), "dd MMMM yyyy", { locale: id })}
            </p>
            <p className="mb-20">Dokter Penanggung Jawab Pelayanan</p>
            
            <div className="border-b border-black w-48 mx-auto relative pb-1">
              <div id="signature-anchor-doctor" className="absolute bottom-1 left-0 w-full h-16 pointer-events-none" />
              ( {doctor?.name || "...................................."} )
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

