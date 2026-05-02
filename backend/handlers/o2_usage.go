package handlers

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// GetO2UsageRecords returns all O2 usage records for a visit
func GetO2UsageRecords(c *gin.Context) {
	visitID := c.Param("id")

	var records []models.O2UsageRecord
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("CreatedBy").
		Preload("StoppedBy").
		Order("started_at DESC").
		Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data penggunaan oksigen"})
		return
	}

	// Calculate running duration for active sessions
	now := time.Now()
	for i := range records {
		if records[i].StoppedAt == nil {
			records[i].DurationMinutes = int(now.Sub(records[i].StartedAt).Minutes())
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// GetO2UsageRecord returns a single O2 usage record
func GetO2UsageRecord(c *gin.Context) {
	visitID := c.Param("id")
	recordID := c.Param("recordId")

	var record models.O2UsageRecord
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, recordID).
		Preload("CreatedBy").
		Preload("StoppedBy").
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan oksigen tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// StartO2Usage starts a new O2 usage session
func StartO2Usage(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		TankType       string  `json:"tank_type" binding:"required"`
		FlowRate       float64 `json:"flow_rate" binding:"required"`
		DeliveryMethod string  `json:"delivery_method" binding:"required"`
		StartedAt      string  `json:"started_at"`
		BasePrice      float64 `json:"base_price"`
		Notes          string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	var visit models.Visit
	if err := database.DB.First(&visit, visitIDUint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	startedAt, ok := TryParseLocalDatetime(input.StartedAt)
	if !ok {
		startedAt = time.Now()
	}

	var createdByID *uint
	if userID > 0 {
		createdByID = &userID
	}


	record := models.O2UsageRecord{
		VisitID:        uint(visitIDUint),
		TankType:       input.TankType,
		FlowRate:       input.FlowRate,
		DeliveryMethod: input.DeliveryMethod,
		StartedAt:      startedAt,
		BasePrice:      input.BasePrice,
		TotalCharge:    0, // Will be computed on stop
		Notes:          input.Notes,
		CreatedByID:    createdByID,
	}

	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai penggunaan oksigen"})
		return
	}

	database.DB.Preload("CreatedBy").First(&record, record.ID)
	c.JSON(http.StatusCreated, gin.H{"data": record})
}

// StopO2Usage stops an active O2 usage session and finalizes billing
func StopO2Usage(c *gin.Context) {
	visitID := c.Param("id")
	recordID := c.Param("recordId")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var record models.O2UsageRecord
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, recordID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan oksigen tidak ditemukan"})
		return
	}

	if record.StoppedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sesi oksigen sudah dihentikan sebelumnya"})
		return
	}

	var input struct {
		StoppedAt string  `json:"stopped_at"`
		BasePrice float64 `json:"base_price"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stoppedAt, ok := TryParseLocalDatetime(input.StoppedAt)
	if !ok {
		stoppedAt = time.Now()
	}

	if stoppedAt.Before(record.StartedAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu berhenti tidak boleh sebelum waktu mulai"})
		return
	}

	duration := stoppedAt.Sub(record.StartedAt).Minutes()
	durationMinutes := int(math.Ceil(duration))

	basePrice := input.BasePrice
	if basePrice <= 0 {
		basePrice = record.BasePrice
	}

	var stoppedByID *uint
	if userID > 0 {
		stoppedByID = &userID
	}

	updates := map[string]interface{}{
		"stopped_at":       stoppedAt,
		"duration_minutes": durationMinutes,
		"base_price":       basePrice,
		"total_charge":     math.Round(record.FlowRate * float64(durationMinutes) * basePrice),
		"stopped_by_id":    stoppedByID,
	}

	if err := database.DB.Model(&record).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghentikan penggunaan oksigen"})
		return
	}

	database.DB.Preload("CreatedBy").Preload("StoppedBy").First(&record, record.ID)
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// UpdateO2Usage updates an O2 usage record (notes, times, tank details)
func UpdateO2Usage(c *gin.Context) {
	visitID := c.Param("id")
	recordID := c.Param("recordId")

	var record models.O2UsageRecord
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, recordID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan oksigen tidak ditemukan"})
		return
	}

	var input struct {
		StartedAt      string  `json:"started_at"`
		StoppedAt      string  `json:"stopped_at"`
		FlowRate       float64 `json:"flow_rate"`
		DeliveryMethod string  `json:"delivery_method"`
		TankType       string  `json:"tank_type"`
		BasePrice      float64 `json:"base_price"`
		Notes          string  `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"notes": input.Notes,
	}

	if input.FlowRate > 0 {
		updates["flow_rate"] = input.FlowRate
	}
	if input.DeliveryMethod != "" {
		updates["delivery_method"] = input.DeliveryMethod
	}
	if input.TankType != "" {
		updates["tank_type"] = input.TankType
	}
	if input.BasePrice > 0 {
		updates["base_price"] = input.BasePrice
	}

	if input.StartedAt != "" {
		if st, ok := TryParseLocalDatetime(input.StartedAt); ok {
			updates["started_at"] = st
		}
	}
	if input.StoppedAt != "" {
		if st, ok := TryParseLocalDatetime(input.StoppedAt); ok {
			updates["stopped_at"] = st
		}
	}

	// Recalculate duration and total if both start and stop exist
	if err := database.DB.Model(&record).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data penggunaan oksigen"})
		return
	}

	// Reload and recalculate
	database.DB.First(&record, record.ID)
	if record.StoppedAt != nil {
		dur := int(math.Ceil(record.StoppedAt.Sub(record.StartedAt).Minutes()))
		charge := math.Round(record.FlowRate * float64(dur) * record.BasePrice)
		database.DB.Model(&record).Updates(map[string]interface{}{
			"duration_minutes": dur,
			"total_charge":     charge,
		})
	}

	database.DB.Preload("CreatedBy").Preload("StoppedBy").First(&record, record.ID)
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// DeleteO2Usage deletes an O2 usage record
func DeleteO2Usage(c *gin.Context) {
	visitID := c.Param("id")
	recordID := c.Param("recordId")

	var record models.O2UsageRecord
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, recordID).
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan oksigen tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data penggunaan oksigen"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data penggunaan oksigen berhasil dihapus"})
}
