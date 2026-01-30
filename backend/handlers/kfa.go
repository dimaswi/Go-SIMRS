package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
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
// KFA Master CRUD Handlers
// ============================================================================

// GetKFAMasters returns list of KFA master data with optional filters
func GetKFAMasters(c *gin.Context) {
	var kfaMasters []models.KFAMaster

	// Build query with filters
	query := database.DB.Model(&models.KFAMaster{})

	// Filter by search (code or name)
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(kfa_code) LIKE ? OR LOWER(kfa_name) LIKE ?", searchPattern, searchPattern)
	}

	// Filter by product type
	if productType := c.Query("product_type"); productType != "" {
		query = query.Where("kfa_type = ?", productType)
	}

	// Filter by category
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	// Filter by form
	if form := c.Query("form"); form != "" {
		query = query.Where("form = ?", form)
	}

	// Filter by is_active
	if isActive := c.Query("is_active"); isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Count total
	var total int64
	query.Count(&total)

	// Get data with pagination
	if err := query.Order("kfa_name ASC").Offset(offset).Limit(limit).Find(&kfaMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data KFA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  kfaMasters,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetKFAMaster returns single KFA master by ID
func GetKFAMaster(c *gin.Context) {
	id := c.Param("id")
	var kfaMaster models.KFAMaster

	if err := database.DB.First(&kfaMaster, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data KFA tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data KFA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kfaMaster})
}

// CreateKFAMasterRequest represents the request body for creating KFA master
type CreateKFAMasterRequest struct {
	KFACode        string `json:"kfa_code" binding:"required"`
	KFAName        string `json:"kfa_name" binding:"required"`
	KFAProductType string `json:"kfa_type"`
	KFAFarmalkes   string `json:"kfa_farmalkes"`
	Form           string `json:"form"`
	Strength       string `json:"strength"`
	Manufacturer   string `json:"manufacturer"`
	Category       string `json:"category"`
	IsActive       *bool  `json:"is_active"`
}

// CreateKFAMaster creates new KFA master data
func CreateKFAMaster(c *gin.Context) {
	var req CreateKFAMasterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if KFA code already exists
	var existing models.KFAMaster
	if err := database.DB.Where("kfa_code = ?", req.KFACode).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Kode KFA sudah terdaftar"})
		return
	}

	// Set default values
	productType := models.KFAProductTypeObat
	if req.KFAProductType == "alat_kesehatan" {
		productType = models.KFAProductTypeAlatKesehatan
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	kfaMaster := models.KFAMaster{
		KFACode:        req.KFACode,
		KFAName:        req.KFAName,
		KFAProductType: productType,
		KFAFarmalkes:   req.KFAFarmalkes,
		Form:           req.Form,
		Strength:       req.Strength,
		Manufacturer:   req.Manufacturer,
		Category:       req.Category,
		IsActive:       isActive,
	}

	if err := database.DB.Create(&kfaMaster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat data KFA"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Data KFA berhasil dibuat",
		"data":    kfaMaster,
	})
}

// UpdateKFAMaster updates existing KFA master data
func UpdateKFAMaster(c *gin.Context) {
	id := c.Param("id")
	var kfaMaster models.KFAMaster

	if err := database.DB.First(&kfaMaster, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data KFA tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data KFA"})
		return
	}

	var req CreateKFAMasterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if new code conflicts with existing (excluding current record)
	if req.KFACode != kfaMaster.KFACode {
		var existing models.KFAMaster
		if err := database.DB.Where("kfa_code = ? AND id != ?", req.KFACode, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode KFA sudah digunakan"})
			return
		}
	}

	// Update fields
	kfaMaster.KFACode = req.KFACode
	kfaMaster.KFAName = req.KFAName
	kfaMaster.KFAFarmalkes = req.KFAFarmalkes
	kfaMaster.Form = req.Form
	kfaMaster.Strength = req.Strength
	kfaMaster.Manufacturer = req.Manufacturer
	kfaMaster.Category = req.Category

	if req.KFAProductType == "alat_kesehatan" {
		kfaMaster.KFAProductType = models.KFAProductTypeAlatKesehatan
	} else {
		kfaMaster.KFAProductType = models.KFAProductTypeObat
	}

	if req.IsActive != nil {
		kfaMaster.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&kfaMaster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate data KFA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data KFA berhasil diupdate",
		"data":    kfaMaster,
	})
}

// DeleteKFAMaster deletes KFA master data
func DeleteKFAMaster(c *gin.Context) {
	id := c.Param("id")
	var kfaMaster models.KFAMaster

	if err := database.DB.First(&kfaMaster, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Data KFA tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data KFA"})
		return
	}

	// Check if KFA is used in any mapping
	var mappingCount int64
	database.DB.Model(&models.MedicineKFAMapping{}).Where("kfa_code = ?", kfaMaster.KFACode).Count(&mappingCount)
	if mappingCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Data KFA sedang digunakan dalam mapping obat"})
		return
	}

	if err := database.DB.Delete(&kfaMaster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data KFA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data KFA berhasil dihapus"})
}

// ============================================================================
// Medicine KFA Mapping CRUD Handlers
// ============================================================================

// GetMedicineKFAMappings returns list of medicine to KFA mappings
func GetMedicineKFAMappings(c *gin.Context) {
	var mappings []models.MedicineKFAMapping

	// Build query with preload
	query := database.DB.Model(&models.MedicineKFAMapping{}).
		Preload("Medicine").
		Preload("VerifiedBy")

	// Filter by search (medicine name or code, KFA code or name)
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Joins("LEFT JOIN medicines ON medicines.id = medicine_kfa_mappings.medicine_id").
			Where("LOWER(medicines.name) LIKE ? OR LOWER(medicines.code) LIKE ? OR LOWER(medicine_kfa_mappings.kfa_code) LIKE ? OR LOWER(medicine_kfa_mappings.kfa_name) LIKE ?",
				searchPattern, searchPattern, searchPattern, searchPattern)
	}

	// Filter by medicine_id
	if medicineID := c.Query("medicine_id"); medicineID != "" {
		query = query.Where("medicine_kfa_mappings.medicine_id = ?", medicineID)
	}

	// Filter by is_verified
	if isVerified := c.Query("is_verified"); isVerified != "" {
		query = query.Where("medicine_kfa_mappings.is_verified = ?", isVerified == "true")
	}

	// Filter by is_active
	if isActive := c.Query("is_active"); isActive != "" {
		query = query.Where("medicine_kfa_mappings.is_active = ?", isActive == "true")
	}

	// Filter unmapped medicines
	if unmapped := c.Query("unmapped"); unmapped == "true" {
		// This will be handled differently - get medicines without mapping
		var unmappedMedicines []models.Medicine
		subQuery := database.DB.Model(&models.MedicineKFAMapping{}).Select("medicine_id")
		database.DB.Model(&models.Medicine{}).
			Where("id NOT IN (?)", subQuery).
			Where("is_active = ?", true).
			Find(&unmappedMedicines)

		c.JSON(http.StatusOK, gin.H{
			"data":               []models.MedicineKFAMapping{},
			"unmapped_medicines": unmappedMedicines,
			"total":              len(unmappedMedicines),
		})
		return
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Count total
	var total int64
	countQuery := database.DB.Model(&models.MedicineKFAMapping{})
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		countQuery = countQuery.Joins("LEFT JOIN medicines ON medicines.id = medicine_kfa_mappings.medicine_id").
			Where("LOWER(medicines.name) LIKE ? OR LOWER(medicines.code) LIKE ? OR LOWER(medicine_kfa_mappings.kfa_code) LIKE ? OR LOWER(medicine_kfa_mappings.kfa_name) LIKE ?",
				searchPattern, searchPattern, searchPattern, searchPattern)
	}
	countQuery.Count(&total)

	// Get data with pagination
	if err := query.Order("medicine_kfa_mappings.created_at DESC").Offset(offset).Limit(limit).Find(&mappings).Error; err != nil {
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

// GetMedicineKFAMapping returns single mapping by ID
func GetMedicineKFAMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.MedicineKFAMapping

	if err := database.DB.Preload("Medicine").Preload("VerifiedBy").First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// GetMedicineKFAMappingByMedicine returns mapping by medicine ID
func GetMedicineKFAMappingByMedicine(c *gin.Context) {
	medicineID := c.Param("medicine_id")
	var mapping models.MedicineKFAMapping

	if err := database.DB.Preload("Medicine").Preload("VerifiedBy").
		Where("medicine_id = ?", medicineID).First(&mapping).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan untuk obat ini"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": mapping})
}

// CreateMedicineKFAMappingRequest represents the request body for creating mapping
type CreateMedicineKFAMappingRequest struct {
	MedicineID      uint   `json:"medicine_id" binding:"required"`
	KFACode         string `json:"kfa_code" binding:"required"`
	KFAName         string `json:"kfa_name" binding:"required"`
	KFAProductType  string `json:"kfa_type"`
	KFAFarmalkes    string `json:"kfa_farmalkes"`
	KFADisplayName  string `json:"kfa_display_name"`
	KFAForm         string `json:"kfa_form"`
	KFAStrength     string `json:"kfa_strength"`
	KFAManufacturer string `json:"kfa_manufacturer"`
	IsVerified      *bool  `json:"is_verified"`
	IsActive        *bool  `json:"is_active"`
	Notes           string `json:"notes"`
}

// CreateMedicineKFAMapping creates new mapping between medicine and KFA code
func CreateMedicineKFAMapping(c *gin.Context) {
	var req CreateMedicineKFAMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validasi gagal",
			"message": err.Error(),
			"details": "Pastikan medicine_id, kfa_code, dan kfa_name sudah terisi",
		})
		return
	}

	// Additional validation
	if strings.TrimSpace(req.KFACode) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode KFA tidak boleh kosong"})
		return
	}
	if strings.TrimSpace(req.KFAName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama KFA tidak boleh kosong"})
		return
	}

	// Check if medicine exists
	var medicine models.Medicine
	if err := database.DB.First(&medicine, req.MedicineID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Obat tidak ditemukan"})
		return
	}

	// Check if mapping already exists for this medicine
	var existing models.MedicineKFAMapping
	if err := database.DB.Where("medicine_id = ?", req.MedicineID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Obat ini sudah memiliki mapping KFA"})
		return
	}

	// Set default values
	productType := models.KFAProductTypeObat
	if req.KFAProductType == "alat_kesehatan" {
		productType = models.KFAProductTypeAlatKesehatan
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	isVerified := false
	if req.IsVerified != nil {
		isVerified = *req.IsVerified
	}

	// Get current user ID for verification tracking
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

	mapping := models.MedicineKFAMapping{
		MedicineID:      req.MedicineID,
		KFACode:         req.KFACode,
		KFAName:         req.KFAName,
		KFAProductType:  productType,
		KFAFarmalkes:    req.KFAFarmalkes,
		KFADisplayName:  req.KFADisplayName,
		KFAForm:         req.KFAForm,
		KFAStrength:     req.KFAStrength,
		KFAManufacturer: req.KFAManufacturer,
		IsVerified:      isVerified,
		VerifiedAt:      verifiedAt,
		VerifiedByID:    verifiedByID,
		IsActive:        isActive,
		Notes:           req.Notes,
	}

	if err := database.DB.Create(&mapping).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat mapping"})
		return
	}

	// Reload with preloads
	database.DB.Preload("Medicine").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Mapping KFA berhasil dibuat",
		"data":    mapping,
	})
}

// UpdateMedicineKFAMapping updates existing mapping
func UpdateMedicineKFAMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.MedicineKFAMapping

	if err := database.DB.First(&mapping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mapping tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mapping"})
		return
	}

	var req CreateMedicineKFAMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If medicine_id is changed, check if new medicine exists and doesn't have mapping
	if req.MedicineID != mapping.MedicineID {
		var medicine models.Medicine
		if err := database.DB.First(&medicine, req.MedicineID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Obat tidak ditemukan"})
			return
		}

		var existing models.MedicineKFAMapping
		if err := database.DB.Where("medicine_id = ? AND id != ?", req.MedicineID, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Obat ini sudah memiliki mapping KFA lain"})
			return
		}
		mapping.MedicineID = req.MedicineID
	}

	// Update fields
	mapping.KFACode = req.KFACode
	mapping.KFAName = req.KFAName
	mapping.KFAFarmalkes = req.KFAFarmalkes
	mapping.KFADisplayName = req.KFADisplayName
	mapping.KFAForm = req.KFAForm
	mapping.KFAStrength = req.KFAStrength
	mapping.KFAManufacturer = req.KFAManufacturer
	mapping.Notes = req.Notes

	if req.KFAProductType == "alat_kesehatan" {
		mapping.KFAProductType = models.KFAProductTypeAlatKesehatan
	} else {
		mapping.KFAProductType = models.KFAProductTypeObat
	}

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
	database.DB.Preload("Medicine").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Mapping KFA berhasil diupdate",
		"data":    mapping,
	})
}

// DeleteMedicineKFAMapping deletes mapping
func DeleteMedicineKFAMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.MedicineKFAMapping

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

	c.JSON(http.StatusOK, gin.H{"message": "Mapping KFA berhasil dihapus"})
}

// VerifyMedicineKFAMapping verifies a mapping
func VerifyMedicineKFAMapping(c *gin.Context) {
	id := c.Param("id")
	var mapping models.MedicineKFAMapping

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

	// Get current user ID
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

	// Reload with preloads
	database.DB.Preload("Medicine").Preload("VerifiedBy").First(&mapping, mapping.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Mapping KFA berhasil diverifikasi",
		"data":    mapping,
	})
}

// ============================================================================
// KFA Statistics and Summary
// ============================================================================

// GetKFAMappingStats returns statistics about KFA mappings
func GetKFAMappingStats(c *gin.Context) {
	// Total medicines
	var totalMedicines int64
	database.DB.Model(&models.Medicine{}).Where("is_active = ?", true).Count(&totalMedicines)

	// Total mapped medicines
	var totalMapped int64
	database.DB.Model(&models.MedicineKFAMapping{}).Where("is_active = ?", true).Count(&totalMapped)

	// Total verified mappings
	var totalVerified int64
	database.DB.Model(&models.MedicineKFAMapping{}).Where("is_active = ? AND is_verified = ?", true, true).Count(&totalVerified)

	// Total KFA master data
	var totalKFAMaster int64
	database.DB.Model(&models.KFAMaster{}).Where("is_active = ?", true).Count(&totalKFAMaster)

	// Calculate unmapped
	unmapped := totalMedicines - totalMapped
	if unmapped < 0 {
		unmapped = 0
	}

	// Calculate percentage
	var mappedPercentage float64
	if totalMedicines > 0 {
		mappedPercentage = float64(totalMapped) / float64(totalMedicines) * 100
	}

	var verifiedPercentage float64
	if totalMapped > 0 {
		verifiedPercentage = float64(totalVerified) / float64(totalMapped) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"total_medicines":     totalMedicines,
		"total_mapped":        totalMapped,
		"total_unmapped":      unmapped,
		"total_verified":      totalVerified,
		"total_kfa_master":    totalKFAMaster,
		"mapped_percentage":   mappedPercentage,
		"verified_percentage": verifiedPercentage,
		"ready_for_satusehat": totalVerified,
	})
}

// GetUnmappedMedicines returns list of medicines without KFA mapping
func GetUnmappedMedicines(c *gin.Context) {
	var medicines []models.Medicine

	// Build subquery for mapped medicine IDs
	subQuery := database.DB.Model(&models.MedicineKFAMapping{}).Select("medicine_id")

	// Build query for unmapped medicines
	query := database.DB.Model(&models.Medicine{}).
		Where("id NOT IN (?)", subQuery).
		Where("is_active = ?", true)

	// Filter by search
	if search := c.Query("search"); search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(code) LIKE ? OR LOWER(generic_name) LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	// Filter by category
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	// Filter by form
	if form := c.Query("form"); form != "" {
		query = query.Where("form = ?", form)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// Count total
	var total int64
	query.Count(&total)

	// Get data
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&medicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data obat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  medicines,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// SearchKFAFromMaster searches KFA codes from master data for autocomplete
func SearchKFAFromMaster(c *gin.Context) {
	search := c.Query("q")
	if search == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter pencarian diperlukan"})
		return
	}

	var kfaMasters []models.KFAMaster
	searchPattern := "%" + strings.ToLower(search) + "%"

	if err := database.DB.Model(&models.KFAMaster{}).
		Where("is_active = ?", true).
		Where("LOWER(kfa_code) LIKE ? OR LOWER(kfa_name) LIKE ?", searchPattern, searchPattern).
		Order("kfa_name ASC").
		Limit(20).
		Find(&kfaMasters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data KFA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": kfaMasters})
}

// ============================================================================
// KFA Lookup from SatuSehat API
// ============================================================================

// KFAProductResponse represents the response from SatuSehat KFA API
type KFAProductResponse struct {
	Total int `json:"total"`
	Data  struct {
		ProductsGroups []KFAProductGroup `json:"products_groups"`
	} `json:"data"`
}

type KFAProductGroup struct {
	Name     string       `json:"name"`
	Products []KFAProduct `json:"products"`
}

type KFAProduct struct {
	KFACode           string `json:"kfa_code"`
	Name              string `json:"name"`
	DisplayName       string `json:"display_name"`
	Farmalkes         string `json:"farmalkes_type_code"`
	FarmalkesName     string `json:"farmalkes_type_name"`
	Manufacturer      string `json:"manufacturer_name"`
	Registrar         string `json:"registrar_name"`
	Dosage            string `json:"dosage_form_name"`
	ProductTemplateID string `json:"product_template_id"`
	State             string `json:"state"`
	ActiveIngredients string `json:"active_ingredients"`
	NIE               string `json:"nie"`
}

// LookupKFAByCode looks up KFA product from SatuSehat API by code
// Endpoint: GET /kfa-v2/products?identifier=kfa&code={code}
// Dokumentasi: https://satusehat.kemkes.go.id/platform/docs/id/master-data/kfa/rest-api-kfa/
func LookupKFAByCode(c *gin.Context) {
	kfaCode := c.Param("code")
	if kfaCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode KFA diperlukan"})
		return
	}

	// Get SatuSehat token
	token, err := GetSatuSehatToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan token SatuSehat: " + err.Error()})
		return
	}

	// Get SatuSehat config for base URL
	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan konfigurasi SatuSehat"})
		return
	}

	baseURL := getSatuSehatBaseURL(configMap)

	// SatuSehat KFA API endpoint - sesuai dokumentasi resmi
	// Format: GET /kfa-v2/products?identifier=kfa&code={code}
	apiURL := baseURL + "/kfa-v2/products?identifier=kfa&code=" + kfaCode

	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghubungi SatuSehat: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{
			"error":    "SatuSehat API error",
			"response": string(body),
			"url":      apiURL, // Debug info
		})
		return
	}

	// Parse response sesuai dokumentasi: { "search_code": "...", "search_identifier": "...", "result": {...} }
	var kfaResponse struct {
		SearchCode       string `json:"search_code"`
		SearchIdentifier string `json:"search_identifier"`
		Result           struct {
			Name         string `json:"name"`
			KFACode      string `json:"kfa_code"`
			Active       bool   `json:"active"`
			NIE          string `json:"nie"`
			NamaDagang   string `json:"nama_dagang"`
			Manufacturer string `json:"manufacturer"`
			DosageForm   struct {
				Code string `json:"code"`
				Name string `json:"name"`
			} `json:"dosage_form"`
			FarmalkesType struct {
				Code  string `json:"code"`
				Name  string `json:"name"`
				Group string `json:"group"`
			} `json:"farmalkes_type"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &kfaResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Gagal parse response KFA",
			"response": string(body),
		})
		return
	}

	if kfaResponse.Result.KFACode == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kode KFA tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"found": true,
		"data": gin.H{
			"kfa_code":     kfaResponse.Result.KFACode,
			"name":         kfaResponse.Result.Name,
			"display_name": kfaResponse.Result.NamaDagang,
			"manufacturer": kfaResponse.Result.Manufacturer,
			"dosage_form":  kfaResponse.Result.DosageForm.Name,
			"farmalkes":    kfaResponse.Result.FarmalkesType.Code,
			"nie":          kfaResponse.Result.NIE,
		},
	})
}

// SearchKFAFromSatuSehat searches KFA products from SatuSehat API
func SearchKFAFromSatuSehat(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter pencarian diperlukan"})
		return
	}

	// Get SatuSehat token
	token, err := GetSatuSehatToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan token SatuSehat: " + err.Error()})
		return
	}

	// Get SatuSehat config for base URL
	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan konfigurasi SatuSehat"})
		return
	}

	baseURL := getSatuSehatBaseURL(configMap)

	// SatuSehat KFA API endpoint - search by keyword
	apiURL := baseURL + "/kfa-v2/products?name=" + query + "&page=1&size=20&product_type=farmasi"

	client := &http.Client{Timeout: 30 * time.Second}
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghubungi SatuSehat: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{
			"error":    "SatuSehat API error",
			"response": string(body),
		})
		return
	}

	// Parse response - try both formats
	var results []gin.H

	// Try flat data format first
	var flatResponse struct {
		Total int          `json:"total"`
		Data  []KFAProduct `json:"data"`
	}
	if err := json.Unmarshal(body, &flatResponse); err == nil && len(flatResponse.Data) > 0 {
		for _, product := range flatResponse.Data {
			results = append(results, gin.H{
				"kfa_code":     product.KFACode,
				"name":         product.Name,
				"display_name": product.DisplayName,
				"manufacturer": product.Manufacturer,
				"dosage_form":  product.Dosage,
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"total": flatResponse.Total,
			"data":  results,
		})
		return
	}

	// Try nested format
	var nestedResponse KFAProductResponse
	if err := json.Unmarshal(body, &nestedResponse); err == nil {
		for _, group := range nestedResponse.Data.ProductsGroups {
			for _, product := range group.Products {
				results = append(results, gin.H{
					"kfa_code":     product.KFACode,
					"name":         product.Name,
					"display_name": product.DisplayName,
					"manufacturer": product.Manufacturer,
					"dosage_form":  product.Dosage,
				})
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"total": nestedResponse.Total,
			"data":  results,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total": 0,
		"data":  []gin.H{},
	})
}

// ============================================================================
// Send Standalone Medication Resource to SatuSehat
// ============================================================================

// SendMedicationToSatuSehat sends a standalone FHIR Medication resource to SatuSehat
// based on an existing MedicineKFAMapping record.
func SendMedicationToSatuSehat(c *gin.Context) {
	mappingID := c.Param("id")

	log.Printf("[MEDICATION] Starting send for mapping ID: %s", mappingID)

	// Load mapping with medicine
	var mapping models.MedicineKFAMapping
	if err := database.DB.Preload("Medicine").First(&mapping, mappingID).Error; err != nil {
		log.Printf("[MEDICATION] ERROR: Mapping not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "KFA mapping tidak ditemukan"})
		return
	}

	// Validate: KFA code must exist
	if mapping.KFACode == "" {
		log.Printf("[MEDICATION] ERROR: KFA code is empty for mapping %d", mapping.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping belum memiliki kode KFA"})
		return
	}

	// Validate: mapping must be active
	if !mapping.IsActive {
		log.Printf("[MEDICATION] ERROR: Mapping %d is not active", mapping.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping tidak aktif"})
		return
	}

	// Check if already sent
	if mapping.SatuSehatMedicationID != "" {
		log.Printf("[MEDICATION] Already sent: %s", mapping.SatuSehatMedicationID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":                    "Medication sudah dikirim ke SatuSehat",
			"satusehat_medication_id":  mapping.SatuSehatMedicationID,
		})
		return
	}

	// Get Organization ID from config
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		log.Printf("[MEDICATION] ERROR: Organization ID not configured")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi di SatuSehat settings"})
		return
	}

	// Determine display name
	displayName := mapping.KFADisplayName
	if displayName == "" {
		displayName = mapping.KFAName
	}

	// Build standalone FHIR Medication resource
	medication := map[string]interface{}{
		"resourceType": "Medication",
		"meta": map[string]interface{}{
			"profile": []string{
				"https://fhir.kemkes.go.id/r4/StructureDefinition/Medication",
			},
		},
		"identifier": []map[string]interface{}{
			{
				"system": "http://sys-ids.kemkes.go.id/medication/" + orgID,
				"use":    "official",
				"value":  fmt.Sprintf("med-%d", mapping.MedicineID),
			},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://sys-ids.kemkes.go.id/kfa",
					"code":    mapping.KFACode,
					"display": displayName,
				},
			},
		},
		"status": "active",
		"extension": []map[string]interface{}{
			{
				"url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
				"valueCodeableConcept": map[string]interface{}{
					"coding": []map[string]interface{}{
						{
							"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-type",
							"code":    "NC",
							"display": "Non-compound",
						},
					},
				},
			},
		},
	}

	// Add form if available
	if mapping.KFAForm != "" {
		formCode, formDisplay := mapMedicationForm(mapping.KFAForm)
		if formCode != "" {
			medication["form"] = map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-form",
						"code":    formCode,
						"display": formDisplay,
					},
				},
			}
		}
	}

	log.Printf("[MEDICATION] Sending to SatuSehat: KFA=%s, Name=%s", mapping.KFACode, displayName)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Medication", medication)
	if err != nil {
		log.Printf("[MEDICATION] ERROR: Request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION] Response [%d]: %s", statusCode, string(body))

	if statusCode != http.StatusCreated && statusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		log.Printf("[MEDICATION] ERROR: SatuSehat rejected with status %d", statusCode)
		c.JSON(statusCode, gin.H{
			"error":              "SatuSehat menolak request",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		log.Printf("[MEDICATION] ERROR: Failed to parse response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	medicationID, ok := fhirResponse["id"].(string)
	if !ok {
		log.Printf("[MEDICATION] ERROR: No ID in response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Response tidak mengandung ID"})
		return
	}

	log.Printf("[MEDICATION] SUCCESS: Got ID %s", medicationID)

	// Save SatuSehat Medication ID to mapping
	now := time.Now()
	mapping.SatuSehatMedicationID = medicationID
	mapping.SatuSehatSentAt = &now
	if err := database.DB.Save(&mapping).Error; err != nil {
		log.Printf("[MEDICATION] ERROR: Failed to save ID: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ID SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION] Completed successfully for mapping %s", mappingID)

	c.JSON(http.StatusOK, gin.H{
		"message":                   "Medication berhasil dikirim ke SatuSehat",
		"mapping_id":                mapping.ID,
		"medicine_name":             displayName,
		"kfa_code":                  mapping.KFACode,
		"satusehat_medication_id":   medicationID,
		"fhir_response":             fhirResponse,
	})
}
