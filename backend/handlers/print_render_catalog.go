package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"starter/backend/database"
	"starter/backend/models"
)

func getAvailableDocsImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	isCasemix := useCasemixClinicalData(c)
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	docs := []string{}

	var resumeCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.Anamnesis{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&resumeCount)
	if resumeCount == 0 {
		applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.Diagnosis{}).
			Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
			Count(&resumeCount)
	}
	if resumeCount > 0 {
		docs = append(docs, "resume")
	}

	var triageCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.Triage{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&triageCount)
	if triageCount > 0 {
		docs = append(docs, "triage")
		docs = append(docs, "emergency_summary")
	}

	var cpptCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.CPPT{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&cpptCount)
	if cpptCount > 0 {
		docs = append(docs, "cppt")
	}

	var nursingCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.NursingCare{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&nursingCount)
	if nursingCount > 0 {
		docs = append(docs, "nursing_care")
	}

	var fluidCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.FluidBalance{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&fluidCount)
	if fluidCount > 0 {
		docs = append(docs, "fluid_balance")
	}

	var transferCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.BedTransfer{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		Count(&transferCount)
	if transferCount > 0 {
		docs = append(docs, "bed_transfer")
	}

	var vitalCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.CPPT{}).
		Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix).
		Where("(blood_pressure != '' AND blood_pressure IS NOT NULL) OR heart_rate > 0 OR respiratory_rate > 0 OR (temperature != '' AND temperature IS NOT NULL) OR oxygen_saturation > 0 OR pain_scale > 0")).
		Count(&vitalCount)
	if vitalCount > 0 {
		docs = append(docs, "vital_sign_chart")
	}

	var referralCount int64
	applyCasemixEklaimScope(c, getClinicalDB(c).Model(&models.Disposition{}).
		Where("visit_id = ? AND is_casemix = ? AND disposition_type = ?", visitID, isCasemix, "rujuk")).
		Count(&referralCount)
	if referralCount > 0 {
		docs = append(docs, "referral_letter")
	}

	if visit.AdmissionTime != nil {
		docs = append(docs, "inpatient_certificate")
	}

	c.JSON(http.StatusOK, gin.H{"available_docs": docs})
}
