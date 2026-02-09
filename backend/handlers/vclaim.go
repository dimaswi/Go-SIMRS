package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"starter/backend/services/bpjs"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== PESERTA ====================

// VClaimGetPesertaByNoKartu mencari peserta BPJS berdasarkan nomor kartu
func VClaimGetPesertaByNoKartu(c *gin.Context) {
	noKartu := c.Param("noKartu")
	tglSEP := c.Query("tglSEP")

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}
	if tglSEP == "" {
		tglSEP = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	peserta, err := client.GetPesertaByNoKartu(noKartu, tglSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return peserta data directly (unwrap from nested structure)
	c.JSON(http.StatusOK, gin.H{"data": peserta.Peserta})
}

// VClaimGetPesertaByNIK mencari peserta BPJS berdasarkan NIK
func VClaimGetPesertaByNIK(c *gin.Context) {
	nik := c.Param("nik")
	tglSEP := c.Query("tglSEP")

	if nik == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK wajib diisi"})
		return
	}
	if tglSEP == "" {
		tglSEP = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	peserta, err := client.GetPesertaByNIK(nik, tglSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return peserta data directly (unwrap from nested structure)
	c.JSON(http.StatusOK, gin.H{"data": peserta.Peserta})
}

// ==================== RUJUKAN ====================

// VClaimGetRujukanByNomor mendapatkan detail rujukan
func VClaimGetRujukanByNomor(c *gin.Context) {
	noRujukan := c.Param("noRujukan")
	asalFaskes := c.DefaultQuery("asalFaskes", "1") // Default Faskes 1

	if noRujukan == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor rujukan wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rujukan, err := client.GetRujukanByNomor(noRujukan, asalFaskes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rujukan})
}

// VClaimGetRujukanByPeserta mendapatkan list rujukan peserta
func VClaimGetRujukanByPeserta(c *gin.Context) {
	noKartu := c.Param("noKartu")
	asalFaskes := c.DefaultQuery("asalFaskes", "1") // Default Faskes 1

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rujukan, err := client.GetRujukanByPeserta(noKartu, asalFaskes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rujukan})
}

// ==================== SEP ====================

// SEPInput adalah input untuk membuat SEP
type SEPInput struct {
	// Data Pasien
	NoKartu string `json:"no_kartu" binding:"required"`
	NoMR    string `json:"no_mr" binding:"required"`
	NoTelp  string `json:"no_telp"`

	// Link ke SIMRS
	RegistrationID uint `json:"registration_id"` // Optional - untuk link ke registration SIMRS
	VisitID        uint `json:"visit_id"`        // Optional - untuk link ke visit SIMRS (rawat inap)
	PatientID      uint `json:"patient_id" binding:"required"`

	// Data SEP
	TglSEP       string `json:"tgl_sep" binding:"required"`       // yyyy-mm-dd
	JnsPelayanan string `json:"jns_pelayanan" binding:"required"` // 1=Ranap, 2=Rajal

	// Kelas Rawat
	KlsRawatHak     string `json:"kls_rawat_hak" binding:"required"` // 1, 2, 3
	KlsRawatNaik    string `json:"kls_rawat_naik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggung_jawab"`

	// Rujukan - tidak wajib untuk IGD/UGD
	AsalRujukan string `json:"asal_rujukan"` // 1=Faskes1, 2=Faskes2
	NoRujukan   string `json:"no_rujukan"`
	TglRujukan  string `json:"tgl_rujukan"`
	PPKRujukan  string `json:"ppk_rujukan"`

	// Poli & Dokter
	KodePoli string `json:"kode_poli"` // Kosong untuk Ranap
	NamaPoli string `json:"nama_poli"` // Nama poli dari frontend
	PoliEks  string `json:"poli_eks"`  // 0=Tidak, 1=Ya
	KodeDPJP string `json:"kode_dpjp"` // Kosong untuk Ranap
	NamaDPJP string `json:"nama_dpjp"` // Nama dokter dari frontend

	// Diagnosa
	DiagAwal     string `json:"diag_awal" binding:"required"` // Kode ICD-10
	NamaDiagnosa string `json:"nama_diagnosa"`                // Nama diagnosa dari frontend

	// Jaminan
	LakaLantas   string `json:"laka_lantas"` // 0, 1, 2, 3
	NoLP         string `json:"no_lp"`
	TglKejadian  string `json:"tgl_kejadian"`
	KetKejadian  string `json:"ket_kejadian"`
	Suplesi      string `json:"suplesi"` // 0=Tidak, 1=Ya
	NoSEPSuplesi string `json:"no_sep_suplesi"`
	KdPropinsi   string `json:"kd_propinsi"`
	KdKabupaten  string `json:"kd_kabupaten"`
	KdKecamatan  string `json:"kd_kecamatan"`

	// COB & Katarak
	COB     string `json:"cob"`     // 0=Tidak, 1=Ya
	Katarak string `json:"katarak"` // 0=Tidak, 1=Ya

	// Tujuan Kunjungan
	TujuanKunj    string `json:"tujuan_kunj"`    // 0, 1, 2
	FlagProcedure string `json:"flag_procedure"` // 0, 1
	KdPenunjang   string `json:"kd_penunjang"`   // 1-12
	AssesmentPel  string `json:"assesment_pel"`  // 1-5

	// Surat Kontrol
	NoSuratKontrol string `json:"no_surat_kontrol"`

	// Catatan
	Catatan string `json:"catatan"`
}

// VClaimCreateSEP membuat SEP baru
func VClaimCreateSEP(c *gin.Context) {
	var input SEPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek apakah poli IGD/UGD - tidak perlu rujukan
	isIGD := strings.ToUpper(input.KodePoli) == "IGD" || strings.ToUpper(input.KodePoli) == "UGD"

	// Validasi rujukan untuk non-IGD
	if !isIGD {
		if input.NoRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No. Rujukan wajib diisi untuk non-IGD"})
			return
		}
		if input.TglRujukan == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal Rujukan wajib diisi untuk non-IGD"})
			return
		}
		if input.AsalRujukan == "" {
			input.AsalRujukan = "1" // Default faskes 1
		}
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Validasi registration (optional)
	var registration models.Registration
	if input.RegistrationID > 0 {
		if err := database.DB.Preload("Patient").First(&registration, input.RegistrationID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran tidak ditemukan"})
			return
		}
	}

	// Validasi patient
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Cek apakah SEP sudah ada untuk registration ini (jika ada registration)
	var existingSEP models.SEP
	if input.RegistrationID > 0 {
		if err := database.DB.Where("registration_id = ?", input.RegistrationID).First(&existingSEP).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "SEP sudah ada untuk pendaftaran ini",
				"data":  existingSEP,
			})
			return
		}
	}

	// Create VClaim client
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Validasi kode_ppk dari config
	if client.KodePPK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK (Faskes) belum dikonfigurasi. Silakan isi di menu Integrasi > BPJS"})
		return
	}

	// Untuk IGD: auto-fill rujukan fields sesuai format BPJS
	if isIGD {
		input.AsalRujukan = "2"           // Dari RS sendiri (Faskes 2)
		input.TglRujukan = input.TglSEP   // Tanggal rujukan = tanggal SEP
		input.NoRujukan = ""              // Kosong untuk IGD
		input.PPKRujukan = client.KodePPK // PPK rujukan = RS sendiri
	}

	// Set defaults
	if input.LakaLantas == "" {
		input.LakaLantas = "0"
	}
	if input.COB == "" {
		input.COB = "0"
	}
	if input.Katarak == "" {
		input.Katarak = "0"
	}
	if input.TujuanKunj == "" {
		input.TujuanKunj = "0"
	}
	if input.PoliEks == "" {
		input.PoliEks = "0"
	}

	// Jika ada noSuratKontrol (SKDP), ppkRujukan harus sama dengan ppkPelayanan (RS sendiri)
	ppkRujukan := input.PPKRujukan
	if input.NoSuratKontrol != "" {
		ppkRujukan = client.KodePPK
	}

	// Untuk rawat inap (jnsPelayanan = "1"), poliTujuan harus dikosongkan
	poliTujuan := input.KodePoli
	if input.JnsPelayanan == "1" {
		poliTujuan = ""
	}

	// Build SEP request
	sepData := &bpjs.SEPData{
		NoKartu:      input.NoKartu,
		TglSep:       input.TglSEP,
		JnsPelayanan: input.JnsPelayanan,
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     input.KlsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR: input.NoMR,
		Rujukan: bpjs.SEPRujukan{
			AsalRujukan: input.AsalRujukan,
			TglRujukan:  input.TglRujukan,
			NoRujukan:   input.NoRujukan,
			PPKRujukan:  ppkRujukan, // Gunakan ppkRujukan yang sudah diproses
		},
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    poliTujuan, // Kosong untuk rawat inap
			Eksekutif: input.PoliEks,
		},
		Cob: bpjs.SEPCob{
			Cob: input.COB,
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: input.Katarak,
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: input.LakaLantas,
			NoLP:       input.NoLP,
			Penjamin: &bpjs.SEPPenjamin{
				Penjamin:    "0", // Default tidak ada penjamin
				TglKejadian: "",
				Keterangan:  "",
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      "0",
					NoSepSuplesi: "",
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  "",
						KdKabupaten: "",
						KdKecamatan: "",
					},
				},
			},
		},
		TujuanKunj:    input.TujuanKunj,
		FlagProcedure: input.FlagProcedure,
		KdPenunjang:   input.KdPenunjang,
		AssesmentPel:  input.AssesmentPel,
		SKDP: bpjs.SEPSKDP{
			NoSurat:  input.NoSuratKontrol,
			KodeDPJP: input.KodeDPJP,
		},
		DPJPLayan: func() string {
			// Untuk rawat inap, dpjpLayan dikosongkan karena sudah ada di SKDP.kodeDPJP
			if input.JnsPelayanan == "1" {
				return ""
			}
			return input.KodeDPJP
		}(),
		NoTelp: input.NoTelp,
		User:   user.Username,
	}

	// Jika laka lantas, update data penjamin
	if input.LakaLantas != "0" && input.LakaLantas != "" {
		sepData.Jaminan.Penjamin.Penjamin = "1"
		sepData.Jaminan.Penjamin.TglKejadian = input.TglKejadian
		sepData.Jaminan.Penjamin.Keterangan = input.KetKejadian
		if input.Suplesi == "1" {
			sepData.Jaminan.Penjamin.Suplesi.Suplesi = input.Suplesi
			sepData.Jaminan.Penjamin.Suplesi.NoSepSuplesi = input.NoSEPSuplesi
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdPropinsi = input.KdPropinsi
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdKabupaten = input.KdKabupaten
			sepData.Jaminan.Penjamin.Suplesi.LokasiLaka.KdKecamatan = input.KdKecamatan
		}
	}

	// Call VClaim API
	sepResponse, err := client.InsertSEP(sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SEP: " + err.Error()})
		return
	}

	// Get nama diagnosa - prioritas dari input, fallback ke ICD10 database
	var icd10 models.ICD10
	namaDiagnosa := input.NamaDiagnosa
	if namaDiagnosa == "" {
		if err := database.DB.Where("code = ? OR code2 = ?", input.DiagAwal, input.DiagAwal).First(&icd10).Error; err == nil {
			namaDiagnosa = icd10.Display
		}
	}

	// Get nama poli - prioritas dari input, fallback ke mapping
	var poliMapping models.BPJSPoliMapping
	namaPoli := input.NamaPoli
	if namaPoli == "" {
		if err := database.DB.Where("kode_poli_bpjs = ?", input.KodePoli).First(&poliMapping).Error; err == nil {
			namaPoli = poliMapping.NamaPoliBPJS
		}
	}

	// Get nama dokter - prioritas dari input, fallback ke mapping
	var dokterMapping models.BPJSDoctorMapping
	namaDokter := input.NamaDPJP
	if namaDokter == "" {
		if err := database.DB.Where("kode_dokter_bpjs = ?", input.KodeDPJP).First(&dokterMapping).Error; err == nil {
			namaDokter = dokterMapping.NamaDokterBPJS
		}
	}

	// Save SEP to database
	tglLahir := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		tglLahir = patient.TanggalLahir.Format("2006-01-02")
	}

	// Handle nullable registration_id
	var regID *uint
	if input.RegistrationID > 0 {
		regID = &input.RegistrationID
	}

	// Handle nullable visit_id
	var visitID *uint
	if input.VisitID > 0 {
		visitID = &input.VisitID
	}

	sep := models.SEP{
		NoSEP:          sepResponse.Sep.NoSep,
		RegistrationID: regID,
		VisitID:        visitID,
		PatientID:      input.PatientID,
		NoKartu:        input.NoKartu,
		NamaPasien:     patient.NamaLengkap,
		NIK:            patient.NIK,
		TglLahir:       tglLahir,
		JenisKelamin:   string(patient.JenisKelamin),
		TglSEP:         input.TglSEP,
		JnsPelayanan:   input.JnsPelayanan,
		KlsRawatHak:    input.KlsRawatHak,
		KlsRawatNaik:   input.KlsRawatNaik,
		Pembiayaan:     input.Pembiayaan,
		NoMR:           input.NoMR,
		AsalRujukan:    input.AsalRujukan,
		NoRujukan:      input.NoRujukan,
		TglRujukan:     input.TglRujukan,
		PPKRujukan:     ppkRujukan, // Gunakan ppkRujukan yang sudah diproses
		KodePoli:       input.KodePoli,
		NamaPoli:       namaPoli,
		PoliEks:        input.PoliEks,
		KodeDPJP:       input.KodeDPJP,
		NamaDPJP:       namaDokter,
		PPKPelayanan:   client.KodePPK,
		DiagAwal:       input.DiagAwal,
		NamaDiagnosa:   namaDiagnosa,
		LakaLantas:     input.LakaLantas,
		NoLPLaka:       input.NoLP,
		TglKejadian:    input.TglKejadian,
		Keterangan:     input.KetKejadian,
		Suplesi:        input.Suplesi,
		NoSEPSuplesi:   input.NoSEPSuplesi,
		KdPropinsi:     input.KdPropinsi,
		KdKabupaten:    input.KdKabupaten,
		KdKecamatan:    input.KdKecamatan,
		COB:            input.COB,
		Katarak:        input.Katarak,
		TujuanKunj:     input.TujuanKunj,
		FlagProcedure:  input.FlagProcedure,
		KdPenunjang:    input.KdPenunjang,
		AssesmentPel:   input.AssesmentPel,
		NoSuratKontrol: input.NoSuratKontrol,
		Catatan:        input.Catatan,
		NoTelp:         input.NoTelp,
		UserBuat:       user.Username,
		Status:         "active",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SEP: " + err.Error()})
		return
	}

	// Update registration dengan nomor SEP
	database.DB.Model(&registration).Updates(map[string]interface{}{
		"sep_number": sep.NoSEP,
	})

	c.JSON(http.StatusCreated, gin.H{
		"message": "SEP berhasil dibuat",
		"data":    sep,
	})
}

// VClaimGetSEP mendapatkan detail SEP
func VClaimGetSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")

	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	sep, err := client.GetSEP(noSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return langsung GetSEPResponse (struktur lengkap)
	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// SEPImportInput adalah input untuk import SEP dari BPJS ke database lokal
type SEPImportInput struct {
	NoSEP        string `json:"no_sep" binding:"required"`
	NoKartu      string `json:"no_kartu"`
	NamaPasien   string `json:"nama_pasien"`
	NIK          string `json:"nik"`
	TglLahir     string `json:"tgl_lahir"`
	JenisKelamin string `json:"jenis_kelamin"`
	TglSEP       string `json:"tgl_sep"`
	JnsPelayanan string `json:"jns_pelayanan"`
	KlsRawatHak  string `json:"kls_rawat_hak"`
	NoMR         string `json:"no_mr"`
	AsalRujukan  string `json:"asal_rujukan"`
	NoRujukan    string `json:"no_rujukan"`
	TglRujukan   string `json:"tgl_rujukan"`
	PPKRujukan   string `json:"ppk_rujukan"`
	NamaRujukan  string `json:"nama_rujukan"`
	KodePoli     string `json:"kode_poli"`
	NamaPoli     string `json:"nama_poli"`
	KodeDPJP     string `json:"kode_dpjp"`
	NamaDPJP     string `json:"nama_dpjp"`
	PPKPelayanan string `json:"ppk_pelayanan"`
	DiagAwal     string `json:"diag_awal"`
	NamaDiagnosa string `json:"nama_diagnosa"`
	Catatan      string `json:"catatan"`
	PatientID    uint   `json:"patient_id"`
}

// VClaimImportSEP menyimpan data SEP dari BPJS ke database lokal
func VClaimImportSEP(c *gin.Context) {
	var input SEPImportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cek apakah SEP sudah ada
	var existingSEP models.SEP
	if err := database.DB.Where("no_sep = ?", input.NoSEP).First(&existingSEP).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "SEP sudah ada di database",
			"data":  existingSEP,
		})
		return
	}

	// Cari patient berdasarkan no_kartu BPJS
	var patient models.Patient
	patientID := input.PatientID
	if patientID == 0 && input.NoKartu != "" {
		if err := database.DB.Where("no_bpjs = ?", input.NoKartu).First(&patient).Error; err == nil {
			patientID = patient.ID
		}
	}

	// Jika masih tidak ada patient, coba cari by NIK
	if patientID == 0 && input.NIK != "" {
		if err := database.DB.Where("nik = ?", input.NIK).First(&patient).Error; err == nil {
			patientID = patient.ID
		}
	}

	// Buat SEP baru
	sep := models.SEP{
		NoSEP:        input.NoSEP,
		PatientID:    patientID,
		NoKartu:      input.NoKartu,
		NamaPasien:   input.NamaPasien,
		NIK:          input.NIK,
		TglLahir:     input.TglLahir,
		JenisKelamin: input.JenisKelamin,
		TglSEP:       input.TglSEP,
		JnsPelayanan: input.JnsPelayanan,
		KlsRawatHak:  input.KlsRawatHak,
		NoMR:         input.NoMR,
		AsalRujukan:  input.AsalRujukan,
		NoRujukan:    input.NoRujukan,
		TglRujukan:   input.TglRujukan,
		PPKRujukan:   input.PPKRujukan,
		NamaRujukan:  input.NamaRujukan,
		KodePoli:     input.KodePoli,
		NamaPoli:     input.NamaPoli,
		KodeDPJP:     input.KodeDPJP,
		NamaDPJP:     input.NamaDPJP,
		PPKPelayanan: input.PPKPelayanan,
		DiagAwal:     input.DiagAwal,
		NamaDiagnosa: input.NamaDiagnosa,
		Catatan:      input.Catatan,
		Status:       "active",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil disimpan",
		"data":    sep,
	})
}

// SEPUpdateInput adalah input untuk update SEP
type SEPUpdateInput struct {
	NoSep           string `json:"no_sep" binding:"required"`
	KlsRawatHak     string `json:"kls_rawat_hak"`
	KlsRawatNaik    string `json:"kls_rawat_naik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggung_jawab"`
	NoMR            string `json:"no_mr"`
	Catatan         string `json:"catatan"`
	DiagAwal        string `json:"diag_awal"`
	PoliTujuan      string `json:"poli_tujuan"`
	PoliEksekutif   string `json:"poli_eksekutif"`
	Cob             string `json:"cob"`
	Katarak         string `json:"katarak"`
	LakaLantas      string `json:"laka_lantas"`
	TglKejadian     string `json:"tgl_kejadian"`
	Keterangan      string `json:"keterangan"`
	Suplesi         string `json:"suplesi"`
	NoSepSuplesi    string `json:"no_sep_suplesi"`
	KdPropinsi      string `json:"kd_propinsi"`
	KdKabupaten     string `json:"kd_kabupaten"`
	KdKecamatan     string `json:"kd_kecamatan"`
	DpjpLayan       string `json:"dpjp_layan"`
	NoTelp          string `json:"no_telp"`
}

// VClaimUpdateSEP mengupdate SEP di BPJS
func VClaimUpdateSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	var input SEPUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Prepare SEP Data for update
	sepData := &bpjs.SEPData{
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     input.KlsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR:     input.NoMR,
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    input.PoliTujuan,
			Eksekutif: input.PoliEksekutif,
		},
		Cob: bpjs.SEPCob{
			Cob: input.Cob,
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: input.Katarak,
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: input.LakaLantas,
			Penjamin: &bpjs.SEPPenjamin{
				TglKejadian: input.TglKejadian,
				Keterangan:  input.Keterangan,
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      input.Suplesi,
					NoSepSuplesi: input.NoSepSuplesi,
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  input.KdPropinsi,
						KdKabupaten: input.KdKabupaten,
						KdKecamatan: input.KdKecamatan,
					},
				},
			},
		},
		DPJPLayan: input.DpjpLayan,
		NoTelp:    input.NoTelp,
		User:      user.Username,
	}

	// Update to BPJS
	result, err := client.UpdateSEP(noSEP, sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mengupdate SEP: " + err.Error()})
		return
	}

	// Update di database lokal jika ada
	updates := map[string]interface{}{
		"kode_dpjp":     input.DpjpLayan,
		"kode_poli":     input.PoliTujuan,
		"diag_awal":     input.DiagAwal,
		"catatan":       input.Catatan,
		"kls_rawat_hak": input.KlsRawatHak,
	}
	database.DB.Model(&models.SEP{}).Where("no_sep = ?", noSEP).Updates(updates)

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil diupdate",
		"data":    result,
	})
}

// VClaimDeleteSEP menghapus SEP
func VClaimDeleteSEP(c *gin.Context) {
	noSEP := c.Param("noSEP")

	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Delete from BPJS
	if err := client.DeleteSEP(noSEP, user.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menghapus SEP: " + err.Error()})
		return
	}

	// Update status di database
	database.DB.Model(&models.SEP{}).Where("no_sep = ?", noSEP).Update("status", "deleted")

	c.JSON(http.StatusOK, gin.H{"message": "SEP berhasil dihapus"})
}

// ==================== SPRI (Surat Perintah Rawat Inap) ====================

// SPRIInput adalah input untuk membuat SPRI
type SPRIInput struct {
	NoKartu           string `json:"no_kartu" binding:"required"`
	KodeDokter        string `json:"kode_dokter" binding:"required"`
	NamaDokter        string `json:"nama_dokter"`
	PoliKontrol       string `json:"poli_kontrol" binding:"required"`
	NamaPoli          string `json:"nama_poli"`
	TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"` // yyyy-mm-dd
	// Optional - untuk tracking di SIMRS
	VisitID        uint `json:"visit_id"`
	RegistrationID uint `json:"registration_id"`
	SEPID          uint `json:"sep_id"`
}

// VClaimCreateSPRI membuat SPRI (Surat Perintah Rawat Inap) baru
func VClaimCreateSPRI(c *gin.Context) {
	var input SPRIInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Insert SPRI ke BPJS
	result, err := client.InsertSPRI(
		input.NoKartu,
		input.KodeDokter,
		input.PoliKontrol,
		input.TglRencanaKontrol,
		user.Username,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SPRI: " + err.Error()})
		return
	}

	// Get patient ID from visit or registration
	var patientID uint
	if input.VisitID > 0 {
		var visit models.Visit
		if err := database.DB.First(&visit, input.VisitID).Error; err == nil {
			if visit.RegistrationID > 0 {
				var reg models.Registration
				if err := database.DB.First(&reg, visit.RegistrationID).Error; err == nil {
					patientID = reg.PatientID
				}
			}
		}
	} else if input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.First(&reg, input.RegistrationID).Error; err == nil {
			patientID = reg.PatientID
		}
	}

	// Save SPRI to local database
	spri := models.SPRI{
		NoSPRI:            result.NoSPRI,
		NoKartu:           result.NoKartu,
		Nama:              result.Nama,
		Kelamin:           result.Kelamin,
		TglLahir:          result.TglLahir,
		TglRencanaKontrol: result.TglRencanaKontrol,
		KodePoli:          input.PoliKontrol,
		NamaPoli:          input.NamaPoli,
		KodeDokter:        input.KodeDokter,
		NamaDokter:        input.NamaDokter,
		NamaDiagnosa:      result.NamaDiagnosa,
		UserBuat:          user.Username,
		PatientID:         patientID,
		Status:            "active",
	}

	// Set optional foreign keys
	if input.VisitID > 0 {
		spri.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		spri.RegistrationID = &input.RegistrationID
	}
	if input.SEPID > 0 {
		spri.SEPID = &input.SEPID
	}

	// Save to database (ignore error if already exists)
	if err := database.DB.Create(&spri).Error; err != nil {
		// Log but don't fail - SPRI already created in BPJS
		fmt.Printf("Warning: Failed to save SPRI to database: %v\n", err)
	}

	// Update old SEP status to 'pulang' (closed) after successful SPRI creation
	// This deactivates the old SEP so when new SEP for rawat inap is created, it's a fresh one
	if input.SEPID > 0 {
		var oldSEP models.SEP
		if err := database.DB.First(&oldSEP, input.SEPID).Error; err == nil {
			if err := database.DB.Model(&oldSEP).Updates(map[string]interface{}{
				"status": "pulang",
			}).Error; err != nil {
				fmt.Printf("Warning: Failed to update SEP status after SPRI: %v\n", err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil dibuat",
		"data":    result,
		"spri_id": spri.ID,
	})
}

// GetSPRIByVisit mendapatkan SPRI berdasarkan visit ID
func GetSPRIByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		Order("created_at DESC").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": spri})
}

// GetSPRIByRegistration mendapatkan SPRI berdasarkan registration ID
func GetSPRIByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if registrationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").
		Order("created_at DESC").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": spri})
}

// CancelSPRIByVisit membatalkan SPRI berdasarkan visit ID (lokal saja, BPJS tidak punya API delete)
func CancelSPRIByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var spri models.SPRI
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		First(&spri).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SPRI tidak ditemukan"})
		return
	}

	// Update status to cancelled (local only - BPJS doesn't provide delete API)
	spri.Status = "cancelled"
	if err := database.DB.Save(&spri).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan SPRI: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SPRI berhasil dibatalkan (catatan lokal)",
		"data":    spri,
	})
}

// VClaimSearchPoliSPRI mencari poli untuk SPRI (rawat inap)
func VClaimSearchPoliSPRI(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "bed" // Default untuk rawat inap (Bedah, Bed, dll)
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetPoliKontrolSPRI(nama, "1") // 1 = rawat inap
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimSearchDokterSPRI mencari dokter untuk SPRI
func VClaimSearchDokterSPRI(c *gin.Context) {
	kodePoli := c.Query("kode_poli")
	tglPelayanan := c.Query("tgl_pelayanan")

	if kodePoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
		return
	}

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	dokter, err := client.GetDokterSPRI(kodePoli, tglPelayanan)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// ==================== SURAT KONTROL (SKDP Rawat Jalan) ====================

// SuratKontrolInput adalah input untuk membuat surat kontrol
type SuratKontrolInput struct {
	// Data SEP Asal
	NoSEP string `json:"no_sep" binding:"required"`

	// Link ke SIMRS
	RegistrationID uint `json:"registration_id"`
	VisitID        uint `json:"visit_id"`
	PatientID      uint `json:"patient_id" binding:"required"`
	SEPID          uint `json:"sep_id"`

	// Data Rencana Kontrol
	TglRencanaKontrol string `json:"tgl_rencana_kontrol" binding:"required"` // yyyy-mm-dd
	KodePoli          string `json:"kode_poli" binding:"required"`
	NamaPoli          string `json:"nama_poli"`
	KodeDokter        string `json:"kode_dokter" binding:"required"`
	NamaDokter        string `json:"nama_dokter"`

	// Data PRB (Program Rujuk Balik) - Optional
	IsPRB       bool                   `json:"is_prb"`
	KdStatusPRB string                 `json:"kd_status_prb"`
	DataPRB     map[string]interface{} `json:"data_prb"`

	// Version: "v1" atau "v2" (default: v2)
	Version string `json:"version"`
}

// VClaimCreateSuratKontrol membuat surat kontrol baru
func VClaimCreateSuratKontrol(c *gin.Context) {
	var input SuratKontrolInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Validate patient
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Get SEP data untuk ambil no_kartu
	var sep models.SEP
	if input.SEPID > 0 {
		if err := database.DB.First(&sep, input.SEPID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SEP tidak ditemukan"})
			return
		}
	} else if input.NoSEP != "" {
		if err := database.DB.Where("no_sep = ?", input.NoSEP).First(&sep).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SEP tidak ditemukan"})
			return
		}
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Prepare PRB data jika ada
	var formPRB *bpjs.SuratKontrolPRB
	if input.IsPRB && input.KdStatusPRB != "" {
		formPRB = &bpjs.SuratKontrolPRB{
			KdStatusPRB: input.KdStatusPRB,
			Data:        input.DataPRB,
		}
	}

	// Determine version (default: v2)
	version := input.Version
	if version == "" {
		version = "v2"
	}

	// Insert Surat Kontrol ke BPJS
	result, err := client.InsertSuratKontrol(
		input.NoSEP,
		input.KodeDokter,
		input.KodePoli,
		input.TglRencanaKontrol,
		user.Username,
		formPRB,
		version,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat Surat Kontrol: " + err.Error()})
		return
	}

	// Get nama status PRB
	namaStatusPRB := ""
	for _, prb := range models.PRBStatusOptions {
		if prb.Kode == input.KdStatusPRB {
			namaStatusPRB = prb.Nama
			break
		}
	}

	// Convert DataPRB to JSON string
	dataPRBJSON := ""
	if input.DataPRB != nil {
		if jsonBytes, err := json.Marshal(input.DataPRB); err == nil {
			dataPRBJSON = string(jsonBytes)
		}
	}

	// Save to local database
	suratKontrol := models.SuratKontrol{
		NoSuratKontrol:    result.NoSuratKontrol,
		NoSEP:             input.NoSEP,
		NoKartu:           sep.NoKartu,
		Nama:              result.Nama,
		Kelamin:           result.Kelamin,
		TglLahir:          result.TglLahir,
		TglRencanaKontrol: result.TglRencanaKontrol,
		KodePoli:          input.KodePoli,
		NamaPoli:          input.NamaPoli,
		KodeDokter:        input.KodeDokter,
		NamaDokter:        input.NamaDokter,
		NamaDiagnosa:      result.NamaDiagnosa,
		IsPRB:             input.IsPRB,
		KdStatusPRB:       input.KdStatusPRB,
		NamaStatusPRB:     namaStatusPRB,
		DataPRB:           dataPRBJSON,
		UserBuat:          user.Username,
		PatientID:         input.PatientID,
		Status:            "active",
	}

	// Set optional foreign keys
	if input.VisitID > 0 {
		suratKontrol.VisitID = &input.VisitID
	}
	if input.RegistrationID > 0 {
		suratKontrol.RegistrationID = &input.RegistrationID
	}
	if input.SEPID > 0 {
		suratKontrol.SEPID = &input.SEPID
	} else if sep.ID > 0 {
		suratKontrol.SEPID = &sep.ID
	}

	// Save to database
	if err := database.DB.Create(&suratKontrol).Error; err != nil {
		fmt.Printf("Warning: Failed to save Surat Kontrol to database: %v\n", err)
	}

	// NOTE: SEP status should NOT be updated here
	// SEP status will be updated to 'deleted' when disposition is saved (SaveDisposition handler)
	// And reverted to 'active' when disposition is cancelled (CancelDisposition handler)

	c.JSON(http.StatusOK, gin.H{
		"message":          "Surat Kontrol berhasil dibuat",
		"data":             result,
		"surat_kontrol_id": suratKontrol.ID,
	})
}

// GetSuratKontrolByVisit mendapatkan surat kontrol berdasarkan visit ID
func GetSuratKontrolByVisit(c *gin.Context) {
	visitID := c.Param("visitId")
	if visitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID wajib diisi"})
		return
	}

	var suratKontrol models.SuratKontrol
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").
		Order("created_at DESC").
		First(&suratKontrol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": suratKontrol})
}

// GetSuratKontrolByRegistration mendapatkan surat kontrol berdasarkan registration ID
func GetSuratKontrolByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")
	if registrationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registration ID wajib diisi"})
		return
	}

	var suratKontrol models.SuratKontrol
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").
		Order("created_at DESC").
		First(&suratKontrol).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat Kontrol tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": suratKontrol})
}

// GetSuratKontrolList mendapatkan list surat kontrol
func GetSuratKontrolList(c *gin.Context) {
	var suratKontrolList []models.SuratKontrol
	query := database.DB.Preload("Patient").Preload("Visit").Preload("SEP")

	// Filter by patient_id
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}

	// Filter by visit_id
	if visitID := c.Query("visit_id"); visitID != "" {
		query = query.Where("visit_id = ?", visitID)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("status = ?", "active")
	}

	// Limit
	limit := 100
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	query.Order("created_at DESC").Limit(limit).Find(&suratKontrolList)

	c.JSON(http.StatusOK, gin.H{"data": suratKontrolList})
}

// VClaimDeleteSuratKontrol menghapus surat kontrol
func VClaimDeleteSuratKontrol(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")
	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Surat Kontrol wajib diisi"})
		return
	}

	// Get current user
	userID, _ := c.Get("userID")
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Delete from BPJS
	if err := client.DeleteSuratKontrol(noSuratKontrol, user.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal menghapus Surat Kontrol: " + err.Error()})
		return
	}

	// Update status di database
	database.DB.Model(&models.SuratKontrol{}).Where("no_surat_kontrol = ?", noSuratKontrol).Update("status", "cancelled")

	c.JSON(http.StatusOK, gin.H{"message": "Surat Kontrol berhasil dihapus"})
}

// VClaimGetPRBOptions mendapatkan opsi status PRB
func VClaimGetPRBOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": models.PRBStatusOptions})
}

// VClaimSearchPoliSuratKontrol mencari poli untuk surat kontrol (rawat jalan)
func VClaimSearchPoliSuratKontrol(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "umum" // Default untuk rawat jalan
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetReferensiPoli(nama)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimSearchDokterSuratKontrol mencari dokter untuk surat kontrol (rawat jalan)
func VClaimSearchDokterSuratKontrol(c *gin.Context) {
	kodePoli := c.Query("kode_poli")
	tglPelayanan := c.Query("tgl_pelayanan")

	if kodePoli == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode poli wajib diisi"})
		return
	}

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Use jnsPelayanan = 2 for rawat jalan
	dokter, err := client.GetReferensiDokterDPJP("2", tglPelayanan, kodePoli)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// ==================== REFERENSI VCLAIM ====================

// VClaimGetReferensiPoli mendapatkan referensi poli dari VClaim
func VClaimGetReferensiPoli(c *gin.Context) {
	nama := c.Query("nama")
	if nama == "" {
		nama = "umum" // default search
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	poli, err := client.GetReferensiPoli(nama)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": poli})
}

// VClaimGetReferensiDiagnosa mendapatkan referensi diagnosa ICD-10
func VClaimGetReferensiDiagnosa(c *gin.Context) {
	kode := c.Query("kode")
	if kode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode diagnosa wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	diagnosa, err := client.GetReferensiDiagnosa(kode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": diagnosa})
}

// VClaimGetReferensiFaskes mendapatkan referensi faskes
func VClaimGetReferensiFaskes(c *gin.Context) {
	nama := c.Query("nama")
	jenis := c.DefaultQuery("jenis", "1") // 1=Faskes 1, 2=RS

	if nama == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama faskes wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	faskes, err := client.GetReferensiFaskes(nama, jenis)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": faskes})
}

// VClaimGetReferensiDokterDPJP mendapatkan referensi dokter DPJP
func VClaimGetReferensiDokterDPJP(c *gin.Context) {
	jnsPelayanan := c.DefaultQuery("jnsPelayanan", "2") // Default rajal
	tglPelayanan := c.Query("tglPelayanan")
	spesialis := c.Query("spesialis")

	if tglPelayanan == "" {
		tglPelayanan = time.Now().Format("2006-01-02")
	}
	if spesialis == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode spesialis wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	dokter, err := client.GetReferensiDokterDPJP(jnsPelayanan, tglPelayanan, spesialis)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": dokter})
}

// VClaimGetReferensiPropinsi mendapatkan referensi propinsi dari VClaim
func VClaimGetReferensiPropinsi(c *gin.Context) {
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	propinsi, err := client.GetReferensiPropinsi()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": propinsi})
}

// VClaimGetReferensiKabupaten mendapatkan referensi kabupaten berdasarkan kode propinsi
func VClaimGetReferensiKabupaten(c *gin.Context) {
	kdPropinsi := c.Param("kdPropinsi")
	if kdPropinsi == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode propinsi wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	kabupaten, err := client.GetReferensiKabupaten(kdPropinsi)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kabupaten})
}

// VClaimGetReferensiKecamatan mendapatkan referensi kecamatan berdasarkan kode kabupaten
func VClaimGetReferensiKecamatan(c *gin.Context) {
	kdKabupaten := c.Param("kdKabupaten")
	if kdKabupaten == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kabupaten wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	kecamatan, err := client.GetReferensiKecamatan(kdKabupaten)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kecamatan})
}

// ==================== RENCANA KONTROL / SKDP ====================

// VClaimGetRencanaKontrolBySEP mendapatkan data rencana kontrol berdasarkan nomor SEP
func VClaimGetRencanaKontrolBySEP(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	rencanaKontrol, err := client.GetRencanaKontrolBySEP(noSEP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rencanaKontrol})
}

// VClaimGetListRencanaKontrol mendapatkan list rencana kontrol/SPRI berdasarkan nomor kartu
func VClaimGetListRencanaKontrol(c *gin.Context) {
	noKartu := c.Param("noKartu")
	bulan := c.DefaultQuery("bulan", time.Now().Format("01"))
	tahun := c.DefaultQuery("tahun", time.Now().Format("2006"))
	filter := c.DefaultQuery("filter", "2") // 1=Tanggal Rencana Kontrol, 2=Tanggal Entry

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	list, err := client.GetListRencanaKontrolByNoKartu(noKartu, bulan, tahun, filter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// ==================== SEP OPTIONS ====================

// VClaimGetSEPOptions mendapatkan semua pilihan/options untuk form SEP
func VClaimGetSEPOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"jenis_pelayanan":     models.JenisPelayanan,
			"kelas_rawat":         models.KelasRawat,
			"kelas_rawat_naik":    models.KelasRawatNaik,
			"pembiayaan":          models.PembiayaanNaikKelas,
			"asal_rujukan":        models.AsalRujukan,
			"laka_lantas":         models.LakaLantas,
			"tujuan_kunjungan":    models.TujuanKunjungan,
			"flag_procedure":      models.FlagProcedure,
			"kd_penunjang":        models.KdPenunjang,
			"assesment_pelayanan": models.AssesmentPelayanan,
			"ya_tidak":            models.YaTidak,
		},
	})
}

// ==================== SEP LOCAL ====================

// GetSEPByVisit mendapatkan SEP berdasarkan visit_id
func GetSEPByVisit(c *gin.Context) {
	visitID := c.Param("visitId")

	var sep models.SEP
	// Only get active SEP for this visit
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").First(&sep).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan untuk visit ini"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// GetSEPByRegistration mendapatkan SEP berdasarkan registration_id
func GetSEPByRegistration(c *gin.Context) {
	registrationID := c.Param("registrationId")

	var sep models.SEP
	// Only get active SEP for this registration
	if err := database.DB.Where("registration_id = ? AND status = ?", registrationID, "active").First(&sep).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sep})
}

// GetSEPList mendapatkan list SEP dengan filter
func GetSEPList(c *gin.Context) {
	var seps []models.SEP
	query := database.DB.Preload("Patient").Preload("Registration")

	// Filter by patient_id (REQUIRED for security)
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}

	// Filter by registration_id
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Filter by tanggal
	if tglSEP := c.Query("tgl_sep"); tglSEP != "" {
		query = query.Where("tgl_sep = ?", tglSEP)
	}

	// Filter by no_kartu
	if noKartu := c.Query("no_kartu"); noKartu != "" {
		query = query.Where("no_kartu = ?", noKartu)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Limit
	limit := 100
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	query.Order("created_at DESC").Limit(limit).Find(&seps)

	c.JSON(http.StatusOK, gin.H{"data": seps})
}

// UpdateSEPVisitID mengupdate visit_id di SEP lokal (untuk link SEP ke visit rawat inap)
func UpdateSEPVisitID(c *gin.Context) {
	noSEP := c.Param("noSEP")
	if noSEP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor SEP wajib diisi"})
		return
	}

	var input struct {
		VisitID uint `json:"visit_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find SEP
	var sep models.SEP
	if err := database.DB.Where("no_sep = ?", noSEP).First(&sep).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	// Update visit_id
	sep.VisitID = &input.VisitID
	if err := database.DB.Save(&sep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP berhasil diupdate dengan visit_id",
		"data":    sep,
	})
}

// ==================== SURAT KONTROL UNTUK CHECK-IN ====================

// VClaimGetSuratKontrolDetail mendapatkan detail surat kontrol berdasarkan nomor surat
func VClaimGetSuratKontrolDetail(c *gin.Context) {
	noSuratKontrol := c.Param("noSuratKontrol")

	if noSuratKontrol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor surat kontrol wajib diisi"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.GetSuratKontrolDetail(noSuratKontrol)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// VClaimCariSuratKontrolByNoKartu mencari surat kontrol berdasarkan nomor kartu
func VClaimCariSuratKontrolByNoKartu(c *gin.Context) {
	noKartu := c.Param("noKartu")
	bulan := c.Query("bulan")
	tahun := c.Query("tahun")
	filter := c.Query("filter") // 1=Tanggal Rencana Kontrol, 2=Tanggal Entry

	if noKartu == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor kartu wajib diisi"})
		return
	}

	// Default ke bulan dan tahun sekarang
	now := time.Now()
	if bulan == "" {
		bulan = fmt.Sprintf("%02d", now.Month())
	}
	if tahun == "" {
		tahun = fmt.Sprintf("%d", now.Year())
	}
	if filter == "" {
		filter = "1" // Default filter by tanggal rencana kontrol
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	result, err := client.GetListRencanaKontrolByNoKartu(noKartu, bulan, tahun, filter)
	if err != nil {
		// Jika tidak ada data, return empty array
		if strings.Contains(err.Error(), "tidak ditemukan") || strings.Contains(err.Error(), "Data Tidak Ditemukan") {
			c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// VClaimInsertSEPKontrol menerbitkan SEP untuk pasien kontrol menggunakan surat kontrol
func VClaimInsertSEPKontrol(c *gin.Context) {
	var input struct {
		RegistrationID  uint   `json:"registration_id"`
		NoSuratKontrol  string `json:"no_surat_kontrol" binding:"required"`
		NoSEPAsal       string `json:"no_sep_asal" binding:"required"`
		TglSEPAsal      string `json:"tgl_sep_asal" binding:"required"`
		DiagAwal        string `json:"diag_awal" binding:"required"`
		NoTelp          string `json:"no_telp" binding:"required"`
		Catatan         string `json:"catatan"`
		KodeDPJP        string `json:"kode_dokter" binding:"required"`
		KodePoli        string `json:"kode_poli" binding:"required"`
		NoKartu         string `json:"no_kartu" binding:"required"`
		KlsRawatHak     string `json:"kls_rawat_hak"`
		KlsRawatNaik    string `json:"kls_rawat_naik"`
		Pembiayaan      string `json:"pembiayaan"`
		PenanggungJawab string `json:"penanggung_jawab"`
		JnsPelayanan    string `json:"jns_pelayanan"` // Default 2 = Rawat Jalan
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get registration with patient if provided
	var registration *models.Registration
	var patient *models.Patient
	if input.RegistrationID > 0 {
		var reg models.Registration
		if err := database.DB.Preload("Patient").First(&reg, input.RegistrationID).Error; err == nil {
			registration = &reg
			patient = reg.Patient
		}
	}

	// Get current user
	userID := c.GetUint("user_id")
	var user models.User
	database.DB.First(&user, userID)
	userName := user.FullName
	if userName == "" {
		userName = user.Username
	}

	// Create VClaim client
	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	// Validasi kode_ppk dari config
	if client.KodePPK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK (Faskes) belum dikonfigurasi. Silakan isi di menu Integrasi > BPJS"})
		return
	}

	// Set defaults
	tglSEP := time.Now().Format("2006-01-02")
	jnsPelayanan := input.JnsPelayanan
	if jnsPelayanan == "" {
		jnsPelayanan = "2" // Rawat Jalan
	}
	klsRawatHak := input.KlsRawatHak
	if klsRawatHak == "" {
		klsRawatHak = "3" // Default kelas 3
	}

	// Get NoMR from patient if available
	noMR := ""
	if patient != nil {
		noMR = patient.NoRM
	}

	// Build SEP request using existing SEPData structure
	sepData := &bpjs.SEPData{
		NoKartu:      input.NoKartu,
		TglSep:       tglSEP,
		PPKPelayanan: client.KodePPK,
		JnsPelayanan: jnsPelayanan,
		KlsRawat: bpjs.SEPKelasRawat{
			KlsRawatHak:     klsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR: noMR,
		Rujukan: bpjs.SEPRujukan{
			AsalRujukan: "2",              // 2 = Kontrol/internal
			TglRujukan:  input.TglSEPAsal, // Tanggal SEP asal
			NoRujukan:   input.NoSEPAsal,  // Nomor SEP asal (bukan surat kontrol)
			PPKRujukan:  client.KodePPK,   // RS sendiri
		},
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjs.SEPPoli{
			Tujuan:    input.KodePoli,
			Eksekutif: "0",
		},
		Cob: bpjs.SEPCob{
			Cob: "0",
		},
		Katarak: bpjs.SEPKatarak{
			Katarak: "0",
		},
		Jaminan: bpjs.SEPJaminan{
			LakaLantas: "0",
			NoLP:       "",
			Penjamin: &bpjs.SEPPenjamin{
				Penjamin:    "0",
				TglKejadian: "",
				Keterangan:  "",
				Suplesi: &bpjs.SEPSuplesi{
					Suplesi:      "0",
					NoSepSuplesi: "",
					LokasiLaka: &bpjs.SEPLokasiLaka{
						KdPropinsi:  "",
						KdKabupaten: "",
						KdKecamatan: "",
					},
				},
			},
		},
		TujuanKunj:    "0", // Normal
		FlagProcedure: "",
		KdPenunjang:   "",
		AssesmentPel:  "",
		SKDP: bpjs.SEPSKDP{
			NoSurat:  input.NoSuratKontrol,
			KodeDPJP: input.KodeDPJP,
		},
		DPJPLayan: input.KodeDPJP,
		NoTelp:    input.NoTelp,
		User:      userName,
	}

	// Call VClaim API
	sepResponse, err := client.InsertSEP(sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal membuat SEP: " + err.Error()})
		return
	}

	// Save SEP to database
	var registrationID *uint
	var patientID uint
	if registration != nil {
		registrationID = &registration.ID
		patientID = registration.PatientID
	}

	sep := models.SEP{
		NoSEP:          sepResponse.Sep.NoSep,
		RegistrationID: registrationID,
		PatientID:      patientID,
		NoKartu:        input.NoKartu,
		TglSEP:         tglSEP,
		JnsPelayanan:   jnsPelayanan,
		KlsRawatHak:    klsRawatHak,
		KlsRawatNaik:   input.KlsRawatNaik,
		Pembiayaan:     input.Pembiayaan,
		AsalRujukan:    "2",
		NoRujukan:      input.NoSEPAsal,
		TglRujukan:     input.TglSEPAsal,
		PPKRujukan:     client.KodePPK,
		KodePoli:       input.KodePoli,
		KodeDPJP:       input.KodeDPJP,
		PPKPelayanan:   client.KodePPK,
		DiagAwal:       input.DiagAwal,
		NoSuratKontrol: input.NoSuratKontrol,
		Catatan:        input.Catatan,
		NoTelp:         input.NoTelp,
		UserBuat:       userName,
		Status:         "aktif",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		// SEP already created in BPJS but failed to save locally
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "SEP berhasil diterbitkan di BPJS tapi gagal disimpan di database: " + err.Error(),
			"no_sep":   sepResponse.Sep.NoSep,
			"sep_data": sepResponse,
		})
		return
	}

	// Update registration with SEP number if provided
	if registration != nil {
		registration.SEPNumber = sepResponse.Sep.NoSep
		database.DB.Save(registration)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SEP kontrol berhasil diterbitkan",
		"data": gin.H{
			"noSep": sepResponse.Sep.NoSep,
		},
	})
}

// VClaimGetListPersetujuanSEP mendapatkan daftar SEP yang butuh persetujuan
func VClaimGetListPersetujuanSEP(c *gin.Context) {
	bulan := c.Query("bulan")
	tahun := c.Query("tahun")

	if bulan == "" || tahun == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter bulan dan tahun diperlukan"})
		return
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	list, err := client.GetListPersetujuanSEP(bulan, tahun)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil list persetujuan SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// VClaimApprovalSEP mengajukan approval untuk SEP (backdate atau fingerprint)
func VClaimApprovalSEP(c *gin.Context) {
	var input struct {
		NoKartu      string `json:"no_kartu" binding:"required"`
		TglSEP       string `json:"tgl_sep" binding:"required"`
		JnsPelayanan string `json:"jns_pelayanan" binding:"required"` // 1 = Rawat Inap, 2 = Rawat Jalan
		JnsPengajuan string `json:"jns_pengajuan" binding:"required"` // 1 = backdate, 2 = finger print
		Keterangan   string `json:"keterangan" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID := c.GetUint("user_id")
	var user models.User
	database.DB.First(&user, userID)
	userName := user.FullName
	if userName == "" {
		userName = user.Username
	}

	client, err := bpjs.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}

	req := &bpjs.ApprovalSEPRequest{
		NoKartu:      input.NoKartu,
		TglSEP:       input.TglSEP,
		JnsPelayanan: input.JnsPelayanan,
		JnsPengajuan: input.JnsPengajuan,
		Keterangan:   input.Keterangan,
		User:         userName,
	}

	if err := client.ApprovalSEP(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengajukan approval SEP: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Approval SEP berhasil diajukan"})
}
