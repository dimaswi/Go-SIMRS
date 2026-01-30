package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// FHIR MedicationStatement and CarePlan Resources
// ============================================================================

// ============================================================================
// FHIR MedicationStatement Structures
// ============================================================================

// FHIRMedicationStatement represents FHIR MedicationStatement resource
type FHIRMedicationStatement struct {
	ResourceType        string                `json:"resourceType"`
	Identifier          []FHIRIdentifier      `json:"identifier,omitempty"`
	Status              string                `json:"status"` // active, completed, entered-in-error, intended, stopped, on-hold, unknown, not-taken
	Category            *FHIRCodeableConcept  `json:"category,omitempty"`
	MedicationReference *FHIRReference        `json:"medicationReference,omitempty"`
	MedicationCode      *FHIRCodeableConcept  `json:"medicationCodeableConcept,omitempty"`
	Subject             *FHIRReference        `json:"subject"`
	Context             *FHIRReference        `json:"context,omitempty"` // Encounter
	EffectiveDateTime   string                `json:"effectiveDateTime,omitempty"`
	EffectivePeriod     *FHIRPeriod           `json:"effectivePeriod,omitempty"`
	DateAsserted        string                `json:"dateAsserted,omitempty"`
	InformationSource   *FHIRReference        `json:"informationSource,omitempty"`
	ReasonCode          []FHIRCodeableConcept `json:"reasonCode,omitempty"`
	Note                []FHIRAnnotation      `json:"note,omitempty"`
	Dosage              []FHIRDosage          `json:"dosage,omitempty"`
	Contained           []interface{}         `json:"contained,omitempty"`
}

// Note: FHIRAnnotation is already defined in satusehat_fhir.go

// FHIRDosage represents FHIR Dosage
type FHIRDosage struct {
	Sequence         int                  `json:"sequence,omitempty"`
	Text             string               `json:"text,omitempty"`
	Timing           *FHIRTiming          `json:"timing,omitempty"`
	Route            *FHIRCodeableConcept `json:"route,omitempty"`
	DoseAndRate      []FHIRDoseAndRate    `json:"doseAndRate,omitempty"`
	MaxDosePerPeriod *FHIRRatio           `json:"maxDosePerPeriod,omitempty"`
}

// FHIRTiming represents FHIR Timing
type FHIRTiming struct {
	Repeat *FHIRTimingRepeat    `json:"repeat,omitempty"`
	Code   *FHIRCodeableConcept `json:"code,omitempty"`
}

// FHIRTimingRepeat represents FHIR Timing.repeat
type FHIRTimingRepeat struct {
	Frequency  int      `json:"frequency,omitempty"`
	Period     float64  `json:"period,omitempty"`
	PeriodUnit string   `json:"periodUnit,omitempty"` // s, min, h, d, wk, mo, a
	When       []string `json:"when,omitempty"`       // MORN, AFT, EVE, NIGHT, AC, PC, etc
}

// FHIRDoseAndRate represents FHIR Dosage.doseAndRate
type FHIRDoseAndRate struct {
	Type         *FHIRCodeableConcept `json:"type,omitempty"`
	DoseQuantity *FHIRQuantity        `json:"doseQuantity,omitempty"`
	DoseRange    *FHIRRange           `json:"doseRange,omitempty"`
	RateQuantity *FHIRQuantity        `json:"rateQuantity,omitempty"`
	RateRange    *FHIRRange           `json:"rateRange,omitempty"`
}

// FHIRRatio represents FHIR Ratio
type FHIRRatio struct {
	Numerator   *FHIRQuantity `json:"numerator,omitempty"`
	Denominator *FHIRQuantity `json:"denominator,omitempty"`
}

// FHIRRange represents FHIR Range
type FHIRRange struct {
	Low  *FHIRQuantity `json:"low,omitempty"`
	High *FHIRQuantity `json:"high,omitempty"`
}

// ============================================================================
// FHIR CarePlan Structures
// ============================================================================

// FHIRCarePlan represents FHIR CarePlan resource
type FHIRCarePlan struct {
	ResourceType   string                 `json:"resourceType"`
	Identifier     []FHIRIdentifier       `json:"identifier,omitempty"`
	Status         string                 `json:"status"` // draft, active, on-hold, revoked, completed, entered-in-error, unknown
	Intent         string                 `json:"intent"` // proposal, plan, order, option
	Category       []FHIRCodeableConcept  `json:"category,omitempty"`
	Title          string                 `json:"title,omitempty"`
	Description    string                 `json:"description,omitempty"`
	Subject        *FHIRReference         `json:"subject"`
	Encounter      *FHIRReference         `json:"encounter,omitempty"`
	Period         *FHIRPeriod            `json:"period,omitempty"`
	Created        string                 `json:"created,omitempty"`
	Author         *FHIRReference         `json:"author,omitempty"`
	Contributor    []FHIRReference        `json:"contributor,omitempty"`
	CareTeam       []FHIRReference        `json:"careTeam,omitempty"`
	Addresses      []FHIRReference        `json:"addresses,omitempty"` // Conditions addressed
	SupportingInfo []FHIRReference        `json:"supportingInfo,omitempty"`
	Goal           []FHIRReference        `json:"goal,omitempty"`
	Activity       []FHIRCarePlanActivity `json:"activity,omitempty"`
	Note           []FHIRAnnotation       `json:"note,omitempty"`
}

// FHIRCarePlanActivity represents CarePlan.activity
type FHIRCarePlanActivity struct {
	OutcomeCodeableConcept []FHIRCodeableConcept `json:"outcomeCodeableConcept,omitempty"`
	OutcomeReference       []FHIRReference       `json:"outcomeReference,omitempty"`
	Progress               []FHIRAnnotation      `json:"progress,omitempty"`
	Reference              *FHIRReference        `json:"reference,omitempty"`
	Detail                 *FHIRCarePlanDetail   `json:"detail,omitempty"`
}

// FHIRCarePlanDetail represents CarePlan.activity.detail
type FHIRCarePlanDetail struct {
	Kind                   string                `json:"kind,omitempty"` // Appointment, CommunicationRequest, DeviceRequest, MedicationRequest, NutritionOrder, Task, ServiceRequest, VisionPrescription
	InstantiatesCanonical  []string              `json:"instantiatesCanonical,omitempty"`
	Code                   *FHIRCodeableConcept  `json:"code,omitempty"`
	ReasonCode             []FHIRCodeableConcept `json:"reasonCode,omitempty"`
	ReasonReference        []FHIRReference       `json:"reasonReference,omitempty"`
	Goal                   []FHIRReference       `json:"goal,omitempty"`
	Status                 string                `json:"status"` // not-started, scheduled, in-progress, on-hold, completed, cancelled, stopped, unknown, entered-in-error
	StatusReason           *FHIRCodeableConcept  `json:"statusReason,omitempty"`
	DoNotPerform           bool                  `json:"doNotPerform,omitempty"`
	ScheduledTiming        *FHIRTiming           `json:"scheduledTiming,omitempty"`
	ScheduledPeriod        *FHIRPeriod           `json:"scheduledPeriod,omitempty"`
	ScheduledString        string                `json:"scheduledString,omitempty"`
	Location               *FHIRReference        `json:"location,omitempty"`
	Performer              []FHIRReference       `json:"performer,omitempty"`
	ProductCodeableConcept *FHIRCodeableConcept  `json:"productCodeableConcept,omitempty"`
	ProductReference       *FHIRReference        `json:"productReference,omitempty"`
	DailyAmount            *FHIRQuantity         `json:"dailyAmount,omitempty"`
	Quantity               *FHIRQuantity         `json:"quantity,omitempty"`
	Description            string                `json:"description,omitempty"`
}

// ============================================================================
// Build Functions
// ============================================================================

// BuildMedicationStatementFromAnamnesis creates FHIR MedicationStatement from Anamnesis.CurrentMedications
func BuildMedicationStatementFromAnamnesis(
	anamnesis *models.Anamnesis,
	visit *models.Visit,
	patient *models.Patient,
	orgID string,
) (*FHIRMedicationStatement, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}
	if anamnesis.CurrentMedications == "" {
		return nil, fmt.Errorf("tidak ada riwayat obat yang dicatat")
	}

	// Format datetime with timezone
	effectiveDateTime := anamnesis.CreatedAt.Format("2006-01-02T15:04:05+07:00")
	dateAsserted := time.Now().Format("2006-01-02T15:04:05+07:00")

	medStatement := &FHIRMedicationStatement{
		ResourceType: "MedicationStatement",
		Status:       "active",
		Category: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/medication-statement-category",
					Code:    "community",
					Display: "Community",
				},
			},
		},
		// For medications from outside (non-KFA), use text only in medicationCodeableConcept
		MedicationCode: &FHIRCodeableConcept{
			Text: anamnesis.CurrentMedications,
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Context: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		EffectiveDateTime: effectiveDateTime,
		DateAsserted:      dateAsserted,
		InformationSource: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Dosage: []FHIRDosage{
			{
				Text: "Riwayat pengobatan: " + anamnesis.CurrentMedications,
			},
		},
	}

	return medStatement, nil
}

// CarePlan category codes from SatuSehat
const (
	CarePlanCategoryEmergency  = "TK000068" // Emergency care plan
	CarePlanCategoryOutpatient = "TK000003" // Outpatient care plan
	CarePlanCategoryInpatient  = "TK000060" // Inpatient care plan
	CarePlanCategoryDischarge  = "TK000050" // Discharge planning
)

// BuildCarePlanFromCPPT creates FHIR CarePlan from CPPT (Plan + Instruction)
func BuildCarePlanFromCPPT(
	cppt *models.CPPT,
	visit *models.Visit,
	patient *models.Patient,
	author *models.Employee,
	orgID string,
) (*FHIRCarePlan, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}
	if cppt.Plan == "" && cppt.Instruction == "" {
		return nil, fmt.Errorf("tidak ada rencana atau instruksi yang dicatat")
	}

	// Determine category based on visit type
	categoryCode := CarePlanCategoryInpatient
	categoryDisplay := "Inpatient care plan"
	if visit.VisitType == models.VisitTypeConsultation {
		categoryCode = CarePlanCategoryOutpatient
		categoryDisplay = "Outpatient care plan"
	} else if visit.VisitType == "emergency" {
		categoryCode = CarePlanCategoryEmergency
		categoryDisplay = "Emergency care plan"
	}

	// Build description from Plan and Instruction
	description := ""
	if cppt.Plan != "" {
		description = cppt.Plan
	}
	if cppt.Instruction != "" {
		if description != "" {
			description += " | Instruksi: " + cppt.Instruction
		} else {
			description = cppt.Instruction
		}
	}

	// Determine title based on profession
	title := "Rencana Perawatan"
	if cppt.Profession == models.CPPTProfessionDoctor {
		title = "Instruksi Medik"
	} else if cppt.Profession == models.CPPTProfessionNurse {
		title = "Instruksi Keperawatan"
	}

	// Format created datetime with timezone
	created := cppt.RecordDate.Format("2006-01-02T15:04:05+07:00")

	carePlan := &FHIRCarePlan{
		ResourceType: "CarePlan",
		Title:        title,
		Status:       "active",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.kemkes.go.id",
						Code:    categoryCode,
						Display: categoryDisplay,
					},
				},
			},
		},
		Intent:      "plan",
		Description: description,
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		Created: created,
	}

	if author != nil && author.SatuSehatID != "" {
		carePlan.Author = &FHIRReference{
			Reference: "Practitioner/" + author.SatuSehatID,
			Display:   author.NamaLengkap,
		}
	}

	return carePlan, nil
}

// BuildCarePlanFromDisposition creates FHIR CarePlan from Disposition (Follow-up plan)
func BuildCarePlanFromDisposition(
	disposition *models.Disposition,
	visit *models.Visit,
	patient *models.Patient,
	author *models.Employee,
	orgID string,
) (*FHIRCarePlan, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}

	// Build description from disposition
	description := ""
	if disposition.DischargeInstruction != "" {
		description = "Instruksi Pulang: " + disposition.DischargeInstruction
	}
	if disposition.FollowUpInstruction != "" {
		if description != "" {
			description += " | "
		}
		description += "Rencana Kontrol: " + disposition.FollowUpInstruction
	}
	if disposition.FollowUpDate != nil {
		if description != "" {
			description += " | "
		}
		description += "Tanggal Kontrol: " + disposition.FollowUpDate.Format("02-01-2006")
	}

	if description == "" {
		return nil, fmt.Errorf("tidak ada rencana tindak lanjut yang dicatat")
	}

	// Format created datetime with timezone
	created := disposition.CreatedAt.Format("2006-01-02T15:04:05+07:00")

	carePlan := &FHIRCarePlan{
		ResourceType: "CarePlan",
		Title:        "Perencanaan Pemulangan Pasien",
		Status:       "active",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://snomed.info/sct",
						Code:    "736372004",
						Display: "Discharge care plan",
					},
				},
			},
		},
		Intent:      "plan",
		Description: description,
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		Created: created,
	}

	if author != nil && author.SatuSehatID != "" {
		carePlan.Author = &FHIRReference{
			Reference: "Practitioner/" + author.SatuSehatID,
			Display:   author.NamaLengkap,
		}
	}

	return carePlan, nil
}

// BuildCarePlanFromAssessmentPlan creates FHIR CarePlan from AssessmentPlan (for Outpatient/Emergency)
func BuildCarePlanFromAssessmentPlan(
	assessmentPlan *models.AssessmentPlan,
	visit *models.Visit,
	patient *models.Patient,
	author *models.Employee,
	orgID string,
) (*FHIRCarePlan, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}

	// Build description from all plan fields
	var planParts []string
	if assessmentPlan.TreatmentPlan != "" {
		planParts = append(planParts, "Rencana Terapi: "+assessmentPlan.TreatmentPlan)
	}
	if assessmentPlan.MedicationPlan != "" {
		planParts = append(planParts, "Rencana Obat: "+assessmentPlan.MedicationPlan)
	}
	if assessmentPlan.ProcedurePlan != "" {
		planParts = append(planParts, "Rencana Tindakan: "+assessmentPlan.ProcedurePlan)
	}
	if assessmentPlan.DietPlan != "" {
		planParts = append(planParts, "Rencana Diet: "+assessmentPlan.DietPlan)
	}
	if assessmentPlan.ActivityPlan != "" {
		planParts = append(planParts, "Rencana Aktivitas: "+assessmentPlan.ActivityPlan)
	}
	if assessmentPlan.EducationPlan != "" {
		planParts = append(planParts, "Edukasi: "+assessmentPlan.EducationPlan)
	}
	if assessmentPlan.MonitoringPlan != "" {
		planParts = append(planParts, "Monitoring: "+assessmentPlan.MonitoringPlan)
	}
	if assessmentPlan.ConsultationPlan != "" {
		planParts = append(planParts, "Konsultasi: "+assessmentPlan.ConsultationPlan)
	}

	if len(planParts) == 0 {
		return nil, fmt.Errorf("tidak ada rencana pengobatan yang dicatat")
	}

	description := ""
	for i, part := range planParts {
		if i > 0 {
			description += " | "
		}
		description += part
	}

	// Determine category based on visit type
	categoryCode := CarePlanCategoryOutpatient
	categoryDisplay := "Outpatient care plan"
	if visit.VisitType == "emergency" || visit.VisitType == "igd" {
		categoryCode = CarePlanCategoryEmergency
		categoryDisplay = "Emergency care plan"
	} else if visit.VisitType == models.VisitTypeInpatient {
		categoryCode = CarePlanCategoryInpatient
		categoryDisplay = "Inpatient care plan"
	}

	// Format created datetime with timezone
	created := assessmentPlan.CreatedAt.Format("2006-01-02T15:04:05+07:00")

	carePlan := &FHIRCarePlan{
		ResourceType: "CarePlan",
		Title:        "Rencana Pengobatan",
		Status:       "active",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.kemkes.go.id",
						Code:    categoryCode,
						Display: categoryDisplay,
					},
				},
			},
		},
		Intent:      "plan",
		Description: description,
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		Created: created,
	}

	if author != nil && author.SatuSehatID != "" {
		carePlan.Author = &FHIRReference{
			Reference: "Practitioner/" + author.SatuSehatID,
			Display:   author.NamaLengkap,
		}
	}

	return carePlan, nil
}

// ============================================================================
// API Handlers - MedicationStatement
// ============================================================================

// SendMedicationStatementFromAnamnesis sends medication history as FHIR MedicationStatement
// POST /api/v1/satusehat/fhir/medicationstatement/:anamnesisId/send
func SendMedicationStatementFromAnamnesis(c *gin.Context) {
	anamnesisID, err := strconv.ParseUint(c.Param("anamnesisId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID anamnesis tidak valid"})
		return
	}

	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil pengaturan SatuSehat: " + err.Error()})
		return
	}
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Load anamnesis with relations
	var anamnesis models.Anamnesis
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		First(&anamnesis, anamnesisID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Anamnesis tidak ditemukan"})
		return
	}

	if anamnesis.CurrentMedications == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada riwayat obat yang dicatat pada anamnesis ini"})
		return
	}

	visit := anamnesis.Visit
	patient := visit.Registration.Patient

	medStatement, err := BuildMedicationStatementFromAnamnesis(&anamnesis, visit, patient, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/MedicationStatement", medStatement)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	var responseData map[string]interface{}
	json.Unmarshal(responseBody, &responseData)

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{"error": "SatuSehat menolak request", "response": responseData})
		return
	}

	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Save to database
	if satusehatID != "" {
		now := time.Now()
		database.DB.Model(&anamnesis).Updates(map[string]interface{}{
			"satusehat_medication_statement_id": satusehatID,
			"satusehat_medication_statement_at": &now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "MedicationStatement berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// ============================================================================
// API Handlers - CarePlan
// ============================================================================

// SendCarePlanFromCPPT sends care plan from CPPT as FHIR CarePlan
// POST /api/v1/satusehat/fhir/careplan/cppt/:cpptId/send
func SendCarePlanFromCPPT(c *gin.Context) {
	cpptID, err := strconv.ParseUint(c.Param("cpptId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID CPPT tidak valid"})
		return
	}

	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil pengaturan SatuSehat: " + err.Error()})
		return
	}
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Load CPPT with relations
	var cppt models.CPPT
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("CreatedBy").
		Preload("CreatedBy.Employee").
		First(&cppt, cpptID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CPPT tidak ditemukan"})
		return
	}

	if cppt.Plan == "" && cppt.Instruction == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada rencana atau instruksi pada CPPT ini"})
		return
	}

	visit := cppt.Visit
	patient := visit.Registration.Patient

	var author *models.Employee
	if cppt.CreatedBy != nil && cppt.CreatedBy.Employee != nil {
		author = cppt.CreatedBy.Employee
	}

	carePlan, err := BuildCarePlanFromCPPT(&cppt, visit, patient, author, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/CarePlan", carePlan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	var responseData map[string]interface{}
	json.Unmarshal(responseBody, &responseData)

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{"error": "SatuSehat menolak request", "response": responseData})
		return
	}

	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Save to database
	if satusehatID != "" {
		now := time.Now()
		database.DB.Model(&cppt).Updates(map[string]interface{}{
			"satusehat_careplan_id": satusehatID,
			"satusehat_careplan_at": &now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "CarePlan (CPPT) berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// SendCarePlanFromDisposition sends follow-up plan from Disposition as FHIR CarePlan
// POST /api/v1/satusehat/fhir/careplan/disposition/:dispositionId/send
func SendCarePlanFromDisposition(c *gin.Context) {
	dispositionID, err := strconv.ParseUint(c.Param("dispositionId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID disposition tidak valid"})
		return
	}

	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil pengaturan SatuSehat: " + err.Error()})
		return
	}
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Load disposition with relations
	var disposition models.Disposition
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("DischargedBy").
		Preload("DischargedBy.Employee").
		First(&disposition, dispositionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Disposition tidak ditemukan"})
		return
	}

	visit := disposition.Visit
	patient := visit.Registration.Patient

	var author *models.Employee
	if disposition.DischargedBy != nil && disposition.DischargedBy.Employee != nil {
		author = disposition.DischargedBy.Employee
	}

	carePlan, err := BuildCarePlanFromDisposition(&disposition, visit, patient, author, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/CarePlan", carePlan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	var responseData map[string]interface{}
	json.Unmarshal(responseBody, &responseData)

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{"error": "SatuSehat menolak request", "response": responseData})
		return
	}

	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Save to database
	if satusehatID != "" {
		now := time.Now()
		database.DB.Model(&disposition).Updates(map[string]interface{}{
			"satusehat_careplan_id": satusehatID,
			"satusehat_careplan_at": &now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "CarePlan (RTL) berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// SendCarePlanFromAssessmentPlan sends treatment plan from AssessmentPlan as FHIR CarePlan
// POST /api/v1/satusehat/fhir/careplan/assessment/:assessmentPlanId/send
func SendCarePlanFromAssessmentPlan(c *gin.Context) {
	assessmentPlanID, err := strconv.ParseUint(c.Param("assessmentPlanId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID assessment plan tidak valid"})
		return
	}

	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil pengaturan SatuSehat: " + err.Error()})
		return
	}
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Load assessment plan with relations
	var assessmentPlan models.AssessmentPlan
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		Preload("AssessedBy").
		Preload("AssessedBy.Employee").
		First(&assessmentPlan, assessmentPlanID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assessment Plan tidak ditemukan"})
		return
	}

	// Check if already sent
	if assessmentPlan.SatusehatCarePlanID != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "CarePlan sudah pernah dikirim",
			"satusehat_id": assessmentPlan.SatusehatCarePlanID,
		})
		return
	}

	visit := assessmentPlan.Visit
	patient := visit.Registration.Patient

	var author *models.Employee
	if assessmentPlan.AssessedBy != nil && assessmentPlan.AssessedBy.Employee != nil {
		author = assessmentPlan.AssessedBy.Employee
	} else if visit.Doctor != nil {
		author = visit.Doctor
	}

	carePlan, err := BuildCarePlanFromAssessmentPlan(&assessmentPlan, visit, patient, author, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/CarePlan", carePlan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	var responseData map[string]interface{}
	json.Unmarshal(responseBody, &responseData)

	// Handle duplicate - SatuSehat returns error for duplicate
	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		// Check if it's a duplicate error
		if issues, ok := responseData["issue"].([]interface{}); ok && len(issues) > 0 {
			for _, issue := range issues {
				if issueMap, ok := issue.(map[string]interface{}); ok {
					if code, _ := issueMap["code"].(string); code == "duplicate" {
						c.JSON(http.StatusConflict, gin.H{
							"error":    "CarePlan sudah pernah dikirim ke SatuSehat (duplicate)",
							"response": responseData,
						})
						return
					}
				}
			}
		}
		c.JSON(statusCode, gin.H{"error": "SatuSehat menolak request", "response": responseData})
		return
	}

	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Save to database
	if satusehatID != "" {
		now := time.Now()
		database.DB.Model(&assessmentPlan).Updates(map[string]interface{}{
			"satusehat_careplan_id": satusehatID,
			"satusehat_careplan_at": &now,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "CarePlan (Rencana Pengobatan) berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// ============================================================================
// Monitoring Handlers
// ============================================================================

// GetMedicationStatementMonitoring returns list of anamnesis with medication history for monitoring
// GET /api/v1/satusehat/monitoring/medicationstatement
func GetMedicationStatementMonitoring(c *gin.Context) {
	// Parse date range
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	if startDateStr != "" {
		startDate, err = time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
	} else {
		startDate = time.Now().AddDate(0, 0, -7) // Default 7 hari terakhir
	}

	if endDateStr != "" {
		endDate, err = time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
	} else {
		endDate = time.Now()
	}

	// Ensure end date includes the entire day
	endDate = endDate.Add(24*time.Hour - time.Second)

	// Query anamnesis with current_medications
	var anamneses []models.Anamnesis
	if err := database.DB.
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Where("current_medications IS NOT NULL AND current_medications != ''").
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Room").
		Order("created_at DESC").
		Find(&anamneses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data: " + err.Error()})
		return
	}

	// Build response
	type ItemResponse struct {
		ID                 uint      `json:"id"`
		VisitID            uint      `json:"visit_id"`
		VisitNumber        string    `json:"visit_number"`
		PatientName        string    `json:"patient_name"`
		PatientMRN         string    `json:"patient_mrn"`
		RoomName           string    `json:"room_name"`
		CurrentMedications string    `json:"current_medications"`
		CreatedAt          time.Time `json:"created_at"`
		HasEncounter       bool      `json:"has_encounter"`
	}

	items := make([]ItemResponse, 0)
	for _, a := range anamneses {
		if a.Visit == nil || a.Visit.Registration == nil {
			continue
		}

		patientName := ""
		patientMRN := ""
		if a.Visit.Registration.Patient != nil {
			patientName = a.Visit.Registration.Patient.NamaLengkap
			patientMRN = a.Visit.Registration.Patient.NoRM
		}

		roomName := ""
		if a.Visit.Room != nil {
			roomName = a.Visit.Room.Name
		}

		items = append(items, ItemResponse{
			ID:                 a.ID,
			VisitID:            a.VisitID,
			VisitNumber:        a.Visit.VisitNumber,
			PatientName:        patientName,
			PatientMRN:         patientMRN,
			RoomName:           roomName,
			CurrentMedications: a.CurrentMedications,
			CreatedAt:          a.CreatedAt,
			HasEncounter:       a.Visit.SatuSehatEncounterID != "",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": len(items),
	})
}

// GetCarePlanMonitoring returns list of CPPT and Dispositions with care plans for monitoring
// GET /api/v1/satusehat/monitoring/careplan
func GetCarePlanMonitoring(c *gin.Context) {
	// Parse date range
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	sourceType := c.Query("source") // cppt, disposition, or all

	var startDate, endDate time.Time
	var err error

	if startDateStr != "" {
		startDate, err = time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
	} else {
		startDate = time.Now().AddDate(0, 0, -7)
	}

	if endDateStr != "" {
		endDate, err = time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
	} else {
		endDate = time.Now()
	}
	endDate = endDate.Add(24*time.Hour - time.Second)

	type ItemResponse struct {
		ID           uint      `json:"id"`
		Source       string    `json:"source"` // cppt or disposition
		VisitID      uint      `json:"visit_id"`
		VisitNumber  string    `json:"visit_number"`
		PatientName  string    `json:"patient_name"`
		PatientMRN   string    `json:"patient_mrn"`
		RoomName     string    `json:"room_name"`
		Title        string    `json:"title"`
		Description  string    `json:"description"`
		CreatedAt    time.Time `json:"created_at"`
		HasEncounter bool      `json:"has_encounter"`
	}

	items := make([]ItemResponse, 0)

	// Get CPPT with Plan or Instruction
	if sourceType == "" || sourceType == "all" || sourceType == "cppt" {
		var cppts []models.CPPT
		database.DB.
			Where("created_at BETWEEN ? AND ?", startDate, endDate).
			Where("(plan IS NOT NULL AND plan != '') OR (instruction IS NOT NULL AND instruction != '')").
			Preload("Visit").
			Preload("Visit.Registration.Patient").
			Preload("Visit.Room").
			Order("created_at DESC").
			Find(&cppts)

		for _, c := range cppts {
			if c.Visit == nil || c.Visit.Registration == nil {
				continue
			}

			patientName := ""
			patientMRN := ""
			if c.Visit.Registration.Patient != nil {
				patientName = c.Visit.Registration.Patient.NamaLengkap
				patientMRN = c.Visit.Registration.Patient.NoRM
			}

			roomName := ""
			if c.Visit.Room != nil {
				roomName = c.Visit.Room.Name
			}

			title := "Rencana Perawatan"
			if c.Profession == models.CPPTProfessionDoctor {
				title = "Instruksi Medik"
			} else if c.Profession == models.CPPTProfessionNurse {
				title = "Instruksi Keperawatan"
			}

			description := c.Plan
			if c.Instruction != "" {
				if description != "" {
					description += " | "
				}
				description += c.Instruction
			}

			items = append(items, ItemResponse{
				ID:           c.ID,
				Source:       "cppt",
				VisitID:      c.VisitID,
				VisitNumber:  c.Visit.VisitNumber,
				PatientName:  patientName,
				PatientMRN:   patientMRN,
				RoomName:     roomName,
				Title:        title,
				Description:  description,
				CreatedAt:    c.RecordDate,
				HasEncounter: c.Visit.SatuSehatEncounterID != "",
			})
		}
	}

	// Get Dispositions with follow-up instructions
	if sourceType == "" || sourceType == "all" || sourceType == "disposition" {
		var dispositions []models.Disposition
		database.DB.
			Where("created_at BETWEEN ? AND ?", startDate, endDate).
			Where("(discharge_instruction IS NOT NULL AND discharge_instruction != '') OR (follow_up_instruction IS NOT NULL AND follow_up_instruction != '') OR follow_up_date IS NOT NULL").
			Preload("Visit").
			Preload("Visit.Registration.Patient").
			Preload("Visit.Room").
			Order("created_at DESC").
			Find(&dispositions)

		for _, d := range dispositions {
			if d.Visit == nil || d.Visit.Registration == nil {
				continue
			}

			patientName := ""
			patientMRN := ""
			if d.Visit.Registration.Patient != nil {
				patientName = d.Visit.Registration.Patient.NamaLengkap
				patientMRN = d.Visit.Registration.Patient.NoRM
			}

			roomName := ""
			if d.Visit.Room != nil {
				roomName = d.Visit.Room.Name
			}

			description := ""
			if d.DischargeInstruction != "" {
				description = d.DischargeInstruction
			}
			if d.FollowUpInstruction != "" {
				if description != "" {
					description += " | "
				}
				description += d.FollowUpInstruction
			}

			items = append(items, ItemResponse{
				ID:           d.ID,
				Source:       "disposition",
				VisitID:      d.VisitID,
				VisitNumber:  d.Visit.VisitNumber,
				PatientName:  patientName,
				PatientMRN:   patientMRN,
				RoomName:     roomName,
				Title:        "Rencana Tindak Lanjut",
				Description:  description,
				CreatedAt:    d.CreatedAt,
				HasEncounter: d.Visit.SatuSehatEncounterID != "",
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": len(items),
	})
}
