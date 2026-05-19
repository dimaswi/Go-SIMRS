package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"
	"starter/backend/services/bpjs"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Helper to get CasemixEklaimID from query
func getCasemixEklaimID(c *gin.Context) *uint {
	if idStr := c.Query("casemix_eklaim_id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 32); err == nil {
			uid := uint(id)
			return &uid
		}
	}

	if idStr := c.Query("rm_duplicate_id"); idStr != "" {
		if id, err := strconv.ParseUint(idStr, 10, 32); err == nil {
			var rmDup models.EKlaimRMDuplicate
			if err := database.DB.Select("e_klaim_local_id").First(&rmDup, uint(id)).Error; err == nil {
				uid := rmDup.EKlaimLocalID
				return &uid
			}
		}
	}

	return nil
}

func requestUsesCasemix(c *gin.Context) bool {
	return c.Query("is_casemix") == "true" || c.Query("casemix_eklaim_id") != "" || c.Query("rm_duplicate_id") != ""
}

func applyCasemixEklaimScope(c *gin.Context, query *gorm.DB) *gorm.DB {
	if !requestUsesCasemix(c) {
		return query
	}

	if casemixEklaimID := getCasemixEklaimID(c); casemixEklaimID != nil {
		return query.Where("casemix_eklaim_id = ?", *casemixEklaimID)
	}

	return query.Where("casemix_eklaim_id IS NULL")
}

func scopedRMQuery(c *gin.Context, visitID interface{}) *gorm.DB {
	isCasemix := requestUsesCasemix(c)
	query := database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)
	return applyCasemixEklaimScope(c, query)
}

func scopedSourceVisitQuery(c *gin.Context, visitID interface{}) *gorm.DB {
	isCasemix := requestUsesCasemix(c)
	query := database.DB.Where("source_visit_id = ? AND is_casemix = ?", visitID, isCasemix)
	return applyCasemixEklaimScope(c, query)
}

// ===========================================================================
// TRIAGE HANDLERS
// ===========================================================================

// GetTriage retrieves triage data for a visit
func GetTriage(c *gin.Context) {
	visitID := c.Param("id")

	var triage models.Triage
	if err := scopedRMQuery(c, visitID).Preload("TriagedBy").First(&triage).Error; err != nil {
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
		ArrivalMode       string      `json:"arrival_mode"`
		TriageComplaint   string      `json:"triage_complaint"` // Match frontend field name
		ChiefComplaint    string      `json:"chief_complaint"`  // Legacy support
		TriageLevel       string      `json:"triage_level"`
		Consciousness     string      `json:"consciousness"`
		Airway            string      `json:"airway"`
		AirwayNote        string      `json:"airway_note"`
		Breathing         string      `json:"breathing"`
		BreathingNote     string      `json:"breathing_note"`
		BreathingRate     interface{} `json:"breathing_rate"`
		RespiratoryRate   interface{} `json:"respiratory_rate"`
		Circulation       string      `json:"circulation"`
		CirculationNote   string      `json:"circulation_note"`
		Akral             string      `json:"akral"`
		CRT               string      `json:"crt"`
		PupilLeft         string      `json:"pupil_left"`
		PupilRight        string      `json:"pupil_right"`
		BloodPressure     string      `json:"blood_pressure"`
		HeartRate         interface{} `json:"heart_rate"`
		Temperature       interface{} `json:"temperature"`
		OxygenSaturation  interface{} `json:"oxygen_saturation"`
		PainMethod        string      `json:"pain_method"`
		PainScale         int         `json:"pain_scale"`
		PainLocation      string      `json:"pain_location"`
		GCSE              int         `json:"gcs_e"`
		GCSV              int         `json:"gcs_v"`
		GCSM              int         `json:"gcs_m"`
		TriageAssessment  string      `json:"triage_assessment"`
		InitialAssessment string      `json:"initial_assessment"` // Legacy support
		ImmediateActions  string      `json:"immediate_actions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Helper to convert interface to string
	toString := func(v interface{}) string {
		if v == nil {
			return ""
		}
		switch val := v.(type) {
		case string:
			return val
		case float64:
			return fmt.Sprintf("%.0f", val)
		case int:
			return fmt.Sprintf("%d", val)
		default:
			return fmt.Sprintf("%v", val)
		}
	}

	// Verify visit exists
	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Find or create triage
	var triage models.Triage
	err := scopedRMQuery(c, visitID).First(&triage).Error

	var triagerID *uint
	if userID > 0 {
		triagerID = &userID
	}

	if err != nil {
		// Create new
		triage = models.Triage{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
			TriagedByID:     triagerID,
		}
	} else if triagerID != nil {
		triage.TriagedByID = triagerID
	}

	// Use triage_complaint or chief_complaint (legacy)
	complaint := input.TriageComplaint
	if complaint == "" {
		complaint = input.ChiefComplaint
	}

	// Use triage_assessment or initial_assessment (legacy)
	assessment := input.TriageAssessment
	if assessment == "" {
		assessment = input.InitialAssessment
	}

	// Use breathing_rate or respiratory_rate
	breathingRate := toString(input.BreathingRate)
	if breathingRate == "" || breathingRate == "0" {
		breathingRate = toString(input.RespiratoryRate)
	}

	// Update fields
	triage.ArrivalMode = input.ArrivalMode
	triage.TriageComplaint = complaint
	triage.TriageLevel = input.TriageLevel
	triage.Consciousness = input.Consciousness
	triage.Airway = input.Airway
	triage.AirwayNote = input.AirwayNote
	triage.Breathing = input.Breathing
	triage.BreathingNote = input.BreathingNote
	triage.BreathingRate = breathingRate
	triage.Circulation = input.Circulation
	triage.CirculationNote = input.CirculationNote
	triage.Akral = input.Akral
	triage.CRT = input.CRT
	triage.PupilLeft = input.PupilLeft
	triage.PupilRight = input.PupilRight
	triage.BloodPressure = input.BloodPressure
	triage.HeartRate = toString(input.HeartRate)
	triage.Temperature = toString(input.Temperature)
	triage.OxygenSaturation = toString(input.OxygenSaturation)
	triage.PainMethod = input.PainMethod
	triage.PainScale = input.PainScale
	triage.PainLocation = input.PainLocation
	triage.GCSE = input.GCSE
	triage.GCSV = input.GCSV
	triage.GCSM = input.GCSM
	triage.TriageAssessment = assessment
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
	if err := scopedRMQuery(c, visitID).Preload("RecordedBy").First(&anamnesis).Error; err != nil {
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
		AnamnesisSource         string `json:"anamnesis_source"`
		FunctionalStatus        string `json:"functional_status"`
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
	err := scopedRMQuery(c, visitID).First(&anamnesis).Error

	var recorderID *uint
	if userID > 0 {
		recorderID = &userID
	}

	if err != nil {
		anamnesis = models.Anamnesis{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
			RecordedByID:    recorderID,
		}
	} else if recorderID != nil {
		anamnesis.RecordedByID = recorderID
	}

	anamnesis.AnamnesisSource = input.AnamnesisSource
	anamnesis.FunctionalStatus = input.FunctionalStatus
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
	if err := scopedRMQuery(c, visitID).Preload("ExaminedBy").First(&physExam).Error; err != nil {
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
		UpperArmCircum         string  `json:"upper_arm_circum"`
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
		// Supporting Examinations - CTG
		CTGPerformed      bool   `json:"ctg_performed"`
		CTGResult         string `json:"ctg_result"`
		CTGInterpretation string `json:"ctg_interpretation"`
		CTGNotes          string `json:"ctg_notes"`
		// Supporting Examinations - Pelvic
		PelvicPerformed bool   `json:"pelvic_performed"`
		PelvicResult    string `json:"pelvic_result"`
		PelvicNotes     string `json:"pelvic_notes"`
		// Pain Assessment
		PainMethod   string `json:"pain_method"`
		PainScale    int    `json:"pain_scale"`
		PainLocation string `json:"pain_location"`
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
	err := scopedRMQuery(c, visitID).First(&physExam).Error

	var examinerID *uint
	if userID > 0 {
		examinerID = &userID
	}

	if err != nil {
		physExam = models.PhysicalExamination{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
			ExaminedByID:    examinerID,
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
	physExam.UpperArmCircum = input.UpperArmCircum
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

	// Supporting Examinations - CTG
	physExam.CTGPerformed = input.CTGPerformed
	physExam.CTGResult = input.CTGResult
	physExam.CTGInterpretation = input.CTGInterpretation
	physExam.CTGNotes = input.CTGNotes

	// Supporting Examinations - Pelvic
	physExam.PelvicPerformed = input.PelvicPerformed
	physExam.PelvicResult = input.PelvicResult
	physExam.PelvicNotes = input.PelvicNotes

	// Pain Assessment
	physExam.PainMethod = input.PainMethod
	physExam.PainScale = input.PainScale
	physExam.PainLocation = input.PainLocation

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
	if err := scopedRMQuery(c, visitID).Preload("DiagnosedBy").Find(&diagnoses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get diagnosis summary
	var summary models.DiagnosisSummary
	scopedRMQuery(c, visitID).First(&summary)

	// Transform to frontend expected format
	items := make([]gin.H, 0)
	for _, d := range diagnoses {
		item := gin.H{
			"id":                     d.ID,
			"icd10_code":             d.ICD10Code,
			"icd10_name":             d.ICD10Name,
			"diagnosis_type":         d.Type,
			"clinical_status":        d.ClinicalStatus,
			"verification_status":    d.VerificationStatus,
			"severity":               d.Severity,
			"body_site":              d.BodySite,
			"differential_diagnosis": d.DifferentialDiagnosis,
			"note":                   d.Note,
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
			ICD10Code             string `json:"icd10_code"`
			ICD10Name             string `json:"icd10_name"`
			Type                  string `json:"type"`
			DiagnosisType         string `json:"diagnosis_type"` // Frontend uses this
			ClinicalStatus        string `json:"clinical_status"`
			VerificationStatus    string `json:"verification_status"`
			Severity              string `json:"severity"`
			BodySite              string `json:"body_site"`
			OnsetDate             string `json:"onset_date"`
			OnsetNote             string `json:"onset_note"`
			DifferentialDiagnosis string `json:"differential_diagnosis"`
			Note                  string `json:"note"`
		} `json:"diagnoses"`
		Items []struct {
			ICD10Code             string `json:"icd10_code"`
			ICD10Name             string `json:"icd10_name"`
			DiagnosisType         string `json:"diagnosis_type"`
			ClinicalStatus        string `json:"clinical_status"`
			VerificationStatus    string `json:"verification_status"`
			Severity              string `json:"severity"`
			BodySite              string `json:"body_site"`
			OnsetDate             string `json:"onset_date"`
			DifferentialDiagnosis string `json:"differential_diagnosis"`
			Note                  string `json:"note"`
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
	scopedRMQuery(c, visitID).Delete(&models.Diagnosis{})

	// Create new diagnoses
	var diagUserID *uint
	if userID > 0 {
		diagUserID = &userID
	}

	// Combine diagnoses from both formats (legacy "diagnoses" and new "items")
	type diagInput struct {
		ICD10Code             string
		ICD10Name             string
		DiagnosisType         string
		ClinicalStatus        string
		VerificationStatus    string
		Severity              string
		BodySite              string
		OnsetDate             string
		DifferentialDiagnosis string
		Note                  string
	}

	var allDiagnoses []diagInput

	// Process legacy format
	for _, d := range input.Diagnoses {
		diagType := d.DiagnosisType
		if diagType == "" {
			diagType = d.Type
		}
		allDiagnoses = append(allDiagnoses, diagInput{
			ICD10Code:             d.ICD10Code,
			ICD10Name:             d.ICD10Name,
			DiagnosisType:         diagType,
			ClinicalStatus:        d.ClinicalStatus,
			VerificationStatus:    d.VerificationStatus,
			Severity:              d.Severity,
			BodySite:              d.BodySite,
			OnsetDate:             d.OnsetDate,
			DifferentialDiagnosis: d.DifferentialDiagnosis,
			Note:                  d.Note,
		})
	}

	// Process new format (items)
	for _, d := range input.Items {
		allDiagnoses = append(allDiagnoses, diagInput{
			ICD10Code:             d.ICD10Code,
			ICD10Name:             d.ICD10Name,
			DiagnosisType:         d.DiagnosisType,
			ClinicalStatus:        d.ClinicalStatus,
			VerificationStatus:    d.VerificationStatus,
			Severity:              d.Severity,
			BodySite:              d.BodySite,
			OnsetDate:             d.OnsetDate,
			DifferentialDiagnosis: d.DifferentialDiagnosis,
			Note:                  d.Note,
		})
	}

	var diagnoses []models.Diagnosis
	for _, diag := range allDiagnoses {
		if diag.ICD10Code == "" {
			continue // Skip empty entries
		}

		var onsetDate *time.Time
		if diag.OnsetDate != "" {
			parsed, err := ParseLocalDate(diag.OnsetDate)
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
			VisitID:               visit.ID,
			IsCasemix:             c.Query("is_casemix") == "true",
			CasemixEklaimID:       getCasemixEklaimID(c),
			ICD10Code:             diag.ICD10Code,
			ICD10Name:             diag.ICD10Name,
			Type:                  diagnosisType,
			ClinicalStatus:        clinicalStatus,
			VerificationStatus:    verificationStatus,
			Severity:              diag.Severity,
			BodySite:              diag.BodySite,
			OnsetDate:             onsetDate,
			DifferentialDiagnosis: diag.DifferentialDiagnosis,
			Note:                  diag.Note,
			DiagnosedByID:         diagUserID,
		}

		if err := database.DB.Create(&diagnosis).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		diagnoses = append(diagnoses, diagnosis)
	}

	// Save or update diagnosis summary (clinical impression & differential diagnosis)
	var summary models.DiagnosisSummary
	isCasemix := c.Query("is_casemix") == "true"
	scopedRMQuery(c, visitID).First(&summary)

	if summary.ID == 0 {
		summary = models.DiagnosisSummary{
			VisitID:         visit.ID,
			IsCasemix:       isCasemix,
			CasemixEklaimID: getCasemixEklaimID(c),
			CreatedByID:     diagUserID,
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
	if err := scopedRMQuery(c, visitID).Preload("AssessedBy").First(&assessmentPlan).Error; err != nil {
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
		InformedConsent    string `json:"informed_consent"`
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
	err := scopedRMQuery(c, visitID).First(&assessmentPlan).Error

	var assessorID *uint
	if userID > 0 {
		assessorID = &userID
	}

	if err != nil {
		assessmentPlan = models.AssessmentPlan{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
			AssessedByID:    assessorID,
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
	assessmentPlan.InformedConsent = input.InformedConsent

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
		Preload("OutpatientRoom").
		First(&disposition).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, disposition)
}

type dischargePlanningItemPayload struct {
	SectionCode  string `json:"section_code"`
	SectionTitle string `json:"section_title"`
	No           string `json:"no"`
	Criteria     string `json:"criteria"`
	Checked      bool   `json:"checked"`
	OfficerName  string `json:"officer_name"`
}

type bodyMarkerPointPayload struct {
	ID    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Label string  `json:"label"`
	Note  string  `json:"note"`
}

type bodyMarkerItemPayload struct {
	ID            string                   `json:"id"`
	ImageMasterID uint                     `json:"image_master_id"`
	ImageCode     string                   `json:"image_code"`
	ImageName     string                   `json:"image_name"`
	ImageURL      string                   `json:"image_url"`
	CategoryCode  string                   `json:"category_code"`
	CategoryName  string                   `json:"category_name"`
	Markers       []bodyMarkerPointPayload `json:"markers"`
}

// GetDischargePlanning retrieves discharge planning checklist for a visit
func GetDischargePlanning(c *gin.Context) {
	visitID := c.Param("id")

	var planning models.DischargePlanning
	if err := scopedRMQuery(c, visitID).Preload("UpdatedBy").First(&planning).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"visit_id": visitID,
			"items":    []dischargePlanningItemPayload{},
		})
		return
	}

	items := make([]dischargePlanningItemPayload, 0)
	if strings.TrimSpace(planning.ItemsJSON) != "" {
		if err := json.Unmarshal([]byte(planning.ItemsJSON), &items); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse discharge planning items"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            planning.ID,
		"visit_id":      planning.VisitID,
		"items":         items,
		"updated_by_id": planning.UpdatedByID,
		"updated_by":    planning.UpdatedBy,
		"created_at":    planning.CreatedAt,
		"updated_at":    planning.UpdatedAt,
	})
}

// SaveDischargePlanning saves or updates discharge planning checklist for a visit
func SaveDischargePlanning(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		Items []dischargePlanningItemPayload `json:"items"`
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

	itemsJSON, err := json.Marshal(input.Items)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode discharge planning items"})
		return
	}

	var planning models.DischargePlanning
	err = scopedRMQuery(c, visitID).First(&planning).Error

	var updatedByID *uint
	if userID > 0 {
		updatedByID = &userID
	}

	if err != nil {
		planning = models.DischargePlanning{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
		}
	}

	planning.ItemsJSON = string(itemsJSON)
	planning.UpdatedByID = updatedByID

	if err := database.DB.Save(&planning).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Where("id = ?", planning.ID).Preload("UpdatedBy").First(&planning).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            planning.ID,
		"visit_id":      planning.VisitID,
		"items":         input.Items,
		"updated_by_id": planning.UpdatedByID,
		"updated_by":    planning.UpdatedBy,
		"created_at":    planning.CreatedAt,
		"updated_at":    planning.UpdatedAt,
	})
}

// GetBodyMarkers retrieves body marker data for a visit
func GetBodyMarkers(c *gin.Context) {
	visitID := c.Param("id")

	var marker models.BodyMarker
	if err := scopedRMQuery(c, visitID).Preload("UpdatedBy").First(&marker).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"visit_id": visitID,
			"items":    []bodyMarkerItemPayload{},
		})
		return
	}

	items := make([]bodyMarkerItemPayload, 0)
	if strings.TrimSpace(marker.ItemsJSON) != "" {
		if err := json.Unmarshal([]byte(marker.ItemsJSON), &items); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse body marker items"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            marker.ID,
		"visit_id":      marker.VisitID,
		"items":         items,
		"updated_by_id": marker.UpdatedByID,
		"updated_by":    marker.UpdatedBy,
		"created_at":    marker.CreatedAt,
		"updated_at":    marker.UpdatedAt,
	})
}

// SaveBodyMarkers saves or updates body marker data for a visit
func SaveBodyMarkers(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		Items []bodyMarkerItemPayload `json:"items"`
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

	itemsJSON, err := json.Marshal(input.Items)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode body marker items"})
		return
	}

	var marker models.BodyMarker
	err = scopedRMQuery(c, visitID).First(&marker).Error

	var updatedByID *uint
	if userID > 0 {
		updatedByID = &userID
	}

	if err != nil {
		marker = models.BodyMarker{
			VisitID:         visit.ID,
			IsCasemix:       c.Query("is_casemix") == "true",
			CasemixEklaimID: getCasemixEklaimID(c),
		}
	}

	marker.ItemsJSON = string(itemsJSON)
	marker.UpdatedByID = updatedByID

	if err := database.DB.Save(&marker).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Where("id = ?", marker.ID).Preload("UpdatedBy").First(&marker).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            marker.ID,
		"visit_id":      marker.VisitID,
		"items":         input.Items,
		"updated_by_id": marker.UpdatedByID,
		"updated_by":    marker.UpdatedBy,
		"created_at":    marker.CreatedAt,
		"updated_at":    marker.UpdatedAt,
	})
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
		// First, recalculate status for all orders from this visit to ensure consistency
		var ordersToRecalculate []models.MedicineOrder
		database.DB.Where("source_visit_id = ?", visitID).Preload("Items").Find(&ordersToRecalculate)

		for _, order := range ordersToRecalculate {
			if order.Status == models.OrderStatusDelivered || order.Status == models.OrderStatusCancelled {
				continue
			}

			// Count item statuses
			var deliveredCount, cancelledCount, totalCount int
			for _, item := range order.Items {
				totalCount++
				if item.Status == models.ItemStatusDelivered {
					deliveredCount++
				} else if item.Status == models.ItemStatusCancelled {
					cancelledCount++
				}
			}

			// Determine correct order status
			activeItems := totalCount - cancelledCount
			var newStatus string

			if activeItems == 0 {
				newStatus = models.OrderStatusCancelled
			} else if deliveredCount == activeItems {
				newStatus = models.OrderStatusDelivered
			} else if deliveredCount > 0 {
				newStatus = models.OrderStatusPartial
			} else {
				continue // Keep current status
			}

			// Update if different
			if order.Status != newStatus {
				database.DB.Model(&order).Update("status", newStatus)
			}
		}

		// Also recalculate procedure orders status
		var procedureOrdersToRecalculate []models.ProcedureOrder
		database.DB.Where("source_visit_id = ?", visitID).Preload("Items").Find(&procedureOrdersToRecalculate)

		for _, order := range procedureOrdersToRecalculate {
			if order.Status == models.ProcedureOrderStatusCompleted || order.Status == models.ProcedureOrderStatusCancelled {
				continue
			}

			// Count item statuses
			var completedCount, cancelledCount, inProgressCount, totalCount int
			for _, item := range order.Items {
				totalCount++
				if item.Status == models.ProcedureOrderStatusCompleted {
					completedCount++
				} else if item.Status == models.ProcedureOrderStatusCancelled {
					cancelledCount++
				} else if item.Status == models.ProcedureOrderStatusInProgress {
					inProgressCount++
				}
			}

			// Determine correct order status
			activeItems := totalCount - cancelledCount
			var newStatus string

			if activeItems == 0 {
				newStatus = models.ProcedureOrderStatusCancelled
			} else if completedCount == activeItems {
				newStatus = models.ProcedureOrderStatusCompleted
			} else if completedCount > 0 || inProgressCount > 0 {
				newStatus = models.ProcedureOrderStatusInProgress
			} else {
				continue // Keep current status
			}

			// Update if different
			if order.Status != newStatus {
				database.DB.Model(&order).Update("status", newStatus)
			}
		}

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
	isCasemix := c.Query("is_casemix") == "true"

	fmt.Printf("DEBUG SaveDisposition ENTRY: visitID=%s, userID=%d\n", visitID, userID)

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
		FollowUpDoctorID    *uint  `json:"follow_up_doctor_id"` // Dokter untuk kontrol
		// Referral (Surat Rujukan)
		ReferralFacility   string `json:"referral_facility"`
		ReferralAddress    string `json:"referral_address"`
		ReferralPhone      string `json:"referral_phone"`
		ReferralSpecialist string `json:"referral_specialist"`
		ReferralReason     string `json:"referral_reason"`
		ReferralUrgency    string `json:"referral_urgency"`
		ReferralDiagnosis  string `json:"referral_diagnosis"`
		ReferralTherapy    string `json:"referral_therapy"`
		ReferralLabResult  string `json:"referral_lab_result"`
		ReferralNotes      string `json:"referral_notes"`
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
		// Outpatient Transfer (UGD → Rawat Jalan)
		OutpatientRoomID   *uint  `json:"outpatient_room_id"`
		OutpatientDoctorID *uint  `json:"outpatient_doctor_id"`
		TransferReason     string `json:"transfer_reason"`
		// BPJS Info - jika sudah ada SPRI/Surat Kontrol, validasi lebih fleksibel
		BPJSSuratKontrol *struct {
			NoSuratKontrol string `json:"no_surat_kontrol"`
			TanggalKontrol string `json:"tanggal_kontrol"`
			DokterTujuan   string `json:"dokter_tujuan"`
		} `json:"bpjs_surat_kontrol"`
		BPJSSPRI *struct {
			NoSPRI            string `json:"no_spri"`
			TglRencanaKontrol string `json:"tgl_rencana_kontrol"`
		} `json:"bpjs_spri"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("DEBUG SaveDisposition AFTER BIND: DispositionType='%s', CreateAdmission=%v, CreateFollowUp=%v\n",
		input.DispositionType, input.CreateAdmission, input.CreateFollowUp)

	var visit models.Visit
	if err := database.DB.Preload("Registration").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Validate: For real discharge (pulang), check for pending orders.
	// Casemix edits are claim-only clinical copies and must not affect live queues.
	if !isCasemix && input.DispositionType == "pulang" {
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

	resolvedDischargeMedication := strings.TrimSpace(input.DischargeMedication)
	if input.DispositionType == "pulang" {
		autoDischargeMedication, err := buildAutoDischargeMedicationFromTakeHomeOrders(visit.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data obat pulang: " + err.Error()})
			return
		}
		if autoDischargeMedication != "" {
			resolvedDischargeMedication = autoDischargeMedication
		}
	}

	var disposition models.Disposition
	// Use Unscoped to find soft-deleted records too, but keep original RM and casemix RM isolated.
	err := applyCasemixEklaimScope(c, database.DB.Unscoped().Where("visit_id = ? AND is_casemix = ?", visitID, isCasemix)).
		First(&disposition).Error

	var dischargerID *uint
	if userID > 0 {
		dischargerID = &userID
	}

	if err != nil {
		// No existing disposition, create new
		disposition = models.Disposition{
			VisitID:         visit.ID,
			IsCasemix:       isCasemix,
			CasemixEklaimID: getCasemixEklaimID(c),
			DischargedByID:  dischargerID,
		}
	} else {
		// Found existing disposition (might be soft-deleted)
		// Clear soft-delete flag to reuse
		disposition.DeletedAt = gorm.DeletedAt{}
		if dischargerID != nil {
			disposition.DischargedByID = dischargerID
		}
	}

	// Parse dates
	var followUpDate *time.Time
	if input.FollowUpDate != "" {
		parsed, err := ParseLocalDate(input.FollowUpDate)
		if err == nil {
			followUpDate = &parsed
		}
	}

	var deathTime *time.Time
	if input.DeathTime != "" {
		if parsed, ok := TryParseLocalDatetime(input.DeathTime); ok {
			deathTime = &parsed
		}
	}

	// Update disposition fields
	disposition.DispositionType = input.DispositionType
	disposition.DispositionNote = input.DispositionNote
	disposition.DischargeStatus = input.DischargeStatus
	disposition.DischargeCondition = input.DischargeCondition
	disposition.DischargeInstruction = input.DischargeInstruction
	disposition.DischargeMedication = resolvedDischargeMedication
	disposition.FollowUpDate = followUpDate
	disposition.FollowUpInstruction = input.FollowUpInstruction
	disposition.FollowUpRoomID = input.FollowUpRoomID
	disposition.ReferralFacility = input.ReferralFacility
	disposition.ReferralAddress = input.ReferralAddress
	disposition.ReferralPhone = input.ReferralPhone
	disposition.ReferralSpecialist = input.ReferralSpecialist
	disposition.ReferralReason = input.ReferralReason
	disposition.ReferralUrgency = input.ReferralUrgency
	disposition.ReferralDiagnosis = input.ReferralDiagnosis
	disposition.ReferralTherapy = input.ReferralTherapy
	disposition.ReferralLabResult = input.ReferralLabResult
	disposition.ReferralNotes = input.ReferralNotes
	disposition.AdmissionType = input.AdmissionType
	disposition.AdmissionWard = input.AdmissionWard
	disposition.AdmissionReason = input.AdmissionReason
	disposition.AdmissionRoomID = input.AdmissionRoomID
	disposition.AdmissionBedID = input.AdmissionBedID
	disposition.DeathTime = deathTime
	disposition.DeathCause = input.DeathCause

	// Handle rawat inap admission
	if !isCasemix && input.DispositionType == "rawat_inap" && input.CreateAdmission && input.AdmissionRoomID != nil {
		inpatientVisit, err := createInpatientVisit(database.DB, &visit, input.AdmissionRoomID, input.AdmissionBedID, input.AdmissionDoctorID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan rawat inap: " + err.Error()})
			return
		}
		disposition.InpatientVisitID = &inpatientVisit.ID
	}

	// Handle rawat jalan transfer (UGD → Rawat Jalan)
	if !isCasemix && input.DispositionType == "rawat_jalan" && input.OutpatientRoomID != nil {
		outpatientVisit, err := createOutpatientVisit(database.DB, &visit, input.OutpatientRoomID, input.OutpatientDoctorID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan rawat jalan: " + err.Error()})
			return
		}
		disposition.OutpatientVisitID = &outpatientVisit.ID
		disposition.OutpatientRoomID = input.OutpatientRoomID
		disposition.TransferReason = input.TransferReason
	}

	// Handle kontrol/follow-up registration
	if !isCasemix && input.CreateFollowUp && followUpDate != nil && input.FollowUpRoomID != nil {
		followUpReg, err := createFollowUpRegistration(database.DB, &visit, followUpDate, input.FollowUpRoomID, input.FollowUpDoctorID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat jadwal kontrol: " + err.Error()})
			return
		}
		disposition.FollowUpRegistrationID = &followUpReg.ID
	}

	// Use Unscoped to properly save previously soft-deleted records
	if err := database.DB.Unscoped().Save(&disposition).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("DEBUG SaveDisposition: DispositionType=%s, VisitID=%d\n", input.DispositionType, visit.ID)

	// All disposition types complete the current visit and queue
	// (pulang, rujuk, rawat_inap, meninggal, dod)
	if !isCasemix && input.DispositionType != "" {
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
				if err := database.DB.Where("visit_id = ?", visit.ID).Order("created_at DESC").First(&latestTransfer).Error; err == nil {
					bedIDToRelease = &latestTransfer.ToBedID
				}
			}

			// Release the bed if found
			if bedIDToRelease != nil {
				database.DB.Exec(`UPDATE beds SET status = 'available', updated_at = ? WHERE id = ?`, now, *bedIDToRelease)

				// Update Aplicare bed availability (async)
				var releasedBed models.Bed
				if err := database.DB.Preload("RoomUnit").First(&releasedBed, *bedIDToRelease).Error; err == nil && releasedBed.RoomUnit != nil {
					bpjs.UpdateRoomBedAvailability(releasedBed.RoomUnit.RoomID, "disposition_discharge_release_bed")
				}
			}
		}

		fmt.Printf("DEBUG: Updating visit %d to completed\n", visit.ID)

		// Complete the visit - use raw SQL to ensure it works
		result := database.DB.Exec(`UPDATE visits SET status = ?, end_time = ?, discharge_time = ?, updated_at = ? WHERE id = ?`,
			models.VisitStatusCompleted, now, now, now, visit.ID)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status visit: " + result.Error.Error()})
			return
		}
		fmt.Printf("DEBUG: Visit update rows affected: %d\n", result.RowsAffected)

		// Complete the room queue if exists
		database.DB.Exec(`UPDATE room_queues SET status = ?, completed_at = ?, updated_at = ? WHERE visit_id = ?`,
			models.RoomQueueStatusCompleted, now, now, visit.ID)

		// Trigger BPJS Task 5 (selesai periksa) — cari via room_queue_id atau visit_id
		go func() {
			// Coba cari room queue ID untuk trigger via UpdateBPJSQueueFromRoomQueueStatus
			var roomQueue models.RoomQueue
			if err := database.DB.Where("visit_id = ?", visit.ID).First(&roomQueue).Error; err == nil {
				bpjs.UpdateBPJSQueueFromRoomQueueStatus(roomQueue.ID, models.RoomQueueStatusCompleted, &now)
			} else {
				// Fallback: trigger via visit_id langsung
				bpjs.TriggerTask5FromVisit(visit.ID, now)
			}
		}()

		// Update SEP status to 'deleted' (visit is now discharged)
		database.DB.Exec(`UPDATE seps SET status = 'deleted', updated_at = ? WHERE visit_id = ?`, now, visit.ID)

		// Update registration status based on disposition type:
		// - rawat_inap: keep in_progress because patient continues under the same registration
		// - rawat_jalan: keep in_progress because patient continues in rawat jalan poli
		// - others (pulang, rujuk, meninggal, dod): set to completed, billing will set to discharged when paid
		if visit.RegistrationID != 0 && input.DispositionType != "rawat_inap" && input.DispositionType != "rawat_jalan" {
			database.DB.Exec(`UPDATE registrations SET status = ?, updated_at = ? WHERE id = ?`,
				models.RegistrationStatusCompleted, now, visit.RegistrationID)
		}
	}

	fmt.Printf("DEBUG SaveDisposition: completed successfully\n")

	// Reload with relations
	database.DB.Where("id = ?", disposition.ID).
		Preload("DischargedBy").
		Preload("FollowUpRoom").
		Preload("AdmissionRoom").
		Preload("AdmissionBed").
		Preload("OutpatientRoom").
		First(&disposition)

	// Send notifications based on disposition type
	if NotifService != nil {
		// Get patient info
		var visitWithPatient models.Visit
		database.DB.Preload("Registration.Patient").Preload("Room").First(&visitWithPatient, visitID)
		patientName := ""
		if visitWithPatient.Registration != nil && visitWithPatient.Registration.Patient != nil {
			patientName = visitWithPatient.Registration.Patient.NamaLengkap
		}
		roomName := ""
		if visitWithPatient.Room != nil {
			roomName = visitWithPatient.Room.Name
		}

		switch input.DispositionType {
		case "pulang":
			// Notify current room about patient discharge
			go NotifService.NotifyRoomUsers(
				visitWithPatient.RoomID,
				models.NotificationTypeDischarge,
				"Pasien Pulang",
				fmt.Sprintf("Pasien %s telah pulang dari %s", patientName, roomName),
				map[string]interface{}{
					"visit_id":         visit.ID,
					"patient_name":     patientName,
					"room_name":        roomName,
					"disposition_type": "pulang",
				},
			)
		case "rawat_inap":
			// Notify admission room about new inpatient
			if disposition.InpatientVisitID != nil && input.AdmissionRoomID != nil {
				var admissionRoom models.Room
				database.DB.First(&admissionRoom, *input.AdmissionRoomID)

				go NotifService.NotifyRoomUsers(
					*input.AdmissionRoomID,
					models.NotificationTypeAdmissionApproved,
					"Pasien Rawat Inap Baru",
					fmt.Sprintf("Pasien %s akan dirawat di %s", patientName, admissionRoom.Name),
					map[string]interface{}{
						"visit_id":           visit.ID,
						"inpatient_visit_id": *disposition.InpatientVisitID,
						"patient_name":       patientName,
						"admission_room":     admissionRoom.Name,
					},
				)
			}
		case "meninggal", "dod":
			// Notify about patient death
			go NotifService.NotifyRoomUsers(
				visitWithPatient.RoomID,
				models.NotificationTypeDischarge,
				"Pasien Meninggal",
				fmt.Sprintf("Pasien %s telah meninggal di %s", patientName, roomName),
				map[string]interface{}{
					"visit_id":         visit.ID,
					"patient_name":     patientName,
					"room_name":        roomName,
					"disposition_type": input.DispositionType,
				},
			)
		case "rujuk":
			// Notify about patient referral
			go NotifService.NotifyRoomUsers(
				visitWithPatient.RoomID,
				models.NotificationTypeDischarge,
				"Pasien Dirujuk",
				fmt.Sprintf("Pasien %s dirujuk ke %s", patientName, input.ReferralFacility),
				map[string]interface{}{
					"visit_id":          visit.ID,
					"patient_name":      patientName,
					"room_name":         roomName,
					"referral_facility": input.ReferralFacility,
					"disposition_type":  "rujuk",
				},
			)
		}
	}

	// Build response with BPJS info
	response := gin.H{
		"id":                        disposition.ID,
		"visit_id":                  disposition.VisitID,
		"disposition_type":          disposition.DispositionType,
		"disposition_note":          disposition.DispositionNote,
		"discharge_status":          disposition.DischargeStatus,
		"discharge_condition":       disposition.DischargeCondition,
		"discharge_instruction":     disposition.DischargeInstruction,
		"discharge_medication":      disposition.DischargeMedication,
		"follow_up_date":            disposition.FollowUpDate,
		"follow_up_instruction":     disposition.FollowUpInstruction,
		"follow_up_room_id":         disposition.FollowUpRoomID,
		"follow_up_registration_id": disposition.FollowUpRegistrationID,
		"referral_facility":         disposition.ReferralFacility,
		"referral_reason":           disposition.ReferralReason,
		"admission_type":            disposition.AdmissionType,
		"admission_reason":          disposition.AdmissionReason,
		"inpatient_visit_id":        disposition.InpatientVisitID,
		"death_time":                disposition.DeathTime,
		"death_cause":               disposition.DeathCause,
		"discharged_by":             disposition.DischargedBy,
		"follow_up_room":            disposition.FollowUpRoom,
		"admission_room":            disposition.AdmissionRoom,
		"created_at":                disposition.CreatedAt,
		"updated_at":                disposition.UpdatedAt,
	}

	// Add BPJS info if provided
	if input.BPJSSuratKontrol != nil {
		response["bpjs_surat_kontrol"] = input.BPJSSuratKontrol
	}
	if input.BPJSSPRI != nil {
		response["bpjs_spri"] = input.BPJSSPRI
	}

	c.JSON(http.StatusOK, response)
}

// CancelDisposition cancels/resets the disposition and reactivates the visit
func CancelDisposition(c *gin.Context) {
	visitID := c.Param("id")

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	var disposition models.Disposition
	dispositionFound := true
	if err := scopedRMQuery(c, visitID).First(&disposition).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			dispositionFound = false
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca disposisi: " + err.Error()})
			return
		}
	}

	now := time.Now()

	// Cancel follow-up registration if exists (SIMRS jadwal kontrol)
	if dispositionFound && disposition.FollowUpRegistrationID != nil {
		// Get the follow-up visit first
		var followUpVisit models.Visit
		if err := database.DB.Where("registration_id = ?", *disposition.FollowUpRegistrationID).First(&followUpVisit).Error; err == nil {
			// Delete room queue for follow-up visit
			database.DB.Where("visit_id = ?", followUpVisit.ID).Delete(&models.RoomQueue{})
			// Delete the follow-up visit
			database.DB.Delete(&followUpVisit)
		}
		// Cancel the follow-up registration
		database.DB.Model(&models.Registration{}).Where("id = ?", *disposition.FollowUpRegistrationID).
			Update("status", models.RegistrationStatusCancelled)
	}

	// Cancel outpatient visit if exists (UGD → Rawat Jalan transfer)
	if dispositionFound && disposition.OutpatientVisitID != nil {
		// Cancel room queue for the outpatient visit
		database.DB.Where("visit_id = ?", *disposition.OutpatientVisitID).Delete(&models.RoomQueue{})
		// Delete the outpatient visit
		database.DB.Delete(&models.Visit{}, *disposition.OutpatientVisitID)
		fmt.Printf("[CancelDisposition] Cancelled outpatient visit %d\n", *disposition.OutpatientVisitID)
	}

	// Reset disposition (soft delete)
	if dispositionFound {
		if err := database.DB.Delete(&disposition).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus disposisi: " + err.Error()})
			return
		}
	}

	fmt.Printf("[CancelDisposition] Mencari SPRI dan Surat Kontrol untuk visit_id=%s\n", visitID)

	// Get current user for BPJS API calls
	userID, _ := c.Get("userID")
	var user models.User
	database.DB.First(&user, userID)
	fmt.Printf("[CancelDisposition] User: %s\n", user.Username)

	// Cancel BPJS SPRI if exists (delete from BPJS using same API as Surat Kontrol)
	var spri models.SPRI
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").First(&spri).Error; err == nil {
		fmt.Printf("[CancelDisposition] SPRI ditemukan: %s (ID=%d)\n", spri.NoSPRI, spri.ID)
		// Try to delete from BPJS (same API endpoint as Surat Kontrol)
		if client, err := bpjs.NewVClaimClient(); err == nil {
			if deleteErr := client.DeleteSuratKontrol(spri.NoSPRI, user.Username); deleteErr != nil {
				fmt.Printf("[CancelDisposition] Gagal hapus SPRI dari BPJS: %v\n", deleteErr)
			} else {
				fmt.Printf("[CancelDisposition] SPRI %s berhasil dihapus dari BPJS\n", spri.NoSPRI)
			}
		} else {
			fmt.Printf("[CancelDisposition] Gagal buat VClaim client: %v\n", err)
		}
		// Update local status regardless of BPJS result
		database.DB.Model(&spri).Update("status", "cancelled")
	} else {
		fmt.Printf("[CancelDisposition] SPRI tidak ditemukan untuk visit_id=%s: %v\n", visitID, err)
	}

	// Cancel BPJS Surat Kontrol if exists (delete from BPJS + update local status)
	var suratKontrol models.SuratKontrol
	if err := database.DB.Where("visit_id = ? AND status = ?", visitID, "active").First(&suratKontrol).Error; err == nil {
		// Try to delete from BPJS
		if client, err := bpjs.NewVClaimClient(); err == nil {
			if deleteErr := client.DeleteSuratKontrol(suratKontrol.NoSuratKontrol, user.Username); deleteErr != nil {
				fmt.Printf("[CancelDisposition] Gagal hapus Surat Kontrol dari BPJS: %v\n", deleteErr)
			} else {
				fmt.Printf("[CancelDisposition] Surat Kontrol %s berhasil dihapus dari BPJS\n", suratKontrol.NoSuratKontrol)
			}
		}
		// Update local status regardless of BPJS result
		database.DB.Model(&suratKontrol).Update("status", "cancelled")
	} else {
		fmt.Printf("[CancelDisposition] Surat Kontrol tidak ditemukan untuk visit_id=%s: %v\n", visitID, err)
	}

	// Reactivate the visit - use raw SQL for nil values
	if err := database.DB.Exec(`UPDATE visits SET status = ?, end_time = NULL, discharge_time = NULL, updated_at = ? WHERE id = ?`,
		models.VisitStatusInProgress, now, visitID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengaktifkan kembali visit: " + err.Error()})
		return
	}

	// Reactivate the registration status (frontend checks this)
	if visit.RegistrationID != 0 {
		database.DB.Exec(`UPDATE registrations SET status = ?, updated_at = ? WHERE id = ?`,
			models.RegistrationStatusInProgress, now, visit.RegistrationID)
	}

	// Reactivate SEP if exists (set status back to active)
	database.DB.Exec(`UPDATE seps SET status = 'active', updated_at = ? WHERE visit_id = ?`, now, visitID)

	// Reactivate the room queue if exists - use raw SQL for nil values
	database.DB.Exec(`UPDATE room_queues SET status = ?, completed_at = NULL, updated_at = ? WHERE visit_id = ?`,
		models.RoomQueueStatusServing, now, visitID)

	message := "Disposisi berhasil dibatalkan"
	if !dispositionFound {
		message = "Disposisi sudah tidak ada, visit sudah direaktivasi"
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        message,
		"reactivated":    true,
		"reactivated_at": now,
	})
}

// CancelFollowUpRegistration cancels the follow-up registration created from disposition
func CancelFollowUpRegistration(c *gin.Context) {
	visitID := c.Param("id")

	var disposition models.Disposition
	if err := scopedRMQuery(c, visitID).First(&disposition).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Disposisi tidak ditemukan"})
		return
	}

	if disposition.FollowUpRegistrationID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada jadwal kontrol untuk dibatalkan"})
		return
	}

	tx := database.DB.Begin()

	// Get the follow-up registration
	var followUpReg models.Registration
	if err := tx.First(&followUpReg, *disposition.FollowUpRegistrationID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal kontrol tidak ditemukan"})
		return
	}

	// Check if registration has been used (status is not scheduled/reserved)
	if followUpReg.Status != models.RegistrationStatusScheduled {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal kontrol sudah digunakan dan tidak dapat dibatalkan"})
		return
	}

	// Find and delete the reserved visit and room queue
	var followUpVisit models.Visit
	if err := tx.Where("registration_id = ? AND status IN ?", followUpReg.ID,
		[]string{string(models.VisitStatusScheduled), string(models.VisitStatusWaiting)}).
		First(&followUpVisit).Error; err == nil {
		// Delete room queue
		tx.Where("visit_id = ?", followUpVisit.ID).Delete(&models.RoomQueue{})
		// Delete visit
		tx.Delete(&followUpVisit)
	}

	// Cancel the registration
	followUpReg.Status = models.RegistrationStatusCancelled
	if err := tx.Save(&followUpReg).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan jadwal kontrol: " + err.Error()})
		return
	}

	// Clear the reference in disposition
	disposition.FollowUpRegistrationID = nil
	if err := tx.Save(&disposition).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate disposisi: " + err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Jadwal kontrol berhasil dibatalkan",
	})
}

func buildAutoDischargeMedicationFromTakeHomeOrders(visitID uint) (string, error) {
	var orders []models.MedicineOrder
	err := database.DB.
		Where("source_visit_id = ?", visitID).
		Where("status <> ?", models.OrderStatusCancelled).
		Where("(fulfillment_type = ?) OR (COALESCE(fulfillment_type, '') = '' AND prescription_type = ?)",
			models.FulfillmentTypeTakeHome,
			"discharge",
		).
		Preload("Items", "status <> ?", models.ItemStatusCancelled).
		Preload("Items.Medicine").
		Order("created_at ASC").
		Find(&orders).Error
	if err != nil {
		return "", err
	}

	lines := make([]string, 0)
	for _, order := range orders {
		for _, item := range order.Items {
			medicineName := fmt.Sprintf("Obat ID %d", item.MedicineID)
			if item.Medicine != nil && strings.TrimSpace(item.Medicine.Name) != "" {
				medicineName = item.Medicine.Name
			}

			line := strings.TrimSpace(fmt.Sprintf("%s %d %s", medicineName, item.Quantity, item.Unit))
			details := make([]string, 0, 4)
			if item.Dosage != "" {
				details = append(details, item.Dosage)
			}
			if item.Frequency != "" {
				details = append(details, item.Frequency)
			}
			if item.Duration != "" {
				details = append(details, item.Duration)
			}
			if item.Instructions != "" {
				details = append(details, item.Instructions)
			}

			if len(details) > 0 {
				line = line + " - " + strings.Join(details, ", ")
			}
			lines = append(lines, line)
		}
	}

	return strings.Join(lines, "\n"), nil
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

		// Update Aplicare bed availability (async)
		if roomID != nil {
			bpjs.UpdateRoomBedAvailability(*roomID, "medical_record_inpatient_admission")
		}
	}

	// Update registration type to inpatient and ensure status is in_progress
	// (SaveDisposition should NOT mark it completed for rawat_inap, but this is a safety net)
	if sourceVisit.RegistrationID != 0 {
		tx.Model(&models.Registration{}).Where("id = ?", sourceVisit.RegistrationID).Updates(map[string]interface{}{
			"registration_type": "inpatient",
			"status":            models.RegistrationStatusInProgress,
		})
	}

	return &inpatientVisit, nil
}

// createOutpatientVisit creates a new outpatient (rawat jalan) visit for UGD → Rawat Jalan transfer.
// The patient continues under the same registration with a new visit in the target poli room.
func createOutpatientVisit(tx *gorm.DB, sourceVisit *models.Visit, roomID *uint, doctorID *uint) (*models.Visit, error) {
	if roomID == nil {
		return nil, fmt.Errorf("room_id is required for outpatient transfer")
	}

	// Validate target room is rawat_jalan
	var room models.Room
	if err := tx.First(&room, *roomID).Error; err != nil {
		return nil, fmt.Errorf("room not found: %w", err)
	}
	if room.ServiceType != "rawat_jalan" {
		return nil, fmt.Errorf("target room must be rawat_jalan, got: %s", room.ServiceType)
	}

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

	now := time.Now()
	outpatientVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: sourceVisit.RegistrationID,
		RoomID:         *roomID,
		DoctorID:       doctorID,
		VisitType:      models.VisitTypeConsultation,
		VisitPurpose:   "Rujuk Rawat Jalan dari UGD",
		ReferralFrom:   &sourceVisit.ID,
		Status:         models.VisitStatusWaiting,
		CheckInTime:    &now,
		Complaint:      sourceVisit.Complaint,
	}

	if err := tx.Create(&outpatientVisit).Error; err != nil {
		return nil, fmt.Errorf("failed to create outpatient visit: %w", err)
	}

	// Create room queue for the new visit
	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "Q"
	}

	todayDate := time.Now().Format("2006-01-02")
	parsedDate, _ := ParseLocalDate(todayDate)
	var lastQueue models.RoomQueue
	var queueNum int

	err := tx.Where("room_id = ? AND queue_date = ?", *roomID, parsedDate).
		Order("queue_number DESC").First(&lastQueue).Error
	if err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	queueNumber := fmt.Sprintf("%s%03d", queueCode, queueNum)
	queue := models.RoomQueue{
		QueueNumber: queueNumber,
		QueueCode:   queueCode,
		QueueDate:   parsedDate,
		VisitID:     outpatientVisit.ID,
		RoomID:      *roomID,
		Priority:    models.PriorityNormal,
		Status:      models.RoomQueueStatusWaiting,
	}

	if err := tx.Create(&queue).Error; err != nil {
		return nil, fmt.Errorf("failed to create room queue: %w", err)
	}

	// Keep registration status as in_progress (patient is continuing in rawat jalan)
	if sourceVisit.RegistrationID != 0 {
		tx.Model(&models.Registration{}).Where("id = ?", sourceVisit.RegistrationID).Updates(map[string]interface{}{
			"status": models.RegistrationStatusInProgress,
		})
	}

	fmt.Printf("[TRANSFER] Created outpatient visit %d (queue: %s) for registration %d, transferred from UGD visit %d\n",
		outpatientVisit.ID, queueNumber, sourceVisit.RegistrationID, sourceVisit.ID)

	return &outpatientVisit, nil
}

// createFollowUpRegistration creates a scheduled follow-up registration with Visit and RoomQueue
// The queue number is reserved immediately but status is "reserved" until patient checks in
func createFollowUpRegistration(db *gorm.DB, sourceVisit *models.Visit, followUpDate *time.Time, roomID *uint, doctorID *uint, registeredByID uint) (*models.Registration, error) {
	// Get patient ID from source registration
	var sourceReg models.Registration
	// Use database.DB instead of tx to read existing data
	if err := database.DB.First(&sourceReg, sourceVisit.RegistrationID).Error; err != nil {
		return nil, fmt.Errorf("source registration not found: %w", err)
	}

	// =====================================================================
	// DEDUP: Cek apakah sudah ada registrasi scheduled dari MJKN untuk pasien
	// ini di ruangan dan tanggal yang sama. Jika ada, gunakan data tersebut
	// agar tidak terjadi registrasi/kunjungan ganda.
	// =====================================================================
	var existingMjknReg models.Registration
	if err := database.DB.Where(
		"patient_id = ? AND destination_room_id = ? AND DATE(scheduled_date) = ? AND status = ?",
		sourceReg.PatientID, *roomID, followUpDate.Format("2006-01-02"), models.RegistrationStatusScheduled,
	).First(&existingMjknReg).Error; err == nil {
		// Registrasi sudah ada — link follow-up fields ke registrasi yang ada
		updates := map[string]interface{}{
			"is_follow_up":    true,
			"source_visit_id": sourceVisit.ID,
		}
		// Preserve payment method dari source jika belum di-set
		if existingMjknReg.BPJSNumber == "" && sourceReg.BPJSNumber != "" {
			updates["bpjs_number"] = sourceReg.BPJSNumber
		}
		if err := db.Model(&existingMjknReg).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("gagal update registrasi yang sudah ada: %w", err)
		}

		fmt.Printf("[FollowUp] Reuse registrasi %s dari MJKN untuk follow-up dari visit %d\n",
			existingMjknReg.RegistrationNumber, sourceVisit.ID)
		return &existingMjknReg, nil
	}

	// Get destination room for queue code
	var room models.Room
	if err := database.DB.First(&room, *roomID).Error; err != nil {
		return nil, fmt.Errorf("room not found: %w", err)
	}

	// Validate room is outpatient/poli
	if room.ServiceType != "rawat_jalan" && !strings.Contains(strings.ToLower(room.RoomType), "poli") {
		return nil, fmt.Errorf("ruangan kontrol harus berupa poli/rawat jalan")
	}

	// Determine the doctor ID to use
	followUpDoctorID := doctorID
	if followUpDoctorID == nil {
		// Fallback to source visit doctor if not specified
		followUpDoctorID = sourceVisit.DoctorID
	}

	// Validate doctor has schedule on the selected date and room
	if followUpDoctorID != nil {
		dayOfWeek := int(followUpDate.Weekday())
		var doctorSchedule models.DoctorSchedule
		err := database.DB.Where("room_id = ? AND employee_id = ? AND day_of_week = ? AND is_active = ?",
			*roomID, *followUpDoctorID, dayOfWeek, true).
			First(&doctorSchedule).Error
		if err != nil {
			return nil, fmt.Errorf("dokter tidak memiliki jadwal praktik di ruangan ini pada hari tersebut")
		}
	}

	// Generate registration number - use MAX of same-date prefix to avoid duplicates
	datePrefix := "REG" + followUpDate.Format("20060102")
	var lastRegSameDate models.Registration
	regNumber := fmt.Sprintf("%s0001", datePrefix)
	if err := database.DB.Unscoped().Where("registration_number LIKE ?", datePrefix+"%").
		Order("registration_number DESC").First(&lastRegSameDate).Error; err == nil {
		num := 1
		fmt.Sscanf(lastRegSameDate.RegistrationNumber, datePrefix+"%d", &num)
		regNumber = fmt.Sprintf("%s%04d", datePrefix, num+1)
	}

	// Count patient visits
	var visitCount int64
	database.DB.Model(&models.Registration{}).Where("patient_id = ?", sourceReg.PatientID).Count(&visitCount)

	followUpReg := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   *followUpDate,
		RegistrationType:   "outpatient",
		PatientID:          sourceReg.PatientID,
		DestinationRoomID:  *roomID,
		DoctorID:           followUpDoctorID,
		PaymentMethod:      sourceReg.PaymentMethod,
		BPJSNumber:         sourceReg.BPJSNumber,
		InsuranceName:      sourceReg.InsuranceName,
		InsuranceNumber:    sourceReg.InsuranceNumber,
		Status:             models.RegistrationStatusScheduled,
		Notes:              fmt.Sprintf("Kontrol dari kunjungan %s", sourceVisit.VisitNumber),
		VisitNumber:        int(visitCount) + 1,
		RegisteredByID:     registeredByID,
		// Follow-up specific fields
		IsFollowUp:    true,
		SourceVisitID: &sourceVisit.ID,
		ScheduledDate: followUpDate,
	}

	if err := db.Create(&followUpReg).Error; err != nil {
		return nil, err
	}

	// Generate visit number for follow-up date
	todayStr := followUpDate.Format("20060102")
	var lastVisit models.Visit
	var visitNum int

	// Use Unscoped to include soft-deleted records when checking for last visit number
	// This prevents duplicate key error when a follow-up was cancelled and recreated
	err := database.DB.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
		Order("visit_number DESC").First(&lastVisit).Error

	if err != nil {
		visitNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &lastNum)
		visitNum = lastNum + 1
	}

	visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)

	// Create Visit for follow-up (status scheduled, no check-in time yet)
	followUpVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: followUpReg.ID,
		RoomID:         *roomID,
		DoctorID:       followUpDoctorID,
		VisitType:      models.VisitTypeOutpatient,
		VisitPurpose:   "Kontrol",
		Status:         models.VisitStatusScheduled, // Scheduled, not active yet
		Complaint:      fmt.Sprintf("Kontrol dari kunjungan %s", sourceVisit.VisitNumber),
		Notes:          followUpReg.Notes,
	}

	if err := db.Create(&followUpVisit).Error; err != nil {
		return nil, fmt.Errorf("failed to create follow-up visit: %w", err)
	}

	// Generate room queue number for follow-up date
	// This reserves the queue number immediately
	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "Q"
	}

	var lastQueue models.RoomQueue
	var queueNum int

	// Get the highest queue number for this room and date (including reserved ones)
	err = database.DB.Where("room_id = ? AND queue_date = ?", *roomID, *followUpDate).
		Order("queue_number DESC").First(&lastQueue).Error

	if err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	queueNumber := fmt.Sprintf("%s%03d", queueCode, queueNum)

	// Create RoomQueue for follow-up with RESERVED status
	// Queue number is allocated but not active until check-in
	roomQueue := models.RoomQueue{
		QueueNumber: queueNumber,
		QueueCode:   queueCode,
		QueueDate:   *followUpDate,
		VisitID:     followUpVisit.ID,
		RoomID:      *roomID,
		Priority:    models.PriorityNormal,
		Status:      models.RoomQueueStatusReserved, // Reserved, not active yet
		Notes:       "Jadwal kontrol - menunggu check-in",
	}

	if err := db.Create(&roomQueue).Error; err != nil {
		return nil, fmt.Errorf("failed to create follow-up room queue: %w", err)
	}

	// === BPJS: Langsung AddAntrean saat membuat jadwal kontrol ===
	// Ini dilakukan di sini agar saat check-in tidak ada race condition dengan pembuatan SEP
	if strings.EqualFold(sourceReg.PaymentMethod, "bpjs") && sourceReg.BPJSNumber != "" {
		// Cari Surat Kontrol yang terkait dengan sourceVisit
		var suratKontrol models.SuratKontrol
		err := database.DB.Where("visit_id = ? AND status = ?", sourceVisit.ID, "active").
			Order("created_at DESC").First(&suratKontrol).Error

		if err == nil && suratKontrol.ID > 0 {
			// Generate kode booking untuk BPJS
			kodeBooking := fmt.Sprintf("%s%s", followUpDate.Format("20060102"), followUpReg.RegistrationNumber)

			// Ambil patient untuk data NIK dan NoHP
			var patient models.Patient
			database.DB.First(&patient, sourceReg.PatientID)

			// Cari poli mapping untuk mendapatkan jadwal praktek
			var poliMapping models.BPJSPoliMapping
			database.DB.Where("room_id = ?", *roomID).First(&poliMapping)

			jamPraktek := "08:00-12:00" // default
			if poliMapping.ID > 0 {
				// Cari jadwal dokter untuk tanggal kontrol
				dayOfWeek := int(followUpDate.Weekday())
				var doctorSchedule models.DoctorSchedule
				if database.DB.Where("room_id = ? AND employee_id = ? AND day_of_week = ? AND is_active = ?",
					*roomID, *followUpDoctorID, dayOfWeek, true).First(&doctorSchedule).Error == nil {
					jamPraktek = fmt.Sprintf("%s-%s", doctorSchedule.StartTime, doctorSchedule.EndTime)
				}
			}

			// Handle NoHP kosong - gunakan default
			noHP := patient.NoTelepon
			if noHP == "" {
				noHP = "000000000000"
			}

			// Resolve NamaDokter: ambil dari Surat Kontrol, kalau kosong fetch dari VClaim Detail
			namaDokterSK := suratKontrol.NamaDokter
			if namaDokterSK == "" && suratKontrol.NoSuratKontrol != "" {
				fmt.Printf("[FollowUp] NamaDokter kosong di Surat Kontrol %s, fetch dari VClaim Detail\n", suratKontrol.NoSuratKontrol)
				vclaimClient, vErr := bpjs.NewVClaimClient()
				if vErr == nil {
					detail, dErr := vclaimClient.GetSuratKontrolDetail(suratKontrol.NoSuratKontrol)
					if dErr == nil && detail != nil && detail.NamaDokter != "" {
						namaDokterSK = detail.NamaDokter
						fmt.Printf("[FollowUp] NamaDokter resolved: %s\n", namaDokterSK)
						// Update DB supaya tidak kosong lagi
						database.DB.Model(&suratKontrol).Update("nama_dokter", namaDokterSK)
					}
				}
			}

			// Buat BPJSQueue dengan data dari Surat Kontrol
			bpjsQueue := models.BPJSQueue{
				KodeBooking:    kodeBooking,
				NomorAntrean:   queueNumber,
				AngkaAntrean:   queueNum,
				NoKartu:        suratKontrol.NoKartu,
				NIK:            patient.NIK,
				NamaPasien:     patient.NamaLengkap,
				NoHP:           noHP,
				TanggalPeriksa: *followUpDate,
				KodePoli:       suratKontrol.KodePoli,
				NamaPoli:       suratKontrol.NamaPoli,
				KodeDokter:     suratKontrol.KodeDokter, // Kode dokter BPJS dari Surat Kontrol
				NamaDokter:     namaDokterSK,            // Nama dokter BPJS dari Surat Kontrol (resolved)
				JamPraktek:     jamPraktek,
				JenisKunjungan: 3, // 3 = Kontrol
				NomorReferensi: suratKontrol.NoSuratKontrol,
				NoRM:           patient.NoRM,
				JenisPasien:    "JKN",
				PatientID:      &sourceReg.PatientID,
				RegistrationID: &followUpReg.ID,
				VisitID:        &followUpVisit.ID,
				RoomQueueID:    &roomQueue.ID,
				RoomID:         roomID,
				Status:         "scheduled",
				SyncStatus:     "pending",
			}

			// Set poli mapping jika ada
			if poliMapping.ID > 0 {
				bpjsQueue.PoliMappingID = &poliMapping.ID
			}

			// Hitung estimasi dilayani (milliseconds)
			// Asumsi 10 menit per pasien
			baseTime, _ := time.Parse("15:04", "08:00")
			estimasiMenit := queueNum * 10
			estimasiTime := time.Date(
				followUpDate.Year(), followUpDate.Month(), followUpDate.Day(),
				baseTime.Hour(), baseTime.Minute()+estimasiMenit, 0, 0, time.Local)
			bpjsQueue.EstimasiDilayani = estimasiTime.UnixMilli()

			// Save BPJSQueue
			if err := db.Create(&bpjsQueue).Error; err != nil {
				fmt.Printf("Warning: Failed to create BPJSQueue for follow-up: %v\n", err)
			} else {
				// Langsung AddAntrean ke BPJS (tanpa task, langsung add)
				go func(q models.BPJSQueue) {
					success, code, msg := bpjs.AddAntrean(&q)
					now := time.Now()

					// Update hasil AddAntrean
					updates := map[string]interface{}{
						"add_antrean_sent": true,
						"add_antrean_code": code,
						"add_antrean_msg":  msg,
						"last_sync_at":     now,
					}
					if success {
						updates["sync_status"] = "synced"
					} else {
						updates["sync_status"] = "failed"
						updates["sync_error"] = msg
					}
					database.DB.Model(&models.BPJSQueue{}).Where("id = ?", q.ID).Updates(updates)

					fmt.Printf("[BPJS] AddAntrean untuk jadwal kontrol %s: success=%v, code=%d, msg=%s\n",
						q.KodeBooking, success, code, msg)
				}(bpjsQueue)
			}
		} else {
			fmt.Printf("Warning: No active Surat Kontrol found for visit %d, skipping BPJS AddAntrean\n", sourceVisit.ID)
		}
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
	scopedRMQuery(c, visitID).Preload("TriagedBy").First(&triage)

	var anamnesis models.Anamnesis
	scopedRMQuery(c, visitID).Preload("RecordedBy").First(&anamnesis)

	var physExam models.PhysicalExamination
	scopedRMQuery(c, visitID).Preload("ExaminedBy").First(&physExam)

	var diagnoses []models.Diagnosis
	scopedRMQuery(c, visitID).Preload("DiagnosedBy").Find(&diagnoses)

	var diagnosisSummary models.DiagnosisSummary
	scopedRMQuery(c, visitID).First(&diagnosisSummary)

	var assessmentPlan models.AssessmentPlan
	scopedRMQuery(c, visitID).Preload("AssessedBy").First(&assessmentPlan)

	var disposition models.Disposition
	scopedRMQuery(c, visitID).Preload("DischargedBy").First(&disposition)

	var visitMedicineItems []models.VisitMedicineItem
	database.DB.Where("visit_id = ? AND status != ?", visitID, models.VisitMedicineStatusCancelled).
		Preload("Medicine").
		Preload("Room").
		Order("created_at ASC").
		Find(&visitMedicineItems)

	var bodyMarker models.BodyMarker
	scopedRMQuery(c, visitID).Preload("UpdatedBy").First(&bodyMarker)
	bodyMarkerItems := make([]bodyMarkerItemPayload, 0)
	if strings.TrimSpace(bodyMarker.ItemsJSON) != "" {
		_ = json.Unmarshal([]byte(bodyMarker.ItemsJSON), &bodyMarkerItems)
	}

	// Rawat Inap data counts (for print availability)
	var cpptCount int64
	scopedRMQuery(c, visitID).Model(&models.CPPT{}).Count(&cpptCount)

	var nursingCareCount int64
	scopedRMQuery(c, visitID).Model(&models.NursingCare{}).Count(&nursingCareCount)

	var fluidBalanceCount int64
	scopedRMQuery(c, visitID).Model(&models.FluidBalance{}).Count(&fluidBalanceCount)

	var bedTransferCount int64
	scopedRMQuery(c, visitID).Model(&models.BedTransfer{}).Count(&bedTransferCount)

	var vitalSignCount int64
	scopedRMQuery(c, visitID).Model(&models.VitalSign{}).Count(&vitalSignCount)

	// Build diagnosis in same format as GetDiagnoses endpoint
	diagnosisItems := make([]gin.H, 0)
	for _, d := range diagnoses {
		item := gin.H{
			"id":                     d.ID,
			"icd10_code":             d.ICD10Code,
			"icd10_name":             d.ICD10Name,
			"diagnosis_type":         d.Type,
			"clinical_status":        d.ClinicalStatus,
			"verification_status":    d.VerificationStatus,
			"differential_diagnosis": d.DifferentialDiagnosis,
		}
		diagnosisItems = append(diagnosisItems, item)
	}
	diagnosisResult := gin.H{
		"items":                  diagnosisItems,
		"clinical_impression":    diagnosisSummary.ClinicalImpression,
		"differential_diagnosis": diagnosisSummary.DifferentialDiagnosis,
	}
	if diagnosisSummary.ID > 0 {
		diagnosisResult["id"] = diagnosisSummary.ID
	} else if len(diagnoses) > 0 {
		diagnosisResult["id"] = diagnoses[0].ID
	}

	c.JSON(http.StatusOK, gin.H{
		"visit_id":             visit.ID,
		"triage":               triage,
		"anamnesis":            anamnesis,
		"physical_exam":        physExam,
		"diagnosis":            diagnosisResult,
		"assessment_plan":      assessmentPlan,
		"disposition":          disposition,
		"body_marker":          gin.H{"items": bodyMarkerItems},
		"visit_medicine_items": visitMedicineItems,
		"cppt_count":           cpptCount,
		"nursing_care_count":   nursingCareCount,
		"fluid_balance_count":  fluidBalanceCount,
		"bed_transfer_count":   bedTransferCount,
		"vital_sign_count":     vitalSignCount,
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

// ===========================================================================
// SICK LETTER HANDLERS
// ===========================================================================

// GetSickLetter retrieves sick letter data for a visit
func GetSickLetter(c *gin.Context) {
	visitID := c.Param("id")

	var sickLetter models.SickLetter
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("IssuedBy").
		First(&sickLetter).Error; err != nil {
		// Return empty object if not found
		c.JSON(http.StatusOK, gin.H{"visit_id": visitID})
		return
	}

	c.JSON(http.StatusOK, sickLetter)
}

// GetSickLetters retrieves all sick letters for a visit
func GetSickLetters(c *gin.Context) {
	visitID := c.Param("id")

	var sickLetters []models.SickLetter
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("IssuedBy").
		Order("created_at DESC").
		Find(&sickLetters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sickLetters)
}

// SaveSickLetter saves or updates sick letter data
func SaveSickLetter(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ID          uint   `json:"id"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		Days        int    `json:"days"`
		Reason      string `json:"reason"`
		Purpose     string `json:"purpose"`
		Institution string `json:"institution"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse dates
	startDate, err := ParseLocalDate(input.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal mulai tidak valid"})
		return
	}

	endDate, err := ParseLocalDate(input.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal selesai tidak valid"})
		return
	}

	// Calculate days if not provided
	days := input.Days
	if days <= 0 {
		days = int(endDate.Sub(startDate).Hours()/24) + 1
	}

	// Get employee ID from user
	var employeeID *uint
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil {
		if user.Employee != nil {
			employeeID = &user.Employee.ID
		}
	}

	// Generate letter number
	letterNumber := generateSickLetterNumber()

	var sickLetter models.SickLetter

	// Check if updating existing or creating new
	if input.ID > 0 {
		if err := database.DB.First(&sickLetter, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat keterangan sakit tidak ditemukan"})
			return
		}
		// Update existing
		sickLetter.StartDate = startDate
		sickLetter.EndDate = endDate
		sickLetter.Days = days
		sickLetter.Reason = input.Reason
		sickLetter.Purpose = input.Purpose
		sickLetter.Institution = input.Institution
		sickLetter.Notes = input.Notes
	} else {
		// Create new
		var visitIDUint uint
		fmt.Sscanf(visitID, "%d", &visitIDUint)

		sickLetter = models.SickLetter{
			VisitID:      visitIDUint,
			LetterNumber: letterNumber,
			StartDate:    startDate,
			EndDate:      endDate,
			Days:         days,
			Reason:       input.Reason,
			Purpose:      input.Purpose,
			Institution:  input.Institution,
			Notes:        input.Notes,
			Status:       "active",
			IssuedByID:   employeeID,
			IssuedAt:     time.Now(),
		}
	}

	if err := database.DB.Save(&sickLetter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.Preload("IssuedBy").First(&sickLetter, sickLetter.ID)

	c.JSON(http.StatusOK, sickLetter)
}

// DeleteSickLetter deletes a sick letter
func DeleteSickLetter(c *gin.Context) {
	letterID := c.Param("letterId")

	var sickLetter models.SickLetter
	if err := database.DB.First(&sickLetter, letterID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat keterangan sakit tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&sickLetter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Surat keterangan sakit berhasil dihapus"})
}

// generateSickLetterNumber generates a unique letter number
func generateSickLetterNumber() string {
	now := time.Now()

	// Count letters today
	var count int64
	database.DB.Model(&models.SickLetter{}).
		Where("DATE(created_at) = DATE(?)", now).
		Count(&count)

	return fmt.Sprintf("SKS/%s/%04d", now.Format("20060102"), count+1)
}

// ============================================
// DEATH CERTIFICATE (SURAT KEMATIAN) HANDLERS
// ============================================

// GetDeathCertificate retrieves death certificate for a visit
func GetDeathCertificate(c *gin.Context) {
	visitID := c.Param("id")

	var deathCert models.DeathCertificate
	if err := database.DB.
		Preload("DeclaringDoctor").
		Preload("IssuedBy").
		Where("visit_id = ?", visitID).
		First(&deathCert).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat kematian tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, deathCert)
}

// GetDeathCertificates retrieves all death certificates for a visit
func GetDeathCertificates(c *gin.Context) {
	visitID := c.Param("id")

	var deathCerts []models.DeathCertificate
	database.DB.
		Preload("DeclaringDoctor").
		Preload("IssuedBy").
		Where("visit_id = ?", visitID).
		Order("created_at DESC").
		Find(&deathCerts)

	c.JSON(http.StatusOK, deathCerts)
}

// SaveDeathCertificate creates or updates a death certificate
func SaveDeathCertificate(c *gin.Context) {
	visitID := c.Param("id")

	var input struct {
		ID                  uint      `json:"id"`
		DeathType           string    `json:"death_type"`
		DeathDateTime       time.Time `json:"death_datetime"`
		DeathLocation       string    `json:"death_location"`
		PrimaryCauseCode    string    `json:"primary_cause_code"`
		PrimaryCauseName    string    `json:"primary_cause_name"`
		SecondaryCauseCode  string    `json:"secondary_cause_code"`
		SecondaryCauseName  string    `json:"secondary_cause_name"`
		UnderlyingCauseCode string    `json:"underlying_cause_code"`
		UnderlyingCauseName string    `json:"underlying_cause_name"`
		MannerOfDeath       string    `json:"manner_of_death"`
		DurationOfIllness   string    `json:"duration_of_illness"`
		AutopsyPerformed    bool      `json:"autopsy_performed"`
		AutopsyFindings     string    `json:"autopsy_findings"`
		DeclaringDoctorID   *uint     `json:"declaring_doctor_id"`
		DeclaringDoctorName string    `json:"declaring_doctor_name"`
		WitnessName         string    `json:"witness_name"`
		WitnessRelation     string    `json:"witness_relation"`
		Notes               string    `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if input.DeathType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis kematian wajib diisi"})
		return
	}
	if input.DeathDateTime.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu kematian wajib diisi"})
		return
	}

	// Get user ID from context
	userID, _ := c.Get("user_id")
	var userIDUint uint
	switch v := userID.(type) {
	case uint:
		userIDUint = v
	case float64:
		userIDUint = uint(v)
	case int:
		userIDUint = uint(v)
	}

	var deathCert models.DeathCertificate
	isUpdate := input.ID > 0

	if isUpdate {
		if err := database.DB.First(&deathCert, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat kematian tidak ditemukan"})
			return
		}
	} else {
		// Parse visit ID
		vid, err := strconv.ParseUint(visitID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visit ID"})
			return
		}
		deathCert.VisitID = uint(vid)
		deathCert.CertificateNumber = generateDeathCertificateNumber()
		deathCert.IssuedAt = time.Now()
		deathCert.IssuedByID = &userIDUint
	}

	// Update fields
	deathCert.DeathType = input.DeathType
	deathCert.DeathDateTime = input.DeathDateTime
	deathCert.DeathLocation = input.DeathLocation
	deathCert.PrimaryCauseCode = input.PrimaryCauseCode
	deathCert.PrimaryCauseName = input.PrimaryCauseName
	deathCert.SecondaryCauseCode = input.SecondaryCauseCode
	deathCert.SecondaryCauseName = input.SecondaryCauseName
	deathCert.UnderlyingCauseCode = input.UnderlyingCauseCode
	deathCert.UnderlyingCauseName = input.UnderlyingCauseName
	deathCert.MannerOfDeath = input.MannerOfDeath
	deathCert.DurationOfIllness = input.DurationOfIllness
	deathCert.AutopsyPerformed = input.AutopsyPerformed
	deathCert.AutopsyFindings = input.AutopsyFindings
	deathCert.DeclaringDoctorID = input.DeclaringDoctorID
	deathCert.DeclaringDoctorName = input.DeclaringDoctorName
	deathCert.WitnessName = input.WitnessName
	deathCert.WitnessRelation = input.WitnessRelation
	deathCert.Notes = input.Notes

	if err := database.DB.Save(&deathCert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.Preload("DeclaringDoctor").Preload("IssuedBy").First(&deathCert, deathCert.ID)

	c.JSON(http.StatusOK, deathCert)
}

// DeleteDeathCertificate deletes a death certificate
func DeleteDeathCertificate(c *gin.Context) {
	certID := c.Param("certId")

	var deathCert models.DeathCertificate
	if err := database.DB.First(&deathCert, certID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat kematian tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&deathCert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Surat kematian berhasil dihapus"})
}

// generateDeathCertificateNumber generates a unique certificate number
func generateDeathCertificateNumber() string {
	now := time.Now()

	// Count certificates this month
	var count int64
	database.DB.Model(&models.DeathCertificate{}).
		Where("EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?", now.Year(), int(now.Month())).
		Count(&count)

	return fmt.Sprintf("SKM/%d-%02d/%05d", now.Year(), int(now.Month()), count+1)
}

// ===========================================================================
// HEALTH CERTIFICATE (SURAT KETERANGAN SEHAT) HANDLERS
// ===========================================================================

func GetHealthCertificates(c *gin.Context) {
	visitID := c.Param("id")
	var certs []models.HealthCertificate
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, c.Query("is_casemix") == "true").Preload("IssuedBy").Order("created_at DESC").Find(&certs)
	c.JSON(http.StatusOK, certs)
}

func SaveHealthCertificate(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ID          uint   `json:"id"`
		ExamDate    string `json:"exam_date"`
		Purpose     string `json:"purpose"`
		Institution string `json:"institution"`
		Result      string `json:"result"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	examDate, err := ParseLocalDate(input.ExamDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
		return
	}

	var employeeID *uint
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil {
		if user.Employee != nil {
			employeeID = &user.Employee.ID
		}
	}

	var cert models.HealthCertificate
	if input.ID > 0 {
		if err := database.DB.First(&cert, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat keterangan sehat tidak ditemukan"})
			return
		}
		cert.ExamDate = examDate
		cert.Purpose = input.Purpose
		cert.Institution = input.Institution
		cert.Result = input.Result
		cert.Notes = input.Notes
	} else {
		var visitIDUint uint
		fmt.Sscanf(visitID, "%d", &visitIDUint)
		cert = models.HealthCertificate{
			VisitID:      visitIDUint,
			LetterNumber: generateHealthCertificateNumber(),
			ExamDate:     examDate,
			Purpose:      input.Purpose,
			Institution:  input.Institution,
			Result:       input.Result,
			Notes:        input.Notes,
			Status:       "active",
			IssuedByID:   employeeID,
			IssuedAt:     time.Now(),
		}
	}

	if err := database.DB.Save(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	database.DB.Preload("IssuedBy").First(&cert, cert.ID)
	c.JSON(http.StatusOK, cert)
}

func DeleteHealthCertificate(c *gin.Context) {
	certID := c.Param("certId")
	var cert models.HealthCertificate
	if err := database.DB.First(&cert, certID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat keterangan sehat tidak ditemukan"})
		return
	}
	if err := database.DB.Delete(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Surat keterangan sehat berhasil dihapus"})
}

func generateHealthCertificateNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.HealthCertificate{}).Where("DATE(created_at) = DATE(?)", now).Count(&count)
	return fmt.Sprintf("SKSH/%s/%04d", now.Format("20060102"), count+1)
}

// ===========================================================================
// BIRTH CERTIFICATE (SURAT KETERANGAN KELAHIRAN) HANDLERS
// ===========================================================================

func GetBirthCertificates(c *gin.Context) {
	visitID := c.Param("id")
	var certs []models.BirthCertificate
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, c.Query("is_casemix") == "true").Preload("IssuedBy").Order("created_at DESC").Find(&certs)
	c.JSON(http.StatusOK, certs)
}

func SaveBirthCertificate(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ID          uint    `json:"id"`
		BirthDate   string  `json:"birth_date"`
		BirthTime   string  `json:"birth_time"`
		BabyName    string  `json:"baby_name"`
		Gender      string  `json:"gender"`
		BirthWeight float64 `json:"birth_weight"`
		BirthLength float64 `json:"birth_length"`
		BirthMethod string  `json:"birth_method"`
		MotherName  string  `json:"mother_name"`
		FatherName  string  `json:"father_name"`
		ApgarScore  string  `json:"apgar_score"`
		Notes       string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	birthDate, err := ParseLocalDate(input.BirthDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal lahir tidak valid"})
		return
	}

	var fatherName string
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		First(&visit, visitID).Error; err == nil {
		if visit.Registration != nil && visit.Registration.Patient != nil {
			patient := visit.Registration.Patient
			if strings.EqualFold(patient.HubunganPenanggungJawab, "suami") && patient.NamaPenanggungJawab != "" {
				fatherName = patient.NamaPenanggungJawab
			}
		}
	}
	if fatherName == "" {
		fatherName = input.FatherName
	}

	var employeeID *uint
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil {
		if user.Employee != nil {
			employeeID = &user.Employee.ID
		}
	}

	var cert models.BirthCertificate
	if input.ID > 0 {
		if err := database.DB.First(&cert, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat kelahiran tidak ditemukan"})
			return
		}
		cert.BirthDate = birthDate
		cert.BirthTime = input.BirthTime
		cert.BabyName = input.BabyName
		cert.Gender = input.Gender
		cert.BirthWeight = input.BirthWeight
		cert.BirthLength = input.BirthLength
		cert.BirthMethod = input.BirthMethod
		cert.MotherName = input.MotherName
		cert.FatherName = fatherName
		cert.ApgarScore = ""
		cert.Notes = input.Notes
	} else {
		var visitIDUint uint
		fmt.Sscanf(visitID, "%d", &visitIDUint)
		cert = models.BirthCertificate{
			VisitID:      visitIDUint,
			LetterNumber: generateBirthCertificateNumber(),
			BirthDate:    birthDate,
			BirthTime:    input.BirthTime,
			BabyName:     input.BabyName,
			Gender:       input.Gender,
			BirthWeight:  input.BirthWeight,
			BirthLength:  input.BirthLength,
			BirthMethod:  input.BirthMethod,
			MotherName:   input.MotherName,
			FatherName:   fatherName,
			ApgarScore:   "",
			Notes:        input.Notes,
			Status:       "active",
			IssuedByID:   employeeID,
			IssuedAt:     time.Now(),
		}
	}

	if err := database.DB.Save(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	database.DB.Preload("IssuedBy").First(&cert, cert.ID)
	c.JSON(http.StatusOK, cert)
}

func DeleteBirthCertificate(c *gin.Context) {
	certID := c.Param("certId")
	var cert models.BirthCertificate
	if err := database.DB.First(&cert, certID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat kelahiran tidak ditemukan"})
		return
	}
	if err := database.DB.Delete(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Surat kelahiran berhasil dihapus"})
}

func generateBirthCertificateNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.BirthCertificate{}).Where("DATE(created_at) = DATE(?)", now).Count(&count)
	return fmt.Sprintf("SKL/%s/%04d", now.Format("20060102"), count+1)
}

// ===========================================================================
// LEAVE CERTIFICATE (SURAT KETERANGAN CUTI) HANDLERS
// ===========================================================================

func GetLeaveCertificates(c *gin.Context) {
	visitID := c.Param("id")
	var certs []models.LeaveCertificate
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, c.Query("is_casemix") == "true").Preload("IssuedBy").Order("created_at DESC").Find(&certs)
	c.JSON(http.StatusOK, certs)
}

func SaveLeaveCertificate(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ID          uint   `json:"id"`
		LeaveType   string `json:"leave_type"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		Days        int    `json:"days"`
		Reason      string `json:"reason"`
		Diagnosis   string `json:"diagnosis"`
		Institution string `json:"institution"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate, err := ParseLocalDate(input.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal mulai tidak valid"})
		return
	}
	endDate, err := ParseLocalDate(input.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal selesai tidak valid"})
		return
	}
	days := input.Days
	if days <= 0 {
		days = int(endDate.Sub(startDate).Hours()/24) + 1
	}

	var employeeID *uint
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil {
		if user.Employee != nil {
			employeeID = &user.Employee.ID
		}
	}

	var cert models.LeaveCertificate
	if input.ID > 0 {
		if err := database.DB.First(&cert, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat cuti tidak ditemukan"})
			return
		}
		cert.LeaveType = input.LeaveType
		cert.StartDate = startDate
		cert.EndDate = endDate
		cert.Days = days
		cert.Reason = input.Reason
		cert.Diagnosis = input.Diagnosis
		cert.Institution = input.Institution
		cert.Notes = input.Notes
	} else {
		var visitIDUint uint
		fmt.Sscanf(visitID, "%d", &visitIDUint)
		cert = models.LeaveCertificate{
			VisitID:      visitIDUint,
			LetterNumber: generateLeaveCertificateNumber(),
			LeaveType:    input.LeaveType,
			StartDate:    startDate,
			EndDate:      endDate,
			Days:         days,
			Reason:       input.Reason,
			Diagnosis:    input.Diagnosis,
			Institution:  input.Institution,
			Notes:        input.Notes,
			Status:       "active",
			IssuedByID:   employeeID,
			IssuedAt:     time.Now(),
		}
	}

	if err := database.DB.Save(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	database.DB.Preload("IssuedBy").First(&cert, cert.ID)
	c.JSON(http.StatusOK, cert)
}

func DeleteLeaveCertificate(c *gin.Context) {
	certID := c.Param("certId")
	var cert models.LeaveCertificate
	if err := database.DB.First(&cert, certID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat cuti tidak ditemukan"})
		return
	}
	if err := database.DB.Delete(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Surat cuti berhasil dihapus"})
}

func generateLeaveCertificateNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.LeaveCertificate{}).Where("DATE(created_at) = DATE(?)", now).Count(&count)
	return fmt.Sprintf("SKC/%s/%04d", now.Format("20060102"), count+1)
}

// ===========================================================================
// MCU CERTIFICATE (MEDICAL CHECK-UP) HANDLERS
// ===========================================================================

func GetMCUCertificates(c *gin.Context) {
	visitID := c.Param("id")
	var certs []models.MCUCertificate
	database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, c.Query("is_casemix") == "true").Preload("IssuedBy").Order("created_at DESC").Find(&certs)
	c.JSON(http.StatusOK, certs)
}

func SaveMCUCertificate(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		ID             uint   `json:"id"`
		ExamDate       string `json:"exam_date"`
		Purpose        string `json:"purpose"`
		Institution    string `json:"institution"`
		Conclusion     string `json:"conclusion"`
		Recommendation string `json:"recommendation"`
		Notes          string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	examDate, err := ParseLocalDate(input.ExamDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
		return
	}

	var employeeID *uint
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil {
		if user.Employee != nil {
			employeeID = &user.Employee.ID
		}
	}

	var cert models.MCUCertificate
	if input.ID > 0 {
		if err := database.DB.First(&cert, input.ID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Surat MCU tidak ditemukan"})
			return
		}
		cert.ExamDate = examDate
		cert.Purpose = input.Purpose
		cert.Institution = input.Institution
		cert.Conclusion = input.Conclusion
		cert.Recommendation = input.Recommendation
		cert.Notes = input.Notes
	} else {
		var visitIDUint uint
		fmt.Sscanf(visitID, "%d", &visitIDUint)
		cert = models.MCUCertificate{
			VisitID:        visitIDUint,
			LetterNumber:   generateMCUCertificateNumber(),
			ExamDate:       examDate,
			Purpose:        input.Purpose,
			Institution:    input.Institution,
			Conclusion:     input.Conclusion,
			Recommendation: input.Recommendation,
			Notes:          input.Notes,
			Status:         "active",
			IssuedByID:     employeeID,
			IssuedAt:       time.Now(),
		}
	}

	if err := database.DB.Save(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	database.DB.Preload("IssuedBy").First(&cert, cert.ID)
	c.JSON(http.StatusOK, cert)
}

func DeleteMCUCertificate(c *gin.Context) {
	certID := c.Param("certId")
	var cert models.MCUCertificate
	if err := database.DB.First(&cert, certID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Surat MCU tidak ditemukan"})
		return
	}
	if err := database.DB.Delete(&cert).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Surat MCU berhasil dihapus"})
}

func generateMCUCertificateNumber() string {
	now := time.Now()
	var count int64
	database.DB.Model(&models.MCUCertificate{}).Where("DATE(created_at) = DATE(?)", now).Count(&count)
	return fmt.Sprintf("MCU/%s/%04d", now.Format("20060102"), count+1)
}

// ===========================================================================
// MEDICAL RECORD EDIT LOG HANDLERS
// ===========================================================================

// CreateMedicalRecordEditLog creates a new edit log entry
// This should be called when someone edits a medical record after patient discharge
func CreateMedicalRecordEditLog(c *gin.Context) {
	visitID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		RecordType string `json:"record_type" binding:"required"` // triage, anamnesis, physical_exam, etc.
		RecordID   uint   `json:"record_id" binding:"required"`
		Action     string `json:"action" binding:"required"` // edit, create, delete
		FieldsJSON string `json:"fields_json,omitempty"`
		Reason     string `json:"reason,omitempty"`
		Notes      string `json:"notes,omitempty"`
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

	// Parse visit ID
	visitIDUint, err := strconv.ParseUint(visitID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visit ID"})
		return
	}

	// Create edit log
	editLog := models.MedicalRecordEditLog{
		VisitID:    uint(visitIDUint),
		RecordType: input.RecordType,
		RecordID:   input.RecordID,
		Action:     input.Action,
		FieldsJSON: input.FieldsJSON,
		Reason:     input.Reason,
		Notes:      input.Notes,
		EditedByID: userID,
		EditedAt:   time.Now(),
		IPAddress:  c.ClientIP(),
	}

	if err := database.DB.Create(&editLog).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.Preload("EditedBy").First(&editLog, editLog.ID)

	c.JSON(http.StatusOK, editLog)
}

// GetMedicalRecordEditLogs retrieves edit logs for a visit
func GetMedicalRecordEditLogs(c *gin.Context) {
	visitID := c.Param("id")

	var logs []models.MedicalRecordEditLog
	query := database.DB.Where("visit_id = ?", visitID).
		Preload("EditedBy").
		Order("created_at DESC")

	// Optional filter by record type
	if recordType := c.Query("record_type"); recordType != "" {
		query = query.Where("record_type = ?", recordType)
	}

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}
