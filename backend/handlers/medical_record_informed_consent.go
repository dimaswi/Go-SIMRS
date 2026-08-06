package handlers

import (
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetInformedConsents retrieves all informed consents for a given visit
func GetInformedConsents(c *gin.Context) {
	visitID := c.Param("id")
	
	// Support casemix check like other medical records
	query := scopedRMQuery(c, visitID)

	var consents []models.InformedConsent
	if err := query.Preload("Visit.Doctor").Preload("Procedures.Procedure").Preload("DokterPemberiInformasi").Find(&consents).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []models.InformedConsent{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": consents})
}

// GetInformedConsent retrieves a specific informed consent by ID
func GetInformedConsent(c *gin.Context) {
	id := c.Param("ic_id")
	
	var consent models.InformedConsent
	if err := database.DB.Preload("Procedures.Procedure").Preload("DokterPemberiInformasi").First(&consent, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Informed consent not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": consent})
}

// SaveInformedConsent creates or updates an informed consent
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
	
	if consentData.DokterPemberiInformasiID != nil {
		log.Printf("[DEBUG] SaveInformedConsent: DokterPemberiInformasiID = %d", *consentData.DokterPemberiInformasiID)
	} else {
		log.Printf("[DEBUG] SaveInformedConsent: DokterPemberiInformasiID is nil")
	}

	consentData.VisitID = uint(vid)
	consentData.IsCasemix = requestUsesCasemix(c)
	consentData.CasemixEklaimID = getCasemixEklaimID(c)

	if consentData.ID == 0 {
		// Create new
		consentData.CreatedByID = userID
		consentData.Visit = nil
		consentData.DokterPemberiInformasi = nil
		if err := database.DB.Omit("Procedures").Create(&consentData).Error; err != nil {
			log.Printf("GORM Create Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create informed consent: " + err.Error()})
			return
		}
	} else {
		// Update existing
		var existing models.InformedConsent
		if err := database.DB.First(&existing, consentData.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Informed consent not found"})
			return
		}

		// Prevent updating if it belongs to a different visit
		if existing.VisitID != uint(vid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID mismatch"})
			return
		}

		consentData.CreatedAt = existing.CreatedAt
		consentData.CreatedByID = existing.CreatedByID
		consentData.UpdatedByID = userID
		consentData.Visit = nil
		consentData.DokterPemberiInformasi = nil

		if err := database.DB.Omit("Procedures").Save(&consentData).Error; err != nil {
			log.Printf("GORM Update Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update informed consent: " + err.Error()})
			return
		}
	}

	// Manually sync procedures to prevent duplicates
	database.DB.Where("informed_consent_id = ?", consentData.ID).Delete(&models.InformedConsentProcedure{})
	if len(consentData.Procedures) > 0 {
		for i := range consentData.Procedures {
			consentData.Procedures[i].InformedConsentID = consentData.ID
			consentData.Procedures[i].ID = 0 // Ensure it inserts as new
		}
		database.DB.Create(&consentData.Procedures)
	}

	// Reload with preloads
	database.DB.Preload("Procedures.Procedure").First(&consentData, consentData.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Informed consent saved successfully", "data": consentData})
}

// DeleteInformedConsent deletes an informed consent
func DeleteInformedConsent(c *gin.Context) {
	id := c.Param("ic_id")
	visitID := c.Param("id")
	
	var consent models.InformedConsent
	if err := database.DB.First(&consent, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Informed consent not found"})
		return
	}

	vid, _ := strconv.ParseUint(visitID, 10, 32)
	if consent.VisitID != uint(vid) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit ID mismatch"})
		return
	}

	if err := database.DB.Delete(&consent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete informed consent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Informed consent deleted successfully"})
}
