# DATA KLAIM
1. Ketika masuk ke data klaim jika user tidak membuat rekam medis duplikat pada eklaim maka semua data kunjungan pastikan di load dari data kunjungan asli
2. Pastikan tanggal masuk dan tanggal keluar pada kunjungan asli dan rekam medis duplikat support untuk HH:mm:ss juga karena dari INACBG wajib ada untuk ada jangan sampai hanaya data tanpa time
3. Pastikan juga untuk cara masuk dan cara keluar bisa anda mapping jika kontrol masuk dalam pilihan mana di INACBG dll tolong anda cek sesuai pilihan yang sudah diberikan di dalam [EKLAIM] API REQUEST BODY DAN KONDISI.md 
4. Termasuk juga untuk status pulang pastikan sama dengan [EKLAIM] API REQUEST BODY DAN KONDISI.md dan discharge pada kunjungan tolong untuk cara masuk dan cara keluar/status pulang sudah anda mapping sesuai ketika kondisi di SIMRS dan kondisi di INACBG terhubung!

# REKAM MEDIS DUPLIKAT
1. Tujuan rekam medis duplikat adalah bagian casemix akan melakukan edit data rekam medis yang akan di setor ke BPJS, karena jika rekam medis tidak di edit oleh BPJS akan besar kemungkinan ditolak dari pihak BPJS jadi membuat RS rugi
2. Pastikan semua form dan field yang ada di rekam medis kunjungan asli itu ada di rekam medis duplikat!
3. Untuk order lab dan radiologi itu kan kita ada parameter sendiri di SIMRS untuk order. jadi ketika ada data order munculkan data hasil order dimana nanti hasil order ini dapat diedit dan diduplikat dan juga ada kondisi kita bisa membuat fake order jadi tanggal dan lainnya bisa dibuat sendiri jadi pastikan form untuk RM duplikat support lalu tolong pastikan untuk parameter yang perlu diisi itu sama seperti pada master tindakan
4. Untuk obat ini kita juga bisa mengedit termasuk menambah dan mengurangi jadi pastikan untuk RM duplikat juga support itu
5. Untuk operasi dan konsultasi juga berlaku seperti itu tolong anda pastikan form yang ada di kunjungan asli sama dengan RM duplikat
6. Billing, jika kita mengubah untuk order termasuk (operasi, lab, radiologi, farmasi, konsul) ini kan pasti kita akan otomatis menambahkan billing dan juga ketika menghapus juga akan mengurangi billing. pastikan untuk RM duplikat support itu dan pastikan untuk billing tidak tercampur dengan fake billing jadi pisahkan databasenya
7. Pastikan untuk Rawat inap juga ikut CPPT, Balance Cairan, DLL ada juga dan bisa diedit ditambah dan dihapus
8. PASTIKAN UNTUK ORDER SEPERTI (LAB, RAD, KONSUL, OPERASI) PASTIKAN DI UI MEMILIH DULU PROCEDURENYA DAN LOAD PROCEDURE PARAMETER UNTUK MENGISI HASILNYA! DAN JUGA JIKA SUDAH ADA LOAD PROCEDURE PARAMETER YANG DIISI AGAR BISA DIEDIT
9. BILLING PISAH JANGAN SAMPAI MEMPENGARUHI BILLING ASLI!
10. OBAT TIDAK ADA MANA ADA TAMBAH DAN HAPUS OBAT! SUDAH JELAS SEMUA DISINI!

# CETAKAN
1. Pastikan untuk cetakan ikut sesuai dengan RM duplikat jangan ikut ke RM asli
2. Untuk TTD digital nanti bisa dipilih manual oleh user casemix jadi nanti TTD akan ikut sesuai casemix jadi tolong di cetakan berikan button disamping dokumen untuk TTDnya, berikan helper jika dokumen ini perlu di TTD siapa. 

# PASTIKAN UPDATE APA YANG SUDAH DIKERJAKAN DIBAWAH !

## PROGRESS

### ✅ DATA KLAIM (Poin 1-4) — SELESAI
1. **Load dari kunjungan asli** — Sudah. Backend `GetEKlaimLocalDetail` auto-populate field klaim dari Visit (AdmissionTime, DischargeTime, CheckInTime, EndTime), SEP (jenis_rawat, kelas_rawat, nama_dokter), dan Disposition (discharge_status) jika user belum save form data. Priority: RM Duplicate > RM Asli > SEP > Visit.
2. **Tanggal masuk/pulang HH:mm:ss** — Sudah.
   - Model `EKlaimLocal.TglMasuk/TglPulang` diperlebar dari `size:10` → `size:30` agar muat `yyyy-mm-dd HH:mm:ss`
   - Backend format dari `2006-01-02` → `2006-01-02 15:04:05` (termasuk fallback ke StartTime untuk rawat jalan)
   - Frontend menambah helper `toDatetimeLocal()` / `fromDatetimeLocal()` untuk konversi antara HTML `datetime-local` (T separator) dan E-Klaim API (space separator)
   - Input `<datetime-local step="1">` menampilkan picker detik
   - Visit.AdmissionTime, CheckInTime, dll sudah `time.Time` (include jam) — dikonfirmasi dari handler admission_request.go & registration.go
3. **Cara Masuk** — Disederhanakan. Hanya auto-fill dari SEP.AsalRujukan (1→gp, 2→hosp-trans). Selain itu **dikosongkan**, user pilih sendiri di form data klaim. Opsi lengkap tersedia: gp, hosp-trans, mp, outp, inp, emd, born, nursing, psych, rehab, other.
4. **Status Pulang (discharge_status) mapping** — Sudah diperluas. Backend `mapEKlaimDischargeStatus` dan frontend `mapDischargeStatus` sekarang mapping:
   - pulang/sembuh/membaik/pulang_sehat → `1` (Atas Persetujuan Dokter)
   - rujuk/rujuk_keluar/pindah_rs/transfer → `2` (Dirujuk)
   - aps/pulang_paksa/menolak_rawat → `3` (APS)
   - meninggal/dod/meninggal_48/meninggal_lebih_48 → `4` (Meninggal)
   - rawat_inap/kontrol/lain_lain/lainnya → `5` (Lain-lain)

### ✅ REKAM MEDIS DUPLIKAT (Poin 1-10) — SELESAI
1. **Tujuan RM Duplikat (edit tanpa ubah asli)** — Sudah. Casemix bisa duplikasi RM dari kunjungan asli lalu mengedit data klinis tanpa mempengaruhi RM asli. Data tersimpan di tabel `e_klaim_rm_duplicates`.
2. **Semua form & field yang ada di RM asli juga ada di RM duplikat** — Sudah.
   - **Anamnesis**: chief_complaint, history_of_illness, past_medical_history, allergy_history, family_history, social_history, review_of_systems
   - **Pemeriksaan Fisik**: Vital signs (systolic, diastolic, heart_rate, respiratory_rate, temperature, oxygen_saturation, weight, height, waist, head_circum), keadaan umum (general_condition, consciousness), pemeriksaan per organ (head, eyes, ears, nose, throat, neck, chest, heart, lungs, abdomen, extremities, neurological, musculoskel, genitourinary, skin, other_findings), legacy combined fields (head_neck, ent, thorax, cardiac, pulmonary), EKG (ecg_performed, ecg_result, ecg_interpretation, ecg_notes)
   - **Assessment & Plan**: clinical_assessment, prognosis, treatment_plan, medication_plan, diet_plan, activity_plan, education_plan, monitoring_plan, procedure_plan, consultation_plan
   - **Disposition**: disposition_type, discharge_status, discharge_condition, discharge_instruction, follow_up_instruction, disposition_note, discharge_medication, follow_up_date, referral_facility, referral_reason, referral_diagnosis, referral_therapy, referral_notes, death_time, death_cause
3. **Order Lab/Rad dengan parameter & fake order** — Sudah. UI memilih prosedur → load parameter dari master tindakan → form hasil per parameter. Fake order support (is_fake flag, fake_date). **Radiology tidak lagi menampilkan free-text field (result_summary, conclusion, suggestion) — semua hasil diisi melalui procedure parameter.**
4. **Obat bisa tambah/hapus/edit** — Sudah. Tabel `e_klaim_rm_medicines` mendukung CRUD lengkap obat di RM duplikat terpisah dari RM asli.
5. **Operasi & Konsultasi** — Sudah. **Alur sama dengan lab/radiologi: pilih prosedur → load parameter master → isi hasil per parameter.** Order-level hanya menyimpan metadata (operasi: nama operator + jenis anestesi + tanggal jadwal; konsultasi: nama konsultan + spesialisasi). SOAP, diagnosis, catatan klinis, dll. semuanya melalui procedure parameter.
6. **Billing terpisah** — Sudah. Billing RM duplikat tersimpan di tabel terpisah `e_klaim_rm_billings` dan `e_klaim_rm_billing_items`, tidak mempengaruhi billing asli. Auto-recalculate pada perubahan order/medicine. Mapping ke tarif E-Klaim dengan prioritas ProcedureGroup → order_type → description keyword.
7. **CPPT & Balance Cairan** — Sudah. Tabel `e_klaim_rm_cppt_notes` dan `e_klaim_rm_fluid_balances` mendukung CRUD, termasuk fake notes.
8. **UI load procedure parameter** — Sudah. Semua tipe order (lab, radiologi, operasi, konsultasi):
   - Pilih tindakan dari master → load procedure parameter otomatis
   - Render form input sesuai input_type parameter (text, number, textarea, select, checkbox, date, datetime)
   - Tampilkan unit, normal range, status (Normal/↓L/↑H/KRITIS)
   - Order baru tanpa item otomatis menampilkan search procedure
9. **Billing pisah** — Sudah (lihat poin 6).
10. **Obat tambah/hapus** — Sudah (lihat poin 4).

**Pendukung:**
- `DuplicateRM` handler: Copy seluruh data klinis dari RM asli (anamnesis, fisik, assessment, disposition, orders+items+results, medicines, CPPT, fluid balance)
- `CreateClaimFromSEP` handler: Juga copy seluruh data klinis ke RM duplikat (sebelumnya hanya diagnosa/prosedur — sudah diperbaiki)
- `SyncRMFromVisit` handler: Sinkronisasi ulang data klinis dari RM asli ke RM duplikat
- `UpdateRMDuplicate` handler: Save perubahan dari frontend ke semua field RM duplikat
- Frontend `rm-duplicate-tab.tsx`: UI lengkap 14 section (anamnesis, physical-exam, assessment, disposition, diagnoses, procedures, orders, medicines, cppt, fluid-balance, dll) dengan semua field baru
- **Billing Mapping Logic**: Updated dengan 3-level priority (ProcedureGroup → order_type → description keywords). Frontend preview modal match dengan backend logic.

### 🔄 CETAKAN — SEDANG DIKERJAKAN