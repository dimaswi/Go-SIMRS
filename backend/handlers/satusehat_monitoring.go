package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// GetEncounterSatuSehatStatus returns SatuSehat sync status for an encounter
func GetEncounterSatuSehatStatus(c *gin.Context) {
	visitID := c.Param("id")

	// Load visit dengan relasi
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	patient := visit.Registration.Patient

	// Early definition of encounterSent for use in can_send calculations
	encounterSent := visit.SatuSehatEncounterID != ""

	// ========== DIAGNOSIS ==========
	var diagnoses []models.Diagnosis
	database.DB.Where("visit_id = ?", visitID).Order("type ASC").Find(&diagnoses)

	diagnosisItems := []gin.H{}
	diagnosisSentCount := 0
	hasPrimary := false
	for _, d := range diagnoses {
		sent := d.SatuSehatConditionID != ""
		if sent {
			diagnosisSentCount++
		}
		if d.Type == "primary" {
			hasPrimary = true
		}
		diagnosisItems = append(diagnosisItems, gin.H{
			"id":           d.ID,
			"icd10_code":   d.ICD10Code,
			"icd10_name":   d.ICD10Name,
			"type":         d.Type,
			"sent":         sent,
			"condition_id": d.SatuSehatConditionID,
		})
	}

	// ========== VITAL SIGNS ==========
	var physicalExam models.PhysicalExamination
	database.DB.Where("visit_id = ?", visitID).First(&physicalExam)

	vitalItems := []gin.H{}
	if physicalExam.ID > 0 {
		if physicalExam.Systolic > 0 {
			vitalItems = append(vitalItems, gin.H{"name": "Systolic Blood Pressure", "value": physicalExam.Systolic, "unit": "mmHg"})
		}
		if physicalExam.Diastolic > 0 {
			vitalItems = append(vitalItems, gin.H{"name": "Diastolic Blood Pressure", "value": physicalExam.Diastolic, "unit": "mmHg"})
		}
		if physicalExam.HeartRate != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Heart Rate", "value": physicalExam.HeartRate, "unit": "bpm"})
		}
		if physicalExam.RespiratoryRate != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Respiratory Rate", "value": physicalExam.RespiratoryRate, "unit": "/min"})
		}
		if physicalExam.Temperature != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Body Temperature", "value": physicalExam.Temperature, "unit": "°C"})
		}
		if physicalExam.OxygenSaturation != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Oxygen Saturation", "value": physicalExam.OxygenSaturation, "unit": "%"})
		}
		if physicalExam.Weight != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Body Weight", "value": physicalExam.Weight, "unit": "kg"})
		}
		if physicalExam.Height != "" {
			vitalItems = append(vitalItems, gin.H{"name": "Body Height", "value": physicalExam.Height, "unit": "cm"})
		}
	}

	// ========== PROCEDURES ==========
	var procedures []models.VisitProcedure
	database.DB.Where("visit_id = ?", visitID).Preload("Procedure").Find(&procedures)

	procedureItems := []gin.H{}
	procedureSentCount := 0
	for _, p := range procedures {
		code := ""
		name := ""
		if p.Procedure != nil {
			code = p.Procedure.Code
			name = p.Procedure.Name
		}
		isSent := p.SatusehatProcedureID != ""
		if isSent {
			procedureSentCount++
		}
		procedureItems = append(procedureItems, gin.H{
			"id":           p.ID,
			"code":         code,
			"name":         name,
			"status":       p.Status,
			"sent":         isSent,
			"procedure_id": p.SatusehatProcedureID,
		})
	}

	// ========== LAB/RADIOLOGY RESOURCES (ServiceRequest, Specimen, DiagnosticReport) ==========
	// Query from procedure_orders where source_visit_id = visitID
	var procedureOrderItems []models.ProcedureOrderItem
	database.DB.Preload("Procedure").Preload("ProcedureOrder").Preload("Results").
		Joins("JOIN procedure_orders ON procedure_orders.id = procedure_order_items.procedure_order_id").
		Where("procedure_orders.source_visit_id = ?", visitID).
		Where("procedure_orders.order_type IN ?", []string{"laboratory", "radiology"}).
		Find(&procedureOrderItems)

	labRadItems := []gin.H{}
	labRadSentCount := 0
	labRadTotal := 0
	for _, item := range procedureOrderItems {
		if item.Procedure == nil {
			continue
		}
		labRadTotal++

		// Check LOINC mapping
		var loincMapping models.ProcedureLoincMapping
		hasLoincMapping := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error == nil

		isLab := item.Procedure.ProcedureType == "laboratory"
		hasSpecimenMapping := hasLoincMapping && loincMapping.SnomedSpecimenCode != ""
		isCompleted := item.Status == models.ProcedureOrderStatusCompleted

		// Count as sent if DiagnosticReport is sent
		if item.SatusehatDiagnosticReportID != "" {
			labRadSentCount++
		}

		labRadItems = append(labRadItems, gin.H{
			"id":                        item.ID,
			"code":                      item.Procedure.Code,
			"name":                      item.Procedure.Name,
			"procedure_type":            item.Procedure.ProcedureType,
			"status":                    item.Status,
			"has_loinc_mapping":         hasLoincMapping,
			"loinc_code":                loincMapping.LoincCode,
			"loinc_display":             loincMapping.LoincDisplay,
			"has_specimen_mapping":      hasSpecimenMapping,
			"servicerequest_sent":       item.SatusehatServiceRequestID != "",
			"servicerequest_id":         item.SatusehatServiceRequestID,
			"specimen_sent":             item.SatusehatSpecimenID != "",
			"specimen_id":               item.SatusehatSpecimenID,
			"diagnosticreport_sent":     item.SatusehatDiagnosticReportID != "",
			"diagnosticreport_id":       item.SatusehatDiagnosticReportID,
			"can_send_servicerequest":   encounterSent && hasLoincMapping && item.SatusehatServiceRequestID == "",
			"can_send_specimen":         item.SatusehatServiceRequestID != "" && hasSpecimenMapping && isLab && item.SatusehatSpecimenID == "",
			"can_send_diagnosticreport": item.SatusehatServiceRequestID != "" && isCompleted && item.SatusehatDiagnosticReportID == "",
			"can_send_all":              encounterSent && hasLoincMapping && isCompleted && item.SatusehatDiagnosticReportID == "",
		})
	}

	// ========== MEDICATIONS ==========
	var medicationTotal, medicationSent int64
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ?", visitID).
		Count(&medicationTotal)
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.satusehat_medication_request_id != ''", visitID).
		Count(&medicationSent)

	// Load medication items detail
	var medications []models.MedicineOrderItem
	database.DB.Preload("Medicine").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ?", visitID).
		Find(&medications)

	medicationItems := []gin.H{}
	for _, med := range medications {
		medicineName := "Obat tidak ditemukan"
		if med.Medicine != nil {
			medicineName = med.Medicine.Name
		}

		medicationItems = append(medicationItems, gin.H{
			"id":            med.ID,
			"medicine_name": medicineName,
			"quantity":      med.Quantity,
			"unit":          med.Unit,
			"dosage":        med.Dosage,
			"sent":          med.SatusehatMedicationRequestID != "",
			"satusehat_id":  med.SatusehatMedicationRequestID,
			"status":        "ordered", // Tambahkan status agar frontend bisa deteksi sebagai item
		})
	}

	// ========== MEDICATION DISPENSES ==========
	var dispenseTotal, dispenseSent int64
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.dispensed_qty > 0", visitID).
		Count(&dispenseTotal)
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.dispensed_qty > 0 AND medicine_order_items.satusehat_medication_dispense_id != ''", visitID).
		Count(&dispenseSent)

	// Load dispensed medication items detail
	var dispensedMedications []models.MedicineOrderItem
	database.DB.Preload("Medicine").Preload("DispensedBy").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.dispensed_qty > 0", visitID).
		Find(&dispensedMedications)

	dispenseItems := []gin.H{}
	for _, med := range dispensedMedications {
		medicineName := "Obat tidak ditemukan"
		if med.Medicine != nil {
			medicineName = med.Medicine.Name
		}

		dispensedByName := ""
		if med.DispensedBy != nil {
			dispensedByName = med.DispensedBy.NamaLengkap
		}

		// MedicationDispense membutuhkan MedicationRequest sudah dikirim
		canSend := med.SatusehatMedicationRequestID != ""

		dispenseItems = append(dispenseItems, gin.H{
			"id":                    med.ID,
			"medicine_name":         medicineName,
			"dispensed_qty":         med.DispensedQty,
			"unit":                  med.Unit,
			"dosage":                med.Dosage,
			"sent":                  med.SatusehatMedicationDispenseID != "",
			"satusehat_id":          med.SatusehatMedicationDispenseID,
			"medication_request_id": med.SatusehatMedicationRequestID,
			"can_send":              canSend,
			"dispensed_by":          dispensedByName,
			"status":                "dispensed",
		})
	}

	// ========== QUESTIONNAIRE RESPONSE ==========
	var medicineOrders []models.MedicineOrder
	database.DB.Where("source_visit_id = ?", visitID).Preload("ReviewedBy").Find(&medicineOrders)

	qrItems := []gin.H{}
	var qrSentCount int64 = 0
	for _, order := range medicineOrders {
		reviewerName := ""
		if order.ReviewedBy != nil {
			reviewerName = order.ReviewedBy.NamaLengkap
		}
		isSent := order.SatusehatQuestionnaireResponseID != ""
		if isSent {
			qrSentCount++
		}
		// Check if any MedicationRequest has been sent
		var requestSentCount int64
		database.DB.Table("medicine_order_items").
			Where("medicine_order_id = ? AND satusehat_medication_request_id != ''", order.ID).
			Count(&requestSentCount)

		qrItems = append(qrItems, gin.H{
			"id":           order.ID,
			"order_number": order.OrderNumber,
			"reviewed_by":  reviewerName,
			"sent":         isSent,
			"satusehat_id": order.SatusehatQuestionnaireResponseID,
			"can_send":     requestSentCount > 0 && !isSent,
			"status":       order.Status,
		})
	}

	// ========== MEDICATION ADMINISTRATION ==========
	var adminTotal, adminSent int64
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.dispensed_qty > 0", visitID).
		Count(&adminTotal)
	database.DB.Table("medicine_order_items").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_order_items.satusehat_medication_administration_id != ''", visitID).
		Count(&adminSent)

	adminItems := []gin.H{}
	for _, med := range dispensedMedications {
		medicineName := "Obat tidak ditemukan"
		if med.Medicine != nil {
			medicineName = med.Medicine.Name
		}

		// MedicationAdministration membutuhkan MedicationRequest sudah dikirim
		canSend := med.SatusehatMedicationRequestID != ""

		adminItems = append(adminItems, gin.H{
			"id":                    med.ID,
			"medicine_name":         medicineName,
			"dispensed_qty":         med.DispensedQty,
			"unit":                  med.Unit,
			"sent":                  med.SatusehatMedicationAdministrationID != "",
			"satusehat_id":          med.SatusehatMedicationAdministrationID,
			"medication_request_id": med.SatusehatMedicationRequestID,
			"can_send":              canSend,
			"status":                "administered",
		})
	}

	// ========== SUMMARY ==========
	allDiagnosisSent := diagnosisSentCount == len(diagnoses) && len(diagnoses) > 0

	// ========== COMPOSITION (Resume Medis) ==========
	compositionSent := visit.SatuSehatCompositionID != ""
	// Composition can be sent when encounter and at least one diagnosis are sent
	compositionCanSend := encounterSent && diagnosisSentCount > 0 && !compositionSent
	compositionItems := []gin.H{
		{
			"id":           visit.ID,
			"name":         "Resume Medis",
			"sent":         compositionSent,
			"can_send":     compositionCanSend,
			"satusehat_id": visit.SatuSehatCompositionID,
		},
	}

	// ========== CLINICAL IMPRESSION ==========
	var diagSummary models.DiagnosisSummary
	database.DB.Where("visit_id = ?", visitID).First(&diagSummary)

	var assessmentPlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).First(&assessmentPlan)

	var triage models.Triage
	database.DB.Where("visit_id = ?", visitID).First(&triage)

	clinicalImpressionItems := []gin.H{}
	ciSentCount := 0
	ciTotalAvailable := 0

	// 1. Riwayat Perjalanan Penyakit
	historyDataExists := diagSummary.ClinicalImpression != ""
	historySent := diagSummary.SatusehatClinicalImpressionHistoryID != ""
	if historyDataExists {
		ciTotalAvailable++
		if historySent {
			ciSentCount++
		}
		clinicalImpressionItems = append(clinicalImpressionItems, gin.H{
			"id":           diagSummary.ID,
			"type":         "history",
			"type_display": "Riwayat Perjalanan Penyakit",
			"data_field":   "diagnosis_summary.clinical_impression",
			"data_exists":  historyDataExists,
			"sent":         historySent,
			"satusehat_id": diagSummary.SatusehatClinicalImpressionHistoryID,
			"can_send":     encounterSent && !historySent && historyDataExists,
		})
	}

	// 2. Rasional Klinis
	rationaleDataExists := assessmentPlan.ClinicalAssessment != ""
	rationaleSent := assessmentPlan.SatusehatClinicalImpressionRationaleID != ""
	if rationaleDataExists {
		ciTotalAvailable++
		if rationaleSent {
			ciSentCount++
		}
		clinicalImpressionItems = append(clinicalImpressionItems, gin.H{
			"id":           assessmentPlan.ID,
			"type":         "rationale",
			"type_display": "Rasional Klinis",
			"data_field":   "assessment_plan.clinical_assessment",
			"data_exists":  rationaleDataExists,
			"sent":         rationaleSent,
			"satusehat_id": assessmentPlan.SatusehatClinicalImpressionRationaleID,
			"can_send":     encounterSent && !rationaleSent && rationaleDataExists,
		})
	}

	// 3. Prognosis
	prognosisDataExists := assessmentPlan.Prognosis != ""
	prognosisSent := assessmentPlan.SatusehatClinicalImpressionPrognosisID != ""
	if prognosisDataExists {
		ciTotalAvailable++
		if prognosisSent {
			ciSentCount++
		}
		clinicalImpressionItems = append(clinicalImpressionItems, gin.H{
			"id":           assessmentPlan.ID,
			"type":         "prognosis",
			"type_display": "Prognosis",
			"data_field":   "assessment_plan.prognosis",
			"data_exists":  prognosisDataExists,
			"sent":         prognosisSent,
			"satusehat_id": assessmentPlan.SatusehatClinicalImpressionPrognosisID,
			"can_send":     encounterSent && !prognosisSent && prognosisDataExists,
		})
	}

	// 4. Asesmen Triage (IGD only)
	triageDataExists := triage.TriageAssessment != ""
	triageSent := triage.SatusehatClinicalImpressionTriageID != ""
	if triage.ID > 0 && triageDataExists {
		ciTotalAvailable++
		if triageSent {
			ciSentCount++
		}
		clinicalImpressionItems = append(clinicalImpressionItems, gin.H{
			"id":           triage.ID,
			"type":         "triage",
			"type_display": "Asesmen Triage (IGD)",
			"data_field":   "triage.triage_assessment",
			"data_exists":  triageDataExists,
			"sent":         triageSent,
			"satusehat_id": triage.SatusehatClinicalImpressionTriageID,
			"can_send":     encounterSent && !triageSent && triageDataExists,
		})
	}

	// ========== ALLERGY INTOLERANCE ==========
	var allergies []models.PatientAllergy
	database.DB.Where("patient_id = ? AND is_active = ?", patient.ID, true).Find(&allergies)

	// Get patient IHS status early for allergy can_send check
	patientIHS := patient.SatuSehatID != ""

	allergyItems := []gin.H{}
	allergySentCount := 0
	for _, allergy := range allergies {
		isSent := allergy.SatuSehatID != ""
		if isSent {
			allergySentCount++
		}
		allergyItems = append(allergyItems, gin.H{
			"id":             allergy.ID,
			"snomed_code":    allergy.SnomedCode,
			"snomed_display": allergy.SnomedDisplay,
			"category":       allergy.Category,
			"criticality":    allergy.Criticality,
			"sent":           isSent,
			"satusehat_id":   allergy.SatuSehatID,
			"can_send":       encounterSent && patientIHS && !isSent,
		})
	}

	// ========== MEDICATION STATEMENT (Riwayat Obat) ==========
	var anamnesis models.Anamnesis
	database.DB.Where("visit_id = ?", visitID).First(&anamnesis)

	medicationStatementItems := []gin.H{}
	medicationStatementSentCount := 0
	medicationStatementTotal := 0
	if anamnesis.ID > 0 && anamnesis.CurrentMedications != "" {
		medicationStatementTotal = 1
		isSent := anamnesis.SatusehatMedicationStatementID != ""
		if isSent {
			medicationStatementSentCount = 1
		}
		medicationStatementItems = append(medicationStatementItems, gin.H{
			"id":             anamnesis.ID,
			"source":         "anamnesis",
			"source_display": "Anamnesis",
			"description":    anamnesis.CurrentMedications,
			"sent":           isSent,
			"satusehat_id":   anamnesis.SatusehatMedicationStatementID,
			"can_send":       encounterSent && patientIHS && !isSent,
			"data_field":     "anamnesis.current_medications",
		})
	}

	// ========== CAREPLAN ==========
	// CarePlan from CPPT (Plan/Instruction)
	var cppts []models.CPPT
	database.DB.Where("visit_id = ?", visitID).
		Where("plan != '' OR instruction != ''").
		Preload("CreatedBy").
		Order("record_date DESC").
		Find(&cppts)

	// CarePlan from Disposition (RTL/Discharge Plan)
	var disposition models.Disposition
	database.DB.Where("visit_id = ?", visitID).First(&disposition)

	// CarePlan from AssessmentPlan (Rencana Pengobatan - untuk Rawat Jalan/IGD)
	var assessmentPlanForCarePlan models.AssessmentPlan
	database.DB.Where("visit_id = ?", visitID).First(&assessmentPlanForCarePlan)

	carePlanItems := []gin.H{}
	carePlanSentCount := 0
	carePlanTotal := 0

	// Add AssessmentPlan item (for outpatient/emergency)
	if assessmentPlanForCarePlan.ID > 0 {
		hasAnyPlan := assessmentPlanForCarePlan.TreatmentPlan != "" ||
			assessmentPlanForCarePlan.MedicationPlan != "" ||
			assessmentPlanForCarePlan.ProcedurePlan != "" ||
			assessmentPlanForCarePlan.DietPlan != "" ||
			assessmentPlanForCarePlan.ActivityPlan != "" ||
			assessmentPlanForCarePlan.EducationPlan != "" ||
			assessmentPlanForCarePlan.MonitoringPlan != "" ||
			assessmentPlanForCarePlan.ConsultationPlan != ""

		if hasAnyPlan {
			carePlanTotal++
			isSent := assessmentPlanForCarePlan.SatusehatCarePlanID != ""
			if isSent {
				carePlanSentCount++
			}

			// Build plan summary
			planSummary := ""
			if assessmentPlanForCarePlan.TreatmentPlan != "" {
				planSummary = assessmentPlanForCarePlan.TreatmentPlan
			} else if assessmentPlanForCarePlan.MedicationPlan != "" {
				planSummary = assessmentPlanForCarePlan.MedicationPlan
			} else if assessmentPlanForCarePlan.ProcedurePlan != "" {
				planSummary = assessmentPlanForCarePlan.ProcedurePlan
			}

			carePlanItems = append(carePlanItems, gin.H{
				"id":             assessmentPlanForCarePlan.ID,
				"source":         "assessment",
				"source_display": "Rencana Pengobatan",
				"plan":           planSummary,
				"sent":           isSent,
				"satusehat_id":   assessmentPlanForCarePlan.SatusehatCarePlanID,
				"can_send":       encounterSent && patientIHS && !isSent,
			})
		}
	}

	// Add CPPT items
	for _, cppt := range cppts {
		carePlanTotal++
		isSent := cppt.SatusehatCarePlanID != ""
		if isSent {
			carePlanSentCount++
		}
		createdByName := ""
		if cppt.CreatedBy != nil {
			createdByName = cppt.CreatedBy.Username // Use Username from User model
		}
		planText := cppt.Plan
		if cppt.Instruction != "" {
			if planText != "" {
				planText += " | " + cppt.Instruction
			} else {
				planText = cppt.Instruction
			}
		}
		carePlanItems = append(carePlanItems, gin.H{
			"id":             cppt.ID,
			"source":         "cppt",
			"source_display": "CPPT",
			"record_date":    cppt.RecordDate,
			"profession":     cppt.Profession,
			"plan":           planText,
			"created_by":     createdByName,
			"sent":           isSent,
			"satusehat_id":   cppt.SatusehatCarePlanID,
			"can_send":       encounterSent && patientIHS && !isSent,
		})
	}

	// Add Disposition item (if has follow-up/discharge instruction)
	if disposition.ID > 0 && (disposition.DischargeInstruction != "" || disposition.FollowUpInstruction != "") {
		carePlanTotal++
		isSent := disposition.SatusehatCarePlanID != ""
		if isSent {
			carePlanSentCount++
		}
		instructionText := ""
		if disposition.DischargeInstruction != "" {
			instructionText = disposition.DischargeInstruction
		}
		if disposition.FollowUpInstruction != "" {
			if instructionText != "" {
				instructionText += " | " + disposition.FollowUpInstruction
			} else {
				instructionText = disposition.FollowUpInstruction
			}
		}
		carePlanItems = append(carePlanItems, gin.H{
			"id":                  disposition.ID,
			"source":              "disposition",
			"source_display":      "RTL/Discharge",
			"disposition_type":    disposition.DispositionType,
			"discharge_condition": disposition.DischargeCondition,
			"instruction":         instructionText,
			"follow_up_date":      disposition.FollowUpDate,
			"sent":                isSent,
			"satusehat_id":        disposition.SatusehatCarePlanID,
			"can_send":            encounterSent && patientIHS && !isSent,
		})
	}

	sentRequired := 0
	if encounterSent {
		sentRequired++
	}
	if allDiagnosisSent {
		sentRequired++
	}
	if compositionSent {
		sentRequired++
	}
	completionPercentage := 0
	if sentRequired > 0 {
		completionPercentage = (sentRequired * 100) / 3
	}

	satusehatStatus := "Belum Dikirim"
	if encounterSent {
		if completionPercentage == 100 {
			satusehatStatus = "Lengkap"
		} else {
			satusehatStatus = "Sebagian"
		}
	}

	practitionerIHS := visit.Doctor != nil && visit.Doctor.SatuSehatID != ""
	locationID := visit.Room != nil && visit.Room.SatuSehatID != ""

	c.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"visit_id":              visit.ID,
			"visit_number":          visit.VisitNumber,
			"patient_name":          patient.NamaLengkap,
			"status":                satusehatStatus,
			"completion_percentage": completionPercentage,
			"required_resources":    3,
			"sent_required":         sentRequired,
			"ready_to_send":         patientIHS && practitionerIHS && locationID && hasPrimary,
		},
		"resources": []gin.H{
			{"resource": "Encounter", "required": true, "sent": encounterSent, "satusehat_id": visit.SatuSehatEncounterID},
			{"resource": "Condition", "required": true, "total": len(diagnoses), "sent_count": diagnosisSentCount, "all_sent": allDiagnosisSent, "items": diagnosisItems},
			{"resource": "Observation", "category": "vital-signs", "required": false, "available": len(vitalItems) > 0, "sent": physicalExam.SatusehatVitalSignsSent, "items": vitalItems},
			{"resource": "Procedure", "required": false, "total": len(procedures), "sent_count": procedureSentCount, "all_sent": procedureSentCount == len(procedures) && len(procedures) > 0, "items": procedureItems},
			{"resource": "Lab/Radiology", "required": false, "description": "Permintaan Lab/Radiologi", "total": labRadTotal, "sent_count": labRadSentCount, "all_sent": labRadSentCount == labRadTotal && labRadTotal > 0, "items": labRadItems, "prerequisites": []string{"Encounter", "LOINC Mapping"}},
			{"resource": "AllergyIntolerance", "required": false, "description": "Riwayat Alergi Pasien (data level pasien, bukan per kunjungan)", "total": len(allergies), "sent_count": allergySentCount, "all_sent": allergySentCount == len(allergies) && len(allergies) > 0, "items": allergyItems, "prerequisites": []string{"Encounter"}},
			{"resource": "MedicationStatement", "required": false, "description": "Riwayat Obat yang Dikonsumsi", "total": medicationStatementTotal, "sent_count": medicationStatementSentCount, "all_sent": medicationStatementSentCount == medicationStatementTotal && medicationStatementTotal > 0, "items": medicationStatementItems, "prerequisites": []string{"Encounter"}},
			{"resource": "MedicationRequest", "required": false, "description": "Peresepan Obat", "total": medicationTotal, "sent_count": medicationSent, "all_sent": medicationSent == medicationTotal && medicationTotal > 0, "items": medicationItems},
			{"resource": "QuestionnaireResponse", "required": false, "description": "Pengkajian Resep", "total": int64(len(medicineOrders)), "sent_count": qrSentCount, "all_sent": qrSentCount == int64(len(medicineOrders)) && len(medicineOrders) > 0, "items": qrItems, "prerequisites": []string{"MedicationRequest"}},
			{"resource": "MedicationDispense", "required": false, "description": "Pengeluaran Obat", "total": dispenseTotal, "sent_count": dispenseSent, "all_sent": dispenseSent == dispenseTotal && dispenseTotal > 0, "items": dispenseItems, "prerequisites": []string{"MedicationRequest", "QuestionnaireResponse"}},
			{"resource": "MedicationAdministration", "required": false, "description": "Pemberian Obat", "total": adminTotal, "sent_count": adminSent, "all_sent": adminSent == adminTotal && adminTotal > 0, "items": adminItems, "prerequisites": []string{"MedicationDispense"}},
			{"resource": "ClinicalImpression", "required": false, "description": "Penilaian Klinis", "total": ciTotalAvailable, "sent_count": ciSentCount, "all_sent": ciSentCount == ciTotalAvailable && ciTotalAvailable > 0, "items": clinicalImpressionItems, "prerequisites": []string{"Encounter"}, "note": "Terdiri dari: Riwayat Perjalanan Penyakit, Rasional Klinis, Prognosis, dan Asesmen Triage (IGD)"},
			{"resource": "CarePlan", "required": false, "description": "Rencana Perawatan/Tindak Lanjut", "total": carePlanTotal, "sent_count": carePlanSentCount, "all_sent": carePlanSentCount == carePlanTotal && carePlanTotal > 0, "items": carePlanItems, "prerequisites": []string{"Encounter"}, "note": "Dari CPPT (Plan/Instruction) dan Disposition (RTL/Discharge)"},
			{"resource": "Composition", "required": true, "description": "Resume Medis", "sent": compositionSent, "items": compositionItems, "prerequisites": []string{"Encounter", "Condition"}},
		},
		"prerequisites": gin.H{
			"patient_ihs":      patientIHS,
			"practitioner_ihs": practitionerIHS,
			"location_id":      locationID,
			"has_diagnosis":    hasPrimary,
		},
	})
}
