package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// TRIAGE HANDLERS
// ===========================================================================

// GetTriage retrieves triage data for a visit
func GetTriage(c *gin.Context) {
	visitID := c.Param("id")

	var triage models.Triage
	if err := database.DB.Where("visit_id = ?", visitID).Preload("TriagedBy").First(&triage).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, triage)
}

// SaveTriage saves or updates triage data
func SaveTriage(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ArrivalMode      string `json:"arrival_mode"`
		TriageComplaint  string `json:"chief_complaint"`
		TriageLevel      string `json:"triage_level"`
		Consciousness    string `json:"consciousness"`
		Airway           string `json:"airway"`
		Breathing        string `json:"breathing"`
		BreathingRate    string `json:"breathing_rate"`
		Circulation      string `json:"circulation"`
		Akral            string `json:"akral"`
		CRT              string `json:"crt"`
		PupilLeft        string `json:"pupil_left"`
		PupilRight       string `json:"pupil_right"`
		BloodPressure    string `json:"blood_pressure"`
		HeartRate        string `json:"heart_rate"`
		Temperature      string `json:"temperature"`
		OxygenSaturation string `json:"oxygen_saturation"`
		PainScale        int    `json:"pain_scale"`
		GCSE             int    `json:"gcs_e"`
		GCSV             int    `json:"gcs_v"`
		GCSM             int    `json:"gcs_m"`
		TriageAssessment string `json:"initial_assessment"`
		ImmediateActions string `json:"immediate_actions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify visit exists
	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Find or create triage
	var triage models.Triage
	err := database.DB.Where("visit_id = ?", visitID).First(&triage).Error

	var triagerID *uint
	if userID > 0 {
		triagerID = &userID
	}

	if err != nil {
		// Create new
		triage = models.Triage{
			VisitID:     visit.ID,
			TriagedByID: triagerID,
		}
	} else if triagerID != nil {
		triage.TriagedByID = triagerID
	}

	// Update fields
	triage.ArrivalMode = input.ArrivalMode
	triage.TriageComplaint = input.TriageComplaint
	triage.TriageLevel = input.TriageLevel
	triage.Consciousness = input.Consciousness
	triage.Airway = input.Airway
	triage.Breathing = input.Breathing
	triage.BreathingRate = input.BreathingRate
	triage.Circulation = input.Circulation
	triage.Akral = input.Akral
	triage.CRT = input.CRT
	triage.PupilLeft = input.PupilLeft
	triage.PupilRight = input.PupilRight
	triage.BloodPressure = input.BloodPressure
	triage.HeartRate = input.HeartRate
	triage.Temperature = input.Temperature
	triage.OxygenSaturation = input.OxygenSaturation
	triage.PainScale = input.PainScale
	triage.GCSE = input.GCSE
	triage.GCSV = input.GCSV
	triage.GCSM = input.GCSM
	triage.TriageAssessment = input.TriageAssessment
	triage.ImmediateActions = input.ImmediateActions

	if err := database.DB.Save(&triage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, triage)
}

// ===========================================================================
// ANAMNESIS HANDLERS
// ===========================================================================

// GetAnamnesis retrieves anamnesis data for a visit
func GetAnamnesis(c *gin.Context) {
	visitID := c.Param("id")

	var anamnesis models.Anamnesis
	if err := database.DB.Where("visit_id = ?", visitID).Preload("RecordedBy").First(&anamnesis).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, anamnesis)
}

// SaveAnamnesis saves or updates anamnesis data
func SaveAnamnesis(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ChiefComplaint          string `json:"chief_complaint"`
		HistoryOfPresentIllness string `json:"history_of_present_illness"`
		PastMedicalHistory      string `json:"past_medical_history"`
		FamilyHistory           string `json:"family_history"`
		SocialHistory           string `json:"social_history"`
		Allergies               string `json:"allergies"`
		CurrentMedications      string `json:"current_medications"`
		ReviewOfSystems         string `json:"review_of_systems"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	var anamnesis models.Anamnesis
	err := database.DB.Where("visit_id = ?", visitID).First(&anamnesis).Error

	var recorderID *uint
	if userID > 0 {
		recorderID = &userID
	}

	if err != nil {
		anamnesis = models.Anamnesis{
			VisitID:      visit.ID,
			RecordedByID: recorderID,
		}
	} else if recorderID != nil {
		anamnesis.RecordedByID = recorderID
	}

	anamnesis.ChiefComplaint = input.ChiefComplaint
	anamnesis.HistoryOfPresentIllness = input.HistoryOfPresentIllness
	anamnesis.PastMedicalHistory = input.PastMedicalHistory
	anamnesis.FamilyHistory = input.FamilyHistory
	anamnesis.SocialHistory = input.SocialHistory
	anamnesis.Allergies = input.Allergies
	anamnesis.CurrentMedications = input.CurrentMedications
	anamnesis.ReviewOfSystems = input.ReviewOfSystems

	if err := database.DB.Save(&anamnesis).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, anamnesis)
}

// ===========================================================================
// PHYSICAL EXAMINATION HANDLERS
// ===========================================================================

// GetPhysicalExam retrieves physical examination data for a visit
func GetPhysicalExam(c *gin.Context) {
	visitID := c.Param("id")

	var physExam models.PhysicalExamination
	if err := database.DB.Where("visit_id = ?", visitID).Preload("ExaminedBy").First(&physExam).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, physExam)
}

// SavePhysicalExam saves or updates physical examination data
func SavePhysicalExam(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		GeneralCondition       string  `json:"general_condition"`
		Consciousness          string  `json:"consciousness"`
		BloodPressure          string  `json:"blood_pressure"`
		Systolic               int     `json:"systolic"`
		Diastolic              int     `json:"diastolic"`
		BloodPressureSystolic  int     `json:"blood_pressure_systolic"`  // Frontend field
		BloodPressureDiastolic int     `json:"blood_pressure_diastolic"` // Frontend field
		HeartRate              int     `json:"heart_rate"`               // Accept as int
		RespiratoryRate        int     `json:"respiratory_rate"`         // Accept as int
		Temperature            float64 `json:"temperature"`              // Accept as float
		OxygenSaturation       int     `json:"oxygen_saturation"`        // Accept as int
		Weight                 float64 `json:"weight"`                   // Accept as float
		Height                 float64 `json:"height"`                   // Accept as float
		BMI                    float64 `json:"bmi"`
		Waist                  string  `json:"waist"`
		HeadCircum             string  `json:"head_circum"`
		HeadNeck               string  `json:"head_neck"`
		Head                   string  `json:"head"`   // Frontend field
		Ears                   string  `json:"ears"`   // Frontend field
		Nose                   string  `json:"nose"`   // Frontend field
		Throat                 string  `json:"throat"` // Frontend field
		Neck                   string  `json:"neck"`   // Frontend field
		Chest                  string  `json:"chest"`  // Frontend field
		Heart                  string  `json:"heart"`  // Frontend field
		Lungs                  string  `json:"lungs"`  // Frontend field
		Eyes                   string  `json:"eyes"`
		ENT                    string  `json:"ent"`
		Thorax                 string  `json:"thorax"`
		Cardiac                string  `json:"cardiac"`
		Pulmonary              string  `json:"pulmonary"`
		Abdomen                string  `json:"abdomen"`
		Extremities            string  `json:"extremities"`
		Skin                   string  `json:"skin"`
		Neurological           string  `json:"neurological"`
		Musculoskel            string  `json:"musculoskel"`
		Genitourinary          string  `json:"genitourinary"`
		OtherFindings          string  `json:"other_findings"`
		// Supporting Examinations - ECG
		ECGPerformed      bool   `json:"ecg_performed"`
		ECGResult         string `json:"ecg_result"`
		ECGInterpretation string `json:"ecg_interpretation"`
		ECGNotes          string `json:"ecg_notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	var physExam models.PhysicalExamination
	err := database.DB.Where("visit_id = ?", visitID).First(&physExam).Error

	var examinerID *uint
	if userID > 0 {
		examinerID = &userID
	}

	if err != nil {
		physExam = models.PhysicalExamination{
			VisitID:      visit.ID,
			ExaminedByID: examinerID,
		}
	} else if examinerID != nil {
		physExam.ExaminedByID = examinerID
	}

	physExam.GeneralCondition = input.GeneralCondition
	physExam.Consciousness = input.Consciousness

	// Handle blood pressure - use frontend fields if provided, fallback to legacy fields
	systolic := input.Systolic
	if input.BloodPressureSystolic > 0 {
		systolic = input.BloodPressureSystolic
	}
	diastolic := input.Diastolic
	if input.BloodPressureDiastolic > 0 {
		diastolic = input.BloodPressureDiastolic
	}

	physExam.Systolic = systolic
	physExam.Diastolic = diastolic
	if systolic > 0 && diastolic > 0 {
		physExam.BloodPressure = fmt.Sprintf("%d/%d", systolic, diastolic)
	} else if input.BloodPressure != "" {
		physExam.BloodPressure = input.BloodPressure
	}

	// Convert vital signs from numbers to strings
	if input.HeartRate > 0 {
		physExam.HeartRate = fmt.Sprintf("%d", input.HeartRate)
	}
	if input.RespiratoryRate > 0 {
		physExam.RespiratoryRate = fmt.Sprintf("%d", input.RespiratoryRate)
	}
	if input.Temperature > 0 {
		physExam.Temperature = fmt.Sprintf("%.1f", input.Temperature)
	}
	if input.OxygenSaturation > 0 {
		physExam.OxygenSaturation = fmt.Sprintf("%d", input.OxygenSaturation)
	}
	if input.Weight > 0 {
		physExam.Weight = fmt.Sprintf("%.1f", input.Weight)
	}
	if input.Height > 0 {
		physExam.Height = fmt.Sprintf("%.1f", input.Height)
	}
	physExam.BMI = input.BMI
	physExam.Waist = input.Waist
	physExam.HeadCircum = input.HeadCircum

	// Save new fields directly
	physExam.Head = input.Head
	physExam.Ears = input.Ears
	physExam.Nose = input.Nose
	physExam.Throat = input.Throat
	physExam.Neck = input.Neck
	physExam.Chest = input.Chest
	physExam.Heart = input.Heart
	physExam.Lungs = input.Lungs

	// Also maintain legacy fields for backward compatibility
	if input.HeadNeck != "" {
		physExam.HeadNeck = input.HeadNeck
	} else if input.Head != "" || input.Neck != "" {
		parts := []string{}
		if input.Head != "" {
			parts = append(parts, "Kepala: "+input.Head)
		}
		if input.Neck != "" {
			parts = append(parts, "Leher: "+input.Neck)
		}
		physExam.HeadNeck = strings.Join(parts, "; ")
	}

	physExam.Eyes = input.Eyes

	// Handle ENT - combine frontend fields for legacy
	if input.ENT != "" {
		physExam.ENT = input.ENT
	} else if input.Ears != "" || input.Nose != "" || input.Throat != "" {
		parts := []string{}
		if input.Ears != "" {
			parts = append(parts, "Telinga: "+input.Ears)
		}
		if input.Nose != "" {
			parts = append(parts, "Hidung: "+input.Nose)
		}
		if input.Throat != "" {
			parts = append(parts, "Tenggorokan: "+input.Throat)
		}
		physExam.ENT = strings.Join(parts, "; ")
	}

	// Handle Thorax/Chest
	if input.Thorax != "" {
		physExam.Thorax = input.Thorax
	} else if input.Chest != "" {
		physExam.Thorax = input.Chest
	}

	// Handle Cardiac/Heart
	if input.Cardiac != "" {
		physExam.Cardiac = input.Cardiac
	} else if input.Heart != "" {
		physExam.Cardiac = input.Heart
	}

	// Handle Pulmonary/Lungs
	if input.Pulmonary != "" {
		physExam.Pulmonary = input.Pulmonary
	} else if input.Lungs != "" {
		physExam.Pulmonary = input.Lungs
	}

	physExam.Abdomen = input.Abdomen
	physExam.Extremities = input.Extremities
	physExam.Skin = input.Skin
	physExam.Neurological = input.Neurological
	physExam.Musculoskel = input.Musculoskel
	physExam.Genitourinary = input.Genitourinary
	physExam.OtherFindings = input.OtherFindings

	// Supporting Examinations - ECG
	physExam.ECGPerformed = input.ECGPerformed
	physExam.ECGResult = input.ECGResult
	physExam.ECGInterpretation = input.ECGInterpretation
	physExam.ECGNotes = input.ECGNotes

	if err := database.DB.Save(&physExam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, physExam)
}

// ===========================================================================
// DIAGNOSIS HANDLERS
// ===========================================================================

// GetDiagnoses retrieves all diagnoses for a visit
func GetDiagnoses(c *gin.Context) {
	visitID := c.Param("id")

	var diagnoses []models.Diagnosis
	if err := database.DB.Where("visit_id = ?", visitID).Preload("DiagnosedBy").Find(&diagnoses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get diagnosis summary
	var summary models.DiagnosisSummary
	database.DB.Where("visit_id = ?", visitID).First(&summary)

	// Transform to frontend expected format
	items := make([]gin.H, 0)
	for _, d := range diagnoses {
		item := gin.H{
			"id":                  d.ID,
			"icd10_code":          d.ICD10Code,
			"icd10_name":          d.ICD10Name,
			"diagnosis_type":      d.Type,
			"clinical_status":     d.ClinicalStatus,
			"verification_status": d.VerificationStatus,
			"severity":            d.Severity,
			"body_site":           d.BodySite,
			"note":                d.Note,
		}
		if d.OnsetDate != nil {
			item["onset_date"] = d.OnsetDate.Format("2006-01-02")
		}
		items = append(items, item)
	}

	// Return in expected format with summary fields
	result := gin.H{
		"visit_id":               visitID,
		"items":                  items,
		"clinical_impression":    summary.ClinicalImpression,
		"differential_diagnosis": summary.DifferentialDiagnosis,
	}

	if summary.ID > 0 {
		result["id"] = summary.ID
	} else if len(diagnoses) > 0 {
		result["id"] = diagnoses[0].ID
	}

	c.JSON(http.StatusOK, result)
}

// SaveDiagnoses saves diagnoses for a visit (replaces all existing)
func SaveDiagnoses(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ClinicalImpression    string `json:"clinical_impression"`
		DifferentialDiagnosis string `json:"differential_diagnosis"`
		Diagnoses             []struct {
			ICD10Code          string `json:"icd10_code"`
			ICD10Name          string `json:"icd10_name"`
			Type               string `json:"type"`
			DiagnosisType      string `json:"diagnosis_type"` // Frontend uses this
			ClinicalStatus     string `json:"clinical_status"`
			VerificationStatus string `json:"verification_status"`
			Severity           string `json:"severity"`
			BodySite           string `json:"body_site"`
			OnsetDate          string `json:"onset_date"`
			OnsetNote          string `json:"onset_note"`
			Note               string `json:"note"`
		} `json:"diagnoses"`
		Items []struct {
			ICD10Code          string `json:"icd10_code"`
			ICD10Name          string `json:"icd10_name"`
			DiagnosisType      string `json:"diagnosis_type"`
			ClinicalStatus     string `json:"clinical_status"`
			VerificationStatus string `json:"verification_status"`
			Severity           string `json:"severity"`
			BodySite           string `json:"body_site"`
			OnsetDate          string `json:"onset_date"`
			Note               string `json:"note"`
		} `json:"items"` // Frontend sends items instead of diagnoses
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Delete existing diagnoses for this visit
	database.DB.Where("visit_id = ?", visitID).Delete(&models.Diagnosis{})

	// Create new diagnoses
	var diagUserID *uint
	if userID > 0 {
		diagUserID = &userID
	}

	// Combine diagnoses from both formats (legacy "diagnoses" and new "items")
	type diagInput struct {
		ICD10Code          string
		ICD10Name          string
		DiagnosisType      string
		ClinicalStatus     string
		VerificationStatus string
		Severity           string
		BodySite           string
		OnsetDate          string
		Note               string
	}

	var allDiagnoses []diagInput

	// Process legacy format
	for _, d := range input.Diagnoses {
		diagType := d.DiagnosisType
		if diagType == "" {
			diagType = d.Type
		}
		allDiagnoses = append(allDiagnoses, diagInput{
			ICD10Code:          d.ICD10Code,
			ICD10Name:          d.ICD10Name,
			DiagnosisType:      diagType,
			ClinicalStatus:     d.ClinicalStatus,
			VerificationStatus: d.VerificationStatus,
			Severity:           d.Severity,
			BodySite:           d.BodySite,
			OnsetDate:          d.OnsetDate,
			Note:               d.Note,
		})
	}

	// Process new format (items)
	for _, d := range input.Items {
		allDiagnoses = append(allDiagnoses, diagInput{
			ICD10Code:          d.ICD10Code,
			ICD10Name:          d.ICD10Name,
			DiagnosisType:      d.DiagnosisType,
			ClinicalStatus:     d.ClinicalStatus,
			VerificationStatus: d.VerificationStatus,
			Severity:           d.Severity,
			BodySite:           d.BodySite,
			OnsetDate:          d.OnsetDate,
			Note:               d.Note,
		})
	}

	var diagnoses []models.Diagnosis
	for _, diag := range allDiagnoses {
		if diag.ICD10Code == "" {
			continue // Skip empty entries
		}

		var onsetDate *time.Time
		if diag.OnsetDate != "" {
			parsed, err := time.Parse("2006-01-02", diag.OnsetDate)
			if err == nil {
				onsetDate = &parsed
			}
		}

		clinicalStatus := diag.ClinicalStatus
		if clinicalStatus == "" {
			clinicalStatus = "active"
		}
		verificationStatus := diag.VerificationStatus
		if verificationStatus == "" {
			verificationStatus = "confirmed"
		}

		diagnosisType := diag.DiagnosisType
		if diagnosisType == "" {
			diagnosisType = "secondary"
		}

		diagnosis := models.Diagnosis{
			VisitID:            visit.ID,
			ICD10Code:          diag.ICD10Code,
			ICD10Name:          diag.ICD10Name,
			Type:               diagnosisType,
			ClinicalStatus:     clinicalStatus,
			VerificationStatus: verificationStatus,
			Severity:           diag.Severity,
			BodySite:           diag.BodySite,
			OnsetDate:          onsetDate,
			Note:               diag.Note,
			DiagnosedByID:      diagUserID,
		}

		if err := database.DB.Create(&diagnosis).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		diagnoses = append(diagnoses, diagnosis)
	}

	// Save or update diagnosis summary (clinical impression & differential diagnosis)
	var summary models.DiagnosisSummary
	database.DB.Where("visit_id = ?", visitID).First(&summary)

	if summary.ID == 0 {
		summary = models.DiagnosisSummary{
			VisitID:     visit.ID,
			CreatedByID: diagUserID,
		}
	}
	summary.ClinicalImpression = input.ClinicalImpression
	summary.DifferentialDiagnosis = input.DifferentialDiagnosis

	if err := database.DB.Save(&summary).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return response with clinical impression info
	c.JSON(http.StatusOK, gin.H{
		"id":                     summary.ID,
		"clinical_impression":    input.ClinicalImpression,
		"differential_diagnosis": input.DifferentialDiagnosis,
		"items":                  diagnoses,
	})
}

// ===========================================================================
// ASSESSMENT & PLAN HANDLERS
// ===========================================================================

// GetAssessmentPlan retrieves assessment and plan for a visit
func GetAssessmentPlan(c *gin.Context) {
	visitID := c.Param("id")

	var assessmentPlan models.AssessmentPlan
	if err := database.DB.Where("visit_id = ?", visitID).Preload("AssessedBy").First(&assessmentPlan).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, assessmentPlan)
}

// SaveAssessmentPlan saves or updates assessment and plan
func SaveAssessmentPlan(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ClinicalAssessment string `json:"clinical_assessment"`
		Prognosis          string `json:"prognosis"`
		TreatmentPlan      string `json:"treatment_plan"`
		MedicationPlan     string `json:"medication_plan"`
		DietPlan           string `json:"diet_plan"`
		ActivityPlan       string `json:"activity_plan"`
		EducationPlan      string `json:"education_plan"`
		MonitoringPlan     string `json:"monitoring_plan"`
		ProcedurePlan      string `json:"procedure_plan"`
		ConsultationPlan   string `json:"consultation_plan"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	var assessmentPlan models.AssessmentPlan
	err := database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan).Error

	var assessorID *uint
	if userID > 0 {
		assessorID = &userID
	}

	if err != nil {
		assessmentPlan = models.AssessmentPlan{
			VisitID:      visit.ID,
			AssessedByID: assessorID,
		}
	} else if assessorID != nil {
		assessmentPlan.AssessedByID = assessorID
	}

	assessmentPlan.ClinicalAssessment = input.ClinicalAssessment
	assessmentPlan.Prognosis = input.Prognosis
	assessmentPlan.TreatmentPlan = input.TreatmentPlan
	assessmentPlan.MedicationPlan = input.MedicationPlan
	assessmentPlan.DietPlan = input.DietPlan
	assessmentPlan.ActivityPlan = input.ActivityPlan
	assessmentPlan.EducationPlan = input.EducationPlan
	assessmentPlan.MonitoringPlan = input.MonitoringPlan
	assessmentPlan.ProcedurePlan = input.ProcedurePlan
	assessmentPlan.ConsultationPlan = input.ConsultationPlan

	if err := database.DB.Save(&assessmentPlan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, assessmentPlan)
}

// ===========================================================================
// DISPOSITION HANDLERS
// ===========================================================================

// GetDisposition retrieves disposition for a visit
func GetDisposition(c *gin.Context) {
	visitID := c.Param("id")

	var disposition models.Disposition
	if err := database.DB.Where("visit_id = ?", visitID).
		Preload("DischargedBy").
		Preload("FollowUpRoom").
		Preload("AdmissionRoom").
		Preload("AdmissionBed").
		First(&disposition).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, disposition)
}

// CheckPendingOrders checks if there are any pending orders for a visit
// Also returns visit info to determine if follow-up/kontrol should be shown
func CheckPendingOrders(c *gin.Context) {
	visitID := c.Param("id")

	var visit models.Visit
	if err := database.DB.Preload("Room").Preload("Registration").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	var pendingMedicineOrders int64
	var pendingProcedureOrders int64
	var pendingPharmacyVisits int64

	// For pharmacy visits, check pending medicine orders in this pharmacy visit
	if visit.Room != nil && visit.Room.ServiceType == "farmasi" {
		database.DB.Model(&models.MedicineOrder{}).
			Where("pharmacy_visit_id = ? AND status NOT IN ('delivered', 'cancelled')", visitID).
			Count(&pendingMedicineOrders)
	} else {
		// For clinical visits (poli, ugd, rawat_inap):
		// 1. Check procedure orders (lab/radiology) that should be completed
		database.DB.Model(&models.ProcedureOrder{}).
			Where("source_visit_id = ? AND status NOT IN ('completed', 'cancelled')", visitID).
			Count(&pendingProcedureOrders)

		// 2. Check medicine orders - must be delivered (not just sent to pharmacy)
		database.DB.Model(&models.MedicineOrder{}).
			Where("source_visit_id = ? AND status NOT IN ('delivered', 'cancelled')", visitID).
			Count(&pendingMedicineOrders)

		// 3. Also check if pharmacy visits are completed
		// Get all medicine orders for this source visit and check their pharmacy visits
		var pharmacyVisitIDs []uint
		database.DB.Model(&models.MedicineOrder{}).
			Where("source_visit_id = ? AND pharmacy_visit_id IS NOT NULL", visitID).
			Pluck("pharmacy_visit_id", &pharmacyVisitIDs)

		if len(pharmacyVisitIDs) > 0 {
			database.DB.Model(&models.Visit{}).
				Where("id IN ? AND status NOT IN ('completed', 'cancelled')", pharmacyVisitIDs).
				Count(&pendingPharmacyVisits)
		}
	}

	hasPendingOrders := pendingMedicineOrders > 0 || pendingProcedureOrders > 0 || pendingPharmacyVisits > 0

	// Determine if this is an inpatient visit
	isInpatient := visit.VisitType == models.VisitTypeInpatient

	// Also check registration type
	if visit.Registration != nil && visit.Registration.RegistrationType == "inpatient" {
		isInpatient = true
	}

	// Check room type for inpatient
	if visit.Room != nil && visit.Room.ServiceType == "rawat_inap" {
		isInpatient = true
	}

	registrationType := ""
	if visit.Registration != nil {
		registrationType = visit.Registration.RegistrationType
	}

	c.JSON(http.StatusOK, gin.H{
		"has_pending_orders":       hasPendingOrders,
		"pending_medicine_orders":  pendingMedicineOrders,
		"pending_procedure_orders": pendingProcedureOrders,
		"pending_pharmacy_visits":  pendingPharmacyVisits,
		"can_discharge":            !hasPendingOrders,
		"is_inpatient":             isInpatient,
		"visit_type":               visit.VisitType,
		"registration_type":        registrationType,
	})
}

// SaveDisposition saves or updates disposition
func SaveDisposition(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		DispositionType      string `json:"disposition_type"`
		DispositionNote      string `json:"disposition_note"`
		DischargeStatus      string `json:"discharge_status"`
		DischargeCondition   string `json:"discharge_condition"`
		DischargeInstruction string `json:"discharge_instruction"`
		DischargeMedication  string `json:"discharge_medication"`
		// Follow Up / Kontrol
		FollowUpDate        string `json:"follow_up_date"`
		FollowUpInstruction string `json:"follow_up_instruction"`
		FollowUpRoomID      *uint  `json:"follow_up_room_id"`
		// Referral
		ReferralFacility string `json:"referral_facility"`
		ReferralReason   string `json:"referral_reason"`
		ReferralUrgency  string `json:"referral_urgency"`
		// Admission
		AdmissionType     string `json:"admission_type"`
		AdmissionWard     string `json:"admission_ward"`
		AdmissionReason   string `json:"admission_reason"`
		AdmissionRoomID   *uint  `json:"admission_room_id"`
		AdmissionBedID    *uint  `json:"admission_bed_id"`
		AdmissionDoctorID *uint  `json:"admission_doctor_id"` // DPJP for inpatient
		// Death
		DeathTime  string `json:"death_time"`
		DeathCause string `json:"death_cause"`
		// Flags
		CreateAdmission bool `json:"create_admission"` // Create inpatient visit
		CreateFollowUp  bool `json:"create_follow_up"` // Create follow-up registration
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Registration").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Validate: For discharge (pulang), check for pending orders
	if input.DispositionType == "pulang" {
		var pendingMedicineOrders int64
		database.DB.Model(&models.MedicineOrder{}).
			Where("source_visit_id = ? AND status NOT IN ('delivered', 'cancelled')", visitID).
			Count(&pendingMedicineOrders)

		var pendingProcedureOrders int64
		database.DB.Model(&models.ProcedureOrder{}).
			Where("source_visit_id = ? AND status NOT IN ('completed', 'cancelled')", visitID).
			Count(&pendingProcedureOrders)

		if pendingMedicineOrders > 0 || pendingProcedureOrders > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":                    "Tidak dapat memulangkan pasien, masih ada order yang belum selesai",
				"pending_medicine_orders":  pendingMedicineOrders,
				"pending_procedure_orders": pendingProcedureOrders,
			})
			return
		}
	}

	var disposition models.Disposition
	err := database.DB.Where("visit_id = ?", visitID).First(&disposition).Error

	var dischargerID *uint
	if userID > 0 {
		dischargerID = &userID
	}

	if err != nil {
		disposition = models.Disposition{
			VisitID:        visit.ID,
			DischargedByID: dischargerID,
		}
	} else if dischargerID != nil {
		disposition.DischargedByID = dischargerID
	}

	// Parse dates
	var followUpDate *time.Time
	if input.FollowUpDate != "" {
		parsed, err := time.Parse("2006-01-02", input.FollowUpDate)
		if err == nil {
			followUpDate = &parsed
		}
	}

	var deathTime *time.Time
	if input.DeathTime != "" {
		parsed, err := time.Parse("2006-01-02T15:04", input.DeathTime)
		if err == nil {
			deathTime = &parsed
		}
	}

	// Update disposition fields
	disposition.DispositionType = input.DispositionType
	disposition.DispositionNote = input.DispositionNote
	disposition.DischargeStatus = input.DischargeStatus
	disposition.DischargeCondition = input.DischargeCondition
	disposition.DischargeInstruction = input.DischargeInstruction
	disposition.DischargeMedication = input.DischargeMedication
	disposition.FollowUpDate = followUpDate
	disposition.FollowUpInstruction = input.FollowUpInstruction
	disposition.FollowUpRoomID = input.FollowUpRoomID
	disposition.ReferralFacility = input.ReferralFacility
	disposition.ReferralReason = input.ReferralReason
	disposition.ReferralUrgency = input.ReferralUrgency
	disposition.AdmissionType = input.AdmissionType
	disposition.AdmissionWard = input.AdmissionWard
	disposition.AdmissionReason = input.AdmissionReason
	disposition.AdmissionRoomID = input.AdmissionRoomID
	disposition.AdmissionBedID = input.AdmissionBedID
	disposition.DeathTime = deathTime
	disposition.DeathCause = input.DeathCause

	// Start transaction
	tx := database.DB.Begin()

	// Handle rawat inap admission
	if input.DispositionType == "rawat_inap" && input.CreateAdmission && input.AdmissionRoomID != nil {
		inpatientVisit, err := createInpatientVisit(tx, &visit, input.AdmissionRoomID, input.AdmissionBedID, input.AdmissionDoctorID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan rawat inap: " + err.Error()})
			return
		}
		disposition.InpatientVisitID = &inpatientVisit.ID
	}

	// Handle kontrol/follow-up registration
	if input.CreateFollowUp && followUpDate != nil && input.FollowUpRoomID != nil {
		followUpReg, err := createFollowUpRegistration(tx, &visit, followUpDate, input.FollowUpRoomID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat jadwal kontrol: " + err.Error()})
			return
		}
		disposition.FollowUpRegistrationID = &followUpReg.ID
	}

	if err := tx.Save(&disposition).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// All disposition types complete the current visit and queue
	// (pulang, rujuk, rawat_inap, meninggal, dod)
	if input.DispositionType != "" {
		now := time.Now()

		// If this is an inpatient visit being discharged, free up the bed
		if visit.VisitType == "inpatient" {
			var bedIDToRelease *uint

			// First, try to get bed from visit.BedID
			if visit.BedID != nil {
				bedIDToRelease = visit.BedID
			} else {
				// Fallback: find the latest bed transfer for this visit
				var latestTransfer models.BedTransfer
				if err := tx.Where("visit_id = ?", visit.ID).Order("created_at DESC").First(&latestTransfer).Error; err == nil {
					bedIDToRelease = &latestTransfer.ToBedID
				}
			}

			// Release the bed if found
			if bedIDToRelease != nil {
				tx.Model(&models.Bed{}).Where("id = ?", *bedIDToRelease).Update("status", "available")
			}
		}

		// Complete the visit
		tx.Model(&models.Visit{}).Where("id = ?", visit.ID).Updates(map[string]interface{}{
			"status":         models.VisitStatusCompleted,
			"end_time":       now,
			"discharge_time": now, // Set discharge time for inpatient
		})

		// Complete the room queue if exists
		tx.Model(&models.RoomQueue{}).Where("visit_id = ?", visit.ID).Updates(map[string]interface{}{
			"status":       models.RoomQueueStatusCompleted,
			"completed_at": now,
		})
	}

	tx.Commit()

	// Reload with relations
	database.DB.Where("id = ?", disposition.ID).
		Preload("DischargedBy").
		Preload("FollowUpRoom").
		Preload("AdmissionRoom").
		Preload("AdmissionBed").
		First(&disposition)

	c.JSON(http.StatusOK, disposition)
}

// createInpatientVisit creates a new visit for inpatient admission
func createInpatientVisit(tx *gorm.DB, sourceVisit *models.Visit, roomID *uint, bedID *uint, doctorID *uint) (*models.Visit, error) {
	// Generate visit number
	var lastVisit models.Visit
	visitNumber := fmt.Sprintf("VIS%s001", time.Now().Format("20060102"))
	if err := tx.Order("id DESC").First(&lastVisit).Error; err == nil {
		if strings.HasPrefix(lastVisit.VisitNumber, "VIS"+time.Now().Format("20060102")) {
			num := 1
			fmt.Sscanf(lastVisit.VisitNumber, "VIS"+time.Now().Format("20060102")+"%d", &num)
			visitNumber = fmt.Sprintf("VIS%s%03d", time.Now().Format("20060102"), num+1)
		}
	}

	// Get room class for inpatient billing
	var room models.Room
	var inpatientClass string
	if err := tx.First(&room, *roomID).Error; err == nil {
		inpatientClass = room.RoomClass
	}

	now := time.Now()
	inpatientVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: sourceVisit.RegistrationID,
		RoomID:         *roomID,
		DoctorID:       doctorID, // DPJP - Dokter Penanggung Jawab Pasien
		VisitType:      "inpatient",
		VisitPurpose:   "Rawat Inap",
		ReferralFrom:   &sourceVisit.ID,
		Status:         models.VisitStatusWaiting,
		CheckInTime:    &now,
		Complaint:      sourceVisit.Complaint,
		BedID:          bedID,          // Set bed ID to visit
		AdmissionTime:  &now,           // Set admission time
		InpatientClass: inpatientClass, // Set inpatient class from room
	}

	if err := tx.Create(&inpatientVisit).Error; err != nil {
		return nil, err
	}

	// Update bed status if specified
	if bedID != nil {
		if err := tx.Model(&models.Bed{}).Where("id = ?", *bedID).Update("status", "occupied").Error; err != nil {
			return nil, err
		}
	}

	// Update registration type to inpatient
	if sourceVisit.Registration != nil {
		tx.Model(&models.Registration{}).Where("id = ?", sourceVisit.RegistrationID).Update("registration_type", "inpatient")
	}

	return &inpatientVisit, nil
}

// createFollowUpRegistration creates a scheduled follow-up registration with Visit and RoomQueue
func createFollowUpRegistration(tx *gorm.DB, sourceVisit *models.Visit, followUpDate *time.Time, roomID *uint) (*models.Registration, error) {
	// Get patient ID from source registration
	var sourceReg models.Registration
	if err := tx.First(&sourceReg, sourceVisit.RegistrationID).Error; err != nil {
		return nil, err
	}

	// Get destination room for queue code
	var room models.Room
	if err := tx.First(&room, *roomID).Error; err != nil {
		return nil, fmt.Errorf("room not found: %w", err)
	}

	// Generate registration number
	var lastReg models.Registration
	regNumber := fmt.Sprintf("REG%s0001", followUpDate.Format("20060102"))
	if err := tx.Order("id DESC").First(&lastReg).Error; err == nil {
		if strings.HasPrefix(lastReg.RegistrationNumber, "REG"+followUpDate.Format("20060102")) {
			num := 1
			fmt.Sscanf(lastReg.RegistrationNumber, "REG"+followUpDate.Format("20060102")+"%d", &num)
			regNumber = fmt.Sprintf("REG%s%04d", followUpDate.Format("20060102"), num+1)
		}
	}

	// Count patient visits
	var visitCount int64
	tx.Model(&models.Registration{}).Where("patient_id = ?", sourceReg.PatientID).Count(&visitCount)

	followUpReg := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   *followUpDate,
		RegistrationType:   "outpatient",
		PatientID:          sourceReg.PatientID,
		DestinationRoomID:  *roomID,
		DoctorID:           sourceVisit.DoctorID,
		PaymentMethod:      sourceReg.PaymentMethod,
		BPJSNumber:         sourceReg.BPJSNumber,
		InsuranceName:      sourceReg.InsuranceName,
		InsuranceNumber:    sourceReg.InsuranceNumber,
		Status:             models.RegistrationStatusScheduled,
		Notes:              fmt.Sprintf("Kontrol dari kunjungan %s", sourceVisit.VisitNumber),
		VisitNumber:        int(visitCount) + 1,
		// Follow-up specific fields
		IsFollowUp:    true,
		SourceVisitID: &sourceVisit.ID,
		ScheduledDate: followUpDate,
	}

	if err := tx.Create(&followUpReg).Error; err != nil {
		return nil, err
	}

	// Generate visit number for follow-up date
	todayStr := followUpDate.Format("20060102")
	var lastVisit models.Visit
	var visitNum int

	err := tx.Where("visit_number LIKE ?", "VIS"+todayStr+"%").
		Order("visit_number DESC").First(&lastVisit).Error

	if err != nil {
		visitNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &lastNum)
		visitNum = lastNum + 1
	}

	visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)

	// Create Visit for follow-up (status waiting, no check-in time yet)
	followUpVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: followUpReg.ID,
		RoomID:         *roomID,
		DoctorID:       sourceVisit.DoctorID,
		VisitType:      models.VisitTypeOutpatient,
		VisitPurpose:   "Kontrol",
		Status:         models.VisitStatusWaiting,
		Complaint:      fmt.Sprintf("Kontrol dari kunjungan %s", sourceVisit.VisitNumber),
		Notes:          followUpReg.Notes,
	}

	if err := tx.Create(&followUpVisit).Error; err != nil {
		return nil, fmt.Errorf("failed to create follow-up visit: %w", err)
	}

	// Generate room queue number for follow-up date
	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "Q"
	}

	var lastQueue models.RoomQueue
	var queueNum int

	err = tx.Where("room_id = ? AND queue_date = ?", *roomID, *followUpDate).
		Order("queue_number DESC").First(&lastQueue).Error

	if err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	queueNumber := fmt.Sprintf("%s%03d", queueCode, queueNum)

	// Create RoomQueue for follow-up (already has queue number, waiting for check-in)
	roomQueue := models.RoomQueue{
		QueueNumber: queueNumber,
		QueueCode:   queueCode,
		QueueDate:   *followUpDate,
		VisitID:     followUpVisit.ID,
		RoomID:      *roomID,
		Priority:    models.PriorityNormal, // No special priority for follow-up
		Status:      models.RoomQueueStatusWaiting,
	}

	if err := tx.Create(&roomQueue).Error; err != nil {
		return nil, fmt.Errorf("failed to create follow-up room queue: %w", err)
	}

	// Update visit status to in_queue
	followUpVisit.Status = models.VisitStatusInQueue
	if err := tx.Save(&followUpVisit).Error; err != nil {
		return nil, fmt.Errorf("failed to update visit status: %w", err)
	}

	return &followUpReg, nil
}

// ===========================================================================
// MEDICAL RECORD SUMMARY
// ===========================================================================

// GetMedicalRecordSummary retrieves complete medical record for a visit
func GetMedicalRecordSummary(c *gin.Context) {
	visitID := c.Param("id")

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Get all components
	var triage models.Triage
	database.DB.Where("visit_id = ?", visitID).Preload("TriagedBy").First(&triage)

	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).Preload("RecordedBy").First(&anamnesis)

	var physExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).Preload("ExaminedBy").First(&physExam)

	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Preload("DiagnosedBy").Find(&diagnoses)

	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).Preload("AssessedBy").First(&assessmentPlan)

	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).Preload("DischargedBy").First(&disposition)

	c.JSON(http.StatusOK, gin.H{
		"visit_id":        visit.ID,
		"triage":          triage,
		"anamnesis":       anamnesis,
		"physical_exam":   physExam,
		"diagnoses":       diagnoses,
		"assessment_plan": assessmentPlan,
		"disposition":     disposition,
	})
}

// ===========================================================================
// CONSULTATION (untuk visit konsultasi)
// ===========================================================================

// SaveConsultation saves consultation result (SOAP format)
// Menyimpan jawaban konsultasi dalam tabel consultations
func SaveConsultation(c *gin.Context) {
	visitID := c.Param("id")

	// Get userID from context (set by AuthMiddleware)
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated - userID not found in context"})
		return
	}

	userID, ok := userIDVal.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid userID type in context"})
		return
	}

	// Validate userID is not zero (means invalid JWT token)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID - please login again"})
		return
	}

	var input struct {
		Subjective     string `json:"subjective"`
		Objective      string `json:"objective"`
		Assessment     string `json:"assessment"`
		Plan           string `json:"plan"`
		Recommendation string `json:"recommendation"`
		Notes          string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Verify user exists in database
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User account not found - please login again"})
		return
	}

	// Get consultant ID from employee
	var consultantID *uint
	if user.EmployeeID != nil {
		consultantID = user.EmployeeID
	}

	// Check if there's a consultation order for this visit
	var procedureOrder models.ProcedureOrder
	var procedureOrderID *uint
	err := database.DB.Where("target_visit_id = ? AND order_type = ?", visitID, "consultation").
		First(&procedureOrder).Error
	if err == nil {
		procedureOrderID = &procedureOrder.ID
	}

	// Simpan sebagai Consultation
	consultation := models.Consultation{
		VisitID:          visit.ID,
		ProcedureOrderID: procedureOrderID,
		Subjective:       input.Subjective,
		Objective:        input.Objective,
		Assessment:       input.Assessment,
		Plan:             input.Plan,
		Recommendation:   input.Recommendation,
		Notes:            input.Notes,
		ConsultantID:     consultantID,
		CreatedByID:      &userID,
	}

	if err := database.DB.Create(&consultation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save consultation: " + err.Error()})
		return
	}

	// If there's a procedure order, update its status to completed
	if procedureOrderID != nil {
		// Format hasil konsultasi SOAP untuk ditampilkan di riwayat order
		resultSummary := ""
		if input.Subjective != "" {
			resultSummary += "S: " + input.Subjective + "\n"
		}
		if input.Objective != "" {
			resultSummary += "O: " + input.Objective + "\n"
		}
		if input.Assessment != "" {
			resultSummary += "A: " + input.Assessment + "\n"
		}
		if input.Plan != "" {
			resultSummary += "P: " + input.Plan
		}

		updateData := map[string]interface{}{
			"status":         models.ProcedureOrderStatusCompleted,
			"result_summary": resultSummary,
			"conclusion":     input.Plan,
			"suggestion":     input.Recommendation,
			"completed_at":   time.Now(),
		}

		// Set performed_by_id if consultant is available
		if consultantID != nil {
			updateData["performed_by_id"] = *consultantID
		}

		database.DB.Model(&models.ProcedureOrder{}).
			Where("id = ?", *procedureOrderID).
			Updates(updateData)

		// Also update all items status to completed
		itemUpdateData := map[string]interface{}{
			"status":       models.ProcedureOrderStatusCompleted,
			"completed_at": time.Now(),
		}
		if consultantID != nil {
			itemUpdateData["performed_by_id"] = *consultantID
		}
		database.DB.Model(&models.ProcedureOrderItem{}).
			Where("procedure_order_id = ?", *procedureOrderID).
			Updates(itemUpdateData)
	}

	// Reload with relations
	database.DB.Preload("Consultant").Preload("CreatedBy").First(&consultation, consultation.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Konsultasi berhasil disimpan",
		"data":    consultation,
	})
}

// GetConsultation gets consultation result for a visit
// Returns consultation data if exists, or just the procedure order info if consultation not yet answered
func GetConsultation(c *gin.Context) {
	visitID := c.Param("id")

	var consultation models.Consultation
	err := database.DB.
		Preload("Consultant").
		Preload("CreatedBy").
		Preload("ProcedureOrder.OrderedBy").
		Preload("ProcedureOrder.SourceRoom").
		Where("visit_id = ?", visitID).
		First(&consultation).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Consultation not found yet, try to get the procedure order info
			var procedureOrder models.ProcedureOrder
			err := database.DB.
				Preload("OrderedBy").
				Preload("SourceRoom").
				Where("target_visit_id = ? AND order_type = ?", visitID, "consultation").
				First(&procedureOrder).Error

			if err != nil {
				// No procedure order either, return empty data
				c.JSON(http.StatusOK, gin.H{
					"visit_id":        visitID,
					"procedure_order": nil,
				})
				return
			}

			// Return procedure order info without consultation data
			c.JSON(http.StatusOK, gin.H{
				"visit_id":        visitID,
				"procedure_order": procedureOrder,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, consultation)
}
