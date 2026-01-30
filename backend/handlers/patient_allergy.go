package handlers

import (
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// Patient Allergy Handlers
// ============================================================================

// GetPatientAllergies returns all allergies for a patient
func GetPatientAllergies(c *gin.Context) {
	patientID := c.Param("patient_id")

	var allergies []models.PatientAllergy
	query := database.DB.Where("patient_id = ? AND is_active = ?", patientID, true).
		Order("created_at DESC")

	if err := query.Find(&allergies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": allergies})
}

// GetVisitAllergies returns all allergies recorded in a specific visit
func GetVisitAllergies(c *gin.Context) {
	visitID := c.Param("visit_id")

	// First get the visit with registration to get patient ID
	var visit models.Visit
	if err := database.DB.Preload("Registration").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Get patient ID from registration
	if visit.Registration == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration tidak ditemukan"})
		return
	}
	patientID := visit.Registration.PatientID

	// Get all active allergies for this patient (not just this visit)
	var allergies []models.PatientAllergy
	if err := database.DB.Where("patient_id = ? AND is_active = ?", patientID, true).
		Order("created_at DESC").
		Find(&allergies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": allergies})
}

// CreatePatientAllergy creates a new allergy record
func CreatePatientAllergy(c *gin.Context) {
	var input struct {
		PatientID     uint   `json:"patient_id" binding:"required"`
		VisitID       uint   `json:"visit_id"`
		SnomedCode    string `json:"snomed_code" binding:"required"`
		SnomedDisplay string `json:"snomed_display" binding:"required"`
		Category      string `json:"category"`
		Criticality   string `json:"criticality"`
		Notes         string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (optional)
	var recordedBy *uint
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uint); ok && uid > 0 {
			recordedBy = &uid
		}
	}

	// Check if allergy already exists for this patient
	var existing models.PatientAllergy
	if err := database.DB.Where("patient_id = ? AND snomed_code = ? AND is_active = ?",
		input.PatientID, input.SnomedCode, true).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":    "Alergi ini sudah tercatat untuk pasien",
			"existing": existing,
		})
		return
	}

	// Set defaults
	if input.Category == "" {
		input.Category = models.AllergyCategoryMedication
	}
	if input.Criticality == "" {
		input.Criticality = models.AllergyCriticalityLow
	}

	allergy := models.PatientAllergy{
		PatientID:     input.PatientID,
		VisitID:       input.VisitID,
		SnomedCode:    input.SnomedCode,
		SnomedDisplay: input.SnomedDisplay,
		Category:      input.Category,
		Criticality:   input.Criticality,
		Notes:         input.Notes,
		RecordedAt:    time.Now(),
		RecordedBy:    recordedBy,
		IsActive:      true,
	}

	if err := database.DB.Create(&allergy).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Alergi berhasil ditambahkan",
		"data":    allergy,
	})
}

// UpdatePatientAllergy updates an existing allergy record
func UpdatePatientAllergy(c *gin.Context) {
	id := c.Param("id")

	var allergy models.PatientAllergy
	if err := database.DB.First(&allergy, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alergi tidak ditemukan"})
		return
	}

	var input struct {
		Category    string `json:"category"`
		Criticality string `json:"criticality"`
		Notes       string `json:"notes"`
		IsActive    *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Category != "" {
		updates["category"] = input.Category
	}
	if input.Criticality != "" {
		updates["criticality"] = input.Criticality
	}
	if input.Notes != "" {
		updates["notes"] = input.Notes
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}

	if err := database.DB.Model(&allergy).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.First(&allergy, id)
	c.JSON(http.StatusOK, gin.H{
		"message": "Alergi berhasil diupdate",
		"data":    allergy,
	})
}

// DeletePatientAllergy soft-deletes an allergy record (set is_active = false)
func DeletePatientAllergy(c *gin.Context) {
	id := c.Param("id")

	var allergy models.PatientAllergy
	if err := database.DB.First(&allergy, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alergi tidak ditemukan"})
		return
	}

	// Soft delete by setting is_active = false
	if err := database.DB.Model(&allergy).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alergi berhasil dihapus"})
}

// GetPatientAllergyHistory returns allergy history for a patient (including inactive)
func GetPatientAllergyHistory(c *gin.Context) {
	patientID := c.Param("patient_id")

	var allergies []models.PatientAllergy
	if err := database.DB.Where("patient_id = ?", patientID).
		Preload("Visit").
		Preload("RecordedByUser").
		Order("created_at DESC").
		Find(&allergies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": allergies})
}

// BulkCreatePatientAllergies creates multiple allergies at once (for anamnesis form)
func BulkCreatePatientAllergies(c *gin.Context) {
	var input struct {
		PatientID uint `json:"patient_id" binding:"required"`
		VisitID   uint `json:"visit_id"`
		Allergies []struct {
			SnomedCode    string `json:"snomed_code" binding:"required"`
			SnomedDisplay string `json:"snomed_display" binding:"required"`
			Category      string `json:"category"`
			Criticality   string `json:"criticality"`
			Notes         string `json:"notes"`
		} `json:"allergies" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (optional)
	var recordedBy *uint
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uint); ok && uid > 0 {
			recordedBy = &uid
		}
	}

	var created []models.PatientAllergy
	var skipped []string

	for _, allergyInput := range input.Allergies {
		// Check if already exists
		var existing models.PatientAllergy
		if err := database.DB.Where("patient_id = ? AND snomed_code = ? AND is_active = ?",
			input.PatientID, allergyInput.SnomedCode, true).First(&existing).Error; err == nil {
			skipped = append(skipped, allergyInput.SnomedDisplay)
			continue
		}

		// Set defaults
		category := allergyInput.Category
		if category == "" {
			category = models.AllergyCategoryMedication
		}
		criticality := allergyInput.Criticality
		if criticality == "" {
			criticality = models.AllergyCriticalityLow
		}

		allergy := models.PatientAllergy{
			PatientID:     input.PatientID,
			VisitID:       input.VisitID,
			SnomedCode:    allergyInput.SnomedCode,
			SnomedDisplay: allergyInput.SnomedDisplay,
			Category:      category,
			Criticality:   criticality,
			Notes:         allergyInput.Notes,
			RecordedAt:    time.Now(),
			RecordedBy:    recordedBy,
			IsActive:      true,
		}

		if err := database.DB.Create(&allergy).Error; err == nil {
			created = append(created, allergy)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Alergi berhasil disimpan",
		"created": created,
		"skipped": skipped,
		"count":   len(created),
	})
}

// GetAllergyOptions returns available category and criticality options
func GetAllergyOptions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"categories":    models.GetAllergyCategoryOptions(),
		"criticalities": models.GetAllergyCriticalityOptions(),
	})
}

// GetPatientActiveAllergiesCount returns count of active allergies for a patient
func GetPatientActiveAllergiesCount(c *gin.Context) {
	patientID := c.Param("patient_id")

	var count int64
	database.DB.Model(&models.PatientAllergy{}).
		Where("patient_id = ? AND is_active = ?", patientID, true).
		Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// SearchSnomedAllergy searches SNOMED CT codes specifically for allergies
// This is a convenience wrapper that searches common allergy terms
// Supports search by term (text) or conceptId (numeric)
func SearchSnomedAllergy(c *gin.Context) {
	search := c.Query("q")
	if search == "" || len(search) < 3 {
		c.JSON(http.StatusOK, gin.H{
			"data":    []models.SnomedMaster{},
			"message": "Ketik minimal 3 karakter untuk mencari",
		})
		return
	}

	var snomedResults []models.SnomedMaster

	// Search for allergy-related terms
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit > 50 {
		limit = 50
	}

	// Check if search is numeric (conceptId search)
	isNumeric := true
	for _, c := range search {
		if c < '0' || c > '9' {
			isNumeric = false
			break
		}
	}

	query := database.DB.Model(&models.SnomedMaster{}).Where("active = ?", 1)

	if isNumeric {
		// Search by conceptId (exact match or prefix)
		query = query.Where("\"conceptId\" LIKE ?", search+"%")
	} else {
		// Search by term (case-insensitive contains)
		searchPattern := "%" + search + "%"
		query = query.Where("LOWER(term) LIKE ?", searchPattern)
	}

	if err := query.Limit(limit).Find(&snomedResults).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": snomedResults})
}
