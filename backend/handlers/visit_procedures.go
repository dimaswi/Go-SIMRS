package handlers

import (
	"net/http"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// VISIT PROCEDURE HANDLERS
// Tindakan yang dilakukan langsung di ruangan visit (bukan order)
// ===========================================================================

// GetRoomProceduresForVisit returns all procedures assigned to the visit's room
// Mengambil daftar tindakan yang tersedia di ruangan visit
func GetRoomProceduresForVisit(c *gin.Context) {
	visitID := c.Param("id")

	// Get visit with room
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Check if room allows procedures (rawat_jalan, rawat_inap, gawat_darurat)
	allowedServiceTypes := []string{"rawat_jalan", "rawat_inap", "gawat_darurat"}
	isAllowed := false
	for _, st := range allowedServiceTypes {
		if visit.Room != nil && visit.Room.ServiceType == st {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		c.JSON(http.StatusOK, gin.H{
			"data":    []interface{}{},
			"message": "Ruangan ini tidak mendukung pencatatan tindakan",
		})
		return
	}

	// Get procedures assigned to this room
	var roomProcedures []models.RoomProcedure
	if err := database.DB.
		Where("room_id = ? AND is_available = ?", visit.RoomID, true).
		Preload("Procedure", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true)
		}).
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Find(&roomProcedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data tindakan"})
		return
	}

	// Extract procedures from room_procedures
	var procedures []gin.H
	for _, rp := range roomProcedures {
		if rp.Procedure != nil {
			procedures = append(procedures, gin.H{
				"id":               rp.Procedure.ID,
				"code":             rp.Procedure.Code,
				"name":             rp.Procedure.Name,
				"description":      rp.Procedure.Description,
				"procedure_type":   rp.Procedure.ProcedureType,
				"duration":         rp.Procedure.Duration,
				"requires_booking": rp.RequiresBooking,
				"max_per_day":      rp.MaxPerDay,
				"parameters":       rp.Procedure.Parameters,
				"has_parameters":   len(rp.Procedure.Parameters) > 0,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": procedures})
}

// GetVisitProcedures returns all procedures performed during a visit
// Mengambil daftar tindakan yang sudah dilakukan pada kunjungan
func GetVisitProcedures(c *gin.Context) {
	visitID := c.Param("id")

	var visitProcedures []models.VisitProcedure
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Results").
		Preload("Results.Parameter").
		Preload("CreatedBy").
		Preload("FilledBy").
		Order("created_at DESC").
		Find(&visitProcedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": visitProcedures})
}

// GetVisitProcedure returns a single visit procedure with results
func GetVisitProcedure(c *gin.Context) {
	visitID := c.Param("id")
	procedureID := c.Param("procedureId")

	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, procedureID).
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Results").
		Preload("Results.Parameter").
		Preload("CreatedBy").
		Preload("FilledBy").
		First(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": visitProcedure})
}

// CreateVisitProcedure adds a new procedure to a visit
func CreateVisitProcedure(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		ProcedureID uint   `json:"procedure_id" binding:"required"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify visit exists
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Check if room allows procedures
	allowedServiceTypes := []string{"rawat_jalan", "rawat_inap", "gawat_darurat"}
	isAllowed := false
	for _, st := range allowedServiceTypes {
		if visit.Room != nil && visit.Room.ServiceType == st {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan ini tidak mendukung pencatatan tindakan"})
		return
	}

	// Verify procedure exists and is assigned to this room
	var roomProcedure models.RoomProcedure
	if err := database.DB.
		Where("room_id = ? AND procedure_id = ? AND is_available = ?", visit.RoomID, input.ProcedureID, true).
		First(&roomProcedure).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tindakan tidak tersedia di ruangan ini"})
		return
	}

	// Create visit procedure
	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}

	visitProcedure := models.VisitProcedure{
		VisitID:     visit.ID,
		ProcedureID: input.ProcedureID,
		Status:      models.VisitProcedureStatusPending,
		Notes:       input.Notes,
		CreatedByID: createdByID,
	}

	if err := database.DB.Create(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan tindakan"})
		return
	}

	// Reload with relations
	database.DB.
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("CreatedBy").
		First(&visitProcedure, visitProcedure.ID)

	c.JSON(http.StatusCreated, gin.H{"data": visitProcedure})
}

// SaveVisitProcedureResults saves/updates results for a visit procedure
func SaveVisitProcedureResults(c *gin.Context) {
	visitID := c.Param("id")
	procedureID := c.Param("procedureId")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		Status  string `json:"status"`
		Notes   string `json:"notes"`
		Results []struct {
			ParameterID uint    `json:"parameter_id"`
			Value       string  `json:"value"`
			NumValue    float64 `json:"num_value"`
			IsAbnormal  bool    `json:"is_abnormal"`
			IsCritical  bool    `json:"is_critical"`
		} `json:"results"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get visit procedure
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, procedureID).
		Preload("Procedure.Parameters").
		First(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tindakan tidak ditemukan"})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Update visit procedure status and notes
	var filledByID *uint
	if userID > 0 {
		filledByID = &userID
	}

	now := time.Now()
	updates := map[string]interface{}{
		"filled_by_id": filledByID,
		"notes":        input.Notes,
	}

	if input.Status != "" {
		updates["status"] = input.Status
		if input.Status == models.VisitProcedureStatusCompleted {
			updates["performed_at"] = &now
		}
	}

	if err := tx.Model(&visitProcedure).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data tindakan"})
		return
	}

	// Delete existing results and create new ones
	if err := tx.Where("visit_procedure_id = ?", visitProcedure.ID).Delete(&models.VisitProcedureResult{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus hasil sebelumnya"})
		return
	}

	// Create new results
	for _, result := range input.Results {
		// Verify parameter belongs to this procedure
		validParam := false
		for _, p := range visitProcedure.Procedure.Parameters {
			if p.ID == result.ParameterID {
				validParam = true
				break
			}
		}

		if !validParam {
			continue // Skip invalid parameters
		}

		newResult := models.VisitProcedureResult{
			VisitProcedureID: visitProcedure.ID,
			ParameterID:      result.ParameterID,
			Value:            result.Value,
			NumValue:         result.NumValue,
			IsAbnormal:       result.IsAbnormal,
			IsCritical:       result.IsCritical,
			FilledByID:       filledByID,
		}

		if err := tx.Create(&newResult).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan hasil tindakan"})
			return
		}
	}

	tx.Commit()

	// Reload with relations
	database.DB.
		Preload("Procedure").
		Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Results").
		Preload("Results.Parameter").
		Preload("CreatedBy").
		Preload("FilledBy").
		First(&visitProcedure, visitProcedure.ID)

	c.JSON(http.StatusOK, gin.H{"data": visitProcedure})
}

// DeleteVisitProcedure removes a procedure from a visit
func DeleteVisitProcedure(c *gin.Context) {
	visitID := c.Param("id")
	procedureID := c.Param("procedureId")

	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, procedureID).
		First(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tindakan tidak ditemukan"})
		return
	}

	// Only allow deletion if status is pending
	if visitProcedure.Status != models.VisitProcedureStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tindakan yang sudah dikerjakan tidak dapat dihapus"})
		return
	}

	// Delete results first
	database.DB.Where("visit_procedure_id = ?", visitProcedure.ID).Delete(&models.VisitProcedureResult{})

	// Delete the visit procedure
	if err := database.DB.Delete(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tindakan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus"})
}

// UpdateVisitProcedureStatus updates the status of a visit procedure
func UpdateVisitProcedureStatus(c *gin.Context) {
	visitID := c.Param("id")
	procedureID := c.Param("procedureId")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate status
	validStatuses := []string{
		models.VisitProcedureStatusPending,
		models.VisitProcedureStatusInProgress,
		models.VisitProcedureStatusCompleted,
		models.VisitProcedureStatusCancelled,
	}
	isValid := false
	for _, s := range validStatuses {
		if input.Status == s {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid"})
		return
	}

	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, procedureID).
		First(&visitProcedure).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tindakan tidak ditemukan"})
		return
	}

	updates := map[string]interface{}{
		"status": input.Status,
	}

	if userID > 0 {
		updates["filled_by_id"] = userID
	}

	if input.Status == models.VisitProcedureStatusCompleted {
		now := time.Now()
		updates["performed_at"] = &now
	}

	if err := database.DB.Model(&visitProcedure).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status"})
		return
	}

	// Reload with relations
	database.DB.
		Preload("Procedure").
		Preload("CreatedBy").
		Preload("FilledBy").
		First(&visitProcedure, visitProcedure.ID)

	c.JSON(http.StatusOK, gin.H{"data": visitProcedure})
}
