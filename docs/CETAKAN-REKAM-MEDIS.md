# Analisis Cetakan Rekam Medis - SIMRS

Dokumen ini berisi analisis lengkap semua cetakan rekam medis yang dapat dibuat berdasarkan data yang tersedia di sistem SIMRS.

---

## Ringkasan

| No | Kategori | Jumlah Cetakan |
|----|----------|----------------|
| A | Cetakan Umum / Header | 2 |
| B | Cetakan Rawat Jalan | 7 |
| C | Cetakan Gawat Darurat (UGD) | 2 |
| D | Cetakan Rawat Inap | 6 |
| E | Cetakan Order & Penunjang | 7 |
| F | Cetakan Farmasi | 3 |
| G | Cetakan Operasi / Bedah | 3 |
| H | Cetakan Ringkasan & Laporan | 4 |
| **Total** | | **34 cetakan** |

---

## A. Cetakan Umum / Header

### A1. General Consent / Persetujuan Umum
**Sumber data:** `Patient`, `Registration`
| Field | Model |
|-------|-------|
| Nama RS, Alamat, Telepon | `Setting` (key-value) |
| No. RM, Nama Pasien, TTL, Jenis Kelamin | `Patient` |
| NIK, Alamat, No. HP | `Patient` |
| Nama Penanggung Jawab, Hubungan | `Patient` |
| Jenis Jaminan, No. BPJS/Asuransi | `Patient`, `Registration` |
| Tanggal Registrasi | `Registration` |

### A2. Label Pasien (Stiker Identitas)
**Sumber data:** `Patient`, `Registration`
| Field | Model |
|-------|-------|
| No. RM | `Patient.NoRM` |
| Nama Lengkap | `Patient.NamaLengkap` |
| Tanggal Lahir / Umur | `Patient.TanggalLahir` |
| Jenis Kelamin | `Patient.JenisKelamin` |
| Golongan Darah / Rhesus | `Patient.GolonganDarah`, `Patient.Rhesus` |
| Alergi (highlight) | `Patient.AlergiObat`, `PatientAllergy` |
| Barcode/QR No. RM | Generated |

---

## B. Cetakan Rawat Jalan

### B1. Formulir Anamnesis
**Sumber data:** `Anamnesis`, `PatientAllergy`, `PatientMedication`
| Field | Model |
|-------|-------|
| Keluhan Utama | `Anamnesis.ChiefComplaint` |
| Riwayat Penyakit Sekarang | `Anamnesis.HistoryOfPresentIllness` |
| Riwayat Penyakit Dahulu | `Anamnesis.PastMedicalHistory` |
| Riwayat Penyakit Keluarga | `Anamnesis.FamilyHistory` |
| Riwayat Sosial | `Anamnesis.SocialHistory` |
| Alergi (SNOMED CT coded) | `PatientAllergy` (kategori, kritikalitas) |
| Obat yang Sedang Dikonsumsi | `PatientMedication` (SNOMED CT coded) |
| Review of Systems | `Anamnesis.ReviewOfSystems` |
| Dicatat oleh | `Anamnesis.RecordedBy` |

### B2. Formulir Pemeriksaan Fisik
**Sumber data:** `PhysicalExamination`
| Field | Model |
|-------|-------|
| Keadaan Umum, Kesadaran | `PhysicalExamination` |
| **Tanda Vital:** | |
| - TD Sistolik/Diastolik (LOINC 8480-6/8462-4) | `PhysicalExamination` |
| - Nadi (LOINC 8867-4) | `PhysicalExamination` |
| - Pernapasan (LOINC 9279-1) | `PhysicalExamination` |
| - Suhu (LOINC 8310-5) | `PhysicalExamination` |
| - SpO2 (LOINC 2708-6) | `PhysicalExamination` |
| **Antropometri:** | |
| - BB (LOINC 29463-7), TB (LOINC 8302-2) | `PhysicalExamination` |
| - BMI (LOINC 39156-5) + Kategori | `PhysicalExamination` |
| - Lingkar Pinggang, Lingkar Kepala | `PhysicalExamination` |
| **Pemeriksaan Fisik (13 sistem):** | |
| Kepala/Leher, Mata, THT, Thorax, Jantung, Paru | `PhysicalExamination` |
| Abdomen, Ekstremitas, Kulit, Neurologis | `PhysicalExamination` |
| Muskuloskeletal, Genitourinaria, Lain-lain | `PhysicalExamination` |
| **EKG:** Dilakukan/Hasil/Interpretasi | `PhysicalExamination` |
| Diperiksa oleh | `PhysicalExamination.ExaminedBy` |

### B3. Lembar Diagnosis
**Sumber data:** `Diagnosis`, `DiagnosisSummary`
| Field | Model |
|-------|-------|
| Kode ICD-10 dan Nama | `Diagnosis.ICDCode`, `Diagnosis.ICDName` |
| Tipe (Primer/Sekunder/Komplikasi) | `Diagnosis.DiagnosisType` |
| Status Klinis (FHIR) | `Diagnosis.ClinicalStatus` |
| Status Verifikasi | `Diagnosis.VerificationStatus` |
| Severity (Ringan/Sedang/Berat) | `Diagnosis.Severity` |
| Body Site, Onset Date | `Diagnosis` |
| Kesan Klinis | `DiagnosisSummary.ClinicalImpression` |
| Diagnosis Banding | `DiagnosisSummary.DifferentialDiagnosis` |
| Didiagnosis oleh | `Diagnosis.DiagnosedBy` |

### B4. Lembar Assessment & Rencana Terapi
**Sumber data:** `AssessmentPlan`
| Field | Model |
|-------|-------|
| Kesan Klinis | `AssessmentPlan.Assessment` |
| Prognosis | `AssessmentPlan.Prognosis` |
| **8 Rencana Penatalaksanaan:** | |
| - Rencana Terapi | `AssessmentPlan.TreatmentPlan` |
| - Rencana Obat | `AssessmentPlan.MedicationPlan` |
| - Rencana Diet | `AssessmentPlan.DietPlan` |
| - Rencana Aktivitas | `AssessmentPlan.ActivityPlan` |
| - Rencana Edukasi | `AssessmentPlan.EducationPlan` |
| - Rencana Monitoring | `AssessmentPlan.MonitoringPlan` |
| - Rencana Tindakan | `AssessmentPlan.ProcedurePlan` |
| - Rencana Konsultasi | `AssessmentPlan.ConsultationPlan` |
| Dinilai oleh | `AssessmentPlan.AssessedBy` |

### B5. Lembar Tindakan / Prosedur
**Sumber data:** `VisitProcedure`, `VisitProcedureResult`
| Field | Model |
|-------|-------|
| Nama Tindakan, Kode | `VisitProcedure.Procedure` |
| Status Pengerjaan | `VisitProcedure.Status` |
| Waktu Pengerjaan | `VisitProcedure.PerformedAt` |
| **Parameter & Hasil:** | |
| - Nama Parameter, Satuan | `VisitProcedureResult.ProcedureParameter` |
| - Nilai Normal | `ProcedureParameter.NormalMin/Max` |
| - Hasil (teks/numerik) | `VisitProcedureResult.Value` |
| - Flag Abnormal/Kritis | `VisitProcedureResult.IsAbnormal/IsCritical` |
| Catatan | `VisitProcedure.Notes` |
| Dikerjakan oleh | `VisitProcedure.FilledBy` |

### B6. Surat Keterangan Sakit / Sehat
**Sumber data:** `Patient`, `Visit`, `Diagnosis`
| Field | Model |
|-------|-------|
| Identitas Pasien (Nama, TTL, Alamat) | `Patient` |
| Diagnosis Primer | `Diagnosis` (primary) |
| Tanggal Periksa | `Visit.StartTime` |
| Lama Istirahat (hari) | Input manual saat cetak |
| Dokter Pemeriksa | `Visit.Doctor` |

### B7. Surat Rujukan
**Sumber data:** `Disposition`, `Diagnosis`, `Visit`
| Field | Model |
|-------|-------|
| Identitas Pasien | `Patient` |
| Diagnosis | `Diagnosis` (all) |
| Tujuan Rujukan | `Disposition.ReferralFacility` |
| Alasan Rujukan | `Disposition.ReferralReason` |
| Urgensi | `Disposition.ReferralUrgency` |
| Ringkasan Klinis | `Visit.Treatment`, `AssessmentPlan` |
| Terapi yang Sudah Diberikan | `MedicineOrder`, `VisitProcedure` |
| Dokter Perujuk | `Disposition.DischargedBy` |

---

## C. Cetakan Gawat Darurat (UGD)

### C1. Formulir Triage
**Sumber data:** `Triage`
| Field | Model |
|-------|-------|
| Cara Datang (Ambulans/Pribadi/Polisi) | `Triage.ArrivalMode` |
| Keluhan Utama | `Triage.ChiefComplaint` |
| Level Triage (0-5) | `Triage.TriageLevel` |
| **Primary Survey (ABC):** | |
| - Airway | `Triage.Airway` |
| - Breathing | `Triage.Breathing` |
| - Circulation | `Triage.Circulation` |
| **Tanda Vital:** | |
| TD, Nadi, RR, Suhu, SpO2, Nyeri | `Triage` |
| **Glasgow Coma Scale:** E / V / M / Total | `Triage.GCSE/V/M/Total` |
| Tingkat Kesadaran | `Triage.Consciousness` |
| Assessment & Tindakan Segera | `Triage.TriageAssessment/ImmediateActions` |
| Petugas Triage | `Triage.TriagedBy` |

### C2. Ringkasan Pelayanan UGD
**Sumber data:** Gabungan semua komponen UGD
| Field | Sumber |
|-------|--------|
| Data Triage | `Triage` |
| Anamnesis | `Anamnesis` |
| Pemeriksaan Fisik & Vital Sign | `PhysicalExamination` |
| Diagnosis | `Diagnosis` |
| Tindakan yang Dilakukan | `VisitProcedure` |
| Terapi/Obat yang Diberikan | `MedicineOrder` |
| Hasil Penunjang | `ProcedureOrder` (lab, radiology) |
| Disposisi (Pulang/Ranap/Rujuk/Meninggal) | `Disposition` |
| Instruksi Pulang / Kontrol | `Disposition` |

---

## D. Cetakan Rawat Inap

### D1. CPPT - Catatan Perkembangan Pasien Terintegrasi
**Sumber data:** `CPPT` (multiple records)
| Field | Model |
|-------|-------|
| Tanggal / Jam | `CPPT.RecordDate` |
| Profesi (Dokter/Perawat/Bidan/dll) | `CPPT.Profession` |
| **SOAP:** | |
| - Subjective | `CPPT.Subjective` |
| - Objective | `CPPT.Objective` |
| - Assessment | `CPPT.Assessment` |
| - Plan | `CPPT.Plan` |
| Instruksi | `CPPT.Instruction` |
| Tanda Vital | `CPPT` (BP, HR, RR, Temp, SpO2, Pain) |
| Verifikasi | `CPPT.IsVerified`, `CPPT.VerifiedBy` |
| Dicatat oleh | `CPPT.CreatedBy` |

> **Format cetak:** Tabel kronologis, multi-entry per halaman

### D2. Asuhan Keperawatan (SDKI-SLKI-SIKI)
**Sumber data:** `NursingCare`
| Field | Model |
|-------|-------|
| Tanggal, Shift (Pagi/Siang/Malam) | `NursingCare` |
| **Pengkajian:** | |
| Keluhan, Nyeri (lokasi/skala/karakter) | `NursingCare` |
| Kesadaran, Status Fungsional | `NursingCare` |
| Risiko Jatuh (assessment + skor) | `NursingCare` |
| Nutrisi, Integritas Kulit, Decubitus | `NursingCare` |
| Vital Sign | `NursingCare` |
| **SDKI - Diagnosis Keperawatan:** | |
| Kode, Diagnosis, Etiologi, Tanda/Gejala | `NursingCare` |
| **SLKI - Luaran Keperawatan:** | |
| Kode, Luaran, Indikator, Target | `NursingCare` |
| **SIKI - Intervensi Keperawatan:** | |
| Kode, Intervensi | `NursingCare` |
| Tindakan Observasi/Terapeutik/Edukasi/Kolaborasi | `NursingCare` |
| **Implementasi:** Tindakan, Waktu, Respon | `NursingCare` |
| **Evaluasi (SOAP):** S, O, A (status masalah), P | `NursingCare` |
| Perawat | `NursingCare.CreatedBy` |

> **Format cetak:** Per shift, mengikuti format standar SDKI-SLKI-SIKI Kemenkes

### D3. Catatan Balance Cairan
**Sumber data:** `FluidBalance`
| Field | Model |
|-------|-------|
| Tanggal, Shift | `FluidBalance` |
| **Intake (Masukan):** | |
| Oral (minum, makan, obat) | `FluidBalance` |
| Parenteral (infus, obat IV, darah) | `FluidBalance` |
| Enteral (NGT/OGT) | `FluidBalance` |
| **Output (Keluaran):** | |
| Urine (jumlah, warna, kateter) | `FluidBalance` |
| Feses (jumlah, frekuensi, konsistensi) | `FluidBalance` |
| Muntah (jumlah, frekuensi) | `FluidBalance` |
| Drain (jumlah, tipe, warna) | `FluidBalance` |
| Perdarahan, IWL | `FluidBalance` |
| **Total Intake / Total Output / Balance** | `FluidBalance` (calculated) |

> **Format cetak:** Tabel per shift / per 24 jam dengan total

### D4. Lembar Mutasi / Transfer Pasien
**Sumber data:** `BedTransfer`
| Field | Model |
|-------|-------|
| Tanggal Transfer | `BedTransfer.TransferDate` |
| Dari Ruangan / Bed | `BedTransfer.FromRoom`, `FromBed` |
| Ke Ruangan / Bed | `BedTransfer.ToRoom`, `ToBed` |
| Jenis Transfer | `BedTransfer.TransferType` |
| Alasan Transfer | `BedTransfer.Reason` |
| Kelas Sebelum / Sesudah | `BedTransfer.OldClass`, `NewClass` |
| Catatan | `BedTransfer.Notes` |
| Petugas | `BedTransfer.CreatedBy` |

### D5. Grafik Vital Sign (Observasi)
**Sumber data:** `VitalSign` (multiple records per visit)
| Field | Model |
|-------|-------|
| Waktu Pengukuran | `VitalSign.MeasuredAt` |
| TD Sistolik/Diastolik | `VitalSign` |
| Nadi | `VitalSign.HeartRate` |
| Pernapasan | `VitalSign.RespiratoryRate` |
| Suhu | `VitalSign.Temperature` |
| SpO2 | `VitalSign.OxygenSaturation` |
| Skala Nyeri | `VitalSign.PainScale` |
| Diukur oleh | `VitalSign.MeasuredBy` |

> **Format cetak:** Grafik garis (line chart) + tabel numerik

### D6. Lembar Informed Consent Rawat Inap
**Sumber data:** `Patient`, `Registration`, `Disposition` (admission)
| Field | Model |
|-------|-------|
| Identitas Pasien | `Patient` |
| Jenis Tindakan Rawat Inap | `Disposition.AdmissionReason` |
| Kelas Perawatan | `Disposition.InpatientClass` |
| Dokter Penanggung Jawab | `Visit.Doctor` |
| Penanggung Jawab Pasien | `Patient.NamaPenanggungJawab` |

---

## E. Cetakan Order & Penunjang

### E1. Formulir Order Laboratorium
**Sumber data:** `ProcedureOrder` (order_type = "laboratory")
| Field | Model |
|-------|-------|
| No. Order | `ProcedureOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| Diagnosis | `ProcedureOrder.Diagnosis` |
| Catatan Klinis | `ProcedureOrder.ClinicalNotes` |
| Prioritas | `ProcedureOrder.Priority` |
| **Daftar Pemeriksaan:** | |
| Nama Pemeriksaan | `ProcedureOrderItem.Procedure.Name` |
| Catatan per Item | `ProcedureOrderItem.Notes` |
| Laboratorium Tujuan | `ProcedureOrder.TargetRoom` |
| Dokter Pengirim | `ProcedureOrder.OrderedBy` |
| Tanggal Order | `ProcedureOrder.CreatedAt` |

### E2. Hasil Laboratorium
**Sumber data:** `ProcedureOrder` + `ProcedureOrderResult`
| Field | Model |
|-------|-------|
| No. Order | `ProcedureOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| **Per Pemeriksaan:** | |
| Nama Parameter | `ProcedureParameter.Name` |
| Hasil | `ProcedureOrderResult.Value` |
| Satuan | `ProcedureParameter.Unit` |
| Nilai Normal | `ProcedureParameter.NormalMin/Max/Text` |
| Flag (Normal/Low/High/Critical) | `ProcedureOrderResult.IsNormal/Low/High/Critical` |
| Ringkasan Hasil | `ProcedureOrder.ResultSummary` |
| Kesan | `ProcedureOrder.Conclusion` |
| Saran | `ProcedureOrder.Suggestion` |
| Nilai Kritis | `ProcedureOrder.IsCritical/CriticalNotes` |
| Dikerjakan oleh | `ProcedureOrder.PerformedBy` |
| Divalidasi oleh | `ProcedureOrder.ValidatedBy` |

### E3. Formulir Order Radiologi
**Sumber data:** `ProcedureOrder` (order_type = "radiology")
| Field | Model |
|-------|-------|
| (Sama dengan E1 Order Lab) | |
| Unit Radiologi Tujuan | `ProcedureOrder.TargetRoom` |

### E4. Hasil Radiologi (Expertise)
**Sumber data:** `ProcedureOrder` + `ProcedureOrderResult`
| Field | Model |
|-------|-------|
| (Sama dengan E2 Hasil Lab) | |
| **Tambahan:** | |
| Lampiran/Gambar | `ProcedureOrder.AttachmentURLs` |

### E5. Formulir Permintaan Konsultasi
**Sumber data:** `ProcedureOrder` (order_type = "consultation")
| Field | Model |
|-------|-------|
| No. Order | `ProcedureOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| Dari Ruangan/Dokter | `ProcedureOrder.SourceRoom`, `OrderedBy` |
| Ke Ruangan/Spesialis | `ProcedureOrder.TargetRoom` |
| Diagnosis | `ProcedureOrder.Diagnosis` |
| Catatan Klinis | `ProcedureOrder.ClinicalNotes` |
| Prioritas | `ProcedureOrder.Priority` |

### E6. Jawaban Konsultasi
**Sumber data:** `ProcedureOrder.Consultation`
| Field | Model |
|-------|-------|
| No. Order | `ProcedureOrder.OrderNumber` |
| **SOAP Konsultan:** | |
| - Subjective | `Consultation.Subjective` |
| - Objective | `Consultation.Objective` |
| - Assessment | `Consultation.Assessment` |
| - Plan | `Consultation.Plan` |
| Rekomendasi | `Consultation.Recommendation` |
| Catatan | `Consultation.Notes` |
| Dokter Konsultan | `Consultation.Consultant` |

### E7. Tiket Antrian
**Sumber data:** `RoomQueue`, `Visit`, `Registration`
| Field | Model |
|-------|-------|
| Nama Ruangan | `Room.Name` |
| No. Antrian | `RoomQueue.QueueNumber` |
| Nama Pasien | `Patient.NamaLengkap` |
| No. RM | `Patient.NoRM` |
| No. Order | `ProcedureOrder.OrderNumber` |
| Waktu | `RoomQueue.CreatedAt` |

---

## F. Cetakan Farmasi

### F1. Resep / Prescription
**Sumber data:** `MedicineOrder`, `MedicineOrderItem`
| Field | Model |
|-------|-------|
| No. Resep (RX-YYYYMMDD-XXXX) | `MedicineOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| Diagnosis | `MedicineOrder.Diagnosis` |
| Jenis Resep (Regular/Racikan/PRN) | `MedicineOrder.PrescriptionType` |
| **Per Obat:** | |
| Nama Obat, Kode, Sediaan, Kekuatan | `MedicineOrderItem` |
| Jumlah, Satuan | `MedicineOrderItem.Quantity/Unit` |
| Aturan Pakai (Dosis/Frekuensi/Rute) | `MedicineOrderItem` |
| Durasi | `MedicineOrderItem.Duration` |
| Instruksi Khusus | `MedicineOrderItem.Instructions` |
| Catatan untuk Farmasi | `MedicineOrder.Notes` |
| Dokter Penulis Resep | `MedicineOrder.OrderedBy` |

### F2. Etiket Obat (Label Obat)
**Sumber data:** `MedicineOrderItem`
| Field | Model |
|-------|-------|
| Nama Pasien | `Patient.NamaLengkap` |
| No. RM | `Patient.NoRM` |
| Nama Obat | `MedicineOrderItem.Medicine.Name` |
| Aturan Pakai | `MedicineOrderItem.Dosage/Frequency/Route` |
| Instruksi | `MedicineOrderItem.Instructions` |
| Tanggal | `MedicineOrder.CreatedAt` |

> **Format cetak:** Label kecil untuk ditempel di kemasan obat

### F3. Bukti Penyerahan Obat
**Sumber data:** `MedicineOrder` (status = delivered)
| Field | Model |
|-------|-------|
| No. Resep | `MedicineOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| Daftar Obat yang Diserahkan | `MedicineOrderItem` (dispensed) |
| Jumlah Diminta vs Diserahkan | `Quantity` vs `DispensedQuantity` |
| Substitusi (jika ada) | `MedicineOrderItem.IsSubstituted/SubstitutionReason` |
| Obat yang Diretur | `MedicineReturn` |
| Review Farmasis | `PrescriptionReview` |
| Diserahkan oleh | `MedicineOrder.DeliveredBy` |
| Tanggal Penyerahan | `MedicineOrder.DeliveredAt` |

---

## G. Cetakan Operasi / Bedah

### G1. Informed Consent Operasi
**Sumber data:** `ProcedureOrder` (surgery), `Patient`
| Field | Model |
|-------|-------|
| Identitas Pasien | `Patient` |
| Diagnosis | `ProcedureOrder.Diagnosis` |
| Tindakan yang Akan Dilakukan | `ProcedureOrderItem.Procedure.Name` |
| Dokter Bedah | `ProcedureOrder.SurgeonDoctor` |
| Jadwal Operasi | `ProcedureOrder.ScheduledDate` |
| Penanggung Jawab | `Patient.NamaPenanggungJawab` |
| Hubungan | `Patient.HubunganPenanggungJawab` |

> *Catatan: Konten persetujuan (risiko, alternatif, dll) perlu template tetap*

### G2. Laporan Operasi
**Sumber data:** `ProcedureOrder` (surgery, completed), result_summary (structured)
| Field | Sumber |
|-------|--------|
| No. Order | `ProcedureOrder.OrderNumber` |
| Identitas Pasien | `Patient` |
| Dokter Bedah | `ProcedureOrder.SurgeonDoctor` |
| Dokter Pengirim | `ProcedureOrder.OrderedBy` |
| Jadwal / Waktu Operasi | `ProcedureOrder.ScheduledDate`, `StartedAt`, `CompletedAt` |
| Tindakan Operasi | `ProcedureOrderItem.Procedure.Name` |
| **Laporan (structured):** | |
| Diagnosis Pre-Operasi | `result_summary.diagnosis_pre_op` |
| Diagnosis Post-Operasi | `result_summary.diagnosis_post_op` |
| Jenis Anestesi | `result_summary.anesthesia_type` |
| Klasifikasi Luka | `result_summary.wound_classification` |
| Uraian Tindakan Operasi | `result_summary.surgical_procedure` |
| Temuan Intra-Operatif | `result_summary.surgical_findings` |
| Estimasi Perdarahan | `result_summary.blood_loss` |
| Komplikasi | `result_summary.complications` |
| Spesimen Patologi | `result_summary.specimen` |
| Instruksi Post-Operasi | `ProcedureOrder.Suggestion` |
| **Parameter Tambahan (per tindakan):** | |
| Nama Parameter | `ProcedureParameter.Name` |
| Hasil | `ProcedureOrderResult.Value` |
| Dikerjakan oleh | `ProcedureOrder.PerformedBy` |

### G3. Checklist Keselamatan Operasi (Surgical Safety Checklist - WHO)
**Sumber data:** Template tetap + data order
| Field | Sumber |
|-------|--------|
| Identitas Pasien (konfirmasi) | `Patient` |
| Tindakan (konfirmasi) | `ProcedureOrderItem` |
| Sisi Operasi (konfirmasi) | Manual |
| **Sign In:** Identitas, Alergi, Airway, Blood Loss Risk | `Patient`, `PatientAllergy` |
| **Time Out:** Konfirmasi tim, Antibiotik, Imaging | Manual |
| **Sign Out:** Nama prosedur, Instrumen lengkap, Specimen, Recovery plan | Manual |

> *Catatan: Sebagian besar checklist diisi manual, tapi header data bisa otomatis*

---

## H. Cetakan Ringkasan & Laporan

### H1. Resume Medis Rawat Jalan
**Sumber data:** Gabungan semua data kunjungan rawat jalan
| Section | Sumber |
|---------|--------|
| Header: Pasien, Dokter, Tanggal, Ruangan | `Patient`, `Visit`, `Room` |
| Anamnesis (ringkasan) | `Anamnesis` |
| Pemeriksaan Fisik (vital sign + temuan) | `PhysicalExamination` |
| Diagnosis (ICD-10) | `Diagnosis` |
| Tindakan | `VisitProcedure` |
| Terapi / Resep | `MedicineOrder` |
| Hasil Penunjang (jika ada) | `ProcedureOrder` (lab, rad) |
| Rencana Terapi | `AssessmentPlan` |
| Disposisi / Tindak Lanjut | `Disposition` |

### H2. Resume Medis Rawat Inap (Discharge Summary)
**Sumber data:** Gabungan semua data rawat inap
| Section | Sumber |
|---------|--------|
| Header: Pasien, Dokter, Ruangan/Kelas/Bed | `Patient`, `Visit`, `Room`, `Bed` |
| Tanggal Masuk - Keluar, Lama Rawat | `Visit.AdmissionTime/DischargeTime` |
| Diagnosis Masuk | `Diagnosis` (awal) |
| Diagnosis Akhir (ICD-10) | `Diagnosis` (final) |
| Ringkasan Perjalanan Penyakit | Dari `CPPT` entries |
| Tindakan yang Dilakukan | `VisitProcedure`, `ProcedureOrder` (surgery) |
| Hasil Penunjang Penting | `ProcedureOrder` (lab, rad) |
| Obat Selama Rawat Inap | `MedicineOrder` (all) |
| Kondisi Saat Pulang | `Disposition` |
| Obat Pulang | `Disposition.DischargeMedications` |
| Instruksi Pulang | `Disposition.DischargeInstructions` |
| Kontrol Ulang | `Disposition` (follow-up) |
| Sebab Keluar (Sembuh/Membaik/Meninggal/APS) | `Disposition` |

### H3. Surat Keterangan Rawat Inap
**Sumber data:** `Patient`, `Visit`, `Registration`
| Field | Model |
|-------|-------|
| Identitas Pasien (Nama, TTL, Alamat, NIK) | `Patient` |
| Tanggal Masuk | `Visit.AdmissionTime` |
| Tanggal Keluar | `Visit.DischargeTime` |
| Lama Rawat | Calculated |
| Ruangan / Kelas | `Room`, `Visit.InpatientClass` |
| Diagnosis | `Diagnosis` (primary) |
| Dokter Penanggung Jawab | `Visit.Doctor` |

### H4. Surat Keterangan Kematian
**Sumber data:** `Disposition` (type = meninggal/dod), `Patient`
| Field | Model |
|-------|-------|
| Identitas Pasien Lengkap | `Patient` (all demographic fields) |
| Waktu Meninggal | `Disposition.DeathTime` |
| Sebab Kematian | `Disposition.DeathCause` |
| Diagnosis | `Diagnosis` |
| Dokter yang Menangani | `Visit.Doctor` |
| Penanggung Jawab Pasien | `Patient.NamaPenanggungJawab` |

---

## Catatan Implementasi

### Header Cetakan
Semua cetakan memerlukan header standar RS yang diambil dari `Setting` model:
- `hospital_name` - Nama Rumah Sakit
- `hospital_address` - Alamat
- `hospital_phone` - Telepon
- `hospital_logo` - Logo (URL/base64)
- `hospital_type` - Tipe RS

### Format Cetakan
- **A4 Portrait**: Formulir rekam medis, laporan, resume, surat keterangan
- **A4 Landscape**: CPPT, Balance Cairan, Grafik Vital Sign
- **A5 / Half A4**: Resep, Informed Consent
- **Label (custom)**: Etiket Obat, Label Pasien
- **Thermal (80mm)**: Tiket Antrian

### Prioritas Implementasi (Rekomendasi)
1. **Prioritas Tinggi** (sering digunakan sehari-hari):
   - E7. Tiket Antrian
   - F1. Resep
   - F2. Etiket Obat
   - A2. Label Pasien
   - E1/E3. Order Lab/Radiologi
   - B6. Surat Keterangan Sakit
2. **Prioritas Sedang** (dibutuhkan per kasus):
   - E2/E4. Hasil Lab/Radiologi
   - G2. Laporan Operasi
   - H1. Resume Rawat Jalan
   - H2. Resume Rawat Inap (Discharge Summary)
   - B7. Surat Rujukan
3. **Prioritas Normal** (kelengkapan):
   - B1-B5. Formulir RM per section
   - C1-C2. Formulir UGD
   - D1-D6. Formulir Rawat Inap
   - G1/G3. Consent & Checklist Operasi
   - H3/H4. Surat Keterangan
