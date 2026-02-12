package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Patient Portal JWT Secret (separate from staff auth)
var patientPortalSecret = []byte("patient-portal-secret-key-change-in-production")

// PatientPortalClaims for patient JWT
type PatientPortalClaims struct {
	PatientID   uint   `json:"patient_id"`
	NoRM        string `json:"no_rm"`
	NamaLengkap string `json:"nama_lengkap"`
	jwt.RegisteredClaims
}

// PatientLoginRequest untuk validasi pasien
type PatientLoginRequest struct {
	NoRM         string `json:"no_rm" binding:"required"`
	NIK          string `json:"nik" binding:"required"`
	TanggalLahir string `json:"tanggal_lahir" binding:"required"` // format: yyyy-mm-dd
}

// PatientLoginResponse response setelah login berhasil
type PatientLoginResponse struct {
	Token   string               `json:"token"`
	Patient PatientPortalProfile `json:"patient"`
}

// PatientPortalProfile profil pasien untuk portal
type PatientPortalProfile struct {
	ID                 uint   `json:"id"`
	NoRM               string `json:"no_rm"`
	NamaLengkap        string `json:"nama_lengkap"`
	NIK                string `json:"nik"`
	JenisKelamin       string `json:"jenis_kelamin"`
	TempatLahir        string `json:"tempat_lahir"`
	TanggalLahir       string `json:"tanggal_lahir"`
	Alamat             string `json:"alamat"`
	NoTelepon          string `json:"no_telepon"`
	NoHP               string `json:"no_hp,omitempty"`
	Email              string `json:"email,omitempty"`
	GolonganDarah      string `json:"golongan_darah"`
	Rhesus             string `json:"rhesus,omitempty"`
	Agama              string `json:"agama"`
	Pekerjaan          string `json:"pekerjaan"`
	StatusPerkawinan   string `json:"status_perkawinan"`
	PendidikanTerakhir string `json:"pendidikan_terakhir,omitempty"`

	// Alamat lengkap
	AlamatKTP    string `json:"alamat_ktp,omitempty"`
	RTKTP        string `json:"rt_ktp,omitempty"`
	RWKTP        string `json:"rw_ktp,omitempty"`
	KelurahanKTP string `json:"kelurahan_ktp,omitempty"`
	KecamatanKTP string `json:"kecamatan_ktp,omitempty"`
	KotaKTP      string `json:"kota_ktp,omitempty"`
	ProvinsiKTP  string `json:"provinsi_ktp,omitempty"`

	// Penanggung Jawab
	NamaPenanggungJawab     string `json:"nama_penanggung_jawab,omitempty"`
	HubunganPenanggungJawab string `json:"hubungan_penanggung_jawab,omitempty"`
	TeleponPenanggungJawab  string `json:"telepon_penanggung_jawab,omitempty"`

	// Jaminan Kesehatan
	JenisJaminan   string `json:"jenis_jaminan,omitempty"`
	NoBPJS         string `json:"no_bpjs,omitempty"`
	KelasBPJS      string `json:"kelas_bpjs,omitempty"`
	FaskesTingkat1 string `json:"faskes_tingkat_1,omitempty"`

	PhotoURL          string     `json:"photo_url,omitempty"`
	TotalKunjungan    int64      `json:"total_kunjungan"`
	KunjunganTerakhir *time.Time `json:"kunjungan_terakhir,omitempty"`
}

// VisitHistoryItem riwayat kunjungan
type VisitHistoryItem struct {
	ID               uint      `json:"id"`
	VisitNumber      string    `json:"visit_number"`
	TanggalKunjungan time.Time `json:"tanggal_kunjungan"`
	NamaPoli         string    `json:"nama_poli"`
	NamaDokter       string    `json:"nama_dokter"`
	JenisKunjungan   string    `json:"jenis_kunjungan"`
	Keluhan          string    `json:"keluhan"`
	Diagnosa         string    `json:"diagnosa,omitempty"`
	Status           string    `json:"status"`
	HasResume        bool      `json:"has_resume"`
}

// MedicalResumeResponse resume medis lengkap
type MedicalResumeResponse struct {
	Visit        VisitDetailResponse     `json:"visit"`
	Patient      PatientPortalProfile    `json:"patient"`
	VitalSigns   []VitalSignResponse     `json:"vital_signs"`
	Diagnoses    []DiagnosisResponse     `json:"diagnoses"`
	Procedures   []ProcedureItemResponse `json:"procedures"`
	Medications  []MedicationResponse    `json:"medications"`
	LabResults   []LabResultResponse     `json:"lab_results,omitempty"`
	DoctorNotes  string                  `json:"doctor_notes"`
	FollowUpPlan string                  `json:"follow_up_plan,omitempty"`
}

// VisitDetailResponse detail kunjungan
type VisitDetailResponse struct {
	ID               uint       `json:"id"`
	VisitNumber      string     `json:"visit_number"`
	TanggalKunjungan time.Time  `json:"tanggal_kunjungan"`
	WaktuMulai       *time.Time `json:"waktu_mulai,omitempty"`
	WaktuSelesai     *time.Time `json:"waktu_selesai,omitempty"`
	NamaPoli         string     `json:"nama_poli"`
	NamaDokter       string     `json:"nama_dokter"`
	JenisKunjungan   string     `json:"jenis_kunjungan"`
	JenisPelayanan   string     `json:"jenis_pelayanan"` // Rawat Jalan/Rawat Inap/IGD
	Keluhan          string     `json:"keluhan"`
	Status           string     `json:"status"`
}

// VitalSignResponse tanda vital
type VitalSignResponse struct {
	Nama   string `json:"nama"`
	Nilai  string `json:"nilai"`
	Satuan string `json:"satuan"`
}

// DiagnosisResponse diagnosa
type DiagnosisResponse struct {
	KodeICD10 string `json:"kode_icd10"`
	Nama      string `json:"nama"`
	Tipe      string `json:"tipe"` // primary/secondary
}

// ProcedureItemResponse tindakan
type ProcedureItemResponse struct {
	KodeICD9 string `json:"kode_icd9,omitempty"`
	Nama     string `json:"nama"`
	Tanggal  string `json:"tanggal"`
	Dokter   string `json:"dokter"`
}

// MedicationResponse obat
type MedicationResponse struct {
	NamaObat  string `json:"nama_obat"`
	Dosis     string `json:"dosis"`
	Frekuensi string `json:"frekuensi"`
	Durasi    string `json:"durasi"`
	Catatan   string `json:"catatan,omitempty"`
}

// LabResultResponse hasil lab
type LabResultResponse struct {
	NamaPemeriksaan string `json:"nama_pemeriksaan"`
	Hasil           string `json:"hasil"`
	Satuan          string `json:"satuan"`
	NilaiNormal     string `json:"nilai_normal"`
	Status          string `json:"status"` // normal/abnormal
}

// GeneratePatientToken generates JWT for patient portal
func GeneratePatientToken(patient *models.Patient) (string, error) {
	claims := PatientPortalClaims{
		PatientID:   patient.ID,
		NoRM:        patient.NoRM,
		NamaLengkap: patient.NamaLengkap,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "patient-portal",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(patientPortalSecret)
}

// PatientPortalAuthMiddleware middleware untuk autentikasi patient portal
// Supports both Authorization header (Bearer token) and query parameter (?token=xxx) for print/download
func PatientPortalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First check Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Format token tidak valid"})
				c.Abort()
				return
			}
		}

		// Fallback to query parameter (for print/download URLs)
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak ditemukan"})
			c.Abort()
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &PatientPortalClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return patientPortalSecret, nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*PatientPortalClaims); ok && token.Valid {
			c.Set("patientID", claims.PatientID)
			c.Set("patientNoRM", claims.NoRM)
			c.Set("patientName", claims.NamaLengkap)
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			c.Abort()
		}
	}
}

// PatientPortalLogin handles patient login
func PatientPortalLogin(c *gin.Context) {
	var req PatientLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data tidak lengkap: " + err.Error()})
		return
	}

	// Parse tanggal lahir
	tanggalLahir, err := ParseLocalDate(req.TanggalLahir)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal lahir tidak valid (gunakan yyyy-mm-dd)"})
		return
	}

	// Cari pasien berdasarkan NoRM, NIK, dan Tanggal Lahir
	var patient models.Patient
	query := database.DB.Where("no_rm = ?", req.NoRM)

	// NIK bisa kosong untuk pasien lama, tapi kalau diisi harus cocok
	if req.NIK != "" {
		query = query.Where("nik = ?", req.NIK)
	}

	if err := query.First(&patient).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Data pasien tidak ditemukan. Pastikan No. RM dan NIK benar."})
		return
	}

	// Validasi tanggal lahir
	if patient.TanggalLahir == nil || !sameDate(patient.TanggalLahir.Time, tanggalLahir) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tanggal lahir tidak sesuai"})
		return
	}

	// Generate token
	token, err := GeneratePatientToken(&patient)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token"})
		return
	}

	// Get total visits
	var totalVisits int64
	database.DB.Model(&models.Visit{}).
		Joins("JOIN registrations ON registrations.id = visits.registration_id").
		Where("registrations.patient_id = ?", patient.ID).
		Count(&totalVisits)

	// Get last visit
	var lastVisit models.Visit
	var lastVisitTime *time.Time
	if err := database.DB.Model(&models.Visit{}).
		Joins("JOIN registrations ON registrations.id = visits.registration_id").
		Where("registrations.patient_id = ?", patient.ID).
		Order("visits.created_at DESC").
		First(&lastVisit).Error; err == nil {
		lastVisitTime = &lastVisit.CreatedAt
	}

	// Build profile
	profile := buildPatientProfile(&patient, totalVisits, lastVisitTime)

	c.JSON(http.StatusOK, PatientLoginResponse{
		Token:   token,
		Patient: profile,
	})
}

// PatientPortalGetProfile gets patient profile
func PatientPortalGetProfile(c *gin.Context) {
	patientID, exists := c.Get("patientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var patient models.Patient
	if err := database.DB.First(&patient, patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Get total visits
	var totalVisits int64
	database.DB.Model(&models.Visit{}).
		Joins("JOIN registrations ON registrations.id = visits.registration_id").
		Where("registrations.patient_id = ?", patient.ID).
		Count(&totalVisits)

	// Get last visit
	var lastVisit models.Visit
	var lastVisitTime *time.Time
	if err := database.DB.Model(&models.Visit{}).
		Joins("JOIN registrations ON registrations.id = visits.registration_id").
		Where("registrations.patient_id = ?", patient.ID).
		Order("visits.created_at DESC").
		First(&lastVisit).Error; err == nil {
		lastVisitTime = &lastVisit.CreatedAt
	}

	profile := buildPatientProfile(&patient, totalVisits, lastVisitTime)
	c.JSON(http.StatusOK, profile)
}

// PatientPortalGetVisitHistory gets visit history for patient
func PatientPortalGetVisitHistory(c *gin.Context) {
	patientID, exists := c.Get("patientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var visits []models.Visit
	if err := database.DB.
		Preload("Room").
		Preload("Doctor").
		Preload("Registration").
		Joins("JOIN registrations ON registrations.id = visits.registration_id").
		Where("registrations.patient_id = ?", patientID).
		Order("visits.created_at DESC").
		Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil riwayat kunjungan"})
		return
	}

	var history []VisitHistoryItem
	for _, v := range visits {
		item := VisitHistoryItem{
			ID:               v.ID,
			VisitNumber:      v.VisitNumber,
			TanggalKunjungan: v.CreatedAt,
			Keluhan:          v.Complaint,
			Diagnosa:         v.Diagnosis,
			Status:           translateStatus(v.Status),
			JenisKunjungan:   translateVisitType(v.VisitType),
			HasResume:        v.Status == "completed",
		}

		if v.Room != nil {
			item.NamaPoli = v.Room.Name
		}
		if v.Doctor != nil {
			item.NamaDokter = v.Doctor.NamaLengkap
		}

		history = append(history, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"visits": history,
		"total":  len(history),
	})
}

// PatientPortalGetMedicalResume gets medical resume for a specific visit
func PatientPortalGetMedicalResume(c *gin.Context) {
	patientID, exists := c.Get("patientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	visitID := c.Param("visitId")

	// Get visit with all related data
	var visit models.Visit
	if err := database.DB.
		Preload("Room").
		Preload("Doctor").
		Preload("Registration").
		Preload("Registration.Patient").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Verify this visit belongs to the patient
	if visit.Registration == nil || visit.Registration.PatientID != patientID.(uint) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses ke rekam medis ini"})
		return
	}

	// Build response
	response := MedicalResumeResponse{
		Visit: VisitDetailResponse{
			ID:               visit.ID,
			VisitNumber:      visit.VisitNumber,
			TanggalKunjungan: visit.CreatedAt,
			WaktuMulai:       visit.StartTime,
			WaktuSelesai:     visit.EndTime,
			Keluhan:          visit.Complaint,
			Status:           translateStatus(visit.Status),
			JenisKunjungan:   translateVisitType(visit.VisitType),
			JenisPelayanan:   getServiceType(visit.VisitType),
		},
		DoctorNotes: visit.Notes,
	}

	if visit.Room != nil {
		response.Visit.NamaPoli = visit.Room.Name
	}
	if visit.Doctor != nil {
		response.Visit.NamaDokter = visit.Doctor.NamaLengkap
	}

	// Get patient profile
	if visit.Registration != nil && visit.Registration.Patient != nil {
		response.Patient = buildPatientProfile(visit.Registration.Patient, 0, nil)
	}

	// Get vital signs
	var vitalSigns []models.VitalSign
	if err := database.DB.Where("visit_id = ?", visit.ID).Find(&vitalSigns).Error; err == nil {
		for _, vs := range vitalSigns {
			if vs.Systolic > 0 && vs.Diastolic > 0 {
				response.VitalSigns = append(response.VitalSigns, VitalSignResponse{
					Nama:   "Tekanan Darah",
					Nilai:  fmt.Sprintf("%d/%d", vs.Systolic, vs.Diastolic),
					Satuan: "mmHg",
				})
			}
			if vs.HeartRate > 0 {
				response.VitalSigns = append(response.VitalSigns, VitalSignResponse{
					Nama:   "Denyut Nadi",
					Nilai:  fmt.Sprintf("%d", vs.HeartRate),
					Satuan: "x/menit",
				})
			}
			if vs.Temperature != "" {
				response.VitalSigns = append(response.VitalSigns, VitalSignResponse{
					Nama:   "Suhu Tubuh",
					Nilai:  vs.Temperature,
					Satuan: "°C",
				})
			}
			if vs.RespiratoryRate > 0 {
				response.VitalSigns = append(response.VitalSigns, VitalSignResponse{
					Nama:   "Respirasi",
					Nilai:  fmt.Sprintf("%d", vs.RespiratoryRate),
					Satuan: "x/menit",
				})
			}
			if vs.OxygenSaturation > 0 {
				response.VitalSigns = append(response.VitalSigns, VitalSignResponse{
					Nama:   "Saturasi O2",
					Nilai:  fmt.Sprintf("%d", vs.OxygenSaturation),
					Satuan: "%",
				})
			}
		}
	}

	// Get diagnoses
	var diagnoses []models.Diagnosis
	if err := database.DB.Where("visit_id = ?", visit.ID).Order("type ASC, created_at ASC").Find(&diagnoses).Error; err == nil {
		for _, d := range diagnoses {
			diagResp := DiagnosisResponse{
				KodeICD10: d.ICD10Code,
				Nama:      d.ICD10Name,
				Tipe:      translateDiagnosisType(d.Type),
			}
			response.Diagnoses = append(response.Diagnoses, diagResp)
		}
	}

	// Get procedures
	var procedureOrders []models.ProcedureOrder
	if err := database.DB.Preload("Items.Procedure").Preload("OrderedBy").Where("source_visit_id = ?", visit.ID).Find(&procedureOrders).Error; err == nil {
		for _, po := range procedureOrders {
			for _, item := range po.Items {
				procResp := ProcedureItemResponse{
					Tanggal: po.CreatedAt.Format("02-01-2006"),
				}
				if item.Procedure != nil {
					procResp.Nama = item.Procedure.Name
					procResp.KodeICD9 = item.Procedure.ICD9CMCode
				}
				if po.OrderedBy != nil {
					procResp.Dokter = po.OrderedBy.NamaLengkap
				}
				response.Procedures = append(response.Procedures, procResp)
			}
		}
	}

	// Get medications
	var medicineOrders []models.MedicineOrder
	if err := database.DB.Preload("Items.Medicine").Where("source_visit_id = ?", visit.ID).Find(&medicineOrders).Error; err == nil {
		for _, mo := range medicineOrders {
			for _, item := range mo.Items {
				medResp := MedicationResponse{
					Dosis:     item.Dosage,
					Frekuensi: item.Frequency,
					Durasi:    item.Duration,
					Catatan:   item.Instructions,
				}
				if item.Medicine != nil {
					medResp.NamaObat = item.Medicine.Name
				}
				response.Medications = append(response.Medications, medResp)
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

// PatientPortalGetAllergies gets patient allergies
func PatientPortalGetAllergies(c *gin.Context) {
	patientID, exists := c.Get("patientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var allergies []models.PatientAllergy
	if err := database.DB.Where("patient_id = ?", patientID).Find(&allergies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data alergi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"allergies": allergies})
}

// Helper functions

func sameDate(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}

func buildPatientProfile(patient *models.Patient, totalVisits int64, lastVisit *time.Time) PatientPortalProfile {
	// Use NoHP if NoTelepon is empty
	noTelepon := patient.NoTelepon
	if noTelepon == "" {
		noTelepon = patient.NoHP
	}

	profile := PatientPortalProfile{
		ID:                 patient.ID,
		NoRM:               patient.NoRM,
		NamaLengkap:        patient.NamaLengkap,
		NIK:                patient.NIK,
		JenisKelamin:       string(patient.JenisKelamin),
		TempatLahir:        patient.TempatLahir,
		Alamat:             patient.AlamatKTP,
		NoTelepon:          noTelepon,
		NoHP:               patient.NoHP,
		Email:              patient.Email,
		GolonganDarah:      string(patient.GolonganDarah),
		Rhesus:             string(patient.Rhesus),
		Agama:              patient.Agama,
		Pekerjaan:          patient.Pekerjaan,
		StatusPerkawinan:   patient.StatusPerkawinan,
		PendidikanTerakhir: patient.PendidikanTerakhir,

		// Alamat lengkap
		AlamatKTP:    patient.AlamatKTP,
		RTKTP:        patient.RTKTP,
		RWKTP:        patient.RWKTP,
		KelurahanKTP: patient.KelurahanKTP,
		KecamatanKTP: patient.KecamatanKTP,
		KotaKTP:      patient.KotaKTP,
		ProvinsiKTP:  patient.ProvinsiKTP,

		// Penanggung Jawab
		NamaPenanggungJawab:     patient.NamaPenanggungJawab,
		HubunganPenanggungJawab: patient.HubunganPenanggungJawab,
		TeleponPenanggungJawab:  patient.TeleponPenanggungJawab,

		// Jaminan Kesehatan
		JenisJaminan:   string(patient.JenisJaminan),
		NoBPJS:         patient.NoBPJS,
		KelasBPJS:      patient.KelasBPJS,
		FaskesTingkat1: patient.FaskesTingkat1,

		PhotoURL:          patient.Foto,
		TotalKunjungan:    totalVisits,
		KunjunganTerakhir: lastVisit,
	}

	if patient.TanggalLahir != nil {
		profile.TanggalLahir = patient.TanggalLahir.Format("2006-01-02")
	}

	return profile
}

func translateStatus(status string) string {
	switch status {
	case "waiting":
		return "Menunggu"
	case "in_queue":
		return "Dalam Antrian"
	case "in_progress":
		return "Sedang Dilayani"
	case "completed":
		return "Selesai"
	case "cancelled":
		return "Dibatalkan"
	default:
		return status
	}
}

func translateVisitType(visitType string) string {
	switch visitType {
	case "consultation":
		return "Konsultasi"
	case "procedure":
		return "Tindakan"
	case "lab":
		return "Laboratorium"
	case "radiology":
		return "Radiologi"
	case "pharmacy":
		return "Farmasi"
	case "inpatient":
		return "Rawat Inap"
	case "outpatient":
		return "Rawat Jalan"
	case "emergency":
		return "IGD"
	case "surgery":
		return "Operasi"
	default:
		return visitType
	}
}

func translateDiagnosisType(diagType string) string {
	switch diagType {
	case "primary":
		return "Diagnosis Utama"
	case "secondary":
		return "Diagnosis Sekunder"
	default:
		return diagType
	}
}

func getServiceType(visitType string) string {
	switch visitType {
	case "inpatient":
		return "Rawat Inap"
	case "emergency":
		return "IGD"
	default:
		return "Rawat Jalan"
	}
}

// ===================================================================
// PATIENT PORTAL PRINT HANDLERS
// These wrap the standard print handlers after validating patient ownership
// ===================================================================

// validatePatientOwnsVisit checks if the authenticated patient owns the visit
func validatePatientOwnsVisit(c *gin.Context, visitID string) (*models.Visit, error) {
	patientIDVal, exists := c.Get("patientID")
	if !exists {
		return nil, fmt.Errorf("unauthorized: patient ID not found")
	}
	patientID, ok := patientIDVal.(uint)
	if !ok || patientID == 0 {
		return nil, fmt.Errorf("unauthorized: invalid patient ID")
	}

	var visit models.Visit
	if err := database.DB.
		Preload("Registration").
		First(&visit, visitID).Error; err != nil {
		return nil, fmt.Errorf("visit not found")
	}

	if visit.Registration == nil || visit.Registration.PatientID != patientID {
		return nil, fmt.Errorf("unauthorized: this visit does not belong to you")
	}

	return &visit, nil
}

// PatientPortalPrintOutpatientResume prints outpatient resume after validating ownership
func PatientPortalPrintOutpatientResume(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Call original print handler
	PrintOutpatientResume(c)
}

// PatientPortalPrintInpatientResume prints inpatient resume after validating ownership
func PatientPortalPrintInpatientResume(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Call original print handler
	PrintInpatientResume(c)
}

// PatientPortalPrintEmergencySummary prints emergency summary after validating ownership
func PatientPortalPrintEmergencySummary(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Call original print handler
	PrintEmergencySummary(c)
}

// validatePatientOwnsOrder checks if the authenticated patient owns the procedure order
func validatePatientOwnsOrder(c *gin.Context, orderID string) error {
	patientIDVal, exists := c.Get("patientID")
	if !exists {
		return fmt.Errorf("unauthorized: patient ID not found")
	}
	patientID, ok := patientIDVal.(uint)
	if !ok || patientID == 0 {
		return fmt.Errorf("unauthorized: invalid patient ID")
	}

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("Registration").
		First(&order, orderID).Error; err != nil {
		return fmt.Errorf("order not found")
	}

	if order.Registration == nil || order.Registration.PatientID != patientID {
		return fmt.Errorf("unauthorized: this order does not belong to you")
	}

	return nil
}

// PatientPortalPrintLabResult prints lab result after validating ownership
func PatientPortalPrintLabResult(c *gin.Context) {
	orderID := c.Param("orderId")

	if err := validatePatientOwnsOrder(c, orderID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Call original print handler (uses orderId param)
	PrintLabResult(c)
}

// PatientPortalPrintRadiologyResult prints radiology result after validating ownership
func PatientPortalPrintRadiologyResult(c *gin.Context) {
	orderID := c.Param("orderId")

	if err := validatePatientOwnsOrder(c, orderID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// PrintRadiologyResult uses c.Param("id") but our route uses orderId
	// Set the param manually
	c.Params = append(c.Params, gin.Param{Key: "id", Value: orderID})
	PrintRadiologyResult(c)
}

// PatientPortalPrintCPPT prints CPPT after validating ownership
func PatientPortalPrintCPPT(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintCPPT(c)
}

// PatientPortalPrintPrescription prints prescription after validating ownership
func PatientPortalPrintPrescription(c *gin.Context) {
	orderID := c.Param("orderId")

	if err := validatePatientOwnsMedicineOrder(c, orderID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintPrescription(c)
}

// validatePatientOwnsMedicineOrder checks if the authenticated patient owns the medicine order
func validatePatientOwnsMedicineOrder(c *gin.Context, orderID string) error {
	patientIDVal, exists := c.Get("patientID")
	if !exists {
		return fmt.Errorf("unauthorized: patient ID not found")
	}
	patientID, ok := patientIDVal.(uint)
	if !ok || patientID == 0 {
		return fmt.Errorf("unauthorized: invalid patient ID")
	}

	var order models.MedicineOrder
	if err := database.DB.
		Preload("Registration").
		First(&order, orderID).Error; err != nil {
		return fmt.Errorf("order not found")
	}

	if order.Registration == nil || order.Registration.PatientID != patientID {
		return fmt.Errorf("unauthorized: this order does not belong to you")
	}

	return nil
}

// PatientPortalPrintSickLetter prints sick letter after validating ownership
func PatientPortalPrintSickLetter(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintSickLetter(c)
}

// PatientPortalPrintReferralLetter prints referral letter after validating ownership
func PatientPortalPrintReferralLetter(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintReferralLetter(c)
}

// PatientPortalPrintInpatientCertificate prints inpatient certificate after validating ownership
func PatientPortalPrintInpatientCertificate(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintInpatientCertificate(c)
}

// PatientPortalPrintTriageForm prints triage form after validating ownership
func PatientPortalPrintTriageForm(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	PrintTriageForm(c)
}

// PatientPortalGetAvailableDocs returns which document types have data for a given visit
// GET /api/patient-portal/available-docs/:visitId
// Uses SAME logic as GetAvailableDocs in print_pdf.go
func PatientPortalGetAvailableDocs(c *gin.Context) {
	visitID := c.Param("visitId")

	if _, err := validatePatientOwnsVisit(c, visitID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	docs := []string{}

	// Check if this is a support service visit (order-based, not clinical)
	isLabVisit := visit.VisitType == "lab"
	isRadiologyVisit := visit.VisitType == "radiology"
	isPharmacyVisit := visit.VisitType == "pharmacy"

	if isLabVisit || isRadiologyVisit {
		// For lab/radiology visits, find the procedure order
		var procedureOrder models.ProcedureOrder
		if err := database.DB.Where("target_visit_id = ?", visitID).First(&procedureOrder).Error; err == nil {
			// Check if order is completed and has results
			if procedureOrder.Status == "completed" {
				if isLabVisit {
					// Return order ID for lab result
					docs = append(docs, fmt.Sprintf("lab_result:%d", procedureOrder.ID))
				} else {
					// Return order ID for radiology result
					docs = append(docs, fmt.Sprintf("radiology_result:%d", procedureOrder.ID))
				}
			}
		}
		// Lab/radiology visits don't have resume, cppt, etc.
		c.JSON(http.StatusOK, gin.H{"available_docs": docs})
		return
	}

	if isPharmacyVisit {
		// For pharmacy visits, check if there's medicine order with pharmacy_visit_id
		var medicineOrder models.MedicineOrder
		if err := database.DB.Where("pharmacy_visit_id = ?", visitID).First(&medicineOrder).Error; err == nil {
			docs = append(docs, fmt.Sprintf("prescription:%d", medicineOrder.ID))
		}
		// Pharmacy visits don't have resume, cppt, etc.
		c.JSON(http.StatusOK, gin.H{"available_docs": docs})
		return
	}

	// For clinical visits (outpatient, inpatient, emergency), add resume
	docs = append(docs, "resume")

	// Triage (UGD) - check if triage exists for this visit
	var triageCount int64
	database.DB.Model(&models.Triage{}).Where("visit_id = ?", visitID).Count(&triageCount)
	if triageCount > 0 {
		docs = append(docs, "triage")
		docs = append(docs, "emergency_summary")
	}

	// CPPT
	var cpptCount int64
	database.DB.Model(&models.CPPT{}).Where("visit_id = ?", visitID).Count(&cpptCount)
	if cpptCount > 0 {
		docs = append(docs, "cppt")
	}

	// Prescriptions (check medicine orders by source_visit_id)
	var medicineOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ?", visitID).Find(&medicineOrders)
	for _, order := range medicineOrders {
		docs = append(docs, fmt.Sprintf("prescription:%d", order.ID))
	}

	// Sick Letter
	var sickLetterCount int64
	database.DB.Model(&models.SickLetter{}).Where("visit_id = ?", visitID).Count(&sickLetterCount)
	if sickLetterCount > 0 {
		docs = append(docs, "sick_letter")
	}

	// Referral Letter (disposition type = rujuk)
	var referralCount int64
	database.DB.Model(&models.Disposition{}).Where("visit_id = ? AND disposition_type = ?", visitID, "rujuk").Count(&referralCount)
	if referralCount > 0 {
		docs = append(docs, "referral_letter")
	}

	// Inpatient Certificate (has admission_time)
	if visit.AdmissionTime != nil {
		docs = append(docs, "inpatient_certificate")
	}

	c.JSON(http.StatusOK, gin.H{"available_docs": docs})
}
