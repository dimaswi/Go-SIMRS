package handlers

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func getClinicalDB(c *gin.Context) *gorm.DB {
	if c.Query("rm_duplicate_id") != "" || c.Query("is_casemix") == "true" {
		return database.CasemixDB
	}
	return database.DB
}

func useCasemixClinicalData(c *gin.Context) bool {
	return c.Query("rm_duplicate_id") != "" || c.Query("is_casemix") == "true"
}

func clinicalVisitQuery(c *gin.Context, visitID interface{}) *gorm.DB {
	return applyCasemixEklaimScope(c, getClinicalDB(c).Where("visit_id = ? AND is_casemix = ?", visitID, useCasemixClinicalData(c)))
}

func clinicalSourceVisitQuery(c *gin.Context, visitID interface{}) *gorm.DB {
	return applyCasemixEklaimScope(c, getClinicalDB(c).Where("source_visit_id = ? AND is_casemix = ?", visitID, useCasemixClinicalData(c)))
}

func parseRMDuplicateDateTime(value string) time.Time {
	if strings.TrimSpace(value) == "" {
		return time.Time{}
	}
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02",
		time.RFC3339,
	}
	for _, format := range formats {
		if t, err := time.Parse(format, value); err == nil {
			return t
		}
	}
	return time.Time{}
}

func ensureCasemixMirrorFromRMDuplicate(c *gin.Context, visitID uint) {
	rmDupIDStr := c.Query("rm_duplicate_id")
	if rmDupIDStr == "" || database.CasemixDB == nil {
		return
	}

	rmDupID64, err := strconv.ParseUint(rmDupIDStr, 10, 32)
	if err != nil || rmDupID64 == 0 {
		return
	}
	rmDupID := uint(rmDupID64)

	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.
		Preload("Diagnoses").
		Preload("CPPTNotes").
		Preload("NursingCares").
		Preload("FluidBalances").
		First(&rmDup, rmDupID).Error; err != nil {
		return
	}
	if rmDup.VisitID != 0 && visitID != 0 && rmDup.VisitID != visitID {
		return
	}

	casemixEklaimID := rmDup.EKlaimLocalID
	cmx := database.CasemixDB

	// Anamnesis
	anamnesisUpdates := map[string]interface{}{
		"is_casemix":                 true,
		"casemix_eklaim_id":          casemixEklaimID,
		"anamnesis_source":           rmDup.AnamnesisSource,
		"functional_status":          rmDup.FunctionalStatus,
		"chief_complaint":            rmDup.ChiefComplaint,
		"history_of_present_illness": rmDup.HistoryOfPresentIllness,
		"past_medical_history":       rmDup.PastMedicalHistory,
		"family_history":             rmDup.FamilyHistory,
		"social_history":             rmDup.SocialHistory,
		"allergies":                  rmDup.Allergies,
		"current_medications":        rmDup.CurrentMedications,
		"review_of_systems":          rmDup.ReviewOfSystems,
	}
	var anamnesis models.Anamnesis
	if err := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID).First(&anamnesis).Error; err == nil {
		cmx.Model(&anamnesis).Updates(anamnesisUpdates)
	} else {
		anamnesis = models.Anamnesis{
			VisitID:                 rmDup.VisitID,
			IsCasemix:               true,
			CasemixEklaimID:         &casemixEklaimID,
			AnamnesisSource:         rmDup.AnamnesisSource,
			FunctionalStatus:        rmDup.FunctionalStatus,
			ChiefComplaint:          rmDup.ChiefComplaint,
			HistoryOfPresentIllness: rmDup.HistoryOfPresentIllness,
			PastMedicalHistory:      rmDup.PastMedicalHistory,
			FamilyHistory:           rmDup.FamilyHistory,
			SocialHistory:           rmDup.SocialHistory,
			Allergies:               rmDup.Allergies,
			CurrentMedications:      rmDup.CurrentMedications,
			ReviewOfSystems:         rmDup.ReviewOfSystems,
		}
		cmx.Create(&anamnesis)
	}

	// Physical Examination
	physicalUpdates := map[string]interface{}{
		"is_casemix":         true,
		"casemix_eklaim_id":  casemixEklaimID,
		"general_condition":  rmDup.GeneralCondition,
		"consciousness":      rmDup.Consciousness,
		"blood_pressure":     rmDup.BloodPressure,
		"systolic":           rmDup.Systolic,
		"diastolic":          rmDup.Diastolic,
		"heart_rate":         rmDup.HeartRate,
		"respiratory_rate":   rmDup.RespiratoryRate,
		"temperature":        rmDup.Temperature,
		"oxygen_saturation":  rmDup.OxygenSaturation,
		"weight":             rmDup.Weight,
		"height":             rmDup.Height,
		"bmi":                rmDup.BMI,
		"head_circum":        rmDup.HeadCircum,
		"waist":              rmDup.Waist,
		"pain_method":        rmDup.PainMethod,
		"pain_scale":         rmDup.PainScale,
		"pain_location":      rmDup.PainLocation,
		"head":               rmDup.Head,
		"eyes":               rmDup.Eyes,
		"ears":               rmDup.Ears,
		"nose":               rmDup.Nose,
		"throat":             rmDup.Throat,
		"ent":                rmDup.ENT,
		"neck":               rmDup.Neck,
		"chest":              rmDup.Chest,
		"thorax":             rmDup.Thorax,
		"heart":              rmDup.Heart,
		"cardiac":            rmDup.Cardiac,
		"lungs":              rmDup.Lungs,
		"pulmonary":          rmDup.Pulmonary,
		"abdomen":            rmDup.Abdomen,
		"extremities":        rmDup.Extremities,
		"skin":               rmDup.Skin,
		"neurological":       rmDup.Neurological,
		"musculoskel":        rmDup.Musculoskel,
		"genitourinary":      rmDup.Genitourinary,
		"other_findings":     rmDup.OtherFindings,
		"ecg_performed":      rmDup.ECGPerformed,
		"ecg_result":         rmDup.ECGResult,
		"ecg_interpretation": rmDup.ECGInterpretation,
		"ecg_notes":          rmDup.ECGNotes,
	}
	var physical models.PhysicalExamination
	if err := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID).First(&physical).Error; err == nil {
		cmx.Model(&physical).Updates(physicalUpdates)
	} else {
		physical = models.PhysicalExamination{
			VisitID:           rmDup.VisitID,
			IsCasemix:         true,
			CasemixEklaimID:   &casemixEklaimID,
			GeneralCondition:  rmDup.GeneralCondition,
			Consciousness:     rmDup.Consciousness,
			BloodPressure:     rmDup.BloodPressure,
			Systolic:          rmDup.Systolic,
			Diastolic:         rmDup.Diastolic,
			HeartRate:         rmDup.HeartRate,
			RespiratoryRate:   rmDup.RespiratoryRate,
			Temperature:       rmDup.Temperature,
			OxygenSaturation:  rmDup.OxygenSaturation,
			Weight:            rmDup.Weight,
			Height:            rmDup.Height,
			BMI:               rmDup.BMI,
			HeadCircum:        rmDup.HeadCircum,
			Waist:             rmDup.Waist,
			PainMethod:        rmDup.PainMethod,
			PainScale:         rmDup.PainScale,
			PainLocation:      rmDup.PainLocation,
			Head:              rmDup.Head,
			Eyes:              rmDup.Eyes,
			Ears:              rmDup.Ears,
			Nose:              rmDup.Nose,
			Throat:            rmDup.Throat,
			ENT:               rmDup.ENT,
			Neck:              rmDup.Neck,
			Chest:             rmDup.Chest,
			Thorax:            rmDup.Thorax,
			Heart:             rmDup.Heart,
			Cardiac:           rmDup.Cardiac,
			Lungs:             rmDup.Lungs,
			Pulmonary:         rmDup.Pulmonary,
			Abdomen:           rmDup.Abdomen,
			Extremities:       rmDup.Extremities,
			Skin:              rmDup.Skin,
			Neurological:      rmDup.Neurological,
			Musculoskel:       rmDup.Musculoskel,
			Genitourinary:     rmDup.Genitourinary,
			OtherFindings:     rmDup.OtherFindings,
			ECGPerformed:      rmDup.ECGPerformed,
			ECGResult:         rmDup.ECGResult,
			ECGInterpretation: rmDup.ECGInterpretation,
			ECGNotes:          rmDup.ECGNotes,
		}
		cmx.Create(&physical)
	}

	// Assessment Plan
	assessmentUpdates := map[string]interface{}{
		"is_casemix":          true,
		"casemix_eklaim_id":   casemixEklaimID,
		"clinical_assessment": rmDup.ClinicalAssessment,
		"prognosis":           rmDup.Prognosis,
		"treatment_plan":      rmDup.TreatmentPlan,
		"medication_plan":     rmDup.MedicationPlan,
		"diet_plan":           rmDup.DietPlan,
		"activity_plan":       rmDup.ActivityPlan,
		"education_plan":      rmDup.EducationPlan,
		"monitoring_plan":     rmDup.MonitoringPlan,
		"procedure_plan":      rmDup.ProcedurePlan,
		"consultation_plan":   rmDup.ConsultationPlan,
	}
	var assessment models.AssessmentPlan
	if err := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID).First(&assessment).Error; err == nil {
		cmx.Model(&assessment).Updates(assessmentUpdates)
	} else {
		assessment = models.AssessmentPlan{
			VisitID:            rmDup.VisitID,
			IsCasemix:          true,
			CasemixEklaimID:    &casemixEklaimID,
			ClinicalAssessment: rmDup.ClinicalAssessment,
			Prognosis:          rmDup.Prognosis,
			TreatmentPlan:      rmDup.TreatmentPlan,
			MedicationPlan:     rmDup.MedicationPlan,
			DietPlan:           rmDup.DietPlan,
			ActivityPlan:       rmDup.ActivityPlan,
			EducationPlan:      rmDup.EducationPlan,
			MonitoringPlan:     rmDup.MonitoringPlan,
			ProcedurePlan:      rmDup.ProcedurePlan,
			ConsultationPlan:   rmDup.ConsultationPlan,
		}
		cmx.Create(&assessment)
	}

	// Disposition
	dispositionUpdates := map[string]interface{}{
		"is_casemix":            true,
		"casemix_eklaim_id":     casemixEklaimID,
		"disposition_type":      rmDup.DispositionType,
		"disposition_note":      rmDup.DispositionNote,
		"discharge_status":      rmDup.DischargeStatus,
		"discharge_condition":   rmDup.DischargeCondition,
		"discharge_instruction": rmDup.DischargeInstruction,
		"discharge_medication":  rmDup.DischargeMedication,
		"follow_up_instruction": rmDup.FollowUpInstruction,
		"referral_facility":     rmDup.ReferralFacility,
		"referral_reason":       rmDup.ReferralReason,
		"referral_diagnosis":    rmDup.ReferralDiagnosis,
		"referral_therapy":      rmDup.ReferralTherapy,
		"referral_notes":        rmDup.ReferralNotes,
		"death_cause":           rmDup.DeathCause,
	}
	if followUpDate := parseFollowUpDate(rmDup.FollowUpDate); followUpDate != nil {
		dispositionUpdates["follow_up_date"] = *followUpDate
	}
	if deathTime := parseRMDuplicateDateTime(rmDup.DeathTime); !deathTime.IsZero() {
		dispositionUpdates["death_time"] = deathTime
	}
	var disposition models.Disposition
	if err := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID).First(&disposition).Error; err == nil {
		cmx.Model(&disposition).Updates(dispositionUpdates)
	} else {
		disposition = models.Disposition{
			VisitID:              rmDup.VisitID,
			IsCasemix:            true,
			CasemixEklaimID:      &casemixEklaimID,
			DispositionType:      rmDup.DispositionType,
			DispositionNote:      rmDup.DispositionNote,
			DischargeStatus:      rmDup.DischargeStatus,
			DischargeCondition:   rmDup.DischargeCondition,
			DischargeInstruction: rmDup.DischargeInstruction,
			DischargeMedication:  rmDup.DischargeMedication,
			FollowUpDate:         parseFollowUpDate(rmDup.FollowUpDate),
			FollowUpInstruction:  rmDup.FollowUpInstruction,
			ReferralFacility:     rmDup.ReferralFacility,
			ReferralReason:       rmDup.ReferralReason,
			ReferralDiagnosis:    rmDup.ReferralDiagnosis,
			ReferralTherapy:      rmDup.ReferralTherapy,
			ReferralNotes:        rmDup.ReferralNotes,
			DeathCause:           rmDup.DeathCause,
		}
		if deathTime := parseRMDuplicateDateTime(rmDup.DeathTime); !deathTime.IsZero() {
			disposition.DeathTime = &deathTime
		}
		cmx.Create(&disposition)
	}

	// Triage
	if rmDup.HasTriage {
		triageUpdates := map[string]interface{}{
			"is_casemix":        true,
			"casemix_eklaim_id": casemixEklaimID,
			"arrival_mode":      rmDup.TriageArrivalMode,
			"triage_complaint":  rmDup.TriageComplaint,
			"triage_level":      rmDup.TriageLevel,
			"airway":            rmDup.TriageAirway,
			"airway_note":       rmDup.TriageAirwayNote,
			"breathing":         rmDup.TriageBreathing,
			"breathing_note":    rmDup.TriageBreathingNote,
			"breathing_rate":    rmDup.TriageRespiratoryRate,
			"circulation":       rmDup.TriageCirculation,
			"circulation_note":  rmDup.TriageCirculationNote,
			"blood_pressure":    rmDup.TriageBloodPressure,
			"heart_rate":        rmDup.TriageHeartRate,
			"temperature":       rmDup.TriageTemperature,
			"oxygen_saturation": rmDup.TriageOxygenSat,
			"pain_scale":        rmDup.TriagePainScale,
			"gcs_e":             rmDup.TriageGCSE,
			"gcs_v":             rmDup.TriageGCSV,
			"gcs_m":             rmDup.TriageGCSM,
			"triage_assessment": rmDup.TriageAssessment,
			"immediate_actions": rmDup.TriageImmediateAction,
		}
		var triage models.Triage
		if err := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID).First(&triage).Error; err == nil {
			cmx.Model(&triage).Updates(triageUpdates)
		} else {
			triage = models.Triage{
				VisitID:          rmDup.VisitID,
				IsCasemix:        true,
				CasemixEklaimID:  &casemixEklaimID,
				ArrivalMode:      rmDup.TriageArrivalMode,
				TriageComplaint:  rmDup.TriageComplaint,
				TriageLevel:      rmDup.TriageLevel,
				Airway:           rmDup.TriageAirway,
				AirwayNote:       rmDup.TriageAirwayNote,
				Breathing:        rmDup.TriageBreathing,
				BreathingNote:    rmDup.TriageBreathingNote,
				BreathingRate:    rmDup.TriageRespiratoryRate,
				Circulation:      rmDup.TriageCirculation,
				CirculationNote:  rmDup.TriageCirculationNote,
				BloodPressure:    rmDup.TriageBloodPressure,
				HeartRate:        rmDup.TriageHeartRate,
				Temperature:      rmDup.TriageTemperature,
				OxygenSaturation: rmDup.TriageOxygenSat,
				PainScale:        rmDup.TriagePainScale,
				GCSE:             rmDup.TriageGCSE,
				GCSV:             rmDup.TriageGCSV,
				GCSM:             rmDup.TriageGCSM,
				TriageAssessment: rmDup.TriageAssessment,
				ImmediateActions: rmDup.TriageImmediateAction,
			}
			cmx.Create(&triage)
		}
	}

	// Diagnoses
	diagQuery := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID)
	diagQuery.Delete(&models.Diagnosis{})
	for i, d := range rmDup.Diagnoses {
		diag := models.Diagnosis{
			VisitID:         rmDup.VisitID,
			IsCasemix:       true,
			CasemixEklaimID: &casemixEklaimID,
			Type:            d.Type,
			ICD10Code:       d.ICD10Code,
			ICD10Name:       d.ICD10Name,
		}
		if diag.Type == "" {
			diag.Type = "secondary"
		}
		if diag.ICD10Code == "" {
			diag.ICD10Code = fmt.Sprintf("DUP-%d", i+1)
		}
		if diag.ICD10Name == "" {
			diag.ICD10Name = "-"
		}
		cmx.Create(&diag)
	}

	// CPPT
	cpptQuery := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID)
	cpptQuery.Delete(&models.CPPT{})
	for _, row := range rmDup.CPPTNotes {
		if row.IsFake {
			continue
		}
		recordDate := parseRMDuplicateDateTime(row.RecordDate)
		if recordDate.IsZero() {
			recordDate = time.Now()
		}
		cppt := models.CPPT{
			VisitID:          rmDup.VisitID,
			IsCasemix:        true,
			CasemixEklaimID:  &casemixEklaimID,
			RecordDate:       recordDate,
			Profession:       row.Profession,
			CPPTFormat:       row.CPPTFormat,
			Subjective:       row.Subjective,
			Objective:        row.Objective,
			Assessment:       row.Assessment,
			Plan:             row.Plan,
			Instruction:      row.Instruction,
			BloodPressure:    row.BloodPressure,
			HeartRate:        row.HeartRate,
			RespiratoryRate:  row.RespiratoryRate,
			Temperature:      row.Temperature,
			OxygenSaturation: row.OxygenSaturation,
			PainScale:        row.PainScale,
		}
		if cppt.Profession == "" {
			cppt.Profession = models.CPPTProfessionDoctor
		}
		if cppt.CPPTFormat == "" {
			cppt.CPPTFormat = models.CPPTFormatSOAP
		}
		cmx.Create(&cppt)
	}

	// Nursing Care
	nursingQuery := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID)
	nursingQuery.Delete(&models.NursingCare{})
	for _, row := range rmDup.NursingCares {
		if row.IsFake {
			continue
		}
		recordDate := parseRMDuplicateDateTime(row.RecordDate)
		if recordDate.IsZero() {
			recordDate = time.Now()
		}
		implementationTime := parseRMDuplicateDateTime(row.ImplementationTime)
		nursing := models.NursingCare{
			VisitID:                 rmDup.VisitID,
			IsCasemix:               true,
			CasemixEklaimID:         &casemixEklaimID,
			RecordDate:              recordDate,
			ShiftType:               row.ShiftType,
			ChiefComplaint:          row.ChiefComplaint,
			PainAssessment:          row.PainAssessment,
			PainScale:               row.PainScale,
			ConsciousnessLevel:      row.ConsciousnessLevel,
			FunctionalStatus:        row.FunctionalStatus,
			FallRiskAssessment:      row.FallRiskAssessment,
			FallRiskScore:           row.FallRiskScore,
			NutritionAssessment:     row.NutritionAssessment,
			SkinAssessment:          row.SkinAssessment,
			PressureUlcerRisk:       row.PressureUlcerRisk,
			BloodPressure:           row.BloodPressure,
			HeartRate:               row.HeartRate,
			RespiratoryRate:         row.RespiratoryRate,
			Temperature:             row.Temperature,
			OxygenSaturation:        row.OxygenSaturation,
			NursingDiagnosis:        row.NursingDiagnosis,
			NursingDiagnosisCode:    row.NursingDiagnosisCode,
			ProblemEtiology:         row.ProblemEtiology,
			SignsSymptoms:           row.SignsSymptoms,
			NursingOutcome:          row.NursingOutcome,
			NursingOutcomeCode:      row.NursingOutcomeCode,
			OutcomeIndicators:       row.OutcomeIndicators,
			OutcomeTarget:           row.OutcomeTarget,
			NursingIntervention:     row.NursingIntervention,
			NursingInterventionCode: row.NursingInterventionCode,
			ObservationActions:      row.ObservationActions,
			TherapeuticActions:      row.TherapeuticActions,
			EducationActions:        row.EducationActions,
			CollaborationActions:    row.CollaborationActions,
			Implementation:          row.Implementation,
			PatientResponse:         row.PatientResponse,
			EvaluationSubjective:    row.EvaluationSubjective,
			EvaluationObjective:     row.EvaluationObjective,
			EvaluationAnalysis:      row.EvaluationAnalysis,
			EvaluationPlanning:      row.EvaluationPlanning,
			ProblemStatus:           row.ProblemStatus,
			Notes:                   row.Notes,
		}
		if !implementationTime.IsZero() {
			nursing.ImplementationTime = implementationTime
		}
		cmx.Create(&nursing)
	}

	// Fluid Balance
	fluidQuery := cmx.Where("visit_id = ? AND is_casemix = ? AND casemix_eklaim_id = ?", rmDup.VisitID, true, casemixEklaimID)
	fluidQuery.Delete(&models.FluidBalance{})
	for _, row := range rmDup.FluidBalances {
		if row.IsFake {
			continue
		}
		recordDate := parseRMDuplicateDateTime(row.RecordDate)
		if recordDate.IsZero() {
			recordDate = time.Now()
		}
		fluid := models.FluidBalance{
			VisitID:         rmDup.VisitID,
			IsCasemix:       true,
			CasemixEklaimID: &casemixEklaimID,
			RecordDate:      recordDate,
			ShiftType:       row.ShiftType,
			OralDrink:       row.OralDrink,
			OralFood:        row.OralFood,
			OralMedicine:    row.OralMedicine,
			IVFluid:         row.IVFluid,
			IVMedicine:      row.IVMedicine,
			BloodProduct:    row.BloodProduct,
			EnteralFeed:     row.EnteralFeed,
			OtherIntake:     row.OtherIntake,
			UrineAmount:     row.UrineAmount,
			FecesAmount:     row.FecesAmount,
			VomitAmount:     row.VomitAmount,
			DrainAmount:     row.DrainAmount,
			BloodLoss:       row.BloodLoss,
			IWL:             row.IWL,
			OtherOutput:     row.OtherOutput,
			TotalIntake:     row.TotalIntake,
			TotalOutput:     row.TotalOutput,
			Balance:         row.Balance,
			Notes:           row.Notes,
		}
		cmx.Create(&fluid)
	}
}

func prepareCasemixPrintData(c *gin.Context, visitID uint) {
	if c.Query("rm_duplicate_id") == "" {
		return
	}
	ensureCasemixMirrorFromRMDuplicate(c, visitID)
	rmDupID, err := strconv.ParseUint(c.Query("rm_duplicate_id"), 10, 32)
	if err == nil && rmDupID > 0 {
		InvalidateRMDuplicatePDFCaches(uint(rmDupID))
	}
}
