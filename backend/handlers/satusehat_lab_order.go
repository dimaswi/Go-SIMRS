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
// FHIR Lab/Radiology Resources for ProcedureOrder System
// Handles ServiceRequest, Specimen, DiagnosticReport for procedure_orders
// ============================================================================

// ============================================================================
// Build Functions for ProcedureOrderItem
// ============================================================================

// BuildServiceRequestFromOrderItem creates FHIR ServiceRequest from ProcedureOrderItem
func BuildServiceRequestFromOrderItem(
	item *models.ProcedureOrderItem,
	order *models.ProcedureOrder,
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

	// Build identifier using order number
	identifier := fmt.Sprintf("SR-%s-%d", order.OrderNumber, item.ID)

	authoredOn := order.CreatedAt
	occurrenceTime := time.Now()
	if item.StartedAt != nil {
		occurrenceTime = *item.StartedAt
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
		Priority: mapPriorityToFHIR(order.Priority),
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

	// Add clinical notes as reason if available
	if order.ClinicalNotes != "" {
		serviceRequest.ReasonCode = []FHIRCodeableConcept{
			{
				Text: order.ClinicalNotes,
			},
		}
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

// mapPriorityToFHIR maps order priority to FHIR priority codes
func mapPriorityToFHIR(priority string) string {
	switch priority {
	case "urgent", "cito":
		return "urgent"
	case "stat":
		return "stat"
	case "asap":
		return "asap"
	default:
		return "routine"
	}
}

// BuildSpecimenFromOrderItem creates FHIR Specimen from ProcedureOrderItem
func BuildSpecimenFromOrderItem(
	item *models.ProcedureOrderItem,
	order *models.ProcedureOrder,
	patient *models.Patient,
	collector *models.Employee,
	loincMapping *models.ProcedureLoincMapping,
	serviceRequestID string,
	orgID string,
) (*FHIRSpecimen, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if loincMapping.SnomedSpecimenCode == "" {
		return nil, fmt.Errorf("prosedur belum memiliki mapping specimen SNOMED")
	}

	identifier := fmt.Sprintf("SPEC-%s-%d", order.OrderNumber, item.ID)

	collectedTime := time.Now()
	if item.StartedAt != nil {
		collectedTime = *item.StartedAt
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
		Request: []FHIRReference{
			{
				Reference: "ServiceRequest/" + serviceRequestID,
			},
		},
		Collection: &FHIRSpecimenCollection{
			CollectedDateTime: collectedTime.Format(time.RFC3339),
		},
	}

	if collector != nil && collector.SatuSehatID != "" {
		specimen.Collection.Collector = &FHIRReference{
			Reference: "Practitioner/" + collector.SatuSehatID,
			Display:   collector.NamaLengkap,
		}
	}

	return specimen, nil
}

// BuildObservationFromOrderResult creates FHIR Observation from ProcedureOrderResult
func BuildObservationFromOrderResult(
	result *models.ProcedureOrderResult,
	item *models.ProcedureOrderItem,
	order *models.ProcedureOrder,
	visit *models.Visit,
	patient *models.Patient,
	performer *models.Employee,
	specimenID string,
	loincCode string,
	loincDisplay string,
	orgID string,
) (*FHIRObservationLab, error) {
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}

	param := result.ProcedureParameter
	if param == nil {
		return nil, fmt.Errorf("parameter tidak ditemukan")
	}

	effectiveTime := time.Now()
	if item.CompletedAt != nil {
		effectiveTime = *item.CompletedAt
	}

	observation := &FHIRObservationLab{
		ResourceType: "Observation",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/observation/" + orgID,
				Value:  fmt.Sprintf("OBS-%s-%d", order.OrderNumber, result.ID),
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
					Code:    loincCode,
					Display: loincDisplay,
				},
			},
			Text: param.Name,
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

	if performer != nil && performer.SatuSehatID != "" {
		observation.Performer = []FHIRReference{
			{
				Reference: "Practitioner/" + performer.SatuSehatID,
				Display:   performer.NamaLengkap,
			},
		}
	}

	// Add value
	if result.NumericValue != 0 || param.InputType == "number" {
		observation.ValueQuantity = &FHIRQuantity{
			Value:  result.NumericValue,
			Unit:   param.Unit,
			System: "http://unitsofmeasure.org",
			Code:   param.Unit,
		}
	} else {
		observation.ValueString = result.Value
	}

	// Add interpretation
	if result.IsHigh || result.IsLow || result.IsCritical {
		interpretCode := "N"
		interpretDisplay := "Normal"
		if result.IsHigh {
			interpretCode = "H"
			interpretDisplay = "High"
		} else if result.IsLow {
			interpretCode = "L"
			interpretDisplay = "Low"
		}
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

	// Add reference range
	if param.NormalMin != 0 || param.NormalMax != 0 || param.NormalText != "" {
		refRange := FHIRReferenceRange{}
		if param.NormalMin != 0 {
			refRange.Low = &FHIRQuantity{
				Value:  param.NormalMin,
				Unit:   param.Unit,
				System: "http://unitsofmeasure.org",
			}
		}
		if param.NormalMax != 0 {
			refRange.High = &FHIRQuantity{
				Value:  param.NormalMax,
				Unit:   param.Unit,
				System: "http://unitsofmeasure.org",
			}
		}
		if param.NormalText != "" {
			refRange.Text = param.NormalText
		}
		observation.ReferenceRange = []FHIRReferenceRange{refRange}
	}

	if specimenID != "" {
		observation.Specimen = &FHIRReference{
			Reference: "Specimen/" + specimenID,
		}
	}

	return observation, nil
}

// BuildDiagnosticReportFromOrderItem creates FHIR DiagnosticReport from ProcedureOrderItem
func BuildDiagnosticReportFromOrderItem(
	item *models.ProcedureOrderItem,
	order *models.ProcedureOrder,
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
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID")
	}
	if visit.SatuSehatEncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}
	if len(observationIDs) == 0 {
		return nil, fmt.Errorf("DiagnosticReport harus memiliki minimal 1 Observation (hasil lab)")
	}

	identifier := fmt.Sprintf("DR-%s-%d", order.OrderNumber, item.ID)

	effectiveTime := time.Now()
	if item.CompletedAt != nil {
		effectiveTime = *item.CompletedAt
	}

	categoryCode := "LAB"
	categoryDisplay := "Laboratory"
	if loincMapping.SnomedCategoryCode == models.SnomedCodeImaging {
		categoryCode = "RAD"
		categoryDisplay = "Radiology"
	}

	// Determine identifier system based on category (lab or radiology)
	identifierSystem := "http://sys-ids.kemkes.go.id/diagnostic/" + orgID + "/lab"
	if loincMapping.SnomedCategoryCode == models.SnomedCodeImaging {
		identifierSystem = "http://sys-ids.kemkes.go.id/diagnostic/" + orgID + "/rad"
	}

	report := &FHIRDiagnosticReport{
		ResourceType: "DiagnosticReport",
		Identifier: []FHIRIdentifier{
			{
				System: identifierSystem,
				Use:    "official",
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

	if serviceRequestID != "" {
		report.BasedOn = []FHIRReference{
			{Reference: "ServiceRequest/" + serviceRequestID},
		}
	}

	if performer != nil && performer.SatuSehatID != "" {
		report.Performer = []FHIRReference{
			{Reference: "Practitioner/" + performer.SatuSehatID, Display: performer.NamaLengkap},
			{Reference: "Organization/" + orgID},
		}
	}

	if specimenID != "" {
		report.Specimen = []FHIRReference{
			{Reference: "Specimen/" + specimenID},
		}
	}

	for _, obsID := range observationIDs {
		report.Result = append(report.Result, FHIRReference{
			Reference: "Observation/" + obsID,
		})
	}

	return report, nil
}

// ============================================================================
// API Handlers for ProcedureOrderItem
// ============================================================================

// SendServiceRequestFromOrder sends a lab/radiology order item as FHIR ServiceRequest
// POST /api/v1/satusehat/fhir/servicerequest-order/:orderItemId
func SendServiceRequestFromOrder(c *gin.Context) {
	orderItemID, err := strconv.ParseUint(c.Param("orderItemId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order item tidak valid"})
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

	// Load order item with relations
	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder").
		Preload("ProcedureOrder.SourceVisit").
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("ProcedureOrder.OrderedBy").
		Preload("Procedure").
		First(&item, orderItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order item tidak ditemukan"})
		return
	}

	if item.SatusehatServiceRequestID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "ServiceRequest sudah dikirim",
			"satusehat_id": item.SatusehatServiceRequestID,
		})
		return
	}

	// Get LOINC mapping
	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Prosedur belum memiliki mapping LOINC. Silakan mapping terlebih dahulu di menu Integrasi > LOINC Mapping",
		})
		return
	}

	order := item.ProcedureOrder
	if order == nil || order.SourceVisit == nil || order.SourceVisit.Registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data order tidak lengkap"})
		return
	}

	visit := order.SourceVisit
	patient := visit.Registration.Patient
	doctor := order.OrderedBy

	serviceRequest, err := BuildServiceRequestFromOrderItem(&item, order, visit, patient, doctor, &loincMapping, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/ServiceRequest", serviceRequest)
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

	if satusehatID != "" {
		item.SatusehatServiceRequestID = satusehatID
		database.DB.Save(&item)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "ServiceRequest berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// SendSpecimenFromOrder sends specimen for order item as FHIR Specimen
// POST /api/v1/satusehat/fhir/specimen-order/:orderItemId
func SendSpecimenFromOrder(c *gin.Context) {
	orderItemID, err := strconv.ParseUint(c.Param("orderItemId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order item tidak valid"})
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

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder").
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("PerformedBy").
		Preload("Procedure").
		First(&item, orderItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order item tidak ditemukan"})
		return
	}

	if item.SatusehatServiceRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ServiceRequest belum dikirim. Kirim ServiceRequest terlebih dahulu"})
		return
	}

	if item.SatusehatSpecimenID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "Specimen sudah dikirim",
			"satusehat_id": item.SatusehatSpecimenID,
		})
		return
	}

	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	if loincMapping.SnomedSpecimenCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping specimen SNOMED"})
		return
	}

	order := item.ProcedureOrder
	patient := order.SourceVisit.Registration.Patient
	collector := item.PerformedBy

	specimen, err := BuildSpecimenFromOrderItem(&item, order, patient, collector, &loincMapping, item.SatusehatServiceRequestID, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Specimen", specimen)
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

	if satusehatID != "" {
		item.SatusehatSpecimenID = satusehatID
		database.DB.Save(&item)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Specimen berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// SendDiagnosticReportFromOrder sends diagnostic report for order item as FHIR DiagnosticReport
// POST /api/v1/satusehat/fhir/diagnosticreport-order/:orderItemId
func SendDiagnosticReportFromOrder(c *gin.Context) {
	orderItemID, err := strconv.ParseUint(c.Param("orderItemId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order item tidak valid"})
		return
	}

	var req struct {
		Conclusion string `json:"conclusion"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body
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

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder").
		Preload("ProcedureOrder.SourceVisit").
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("ProcedureOrder.PerformedBy").
		Preload("PerformedBy").
		Preload("Procedure").
		Preload("Results").
		Preload("Results.ProcedureParameter").
		First(&item, orderItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order item tidak ditemukan"})
		return
	}

	if item.SatusehatServiceRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ServiceRequest belum dikirim. Kirim ServiceRequest terlebih dahulu"})
		return
	}

	if item.SatusehatDiagnosticReportID != "" {
		c.JSON(http.StatusConflict, gin.H{
			"error":        "DiagnosticReport sudah dikirim",
			"satusehat_id": item.SatusehatDiagnosticReportID,
		})
		return
	}

	if item.Status != models.ProcedureOrderStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order item belum selesai (status harus completed)"})
		return
	}

	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	order := item.ProcedureOrder
	visit := order.SourceVisit
	patient := visit.Registration.Patient

	performer := item.PerformedBy
	if performer == nil {
		performer = order.PerformedBy
	}

	// Use order's conclusion if request conclusion is empty
	conclusion := req.Conclusion
	if conclusion == "" {
		conclusion = order.Conclusion
	}

	report, err := BuildDiagnosticReportFromOrderItem(
		&item, order, visit, patient, performer, &loincMapping,
		item.SatusehatServiceRequestID, item.SatusehatSpecimenID,
		[]string{}, orgID, conclusion,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/DiagnosticReport", report)
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

	if satusehatID != "" {
		item.SatusehatDiagnosticReportID = satusehatID
		database.DB.Save(&item)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "DiagnosticReport berhasil dikirim ke SatuSehat",
		"satusehat_id": satusehatID,
		"response":     responseData,
	})
}

// SendAllLabResourcesFromOrder sends all lab resources (ServiceRequest, Specimen, DiagnosticReport) in sequence
// POST /api/v1/satusehat/fhir/lab-all-order/:orderItemId
func SendAllLabResourcesFromOrder(c *gin.Context) {
	orderItemID, err := strconv.ParseUint(c.Param("orderItemId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order item tidak valid"})
		return
	}

	var req struct {
		Conclusion string `json:"conclusion"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body
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

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder").
		Preload("ProcedureOrder.SourceVisit").
		Preload("ProcedureOrder.SourceVisit.Registration").
		Preload("ProcedureOrder.SourceVisit.Registration.Patient").
		Preload("ProcedureOrder.OrderedBy").
		Preload("ProcedureOrder.PerformedBy").
		Preload("PerformedBy").
		Preload("Procedure").
		First(&item, orderItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order item tidak ditemukan"})
		return
	}

	// Load results separately to ensure they are loaded
	var labResults []models.ProcedureOrderResult
	database.DB.Where("procedure_order_item_id = ?", item.ID).
		Preload("ProcedureParameter").
		Find(&labResults)
	item.Results = labResults

	log.Printf("Loaded %d results for item %d", len(labResults), item.ID)

	if item.Status != models.ProcedureOrderStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order item belum selesai (status harus completed)"})
		return
	}

	var loincMapping models.ProcedureLoincMapping
	if err := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur belum memiliki mapping LOINC"})
		return
	}

	order := item.ProcedureOrder
	if order == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data order tidak ditemukan"})
		return
	}
	visit := order.SourceVisit
	if visit == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data visit tidak ditemukan"})
		return
	}
	if visit.Registration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data registrasi tidak ditemukan"})
		return
	}
	patient := visit.Registration.Patient
	if patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak ditemukan"})
		return
	}
	doctor := order.OrderedBy
	performer := item.PerformedBy
	if performer == nil {
		performer = order.PerformedBy
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
	// Check if it's laboratory based on procedure type or LOINC mapping
	isLab := item.Procedure != nil && item.Procedure.ProcedureType == "laboratory"
	if !isLab && loincMapping.SnomedCategoryCode == models.SnomedCodeLaboratoryProcedure {
		isLab = true
	}

	// Debug log
	log.Printf("SendAllLabResourcesFromOrder: isLab=%v, Results count=%d, SnomedCategoryCode=%s",
		isLab, len(item.Results), loincMapping.SnomedCategoryCode)

	// Step 1: Send ServiceRequest
	if item.SatusehatServiceRequestID == "" {
		serviceRequest, err := BuildServiceRequestFromOrderItem(&item, order, visit, patient, doctor, &loincMapping, orgID)
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
			item.SatusehatServiceRequestID = id
			database.DB.Save(&item)
			results["service_request_id"] = id
		}
	} else {
		results["service_request_id"] = item.SatusehatServiceRequestID
		results["service_request_note"] = "Already sent"
	}

	// Step 2: Send Specimen (only for lab)
	if isLab && loincMapping.SnomedSpecimenCode != "" && item.SatusehatSpecimenID == "" {
		specimen, err := BuildSpecimenFromOrderItem(&item, order, patient, performer, &loincMapping, item.SatusehatServiceRequestID, orgID)
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
					item.SatusehatSpecimenID = id
					database.DB.Save(&item)
					results["specimen_id"] = id
				}
			}
		}
	} else if item.SatusehatSpecimenID != "" {
		results["specimen_id"] = item.SatusehatSpecimenID
		results["specimen_note"] = "Already sent"
	}

	// Step 3: Send Observations (for lab results)
	var observationIDs []string
	log.Printf("SendAllLabResourcesFromOrder: isLab=%v, Results count=%d", isLab, len(item.Results))

	if isLab && len(item.Results) > 0 {
		for _, result := range item.Results {
			if result.Value == "" && result.NumericValue == 0 {
				log.Printf("Skipping result %d: empty value", result.ID)
				continue
			}

			obs, err := BuildObservationFromOrderResult(&result, &item, order, visit, patient, performer, item.SatusehatSpecimenID, loincMapping.LoincCode, loincMapping.LoincDisplay, orgID)
			if err != nil {
				log.Printf("Failed to build observation for result %d: %v", result.ID, err)
				continue
			}

			responseBody, statusCode, err := SatuSehatFHIRRequest("POST", "/Observation", obs)
			if err != nil {
				log.Printf("Failed to send observation for result %d: %v", result.ID, err)
				continue
			}

			if statusCode == http.StatusOK || statusCode == http.StatusCreated {
				var obsResp map[string]interface{}
				if err := json.Unmarshal(responseBody, &obsResp); err == nil {
					if id, ok := obsResp["id"].(string); ok {
						observationIDs = append(observationIDs, id)
						log.Printf("Observation sent successfully: %s", id)
					}
				}
			} else {
				log.Printf("Observation rejected with status %d: %s", statusCode, string(responseBody))
			}
		}
	} else if len(item.Results) == 0 {
		log.Printf("No results found for item %d - cannot send DiagnosticReport", item.ID)
		results["diagnostic_report_error"] = "Tidak ada hasil lab untuk dikirim. Pastikan hasil lab sudah diisi."
		c.JSON(http.StatusOK, gin.H{
			"message": "Proses pengiriman selesai (partial)",
			"results": results,
		})
		return
	}
	results["observation_ids"] = observationIDs

	// Step 4: Send DiagnosticReport
	if item.SatusehatDiagnosticReportID == "" {
		conclusion := req.Conclusion
		if conclusion == "" {
			conclusion = order.Conclusion
		}

		report, err := BuildDiagnosticReportFromOrderItem(
			&item, order, visit, patient, performer, &loincMapping,
			item.SatusehatServiceRequestID, item.SatusehatSpecimenID,
			observationIDs, orgID, conclusion,
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
					item.SatusehatDiagnosticReportID = id
					database.DB.Save(&item)
					results["diagnostic_report_id"] = id
				}
			} else {
				var errResp map[string]interface{}
				json.Unmarshal(responseBody, &errResp)
				results["diagnostic_report_error"] = errResp
			}
		}
	} else {
		results["diagnostic_report_id"] = item.SatusehatDiagnosticReportID
		results["diagnostic_report_note"] = "Already sent"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Proses pengiriman selesai",
		"results": results,
	})
}

// GetLabResourceStatusFromOrder gets status of lab resources for an order item
// GET /api/v1/satusehat/fhir/lab-status-order/:orderItemId
func GetLabResourceStatusFromOrder(c *gin.Context) {
	orderItemID, err := strconv.ParseUint(c.Param("orderItemId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order item tidak valid"})
		return
	}

	var item models.ProcedureOrderItem
	if err := database.DB.
		Preload("ProcedureOrder").
		Preload("Procedure").
		First(&item, orderItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order item tidak ditemukan"})
		return
	}

	var loincMapping models.ProcedureLoincMapping
	hasLoincMapping := database.DB.Where("procedure_id = ?", item.ProcedureID).First(&loincMapping).Error == nil

	c.JSON(http.StatusOK, gin.H{
		"id":                item.ID,
		"procedure_code":    item.Procedure.Code,
		"procedure_name":    item.Procedure.Name,
		"procedure_type":    item.Procedure.ProcedureType,
		"status":            item.Status,
		"has_loinc_mapping": hasLoincMapping,
		"loinc_code":        loincMapping.LoincCode,
		"loinc_display":     loincMapping.LoincDisplay,
		"servicerequest": gin.H{
			"sent": item.SatusehatServiceRequestID != "",
			"id":   item.SatusehatServiceRequestID,
		},
		"specimen": gin.H{
			"sent": item.SatusehatSpecimenID != "",
			"id":   item.SatusehatSpecimenID,
		},
		"diagnosticreport": gin.H{
			"sent": item.SatusehatDiagnosticReportID != "",
			"id":   item.SatusehatDiagnosticReportID,
		},
	})
}
