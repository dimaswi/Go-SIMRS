package handlers

import (
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// GetFallRiskAssessments returns all fall risk assessments for a visit
func GetFallRiskAssessments(c *gin.Context) {
	visitID := c.Param("id")

	var records []models.FallRiskAssessment
	query := scopedRMQuery(c, visitID).
		Preload("AssessedBy").
		Order("record_date DESC, created_at DESC")

	if scaleType := c.Query("scale_type"); scaleType != "" {
		query = query.Where("scale_type = ?", scaleType)
	}

	if err := query.Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data pengkajian risiko jatuh"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records})
}

// GetFallRiskAssessment returns a single fall risk assessment record
func GetFallRiskAssessment(c *gin.Context) {
	visitID := c.Param("id")
	assessmentID := c.Param("assessmentId")

	var record models.FallRiskAssessment
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", assessmentID).
		Preload("AssessedBy").
		First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pengkajian risiko jatuh tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": record})
}

// CreateFallRiskAssessment creates a new fall risk assessment
func CreateFallRiskAssessment(c *gin.Context) {
	visitID := c.Param("id")
	isCasemix := c.Query("is_casemix") == "true"
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RecordDate string `json:"record_date" binding:"required"`
		ScaleType  string `json:"scale_type" binding:"required"`
		ItemsJSON  string `json:"items_json" binding:"required"`
		TotalScore int    `json:"total_score"`
		RiskLevel  string `json:"risk_level" binding:"required"`
		RiskAction string `json:"risk_action"`
		Notes      string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visitIDUint, _ := strconv.ParseUint(visitID, 10, 32)
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, visitIDUint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	recordDate, err := ParseLocalDate(input.RecordDate)
	if err != nil {
		recordDate = time.Now()
	}

	var assessedByID *uint
	if userID > 0 {
		assessedByID = &userID
	}

	assessment := models.FallRiskAssessment{
		VisitID:         uint(visitIDUint),
		IsCasemix:       isCasemix,
		CasemixEklaimID: getCasemixEklaimID(c),
		RecordDate:      recordDate,
		ScaleType:       input.ScaleType,
		ItemsJSON:       input.ItemsJSON,
		TotalScore:      input.TotalScore,
		RiskLevel:       input.RiskLevel,
		RiskAction:      input.RiskAction,
		Notes:           input.Notes,
		AssessedByID:    assessedByID,
	}

	if err := database.DB.Create(&assessment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pengkajian risiko jatuh"})
		return
	}

	database.DB.Preload("AssessedBy").First(&assessment, assessment.ID)

	c.JSON(http.StatusCreated, gin.H{"data": assessment})
}

// UpdateFallRiskAssessment updates a fall risk assessment
func UpdateFallRiskAssessment(c *gin.Context) {
	visitID := c.Param("id")
	assessmentID := c.Param("assessmentId")

	var assessment models.FallRiskAssessment
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", assessmentID).
		First(&assessment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pengkajian risiko jatuh tidak ditemukan"})
		return
	}

	var input struct {
		RecordDate string `json:"record_date"`
		ScaleType  string `json:"scale_type"`
		ItemsJSON  string `json:"items_json"`
		TotalScore int    `json:"total_score"`
		RiskLevel  string `json:"risk_level"`
		RiskAction string `json:"risk_action"`
		Notes      string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"scale_type":  input.ScaleType,
		"items_json":  input.ItemsJSON,
		"total_score": input.TotalScore,
		"risk_level":  input.RiskLevel,
		"risk_action": input.RiskAction,
		"notes":       input.Notes,
	}

	if input.RecordDate != "" {
		if rd, err := ParseLocalDate(input.RecordDate); err == nil {
			updates["record_date"] = rd
		}
	}

	if err := database.DB.Model(&assessment).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui pengkajian risiko jatuh"})
		return
	}

	database.DB.Preload("AssessedBy").First(&assessment, assessment.ID)

	c.JSON(http.StatusOK, gin.H{"data": assessment})
}

// DeleteFallRiskAssessment deletes a fall risk assessment
func DeleteFallRiskAssessment(c *gin.Context) {
	visitID := c.Param("id")
	assessmentID := c.Param("assessmentId")

	var assessment models.FallRiskAssessment
	if err := scopedRMQuery(c, visitID).
		Where("id = ?", assessmentID).
		First(&assessment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pengkajian risiko jatuh tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&assessment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pengkajian risiko jatuh"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pengkajian risiko jatuh berhasil dihapus"})
}
