package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetGeneralConsent retrieves the general consent for a given visit
func GetGeneralConsent(c *gin.Context) {
	visitID := c.Param("id")
	query := scopedRMQuery(c, visitID)

	var consent models.GeneralConsent
	if err := query.Preload("AuthorizedPersons").First(&consent).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": consent})
}

// SaveGeneralConsent creates or updates the general consent for a given visit
func SaveGeneralConsent(c *gin.Context) {
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

	var consentData models.GeneralConsent
	if err := c.ShouldBindJSON(&consentData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	consentData.VisitID = uint(vid)

	tx := database.DB.Begin()

	// Fetch existing
	var existing models.GeneralConsent
	err = tx.Where("visit_id = ?", vid).First(&existing).Error

	if err != nil { // Not found, create new
		consentData.CreatedByID = userID
		if err := tx.Create(&consentData).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create general consent"})
			return
		}
	} else { // Found, update
		consentData.ID = existing.ID
		consentData.CreatedAt = existing.CreatedAt
		consentData.CreatedByID = existing.CreatedByID
		consentData.UpdatedByID = userID

		// Delete existing authorized persons
		tx.Where("general_consent_id = ?", existing.ID).Delete(&models.GeneralConsentAuthorizedPerson{})

		if err := tx.Save(&consentData).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update general consent"})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "General consent saved successfully", "data": consentData})
}

// GetGeneralConsentInpatient retrieves the general consent inpatient for a given visit
func GetGeneralConsentInpatient(c *gin.Context) {
	visitID := c.Param("id")

	var consent models.GeneralConsentInpatient
	if err := database.DB.Where("visit_id = ?", visitID).First(&consent).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": consent})
}

// SaveGeneralConsentInpatient creates or updates the general consent inpatient for a given visit
func SaveGeneralConsentInpatient(c *gin.Context) {
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

	var consentData models.GeneralConsentInpatient
	if err := c.ShouldBindJSON(&consentData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	consentData.VisitID = uint(vid)

	// Fetch existing
	var existing models.GeneralConsentInpatient
	err = database.DB.Where("visit_id = ?", vid).First(&existing).Error

	if err != nil { // Not found, create new
		consentData.CreatedByID = userID
		if err := database.DB.Create(&consentData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create general consent inpatient"})
			return
		}
	} else { // Found, update
		consentData.ID = existing.ID
		consentData.CreatedAt = existing.CreatedAt
		consentData.CreatedByID = existing.CreatedByID
		consentData.UpdatedByID = userID

		if err := database.DB.Save(&consentData).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update general consent inpatient"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "General consent inpatient saved successfully", "data": consentData})
}
