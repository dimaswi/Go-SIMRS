package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
)

// ===========================================================================
// ICD-10 HANDLERS
// ===========================================================================

// SearchICD10 searches ICD-10 codes by code or display name
// GET /api/icd10?search=keyword&limit=20&valid_only=true
func SearchICD10(c *gin.Context) {
	search := c.Query("search")
	limitStr := c.DefaultQuery("limit", "20")
	validOnly := c.DefaultQuery("valid_only", "true")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var results []models.ICD10
	query := database.DB.Model(&models.ICD10{}).Where("is_active = ?", true)

	// Filter only valid codes (not headers)
	if validOnly == "true" {
		query = query.Where("valid_code = ?", true)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where(
			"code ILIKE ? OR code2 ILIKE ? OR display ILIKE ?",
			searchPattern, searchPattern, searchPattern,
		)
	}

	if err := query.Order("code ASC").Limit(limit).Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search ICD-10"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GetICD10ByCode gets a single ICD-10 code by exact code
// GET /api/icd10/:code
func GetICD10ByCode(c *gin.Context) {
	code := c.Param("code")

	var icd models.ICD10
	if err := database.DB.Where("code = ? OR code2 = ?", code, code).First(&icd).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-10 code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-10"})
		return
	}

	c.JSON(http.StatusOK, icd)
}

// GetICD10Chapters gets all ICD-10 chapters (header codes)
// GET /api/icd10/chapters
func GetICD10Chapters(c *gin.Context) {
	var results []models.ICD10

	// Get all header codes (valid_code = false, typically 3-char codes without subcategory)
	if err := database.DB.Where("is_active = ? AND valid_code = ? AND LENGTH(code) <= 3", true, false).
		Order("code ASC").Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chapters"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GetICD10Stats gets statistics about ICD-10 data
// GET /api/icd10/stats
func GetICD10Stats(c *gin.Context) {
	var total, valid, headers int64

	database.DB.Model(&models.ICD10{}).Where("is_active = ?", true).Count(&total)
	database.DB.Model(&models.ICD10{}).Where("is_active = ? AND valid_code = ?", true, true).Count(&valid)
	database.DB.Model(&models.ICD10{}).Where("is_active = ? AND valid_code = ?", true, false).Count(&headers)

	c.JSON(http.StatusOK, gin.H{
		"total":   total,
		"valid":   valid,
		"headers": headers,
	})
}

// ===========================================================================
// ICD-9-CM HANDLERS
// ===========================================================================

// SearchICD9CM searches ICD-9-CM procedure codes
// GET /api/icd9cm?search=keyword&limit=20&valid_only=true
func SearchICD9CM(c *gin.Context) {
	search := c.Query("search")
	limitStr := c.DefaultQuery("limit", "20")
	validOnly := c.DefaultQuery("valid_only", "true")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var results []models.ICD9CM
	query := database.DB.Model(&models.ICD9CM{}).Where("is_active = ?", true)

	if validOnly == "true" {
		query = query.Where("valid_code = ?", true)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where(
			"code ILIKE ? OR code2 ILIKE ? OR display ILIKE ?",
			searchPattern, searchPattern, searchPattern,
		)
	}

	if err := query.Order("code ASC").Limit(limit).Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search ICD-9-CM"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GetICD9CMByCode gets a single ICD-9-CM code by exact code
// GET /api/icd9cm/:code
func GetICD9CMByCode(c *gin.Context) {
	code := c.Param("code")

	var icd models.ICD9CM
	if err := database.DB.Where("code = ? OR code2 = ?", code, code).First(&icd).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-9-CM code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-9-CM"})
		return
	}

	c.JSON(http.StatusOK, icd)
}

// GetICD9CMStats gets statistics about ICD-9-CM data
// GET /api/icd9cm/stats
func GetICD9CMStats(c *gin.Context) {
	var total, valid, headers int64

	database.DB.Model(&models.ICD9CM{}).Where("is_active = ?", true).Count(&total)
	database.DB.Model(&models.ICD9CM{}).Where("is_active = ? AND valid_code = ?", true, true).Count(&valid)
	database.DB.Model(&models.ICD9CM{}).Where("is_active = ? AND valid_code = ?", true, false).Count(&headers)

	c.JSON(http.StatusOK, gin.H{
		"total":   total,
		"valid":   valid,
		"headers": headers,
	})
}

// ===========================================================================
// ICD-O MORPHOLOGY HANDLERS
// ===========================================================================

// SearchICDOMorphology searches ICD-O Morphology codes
// GET /api/icdo?search=keyword&limit=20
func SearchICDOMorphology(c *gin.Context) {
	search := c.Query("search")
	limitStr := c.DefaultQuery("limit", "20")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var results []models.ICDOMorphology
	query := database.DB.Model(&models.ICDOMorphology{}).Where("is_active = ?", true)

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where(
			"code ILIKE ? OR code2 ILIKE ? OR display ILIKE ?",
			searchPattern, searchPattern, searchPattern,
		)
	}

	if err := query.Order("code ASC").Limit(limit).Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search ICD-O"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// ===========================================================================
// ICD-10 CRUD HANDLERS
// ===========================================================================

// CreateICD10 creates a new ICD-10 code
// POST /api/icd10
func CreateICD10(c *gin.Context) {
	var input models.ICD10
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code
	var existing models.ICD10
	if err := database.DB.Where("code = ?", input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "ICD-10 code already exists"})
		return
	}

	input.IsActive = true
	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ICD-10"})
		return
	}

	c.JSON(http.StatusCreated, input)
}

// UpdateICD10 updates an existing ICD-10 code
// PUT /api/icd10/:id
func UpdateICD10(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD10
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-10 code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-10"})
		return
	}

	var input models.ICD10
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code if code is being changed
	if input.Code != icd.Code {
		var existing models.ICD10
		if err := database.DB.Where("code = ? AND id != ?", input.Code, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "ICD-10 code already exists"})
			return
		}
	}

	// Update fields
	icd.Code = input.Code
	icd.Code2 = input.Code2
	icd.Display = input.Display
	icd.ValidCode = input.ValidCode
	icd.AccPdx = input.AccPdx
	icd.Asterisk = input.Asterisk
	icd.IM = input.IM
	icd.Chapter = input.Chapter
	icd.ChapterName = input.ChapterName
	icd.IsActive = input.IsActive

	if err := database.DB.Save(&icd).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ICD-10"})
		return
	}

	c.JSON(http.StatusOK, icd)
}

// DeleteICD10 deletes an ICD-10 code (soft delete by setting is_active to false)
// DELETE /api/icd10/:id
func DeleteICD10(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD10
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-10 code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-10"})
		return
	}

	// Soft delete
	icd.IsActive = false
	if err := database.DB.Save(&icd).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ICD-10"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ICD-10 code deleted successfully"})
}

// GetICD10ByID gets a single ICD-10 code by ID
// GET /api/icd10/id/:id
func GetICD10ByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD10
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-10 code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-10"})
		return
	}

	c.JSON(http.StatusOK, icd)
}

// ===========================================================================
// ICD-9-CM CRUD HANDLERS
// ===========================================================================

// CreateICD9CM creates a new ICD-9-CM code
// POST /api/icd9cm
func CreateICD9CM(c *gin.Context) {
	var input models.ICD9CM
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code
	var existing models.ICD9CM
	if err := database.DB.Where("code = ?", input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "ICD-9-CM code already exists"})
		return
	}

	input.IsActive = true
	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ICD-9-CM"})
		return
	}

	c.JSON(http.StatusCreated, input)
}

// UpdateICD9CM updates an existing ICD-9-CM code
// PUT /api/icd9cm/:id
func UpdateICD9CM(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD9CM
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-9-CM code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-9-CM"})
		return
	}

	var input models.ICD9CM
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code if code is being changed
	if input.Code != icd.Code {
		var existing models.ICD9CM
		if err := database.DB.Where("code = ? AND id != ?", input.Code, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "ICD-9-CM code already exists"})
			return
		}
	}

	// Update fields
	icd.Code = input.Code
	icd.Code2 = input.Code2
	icd.Display = input.Display
	icd.ValidCode = input.ValidCode
	icd.IsActive = input.IsActive

	if err := database.DB.Save(&icd).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ICD-9-CM"})
		return
	}

	c.JSON(http.StatusOK, icd)
}

// DeleteICD9CM deletes an ICD-9-CM code (soft delete by setting is_active to false)
// DELETE /api/icd9cm/:id
func DeleteICD9CM(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD9CM
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-9-CM code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-9-CM"})
		return
	}

	// Soft delete
	icd.IsActive = false
	if err := database.DB.Save(&icd).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ICD-9-CM"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ICD-9-CM code deleted successfully"})
}

// GetICD9CMByID gets a single ICD-9-CM code by ID
// GET /api/icd9cm/id/:id
func GetICD9CMByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var icd models.ICD9CM
	if err := database.DB.First(&icd, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "ICD-9-CM code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get ICD-9-CM"})
		return
	}

	c.JSON(http.StatusOK, icd)
}
