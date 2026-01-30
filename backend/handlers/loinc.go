package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============================================================================
// LOINC MASTER HANDLERS (Sesuai struktur Kemkes IHS)
// ============================================================================

// GetLoincMasters returns list of LOINC master data with optional filters
func GetLoincMasters(c *gin.Context) {
	var loincMasters []models.LoincMaster

	query := database.DB.Model(&models.LoincMaster{}).Where("is_active = ?", true)

	// Filter by search (code or name)
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(code) LIKE ? OR LOWER(nama_pemeriksaan) LIKE ? OR LOWER(display) LIKE ? OR LOWER(component) LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	// Filter by kategori
	if kategori := c.Query("kategori"); kategori != "" {
		query = query.Where("kategori_pemeriksaan = ?", kategori)
	}

	// Filter by type (laboratory/radiology) - for compatibility
	if classType := c.Query("class_type"); classType != "" {
		if classType == "radiology" {
			query = query.Where("kategori_pemeriksaan = ?", "Radiologi")
		} else if classType == "laboratory" {
			query = query.Where("kategori_pemeriksaan != ?", "Radiologi")
		}
	}

	// Filter by spesimen
	if spesimen := c.Query("spesimen"); spesimen != "" {
		query = query.Where("spesimen = ?", spesimen)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	// Count total
	var total int64
	query.Count(&total)

	// Get data with pagination
	if err := query.Order("nama_pemeriksaan ASC").Offset(offset).Limit(limit).Find(&loincMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data LOINC"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  loincMasters,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetLoincMaster returns single LOINC master by ID
func GetLoincMaster(c *gin.Context) {
	id := c.Param("id")
	var loincMaster models.LoincMaster

	if err := database.DB.First(&loincMaster, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data LOINC tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data LOINC"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": loincMaster})
}

// LookupLoincByCode looks up LOINC by code from master data
func LookupLoincByCode(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode LOINC diperlukan"})
		return
	}

	var loincMaster models.LoincMaster
	if err := database.DB.Where("code = ? AND is_active = ?", code, true).First(&loincMaster).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"found": false,
				"error": "Kode LOINC tidak ditemukan di master data",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data LOINC"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"found": true,
		"data":  loincMaster,
	})
}

// SearchLoincFromMaster searches LOINC codes from master data for autocomplete
// Optimized for dropdown/combobox - returns max 20 results
// Minimum 4 characters to reduce server load
func SearchLoincFromMaster(c *gin.Context) {
	search := c.Query("q")
	if search == "" || len(search) < 4 {
		c.JSON(http.StatusOK, gin.H{
			"data":    []models.LoincMaster{},
			"message": "Ketik minimal 4 karakter untuk mencari",
		})
		return
	}

	var loincMasters []models.LoincMaster
	searchLower := strings.ToLower(search)
	searchPattern := "%" + searchLower + "%"

	query := database.DB.Model(&models.LoincMaster{}).
		Where("is_active = ?", true).
		Where(
			"LOWER(code) LIKE ? OR LOWER(nama_pemeriksaan) LIKE ? OR LOWER(display) LIKE ? OR LOWER(component) LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)

	// Filter by class_type if provided
	if classType := c.Query("class_type"); classType != "" {
		if classType == "radiology" {
			query = query.Where("kategori_pemeriksaan = ?", "Radiologi")
		} else if classType == "laboratory" {
			query = query.Where("kategori_pemeriksaan != ?", "Radiologi")
		}
	}

	// Limit results for autocomplete
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	if limit > 50 {
		limit = 50
	}

	// Order: exact code match first, then alphabetically
	if err := query.Order("CASE WHEN LOWER(code) = '" + searchLower + "' THEN 0 ELSE 1 END, nama_pemeriksaan ASC").
		Limit(limit).Find(&loincMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data LOINC"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": loincMasters})
}

// GetLoincKategoriList returns distinct kategori pemeriksaan for filter dropdown
func GetLoincKategoriList(c *gin.Context) {
	var kategoris []string
	if err := database.DB.Model(&models.LoincMaster{}).
		Where("is_active = ?", true).
		Distinct("kategori_pemeriksaan").
		Order("kategori_pemeriksaan ASC").
		Pluck("kategori_pemeriksaan", &kategoris).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar kategori"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kategoris})
}

// GetLoincSpesimenList returns distinct spesimen for filter dropdown
func GetLoincSpesimenList(c *gin.Context) {
	var spesimens []string
	if err := database.DB.Model(&models.LoincMaster{}).
		Where("is_active = ? AND spesimen != ''", true).
		Distinct("spesimen").
		Order("spesimen ASC").
		Pluck("spesimen", &spesimens).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar spesimen"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": spesimens})
}

// ============================================================================
// SNOMED MASTER HANDLERS (Optimized for 1M+ rows)
// ============================================================================

// GetSnomedMasters returns list of SNOMED master data with pagination
func GetSnomedMasters(c *gin.Context) {
	var snomedMasters []models.SnomedMaster

	query := database.DB.Model(&models.SnomedMaster{}).Where("active = ?", 1)

	// Filter by search
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(conceptId) LIKE ? OR LOWER(term) LIKE ?",
			searchPattern, searchPattern,
		)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	// Count total
	var total int64
	query.Count(&total)

	// Get data
	if err := query.Order("term ASC").Offset(offset).Limit(limit).Find(&snomedMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data SNOMED"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  snomedMasters,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetSnomedMaster returns single SNOMED master by ID
func GetSnomedMaster(c *gin.Context) {
	id := c.Param("id")
	var snomedMaster models.SnomedMaster

	if err := database.DB.First(&snomedMaster, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data SNOMED tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data SNOMED"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": snomedMaster})
}

// SearchSnomedFromMaster searches SNOMED codes for autocomplete
// Minimum 3 characters to reduce server load on 1M+ rows
// Searches by "term" column (international English terminology)
func SearchSnomedFromMaster(c *gin.Context) {
	search := c.Query("q")
	if search == "" || len(search) < 3 {
		c.JSON(http.StatusOK, gin.H{
			"data":    []models.SnomedMaster{},
			"message": "Ketik minimal 3 karakter untuk mencari (gunakan Bahasa Inggris)",
		})
		return
	}

	var snomedMasters []models.SnomedMaster
	searchLower := strings.ToLower(search)
	searchPattern := "%" + searchLower + "%"

	// Search primarily by term column (English terminology)
	query := database.DB.Model(&models.SnomedMaster{}).
		Where("active = ?", 1).
		Where(
			"LOWER(\"conceptId\") LIKE ? OR LOWER(term) LIKE ?",
			searchPattern, searchPattern,
		)

	// Limit results for autocomplete - max 20 to reduce payload
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit > 30 {
		limit = 30
	}

	// Order: exact code match first
	if err := query.Order("CASE WHEN LOWER(\"conceptId\") = '" + searchLower + "' THEN 0 ELSE 1 END, term ASC").
		Limit(limit).Find(&snomedMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data SNOMED"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": snomedMasters})
}

// LookupSnomedByCode looks up SNOMED by conceptId
func LookupSnomedByCode(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode SNOMED diperlukan"})
		return
	}

	var snomedMaster models.SnomedMaster
	if err := database.DB.Where("conceptId = ? AND active = ?", code, 1).First(&snomedMaster).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"found": false,
				"error": "Kode SNOMED tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data SNOMED"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"found": true,
		"data":  snomedMaster,
	})
}

// GetSnomedByCategory - not applicable for Kemkes structure
func GetSnomedByCategory(c *gin.Context) {
	// Kemkes SNOMED structure doesn't have category field
	// Return empty - use search instead
	c.JSON(http.StatusOK, gin.H{
		"data":    []models.SnomedMaster{},
		"message": "Use search endpoint instead",
	})
}

// GetSnomedCategoryList - not applicable for Kemkes structure
func GetSnomedCategoryList(c *gin.Context) {
	// Kemkes SNOMED structure doesn't have category field
	c.JSON(http.StatusOK, gin.H{
		"data": []string{},
	})
}

// ============================================================================
// PROCEDURE LOINC MAPPING CRUD HANDLERS
// ============================================================================

// GetProcedureLoincMappings returns list of procedure to LOINC mappings
func GetProcedureLoincMappings(c *gin.Context) {
	var mappings []models.ProcedureLoincMapping

	query := database.DB.Model(&models.ProcedureLoincMapping{}).
		Preload("Procedure").
		Preload("VerifiedBy")

	// Filter by search
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Joins("LEFT JOIN procedures ON procedures.id = procedure_loinc_mappings.procedure_id").
			Where("LOWER(procedures.name) LIKE ? OR LOWER(procedures.code) LIKE ? OR LOWER(procedure_loinc_mappings.loinc_code) LIKE ? OR LOWER(procedure_loinc_mappings.loinc_display) LIKE ?",
				searchPattern, searchPattern, searchPattern, searchPattern)
	}

	// Filter by procedure_id
	if procedureID := c.Query("procedure_id"); procedureID != "" {
		query = query.Where("procedure_loinc_mappings.procedure_id = ?", procedureID)
	}

	// Filter by procedure type (lab or radiology)
	if procType := c.Query("procedure_type"); procType != "" {
		query = query.Joins("LEFT JOIN procedures ON procedures.id = procedure_loinc_mappings.procedure_id").
			Where("procedures.procedure_type = ?", procType)
	}

	// Filter by is_verified
	if isVerified := c.Query("is_verified"); isVerified != "" {
		query = query.Where("procedure_loinc_mappings.is_verified = ?", isVerified == "true")
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Count total
	var total int64
	countQuery := database.DB.Model(&models.ProcedureLoincMapping{})
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		countQuery = countQuery.Joins("LEFT JOIN procedures ON procedures.id = procedure_loinc_mappings.procedure_id").
			Where("LOWER(procedures.name) LIKE ? OR LOWER(procedures.code) LIKE ? OR LOWER(procedure_loinc_mappings.loinc_code) LIKE ? OR LOWER(procedure_loinc_mappings.loinc_display) LIKE ?",
				searchPattern, searchPattern, searchPattern, searchPattern)
	}
	countQuery.Count(&total)

	// Get data
	if err := query.Order("procedure_loinc_mappings.created_at DESC").Offset(offset).Limit(limit).Find(&mappings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  mappings,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetProcedureLoincMapping returns single mapping by ID
func GetProcedureLoincMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.ProcedureLoincMapping

	if err := database.DB.Preload("Procedure").Preload("VerifiedBy").First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// GetProcedureLoincMappingByProcedure returns mapping by procedure ID
func GetProcedureLoincMappingByProcedure(c *gin.Context) {
	procedureID := c.Param("procedure_id")
	var mapping models.ProcedureLoincMapping

	if err := database.DB.Preload("Procedure").Preload("VerifiedBy").
		Where("procedure_id = ?", procedureID).First(&mapping).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan untuk procedure ini"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// CreateProcedureLoincMappingRequest represents the request body for creating mapping
type CreateProcedureLoincMappingRequest struct {
	ProcedureID           uint   `json:"procedure_id" binding:"required"`
	LoincCode             string `json:"loinc_code" binding:"required"`
	LoincDisplay          string `json:"loinc_display" binding:"required"`
	SnomedCategoryCode    string `json:"snomed_category_code" binding:"required"`
	SnomedCategoryDisplay string `json:"snomed_category_display"`
	SnomedSpecimenCode    string `json:"snomed_specimen_code"`
	SnomedSpecimenDisplay string `json:"snomed_specimen_display"`
	SnomedBodySiteCode    string `json:"snomed_bodysite_code"`
	SnomedBodySiteDisplay string `json:"snomed_bodysite_display"`
	IsVerified            *bool  `json:"is_verified"`
	IsActive              *bool  `json:"is_active"`
	Notes                 string `json:"notes"`
}

// CreateProcedureLoincMapping creates new mapping between procedure and LOINC/SNOMED codes
func CreateProcedureLoincMapping(c *gin.Context) {
	var req CreateProcedureLoincMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validasi gagal",
			"message": err.Error(),
		})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, req.ProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure tidak ditemukan"})
		return
	}

	// Check if mapping already exists for this procedure (including soft-deleted)
	var existing models.ProcedureLoincMapping
	err := database.DB.Unscoped().Where("procedure_id = ?", req.ProcedureID).First(&existing).Error

	if err == nil {
		// Record exists
		if existing.DeletedAt.Valid {
			// Soft-deleted record exists - restore and update it
			existing.DeletedAt = gorm.DeletedAt{} // Clear deleted_at
			existing.LoincCode = req.LoincCode
			existing.LoincDisplay = req.LoincDisplay
			existing.SnomedCategoryCode = req.SnomedCategoryCode
			existing.SnomedCategoryDisplay = req.SnomedCategoryDisplay
			if existing.SnomedCategoryDisplay == "" {
				existing.SnomedCategoryDisplay = models.GetSnomedCategoryDisplay(req.SnomedCategoryCode)
			}
			existing.SnomedSpecimenCode = req.SnomedSpecimenCode
			existing.SnomedSpecimenDisplay = req.SnomedSpecimenDisplay
			if existing.SnomedSpecimenDisplay == "" && req.SnomedSpecimenCode != "" {
				existing.SnomedSpecimenDisplay = models.GetSnomedSpecimenDisplay(req.SnomedSpecimenCode)
			}
			existing.SnomedBodySiteCode = req.SnomedBodySiteCode
			existing.SnomedBodySiteDisplay = req.SnomedBodySiteDisplay
			existing.IsVerified = false
			existing.VerifiedAt = nil
			existing.VerifiedByID = nil
			existing.IsActive = true
			existing.Notes = req.Notes

			if err := database.DB.Unscoped().Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Gagal restore mapping",
					"message": err.Error(),
				})
				return
			}

			database.DB.Preload("Procedure").Preload("VerifiedBy").First(&existing, existing.ID)
			c.JSON(http.StatusCreated, gin.H{
				"message": "Mapping LOINC berhasil di-restore dan diupdate",
				"data":    existing,
			})
			return
		}
		// Active record exists
		c.JSON(http.StatusConflict, gin.H{"error": "Procedure ini sudah memiliki mapping LOINC"})
		return
	}

	// Set defaults
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	isVerified := false
	if req.IsVerified != nil {
		isVerified = *req.IsVerified
	}

	// Auto-fill display if empty
	snomedCategoryDisplay := req.SnomedCategoryDisplay
	if snomedCategoryDisplay == "" {
		snomedCategoryDisplay = models.GetSnomedCategoryDisplay(req.SnomedCategoryCode)
	}

	snomedSpecimenDisplay := req.SnomedSpecimenDisplay
	if snomedSpecimenDisplay == "" && req.SnomedSpecimenCode != "" {
		snomedSpecimenDisplay = models.GetSnomedSpecimenDisplay(req.SnomedSpecimenCode)
	}

	// Get current user ID for verification
	var verifiedByID *uint
	var verifiedAt *time.Time
	if isVerified {
		userIDVal, exists := c.Get("user_id")
		if exists {
			uid := userIDVal.(uint)
			verifiedByID = &uid
			now := time.Now()
			verifiedAt = &now
		}
	}

	mapping := models.ProcedureLoincMapping{
		ProcedureID:           req.ProcedureID,
		LoincCode:             req.LoincCode,
		LoincDisplay:          req.LoincDisplay,
		SnomedCategoryCode:    req.SnomedCategoryCode,
		SnomedCategoryDisplay: snomedCategoryDisplay,
		SnomedSpecimenCode:    req.SnomedSpecimenCode,
		SnomedSpecimenDisplay: snomedSpecimenDisplay,
		SnomedBodySiteCode:    req.SnomedBodySiteCode,
		SnomedBodySiteDisplay: req.SnomedBodySiteDisplay,
		IsVerified:            isVerified,
		VerifiedAt:            verifiedAt,
		VerifiedByID:          verifiedByID,
		IsActive:              isActive,
		Notes:                 req.Notes,
	}

	if err := database.DB.Create(&mapping).Error; err != nil {
		// Check for duplicate key error
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "UNIQUE constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "Procedure ini sudah memiliki mapping LOINC"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Gagal membuat mapping",
			"message": err.Error(),
		})
		return
	}

	// Reload with preloads
	database.DB.Preload("Procedure").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Mapping LOINC berhasil dibuat",
		"data":    mapping,
	})
}

// UpdateProcedureLoincMapping updates existing mapping
func UpdateProcedureLoincMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.ProcedureLoincMapping

	if err := database.DB.First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	var req CreateProcedureLoincMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If procedure_id changed, check new procedure
	if req.ProcedureID != mapping.ProcedureID {
		var procedure models.Procedure
		if err := database.DB.First(&procedure, req.ProcedureID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Procedure tidak ditemukan"})
			return
		}

		var existing models.ProcedureLoincMapping
		if err := database.DB.Where("procedure_id = ? AND id != ?", req.ProcedureID, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Procedure ini sudah memiliki mapping LOINC lain"})
			return
		}
		mapping.ProcedureID = req.ProcedureID
	}

	// Update fields
	mapping.LoincCode = req.LoincCode
	mapping.LoincDisplay = req.LoincDisplay
	mapping.SnomedCategoryCode = req.SnomedCategoryCode
	mapping.SnomedCategoryDisplay = req.SnomedCategoryDisplay
	mapping.SnomedSpecimenCode = req.SnomedSpecimenCode
	mapping.SnomedSpecimenDisplay = req.SnomedSpecimenDisplay
	mapping.SnomedBodySiteCode = req.SnomedBodySiteCode
	mapping.SnomedBodySiteDisplay = req.SnomedBodySiteDisplay
	mapping.Notes = req.Notes

	if req.IsActive != nil {
		mapping.IsActive = *req.IsActive
	}

	// Handle verification status change
	if req.IsVerified != nil && *req.IsVerified != mapping.IsVerified {
		mapping.IsVerified = *req.IsVerified
		if *req.IsVerified {
			userIDVal, exists := c.Get("user_id")
			if exists {
				uid := userIDVal.(uint)
				mapping.VerifiedByID = &uid
				now := time.Now()
				mapping.VerifiedAt = &now
			}
		} else {
			mapping.VerifiedByID = nil
			mapping.VerifiedAt = nil
		}
	}

	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate mapping"})
		return
	}

	// Reload with preloads
	database.DB.Preload("Procedure").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Mapping LOINC berhasil diupdate",
		"data":    mapping,
	})
}

// DeleteProcedureLoincMapping deletes mapping
func DeleteProcedureLoincMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.ProcedureLoincMapping

	if err := database.DB.First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	if err := database.DB.Delete(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mapping LOINC berhasil dihapus"})
}

// VerifyProcedureLoincMapping verifies a mapping
func VerifyProcedureLoincMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.ProcedureLoincMapping

	if err := database.DB.First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	if mapping.IsVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping sudah diverifikasi"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	uid := userIDVal.(uint)

	mapping.IsVerified = true
	mapping.VerifiedByID = &uid
	now := time.Now()
	mapping.VerifiedAt = &now

	if err := database.DB.Save(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memverifikasi mapping"})
		return
	}

	database.DB.Preload("Procedure").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Mapping LOINC berhasil diverifikasi",
		"data":    mapping,
	})
}

// ============================================================================
// LOINC/SNOMED MAPPING STATISTICS
// ============================================================================

// GetLoincMappingStats returns statistics about LOINC mappings
func GetLoincMappingStats(c *gin.Context) {
	// Total procedures (lab + radiology)
	var totalProceduresLab int64
	database.DB.Model(&models.Procedure{}).Where("is_active = ? AND procedure_type = ?", true, "laboratory").Count(&totalProceduresLab)

	var totalProceduresRad int64
	database.DB.Model(&models.Procedure{}).Where("is_active = ? AND procedure_type = ?", true, "radiology").Count(&totalProceduresRad)

	totalProcedures := totalProceduresLab + totalProceduresRad

	// Total mapped procedures
	var totalMapped int64
	database.DB.Model(&models.ProcedureLoincMapping{}).Where("is_active = ?", true).Count(&totalMapped)

	// Total verified
	var totalVerified int64
	database.DB.Model(&models.ProcedureLoincMapping{}).Where("is_active = ? AND is_verified = ?", true, true).Count(&totalVerified)

	// Total LOINC master
	var totalLoincMaster int64
	database.DB.Model(&models.LoincMaster{}).Where("is_active = ?", true).Count(&totalLoincMaster)

	// Total SNOMED master
	var totalSnomedMaster int64
	database.DB.Model(&models.SnomedMaster{}).Where("is_active = ?", true).Count(&totalSnomedMaster)

	// Calculate unmapped
	unmapped := totalProcedures - totalMapped
	if unmapped < 0 {
		unmapped = 0
	}

	// Calculate percentages
	var mappedPercentage float64
	if totalProcedures > 0 {
		mappedPercentage = float64(totalMapped) / float64(totalProcedures) * 100
	}

	var verifiedPercentage float64
	if totalMapped > 0 {
		verifiedPercentage = float64(totalVerified) / float64(totalMapped) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"total_procedures":     totalProcedures,
		"total_procedures_lab": totalProceduresLab,
		"total_procedures_rad": totalProceduresRad,
		"total_mapped":         totalMapped,
		"total_unmapped":       unmapped,
		"total_verified":       totalVerified,
		"total_loinc_master":   totalLoincMaster,
		"total_snomed_master":  totalSnomedMaster,
		"mapped_percentage":    mappedPercentage,
		"verified_percentage":  verifiedPercentage,
		"ready_for_satusehat":  totalVerified,
	})
}

// GetUnmappedProcedures returns list of procedures without LOINC mapping
func GetUnmappedProcedures(c *gin.Context) {
	var procedures []models.Procedure

	// Build subquery for mapped procedure IDs
	subQuery := database.DB.Model(&models.ProcedureLoincMapping{}).Select("procedure_id")

	// Build query for unmapped procedures (only lab and radiology)
	query := database.DB.Model(&models.Procedure{}).
		Where("id NOT IN (?)", subQuery).
		Where("is_active = ?", true).
		Where("procedure_type IN (?)", []string{"laboratory", "radiology"})

	// Filter by search
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(code) LIKE ?", searchPattern, searchPattern)
	}

	// Filter by procedure_type
	if procType := c.Query("procedure_type"); procType != "" {
		query = query.Where("procedure_type = ?", procType)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Count total
	var total int64
	query.Count(&total)

	// Get data
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&procedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data procedure"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  procedures,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
