package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"starter/backend/database"
	"starter/backend/models"
)

// ========================================
// PROCEDURE PARAMETER HANDLERS
// ========================================

// GetProcedureParameters returns all parameters for a procedure
func GetProcedureParameters(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, procedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	var parameters []models.ProcedureParameter
	query := database.DB.Where("procedure_id = ?", procedureID).Order("sort_order ASC")

	// Filter by active status
	if c.Query("active_only") == "true" {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Find(&parameters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data parameter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": parameters})
}

// GetProcedureParameter returns a single parameter
func GetProcedureParameter(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	paramID, err := strconv.ParseUint(c.Param("paramId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID parameter tidak valid"})
		return
	}

	var parameter models.ProcedureParameter
	if err := database.DB.Where("id = ? AND procedure_id = ?", paramID, procedureID).First(&parameter).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parameter tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": parameter})
}

// CreateProcedureParameter creates a new parameter for a procedure
func CreateProcedureParameter(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, procedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	var input struct {
		Code          string  `json:"code" binding:"required"`
		Name          string  `json:"name" binding:"required"`
		Description   string  `json:"description"`
		InputType     string  `json:"input_type"`
		Options       string  `json:"options"`
		Unit          string  `json:"unit"`
		NormalMin     float64 `json:"normal_min"`
		NormalMax     float64 `json:"normal_max"`
		NormalText    string  `json:"normal_text"`
		CriticalMin   float64 `json:"critical_min"`
		CriticalMax   float64 `json:"critical_max"`
		DecimalPlaces int     `json:"decimal_places"`
		IsRequired    bool    `json:"is_required"`
		SortOrder     int     `json:"sort_order"`
		IsActive      *bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default input type
	if input.InputType == "" {
		input.InputType = models.InputTypeText
	}

	// Default is_active
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	// Check for duplicate code in same procedure
	var existing models.ProcedureParameter
	if err := database.DB.Where("procedure_id = ? AND code = ?", procedureID, input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode parameter sudah ada untuk tindakan ini"})
		return
	}

	// Get next sort order if not provided
	if input.SortOrder == 0 {
		var maxSort int
		database.DB.Model(&models.ProcedureParameter{}).
			Where("procedure_id = ?", procedureID).
			Select("COALESCE(MAX(sort_order), 0)").
			Scan(&maxSort)
		input.SortOrder = maxSort + 1
	}

	parameter := models.ProcedureParameter{
		ProcedureID:   uint(procedureID),
		Code:          input.Code,
		Name:          input.Name,
		Description:   input.Description,
		InputType:     input.InputType,
		Options:       input.Options,
		Unit:          input.Unit,
		NormalMin:     input.NormalMin,
		NormalMax:     input.NormalMax,
		NormalText:    input.NormalText,
		CriticalMin:   input.CriticalMin,
		CriticalMax:   input.CriticalMax,
		DecimalPlaces: input.DecimalPlaces,
		IsRequired:    input.IsRequired,
		SortOrder:     input.SortOrder,
		IsActive:      isActive,
	}

	if err := database.DB.Create(&parameter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat parameter"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    parameter,
		"message": "Parameter berhasil dibuat",
	})
}

// UpdateProcedureParameter updates an existing parameter
func UpdateProcedureParameter(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	paramID, err := strconv.ParseUint(c.Param("paramId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID parameter tidak valid"})
		return
	}

	var parameter models.ProcedureParameter
	if err := database.DB.Where("id = ? AND procedure_id = ?", paramID, procedureID).First(&parameter).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parameter tidak ditemukan"})
		return
	}

	var input struct {
		Code          string  `json:"code"`
		Name          string  `json:"name"`
		Description   string  `json:"description"`
		InputType     string  `json:"input_type"`
		Options       string  `json:"options"`
		Unit          string  `json:"unit"`
		NormalMin     float64 `json:"normal_min"`
		NormalMax     float64 `json:"normal_max"`
		NormalText    string  `json:"normal_text"`
		CriticalMin   float64 `json:"critical_min"`
		CriticalMax   float64 `json:"critical_max"`
		DecimalPlaces int     `json:"decimal_places"`
		IsRequired    *bool   `json:"is_required"`
		SortOrder     int     `json:"sort_order"`
		IsActive      *bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code if changed
	if input.Code != "" && input.Code != parameter.Code {
		var existing models.ProcedureParameter
		if err := database.DB.Where("procedure_id = ? AND code = ? AND id != ?", procedureID, input.Code, paramID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode parameter sudah ada untuk tindakan ini"})
			return
		}
	}

	// Update fields
	updates := map[string]interface{}{}
	if input.Code != "" {
		updates["code"] = input.Code
	}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	updates["description"] = input.Description
	if input.InputType != "" {
		updates["input_type"] = input.InputType
	}
	updates["options"] = input.Options
	updates["unit"] = input.Unit
	updates["normal_min"] = input.NormalMin
	updates["normal_max"] = input.NormalMax
	updates["normal_text"] = input.NormalText
	updates["critical_min"] = input.CriticalMin
	updates["critical_max"] = input.CriticalMax
	updates["decimal_places"] = input.DecimalPlaces
	if input.IsRequired != nil {
		updates["is_required"] = *input.IsRequired
	}
	if input.SortOrder > 0 {
		updates["sort_order"] = input.SortOrder
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}

	if err := database.DB.Model(&parameter).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui parameter"})
		return
	}

	// Reload
	database.DB.First(&parameter, paramID)

	c.JSON(http.StatusOK, gin.H{
		"data":    parameter,
		"message": "Parameter berhasil diperbarui",
	})
}

// DeleteProcedureParameter deletes a parameter
func DeleteProcedureParameter(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	paramID, err := strconv.ParseUint(c.Param("paramId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID parameter tidak valid"})
		return
	}

	var parameter models.ProcedureParameter
	if err := database.DB.Where("id = ? AND procedure_id = ?", paramID, procedureID).First(&parameter).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parameter tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&parameter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus parameter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Parameter berhasil dihapus"})
}

// BulkCreateProcedureParameters creates multiple parameters at once
func BulkCreateProcedureParameters(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, procedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	var input struct {
		Parameters []struct {
			Code          string  `json:"code" binding:"required"`
			Name          string  `json:"name" binding:"required"`
			Description   string  `json:"description"`
			InputType     string  `json:"input_type"`
			Options       string  `json:"options"`
			Unit          string  `json:"unit"`
			NormalMin     float64 `json:"normal_min"`
			NormalMax     float64 `json:"normal_max"`
			NormalText    string  `json:"normal_text"`
			CriticalMin   float64 `json:"critical_min"`
			CriticalMax   float64 `json:"critical_max"`
			DecimalPlaces int     `json:"decimal_places"`
			IsRequired    bool    `json:"is_required"`
			SortOrder     int     `json:"sort_order"`
		} `json:"parameters" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	var created []models.ProcedureParameter
	for i, p := range input.Parameters {
		// Default input type
		inputType := p.InputType
		if inputType == "" {
			inputType = models.InputTypeText
		}

		// Default sort order
		sortOrder := p.SortOrder
		if sortOrder == 0 {
			sortOrder = i + 1
		}

		parameter := models.ProcedureParameter{
			ProcedureID:   uint(procedureID),
			Code:          p.Code,
			Name:          p.Name,
			Description:   p.Description,
			InputType:     inputType,
			Options:       p.Options,
			Unit:          p.Unit,
			NormalMin:     p.NormalMin,
			NormalMax:     p.NormalMax,
			NormalText:    p.NormalText,
			CriticalMin:   p.CriticalMin,
			CriticalMax:   p.CriticalMax,
			DecimalPlaces: p.DecimalPlaces,
			IsRequired:    p.IsRequired,
			SortOrder:     sortOrder,
			IsActive:      true,
		}

		if err := tx.Create(&parameter).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat parameter: " + p.Code})
			return
		}

		created = append(created, parameter)
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"message": "Parameter berhasil dibuat",
	})
}

// ApplyDefaultParameters applies default parameters based on procedure type
func ApplyDefaultParameters(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, procedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	// Get default parameters based on procedure type
	var defaults []map[string]interface{}
	switch procedure.ProcedureType {
	case models.ProcedureTypeMedical:
		defaults = models.GetDefaultMedicalParameters()
	case models.ProcedureTypeRadiology:
		defaults = models.GetDefaultRadiologyParameters()
	case models.ProcedureTypeLaboratory:
		// For lab, we need to know the specific test type
		// This is a basic implementation - you might want to expand this
		defaults = models.GetDefaultLabParametersDL() // Default to DL
	default:
		defaults = models.GetDefaultMedicalParameters()
	}

	// Start transaction
	tx := database.DB.Begin()

	var created []models.ProcedureParameter
	for _, p := range defaults {
		// Check if already exists
		var existing models.ProcedureParameter
		if err := tx.Where("procedure_id = ? AND code = ?", procedureID, p["code"]).First(&existing).Error; err == nil {
			continue // Skip existing
		}

		parameter := models.ProcedureParameter{
			ProcedureID: uint(procedureID),
			Code:        p["code"].(string),
			Name:        p["name"].(string),
			InputType:   p["input_type"].(string),
			IsRequired:  p["is_required"].(bool),
			SortOrder:   p["sort_order"].(int),
			IsActive:    true,
		}

		// Lab-specific fields
		if unit, ok := p["unit"]; ok {
			parameter.Unit = unit.(string)
		}
		if normalMin, ok := p["normal_min"]; ok {
			parameter.NormalMin = toFloat64(normalMin)
		}
		if normalMax, ok := p["normal_max"]; ok {
			parameter.NormalMax = toFloat64(normalMax)
		}
		if criticalMin, ok := p["critical_min"]; ok {
			parameter.CriticalMin = toFloat64(criticalMin)
		}
		if criticalMax, ok := p["critical_max"]; ok {
			parameter.CriticalMax = toFloat64(criticalMax)
		}
		if decimalPlaces, ok := p["decimal_places"]; ok {
			parameter.DecimalPlaces = decimalPlaces.(int)
		}

		if err := tx.Create(&parameter).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat parameter default"})
			return
		}

		created = append(created, parameter)
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"data":    created,
		"message": "Parameter default berhasil diterapkan",
	})
}

// ReorderParameters reorders parameters
func ReorderParameters(c *gin.Context) {
	procedureID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tindakan tidak valid"})
		return
	}

	var input struct {
		Orders []struct {
			ID        uint `json:"id"`
			SortOrder int  `json:"sort_order"`
		} `json:"orders" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	for _, order := range input.Orders {
		if err := tx.Model(&models.ProcedureParameter{}).
			Where("id = ? AND procedure_id = ?", order.ID, procedureID).
			Update("sort_order", order.SortOrder).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah urutan"})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Urutan parameter berhasil diubah"})
}

// GetProcedureTypes returns all procedure types
func GetProcedureTypes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": models.GetProcedureTypes()})
}

// GetInputTypes returns all input types
func GetInputTypes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": models.GetInputTypes()})
}

// GetDefaultParameterTemplates returns default parameter templates for each procedure type
func GetDefaultParameterTemplates(c *gin.Context) {
	procedureType := c.Query("procedure_type")

	var templates []map[string]interface{}
	switch procedureType {
	case models.ProcedureTypeMedical:
		templates = models.GetDefaultMedicalParameters()
	case models.ProcedureTypeRadiology:
		templates = models.GetDefaultRadiologyParameters()
	case models.ProcedureTypeLaboratory:
		// Return DL as default, client can request specific ones
		templateType := c.Query("template")
		switch templateType {
		case "kimia_darah":
			templates = models.GetDefaultLabParametersKimiaDarah()
		default:
			templates = models.GetDefaultLabParametersDL()
		}
	default:
		templates = models.GetDefaultMedicalParameters()
	}

	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// Helper function to convert interface to float64
func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return 0
	}
}
