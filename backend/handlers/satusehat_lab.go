package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// FHIR ServiceRequest, Specimen, DiagnosticReport Resources
// For Laboratory and Radiology Integration with SatuSehat
// Reference: Postman Collection SatuSehat - Pemeriksaan Penunjang
// ============================================================================

// ============================================================================
// FHIR ServiceRequest Resource
// ============================================================================

// FHIRServiceRequest represents FHIR ServiceRequest resource
type FHIRServiceRequest struct {
	ResourceType       string                `json:"resourceType"`
	ID                 string                `json:"id,omitempty"`
	Identifier         []FHIRIdentifier      `json:"identifier,omitempty"`
	Status             string                `json:"status"`    // active, completed, cancelled
	Intent             string                `json:"intent"`    // order, original-order
	Category           []FHIRCodeableConcept `json:"category"`  // Laboratory procedure / Imaging
	Priority           string                `json:"priority"`  // routine, urgent, asap, stat
	Code               *FHIRCodeableConcept  `json:"code"`      // LOINC code
	Subject            *FHIRReference        `json:"subject"`   // Patient
	Encounter          *FHIRReference        `json:"encounter"` // Encounter
	OccurrenceDateTime string                `json:"occurrenceDateTime,omitempty"`
	AuthoredOn         string                `json:"authoredOn,omitempty"`
	Requester          *FHIRReference        `json:"requester,omitempty"` // Practitioner
	Performer          []FHIRReference       `json:"performer,omitempty"` // Lab/Radiology Organization
	ReasonCode         []FHIRCodeableConcept `json:"reasonCode,omitempty"`
	BodySite           []FHIRCodeableConcept `json:"bodySite,omitempty"` // For radiology
}

// ============================================================================
// FHIR Specimen Resource
// ============================================================================

// FHIRSpecimen represents FHIR Specimen resource
type FHIRSpecimen struct {
	ResourceType string                  `json:"resourceType"`
	ID           string                  `json:"id,omitempty"`
	Identifier   []FHIRIdentifier        `json:"identifier,omitempty"`
	Status       string                  `json:"status"` // available, unavailable, unsatisfactory
	Type         *FHIRCodeableConcept    `json:"type"`   // SNOMED specimen type
	Subject      *FHIRReference          `json:"subject"`
	ReceivedTime string                  `json:"receivedTime,omitempty"`
	Request      []FHIRReference         `json:"request,omitempty"` // ServiceRequest reference
	Collection   *FHIRSpecimenCollection `json:"collection,omitempty"`
}

// FHIRSpecimenCollection represents specimen collection details
type FHIRSpecimenCollection struct {
	CollectedDateTime string               `json:"collectedDateTime,omitempty"`
	Collector         *FHIRReference       `json:"collector,omitempty"` // Practitioner
	Method            *FHIRCodeableConcept `json:"method,omitempty"`
	BodySite          *FHIRCodeableConcept `json:"bodySite,omitempty"`
}

// ============================================================================
// FHIR DiagnosticReport Resource
// ============================================================================

// FHIRDiagnosticReport represents FHIR DiagnosticReport resource
type FHIRDiagnosticReport struct {
	ResourceType      string                `json:"resourceType"`
	ID                string                `json:"id,omitempty"`
	Identifier        []FHIRIdentifier      `json:"identifier,omitempty"`
	BasedOn           []FHIRReference       `json:"basedOn,omitempty"` // ServiceRequest
	Status            string                `json:"status"`            // registered, partial, preliminary, final
	Category          []FHIRCodeableConcept `json:"category"`
	Code              *FHIRCodeableConcept  `json:"code"` // LOINC code
	Subject           *FHIRReference        `json:"subject"`
	Encounter         *FHIRReference        `json:"encounter"`
	EffectiveDateTime string                `json:"effectiveDateTime,omitempty"`
	Issued            string                `json:"issued,omitempty"`
	Performer         []FHIRReference       `json:"performer,omitempty"`
	Specimen          []FHIRReference       `json:"specimen,omitempty"`
	Result            []FHIRReference       `json:"result,omitempty"` // Observation references
	Conclusion        string                `json:"conclusion,omitempty"`
}

// ============================================================================
// FHIR Observation Resource (for Lab Results)
// ============================================================================

// FHIRObservationLab represents FHIR Observation for lab results
type FHIRObservationLab struct {
	ResourceType      string                `json:"resourceType"`
	ID                string                `json:"id,omitempty"`
	Identifier        []FHIRIdentifier      `json:"identifier,omitempty"`
	Status            string                `json:"status"` // final, preliminary
	Category          []FHIRCodeableConcept `json:"category"`
	Code              *FHIRCodeableConcept  `json:"code"` // LOINC code
	Subject           *FHIRReference        `json:"subject"`
	Encounter         *FHIRReference        `json:"encounter"`
	EffectiveDateTime string                `json:"effectiveDateTime,omitempty"`
	Issued            string                `json:"issued,omitempty"`
	Performer         []FHIRReference       `json:"performer,omitempty"`
	ValueQuantity     *FHIRQuantity         `json:"valueQuantity,omitempty"`
	ValueString       string                `json:"valueString,omitempty"`
	Interpretation    []FHIRCodeableConcept `json:"interpretation,omitempty"`
	ReferenceRange    []FHIRReferenceRange  `json:"referenceRange,omitempty"`
	Specimen          *FHIRReference        `json:"specimen,omitempty"`
}

// FHIRReferenceRange represents reference range for observations
type FHIRReferenceRange struct {
	Low  *FHIRQuantity `json:"low,omitempty"`
	High *FHIRQuantity `json:"high,omitempty"`
	Text string        `json:"text,omitempty"`
}

// ============================================================================
// Build Functions
// ============================================================================

// BuildFHIRServiceRequest creates FHIR ServiceRequest from VisitProcedure
func BuildFHIRServiceRequest(
	visitProcedure *models.VisitProcedure,
	visit *models.Visit,
	patient *models.Patient,
	doctor *models.Employee,
	loincMapping *models.ProcedureLoincMapping,
	orgID string,
) (*FHIRServiceRequest, error) {
	// Validate required data
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if doctor.SatuSehatID == "" {
		return nil, fmt.Errorf("dokter belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}
	if loincMapping == nil {
		return nil, fmt.Errorf("prosedur belum memiliki mapping LOINC")
	}

	// Determine category (Lab or Imaging)
	categoryCode := loincMapping.SnomedCategoryCode
	categoryDisplay := loincMapping.SnomedCategoryDisplay
	if categoryDisplay == "" {
		categoryDisplay = models.GetSnomedCategoryDisplay(categoryCode)
	}

	// Build identifier
	identifier := fmt.Sprintf("SR-%d-%d", visit.ID, visitProcedure.ID)

	authoredOn := time.Now()
	if visitProcedure.CreatedAt.IsZero() == false {
		authoredOn = visitProcedure.CreatedAt
	}

	occurrenceTime := time.Now()
	if visitProcedure.PerformedAt != nil {
		occurrenceTime = *visitProcedure.PerformedAt
	}

	serviceRequest := &FHIRServiceRequest{
		ResourceType: "ServiceRequest",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/servicerequest/" + orgID,
				Value:  identifier,
			},
		},
		Status: "active",
		Intent: "order",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://snomed.info/sct",
						Code:    categoryCode,
						Display: categoryDisplay,
					},
				},
			},
		},
		Priority: "routine",
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    loincMapping.LoincCode,
					Display: loincMapping.LoincDisplay,
				},
			},
			Text: loincMapping.LoincDisplay,
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		OccurrenceDateTime: occurrenceTime.Format(time.RFC3339),
		AuthoredOn:         authoredOn.Format(time.RFC3339),
		Requester: &FHIRReference{
			Reference: "Practitioner/" + doctor.SatuSehatID,
			Display:   doctor.NamaLengkap,
		},
		Performer: []FHIRReference{
			{
				Reference: "Organization/" + orgID,
			},
		},
	}

	// Add body site for radiology
	if loincMapping.SnomedBodySiteCode != "" {
		serviceRequest.BodySite = []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://snomed.info/sct",
						Code:    loincMapping.SnomedBodySiteCode,
						Display: loincMapping.SnomedBodySiteDisplay,
					},
				},
			},
		}
	}

	return serviceRequest, nil
}

// BuildFHIRSpecimen creates FHIR Specimen from VisitProcedure
func BuildFHIRSpecimen(
	visitProcedure *models.VisitProcedure,
	patient *models.Patient,
	collector *models.Employee,
	loincMapping *models.ProcedureLoincMapping,
	serviceRequestID string,
	orgID string,
) (*FHIRSpecimen, error) {
	// Validate required data
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if loincMapping.SnomedSpecimenCode == "" {
		return nil, fmt.Errorf("prosedur belum memiliki mapping specimen SNOMED")
	}

	// Build identifier
	identifier := fmt.Sprintf("SPEC-%d", visitProcedure.ID)

	collectedTime := time.Now()
	if visitProcedure.PerformedAt != nil {
		collectedTime = *visitProcedure.PerformedAt
	}

	specimen := &FHIRSpecimen{
		ResourceType: "Specimen",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/specimen/" + orgID,
				Value:  identifier,
			},
		},
		Status: "available",
		Type: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://snomed.info/sct",
					Code:    loincMapping.SnomedSpecimenCode,
					Display: loincMapping.SnomedSpecimenDisplay,
				},
			},
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		ReceivedTime: collectedTime.Format(time.RFC3339),
		Collection: &FHIRSpecimenCollection{
			CollectedDateTime: collectedTime.Format(time.RFC3339),
		},
	}

	// Add collector if available
	if collector != nil && collector.SatuSehatID != "" {
		specimen.Collection.Collector = &FHIRReference{
			Reference: "Practitioner/" + collector.SatuSehatID,
			Display:   collector.NamaLengkap,
		}
	}

	// Add ServiceRequest reference
	if serviceRequestID != "" {
		specimen.Request = []FHIRReference{
			{
				Reference: "ServiceRequest/" + serviceRequestID,
			},
		}
	}

	// Add body site if available
	if loincMapping.SnomedBodySiteCode != "" {
		specimen.Collection.BodySite = &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://snomed.info/sct",
					Code:    loincMapping.SnomedBodySiteCode,
					Display: loincMapping.SnomedBodySiteDisplay,
				},
			},
		}
	}

	return specimen, nil
}

// BuildFHIRObservationLab creates FHIR Observation from VisitProcedureResult
func BuildFHIRObservationLab(
	result *models.VisitProcedureResult,
	visitProcedure *models.VisitProcedure,
	visit *models.Visit,
	patient *models.Patient,
	performer *models.Employee,
	specimenID string,
	orgID string,
) (*FHIRObservationLab, error) {
	// Validate required data
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}
	if result.Parameter == nil {
		return nil, fmt.Errorf("parameter tidak ditemukan")
	}

	// Build identifier
	identifier := fmt.Sprintf("OBS-%d-%d", visitProcedure.ID, result.ID)

	effectiveTime := time.Now()
	if visitProcedure.PerformedAt != nil {
		effectiveTime = *visitProcedure.PerformedAt
	}

	observation := &FHIRObservationLab{
		ResourceType: "Observation",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/observation/" + orgID,
				Value:  identifier,
			},
		},
		Status: "final",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/observation-category",
						Code:    "laboratory",
						Display: "Laboratory",
					},
				},
			},
		},
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    result.Parameter.Code,
					Display: result.Parameter.Name,
				},
			},
			Text: result.Parameter.Name,
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		EffectiveDateTime: effectiveTime.Format(time.RFC3339),
		Issued:            time.Now().Format(time.RFC3339),
	}

	// Add performer if available
	if performer != nil && performer.SatuSehatID != "" {
		observation.Performer = []FHIRReference{
			{
				Reference: "Practitioner/" + performer.SatuSehatID,
				Display:   performer.NamaLengkap,
			},
		}
	}

	// Add value - numeric or string
	if result.NumValue != 0 || result.Parameter.InputType == "number" {
		observation.ValueQuantity = &FHIRQuantity{
			Value:  result.NumValue,
			Unit:   result.Parameter.Unit,
			System: "http://unitsofmeasure.org",
			Code:   result.Parameter.Unit,
		}
	} else {
		observation.ValueString = result.Value
	}

	// Add interpretation if abnormal/critical
	if result.IsAbnormal || result.IsCritical {
		interpretCode := "A" // Abnormal
		interpretDisplay := "Abnormal"
		if result.IsCritical {
			interpretCode = "AA"
			interpretDisplay = "Critical abnormal"
		}
		observation.Interpretation = []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
						Code:    interpretCode,
						Display: interpretDisplay,
					},
				},
			},
		}
	}

	// Add reference range if available
	if result.Parameter.NormalMin != 0 || result.Parameter.NormalMax != 0 || result.Parameter.NormalText != "" {
		refRange := FHIRReferenceRange{}
		if result.Parameter.NormalMin != 0 {
			refRange.Low = &FHIRQuantity{
				Value:  result.Parameter.NormalMin,
				Unit:   result.Parameter.Unit,
				System: "http://unitsofmeasure.org",
			}
		}
		if result.Parameter.NormalMax != 0 {
			refRange.High = &FHIRQuantity{
				Value:  result.Parameter.NormalMax,
				Unit:   result.Parameter.Unit,
				System: "http://unitsofmeasure.org",
			}
		}
		if result.Parameter.NormalText != "" {
			refRange.Text = result.Parameter.NormalText
		}
		observation.ReferenceRange = []FHIRReferenceRange{refRange}
	}

	// Add specimen reference
	if specimenID != "" {
		observation.Specimen = &FHIRReference{
			Reference: "Specimen/" + specimenID,
		}
	}

	return observation, nil
}

// BuildFHIRDiagnosticReport creates FHIR DiagnosticReport from VisitProcedure
func BuildFHIRDiagnosticReport(
	visitProcedure *models.VisitProcedure,
	visit *models.Visit,
	patient *models.Patient,
	performer *models.Employee,
	loincMapping *models.ProcedureLoincMapping,
	serviceRequestID string,
	specimenID string,
	observationIDs []string,
	orgID string,
	conclusion string,
) (*FHIRDiagnosticReport, error) {
	// Validate required data
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}

	// Build identifier
	identifier := fmt.Sprintf("DR-%d", visitProcedure.ID)

	effectiveTime := time.Now()
	if visitProcedure.PerformedAt != nil {
		effectiveTime = *visitProcedure.PerformedAt
	}

	// Determine category code
	categoryCode := "LAB"
	categoryDisplay := "Laboratory"
	if loincMapping.SnomedCategoryCode == models.SnomedCodeImaging {
		categoryCode = "RAD"
		categoryDisplay = "Radiology"
	}

	report := &FHIRDiagnosticReport{
		ResourceType: "DiagnosticReport",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/diagnostic-report/" + orgID,
				Value:  identifier,
			},
		},
		Status: "final",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/v2-0074",
						Code:    categoryCode,
						Display: categoryDisplay,
					},
				},
			},
		},
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    loincMapping.LoincCode,
					Display: loincMapping.LoincDisplay,
				},
			},
			Text: loincMapping.LoincDisplay,
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + visit.SatuSehatEncounterID,
		},
		EffectiveDateTime: effectiveTime.Format(time.RFC3339),
		Issued:            time.Now().Format(time.RFC3339),
		Conclusion:        conclusion,
	}

	// Add ServiceRequest reference
	if serviceRequestID != "" {
		report.BasedOn = []FHIRReference{
			{
				Reference: "ServiceRequest/" + serviceRequestID,
			},
		}
	}

	// Add performer
	if performer != nil && performer.SatuSehatID != "" {
		report.Performer = []FHIRReference{
			{
				Reference: "Practitioner/" + performer.SatuSehatID,
				Display:   performer.NamaLengkap,
			},
			{
				Reference: "Organization/" + orgID,
			},
		}
	}

	// Add specimen reference
	if specimenID != "" {
		report.Specimen = []FHIRReference{
			{
				Reference: "Specimen/" + specimenID,
			},
		}
	}

	// Add observation references
	for _, obsID := range observationIDs {
		report.Result = append(report.Result, FHIRReference{
			Reference: "Observation/" + obsID,
		})
	}

	return report, nil
}

// ============================================================================
// API Handlers for ServiceRequest
// ============================================================================

// SendServiceRequestToSatuSehat sends a lab/radiology order as FHIR ServiceRequest
// POST /api/v1/satusehat/fhir/servicerequest/:visitProcedureId
func SendServiceRequestToSatuSehat(c *gin.Context) {
	visitProcedureID, err := strconv.ParseUint(c.Param("visitProcedureId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID visit procedure tidak valid"})
		return
	}

	// Get SatuSehat config
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

	// Load visit procedure with relations
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		Preload("Procedure").
		First(&visitProcedure, visitProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit procedure tidak ditemukan"})
		return
	}

	// Check if already sent
	if visitProcedure.SatusehatServiceRequestID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "ServiceRequest sudah dikirim",
			"satusehat_id": visitProcedure.SatusehatServiceRequestID,
		})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", visitProcedure.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Prosedur belum memiliki mapping LOINC. Silakan mapping terlebih dahulu di menu Integrasi > LOINC Mapping",
		})
		return
	}

	visit := visitProcedure.Visit
	if visit == nil || visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}
	patient := visit.Registration.Patient
	doctor := visit.Doctor

	// Build FHIR ServiceRequest
	serviceRequest, err := BuildFHIRServiceRequest(&visitProcedure, visit, patient, doctor, &loincMapping, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Send to SatuSehat using existing helper
	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/ServiceRequest", serviceRequest)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	// Parse response
	var responseData map[string]interface{}
	if err := json.Unmarshal(responseBody, &responseData); err != nil {
		log.Printf("Failed to parse SatuSehat response: %v", err)
	}

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{
			"error":    "SatuSehat menolak request",
			"response": responseData,
		})
		return
	}

	// Extract SatuSehat ID from response
	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Update visit procedure with SatuSehat ID
	if satusehatID != "" {
		visitProcedure.SatusehatServiceRequestID = satusehatID
		database.DB.Save(&visitProcedure)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "ServiceRequest berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// ============================================================================
// API Handlers for Specimen
// ============================================================================

// SendSpecimenToSatuSehat sends specimen data as FHIR Specimen
// POST /api/v1/satusehat/fhir/specimen/:visitProcedureId
func SendSpecimenToSatuSehat(c *gin.Context) {
	visitProcedureID, err := strconv.ParseUint(c.Param("visitProcedureId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID visit procedure tidak valid"})
		return
	}

	// Get SatuSehat config
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

	// Load visit procedure with relations
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("FilledBy").
		Preload("FilledBy.Employee").
		Preload("Procedure").
		First(&visitProcedure, visitProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit procedure tidak ditemukan"})
		return
	}

	// Check if ServiceRequest has been sent
	if visitProcedure.SatusehatServiceRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ServiceRequest belum dikirim. Kirim ServiceRequest terlebih dahulu",
		})
		return
	}

	// Check if Specimen already sent
	if visitProcedure.SatusehatSpecimenID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "Specimen sudah dikirim",
			"satusehat_id": visitProcedure.SatusehatSpecimenID,
		})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", visitProcedure.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	// Check if specimen mapping exists (required for lab)
	if loincMapping.SnomedSpecimenCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Prosedur belum memiliki mapping specimen SNOMED. Silakan lengkapi di menu LOINC Mapping",
		})
		return
	}

	visit := visitProcedure.Visit
	if visit == nil || visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}
	patient := visit.Registration.Patient

	// Get collector (employee who filled the procedure)
	var collector *models.Employee
	if visitProcedure.FilledBy != nil && visitProcedure.FilledBy.Employee != nil {
		collector = visitProcedure.FilledBy.Employee
	}

	// Build FHIR Specimen
	specimen, err := BuildFHIRSpecimen(&visitProcedure, patient, collector, &loincMapping, visitProcedure.SatusehatServiceRequestID, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Send to SatuSehat using existing helper
	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Specimen", specimen)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	// Parse response
	var responseData map[string]interface{}
	if err := json.Unmarshal(responseBody, &responseData); err != nil {
		log.Printf("Failed to parse SatuSehat response: %v", err)
	}

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{
			"error":    "SatuSehat menolak request",
			"response": responseData,
		})
		return
	}

	// Extract SatuSehat ID from response
	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Update visit procedure with SatuSehat ID
	if satusehatID != "" {
		visitProcedure.SatusehatSpecimenID = satusehatID
		database.DB.Save(&visitProcedure)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Specimen berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// ============================================================================
// API Handlers for DiagnosticReport
// ============================================================================

// SendDiagnosticReportToSatuSehat sends lab results as FHIR DiagnosticReport
// POST /api/v1/satusehat/fhir/diagnosticreport/:visitProcedureId
func SendDiagnosticReportToSatuSehat(c *gin.Context) {
	visitProcedureID, err := strconv.ParseUint(c.Param("visitProcedureId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID visit procedure tidak valid"})
		return
	}

	// Get optional conclusion from request body
	var req struct {
		Conclusion string `json:"conclusion"`
	}
	c.ShouldBindJSON(&req)

	// Get SatuSehat config
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

	// Load visit procedure with all relations
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("FilledBy").
		Preload("FilledBy.Employee").
		Preload("Procedure").
		Preload("Results").
		Preload("Results.Parameter").
		First(&visitProcedure, visitProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit procedure tidak ditemukan"})
		return
	}

	// Check if completed
	if visitProcedure.Status != models.VisitProcedureStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Tindakan belum selesai (status harus completed)",
		})
		return
	}

	// Check if ServiceRequest has been sent
	if visitProcedure.SatusehatServiceRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ServiceRequest belum dikirim. Kirim ServiceRequest terlebih dahulu",
		})
		return
	}

	// Check if DiagnosticReport already sent
	if visitProcedure.SatusehatDiagnosticReportID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "DiagnosticReport sudah dikirim",
			"satusehat_id": visitProcedure.SatusehatDiagnosticReportID,
		})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", visitProcedure.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	visit := visitProcedure.Visit
	if visit == nil || visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}
	patient := visit.Registration.Patient

	// Get performer (employee who filled the procedure)
	var performer *models.Employee
	if visitProcedure.FilledBy != nil && visitProcedure.FilledBy.Employee != nil {
		performer = visitProcedure.FilledBy.Employee
	}

	// Send Observations first (for lab results)
	var observationIDs []string
	for _, result := range visitProcedure.Results {
		if result.Value == "" && result.NumValue == 0 {
			continue // Skip empty results
		}

		obs, err := BuildFHIRObservationLab(&result, &visitProcedure, visit, patient, performer, visitProcedure.SatusehatSpecimenID, orgID)
		if err != nil {
			log.Printf("Failed to build observation for result %d: %v", result.ID, err)
			continue
		}

		// Send Observation using existing helper
		responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Observation", obs)
		if err != nil {
			log.Printf("Failed to send observation: %v", err)
			continue
		}

		if statusCode == http.StatusOK || statusCode == http.StatusCreated {
			var obsResponse map[string]interface{}
			if err := json.Unmarshal(responseBody, &obsResponse); err == nil {
				if id, ok := obsResponse["id"].(string); ok {
					observationIDs = append(observationIDs, id)
				}
			}
		}
	}

	// Save observation IDs
	if len(observationIDs) > 0 {
		obsIDsJSON, _ := json.Marshal(observationIDs)
		visitProcedure.SatusehatObservationIDs = string(obsIDsJSON)
		database.DB.Save(&visitProcedure)
	}

	// Build and send DiagnosticReport
	report, err := BuildFHIRDiagnosticReport(
		&visitProcedure,
		visit,
		patient,
		performer,
		&loincMapping,
		visitProcedure.SatusehatServiceRequestID,
		visitProcedure.SatusehatSpecimenID,
		observationIDs,
		orgID,
		req.Conclusion,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Send DiagnosticReport to SatuSehat using existing helper
	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/DiagnosticReport", report)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	// Parse response
	var responseData map[string]interface{}
	if err := json.Unmarshal(responseBody, &responseData); err != nil {
		log.Printf("Failed to parse SatuSehat response: %v", err)
	}

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		c.JSON(statusCode, gin.H{
			"error":    "SatuSehat menolak request",
			"response": responseData,
		})
		return
	}

	// Extract SatuSehat ID from response
	satusehatID := ""
	if id, ok := responseData["id"].(string); ok {
		satusehatID = id
	}

	// Update visit procedure with SatuSehat ID
	if satusehatID != "" {
		visitProcedure.SatusehatDiagnosticReportID = satusehatID
		database.DB.Save(&visitProcedure)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "DiagnosticReport berhasil dikirim ke SatuSehat",
		"satusehat_id":    satusehatID,
		"observation_ids": observationIDs,
		"response":        responseData,
	})
}

// ============================================================================
// Status Handlers for Lab Resources
// ============================================================================

// GetLabResourceStatus returns the SatuSehat send status for lab procedures
// GET /api/v1/satusehat/fhir/lab/status/:visitProcedureId
func GetLabResourceStatus(c *gin.Context) {
	visitProcedureID, err := strconv.ParseUint(c.Param("visitProcedureId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID visit procedure tidak valid"})
		return
	}

	// Load visit procedure with relations
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		Preload("Procedure").
		Preload("Results").
		Preload("Results.Parameter").
		First(&visitProcedure, visitProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit procedure tidak ditemukan"})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	hasLoincMapping := database.DB.Where("procedure_id = ?", visitProcedure.ProcedureID).First(&loincMapping).Error == nil

	visit := visitProcedure.Visit
	var patient *models.Patient
	if visit != nil && visit.Registration != nil {
		patient = visit.Registration.Patient
	}
	doctor := visit.Doctor

	// Check prerequisites
	patientHasIHS := patient != nil && patient.SatuSehatID != ""
	doctorHasIHS := doctor != nil && doctor.SatuSehatID != ""
	encounterSent := visit != nil && visit.SatuSehatEncounterID != ""
	hasSpecimenMapping := hasLoincMapping && loincMapping.SnomedSpecimenCode != ""
	isLab := hasLoincMapping && loincMapping.SnomedCategoryCode == models.SnomedCodeLaboratoryProcedure
	isCompleted := visitProcedure.Status == models.VisitProcedureStatusCompleted

	// Build status response
	type ResourceStatus struct {
		Resource    string `json:"resource"`
		Sent        bool   `json:"sent"`
		SatuSehatID string `json:"satusehat_id,omitempty"`
		CanSend     bool   `json:"can_send"`
		BlockedBy   string `json:"blocked_by,omitempty"`
	}

	statuses := []ResourceStatus{}

	// ServiceRequest status
	srStatus := ResourceStatus{
		Resource:    "ServiceRequest",
		Sent:        visitProcedure.SatusehatServiceRequestID != "",
		SatuSehatID: visitProcedure.SatusehatServiceRequestID,
		CanSend:     patientHasIHS && doctorHasIHS && encounterSent && hasLoincMapping && visitProcedure.SatusehatServiceRequestID == "",
	}
	if !patientHasIHS {
		srStatus.BlockedBy = "Patient IHS"
	} else if !doctorHasIHS {
		srStatus.BlockedBy = "Doctor IHS"
	} else if !encounterSent {
		srStatus.BlockedBy = "Encounter"
	} else if !hasLoincMapping {
		srStatus.BlockedBy = "LOINC Mapping"
	}
	statuses = append(statuses, srStatus)

	// Specimen status (only for lab)
	if isLab {
		specStatus := ResourceStatus{
			Resource:    "Specimen",
			Sent:        visitProcedure.SatusehatSpecimenID != "",
			SatuSehatID: visitProcedure.SatusehatSpecimenID,
			CanSend:     visitProcedure.SatusehatServiceRequestID != "" && hasSpecimenMapping && visitProcedure.SatusehatSpecimenID == "",
		}
		if visitProcedure.SatusehatServiceRequestID == "" {
			specStatus.BlockedBy = "ServiceRequest"
		} else if !hasSpecimenMapping {
			specStatus.BlockedBy = "Specimen Mapping"
		}
		statuses = append(statuses, specStatus)
	}

	// DiagnosticReport status
	drStatus := ResourceStatus{
		Resource:    "DiagnosticReport",
		Sent:        visitProcedure.SatusehatDiagnosticReportID != "",
		SatuSehatID: visitProcedure.SatusehatDiagnosticReportID,
		CanSend:     visitProcedure.SatusehatServiceRequestID != "" && isCompleted && visitProcedure.SatusehatDiagnosticReportID == "",
	}
	if visitProcedure.SatusehatServiceRequestID == "" {
		drStatus.BlockedBy = "ServiceRequest"
	} else if !isCompleted {
		drStatus.BlockedBy = "Status belum completed"
	}
	statuses = append(statuses, drStatus)

	// Parse observation IDs
	var observationIDs []string
	if visitProcedure.SatusehatObservationIDs != "" {
		json.Unmarshal([]byte(visitProcedure.SatusehatObservationIDs), &observationIDs)
	}

	c.JSON(http.StatusOK, gin.H{
		"visit_procedure_id": visitProcedure.ID,
		"procedure_name":     visitProcedure.Procedure.Name,
		"procedure_type":     visitProcedure.Procedure.ProcedureType,
		"status":             visitProcedure.Status,
		"has_loinc_mapping":  hasLoincMapping,
		"loinc_code":         loincMapping.LoincCode,
		"loinc_display":      loincMapping.LoincDisplay,
		"is_laboratory":      isLab,
		"prerequisites": gin.H{
			"patient_ihs":      patientHasIHS,
			"doctor_ihs":       doctorHasIHS,
			"encounter_sent":   encounterSent,
			"loinc_mapping":    hasLoincMapping,
			"specimen_mapping": hasSpecimenMapping,
		},
		"resources":       statuses,
		"observation_ids": observationIDs,
		"results_count":   len(visitProcedure.Results),
	})
}

// SendAllLabResourcesToSatuSehat sends all lab resources in sequence
// POST /api/v1/satusehat/fhir/lab/send-all/:visitProcedureId
func SendAllLabResourcesToSatuSehat(c *gin.Context) {
	visitProcedureID, err := strconv.ParseUint(c.Param("visitProcedureId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID visit procedure tidak valid"})
		return
	}

	// Get optional conclusion from request body
	var req struct {
		Conclusion string `json:"conclusion"`
	}
	c.ShouldBindJSON(&req)

	// Get SatuSehat config
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

	// Load visit procedure with all relations
	var visitProcedure models.VisitProcedure
	if err := database.DB.
		Preload("Visit").
		Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		Preload("FilledBy").
		Preload("FilledBy.Employee").
		Preload("Procedure").
		Preload("Results").
		Preload("Results.Parameter").
		First(&visitProcedure, visitProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit procedure tidak ditemukan"})
		return
	}

	// Check if completed
	if visitProcedure.Status != models.VisitProcedureStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Tindakan belum selesai (status harus completed)",
		})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", visitProcedure.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	visit := visitProcedure.Visit
	if visit == nil || visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}
	patient := visit.Registration.Patient
	doctor := visit.Doctor

	// Get performer (employee who filled the procedure)
	var performer *models.Employee
	if visitProcedure.FilledBy != nil && visitProcedure.FilledBy.Employee != nil {
		performer = visitProcedure.FilledBy.Employee
	}
	if performer == nil {
		performer = doctor
	}

	// Validate prerequisites
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki SatuSehat ID"})
		return
	}
	if doctor == nil || doctor.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter belum memiliki SatuSehat ID"})
		return
	}
	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	results := gin.H{}
	isLab := loincMapping.SnomedCategoryCode == models.SnomedCodeLaboratoryProcedure

	// Step 1: Send ServiceRequest (if not sent)
	if visitProcedure.SatusehatServiceRequestID == "" {
		serviceRequest, err := BuildFHIRServiceRequest(&visitProcedure, visit, patient, doctor, &loincMapping, orgID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal build ServiceRequest: " + err.Error()})
			return
		}

		responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/ServiceRequest", serviceRequest)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ServiceRequest: " + err.Error()})
			return
		}

		if statusCode != http.StatusOK && statusCode != http.StatusCreated {
			var errResp map[string]interface{}
			json.Unmarshal(responseBody, &errResp)
			c.JSON(statusCode, gin.H{"error": "ServiceRequest ditolak", "response": errResp})
			return
		}

		var srResp map[string]interface{}
		json.Unmarshal(responseBody, &srResp)
		if id, ok := srResp["id"].(string); ok {
			visitProcedure.SatusehatServiceRequestID = id
			database.DB.Save(&visitProcedure)
			results["service_request_id"] = id
		}
	} else {
		results["service_request_id"] = visitProcedure.SatusehatServiceRequestID
		results["service_request_note"] = "Already sent"
	}

	// Step 2: Send Specimen (only for lab, if not sent)
	if isLab && loincMapping.SnomedSpecimenCode != "" && visitProcedure.SatusehatSpecimenID == "" {
		specimen, err := BuildFHIRSpecimen(&visitProcedure, patient, performer, &loincMapping, visitProcedure.SatusehatServiceRequestID, orgID)
		if err != nil {
			results["specimen_error"] = err.Error()
		} else {
			responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Specimen", specimen)
			if err != nil {
				results["specimen_error"] = err.Error()
			} else if statusCode == http.StatusOK || statusCode == http.StatusCreated {
				var specResp map[string]interface{}
				json.Unmarshal(responseBody, &specResp)
				if id, ok := specResp["id"].(string); ok {
					visitProcedure.SatusehatSpecimenID = id
					database.DB.Save(&visitProcedure)
					results["specimen_id"] = id
				}
			}
		}
	} else if visitProcedure.SatusehatSpecimenID != "" {
		results["specimen_id"] = visitProcedure.SatusehatSpecimenID
		results["specimen_note"] = "Already sent"
	}

	// Step 3: Send Observations (for lab results)
	var observationIDs []string
	if visitProcedure.SatusehatObservationIDs != "" {
		json.Unmarshal([]byte(visitProcedure.SatusehatObservationIDs), &observationIDs)
	}

	if len(observationIDs) == 0 {
		for _, result := range visitProcedure.Results {
			if result.Value == "" && result.NumValue == 0 {
				continue
			}

			obs, err := BuildFHIRObservationLab(&result, &visitProcedure, visit, patient, performer, visitProcedure.SatusehatSpecimenID, orgID)
			if err != nil {
				continue
			}

			responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Observation", obs)
			if err == nil && (statusCode == http.StatusOK || statusCode == http.StatusCreated) {
				var obsResp map[string]interface{}
				if err := json.Unmarshal(responseBody, &obsResp); err == nil {
					if id, ok := obsResp["id"].(string); ok {
						observationIDs = append(observationIDs, id)
					}
				}
			}
		}

		if len(observationIDs) > 0 {
			obsIDsJSON, _ := json.Marshal(observationIDs)
			visitProcedure.SatusehatObservationIDs = string(obsIDsJSON)
			database.DB.Save(&visitProcedure)
		}
	}
	results["observation_ids"] = observationIDs

	// Step 4: Send DiagnosticReport (if not sent)
	if visitProcedure.SatusehatDiagnosticReportID == "" {
		report, err := BuildFHIRDiagnosticReport(
			&visitProcedure,
			visit,
			patient,
			performer,
			&loincMapping,
			visitProcedure.SatusehatServiceRequestID,
			visitProcedure.SatusehatSpecimenID,
			observationIDs,
			orgID,
			req.Conclusion,
		)
		if err != nil {
			results["diagnostic_report_error"] = err.Error()
		} else {
			responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/DiagnosticReport", report)
			if err != nil {
				results["diagnostic_report_error"] = err.Error()
			} else if statusCode == http.StatusOK || statusCode == http.StatusCreated {
				var drResp map[string]interface{}
				json.Unmarshal(responseBody, &drResp)
				if id, ok := drResp["id"].(string); ok {
					visitProcedure.SatusehatDiagnosticReportID = id
					database.DB.Save(&visitProcedure)
					results["diagnostic_report_id"] = id
				}
			} else {
				var errResp map[string]interface{}
				json.Unmarshal(responseBody, &errResp)
				results["diagnostic_report_error"] = errResp
			}
		}
	} else {
		results["diagnostic_report_id"] = visitProcedure.SatusehatDiagnosticReportID
		results["diagnostic_report_note"] = "Already sent"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Proses pengiriman selesai",
		"results": results,
	})
}
