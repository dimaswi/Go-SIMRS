package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetInformedConsent retrieves the informed consent for a given visit
func GetInformedConsent(c *gin.Context) {
	visitID := c.Param("id")
	
	// Support casemix check like other medical records
	query := scopedRMQuery(c, visitID)

	var consent models.InformedConsent
	if err := query.First(&consent).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": consent})
}

// SaveInformedConsent creates or updates the informed consent for a given visit
func SaveInformedConsent(c *gin.Context) {
	visitID := c.Param("id")
	userIDVal, _ := c.Get("user_id")
	var userID *uint
	if id, ok := userIDVal.(float64); ok {
		u := uint(id)
		userID = &u
	} else if id, ok := userIDVal.(uint); ok {
		userID = &id
	}

	vid, err := strconv.ParseUint(visitID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visit ID"})
		return
	}

	var consentData models.InformedConsent
	if err := c.ShouldBindJSON(&consentData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	consentData.VisitID = uint(vid)

	// Fetch existing
	var existing models.InformedConsent
	err = scopedRMQuery(c, visitID).First(&existing).Error

	if err != nil { // Not found, create new
		consentData.CreatedByID = userID
		if err := database.DB.Create(&consentData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create informed consent"})
			return
		}
	} else { // Found, update
		consentData.ID = existing.ID
		consentData.CreatedAt = existing.CreatedAt
		consentData.CreatedByID = existing.CreatedByID
		consentData.UpdatedByID = userID

		if err := database.DB.Save(&consentData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update informed consent"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Informed consent saved successfully", "data": consentData})
}
