package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// GetPatients returns all patients with pagination and search
func GetPatients(c *gin.Context) {
	var patients []models.Patient
	var total int64

	// Get pagination params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	status := c.Query("status")
	jaminan := c.Query("jaminan")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.Patient{})

	// Apply search filter
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(nama_lengkap) LIKE ? OR LOWER(no_rm) LIKE ? OR nik LIKE ? OR no_bpjs LIKE ? OR LOWER(no_hp) LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	// Apply status filter
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// Apply jaminan filter
	if jaminan != "" {
		query = query.Where("jenis_jaminan = ?", jaminan)
	}

	// Count total
	query.Count(&total)

	// Get paginated data
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&patients).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch patients"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": patients,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetPatient returns a single patient by ID
func GetPatient(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": patient})
}

// GetPatientByNoRM returns a patient by Medical Record Number
func GetPatientByNoRM(c *gin.Context) {
	noRM := c.Param("no_rm")

	var patient models.Patient
	if err := database.DB.Where("no_rm = ?", noRM).First(&patient).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": patient})
}

// SearchPatients quick search for autocomplete
func SearchPatients(c *gin.Context) {
	query := c.Query("q")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	if query == "" {
		c.JSON(http.StatusOK, gin.H{"data": []models.Patient{}})
		return
	}

	var patients []models.Patient
	searchPattern := "%" + strings.ToLower(query) + "%"

	database.DB.
		Where("LOWER(nama_lengkap) LIKE ? OR no_rm LIKE ? OR nik LIKE ? OR no_bpjs LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern).
		Where("status = ?", models.PatientStatusActive).
		Order("nama_lengkap ASC").
		Limit(limit).
		Find(&patients)

	c.JSON(http.StatusOK, gin.H{"data": patients})
}

// CreatePatient creates a new patient
func CreatePatient(c *gin.Context) {
	var input models.Patient
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if input.NamaLengkap == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama lengkap wajib diisi"})
		return
	}

	// Check for duplicate NIK if provided
	if input.NIK != "" {
		var existing models.Patient
		if err := database.DB.Where("nik = ?", input.NIK).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "NIK sudah terdaftar",
				"existing_patient": gin.H{
					"no_rm": existing.NoRM,
					"nama":  existing.NamaLengkap,
				},
			})
			return
		}
	}

	// Check for duplicate BPJS if provided
	if input.NoBPJS != "" {
		var existing models.Patient
		if err := database.DB.Where("no_bpjs = ?", input.NoBPJS).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Nomor BPJS sudah terdaftar",
				"existing_patient": gin.H{
					"no_rm": existing.NoRM,
					"nama":  existing.NamaLengkap,
				},
			})
			return
		}
	}

	// Get user ID from context
	if userID, exists := c.Get("userID"); exists {
		uid := userID.(uint)
		input.CreatedBy = &uid
	}

	// Set default values
	if input.Status == "" {
		input.Status = models.PatientStatusActive
	}
	if input.JenisJaminan == "" {
		input.JenisJaminan = models.InsuranceTypeUmum
	}
	if input.Kewarganegaraan == "" {
		input.Kewarganegaraan = "WNI"
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create patient: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pasien berhasil didaftarkan",
		"data":    input,
	})
}

// UpdatePatient updates an existing patient
func UpdatePatient(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	var input models.Patient
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate NIK if changed
	if input.NIK != "" && input.NIK != patient.NIK {
		var existing models.Patient
		if err := database.DB.Where("nik = ? AND id != ?", input.NIK, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "NIK sudah terdaftar pada pasien lain",
				"existing_patient": gin.H{
					"no_rm": existing.NoRM,
					"nama":  existing.NamaLengkap,
				},
			})
			return
		}
	}

	// Check for duplicate BPJS if changed
	if input.NoBPJS != "" && input.NoBPJS != patient.NoBPJS {
		var existing models.Patient
		if err := database.DB.Where("no_bpjs = ? AND id != ?", input.NoBPJS, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Nomor BPJS sudah terdaftar pada pasien lain",
				"existing_patient": gin.H{
					"no_rm": existing.NoRM,
					"nama":  existing.NamaLengkap,
				},
			})
			return
		}
	}

	// Keep the original NoRM and registration date
	input.NoRM = patient.NoRM
	input.TanggalRegistrasi = patient.TanggalRegistrasi
	input.CreatedBy = patient.CreatedBy

	// Get user ID from context for updated_by
	if userID, exists := c.Get("userID"); exists {
		uid := userID.(uint)
		input.UpdatedBy = &uid
	}

	if err := database.DB.Model(&patient).Updates(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update patient: " + err.Error()})
		return
	}

	// Reload the patient data
	database.DB.First(&patient, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Data pasien berhasil diperbarui",
		"data":    patient,
	})
}

// DeletePatient soft deletes a patient
func DeletePatient(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	if err := database.DB.Delete(&patient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete patient"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data pasien berhasil dihapus"})
}

// UpdatePatientStatus updates patient status (active/inactive/deceased)
func UpdatePatientStatus(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	var input struct {
		Status        models.PatientStatus `json:"status"`
		CatatanKhusus string               `json:"catatan_khusus"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"status": input.Status,
	}

	if input.CatatanKhusus != "" {
		updates["catatan_khusus"] = input.CatatanKhusus
	}

	if err := database.DB.Model(&patient).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update patient status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status pasien berhasil diperbarui",
		"data":    patient,
	})
}

// UpdatePatientLastVisit updates the last visit date
func UpdatePatientLastVisit(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&patient).Update("tanggal_kunjungan_terakhir", now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update last visit date"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tanggal kunjungan terakhir berhasil diperbarui",
		"data": gin.H{
			"tanggal_kunjungan_terakhir": now,
		},
	})
}

// GetPatientStatuses returns available patient statuses
func GetPatientStatuses(c *gin.Context) {
	statuses := []gin.H{
		{"value": string(models.PatientStatusActive), "label": "Aktif"},
		{"value": string(models.PatientStatusInactive), "label": "Tidak Aktif"},
		{"value": string(models.PatientStatusDeceased), "label": "Meninggal"},
	}
	c.JSON(http.StatusOK, gin.H{"data": statuses})
}

// GetBloodTypes returns available blood types
func GetBloodTypes(c *gin.Context) {
	types := []gin.H{
		{"value": string(models.BloodTypeA), "label": "A"},
		{"value": string(models.BloodTypeB), "label": "B"},
		{"value": string(models.BloodTypeAB), "label": "AB"},
		{"value": string(models.BloodTypeO), "label": "O"},
		{"value": string(models.BloodTypeUnknown), "label": "Tidak Diketahui"},
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetRhesusTypes returns available rhesus types
func GetRhesusTypes(c *gin.Context) {
	types := []gin.H{
		{"value": string(models.RhesusPositive), "label": "Positif (+)"},
		{"value": string(models.RhesusNegative), "label": "Negatif (-)"},
		{"value": string(models.RhesusUnknown), "label": "Tidak Diketahui"},
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetInsuranceTypes returns available insurance types
func GetInsuranceTypes(c *gin.Context) {
	types := []gin.H{
		{"value": string(models.InsuranceTypeUmum), "label": "Umum (Bayar Sendiri)"},
		{"value": string(models.InsuranceTypeBPJS), "label": "BPJS Kesehatan"},
		{"value": string(models.InsuranceTypeJKN), "label": "JKN"},
		{"value": string(models.InsuranceTypeSwasta), "label": "Asuransi Swasta"},
		{"value": string(models.InsuranceTypeLainnya), "label": "Lainnya"},
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetPatientStats returns patient statistics
func GetPatientStats(c *gin.Context) {
	var totalPatients int64
	var activePatients int64
	var bpjsPatients int64
	var newPatientsToday int64

	database.DB.Model(&models.Patient{}).Count(&totalPatients)
	database.DB.Model(&models.Patient{}).Where("status = ?", models.PatientStatusActive).Count(&activePatients)
	database.DB.Model(&models.Patient{}).Where("jenis_jaminan = ?", models.InsuranceTypeBPJS).Count(&bpjsPatients)

	today := time.Now().Format("2006-01-02")
	database.DB.Model(&models.Patient{}).Where("DATE(created_at) = ?", today).Count(&newPatientsToday)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"total_patients":     totalPatients,
			"active_patients":    activePatients,
			"bpjs_patients":      bpjsPatients,
			"new_patients_today": newPatientsToday,
		},
	})
}

// UploadPatientPhoto handles patient photo upload
func UploadPatientPhoto(c *gin.Context) {
	id := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	file, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Generate filename
	filename := "patient_" + patient.NoRM + "_" + time.Now().Format("20060102150405") + ".jpg"
	filepath := "uploads/patients/" + filename

	// Save file
	if err := c.SaveUploadedFile(file, filepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Update patient photo path
	database.DB.Model(&patient).Update("foto", filepath)

	c.JSON(http.StatusOK, gin.H{
		"message": "Foto berhasil diupload",
		"data": gin.H{
			"foto": filepath,
		},
	})
}
