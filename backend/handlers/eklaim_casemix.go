package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// GetCasemixRM fetches the mirrored medical records from Casemix DB for a given visit
func GetCasemixRM(c *gin.Context) {
	visitID := c.Param("visitId")
	
	var anamnesis models.Anamnesis
	database.CasemixDB.Where("visit_id = ?", visitID).First(&anamnesis)
	
	var physicalExam models.PhysicalExamination
	database.CasemixDB.Where("visit_id = ?", visitID).First(&physicalExam)
	
	var assessmentPlan models.AssessmentPlan
	database.CasemixDB.Where("visit_id = ?", visitID).First(&assessmentPlan)
	
	var disposition models.Disposition
	database.CasemixDB.Where("visit_id = ?", visitID).First(&disposition)
	
	var diagnoses []models.Diagnosis
	database.CasemixDB.Where("visit_id = ?", visitID).Order("type ASC, sequence ASC").Find(&diagnoses)
	
	var visitProcedures []models.VisitProcedure
	database.CasemixDB.Where("visit_id = ?", visitID).Preload("Procedure").Find(&visitProcedures)
	
	var procedureOrders []models.ProcedureOrder
	database.CasemixDB.Where("source_visit_id = ?", visitID).
		Preload("Items.Procedure").
		Preload("Items.Results").
		Find(&procedureOrders)

	var medicineOrders []models.MedicineOrder
	database.CasemixDB.Where("source_visit_id = ?", visitID).
		Preload("Items.Medicine").
		Find(&medicineOrders)

	c.JSON(http.StatusOK, gin.H{
		"anamnesis":        anamnesis,
		"physical_exam":    physicalExam,
		"assessment_plan":  assessmentPlan,
		"disposition":      disposition,
		"diagnoses":        diagnoses,
		"visit_procedures": visitProcedures,
		"procedure_orders": procedureOrders,
		"medicine_orders":  medicineOrders,
	})
}

// UpdateCasemixAnamnesis updates anamnesis in Casemix DB
func UpdateCasemixAnamnesis(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.Anamnesis
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var anamnesis models.Anamnesis
	err := database.CasemixDB.Where("visit_id = ?", visitID).First(&anamnesis).Error
	if err != nil {
		input.VisitID = parseUint(visitID)
		if err := database.CasemixDB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan anamnesis casemix"})
			return
		}
		anamnesis = input
	} else {
		database.CasemixDB.Model(&anamnesis).Updates(input)
	}

	// Sync to legacy EKlaimRMDuplicate for backward compatibility
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.Where("visit_id = ?", visitID).First(&rmDup).Error; err == nil {
		updates := map[string]interface{}{
			"anamnesis_source":           input.AnamnesisSource,
			"functional_status":          input.FunctionalStatus,
			"chief_complaint":            input.ChiefComplaint,
			"history_of_present_illness": input.HistoryOfPresentIllness,
			"past_medical_history":       input.PastMedicalHistory,
			"family_history":             input.FamilyHistory,
			"social_history":             input.SocialHistory,
			"allergies":                  input.Allergies,
			"current_medications":        input.CurrentMedications,
			"review_of_systems":          input.ReviewOfSystems,
		}
		database.DB.Model(&rmDup).Updates(updates)
	}

	c.JSON(http.StatusOK, anamnesis)
}

// UpdateCasemixPhysicalExam updates physical examination in Casemix DB
func UpdateCasemixPhysicalExam(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.PhysicalExamination
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var phys models.PhysicalExamination
	err := database.CasemixDB.Where("visit_id = ?", visitID).First(&phys).Error
	if err != nil {
		input.VisitID = parseUint(visitID)
		if err := database.CasemixDB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan pemeriksaan fisik casemix"})
			return
		}
		phys = input
	} else {
		database.CasemixDB.Model(&phys).Updates(input)
	}

	// Sync to legacy EKlaimRMDuplicate for backward compatibility
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.Where("visit_id = ?", visitID).First(&rmDup).Error; err == nil {
		updates := map[string]interface{}{
			"general_condition":  input.GeneralCondition,
			"consciousness":      input.Consciousness,
			"blood_pressure":     input.BloodPressure,
			"heart_rate":         input.HeartRate,
			"respiratory_rate":   input.RespiratoryRate,
			"temperature":        input.Temperature,
			"oxygen_saturation":  input.OxygenSaturation,
			"weight":             input.Weight,
			"height":             input.Height,
			"head_circum":        input.HeadCircum,
			"upper_arm_circum":   input.UpperArmCircum,
			"waist":              input.Waist,
			"pain_method":        input.PainMethod,
			"pain_scale":         input.PainScale,
			"pain_location":      input.PainLocation,
			"head":               input.Head,
			"eyes":               input.Eyes,
			"ears":               input.Ears,
			"nose":               input.Nose,
			"throat":             input.Throat,
			"ent":                input.ENT,
			"neck":               input.Neck,
			"chest":              input.Chest,
			"thorax":             input.Thorax,
			"heart":              input.Heart,
			"cardiac":            input.Cardiac,
			"lungs":              input.Lungs,
			"pulmonary":          input.Pulmonary,
			"abdomen":            input.Abdomen,
			"extremities":        input.Extremities,
			"skin":               input.Skin,
			"neurological":       input.Neurological,
			"musculoskel":        input.Musculoskel,
			"genitourinary":      input.Genitourinary,
			"other_findings":     input.OtherFindings,
			"ecg_performed":      input.ECGPerformed,
			"ecg_result":         input.ECGResult,
			"ecg_interpretation": input.ECGInterpretation,
			"ecg_notes":          input.ECGNotes,
		}
		database.DB.Model(&rmDup).Updates(updates)
	}

	c.JSON(http.StatusOK, phys)
}

// UpdateCasemixAssessmentPlan updates assessment plan in Casemix DB
func UpdateCasemixAssessmentPlan(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.AssessmentPlan
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ap models.AssessmentPlan
	err := database.CasemixDB.Where("visit_id = ?", visitID).First(&ap).Error
	if err != nil {
		input.VisitID = parseUint(visitID)
		if err := database.CasemixDB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan assessment casemix"})
			return
		}
		ap = input
	} else {
		database.CasemixDB.Model(&ap).Updates(input)
	}

	// Sync to legacy EKlaimRMDuplicate for backward compatibility
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.Where("visit_id = ?", visitID).First(&rmDup).Error; err == nil {
		updates := map[string]interface{}{
			"clinical_assessment": input.ClinicalAssessment,
			"prognosis":           input.Prognosis,
			"medication_plan":     input.MedicationPlan,
			"diet_plan":           input.DietPlan,
			"activity_plan":       input.ActivityPlan,
			"education_plan":      input.EducationPlan,
			"procedure_plan":      input.ProcedurePlan,
			"consultation_plan":   input.ConsultationPlan,
			"treatment_plan":      input.TreatmentPlan,
			"monitoring_plan":     input.MonitoringPlan,
		}
		database.DB.Model(&rmDup).Updates(updates)
	}

	c.JSON(http.StatusOK, ap)
}

// UpdateCasemixDisposition updates disposition in Casemix DB
func UpdateCasemixDisposition(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.Disposition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var disp models.Disposition
	err := database.CasemixDB.Where("visit_id = ?", visitID).First(&disp).Error
	if err != nil {
		input.VisitID = parseUint(visitID)
		if err := database.CasemixDB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan disposisi casemix"})
			return
		}
		disp = input
	} else {
		database.CasemixDB.Model(&disp).Updates(input)
	}

	// Sync to legacy EKlaimRMDuplicate for backward compatibility
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.Where("visit_id = ?", visitID).First(&rmDup).Error; err == nil {
		updates := map[string]interface{}{
			"disposition_type":      input.DispositionType,
			"disposition_note":      input.DispositionNote,
			"rm_discharge_status":   input.DischargeStatus,
			"discharge_condition":   input.DischargeCondition,
			"discharge_instruction": input.DischargeInstruction,
			"discharge_medication":  input.DischargeMedication,
			"follow_up_instruction": input.FollowUpInstruction,
			"follow_up_date":         input.FollowUpDate,
			"referral_facility":     input.ReferralFacility,
			"referral_reason":       input.ReferralReason,
			"referral_diagnosis":    input.ReferralDiagnosis,
			"referral_therapy":      input.ReferralTherapy,
			"referral_notes":        input.ReferralNotes,
			"death_time":            input.DeathTime,
			"death_cause":           input.DeathCause,
		}
		database.DB.Model(&rmDup).Updates(updates)
	}

	c.JSON(http.StatusOK, disp)
}

// AddCasemixDiagnosis adds a diagnosis to Casemix DB
func AddCasemixDiagnosis(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.Diagnosis
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.VisitID = parseUint(visitID)
	if err := database.CasemixDB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal tambah diagnosa casemix"})
		return
	}

	c.JSON(http.StatusOK, input)
}

// RemoveCasemixDiagnosis removes a diagnosis from Casemix DB
func RemoveCasemixDiagnosis(c *gin.Context) {
	diagID := c.Param("diagId")
	if err := database.CasemixDB.Delete(&models.Diagnosis{}, diagID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus diagnosa casemix"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Diagnosa terhapus"})
}

// AddCasemixProcedure adds a procedure to Casemix DB
func AddCasemixProcedure(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.VisitProcedure
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.VisitID = parseUint(visitID)
	if err := database.CasemixDB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal tambah prosedur casemix"})
		return
	}

	c.JSON(http.StatusOK, input)
}

// RemoveCasemixProcedure removes a procedure from Casemix DB
func RemoveCasemixProcedure(c *gin.Context) {
	procID := c.Param("procId")
	if err := database.CasemixDB.Delete(&models.VisitProcedure{}, procID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus prosedur casemix"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Prosedur terhapus"})
}

// UpdateCasemixDiagnoses batch updates diagnoses in Casemix DB
func UpdateCasemixDiagnoses(c *gin.Context) {
	visitID := c.Param("visitId")
	var input []models.Diagnosis
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.CasemixDB.Begin()
	if err := tx.Where("visit_id = ?", visitID).Delete(&models.Diagnosis{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus diagnosa lama"})
		return
	}

	for i := range input {
		input[i].VisitID = parseUint(visitID)
		if err := tx.Create(&input[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal tambah diagnosa baru"})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, input)
}

// UpdateCasemixProcedures batch updates procedures in Casemix DB
func UpdateCasemixProcedures(c *gin.Context) {
	visitID := c.Param("visitId")
	var input []models.VisitProcedure
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.CasemixDB.Begin()
	if err := tx.Where("visit_id = ?", visitID).Delete(&models.VisitProcedure{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus prosedur lama"})
		return
	}

	for i := range input {
		input[i].VisitID = parseUint(visitID)
		if err := tx.Create(&input[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal tambah prosedur baru"})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, input)
}

// UpdateCasemixTriage updates triage in Casemix DB
func UpdateCasemixTriage(c *gin.Context) {
	visitID := c.Param("visitId")
	var input models.Triage
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var triage models.Triage
	err := database.CasemixDB.Where("visit_id = ?", visitID).First(&triage).Error
	if err != nil {
		input.VisitID = parseUint(visitID)
		if err := database.CasemixDB.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan triage casemix"})
			return
		}
		triage = input
	} else {
		database.CasemixDB.Model(&triage).Updates(input)
	}

	// Sync to legacy EKlaimRMDuplicate for backward compatibility
	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.Where("visit_id = ?", visitID).First(&rmDup).Error; err == nil {
		updates := map[string]interface{}{
			"has_triage":              true,
			"triage_arrival_mode":     input.ArrivalMode,
			"triage_complaint":        input.TriageComplaint,
			"triage_level":            input.TriageLevel,
			"triage_airway":           input.Airway,
			"triage_airway_note":      input.AirwayNote,
			"triage_breathing":        input.Breathing,
			"triage_breathing_note":   input.BreathingNote,
			"triage_circulation":      input.Circulation,
			"triage_circulation_note": input.CirculationNote,
			"triage_blood_pressure":   input.BloodPressure,
			"triage_heart_rate":       input.HeartRate,
			"triage_respiratory_rate": input.BreathingRate,
			"triage_temperature":      input.Temperature,
			"triage_oxygen_sat":       input.OxygenSaturation,
			"triage_pain_scale":       input.PainScale,
			"triage_gcs_e":            input.GCSE,
			"triage_gcs_v":            input.GCSV,
			"triage_gcs_m":            input.GCSM,
			"triage_assessment":       input.TriageAssessment,
			"triage_immediate_action": input.ImmediateActions,
		}
		database.DB.Model(&rmDup).Updates(updates)
	}

	c.JSON(http.StatusOK, triage)
}

func parseUint(s string) uint {
	var n uint
	fmt.Sscanf(s, "%d", &n)
	return n
}
