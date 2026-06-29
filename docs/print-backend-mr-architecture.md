# Backend Print MR Architecture

Dokumen ini merangkum struktur backend print setelah refactor ke pola `MR.0 - MR.50`.

## Tujuan

- Menjadikan layer print backend lebih mudah dirawat.
- Memisahkan registry MR, wrapper MR, public entrypoint, dan renderer domain.
- Menjaga output PDF tetap sama seperti implementasi lama.

## Arsitektur Saat Ini

Alur backend print sekarang:

1. Route HTTP ada di `backend/routes/print.go` atau `backend/routes/procedure_orders.go`
2. Route MR memanggil wrapper MR di:
   - `backend/handlers/print_mr_umum.go`
   - `backend/handlers/print_mr_clinical.go`
   - `backend/handlers/print_mr_orders.go`
   - `backend/handlers/print_mr_surat.go`
3. Wrapper MR memanggil public print function di package `handlers`
4. Public print function tipis sekarang dipusatkan di:
   - `backend/handlers/print_public_delegators.go`
5. Helper delegator non-public tetap ada di:
   - `backend/handlers/print_pdf.go`
6. Implementasi PDF aktual dipindah ke renderer domain:
   - `print_render_letters.go`
   - `print_render_resumes.go`
   - `print_render_inpatient.go`
   - `print_render_orders.go`
   - `print_render_duplicate.go`
   - `print_render_misc.go`
   - `print_render_bpjs.go`
   - `print_render_catalog.go`

## Registry MR

Registry metadata backend ada di `backend/handlers/print_mr_registry.go`.

- `GetMRPrintRegistry()` di line 49
- `GetMRPrintRegistryJSON()` di line 53
- endpoint: `GET /print/mr-registry`

Registry ini menjadi daftar kerja backend untuk MR yang sudah dipetakan ke route print.

## Mapping MR ke Wrapper dan Renderer

| MR | Dokumen | Route Key | Wrapper MR | Public Function | Renderer Aktual |
| --- | --- | --- | --- | --- | --- |
| MR.0 | Identitas Pasien / Label | `patient-label` | `PrintMR00PatientLabel` | `PrintPatientLabel` | `print_render_clinical_special.go` -> `printPatientLabelImpl` |
| MR.01 | Ringkasan Masuk dan Keluar | `admission-discharge-summary` | `PrintMR01AdmissionDischargeSummary` | `PrintAdmissionDischargeSummary` | `print_render_general_docs.go` -> `printAdmissionDischargeSummaryImpl` |
| MR.06 | Triage / Asesmen Gawat Darurat | `triage` | `PrintMR06TriageForm` | `PrintTriageForm` | `print_render_clinical_special.go` -> `printTriageFormImpl` |
| MR.07 | CPPT | `cppt` | `PrintMR07CPPT` | `PrintCPPT` | `print_render_inpatient.go` -> `printCPPTImpl` |
| MR.09 | Asuhan Keperawatan | `nursing-care` | `PrintMR09NursingCare` | `PrintNursingCare` | `print_render_inpatient.go` -> `printNursingCareImpl` |
| MR.10 | Grafik Vital Sign | `vital-sign-chart` | `PrintMR10VitalSignChart` | `PrintVitalSignChart` | `print_render_inpatient.go` -> `printVitalSignChartImpl` |
| MR.13 | Order Obat / Resep | `prescription` | `PrintMR13Prescription` | `PrintPrescription` | `print_render_orders.go` -> `printPrescriptionImpl` |
| MR.16 | Permintaan Laboratorium | `lab-order` | `PrintMR16LabOrder` | `PrintLabOrder` | `print_render_orders.go` -> `printLabOrderImpl` |
| MR.16 | Hasil Laboratorium | `lab-result` | `PrintMR16LabResult` | `PrintLabResult` | `print_render_orders.go` -> `printLabResultImpl` |
| MR.16 | Hasil Laboratorium Multi-Item | procedure route | `PrintMR16LaboratoryResult` | `PrintLaboratoryResult` | `print_render_orders.go` -> `printLaboratoryResultImpl` |
| MR.16 | Hasil Laboratorium Item Tunggal | procedure route item | `PrintMR16LaboratoryResultItem` | `PrintLaboratoryResultItem` | `print_render_orders.go` -> `printLaboratoryResultItemImpl` |
| MR.17 | Hasil Radiologi | `radiology-result` | `PrintMR17RadiologyResult` | `PrintRadiologyResult` | `print_render_orders.go` -> `printRadiologyResultImpl` |
| MR.17 | Hasil Radiologi Item Tunggal | procedure route item | `PrintMR17RadiologyResultItem` | `PrintRadiologyResultItem` | `print_render_orders.go` -> `printRadiologyResultItemImpl` |
| MR.21 | Hasil Konsultasi | `consultation-result` | `PrintMR21ConsultationResult` | `PrintProcedureOrderResult` | `print_render_orders.go` -> `printProcedureOrderResultImpl` |
| MR.24 | Informed Consent | `informed-consent` | `PrintMR24InformedConsent` | `PrintInformedConsent` | `print_render_general_docs.go` -> `printInformedConsentImpl` |
| MR.24 | Bukti Informed Consent | `informed-consent-receipt` | `PrintMR24InformedConsentReceipt` | `PrintInformedConsentReceipt` | `print_render_general_docs.go` -> `printInformedConsentReceiptImpl` |
| MR.28 | Laporan Operasi / Tindakan | `operative-report` | `PrintMR28OperativeReport` | `PrintProcedureOrderResult` | `print_render_orders.go` -> `printProcedureOrderResultImpl` |
| MR.32 | Balance Cairan | `fluid-balance` | `PrintMR32FluidBalance` | `PrintFluidBalance` | `print_render_inpatient.go` -> `printFluidBalanceImpl` |
| MR.35 | Resume Medis Rawat Jalan | `outpatient-resume` | `PrintMR35OutpatientResume` | `PrintOutpatientResume` | `print_render_resumes.go` -> `printOutpatientResumeImpl` |
| MR.35 | Resume Medis Rawat Inap | `inpatient-resume` | `PrintMR35InpatientResume` | `PrintInpatientResume` | `print_render_resumes.go` -> `printInpatientResumeImpl` |
| MR.35 | Ringkasan Pelayanan UGD | `emergency-summary` | `PrintMR35EmergencySummary` | `PrintEmergencySummary` | `print_render_resumes.go` -> `printEmergencySummaryImpl` |
| MR.36 | SPRI | `spri` | `PrintMR36SPRI` | `PrintSPRI` | `print_render_bpjs.go` -> `printSPRIImpl` |
| MR.36 | Surat Kontrol BPJS | `surat-kontrol` | `PrintMR36SuratKontrol` | `PrintSuratKontrol` | `print_render_bpjs.go` -> `printSuratKontrolImpl` |
| MR.36 | Surat Kontrol SIMRS | `surat-kontrol-simrs` | `PrintMR36SuratKontrolSIMRS` | `PrintSuratKontrolSIMRS` | `print_render_bpjs.go` -> `printSuratKontrolSIMRSImpl` |
| MR.38 | Surat Rujukan Keluar | `referral-letter` | `PrintMR38ReferralLetter` | `PrintReferralLetter` | `print_render_clinical_special.go` -> `printReferralLetterImpl` |
| MR.39 | Surat Sakit | `sick-letter` | `PrintMR39SickLetter` | `PrintSickLetter` | `print_render_letters.go` -> `printSickLetterImpl` |
| MR.39 | Surat Sehat | `health-certificate` | `PrintMR39HealthCertificate` | `PrintHealthCertificate` | `print_render_letters.go` -> `printHealthCertificateImpl` |
| MR.39 | Surat Kelahiran | `birth-certificate` | `PrintMR39BirthCertificate` | `PrintBirthCertificate` | `print_render_letters.go` -> `printBirthCertificateImpl` |
| MR.39 | Surat Cuti | `leave-certificate` | `PrintMR39LeaveCertificate` | `PrintLeaveCertificate` | `print_render_letters.go` -> `printLeaveCertificateImpl` |
| MR.39 | Surat MCU | `mcu-certificate` | `PrintMR39MCUCertificate` | `PrintMCUCertificate` | `print_render_letters.go` -> `printMCUCertificateImpl` |
| MR.40 | Surat Kematian | `death-certificate` | `PrintMR40DeathCertificate` | `PrintDeathCertificate` | `print_render_letters.go` -> `printDeathCertificateImpl` |
| MR.50 | SEP | `sep` | `PrintMR50SEP` | `PrintSEP` | `print_render_general_docs.go` -> `printSEPImpl` |
| MR.50 | Bukti Registrasi | `registration-receipt` | `PrintMR50RegistrationReceipt` | `PrintRegistrationReceipt` | `print_render_general_docs.go` -> `printRegistrationReceiptImpl` |
| MR.50 | Permohonan DPJP | `dpjp-request` | `PrintMR50DPJPRequest` | `PrintDPJPRequest` | `print_render_misc.go` -> `printDPJPRequestImpl` |

## Endpoint Non-MR yang Masih Aktif

Dokumen ini tidak semuanya termasuk registry MR, tapi tetap bagian penting dari sistem cetak:

| Endpoint | Public Function | Renderer |
| --- | --- | --- |
| `/print/queue-ticket/:queueId` | `PrintQueueTicket` | `print_render_misc.go` -> `printQueueTicketImpl` |
| `/print/registration-ticket/:registrationId` | `PrintRegistrationTicket` | `print_render_misc.go` -> `printRegistrationTicketImpl` |
| `/print/medicine-label/:itemId` | `PrintMedicineLabel` | `print_render_misc.go` -> `printMedicineLabelImpl` |
| `/print/medicine-labels/:orderId` | `PrintMedicineLabels` | `print_render_misc.go` -> `printMedicineLabelsImpl` |
| `/print/bed-transfer/:visitId` | `PrintBedTransfer` | `print_render_clinical_special.go` -> `printBedTransferImpl` |
| `/print/unit-transfer/:visitId` | `PrintUnitTransfer` | `print_render_clinical_special.go` -> `printUnitTransferImpl` |
| `/print/inpatient-certificate/:visitId` | `PrintInpatientCertificate` | `print_render_clinical_special.go` -> `printInpatientCertificateImpl` |
| `/print/prescription-thermal/:orderId` | `PrintPrescriptionThermal` | `print_render_duplicate.go` -> `printPrescriptionThermalImpl` |
| `/print/billing/:billingId` | `PrintBilling` | `print_render_duplicate.go` -> `printBillingImpl` |
| `/print/nutrition-etiket/:orderId` | `PrintNutritionEtiket` | `print_render_misc.go` -> `printNutritionEtiketImpl` |
| `/print/rm-duplicate/lab-order/:rmOrderId` | `PrintRMDuplicateLabOrder` | `print_render_duplicate.go` -> `printRMDuplicateLabOrderImpl` |
| `/print/rm-duplicate/lab-result/:rmOrderId` | `PrintRMDuplicateLabResult` | `print_render_duplicate.go` -> `printRMDuplicateLabResultImpl` |
| `/print/rm-duplicate/radiology-result/:rmOrderId` | `PrintRMDuplicateRadiologyResult` | `print_render_duplicate.go` -> `printRMDuplicateRadiologyResultImpl` |
| `/print/rm-duplicate/procedure-result/:rmOrderId` | `PrintRMDuplicateProcedureResult` | `print_render_duplicate.go` -> `printRMDuplicateProcedureResultImpl` |
| `/print/rm-duplicate/prescription/:rmOrderId` | `PrintRMDuplicatePrescription` | `print_render_duplicate.go` -> `printRMDuplicatePrescriptionImpl` |
| `/print/rm-duplicate/billing/:rmDuplicateId` | `PrintRMDuplicateBilling` | `print_render_duplicate.go` -> `printRMDuplicateBillingImpl` |

## File Renderer Domain

File renderer yang sekarang aktif:

- `backend/handlers/print_render_letters.go`
  - surat sakit, sehat, kelahiran, cuti, MCU, kematian
- `backend/handlers/print_render_resumes.go`
  - resume rawat jalan, rawat inap, UGD
- `backend/handlers/print_render_inpatient.go`
  - CPPT, asuhan keperawatan, balance cairan, vital sign
- `backend/handlers/print_render_orders.go`
  - resep, order/hasil lab, hasil radiologi
- `backend/handlers/print_render_duplicate.go`
  - thermal resep, billing, seluruh RM duplicate print utama
- `backend/handlers/print_render_misc.go`
  - tiket, label obat, DPJP request, etiket nutrisi
- `backend/handlers/print_render_bpjs.go`
  - helper signature BPJS, SPRI, surat kontrol
- `backend/handlers/print_render_catalog.go`
  - katalog `available-docs`
- `backend/handlers/print_render_clinical_special.go`
  - label pasien, triage, mutasi bed, mutasi unit, surat rujukan, surat rawat inap
- `backend/handlers/print_render_general_docs.go`
  - informed consent, bukti consent, ringkasan masuk-keluar, bukti registrasi, SEP

File helper bersama yang sekarang sudah dipisah:

- `backend/handlers/print_helpers_format.go`
  - formatting tanggal, usia, enum, diagnosis, CPPT, follow-up date, truncate helper
- `backend/handlers/print_helpers_layout.go`
  - `HospitalInfo`, header PDF, tabel pasien/order, layout constants, dan helper table rendering
- `backend/handlers/print_helpers_common.go`
  - konversi angka/uang dan loader RM duplicate order
- `backend/handlers/print_helpers_casemix.go`
  - scope clinical casemix dan mirror data untuk print
- `backend/handlers/print_helpers_cache.go`
  - cache PDF signed document
- `backend/handlers/print_helpers_signature.go`
  - signature lookup, QR signature, footer validasi digital

## Public Entry yang Masih Langsung di `print_pdf.go`

Saat ini tidak ada lagi public entry MR utama yang masih memakai implementasi langsung di `backend/handlers/print_pdf.go`.

`print_public_delegators.go` sekarang menampung seluruh public entry print yang menjadi wrapper tipis ke `print_render_*Impl`.

`print_pdf.go` sekarang berfungsi terutama sebagai:

- helper delegator kecil lintas domain
- wrapper non-public yang masih dipakai internal renderer lain

## Helper Umum yang Tetap di `print_pdf.go`

Helper lintas domain sekarang mayoritas sudah dipindah dari `print_pdf.go` ke file terpisah:

- casemix / clinical source -> `print_helpers_casemix.go`
- header, tabel, layout -> `print_helpers_layout.go`
- formatting tanggal, angka, diagnosis -> `print_helpers_format.go` dan `print_helpers_common.go`
- cache PDF -> `print_helpers_cache.go`
- QR dan digital signature -> `print_helpers_signature.go`

Ini menjaga renderer domain tetap fokus ke dokumen, bukan utilitas global.

## Saran Maintenance Berikutnya

Prioritas lanjutan yang paling masuk akal:

1. lanjut pindahkan public function lama yang implementasinya masih penuh di `print_pdf.go` ke renderer domain
2. sinkronkan registry MR backend dengan audit `MR.0 - MR.50`, terutama untuk MR yang belum punya route print
3. tambahkan tes smoke untuk route penting:
   - resume
   - surat kontrol
   - resep
   - hasil lab/radiologi
   - RM duplicate
