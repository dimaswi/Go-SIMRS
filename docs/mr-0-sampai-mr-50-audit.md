# Audit Cakupan MR.0 sampai MR.50 di SIMRS

Tanggal audit: 2026-05-30

## Catatan penting

Daftar `MR.0` sampai `MR.50` di bawah ini memakai **daftar kerja generik** yang lazim dipakai di rumah sakit Indonesia, bukan standar nomor formulir nasional yang seragam untuk semua RS.

Status yang dipakai:

- `Ada`: sudah ada form/workflow/modul yang cukup jelas.
- `Sebagian`: ada representasi parsial, tergabung di form lain, atau baru tersedia sebagai cetakan/output.
- `Belum`: belum ditemukan implementasi yang jelas di repo.

## Ringkasan

- `Ada`: 25
- `Sebagian`: 18
- `Belum`: 8

Kesimpulan utama: **SIMRS ini belum mencakup semua MR.0 sampai MR.50 secara penuh**. Banyak area klinis inti sudah ada, terutama asesmen, CPPT, farmasi, penunjang, surat, dan cetakan resume. Yang masih paling bolong ada di dokumen legal/prosedural khusus seperti anestesi, recovery room, kejadian khusus, pulang paksa, rehab medik, hemodialisa, dan imunisasi.

## Tabel audit

| Kode | Acuan isi/form | Status | Bukti di repo | Catatan |
|---|---|---|---|---|
| MR.0 | Identitas pasien / lembar muka | Ada | `frontend/src/components/medical-record/patient-info.tsx`, `frontend/src/pages/patients/show.tsx` | Identitas pasien dan ringkasan pasien tersedia. |
| MR.01 | Pendaftaran / ringkasan masuk-keluar | Ada | `frontend/src/pages/registrations/create.tsx`, `frontend/src/lib/api/print.ts`, `backend/handlers/print_pdf.go` | Ada alur registrasi dan cetak MR.1 ringkasan masuk-keluar. |
| MR.02 | Anamnesis dan pemeriksaan dokter | Ada | `frontend/src/components/medical-record/anamnesis-form.tsx`, `frontend/src/components/medical-record/physical-exam-form.tsx` | Tersedia form anamnesis dan pemeriksaan fisik. |
| MR.03 | Asesmen awal medis rawat jalan | Sebagian | `anamnesis-form.tsx`, `physical-exam-form.tsx`, `assessment-plan-form.tsx` | Unsurnya ada, tetapi tidak tampak sebagai satu form MR.03 tunggal. |
| MR.04 | Asesmen awal medis rawat inap | Sebagian | `anamnesis-form.tsx`, `physical-exam-form.tsx`, `cppt-form.tsx` | Elemen klinis ada, tetapi tidak tampak lembar asesmen awal rawat inap yang eksplisit. |
| MR.05 | Asesmen awal keperawatan | Sebagian | `frontend/src/components/medical-record/nursing-care-form.tsx` | Asuhan keperawatan ada, namun belum jelas sebagai asesmen awal keperawatan formal. |
| MR.06 | Asesmen gawat darurat / triase | Ada | `frontend/src/components/medical-record/triage-form.tsx`, `backend/models/medical_record.go` | Form triase UGD tersedia jelas. |
| MR.07 | CPPT | Ada | `frontend/src/components/medical-record/cppt-form.tsx`, `frontend/src/lib/api/inpatient.ts` | CPPT lengkap dengan create/update/verify. |
| MR.08 | Catatan harian dokter | Sebagian | `frontend/src/components/medical-record/cppt-form.tsx` | Tercakup melalui CPPT, bukan modul catatan harian dokter terpisah. |
| MR.09 | Catatan asuhan keperawatan | Ada | `frontend/src/components/medical-record/nursing-care-form.tsx` | Ada modul asuhan keperawatan. |
| MR.10 | Observasi tanda vital / grafik monitoring | Sebagian | `frontend/src/components/medical-record/observation-report-drawer.tsx`, `frontend/src/lib/api/print.ts` | Grafik/cetakan ada, namun form observasi kontinu khusus tidak tampak terpisah. |
| MR.11 | Lembar instruksi dokter | Sebagian | `frontend/src/components/medical-record/cppt-form.tsx`, `assessment-plan-form.tsx` | Ada field instruksi/plan, belum tampak sebagai lembar instruksi dokter khusus. |
| MR.12 | Lembar pemberian obat / MAR | Ada | `frontend/src/components/medical-record/medicine-timesheet-form.tsx`, `backend/models/medicine_administration_timesheet.go` | Timesheet pemberian obat tersedia. |
| MR.13 | Order obat / resep | Ada | `frontend/src/components/medical-record/medicine-order-form.tsx`, `backend/handlers/medicine_order.go` | Workflow order obat tersedia. |
| MR.14 | Telaah resep / verifikasi farmasi | Ada | `frontend/src/components/medical-record/pharmacy-review.tsx` | Telaah awal dan telaah akhir tersedia. |
| MR.15 | Penyerahan obat / PIO | Ada | `frontend/src/components/medical-record/pharmacy-dispense.tsx` | Penyerahan obat dan checklist PIO tersedia. |
| MR.16 | Hasil laboratorium | Ada | `frontend/src/components/medical-record/laboratory-workstation.tsx`, `frontend/src/lib/print-utils.ts` | Order dan hasil laboratorium tersedia. |
| MR.17 | Hasil radiologi | Ada | `frontend/src/components/medical-record/radiology-workstation.tsx`, `frontend/src/lib/print-utils.ts` | Order dan hasil radiologi tersedia. |
| MR.18 | Hasil penunjang lain (EKG/USG/EEG/dll) | Sebagian | `frontend/src/components/medical-record/physical-exam-form.tsx` | Ada field EKG/CTG/pelvis, tetapi belum tampak modul hasil penunjang umum yang lengkap. |
| MR.19 | Permintaan laboratorium | Ada | `frontend/src/components/medical-record/laboratory-order-form.tsx` | Form order lab tersedia. |
| MR.20 | Permintaan radiologi | Ada | `frontend/src/components/medical-record/radiology-order-form.tsx` | Form order radiologi tersedia. |
| MR.21 | Konsultasi antar dokter / jawaban konsultasi | Ada | `frontend/src/components/medical-record/consultation-order-form.tsx`, `frontend/src/components/medical-record/consultation-form.tsx` | Permintaan dan jawaban konsultasi tersedia. |
| MR.22 | Daftar masalah / diagnosis kerja / akhir | Ada | `frontend/src/components/medical-record/diagnosis-form.tsx` | Diagnosis primer/sekunder tersedia. |
| MR.23 | ICD diagnosis dan prosedur / coding sheet | Ada | `frontend/src/pages/icd/index.tsx`, `frontend/src/pages/eklaim-local/inacbg-coding-tab.tsx`, `frontend/src/pages/eklaim-local/idrg-coding-tab.tsx` | Kode ICD dan coding klaim tersedia. |
| MR.24 | Persetujuan tindakan medis / informed consent | Sebagian | `frontend/src/components/medical-record/assessment-plan-form.tsx`, `frontend/src/lib/api/print.ts`, `backend/routes/print.go` | Ada field informed consent dan cetakan/signature, belum tampak form persetujuan tindakan yang kaya dan spesifik. |
| MR.25 | Penolakan tindakan medis | Belum | - | Tidak ditemukan modul/form yang jelas untuk penolakan tindakan medis. |
| MR.26 | Persetujuan anestesi | Sebagian | `frontend/src/lib/print-utils.ts`, `frontend/src/pages/procedures/create.tsx` | Ada jejak jenis anestesi dan print type terkait operasi, belum tampak form consent anestesi khusus. |
| MR.27 | Checklist keselamatan operasi | Sebagian | `frontend/src/lib/print-utils.ts` | Ada print type `surgery-checklist`, tetapi belum tampak workflow input checklist yang jelas. |
| MR.28 | Laporan operasi / tindakan | Sebagian | `frontend/src/components/medical-record/surgery-workstation.tsx`, `frontend/src/lib/print-utils.ts` | Ada workflow operasi dan print type laporan operasi, namun tidak terlihat lembar laporan operasi eksplisit yang lengkap. |
| MR.29 | Catatan anestesi | Belum | - | Belum ditemukan form anestesi khusus. |
| MR.30 | Catatan pemulihan / recovery room | Belum | - | Belum ditemukan form recovery room/pasca anestesi. |
| MR.31 | Catatan transfusi darah | Sebagian | `frontend/src/components/medical-record/fluid-balance-form.tsx` | Ada kategori transfusi pada balance cairan, belum tampak lembar transfusi khusus. |
| MR.32 | Intake-output / balance cairan | Ada | `frontend/src/components/medical-record/fluid-balance-form.tsx`, `frontend/src/lib/api/inpatient.ts` | Form balance cairan tersedia lengkap. |
| MR.33 | Lembar nutrisi / asesmen gizi | Sebagian | `frontend/src/components/medical-record/nutrition-order-form.tsx` | Order gizi ada, tetapi asesmen gizi klinis khusus belum tampak kuat. |
| MR.34 | Discharge planning | Ada | `frontend/src/components/medical-record/discharge-planning-form.tsx` | Modul discharge planning tersedia. |
| MR.35 | Resume medis / ringkasan pulang | Ada | `frontend/src/lib/api/print.ts`, `backend/routes/print.go`, `frontend/src/components/medical-record/print-dialog.tsx` | Resume rawat jalan, IGD, dan rawat inap tersedia sebagai cetakan. |
| MR.36 | Surat kontrol / tindak lanjut | Ada | `frontend/src/lib/api/print.ts`, `frontend/src/pages/bpjs/surat-kontrol-monitoring.tsx`, `backend/routes/print.go` | Surat kontrol BPJS dan SIMRS tersedia. |
| MR.37 | Surat rujukan masuk | Sebagian | `backend/services/bpjs/vclaim.go`, `frontend/src/pages/bpjs/*` | Data/integrasi rujukan masuk ada, tetapi tidak tampak form rekam medis rujukan masuk yang eksplisit. |
| MR.38 | Surat rujukan keluar | Ada | `frontend/src/components/medical-record/disposition-form.tsx`, `frontend/src/lib/api/print.ts`, `backend/routes/print.go` | Rujukan keluar dan cetaknya tersedia. |
| MR.39 | Surat keterangan sakit / sehat | Ada | `frontend/src/components/medical-record/sick-letter-form.tsx`, `frontend/src/components/medical-record/surat-form.tsx` | Surat sakit dan surat sehat tersedia. |
| MR.40 | Surat kematian / sebab kematian | Ada | `frontend/src/components/medical-record/death-certificate-form.tsx`, `frontend/src/lib/api/medical-records.ts` | Surat kematian tersedia. |
| MR.41 | Form kejadian khusus / insiden keselamatan pasien | Belum | - | Tidak ditemukan modul insiden keselamatan pasien yang jelas di rekam medis. |
| MR.42 | Edukasi pasien dan keluarga | Sebagian | `frontend/src/components/medical-record/pharmacy-review.tsx`, `assessment-plan-form.tsx` | Ada jejak edukasi/PIO/informed consent, tetapi belum tampak form edukasi pasien umum yang terpisah. |
| MR.43 | Persetujuan pulang paksa / APS | Belum | - | Tidak ditemukan form pulang paksa/APS yang eksplisit. |
| MR.44 | Form isolasi / infeksi / surveilans | Sebagian | `backend/models/inpatient.go`, `frontend/src/components/medical-record/disposition-drawers.tsx` | Ada field catatan khusus isolasi, belum tampak form surveilans/isolasi dedicated. |
| MR.45 | Form rehabilitasi medik / fisioterapi | Belum | - | Hanya ada jejak profesi fisioterapi/eklaim, belum ada modul rekam medis rehab medik khusus. |
| MR.46 | Form hemodialisa | Belum | - | Hanya ada referensi BPJS/eklaim, belum ada modul form hemodialisa. |
| MR.47 | Form kebidanan / partograf / persalinan | Sebagian | `frontend/src/components/medical-record/surat-form.tsx`, `backend/models/eklaim_local.go` | Ada surat kelahiran dan field persalinan klaim, tetapi belum tampak partograf/form obstetri klinis lengkap. |
| MR.48 | Form neonatal / bayi baru lahir | Sebagian | `frontend/src/components/medical-record/surat-form.tsx` | Ada surat kelahiran, namun belum tampak asesmen neonatal/bayi baru lahir klinis yang lengkap. |
| MR.49 | Form imunisasi / tumbuh kembang | Belum | `frontend/src/lib/api/medical-records.ts`, `copy-from-history-drawer.tsx` | Ada jejak field riwayat imunisasi, tetapi belum ada form workflow imunisasi/tumbuh kembang yang jelas. |
| MR.50 | Form klaim / kelengkapan BPJS / SEP pendukung medis | Ada | `frontend/src/pages/eklaim-local/*`, `frontend/src/pages/eklaim/*`, `frontend/src/pages/bpjs/*` | Modul E-Klaim lokal, BPJS, SEP, dan coding klaim tersedia kuat. |

## Temuan penting

### Area yang sudah kuat

- Asesmen dasar klinis: triase, anamnesis, pemeriksaan fisik, diagnosis, assessment-plan.
- Rekam rawat inap: CPPT, balance cairan, asuhan keperawatan, discharge planning.
- Farmasi: order obat, timesheet obat, telaah resep, penyerahan obat, return.
- Penunjang: order dan workstation laboratorium, radiologi, operasi, konsultasi.
- Dokumen/cetakan: resume medis, surat rujukan, surat sakit/sehat/kelahiran/cuti, surat kematian.
- Klaim: BPJS, SEP, E-Klaim, ICD coding.

### Area yang masih perlu ditutup jika targetnya "MR.0-MR.50 lengkap"

1. Penolakan tindakan medis
2. Persetujuan anestesi
3. Catatan anestesi
4. Recovery room / pasca anestesi
5. Form kejadian khusus / insiden keselamatan pasien
6. Form pulang paksa / APS
7. Form rehabilitasi medik / fisioterapi
8. Form hemodialisa
9. Partograf / form obstetri lengkap
10. Form neonatal / bayi baru lahir
11. Form imunisasi / tumbuh kembang
12. Form edukasi pasien/keluarga yang dedicated
13. Lembar transfusi darah yang dedicated
14. Form isolasi/surveilans infeksi yang dedicated

## Rekomendasi prioritas

### Prioritas 1

- MR.25 Penolakan tindakan medis
- MR.43 Persetujuan pulang paksa / APS
- MR.29 Catatan anestesi
- MR.30 Recovery room

### Prioritas 2

- MR.26 Persetujuan anestesi
- MR.27 Checklist keselamatan operasi
- MR.31 Transfusi darah khusus
- MR.42 Edukasi pasien/keluarga

### Prioritas 3

- MR.45 Rehabilitasi medik
- MR.46 Hemodialisa
- MR.47 Partograf / persalinan
- MR.48 Neonatal
- MR.49 Imunisasi / tumbuh kembang

