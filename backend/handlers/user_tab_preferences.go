package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type upsertMedicalRecordTabPreferenceRequest struct {
	Mode     string   `json:"mode" binding:"required"`
	TabOrder []string `json:"tab_order"`
}

type medicalRecordTabPreferenceResponse struct {
	Mode     string   `json:"mode"`
	TabOrder []string `json:"tab_order"`
}

func getAuthenticatedUserID(c *gin.Context) (uint, bool) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	userID, ok := userIDVal.(uint)
	if !ok || userID == 0 {
		return 0, false
	}
	return userID, true
}

func normalizeTabOrder(tabOrder []string) []string {
	seen := make(map[string]struct{}, len(tabOrder))
	normalized := make([]string, 0, len(tabOrder))

	for _, raw := range tabOrder {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}

	return normalized
}

func GetMedicalRecordTabPreference(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	mode := strings.TrimSpace(c.Query("mode"))
	if mode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode is required"})
		return
	}

	var pref models.UserTabPreference
	err := database.DB.Where("user_id = ? AND mode = ?", userID, mode).First(&pref).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, medicalRecordTabPreferenceResponse{Mode: mode, TabOrder: []string{}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preference"})
		return
	}

	tabOrder := []string{}
	if pref.TabOrder != "" {
		_ = json.Unmarshal([]byte(pref.TabOrder), &tabOrder)
	}

	c.JSON(http.StatusOK, medicalRecordTabPreferenceResponse{Mode: mode, TabOrder: normalizeTabOrder(tabOrder)})
}

func UpsertMedicalRecordTabPreference(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req upsertMedicalRecordTabPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode is required"})
		return
	}

	normalizedTabOrder := normalizeTabOrder(req.TabOrder)
	serialized, err := json.Marshal(normalizedTabOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize preference"})
		return
	}

	pref := models.UserTabPreference{
		UserID:   userID,
		Mode:     mode,
		TabOrder: string(serialized),
	}

	if err := database.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "mode"}},
		DoUpdates: clause.AssignmentColumns([]string{"tab_order", "updated_at"}),
	}).Create(&pref).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preference"})
		return
	}

	c.JSON(http.StatusOK, medicalRecordTabPreferenceResponse{Mode: mode, TabOrder: normalizedTabOrder})
}
