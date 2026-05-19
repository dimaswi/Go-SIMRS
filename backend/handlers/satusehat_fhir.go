package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// FHIR R4 Resource Structures for SatuSehat
// Reference: https://satusehat.kemkes.go.id/platform/docs/id/playbook
// ============================================================================

// FHIRCoding represents FHIR coding element
type FHIRCoding struct {
	System  string `json:"system"`
	Code    string `json:"code"`
	Display string `json:"display,omitempty"`
}

// FHIRCodeableConcept represents FHIR codeable concept
type FHIRCodeableConcept struct {
	Coding []FHIRCoding `json:"coding"`
	Text   string       `json:"text,omitempty"`
}

// FHIRIdentifier represents FHIR identifier
type FHIRIdentifier struct {
	System string `json:"system"`
	Value  string `json:"value"`
	Use    string `json:"use,omitempty"`
}

// FHIRReference represents FHIR reference
type FHIRReference struct {
	Reference string `json:"reference"`
	Display   string `json:"display,omitempty"`
}

// FHIRPeriod represents FHIR period
type FHIRPeriod struct {
	Start string `json:"start,omitempty"`
	End   string `json:"end,omitempty"`
}

// FHIRQuantity represents FHIR quantity
type FHIRQuantity struct {
	Value  float64 `json:"value"`
	Unit   string  `json:"unit"`
	System string  `json:"system,omitempty"`
	Code   string  `json:"code,omitempty"`
}

// ============================================================================
// FHIR Location Resource
// ============================================================================

// FHIRLocation represents FHIR Location resource
type FHIRLocation struct {
	ResourceType         string               `json:"resourceType"`
	Identifier           []FHIRIdentifier     `json:"identifier,omitempty"`
	Status               string               `json:"status"`
	Name                 string               `json:"name"`
	Description          string               `json:"description,omitempty"`
	Mode                 string               `json:"mode,omitempty"`
	PhysicalType         *FHIRCodeableConcept `json:"physicalType,omitempty"`
	ManagingOrganization *FHIRReference       `json:"managingOrganization,omitempty"`
	Telecom              []FHIRContactPoint   `json:"telecom,omitempty"`
}

// FHIRContactPoint represents FHIR ContactPoint element
type FHIRContactPoint struct {
	System string `json:"system,omitempty"` // phone, email, url
	Value  string `json:"value,omitempty"`
	Use    string `json:"use,omitempty"` // home, work, mobile
}

// BuildFHIRLocation creates FHIR Location resource from Room
func BuildFHIRLocation(room *models.Room, orgID string) *FHIRLocation {
	// Map room type to FHIR physical type
	physicalTypeCode := "ro" // room
	physicalTypeDisplay := "Room"

	switch room.RoomType {
	case "poliklinik":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	case "rawat_inap":
		physicalTypeCode = "wa"
		physicalTypeDisplay = "Ward"
	case "icu", "nicu", "picu", "iccu":
		physicalTypeCode = "wa"
		physicalTypeDisplay = "Ward"
	case "ugd":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	case "laboratorium":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	case "radiologi":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	case "farmasi":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	case "operasi":
		physicalTypeCode = "ro"
		physicalTypeDisplay = "Room"
	}

	location := &FHIRLocation{
		ResourceType: "Location",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/location/" + orgID,
				Value:  room.Code,
			},
		},
		Status:      "active",
		Name:        room.Name,
		Description: room.Description,
		Mode:        "instance",
		PhysicalType: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/location-physical-type",
					Code:    physicalTypeCode,
					Display: physicalTypeDisplay,
				},
			},
		},
		ManagingOrganization: &FHIRReference{
			Reference: "Organization/" + orgID,
		},
	}

	return location
}

// ============================================================================
// FHIR Encounter Resource
// Referensi: Postman Collection SatuSehat - Pelayanan Rawat Jalan V6.1
// ============================================================================

// FHIRExtension represents FHIR extension element
type FHIRExtension struct {
	URL                  string               `json:"url"`
	ValueCodeableConcept *FHIRCodeableConcept `json:"valueCodeableConcept,omitempty"`
	Extension            []FHIRExtension      `json:"extension,omitempty"`
}

// FHIREncounterParticipant represents encounter participant
type FHIREncounterParticipant struct {
	Type       []FHIRCodeableConcept `json:"type,omitempty"`
	Individual *FHIRReference        `json:"individual,omitempty"`
}

// FHIREncounterLocation represents encounter location with ServiceClass extension
type FHIREncounterLocation struct {
	Location  *FHIRReference  `json:"location"`
	Period    *FHIRPeriod     `json:"period,omitempty"`
	Extension []FHIRExtension `json:"extension,omitempty"`
}

// FHIREncounterStatusHistory represents status history
type FHIREncounterStatusHistory struct {
	Status string      `json:"status"`
	Period *FHIRPeriod `json:"period"`
}

// FHIREncounterDiagnosis represents diagnosis reference in Encounter
type FHIREncounterDiagnosis struct {
	Condition *FHIRReference       `json:"condition"`
	Use       *FHIRCodeableConcept `json:"use,omitempty"`
	Rank      int                  `json:"rank,omitempty"`
}

// FHIRHospitalization represents hospitalization details (WAJIB untuk status finished)
type FHIRHospitalization struct {
	AdmitSource          *FHIRCodeableConcept `json:"admitSource,omitempty"`
	DischargeDisposition *FHIRCodeableConcept `json:"dischargeDisposition,omitempty"`
}

// FHIREncounter represents FHIR Encounter resource sesuai standar SatuSehat
type FHIREncounter struct {
	ResourceType    string                       `json:"resourceType"`
	ID              string                       `json:"id,omitempty"` // Untuk PUT request
	Identifier      []FHIRIdentifier             `json:"identifier,omitempty"`
	Status          string                       `json:"status"`
	Class           *FHIRCoding                  `json:"class"`
	Subject         *FHIRReference               `json:"subject"`
	Participant     []FHIREncounterParticipant   `json:"participant,omitempty"`
	Period          *FHIRPeriod                  `json:"period,omitempty"`
	Location        []FHIREncounterLocation      `json:"location,omitempty"`
	Diagnosis       []FHIREncounterDiagnosis     `json:"diagnosis,omitempty"`
	Hospitalization *FHIRHospitalization         `json:"hospitalization,omitempty"`
	ServiceProvider *FHIRReference               `json:"serviceProvider,omitempty"`
	StatusHistory   []FHIREncounterStatusHistory `json:"statusHistory,omitempty"`
}

// BuildFHIREncounterParams contains parameters for building FHIR Encounter
type BuildFHIREncounterParams struct {
	Visit       *models.Visit
	Patient     *models.Patient
	Doctor      *models.Employee
	Room        *models.Room
	OrgID       string
	EncounterID string // Untuk PUT request - jika sudah ada Encounter ID dari SatuSehat
	Status      string // Override status: arrived, in-progress, finished
}

// BuildFHIREncounter creates FHIR Encounter resource from Visit
// Untuk alur yang benar: POST (status arrived) → PUT (status finished dengan diagnosis)
func BuildFHIREncounter(visit *models.Visit, patient *models.Patient, doctor *models.Employee, room *models.Room, orgID string) (*FHIREncounter, error) {
	params := BuildFHIREncounterParams{
		Visit:   visit,
		Patient: patient,
		Doctor:  doctor,
		Room:    room,
		OrgID:   orgID,
	}
	return BuildFHIREncounterWithParams(params)
}

// BuildFHIREncounterWithParams creates FHIR Encounter dengan parameter lengkap
func BuildFHIREncounterWithParams(params BuildFHIREncounterParams) (*FHIREncounter, error) {
	visit := params.Visit
	patient := params.Patient
	doctor := params.Doctor
	room := params.Room
	orgID := params.OrgID

	// Validate required SatuSehat IDs
	if patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki SatuSehat ID (IHS Number)")
	}

	// Validate practitioner IHS - required by SatuSehat
	if doctor == nil || doctor.SatuSehatID == "" {
		return nil, fmt.Errorf("dokter/practitioner belum memiliki SatuSehat ID (IHS Number). Silakan lookup IHS Number dokter terlebih dahulu")
	}

	// Determine encounter class based on visit type
	classCode := "AMB"
	classDisplay := "ambulatory"

	switch visit.VisitType {
	case models.VisitTypeInpatient:
		classCode = "IMP"
		classDisplay = "inpatient encounter"
	case models.VisitTypeEmergency:
		classCode = "EMER"
		classDisplay = "emergency"
	case models.VisitTypeOutpatient, models.VisitTypeConsultation:
		classCode = "AMB"
		classDisplay = "ambulatory"
	}

	// Determine status - use override if provided, else from visit status
	fhirStatus := params.Status
	if fhirStatus == "" {
		switch visit.Status {
		case models.VisitStatusWaiting, models.VisitStatusInQueue:
			fhirStatus = "arrived" // Gunakan arrived bukan planned untuk SatuSehat
		case models.VisitStatusInProgress:
			fhirStatus = "in-progress"
		case models.VisitStatusCompleted:
			fhirStatus = "finished"
		case models.VisitStatusCancelled:
			fhirStatus = "cancelled"
		default:
			fhirStatus = "arrived"
		}
	}

	// Set times
	checkInTime := time.Now()
	if visit.CheckInTime != nil {
		checkInTime = *visit.CheckInTime
	}

	endTime := time.Now()
	if visit.EndTime != nil {
		endTime = *visit.EndTime
	}

	encounter := &FHIREncounter{
		ResourceType: "Encounter",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/encounter/" + orgID,
				Value:  visit.VisitNumber,
			},
		},
		Status: fhirStatus,
		Class: &FHIRCoding{
			System:  "http://terminology.hl7.org/CodeSystem/v3-ActCode",
			Code:    classCode,
			Display: classDisplay,
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patient.SatuSehatID,
			Display:   patient.NamaLengkap,
		},
		ServiceProvider: &FHIRReference{
			Reference: "Organization/" + orgID,
		},
		Participant: []FHIREncounterParticipant{
			{
				Type: []FHIRCodeableConcept{
					{
						Coding: []FHIRCoding{
							{
								System:  "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
								Code:    "ATND",
								Display: "attender",
							},
						},
					},
				},
				Individual: &FHIRReference{
					Reference: "Practitioner/" + doctor.SatuSehatID,
					Display:   doctor.NamaLengkap,
				},
			},
		},
	}

	// Add Encounter ID untuk PUT request
	if params.EncounterID != "" {
		encounter.ID = params.EncounterID
	}

	// Add period
	encounter.Period = &FHIRPeriod{
		Start: checkInTime.Format(time.RFC3339),
	}
	if fhirStatus == "finished" {
		encounter.Period.End = endTime.Format(time.RFC3339)
	}

	// Add location with ServiceClass extension
	if room != nil && room.SatuSehatID != "" {
		locationEntry := FHIREncounterLocation{
			Location: &FHIRReference{
				Reference: "Location/" + room.SatuSehatID,
				Display:   room.Name,
			},
		}

		// Add period for location
		if fhirStatus == "finished" {
			locationEntry.Period = &FHIRPeriod{
				Start: checkInTime.Format(time.RFC3339),
				End:   endTime.Format(time.RFC3339),
			}
		} else {
			locationEntry.Period = &FHIRPeriod{
				Start: checkInTime.Format(time.RFC3339),
			}
		}

		// Add ServiceClass extension sesuai dokumentasi
		serviceClassSystem := "http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Outpatient"
		serviceClassCode := "reguler"
		serviceClassDisplay := "Kelas Reguler"

		if classCode == "IMP" { // Inpatient
			serviceClassSystem = "http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Inpatient"
			serviceClassCode = "3"
			serviceClassDisplay = "Kelas 3"
		}

		locationEntry.Extension = []FHIRExtension{
			{
				URL: "https://fhir.kemkes.go.id/r4/StructureDefinition/ServiceClass",
				Extension: []FHIRExtension{
					{
						URL: "value",
						ValueCodeableConcept: &FHIRCodeableConcept{
							Coding: []FHIRCoding{
								{
									System:  serviceClassSystem,
									Code:    serviceClassCode,
									Display: serviceClassDisplay,
								},
							},
						},
					},
				},
			},
		}

		encounter.Location = []FHIREncounterLocation{locationEntry}
	}

	// Add statusHistory - WAJIB untuk SatuSehat
	switch fhirStatus {
	case "arrived":
		encounter.StatusHistory = []FHIREncounterStatusHistory{
			{
				Status: "arrived",
				Period: &FHIRPeriod{
					Start: checkInTime.Format(time.RFC3339),
				},
			},
		}
	case "in-progress":
		encounter.StatusHistory = []FHIREncounterStatusHistory{
			{
				Status: "arrived",
				Period: &FHIRPeriod{
					Start: checkInTime.Format(time.RFC3339),
					End:   checkInTime.Add(5 * time.Minute).Format(time.RFC3339),
				},
			},
			{
				Status: "in-progress",
				Period: &FHIRPeriod{
					Start: checkInTime.Add(5 * time.Minute).Format(time.RFC3339),
				},
			},
		}
	case "finished":
		encounter.StatusHistory = []FHIREncounterStatusHistory{
			{
				Status: "arrived",
				Period: &FHIRPeriod{
					Start: checkInTime.Format(time.RFC3339),
					End:   checkInTime.Add(5 * time.Minute).Format(time.RFC3339),
				},
			},
			{
				Status: "in-progress",
				Period: &FHIRPeriod{
					Start: checkInTime.Add(5 * time.Minute).Format(time.RFC3339),
					End:   endTime.Format(time.RFC3339),
				},
			},
			{
				Status: "finished",
				Period: &FHIRPeriod{
					Start: endTime.Format(time.RFC3339),
					End:   endTime.Format(time.RFC3339),
				},
			},
		}

		// Add hospitalization dengan dischargeDisposition - WAJIB untuk status finished
		encounter.Hospitalization = &FHIRHospitalization{
			DischargeDisposition: &FHIRCodeableConcept{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/discharge-disposition",
						Code:    "home",
						Display: "Home",
					},
				},
			},
		}
	}

	return encounter, nil
}

// AddDiagnosisToEncounter adds diagnosis references to an existing Encounter
func AddDiagnosisToEncounter(encounter *FHIREncounter, diagnoses []models.Diagnosis) {
	if len(diagnoses) == 0 {
		return
	}

	encounter.Diagnosis = []FHIREncounterDiagnosis{}
	rank := 1

	for _, diag := range diagnoses {
		// Skip if not sent to SatuSehat yet
		if diag.SatuSehatConditionID == "" {
			continue
		}

		// Determine diagnosis role based on type
		roleCode := "DD" // Discharge diagnosis (default for primary)
		roleDisplay := "Discharge diagnosis"

		switch diag.Type {
		case "primary":
			roleCode = "DD"
			roleDisplay = "Discharge diagnosis"
		case "secondary":
			roleCode = "CC"
			roleDisplay = "Chief complaint"
		case "complication":
			roleCode = "CM"
			roleDisplay = "Comorbidity diagnosis"
		}

		diagRef := FHIREncounterDiagnosis{
			Condition: &FHIRReference{
				Reference: "Condition/" + diag.SatuSehatConditionID,
				Display:   diag.ICD10Code + " - " + diag.ICD10Name,
			},
			Use: &FHIRCodeableConcept{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/diagnosis-role",
						Code:    roleCode,
						Display: roleDisplay,
					},
				},
			},
			Rank: rank,
		}

		encounter.Diagnosis = append(encounter.Diagnosis, diagRef)
		rank++
	}
}

// ============================================================================
// FHIR Condition Resource (Diagnosis)
// Referensi: Postman Collection SatuSehat - Pelayanan Rawat Jalan V6.1
// ============================================================================

// FHIRCondition represents FHIR Condition resource sesuai standar SatuSehat
type FHIRCondition struct {
	ResourceType       string                `json:"resourceType"`
	Identifier         []FHIRIdentifier      `json:"identifier,omitempty"`
	ClinicalStatus     *FHIRCodeableConcept  `json:"clinicalStatus"`
	VerificationStatus *FHIRCodeableConcept  `json:"verificationStatus,omitempty"`
	Category           []FHIRCodeableConcept `json:"category"`
	Code               *FHIRCodeableConcept  `json:"code"`
	Subject            *FHIRReference        `json:"subject"`
	Encounter          *FHIRReference        `json:"encounter,omitempty"`
	OnsetDateTime      string                `json:"onsetDateTime,omitempty"`
	RecordedDate       string                `json:"recordedDate,omitempty"`
	Recorder           *FHIRReference        `json:"recorder,omitempty"`
}

// BuildFHIRConditionParams contains parameters for building FHIR Condition
type BuildFHIRConditionParams struct {
	OrgID            string
	RegistrationID   string
	Sequence         int
	ICDCode          string
	ICDDisplay       string
	PatientIHS       string
	PatientName      string
	EncounterID      string
	PractitionerIHS  string
	PractitionerName string
	IsPrimary        bool
	OnsetDate        *time.Time
}

// BuildFHIRCondition creates FHIR Condition resource sesuai standar SatuSehat
// Referensi: docs/SATUSEHAT-API-Documentation.md Section 7
func BuildFHIRCondition(params BuildFHIRConditionParams) *FHIRCondition {
	// Generate unique identifier
	identifierValue := fmt.Sprintf("%s_COND%03d", params.RegistrationID, params.Sequence)

	condition := &FHIRCondition{
		ResourceType: "Condition",
		Identifier: []FHIRIdentifier{
			{
				System: "http://sys-ids.kemkes.go.id/condition/" + params.OrgID,
				Value:  identifierValue,
			},
		},
		ClinicalStatus: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/condition-clinical",
					Code:    "active",
					Display: "Active",
				},
			},
		},
		VerificationStatus: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/condition-ver-status",
					Code:    "confirmed",
					Display: "Confirmed",
				},
			},
		},
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/condition-category",
						Code:    "encounter-diagnosis",
						Display: "Encounter Diagnosis",
					},
				},
			},
		},
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://hl7.org/fhir/sid/icd-10",
					Code:    params.ICDCode,
					Display: params.ICDDisplay,
				},
			},
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + params.PatientIHS,
			Display:   params.PatientName,
		},
		RecordedDate: time.Now().Format(time.RFC3339),
	}

	// Add encounter reference jika sudah ada Encounter ID
	if params.EncounterID != "" {
		condition.Encounter = &FHIRReference{
			Reference: "Encounter/" + params.EncounterID,
		}
	}

	// Add recorder (practitioner yang mencatat diagnosis)
	if params.PractitionerIHS != "" {
		condition.Recorder = &FHIRReference{
			Reference: "Practitioner/" + params.PractitionerIHS,
			Display:   params.PractitionerName,
		}
	}

	// Add onset date jika ada
	if params.OnsetDate != nil {
		condition.OnsetDateTime = params.OnsetDate.Format(time.RFC3339)
	}

	return condition
}

// ============================================================================
// FHIR Observation Resource (Vital Signs, Lab Results)
// ============================================================================

// FHIRObservation represents FHIR Observation resource
type FHIRObservation struct {
	ResourceType      string                `json:"resourceType"`
	Status            string                `json:"status"`
	Category          []FHIRCodeableConcept `json:"category"`
	Code              *FHIRCodeableConcept  `json:"code"`
	Subject           *FHIRReference        `json:"subject"`
	Encounter         *FHIRReference        `json:"encounter"`
	Performer         []FHIRReference       `json:"performer,omitempty"`
	EffectiveDateTime string                `json:"effectiveDateTime,omitempty"`
	ValueQuantity     *FHIRQuantity         `json:"valueQuantity,omitempty"`
	ValueString       string                `json:"valueString,omitempty"`
}

// VitalSignCode represents vital sign LOINC codes
type VitalSignCode struct {
	Code    string
	Display string
	Unit    string
}

// Common vital sign LOINC codes
var VitalSignCodes = map[string]VitalSignCode{
	"heart_rate":        {Code: "8867-4", Display: "Heart rate", Unit: "/min"},
	"respiratory_rate":  {Code: "9279-1", Display: "Respiratory rate", Unit: "/min"},
	"temperature":       {Code: "8310-5", Display: "Body temperature", Unit: "Cel"},
	"systolic":          {Code: "8480-6", Display: "Systolic blood pressure", Unit: "mm[Hg]"},
	"diastolic":         {Code: "8462-4", Display: "Diastolic blood pressure", Unit: "mm[Hg]"},
	"oxygen_saturation": {Code: "2708-6", Display: "Oxygen saturation", Unit: "%"},
	"body_weight":       {Code: "29463-7", Display: "Body weight", Unit: "kg"},
	"body_height":       {Code: "8302-2", Display: "Body height", Unit: "cm"},
}

// BuildFHIRObservation creates FHIR Observation resource for vital signs
func BuildFHIRObservation(vitalType string, value float64, patientIHS, encounterID, practitionerIHS string, effectiveTime *time.Time) *FHIRObservation {
	vitalCode, ok := VitalSignCodes[vitalType]
	if !ok {
		vitalCode = VitalSignCode{Code: "unknown", Display: vitalType, Unit: ""}
	}

	observation := &FHIRObservation{
		ResourceType: "Observation",
		Status:       "final",
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/observation-category",
						Code:    "vital-signs",
						Display: "Vital Signs",
					},
				},
			},
		},
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    vitalCode.Code,
					Display: vitalCode.Display,
				},
			},
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patientIHS,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + encounterID,
		},
		ValueQuantity: &FHIRQuantity{
			Value:  value,
			Unit:   vitalCode.Unit,
			System: "http://unitsofmeasure.org",
			Code:   vitalCode.Unit,
		},
	}

	// Add performer if practitioner IHS is provided
	if practitionerIHS != "" {
		observation.Performer = []FHIRReference{
			{
				Reference: "Practitioner/" + practitionerIHS,
			},
		}
	}

	if effectiveTime != nil {
		observation.EffectiveDateTime = effectiveTime.Format(time.RFC3339)
	} else {
		observation.EffectiveDateTime = time.Now().Format(time.RFC3339)
	}

	return observation
}

// ============================================================================
// API Handlers for Sending Data to SatuSehat
// ============================================================================

// LookupPatientIHS looks up patient IHS number from SatuSehat by NIK
func LookupPatientIHS(c *gin.Context) {
	patientID := c.Param("id")

	var patient models.Patient
	if err := database.DB.First(&patient, patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	if patient.NIK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK pasien belum diisi"})
		return
	}

	// Call SatuSehat API to lookup patient
	endpoint := "/Patient?identifier=https://fhir.kemkes.go.id/id/nik|" + patient.NIK
	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	// Parse response to get IHS number
	var bundle map[string]interface{}
	json.Unmarshal(body, &bundle)

	total := 0
	if t, ok := bundle["total"].(float64); ok {
		total = int(t)
	}

	if total == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Pasien tidak ditemukan di SatuSehat",
			"message": "NIK " + patient.NIK + " tidak terdaftar di SatuSehat",
		})
		return
	}

	// Extract IHS number from first entry
	var ihsNumber string
	var patientName string
	if entries, ok := bundle["entry"].([]interface{}); ok && len(entries) > 0 {
		if entry, ok := entries[0].(map[string]interface{}); ok {
			if resource, ok := entry["resource"].(map[string]interface{}); ok {
				if id, ok := resource["id"].(string); ok {
					ihsNumber = id
				}
				if names, ok := resource["name"].([]interface{}); ok && len(names) > 0 {
					if name, ok := names[0].(map[string]interface{}); ok {
						if text, ok := name["text"].(string); ok {
							patientName = text
						}
					}
				}
			}
		}
	}

	if ihsNumber == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parsing IHS Number dari response"})
		return
	}

	// Update patient with IHS number
	patient.SatuSehatID = ihsNumber
	if err := database.DB.Save(&patient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan IHS Number"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "IHS Number berhasil ditemukan dan disimpan",
		"patient_id":     patient.ID,
		"nik":            patient.NIK,
		"nama_lokal":     patient.NamaLengkap,
		"nama_satusehat": patientName,
		"satusehat_id":   ihsNumber,
	})
}

// LookupPractitionerIHS looks up practitioner IHS number from SatuSehat by NIK
func LookupPractitionerIHS(c *gin.Context) {
	employeeID := c.Param("id")

	var employee models.Employee
	if err := database.DB.First(&employee, employeeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}

	if employee.NIK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIK karyawan belum diisi"})
		return
	}

	// Langsung lookup ke SatuSehat berdasarkan NIK
	// SatuSehat akan mengembalikan data jika NIK terdaftar sebagai tenaga kesehatan
	// Call SatuSehat API to lookup practitioner
	endpoint := "/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|" + employee.NIK
	body, statusCode, err := SatuSehatFHIRRequest("GET", endpoint, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 {
		c.JSON(statusCode, gin.H{"error": string(body)})
		return
	}

	// Parse response
	var bundle map[string]interface{}
	json.Unmarshal(body, &bundle)

	total := 0
	if t, ok := bundle["total"].(float64); ok {
		total = int(t)
	}

	if total == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Practitioner tidak ditemukan di SatuSehat",
			"message": "NIK " + employee.NIK + " tidak terdaftar sebagai tenaga kesehatan di SatuSehat",
		})
		return
	}

	// Extract IHS number
	var ihsNumber string
	var practitionerName string
	if entries, ok := bundle["entry"].([]interface{}); ok && len(entries) > 0 {
		if entry, ok := entries[0].(map[string]interface{}); ok {
			if resource, ok := entry["resource"].(map[string]interface{}); ok {
				if id, ok := resource["id"].(string); ok {
					ihsNumber = id
				}
				if names, ok := resource["name"].([]interface{}); ok && len(names) > 0 {
					if name, ok := names[0].(map[string]interface{}); ok {
						if text, ok := name["text"].(string); ok {
							practitionerName = text
						}
					}
				}
			}
		}
	}

	if ihsNumber == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parsing IHS Number dari response"})
		return
	}

	// Update employee with IHS number
	employee.SatuSehatID = ihsNumber
	if err := database.DB.Save(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan IHS Number"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "IHS Number berhasil ditemukan dan disimpan",
		"employee_id":    employee.ID,
		"nik":            employee.NIK,
		"nama_lokal":     employee.NamaLengkap,
		"nama_satusehat": practitionerName,
		"satusehat_id":   ihsNumber,
	})
}

// SendLocationToSatuSehat sends a room/location to SatuSehat
func SendLocationToSatuSehat(c *gin.Context) {
	roomID := c.Param("id")

	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Get organization ID
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Build FHIR Location
	location := BuildFHIRLocation(&room, orgID)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Location", location)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Parse response
	var response map[string]interface{}
	json.Unmarshal(body, &response)

	locationID := ""
	isDuplicate := false

	// Check if duplicate from response body (code: "duplicate" in issue)
	if issues, ok := response["issue"].([]interface{}); ok {
		for _, issue := range issues {
			if issueMap, ok := issue.(map[string]interface{}); ok {
				if code, ok := issueMap["code"].(string); ok && code == "duplicate" {
					isDuplicate = true
					fmt.Printf("[SendLocation] Duplicate detected from response body\n")
					break
				}
			}
		}
	}

	// Also check status codes that indicate duplicate
	if statusCode == 409 || statusCode == 422 {
		isDuplicate = true
		fmt.Printf("[SendLocation] Duplicate detected from status code %d\n", statusCode)
	}

	// Handle based on result
	if statusCode == 200 || statusCode == 201 {
		// Success - extract ID from response
		if id, ok := response["id"].(string); ok {
			locationID = id
		} else if resource, ok := response["resource"].(map[string]interface{}); ok {
			if id, ok := resource["id"].(string); ok {
				locationID = id
			}
		}
		fmt.Printf("[SendLocation] Success, locationID=%s\n", locationID)
	} else if isDuplicate {
		// Duplicate - search for existing location
		fmt.Printf("[SendLocation] Searching for existing location with code=%s\n", room.Code)
		searchURL := fmt.Sprintf("/Location?identifier=http://sys-ids.kemkes.go.id/location/%s|%s", orgID, room.Code)
		searchBody, searchStatus, searchErr := SatuSehatFHIRRequest("GET", searchURL, nil)
		fmt.Printf("[SendLocation] Search result: status=%d, err=%v\n", searchStatus, searchErr)

		if searchStatus == 200 && searchErr == nil {
			var searchResult map[string]interface{}
			if json.Unmarshal(searchBody, &searchResult) == nil {
				if total, ok := searchResult["total"].(float64); ok {
					fmt.Printf("[SendLocation] Search found %v entries\n", total)
				}
				if entries, ok := searchResult["entry"].([]interface{}); ok && len(entries) > 0 {
					if entry, ok := entries[0].(map[string]interface{}); ok {
						if resource, ok := entry["resource"].(map[string]interface{}); ok {
							if id, ok := resource["id"].(string); ok {
								locationID = id
								fmt.Printf("[SendLocation] Found existing locationID=%s\n", locationID)
							}
						}
					}
				}
			}
		}
	} else {
		// Real error - not duplicate, not success
		fmt.Printf("[SendLocation] Real error, status=%d\n", statusCode)
		c.JSON(statusCode, gin.H{
			"error":    "Gagal mengirim Location ke SatuSehat",
			"response": response,
		})
		return
	}

	// If still no ID found, use timestamp marker for duplicate
	if locationID == "" && isDuplicate {
		locationID = fmt.Sprintf("DUPLICATE-%d", time.Now().Unix())
		fmt.Printf("[SendLocation] Using fallback locationID=%s\n", locationID)
	}

	// Must have locationID to update
	if locationID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "Tidak dapat mendapatkan Location ID dari SatuSehat",
			"response": response,
		})
		return
	}

	// Save to database using direct SQL update
	result := database.DB.Exec("UPDATE rooms SET satu_sehat_id = ?, updated_at = ? WHERE id = ?", locationID, time.Now(), room.ID)
	if result.Error != nil {
		fmt.Printf("[SendLocation] DB Error: %v\n", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Gagal update database: %v", result.Error),
		})
		return
	}
	fmt.Printf("[SendLocation] DB Updated room %d, satu_sehat_id='%s', rows=%d\n", room.ID, locationID, result.RowsAffected)

	message := "Location berhasil dikirim ke SatuSehat"
	if isDuplicate {
		message = "Location sudah ada di SatuSehat (duplicate), database diupdate"
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      message,
		"room_id":      room.ID,
		"room_name":    room.Name,
		"satusehat_id": locationID,
		"is_duplicate": isDuplicate,
		"response":     response,
		"status_code":  statusCode,
	})
}

// SendEncounterToSatuSehat sends a visit/encounter to SatuSehat
func SendEncounterToSatuSehat(c *gin.Context) {
	visitID := c.Param("id")
	id, _ := strconv.ParseUint(visitID, 10, 32)

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").Preload("Room").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Get organization ID
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Validate patient
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Pasien belum memiliki IHS Number",
			"message": "Silakan lookup IHS Number pasien terlebih dahulu",
		})
		return
	}

	// Build FHIR Encounter
	encounter, err := BuildFHIREncounter(&visit, patient, visit.Doctor, visit.Room, orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Encounter", encounter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 && statusCode != 201 {
		// Update sync status to failed
		visit.SatuSehatSyncStatus = "failed"
		database.DB.Save(&visit)

		// Parse error response from SatuSehat
		var errorResponse map[string]interface{}
		if err := json.Unmarshal(body, &errorResponse); err != nil {
			// If not JSON, use raw string
			errorResponse = map[string]interface{}{
				"raw": string(body),
			}
		}

		// Extract issue details if available (FHIR OperationOutcome format)
		var issueDetails []string
		if issues, ok := errorResponse["issue"].([]interface{}); ok {
			for _, issue := range issues {
				if issueMap, ok := issue.(map[string]interface{}); ok {
					detail := ""
					if severity, ok := issueMap["severity"].(string); ok {
						detail += "[" + severity + "] "
					}
					if code, ok := issueMap["code"].(string); ok {
						detail += code + ": "
					}
					if diagnostics, ok := issueMap["diagnostics"].(string); ok {
						detail += diagnostics
					}
					if detail != "" {
						issueDetails = append(issueDetails, detail)
					}
				}
			}
		}

		errorMessage := "Gagal mengirim Encounter ke SatuSehat"
		if len(issueDetails) > 0 {
			errorMessage = issueDetails[0]
		}

		c.JSON(statusCode, gin.H{
			"error":              errorMessage,
			"status_code":        statusCode,
			"issue_details":      issueDetails,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var response map[string]interface{}
	json.Unmarshal(body, &response)

	encounterID := ""
	if id, ok := response["id"].(string); ok {
		encounterID = id
	}

	// Update visit with SatuSehat data
	now := time.Now()
	visit.SatuSehatEncounterID = encounterID
	visit.SatuSehatSentAt = &now
	visit.SatuSehatSyncStatus = "sent"
	database.DB.Save(&visit)

	c.JSON(http.StatusOK, gin.H{
		"message":                "Encounter berhasil dikirim ke SatuSehat",
		"visit_id":               visit.ID,
		"visit_number":           visit.VisitNumber,
		"satusehat_encounter_id": encounterID,
		"response":               response,
	})
}

// GetSatuSehatReadiness checks what data is ready to be sent to SatuSehat
func GetSatuSehatReadiness(c *gin.Context) {
	// Count patients with/without IHS
	var patientsTotal, patientsWithIHS int64
	database.DB.Model(&models.Patient{}).Count(&patientsTotal)
	database.DB.Model(&models.Patient{}).Where("satu_sehat_id IS NOT NULL AND satu_sehat_id != ''").Count(&patientsWithIHS)

	// Count doctors with/without IHS - sekarang semua karyawan
	var doctorsTotal, doctorsWithIHS int64
	database.DB.Model(&models.Employee{}).Count(&doctorsTotal)
	database.DB.Model(&models.Employee{}).Where("satu_sehat_id IS NOT NULL AND satu_sehat_id != ''").Count(&doctorsWithIHS)

	// Count rooms with/without SatuSehat ID - use GORM for proper soft delete handling
	// Count rooms - debug dengan berbagai cara
	var roomsTotal, roomsWithSS int64
	database.DB.Model(&models.Room{}).Where("is_active = ?", true).Count(&roomsTotal)

	// Coba query dengan GORM field name (SatuSehatID) bukan column name
	var roomsWithSSList []models.Room
	database.DB.Where("is_active = ?", true).Find(&roomsWithSSList)
	for _, r := range roomsWithSSList {
		if r.SatuSehatID != "" {
			roomsWithSS++
		}
	}

	// Debug: log actual counts
	fmt.Printf("[SatuSehat Readiness] Rooms Total: %d, Rooms with SatuSehat ID: %d\n", roomsTotal, roomsWithSS)
	fmt.Printf("[SatuSehat Readiness] Sample rooms with SS:\n")
	for i, r := range roomsWithSSList {
		if r.SatuSehatID != "" && i < 5 {
			fmt.Printf("  Room ID=%d, Name=%s, SatuSehatID='%s'\n", r.ID, r.Name, r.SatuSehatID)
		}
	}

	// Count visits with/without encounter ID
	var visitsTotal, visitsSent, visitsPending int64
	database.DB.Model(&models.Visit{}).Where("status = ?", models.VisitStatusCompleted).Count(&visitsTotal)
	database.DB.Model(&models.Visit{}).Where("status = ? AND satusehat_sync_status = ?", models.VisitStatusCompleted, "sent").Count(&visitsSent)
	database.DB.Model(&models.Visit{}).Where("status = ? AND (satusehat_sync_status IS NULL OR satusehat_sync_status = '' OR satusehat_sync_status = 'pending')", models.VisitStatusCompleted).Count(&visitsPending)

	c.JSON(http.StatusOK, gin.H{
		"patients": gin.H{
			"total":    patientsTotal,
			"with_ihs": patientsWithIHS,
			"ready":    patientsWithIHS > 0,
		},
		"practitioners": gin.H{
			"total":    doctorsTotal,
			"with_ihs": doctorsWithIHS,
			"ready":    doctorsWithIHS > 0,
		},
		"locations": gin.H{
			"total":          roomsTotal,
			"with_satusehat": roomsWithSS,
			"ready":          roomsWithSS > 0,
		},
		"encounters": gin.H{
			"total_completed": visitsTotal,
			"sent":            visitsSent,
			"pending":         visitsPending,
		},
	})
}

// ============================================================================
// Diagnosis/Condition Sending to SatuSehat
// ============================================================================

// SendConditionToSatuSehat sends a diagnosis as FHIR Condition to SatuSehat
func SendConditionToSatuSehat(c *gin.Context) {
	diagnosisID := c.Param("id")

	var diagnosis models.Diagnosis
	if err := database.DB.Preload("Visit.Registration.Patient").Preload("Visit.Doctor").First(&diagnosis, diagnosisID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Diagnosis tidak ditemukan"})
		return
	}

	// Check if already sent
	if diagnosis.SatuSehatConditionID != "" {
		c.JSON(http.StatusOK, gin.H{
			"message":                "Diagnosis sudah dikirim sebelumnya",
			"diagnosis_id":           diagnosis.ID,
			"satusehat_condition_id": diagnosis.SatuSehatConditionID,
			"is_duplicate":           true,
		})
		return
	}

	// Validate patient has IHS
	if diagnosis.Visit == nil || diagnosis.Visit.Registration == nil || diagnosis.Visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}

	patient := diagnosis.Visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Pasien belum memiliki IHS Number",
			"message": "Silakan lookup IHS Number pasien terlebih dahulu",
		})
		return
	}

	// Get organization ID
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Build FHIR Condition dengan parameter lengkap
	registrationID := diagnosis.Visit.VisitNumber
	if diagnosis.Visit.Registration != nil {
		registrationID = diagnosis.Visit.Registration.RegistrationNumber
	}

	practitionerIHS := ""
	practitionerName := ""
	if diagnosis.Visit.Doctor != nil {
		practitionerIHS = diagnosis.Visit.Doctor.SatuSehatID
		practitionerName = diagnosis.Visit.Doctor.NamaLengkap
	}

	encounterID := diagnosis.Visit.SatuSehatEncounterID

	conditionParams := BuildFHIRConditionParams{
		OrgID:            orgID,
		RegistrationID:   registrationID,
		Sequence:         1,
		ICDCode:          diagnosis.ICD10Code,
		ICDDisplay:       diagnosis.ICD10Name,
		PatientIHS:       patient.SatuSehatID,
		PatientName:      patient.NamaLengkap,
		EncounterID:      encounterID,
		PractitionerIHS:  practitionerIHS,
		PractitionerName: practitionerName,
		IsPrimary:        diagnosis.Type == "primary",
		OnsetDate:        diagnosis.OnsetDate,
	}

	condition := BuildFHIRCondition(conditionParams)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Condition", condition)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 && statusCode != 201 {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		c.JSON(statusCode, gin.H{
			"error":              "Gagal mengirim Condition ke SatuSehat",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var response map[string]interface{}
	json.Unmarshal(body, &response)

	conditionID := ""
	if id, ok := response["id"].(string); ok {
		conditionID = id
	}

	// Update diagnosis with SatuSehat data
	now := time.Now()
	diagnosis.SatuSehatConditionID = conditionID
	diagnosis.SatuSehatSentAt = &now
	database.DB.Save(&diagnosis)

	c.JSON(http.StatusOK, gin.H{
		"message":                "Condition berhasil dikirim ke SatuSehat",
		"diagnosis_id":           diagnosis.ID,
		"icd10_code":             diagnosis.ICD10Code,
		"satusehat_condition_id": conditionID,
		"response":               response,
	})
}

// SendEncounterWithDiagnosisToSatuSehat sends visit with diagnoses to SatuSehat
// ALUR YANG BENAR sesuai Postman Collection SatuSehat:
// 1. POST /Encounter - status: arrived (buat encounter baru, dapatkan Encounter ID)
// 2. POST /Condition - kirim diagnosis dengan encounter reference
// 3. PUT /Encounter/:id - status: finished + diagnosis array + hospitalization
func SendEncounterWithDiagnosisToSatuSehat(c *gin.Context) {
	visitID := c.Param("id")
	id, _ := strconv.ParseUint(visitID, 10, 32)

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Doctor").
		Preload("Room").
		First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Load diagnoses for this visit
	var diagnoses []models.Diagnosis
	if err := originalRMVisitQuery(id).Order("type ASC, id ASC").Find(&diagnoses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat diagnosis"})
		return
	}

	// Validate at least one primary diagnosis exists
	hasPrimary := false
	for _, d := range diagnoses {
		if d.Type == "primary" {
			hasPrimary = true
			break
		}
	}

	if !hasPrimary {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Diagnosis utama belum ada",
			"message": "Minimal satu diagnosis dengan tipe 'primary' diperlukan untuk mengirim ke SatuSehat",
		})
		return
	}

	// Get organization ID
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Validate patient
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Pasien belum memiliki IHS Number",
			"message": "Silakan lookup IHS Number pasien terlebih dahulu",
		})
		return
	}

	var encounterID string
	sentConditions := []gin.H{}

	// ========================================================================
	// STEP 1: POST Encounter dengan status "arrived" (jika belum ada)
	// ========================================================================
	if visit.SatuSehatEncounterID == "" {
		// Build encounter dengan status arrived
		encounterParams := BuildFHIREncounterParams{
			Visit:   &visit,
			Patient: patient,
			Doctor:  visit.Doctor,
			Room:    visit.Room,
			OrgID:   orgID,
			Status:  "arrived", // Status awal: arrived
		}

		encounterArrived, err := BuildFHIREncounterWithParams(encounterParams)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Hapus hospitalization untuk POST awal (hanya untuk finished)
		encounterArrived.Hospitalization = nil

		// Send POST Encounter
		body, statusCode, err := SatuSehatFHIRRequest("POST", "/Encounter", encounterArrived)
		if err != nil {
			visit.SatuSehatSyncStatus = "failed"
			database.DB.Save(&visit)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal POST Encounter: " + err.Error(),
				"step":  "1-POST-Encounter-arrived",
			})
			return
		}

		if statusCode != 200 && statusCode != 201 {
			visit.SatuSehatSyncStatus = "failed"
			database.DB.Save(&visit)

			var errorResponse map[string]interface{}
			json.Unmarshal(body, &errorResponse)

			c.JSON(statusCode, gin.H{
				"error":              "Gagal POST Encounter ke SatuSehat",
				"step":               "1-POST-Encounter-arrived",
				"status_code":        statusCode,
				"satusehat_response": errorResponse,
			})
			return
		}

		// Parse response untuk mendapat Encounter ID
		var response map[string]interface{}
		json.Unmarshal(body, &response)

		if respID, ok := response["id"].(string); ok {
			encounterID = respID
		}

		// Simpan Encounter ID
		visit.SatuSehatEncounterID = encounterID
		visit.SatuSehatSyncStatus = "encounter_created"
		database.DB.Save(&visit)

		fmt.Printf("[SatuSehat] Step 1: POST Encounter berhasil - ID: %s\n", encounterID)
	} else {
		// Encounter sudah ada
		encounterID = visit.SatuSehatEncounterID
		fmt.Printf("[SatuSehat] Step 1: Menggunakan Encounter ID yang sudah ada: %s\n", encounterID)
	}

	// ========================================================================
	// STEP 2: POST Condition (diagnosis) dengan reference ke Encounter
	// ========================================================================
	registrationID := visit.VisitNumber
	if visit.Registration != nil {
		registrationID = visit.Registration.RegistrationNumber
	}

	for i := range diagnoses {
		diag := &diagnoses[i]

		if diag.SatuSehatConditionID != "" {
			// Already sent
			sentConditions = append(sentConditions, gin.H{
				"diagnosis_id": diag.ID,
				"icd10_code":   diag.ICD10Code,
				"condition_id": diag.SatuSehatConditionID,
				"status":       "already_sent",
			})
			continue
		}

		// Build FHIR Condition dengan parameter lengkap
		practitionerIHS := ""
		practitionerName := ""
		if visit.Doctor != nil {
			practitionerIHS = visit.Doctor.SatuSehatID
			practitionerName = visit.Doctor.NamaLengkap
		}

		conditionParams := BuildFHIRConditionParams{
			OrgID:            orgID,
			RegistrationID:   registrationID,
			Sequence:         i + 1,
			ICDCode:          diag.ICD10Code,
			ICDDisplay:       diag.ICD10Name,
			PatientIHS:       patient.SatuSehatID,
			PatientName:      patient.NamaLengkap,
			EncounterID:      encounterID, // Reference ke Encounter yang sudah dibuat
			PractitionerIHS:  practitionerIHS,
			PractitionerName: practitionerName,
			IsPrimary:        diag.Type == "primary",
			OnsetDate:        diag.OnsetDate,
		}

		condition := BuildFHIRCondition(conditionParams)

		// Send POST Condition
		body, statusCode, err := SatuSehatFHIRRequest("POST", "/Condition", condition)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":        "Gagal POST Condition: " + err.Error(),
				"step":         "2-POST-Condition",
				"diagnosis_id": diag.ID,
			})
			return
		}

		if statusCode != 200 && statusCode != 201 {
			var errorResponse map[string]interface{}
			json.Unmarshal(body, &errorResponse)

			c.JSON(statusCode, gin.H{
				"error":              "Gagal POST Condition ke SatuSehat",
				"step":               "2-POST-Condition",
				"diagnosis_id":       diag.ID,
				"icd10_code":         diag.ICD10Code,
				"status_code":        statusCode,
				"satusehat_response": errorResponse,
			})
			return
		}

		// Parse response
		var response map[string]interface{}
		json.Unmarshal(body, &response)

		conditionID := ""
		if respID, ok := response["id"].(string); ok {
			conditionID = respID
		}

		// Update diagnosis dengan SatuSehat Condition ID
		now := time.Now()
		diag.SatuSehatConditionID = conditionID
		diag.SatuSehatSentAt = &now
		database.DB.Save(diag)

		sentConditions = append(sentConditions, gin.H{
			"diagnosis_id": diag.ID,
			"icd10_code":   diag.ICD10Code,
			"condition_id": conditionID,
			"status":       "sent",
		})

		fmt.Printf("[SatuSehat] Step 2: POST Condition berhasil - ID: %s, ICD: %s\n", conditionID, diag.ICD10Code)
	}

	// Reload diagnoses untuk mendapatkan Condition ID yang sudah diupdate
	originalRMVisitQuery(id).Order("type ASC, id ASC").Find(&diagnoses)

	// ========================================================================
	// STEP 3: PUT Encounter dengan status "finished" + diagnosis array
	// ========================================================================
	encounterParams := BuildFHIREncounterParams{
		Visit:       &visit,
		Patient:     patient,
		Doctor:      visit.Doctor,
		Room:        visit.Room,
		OrgID:       orgID,
		EncounterID: encounterID, // ID untuk PUT request
		Status:      "finished",  // Status akhir
	}

	encounterFinished, err := BuildFHIREncounterWithParams(encounterParams)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Add diagnosis references ke Encounter
	AddDiagnosisToEncounter(encounterFinished, diagnoses)

	// Validasi minimal ada 1 diagnosis
	if len(encounterFinished.Diagnosis) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Tidak ada diagnosis yang dapat direferensikan",
			"message": "Pastikan minimal satu diagnosis berhasil dikirim ke SatuSehat",
		})
		return
	}

	// Send PUT Encounter
	body, statusCode, err := SatuSehatFHIRRequest("PUT", "/Encounter/"+encounterID, encounterFinished)
	if err != nil {
		visit.SatuSehatSyncStatus = "failed"
		database.DB.Save(&visit)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal PUT Encounter: " + err.Error(),
			"step":  "3-PUT-Encounter-finished",
		})
		return
	}

	if statusCode != 200 && statusCode != 201 {
		visit.SatuSehatSyncStatus = "failed"
		database.DB.Save(&visit)

		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		// Extract issue details
		var issueDetails []string
		if issues, ok := errorResponse["issue"].([]interface{}); ok {
			for _, issue := range issues {
				if issueMap, ok := issue.(map[string]interface{}); ok {
					detail := ""
					if diagnostics, ok := issueMap["diagnostics"].(string); ok {
						detail = diagnostics
					}
					if detail != "" {
						issueDetails = append(issueDetails, detail)
					}
				}
			}
		}

		c.JSON(statusCode, gin.H{
			"error":              "Gagal PUT Encounter finished ke SatuSehat",
			"step":               "3-PUT-Encounter-finished",
			"status_code":        statusCode,
			"issue_details":      issueDetails,
			"conditions_sent":    sentConditions,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var response map[string]interface{}
	json.Unmarshal(body, &response)

	// Update visit status
	now := time.Now()
	visit.SatuSehatSentAt = &now
	visit.SatuSehatSyncStatus = "sent"
	database.DB.Save(&visit)

	fmt.Printf("[SatuSehat] Step 3: PUT Encounter finished berhasil - ID: %s\n", encounterID)

	c.JSON(http.StatusOK, gin.H{
		"message":                "Encounter dan Conditions berhasil dikirim ke SatuSehat",
		"visit_id":               visit.ID,
		"visit_number":           visit.VisitNumber,
		"satusehat_encounter_id": encounterID,
		"conditions_sent":        sentConditions,
		"diagnosis_count":        len(encounterFinished.Diagnosis),
		"steps_completed": []string{
			"1. POST Encounter (arrived)",
			"2. POST Condition (diagnosis)",
			"3. PUT Encounter (finished + diagnosis)",
		},
		"response": response,
	})
}

// GetVisitDiagnoses returns diagnoses for a specific visit
func GetVisitDiagnoses(c *gin.Context) {
	visitID := c.Param("id")

	var diagnoses []models.Diagnosis
	if err := originalRMVisitQuery(visitID).Order("type ASC, id ASC").Find(&diagnoses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat diagnosis"})
		return
	}

	// Calculate summary
	hasPrimary := false
	sentCount := 0
	for _, d := range diagnoses {
		if d.Type == "primary" {
			hasPrimary = true
		}
		if d.SatuSehatConditionID != "" {
			sentCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"diagnoses":     diagnoses,
		"total":         len(diagnoses),
		"has_primary":   hasPrimary,
		"sent_count":    sentCount,
		"ready_to_send": hasPrimary,
	})
}

// PreviewEncounterFHIR generates preview of FHIR resources that will be sent to SatuSehat
func PreviewEncounterFHIR(c *gin.Context) {
	visitID := c.Param("id")

	// Load visit dengan semua relasi
	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Validasi requirements
	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki IHS Number"})
		return
	}

	if visit.Doctor == nil || visit.Doctor.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter belum memiliki IHS Number"})
		return
	}

	if visit.Room == nil || visit.Room.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan belum terdaftar di SatuSehat"})
		return
	}

	// Load diagnoses
	var diagnoses []models.Diagnosis
	if err := originalRMVisitQuery(visitID).Order("type ASC, id ASC").Find(&diagnoses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat diagnosis"})
		return
	}

	hasPrimary := false
	for _, d := range diagnoses {
		if d.Type == "primary" {
			hasPrimary = true
			break
		}
	}

	if !hasPrimary {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Belum ada diagnosis primary"})
		return
	}

	// Get organization ID
	orgID := "100"
	if val, exists := c.Get("organization_id"); exists {
		if id, ok := val.(string); ok {
			orgID = id
		}
	}

	registrationID := visit.VisitNumber
	if visit.Registration != nil {
		registrationID = visit.Registration.RegistrationNumber
	}

	// ========================================================================
	// PREVIEW 1: Encounter (arrived)
	// ========================================================================
	encounterParams := BuildFHIREncounterParams{
		Visit:   &visit,
		Patient: patient,
		Doctor:  visit.Doctor,
		Room:    visit.Room,
		OrgID:   orgID,
		Status:  "arrived",
	}

	encounterArrived, _ := BuildFHIREncounterWithParams(encounterParams)
	encounterArrived.Hospitalization = nil

	// ========================================================================
	// PREVIEW 2: Conditions (diagnoses)
	// ========================================================================
	var conditionPreviews []interface{}
	for i, diag := range diagnoses {
		conditionParams := BuildFHIRConditionParams{
			OrgID:            orgID,
			RegistrationID:   registrationID,
			Sequence:         i + 1,
			ICDCode:          diag.ICD10Code,
			ICDDisplay:       diag.ICD10Name,
			PatientIHS:       patient.SatuSehatID,
			PatientName:      patient.NamaLengkap,
			EncounterID:      "[ENCOUNTER_ID_WILL_BE_GENERATED]",
			PractitionerIHS:  visit.Doctor.SatuSehatID,
			PractitionerName: visit.Doctor.NamaLengkap,
			IsPrimary:        diag.Type == "primary",
			OnsetDate:        diag.OnsetDate,
		}

		condition := BuildFHIRCondition(conditionParams)
		conditionPreviews = append(conditionPreviews, condition)
	}

	// ========================================================================
	// PREVIEW 3: Encounter (finished) dengan diagnosis
	// ========================================================================
	encounterParams.Status = "finished"
	encounterParams.EncounterID = "[ENCOUNTER_ID_WILL_BE_GENERATED]"
	encounterFinished, _ := BuildFHIREncounterWithParams(encounterParams)

	// Simulasi diagnosis references (dengan placeholder ID)
	encounterFinished.Diagnosis = []FHIREncounterDiagnosis{}
	rank := 1
	for _, diag := range diagnoses {
		roleCode := "DD"
		roleDisplay := "Discharge diagnosis"
		switch diag.Type {
		case "primary":
			roleCode = "DD"
			roleDisplay = "Discharge diagnosis"
		case "secondary":
			roleCode = "CC"
			roleDisplay = "Chief complaint"
		case "complication":
			roleCode = "CM"
			roleDisplay = "Comorbidity diagnosis"
		}

		diagRef := FHIREncounterDiagnosis{
			Condition: &FHIRReference{
				Reference: "Condition/[CONDITION_ID_WILL_BE_GENERATED_" + fmt.Sprint(rank) + "]",
				Display:   diag.ICD10Code + " - " + diag.ICD10Name,
			},
			Use: &FHIRCodeableConcept{
				Coding: []FHIRCoding{
					{
						System:  "http://terminology.hl7.org/CodeSystem/diagnosis-role",
						Code:    roleCode,
						Display: roleDisplay,
					},
				},
			},
			Rank: rank,
		}
		encounterFinished.Diagnosis = append(encounterFinished.Diagnosis, diagRef)
		rank++
	}

	// Response preview
	c.JSON(http.StatusOK, gin.H{
		"visit_id":        visit.ID,
		"visit_number":    visit.VisitNumber,
		"patient_name":    patient.NamaLengkap,
		"patient_ihs":     patient.SatuSehatID,
		"doctor_name":     visit.Doctor.NamaLengkap,
		"doctor_ihs":      visit.Doctor.SatuSehatID,
		"room_name":       visit.Room.Name,
		"room_id":         visit.Room.SatuSehatID,
		"diagnosis_count": len(diagnoses),
		"preview": gin.H{
			"step_1_encounter_arrived":  encounterArrived,
			"step_2_conditions":         conditionPreviews,
			"step_3_encounter_finished": encounterFinished,
		},
		"flow_explanation": []string{
			"Step 1: POST /Encounter (status: arrived) - Membuat encounter awal",
			"Step 2: POST /Condition (untuk setiap diagnosis) - Membuat kondisi/diagnosis dengan reference ke Encounter",
			"Step 3: PUT /Encounter/:id (status: finished) - Update encounter dengan diagnosis array dan discharge disposition",
		},
		"notes": []string{
			"[ENCOUNTER_ID_WILL_BE_GENERATED] akan diganti dengan ID yang didapat dari response Step 1",
			"[CONDITION_ID_WILL_BE_GENERATED_X] akan diganti dengan ID yang didapat dari response Step 2",
			"Data ini adalah preview, belum dikirim ke SatuSehat",
		},
	})
}

// ============================================================================
// Send Vital Signs (Observations) to SatuSehat
// ============================================================================

// SendVitalSignsToSatuSehat sends all vital signs from physical exam to SatuSehat
func SendVitalSignsToSatuSehat(c *gin.Context) {
	visitID := c.Param("id")

	// Load visit
	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Check encounter ID
	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki IHS Number"})
		return
	}

	// Load physical exam data
	var physicalExam models.PhysicalExamination
	if err := originalRMVisitQuery(visitID).Preload("ExaminedBy.Employee").First(&physicalExam).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pemeriksaan fisik tidak ditemukan"})
		return
	}

	// Get practitioner IHS from examiner (who performed physical exam) or fallback to doctor
	practitionerIHS := ""
	if physicalExam.ExaminedBy != nil && physicalExam.ExaminedBy.Employee != nil && physicalExam.ExaminedBy.Employee.SatuSehatID != "" {
		practitionerIHS = physicalExam.ExaminedBy.Employee.SatuSehatID
	} else if visit.Doctor != nil && visit.Doctor.SatuSehatID != "" {
		practitionerIHS = visit.Doctor.SatuSehatID
	}

	// Validate practitioner IHS
	if practitionerIHS == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Practitioner yang mengisi pemeriksaan fisik belum memiliki IHS Number"})
		return
	}

	encounterID := visit.SatuSehatEncounterID
	patientIHS := patient.SatuSehatID
	effectiveTime := visit.CheckInTime

	sentObservations := []gin.H{}

	// Helper function to send observation
	sendVitalSign := func(vitalType string, valueStr string) error {
		if valueStr == "" {
			return nil
		}

		// Parse value
		var value float64
		if _, err := fmt.Sscanf(valueStr, "%f", &value); err != nil {
			return nil // Skip invalid values
		}

		observation := BuildFHIRObservation(vitalType, value, patientIHS, encounterID, practitionerIHS, effectiveTime)

		body, statusCode, err := SatuSehatFHIRRequest("POST", "/Observation", observation)
		if err != nil {
			return fmt.Errorf("%s: %v", vitalType, err)
		}

		// Handle duplicate (409) or success (200/201)
		if statusCode == 409 {
			// Duplicate - already sent before, mark as sent
			sentObservations = append(sentObservations, gin.H{
				"type":   vitalType,
				"value":  value,
				"status": "duplicate",
			})
			return nil
		}

		if statusCode != 200 && statusCode != 201 {
			var errorResponse map[string]interface{}
			json.Unmarshal(body, &errorResponse)
			return fmt.Errorf("%s: HTTP %d", vitalType, statusCode)
		}

		var response map[string]interface{}
		json.Unmarshal(body, &response)

		observationID := ""
		if respID, ok := response["id"].(string); ok {
			observationID = respID
		}

		sentObservations = append(sentObservations, gin.H{
			"type":           vitalType,
			"value":          value,
			"observation_id": observationID,
			"status":         "sent",
		})

		return nil
	}

	// Helper function to send observation with int value
	sendVitalSignInt := func(vitalType string, value int) error {
		if value <= 0 {
			return nil
		}

		observation := BuildFHIRObservation(vitalType, float64(value), patientIHS, encounterID, practitionerIHS, effectiveTime)

		body, statusCode, err := SatuSehatFHIRRequest("POST", "/Observation", observation)
		if err != nil {
			return fmt.Errorf("%s: %v", vitalType, err)
		}

		// Handle duplicate (409) or success (200/201)
		if statusCode == 409 {
			// Duplicate - already sent before, mark as sent
			sentObservations = append(sentObservations, gin.H{
				"type":   vitalType,
				"value":  value,
				"status": "duplicate",
			})
			return nil
		}

		if statusCode != 200 && statusCode != 201 {
			var errorResponse map[string]interface{}
			json.Unmarshal(body, &errorResponse)
			return fmt.Errorf("%s: HTTP %d", vitalType, statusCode)
		}

		var response map[string]interface{}
		json.Unmarshal(body, &response)

		observationID := ""
		if respID, ok := response["id"].(string); ok {
			observationID = respID
		}

		sentObservations = append(sentObservations, gin.H{
			"type":           vitalType,
			"value":          value,
			"observation_id": observationID,
			"status":         "sent",
		})

		return nil
	}

	// Send Blood Pressure (Systolic & Diastolic)
	sendVitalSignInt("systolic", physicalExam.Systolic)
	sendVitalSignInt("diastolic", physicalExam.Diastolic)

	// Send Heart Rate
	sendVitalSign("heart_rate", physicalExam.HeartRate)

	// Send Respiratory Rate
	sendVitalSign("respiratory_rate", physicalExam.RespiratoryRate)

	// Send Temperature
	sendVitalSign("temperature", physicalExam.Temperature)

	// Send Oxygen Saturation
	sendVitalSign("oxygen_saturation", physicalExam.OxygenSaturation)

	// Send Weight
	sendVitalSign("weight", physicalExam.Weight)

	// Send Height
	sendVitalSign("height", physicalExam.Height)

	// Update physical exam - mark as sent
	if len(sentObservations) > 0 {
		now := time.Now()
		physicalExam.SatusehatVitalSignsSent = true
		physicalExam.SatusehatSentAt = &now
		if err := database.DB.Save(&physicalExam).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan status pengiriman: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "Vital signs berhasil dikirim ke SatuSehat",
		"visit_id":          visit.ID,
		"encounter_id":      encounterID,
		"observations_sent": sentObservations,
		"total_sent":        len(sentObservations),
	})
}

// ============================================================================
// Send Procedures to SatuSehat
// ============================================================================

// FHIRProcedure represents FHIR Procedure resource
type FHIRProcedure struct {
	ResourceType      string                   `json:"resourceType"`
	Status            string                   `json:"status"`
	Category          *FHIRCodeableConcept     `json:"category,omitempty"`
	Code              *FHIRCodeableConcept     `json:"code"`
	Subject           *FHIRReference           `json:"subject"`
	Encounter         *FHIRReference           `json:"encounter,omitempty"`
	PerformedDateTime string                   `json:"performedDateTime,omitempty"`
	Performer         []FHIRProcedurePerformer `json:"performer,omitempty"`
	Note              []FHIRAnnotation         `json:"note,omitempty"`
}

type FHIRProcedurePerformer struct {
	Actor *FHIRReference `json:"actor"`
}

type FHIRAnnotation struct {
	Text string `json:"text"`
}

// BuildFHIRProcedure creates FHIR Procedure resource
func BuildFHIRProcedure(procedure *models.Procedure, patientIHS, encounterID, practitionerIHS string, performedAt *time.Time, notes string) *FHIRProcedure {
	fhirProcedure := &FHIRProcedure{
		ResourceType: "Procedure",
		Status:       "completed",
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://hl7.org/fhir/sid/icd-9-cm",
					Code:    procedure.Code,
					Display: procedure.Name,
				},
			},
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + patientIHS,
		},
	}

	if encounterID != "" {
		fhirProcedure.Encounter = &FHIRReference{
			Reference: "Encounter/" + encounterID,
		}
	}

	if performedAt != nil {
		fhirProcedure.PerformedDateTime = performedAt.Format(time.RFC3339)
	}

	if practitionerIHS != "" {
		fhirProcedure.Performer = []FHIRProcedurePerformer{
			{
				Actor: &FHIRReference{
					Reference: "Practitioner/" + practitionerIHS,
				},
			},
		}
	}

	if notes != "" {
		fhirProcedure.Note = []FHIRAnnotation{
			{Text: notes},
		}
	}

	return fhirProcedure
}

// SendProcedureToSatuSehat sends a single procedure to SatuSehat
func SendProcedureToSatuSehat(c *gin.Context) {
	visitProcedureID := c.Param("id")
	log.Println("=== SendProcedureToSatuSehat called ===")
	log.Printf("Visit Procedure ID: %s\n", visitProcedureID)

	// Load visit procedure
	var visitProc models.VisitProcedure
	if err := database.DB.Preload("Visit.Registration.Patient").
		Preload("Visit.Doctor").
		Preload("Procedure").
		First(&visitProc, visitProcedureID).Error; err != nil {
		log.Printf("ERROR: Procedure not found: %v\n", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure not found"})
		return
	}

	log.Printf("Loaded procedure: %s (ID: %d)\n", visitProc.Procedure.Name, visitProc.ID)

	// Check if already sent
	if visitProc.SatusehatProcedureID != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":                  "Procedure sudah dikirim ke SatuSehat",
			"satusehat_procedure_id": visitProc.SatusehatProcedureID,
		})
		return
	}

	visit := visitProc.Visit
	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki IHS Number"})
		return
	}

	practitionerIHS := ""
	if visit.Doctor != nil {
		practitionerIHS = visit.Doctor.SatuSehatID
	}

	// Build FHIR Procedure
	fhirProcedure := BuildFHIRProcedure(
		visitProc.Procedure,
		patient.SatuSehatID,
		visit.SatuSehatEncounterID,
		practitionerIHS,
		visitProc.PerformedAt,
		visitProc.Notes,
	)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Procedure", fhirProcedure)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim Procedure: " + err.Error()})
		return
	}

	if statusCode != 200 && statusCode != 201 {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		// Log error response untuk debugging
		log.Printf("SatuSehat Error Response: %+v\n", errorResponse)

		// Check if error is duplicate - if so, mark as sent
		if statusCode == 400 {
			// Check struktur error dari screenshot: {issue: [{code: "duplicate", ...}]}
			if issue, ok := errorResponse["issue"].([]interface{}); ok && len(issue) > 0 {
				if firstIssue, ok := issue[0].(map[string]interface{}); ok {
					code, _ := firstIssue["code"].(string)
					log.Printf("First Issue Code: [%s]\n", code)

					if strings.Contains(code, "duplicate") {
						// Mark as sent (duplicate means already sent before)
						visitProc.SatusehatProcedureID = "DUPLICATE_DETECTED"
						database.DB.Save(&visitProc)
						log.Printf("Procedure marked as duplicate (already sent)\n")

						c.JSON(http.StatusOK, gin.H{
							"message":                "Procedure sudah pernah dikirim sebelumnya",
							"visit_procedure_id":     visitProc.ID,
							"procedure_code":         visitProc.Procedure.Code,
							"procedure_name":         visitProc.Procedure.Name,
							"satusehat_procedure_id": "DUPLICATE",
							"note":                   "Procedure ini sudah ada di SatuSehat",
						})
						return
					}
				}
			}
		}

		c.JSON(statusCode, gin.H{
			"error":              "Gagal mengirim Procedure ke SatuSehat",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	var response map[string]interface{}
	json.Unmarshal(body, &response)

	procedureID := ""
	if respID, ok := response["id"].(string); ok {
		procedureID = respID
	}

	// Save procedureID to visit_procedures table
	if procedureID != "" {
		visitProc.SatusehatProcedureID = procedureID
		if err := database.DB.Save(&visitProc).Error; err != nil {
			log.Printf("WARNING: Gagal menyimpan procedure ID: %v\n", err)
		} else {
			log.Printf("Procedure ID saved: %s\n", procedureID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                "Procedure berhasil dikirim ke SatuSehat",
		"visit_procedure_id":     visitProc.ID,
		"procedure_code":         visitProc.Procedure.Code,
		"procedure_name":         visitProc.Procedure.Name,
		"satusehat_procedure_id": procedureID,
	})
}

// ============================================================================
// Send AllergyIntolerance to SatuSehat
// ============================================================================

// FHIRAllergyIntolerance represents FHIR AllergyIntolerance resource
type FHIRAllergyIntolerance struct {
	ResourceType       string               `json:"resourceType"`
	ClinicalStatus     *FHIRCodeableConcept `json:"clinicalStatus"`
	VerificationStatus *FHIRCodeableConcept `json:"verificationStatus,omitempty"`
	Category           []string             `json:"category,omitempty"`
	Criticality        string               `json:"criticality,omitempty"`
	Code               *FHIRCodeableConcept `json:"code"`
	Patient            *FHIRReference       `json:"patient"`
	Encounter          *FHIRReference       `json:"encounter,omitempty"`
	RecordedDate       string               `json:"recordedDate,omitempty"`
	Recorder           *FHIRReference       `json:"recorder,omitempty"`
	Note               []FHIRAnnotation     `json:"note,omitempty"`
}

// BuildFHIRAllergyIntolerance creates FHIR AllergyIntolerance resource
func BuildFHIRAllergyIntolerance(allergyCode, allergyDisplay, category, criticality, patientIHS, encounterID, practitionerIHS, notes string) *FHIRAllergyIntolerance {
	allergy := &FHIRAllergyIntolerance{
		ResourceType: "AllergyIntolerance",
		ClinicalStatus: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
					Code:    "active",
					Display: "Active",
				},
			},
		},
		VerificationStatus: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
					Code:    "confirmed",
					Display: "Confirmed",
				},
			},
		},
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://snomed.info/sct",
					Code:    allergyCode,
					Display: allergyDisplay,
				},
			},
		},
		Patient: &FHIRReference{
			Reference: "Patient/" + patientIHS,
		},
		RecordedDate: time.Now().Format(time.RFC3339),
	}

	if category != "" {
		allergy.Category = []string{category} // food, medication, environment, biologic
	}

	if criticality != "" {
		allergy.Criticality = criticality // low, high, unable-to-assess
	}

	if encounterID != "" {
		allergy.Encounter = &FHIRReference{
			Reference: "Encounter/" + encounterID,
		}
	}

	if practitionerIHS != "" {
		allergy.Recorder = &FHIRReference{
			Reference: "Practitioner/" + practitionerIHS,
		}
	}

	if notes != "" {
		allergy.Note = []FHIRAnnotation{
			{Text: notes},
		}
	}

	return allergy
}

// SendMedicationRequestToSatuSehat sends medication order data to SatuSehat
func SendMedicationRequestToSatuSehat(c *gin.Context) {
	medicineOrderItemID := c.Param("id")

	log.Printf("[MEDICATION REQUEST] Starting send for item ID: %s", medicineOrderItemID)

	// Load medicine order item
	var item models.MedicineOrderItem
	if err := database.DB.Preload("MedicineOrder").
		Preload("MedicineOrder.SourceVisit.Registration.Patient").
		Preload("MedicineOrder.SourceVisit.Doctor").
		Preload("MedicineOrder.SourceVisit.Room").
		Preload("MedicineOrder.Prescriber").
		Preload("Medicine").
		First(&item, medicineOrderItemID).Error; err != nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Item not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order item not found"})
		return
	}

	log.Printf("[MEDICATION REQUEST] Loaded item: Medicine=%s, MedicineID=%d",
		item.Medicine.Name, item.MedicineID)

	// Check if relationships exist
	if item.MedicineOrder == nil {
		log.Printf("[MEDICATION REQUEST] ERROR: MedicineOrder is nil")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Medicine order tidak ditemukan"})
		return
	}

	if item.MedicineOrder.SourceVisit == nil {
		log.Printf("[MEDICATION REQUEST] ERROR: SourceVisit is nil")
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	visit := item.MedicineOrder.SourceVisit
	log.Printf("[MEDICATION REQUEST] Visit ID: %d", visit.ID)

	if visit.Registration == nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Registration is nil")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registrasi tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	if patient == nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Patient is nil")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak ditemukan"})
		return
	}

	log.Printf("[MEDICATION REQUEST] Patient: %s (IHS: %s)", patient.NamaLengkap, patient.SatuSehatID)

	// Check prerequisites
	if visit.SatuSehatEncounterID == "" {
		log.Printf("[MEDICATION REQUEST] ERROR: Encounter ID is empty for visit %d", visit.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	if patient.SatuSehatID == "" {
		log.Printf("[MEDICATION REQUEST] ERROR: Patient tidak punya SatuSehat ID (patient_id=%d)", patient.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum terdaftar di SatuSehat (IHS Number tidak ada)"})
		return
	}

	log.Printf("[MEDICATION REQUEST] Prerequisites OK - Encounter: %s, Patient IHS: %s",
		visit.SatuSehatEncounterID, patient.SatuSehatID)

	// Use prescriber IHS - PRIORITAS: Prescriber, jika tidak ada gunakan Doctor
	var practitionerIHS string
	var practitionerName string

	if item.MedicineOrder.Prescriber != nil && item.MedicineOrder.Prescriber.SatuSehatID != "" {
		practitionerIHS = item.MedicineOrder.Prescriber.SatuSehatID
		practitionerName = item.MedicineOrder.Prescriber.NamaLengkap
		log.Printf("[MEDICATION REQUEST] Using Prescriber: %s (IHS: %s)", practitionerName, practitionerIHS)
	} else if visit.Doctor != nil && visit.Doctor.SatuSehatID != "" {
		practitionerIHS = visit.Doctor.SatuSehatID
		practitionerName = visit.Doctor.NamaLengkap
		log.Printf("[MEDICATION REQUEST] Using Visit Doctor: %s (IHS: %s)", practitionerName, practitionerIHS)
	} else {
		log.Printf("[MEDICATION REQUEST] ERROR: No valid practitioner - Prescriber=%v, Doctor=%v",
			item.MedicineOrder.Prescriber, visit.Doctor)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Dokter belum terdaftar di SatuSehat (IHS Number tidak ada)",
			"detail": "Baik Prescriber maupun Doctor tidak memiliki IHS Number. Silakan daftarkan dokter ke SatuSehat terlebih dahulu.",
		})
		return
	}

	// Check if already sent
	if item.SatusehatMedicationRequestID != "" {
		log.Printf("[MEDICATION REQUEST] Already sent: %s", item.SatusehatMedicationRequestID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":                           "Resep sudah dikirim ke SatuSehat",
			"satusehat_medication_request_id": item.SatusehatMedicationRequestID,
		})
		return
	}

	// CHECK KFA MAPPING - WAJIB!
	var kfaMapping models.MedicineKFAMapping
	if err := database.DB.Where("medicine_id = ?", item.MedicineID).First(&kfaMapping).Error; err != nil {
		log.Printf("[MEDICATION REQUEST] ERROR: KFA mapping not found for medicine_id=%d", item.MedicineID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "Obat belum dimapping ke kode KFA",
			"medicine_id":   item.MedicineID,
			"medicine_name": item.Medicine.Name,
			"instruction":   "Silakan mapping obat ke kode KFA terlebih dahulu di menu KFA Mapping",
		})
		return
	}

	log.Printf("[MEDICATION REQUEST] KFA Mapping found: Code=%s, Name=%s", kfaMapping.KFACode, kfaMapping.KFADisplayName)

	// Get Organization ID from config
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		log.Printf("[MEDICATION REQUEST] ERROR: Organization ID not configured")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi di SatuSehat settings"})
		return
	}

	// Get diagnosis for reasonReference (if available)
	var diagnosisConditionID string
	var diagnosisDisplay string
	var diagnosis models.Diagnosis
	if err := database.DB.Where("visit_id = ? AND is_casemix = ? AND satusehat_condition_id != ''", visit.ID, false).
		Order("type ASC"). // primary first
		First(&diagnosis).Error; err == nil {
		diagnosisConditionID = diagnosis.SatuSehatConditionID
		diagnosisDisplay = diagnosis.ICD10Name
	}

	// Parse duration (convert string to int if needed)
	duration := 0
	if item.Duration != "" {
		fmt.Sscanf(item.Duration, "%d", &duration)
	}

	// Determine category based on visit type
	category := "outpatient"
	if visit.Room != nil {
		switch visit.Room.RoomType {
		case "rawat_inap", "inpatient", "icu", "nicu", "picu", "iccu":
			category = "inpatient"
		case "ugd", "igd", "emergency":
			category = "outpatient"
		}
	}

	// Build FHIR MedicationRequest menggunakan KFA code dari mapping
	medRequest := BuildFHIRMedicationRequest(MedicationRequestParams{
		PatientIHS:           patient.SatuSehatID,
		PatientName:          patient.NamaLengkap,
		EncounterID:          visit.SatuSehatEncounterID,
		PractitionerIHS:      practitionerIHS,
		PractitionerName:     practitionerName,
		KFACode:              kfaMapping.KFACode,
		MedicationName:       kfaMapping.KFADisplayName,
		Quantity:             item.Quantity,
		Unit:                 item.Unit,
		Dosage:               item.Dosage,
		Frequency:            item.Frequency,
		Route:                item.Route,
		Duration:             duration,
		DiagnosisConditionID: diagnosisConditionID,
		DiagnosisDisplay:     diagnosisDisplay,
		Notes:                item.Notes,
		AuthoredOn:           visit.CheckInTime.Format("2006-01-02T15:04:05+07:00"),
		OrganizationID:       orgID,
		PrescriptionNumber:   item.MedicineOrder.OrderNumber,
		ItemNumber:           fmt.Sprintf("%s-%d", item.MedicineOrder.OrderNumber, item.ID),
		MedicationForm:       kfaMapping.KFAForm,
		Category:             category,
	})

	log.Printf("[MEDICATION REQUEST] Sending to SatuSehat...")

	// Send to SatuSehat using helper function
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/MedicationRequest", medRequest)
	if err != nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION REQUEST] Response [%d]: %s", statusCode, string(body))

	if statusCode != http.StatusCreated && statusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		log.Printf("[MEDICATION REQUEST] ERROR: SatuSehat rejected with status %d", statusCode)
		c.JSON(statusCode, gin.H{
			"error":              "SatuSehat menolak request",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Failed to parse response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	medicationRequestID, ok := fhirResponse["id"].(string)
	if !ok {
		log.Printf("[MEDICATION REQUEST] ERROR: No ID in response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Response tidak mengandung ID"})
		return
	}

	log.Printf("[MEDICATION REQUEST] SUCCESS: Got ID %s", medicationRequestID)

	// Update medicine order item with SatuSehat ID
	item.SatusehatMedicationRequestID = medicationRequestID
	if err := database.DB.Save(&item).Error; err != nil {
		log.Printf("[MEDICATION REQUEST] ERROR: Failed to save ID: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ID SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION REQUEST] Completed successfully for item %s", medicineOrderItemID)

	c.JSON(http.StatusOK, gin.H{
		"message":                         "Resep berhasil dikirim ke SatuSehat",
		"satusehat_medication_request_id": medicationRequestID,
		"fhir_response":                   fhirResponse,
	})
}

// MedicationRequestParams contains all parameters for building MedicationRequest
type MedicationRequestParams struct {
	PatientIHS           string
	PatientName          string
	EncounterID          string
	PractitionerIHS      string
	PractitionerName     string
	KFACode              string
	MedicationName       string
	Quantity             int
	Unit                 string
	Dosage               string
	Frequency            string
	Route                string
	Duration             int
	DiagnosisConditionID string
	DiagnosisDisplay     string
	Notes                string
	AuthoredOn           string
	OrganizationID       string
	PrescriptionNumber   string
	ItemNumber           string
	MedicationForm       string // Form obat dari KFA (tablet, kapsul, sirup, dll)
	Category             string // outpatient, inpatient, community
}

// BuildFHIRMedicationRequest builds FHIR MedicationRequest resource according to SatuSehat spec
func BuildFHIRMedicationRequest(params MedicationRequestParams) map[string]interface{} {
	// Generate medication ID for contained resource
	medicationID := params.PrescriptionNumber + "-med"

	// Map medication form to code
	formCode, formDisplay := mapMedicationForm(params.MedicationForm)

	// Map unit to SNOMED/drug form code
	unitCode, unitSystem, unitDisplay := mapUnitToCode(params.Unit)

	// Contained Medication resource - WAJIB dengan identifier
	medication := map[string]interface{}{
		"resourceType": "Medication",
		"id":           medicationID,
		"identifier": []map[string]interface{}{
			{
				"system": "http://sys-ids.kemkes.go.id/medication/" + params.OrganizationID,
				"use":    "official",
				"value":  medicationID,
			},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://sys-ids.kemkes.go.id/kfa",
					"code":    params.KFACode,
					"display": params.MedicationName,
				},
			},
		},
		"status": "active",
		"extension": []map[string]interface{}{
			{
				"url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
				"valueCodeableConcept": map[string]interface{}{
					"coding": []map[string]interface{}{
						{
							"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-type",
							"code":    "NC",
							"display": "Non-compound",
						},
					},
				},
			},
		},
	}

	// Add form if available
	if formCode != "" {
		medication["form"] = map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-form",
					"code":    formCode,
					"display": formDisplay,
				},
			},
		}
	}

	// Determine category
	categoryCode := "outpatient"
	categoryDisplay := "Outpatient"
	if params.Category != "" {
		categoryCode = params.Category
		switch params.Category {
		case "inpatient":
			categoryDisplay = "Inpatient"
		case "community":
			categoryDisplay = "Community"
		}
	}

	medRequest := map[string]interface{}{
		"resourceType": "MedicationRequest",
		"contained":    []map[string]interface{}{medication},
		// WAJIB: identifier untuk prescription dan prescription-item
		"identifier": []map[string]interface{}{
			{
				"system": "http://sys-ids.kemkes.go.id/prescription/" + params.OrganizationID,
				"use":    "official",
				"value":  params.PrescriptionNumber,
			},
			{
				"system": "http://sys-ids.kemkes.go.id/prescription-item/" + params.OrganizationID,
				"use":    "official",
				"value":  params.ItemNumber,
			},
		},
		"status": "completed",
		"intent": "order",
		// WAJIB: category
		"category": []map[string]interface{}{
			{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/medicationrequest-category",
						"code":    categoryCode,
						"display": categoryDisplay,
					},
				},
			},
		},
		// WAJIB: priority
		"priority": "routine",
		"medicationReference": map[string]interface{}{
			"reference": "#" + medicationID,
			"display":   params.MedicationName,
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + params.PatientIHS,
			"display":   params.PatientName,
		},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + params.EncounterID,
		},
		"authoredOn": params.AuthoredOn,
		"requester": map[string]interface{}{
			"reference": "Practitioner/" + params.PractitionerIHS,
			"display":   params.PractitionerName,
		},
	}

	// Add reasonReference if diagnosis available
	if params.DiagnosisConditionID != "" {
		reasonRef := map[string]interface{}{
			"reference": "Condition/" + params.DiagnosisConditionID,
		}
		if params.DiagnosisDisplay != "" {
			reasonRef["display"] = params.DiagnosisDisplay
		}
		medRequest["reasonReference"] = []map[string]interface{}{reasonRef}
	}

	// Add courseOfTherapyType
	medRequest["courseOfTherapyType"] = map[string]interface{}{
		"coding": []map[string]interface{}{
			{
				"system":  "http://terminology.hl7.org/CodeSystem/medicationrequest-course-of-therapy",
				"code":    "acute",
				"display": "Short course (acute) therapy",
			},
		},
	}

	// Build dosage instruction
	patientInstruction := params.Dosage
	if patientInstruction == "" && params.Frequency != "" {
		patientInstruction = params.Frequency
	}

	dosageInstruction := map[string]interface{}{
		"sequence":           1,
		"patientInstruction": patientInstruction,
	}

	// Add additionalInstruction
	dosageInstruction["additionalInstruction"] = []map[string]interface{}{
		{
			"coding": []map[string]interface{}{
				{
					"system":  "http://snomed.info/sct",
					"code":    "421769005",
					"display": "Follow directions",
				},
			},
		},
	}

	// Parse frequency (e.g., "3x1" -> 3 times per day)
	if params.Frequency != "" {
		var timesPerDay int
		fmt.Sscanf(params.Frequency, "%dx", &timesPerDay)
		if timesPerDay > 0 {
			dosageInstruction["timing"] = map[string]interface{}{
				"repeat": map[string]interface{}{
					"frequency":  timesPerDay,
					"period":     1,
					"periodUnit": "d",
				},
			}
		}
	}

	// Route of administration
	routeCode, routeDisplay := mapRouteCode(params.Route)
	dosageInstruction["route"] = map[string]interface{}{
		"coding": []map[string]interface{}{
			{
				"system":  "http://www.whocc.no/atc",
				"code":    routeCode,
				"display": routeDisplay,
			},
		},
	}

	// Dose quantity with proper system and code
	dosageInstruction["doseAndRate"] = []map[string]interface{}{
		{
			"type": map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/dose-rate-type",
						"code":    "ordered",
						"display": "Ordered",
					},
				},
			},
			"doseQuantity": map[string]interface{}{
				"value":  1,
				"unit":   unitDisplay,
				"system": unitSystem,
				"code":   unitCode,
			},
		},
	}

	medRequest["dosageInstruction"] = []map[string]interface{}{dosageInstruction}

	// Dispense request - WAJIB dengan system dan code yang benar
	if params.Quantity > 0 {
		dispenseRequest := map[string]interface{}{
			"dispenseInterval": map[string]interface{}{
				"value":  1,
				"unit":   "days",
				"system": "http://unitsofmeasure.org",
				"code":   "d",
			},
			"validityPeriod": map[string]interface{}{
				"start": params.AuthoredOn,
				"end":   params.AuthoredOn, // Same day for now
			},
			"numberOfRepeatsAllowed": 0,
			"quantity": map[string]interface{}{
				"value":  params.Quantity,
				"unit":   unitDisplay,
				"system": unitSystem,
				"code":   unitCode,
			},
			"performer": map[string]interface{}{
				"reference": "Organization/" + params.OrganizationID,
			},
		}

		if params.Duration > 0 {
			dispenseRequest["expectedSupplyDuration"] = map[string]interface{}{
				"value":  params.Duration,
				"unit":   "days",
				"system": "http://unitsofmeasure.org",
				"code":   "d",
			}
		}

		medRequest["dispenseRequest"] = dispenseRequest
	}

	// Add notes if available
	if params.Notes != "" {
		medRequest["note"] = []map[string]interface{}{
			{"text": params.Notes},
		}
	}

	return medRequest
}

// mapMedicationForm maps local form to SatuSehat medication-form code
func mapMedicationForm(form string) (code string, display string) {
	formMap := map[string][]string{
		"tablet":       {"BS001", "Tablet"},
		"tab":          {"BS001", "Tablet"},
		"kapsul":       {"BS002", "Kapsul"},
		"capsule":      {"BS002", "Kapsul"},
		"cap":          {"BS002", "Kapsul"},
		"sirup":        {"BS006", "Sirup"},
		"syrup":        {"BS006", "Sirup"},
		"injeksi":      {"BS013", "Injeksi"},
		"injection":    {"BS013", "Injeksi"},
		"inj":          {"BS013", "Injeksi"},
		"salep":        {"BS020", "Salep"},
		"ointment":     {"BS020", "Salep"},
		"krim":         {"BS021", "Krim"},
		"cream":        {"BS021", "Krim"},
		"tetes":        {"BS023", "Tetes"},
		"drop":         {"BS023", "Tetes"},
		"infus":        {"BS035", "Infus"},
		"infusion":     {"BS035", "Infus"},
		"suppositoria": {"BS027", "Suppositoria"},
		"suppo":        {"BS027", "Suppositoria"},
		"inhaler":      {"BS031", "Inhaler"},
		"patch":        {"BS033", "Patch"},
		"puyer":        {"BS004", "Serbuk"},
		"powder":       {"BS004", "Serbuk"},
	}

	formLower := strings.ToLower(form)
	if mapping, exists := formMap[formLower]; exists {
		return mapping[0], mapping[1]
	}

	// Default to tablet
	return "BS001", "Tablet"
}

// mapUnitToCode maps unit to SNOMED or drug form code
func mapUnitToCode(unit string) (code string, system string, display string) {
	unitLower := strings.ToLower(unit)

	// Map to v3-orderableDrugForm system
	drugFormMap := map[string][]string{
		"tablet":  {"TAB", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Tablet"},
		"tab":     {"TAB", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Tablet"},
		"kapsul":  {"CAP", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Capsule"},
		"capsule": {"CAP", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Capsule"},
		"cap":     {"CAP", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Capsule"},
		"ampul":   {"AMP", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Ampule"},
		"ampule":  {"AMP", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Ampule"},
		"vial":    {"VIAL", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Vial"},
	}

	// Map to SNOMED CT
	snomedMap := map[string][]string{
		"botol":   {"419672006", "http://snomed.info/sct", "Bottle - unit of product usage"},
		"bottle":  {"419672006", "http://snomed.info/sct", "Bottle - unit of product usage"},
		"tube":    {"733015002", "http://snomed.info/sct", "Tube"},
		"sachet":  {"733013009", "http://snomed.info/sct", "Sachet"},
		"strip":   {"732936001", "http://snomed.info/sct", "Strip"},
		"bungkus": {"733013009", "http://snomed.info/sct", "Sachet"},
		"ml":      {"258773002", "http://snomed.info/sct", "Milliliter"},
	}

	if mapping, exists := drugFormMap[unitLower]; exists {
		return mapping[0], mapping[1], mapping[2]
	}

	if mapping, exists := snomedMap[unitLower]; exists {
		return mapping[0], mapping[1], mapping[2]
	}

	// Default to tablet
	return "TAB", "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "Tablet"
}

// mapRouteCode maps route to WHO ATC code
func mapRouteCode(route string) (code string, display string) {
	routeLower := strings.ToLower(route)

	routeMap := map[string][]string{
		"oral":          {"O", "Oral"},
		"o":             {"O", "Oral"},
		"iv":            {"P", "Parenteral"},
		"intravena":     {"P", "Parenteral"},
		"intravenous":   {"P", "Parenteral"},
		"im":            {"P", "Parenteral"},
		"intramuskular": {"P", "Parenteral"},
		"intramuscular": {"P", "Parenteral"},
		"sc":            {"P", "Parenteral"},
		"subkutan":      {"P", "Parenteral"},
		"subcutaneous":  {"P", "Parenteral"},
		"topikal":       {"D", "Dermal"},
		"topical":       {"D", "Dermal"},
		"rektal":        {"R", "Rectal"},
		"rectal":        {"R", "Rectal"},
		"inhalasi":      {"R", "Inhalation"},
		"inhalation":    {"R", "Inhalation"},
		"nasal":         {"N", "Nasal"},
		"mata":          {"S", "Ophthalmic"},
		"ophthalmic":    {"S", "Ophthalmic"},
		"telinga":       {"S", "Otic"},
		"otic":          {"S", "Otic"},
	}

	if mapping, exists := routeMap[routeLower]; exists {
		return mapping[0], mapping[1]
	}

	// Default to Oral
	return "O", "Oral"
}

// mapMedicationRoute is an alias for mapRouteCode
func mapMedicationRoute(route string) (code string, display string) {
	return mapRouteCode(route)
}

// ============================================================================
// MEDICATION DISPENSE - Pengeluaran Obat ke Pasien
// Reference: SatuSehat Playbook Kefarmasian V1.3
// ============================================================================

// MedicationDispenseParams contains all parameters for building MedicationDispense
type MedicationDispenseParams struct {
	PatientIHS             string
	PatientName            string
	EncounterID            string
	PractitionerIHS        string // Pharmacist IHS
	PractitionerName       string // Pharmacist Name
	LocationID             string // Pharmacy Location ID
	LocationName           string // Pharmacy Location Name
	MedicationRequestID    string // Reference to MedicationRequest
	KFACode                string
	MedicationName         string
	MedicationForm         string
	Quantity               int
	Unit                   string
	Dosage                 string
	Frequency              string
	Route                  string
	Duration               int
	OrganizationID         string
	PrescriptionNumber     string
	DispenseNumber         string
	WhenPrepared           string
	WhenHandedOver         string
	Category               string // outpatient, inpatient, community
	IsSubstituted          bool
	SubstitutionReasonCode string
	SubstitutionReasonText string
}

// BuildFHIRMedicationDispense builds FHIR MedicationDispense resource according to SatuSehat spec
func BuildFHIRMedicationDispense(params MedicationDispenseParams) map[string]interface{} {
	// Generate medication ID for contained resource
	medicationID := params.DispenseNumber + "-med"

	// Map medication form to code
	formCode, formDisplay := mapMedicationForm(params.MedicationForm)

	// Map unit to SNOMED/drug form code
	unitCode, unitSystem, unitDisplay := mapUnitToCode(params.Unit)

	// Contained Medication resource
	medication := map[string]interface{}{
		"resourceType": "Medication",
		"id":           medicationID,
		"meta": map[string]interface{}{
			"profile": []string{
				"https://fhir.kemkes.go.id/r4/StructureDefinition/Medication",
			},
		},
		"identifier": []map[string]interface{}{
			{
				"system": "http://sys-ids.kemkes.go.id/medication/" + params.OrganizationID,
				"use":    "official",
				"value":  medicationID,
			},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://sys-ids.kemkes.go.id/kfa",
					"code":    params.KFACode,
					"display": params.MedicationName,
				},
			},
		},
		"status": "active",
		"extension": []map[string]interface{}{
			{
				"url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
				"valueCodeableConcept": map[string]interface{}{
					"coding": []map[string]interface{}{
						{
							"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-type",
							"code":    "NC",
							"display": "Non-compound",
						},
					},
				},
			},
		},
	}

	// Add form if available
	if formCode != "" {
		medication["form"] = map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-form",
					"code":    formCode,
					"display": formDisplay,
				},
			},
		}
	}

	// Determine category
	categoryCode := "outpatient"
	categoryDisplay := "Outpatient"
	if params.Category != "" {
		categoryCode = params.Category
		switch params.Category {
		case "inpatient":
			categoryDisplay = "Inpatient"
		case "community":
			categoryDisplay = "Community"
		}
	}

	medDispense := map[string]interface{}{
		"resourceType": "MedicationDispense",
		"contained":    []map[string]interface{}{medication},
		"identifier": []map[string]interface{}{
			{
				"system": "http://sys-ids.kemkes.go.id/prescription/" + params.OrganizationID,
				"use":    "official",
				"value":  params.PrescriptionNumber,
			},
			{
				"system": "http://sys-ids.kemkes.go.id/prescription-item/" + params.OrganizationID,
				"use":    "official",
				"value":  params.DispenseNumber,
			},
		},
		"status": "completed",
		"category": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category",
					"code":    categoryCode,
					"display": categoryDisplay,
				},
			},
		},
		"medicationReference": map[string]interface{}{
			"reference": "#" + medicationID,
			"display":   params.MedicationName,
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + params.PatientIHS,
			"display":   params.PatientName,
		},
		"context": map[string]interface{}{
			"reference": "Encounter/" + params.EncounterID,
		},
		"performer": []map[string]interface{}{
			{
				"actor": map[string]interface{}{
					"reference": "Practitioner/" + params.PractitionerIHS,
					"display":   params.PractitionerName,
				},
			},
		},
		"authorizingPrescription": []map[string]interface{}{
			{
				"reference": "MedicationRequest/" + params.MedicationRequestID,
			},
		},
		"quantity": map[string]interface{}{
			"value":  params.Quantity,
			"unit":   unitDisplay,
			"system": unitSystem,
			"code":   unitCode,
		},
		"whenPrepared":   params.WhenPrepared,
		"whenHandedOver": params.WhenHandedOver,
	}

	// Add location if available
	if params.LocationID != "" {
		medDispense["location"] = map[string]interface{}{
			"reference": "Location/" + params.LocationID,
			"display":   params.LocationName,
		}
	}

	// Add days supply if duration is available
	if params.Duration > 0 {
		medDispense["daysSupply"] = map[string]interface{}{
			"value":  params.Duration,
			"unit":   "days",
			"system": "http://unitsofmeasure.org",
			"code":   "d",
		}
	}

	// Build dosage instruction
	patientInstruction := params.Dosage
	if patientInstruction == "" && params.Frequency != "" {
		patientInstruction = params.Frequency
	}

	dosageInstruction := map[string]interface{}{
		"sequence": 1,
		"text":     patientInstruction,
	}

	// Parse frequency (e.g., "3x1" -> 3 times per day)
	if params.Frequency != "" {
		var timesPerDay int
		fmt.Sscanf(params.Frequency, "%dx", &timesPerDay)
		if timesPerDay > 0 {
			dosageInstruction["timing"] = map[string]interface{}{
				"repeat": map[string]interface{}{
					"frequency":  timesPerDay,
					"period":     1,
					"periodUnit": "d",
				},
			}
		}
	}

	// Route of administration
	routeCode, routeDisplay := mapRouteToAtcCode(params.Route)
	dosageInstruction["route"] = map[string]interface{}{
		"coding": []map[string]interface{}{
			{
				"system":  "http://www.whocc.no/atc",
				"code":    routeCode,
				"display": routeDisplay,
			},
		},
	}

	// Dose quantity
	dosageInstruction["doseAndRate"] = []map[string]interface{}{
		{
			"type": map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/dose-rate-type",
						"code":    "ordered",
						"display": "Ordered",
					},
				},
			},
			"doseQuantity": map[string]interface{}{
				"value":  1,
				"unit":   unitDisplay,
				"system": unitSystem,
				"code":   unitCode,
			},
		},
	}

	medDispense["dosageInstruction"] = []map[string]interface{}{dosageInstruction}

	// Add substitution if applicable
	if params.IsSubstituted {
		substitution := map[string]interface{}{
			"wasSubstituted": true,
			"type": map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
						"code":    "G", // Generic substitution
						"display": "generic composition",
					},
				},
			},
		}

		if params.SubstitutionReasonCode != "" || params.SubstitutionReasonText != "" {
			reasonCoding := []map[string]interface{}{}
			if params.SubstitutionReasonCode != "" {
				reasonCoding = append(reasonCoding, map[string]interface{}{
					"system":  "http://terminology.hl7.org/CodeSystem/v3-ActReason",
					"code":    params.SubstitutionReasonCode,
					"display": params.SubstitutionReasonText,
				})
			}
			substitution["reason"] = []map[string]interface{}{
				{
					"coding": reasonCoding,
					"text":   params.SubstitutionReasonText,
				},
			}
		}

		medDispense["substitution"] = substitution
	} else {
		medDispense["substitution"] = map[string]interface{}{
			"wasSubstituted": false,
			"type": map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
						"code":    "N",
						"display": "none",
					},
				},
			},
		}
	}

	return medDispense
}

// mapRouteToHl7Code maps route to HL7 v3 RouteOfAdministration code
func mapRouteToHl7Code(route string) (code string, display string) {
	routeLower := strings.ToLower(route)

	routeMap := map[string][]string{
		"oral":          {"PO", "Oral"},
		"o":             {"PO", "Oral"},
		"iv":            {"IV", "Intravenous"},
		"intravena":     {"IV", "Intravenous"},
		"intravenous":   {"IV", "Intravenous"},
		"im":            {"IM", "Intramuscular"},
		"intramuskular": {"IM", "Intramuscular"},
		"intramuscular": {"IM", "Intramuscular"},
		"sc":            {"SC", "Subcutaneous"},
		"subkutan":      {"SC", "Subcutaneous"},
		"subcutaneous":  {"SC", "Subcutaneous"},
		"topikal":       {"TOP", "Topical"},
		"topical":       {"TOP", "Topical"},
		"rektal":        {"PR", "Rectal"},
		"rectal":        {"PR", "Rectal"},
		"inhalasi":      {"IPINHL", "Inhalation"},
		"inhalation":    {"IPINHL", "Inhalation"},
		"nasal":         {"NASINHL", "Nasal"},
		"mata":          {"OPTHALTA", "Ophthalmic"},
		"ophthalmic":    {"OPTHALTA", "Ophthalmic"},
		"telinga":       {"OT", "Otic"},
		"otic":          {"OT", "Otic"},
		"sublingual":    {"SL", "Sublingual"},
	}

	if mapping, exists := routeMap[routeLower]; exists {
		return mapping[0], mapping[1]
	}

	// Default to Oral
	return "PO", "Oral"
}

// mapRouteToAtcCode maps route to WHO ATC RouteOfAdministration code
// Based on http://www.whocc.no/atc - used by SatuSehat
func mapRouteToAtcCode(route string) (code string, display string) {
	routeLower := strings.ToLower(route)

	// WHO ATC Route codes used by SatuSehat
	routeMap := map[string][]string{
		"oral":          {"O", "Oral"},
		"o":             {"O", "Oral"},
		"iv":            {"P", "Parenteral"},
		"intravena":     {"P", "Parenteral"},
		"intravenous":   {"P", "Parenteral"},
		"im":            {"inj.intramuscular", "Injection Intramuscular"},
		"intramuskular": {"inj.intramuscular", "Injection Intramuscular"},
		"intramuscular": {"inj.intramuscular", "Injection Intramuscular"},
		"sc":            {"inj.subcutaneous", "Injection Subcutaneous"},
		"subkutan":      {"inj.subcutaneous", "Injection Subcutaneous"},
		"subcutaneous":  {"inj.subcutaneous", "Injection Subcutaneous"},
		"topikal":       {"TD", "Transdermal"},
		"topical":       {"TD", "Transdermal"},
		"rektal":        {"R", "Rectal"},
		"rectal":        {"R", "Rectal"},
		"inhalasi":      {"N", "Nasal"},
		"inhalation":    {"N", "Nasal"},
		"nasal":         {"N", "Nasal"},
		"mata":          {"S", "Ophthalmic"},
		"ophthalmic":    {"S", "Ophthalmic"},
		"telinga":       {"S", "Ophthalmic"},
		"otic":          {"S", "Ophthalmic"},
		"sublingual":    {"SL", "Sublingual"},
		"parenteral":    {"P", "Parenteral"},
		"injeksi":       {"P", "Parenteral"},
		"injection":     {"P", "Parenteral"},
	}

	if mapping, exists := routeMap[routeLower]; exists {
		return mapping[0], mapping[1]
	}

	// Default to Oral
	return "O", "Oral"
}

// SendMedicationDispenseToSatuSehat sends medication dispense data to SatuSehat
// POST /api/integrations/satusehat/medication-dispense/:id/send
// :id = medicine_order_item_id
func SendMedicationDispenseToSatuSehat(c *gin.Context) {
	medicineOrderItemID := c.Param("id")

	log.Printf("[MEDICATION DISPENSE] Starting for item ID: %s", medicineOrderItemID)

	// Get medicine order item with all related data
	var item models.MedicineOrderItem
	if err := database.DB.
		Preload("DispensedBy").
		Preload("MedicineOrder").
		Preload("MedicineOrder.Registration").
		Preload("MedicineOrder.Registration.Patient").
		Preload("MedicineOrder.SourceVisit").
		Preload("MedicineOrder.SourceVisit.Room").
		Preload("MedicineOrder.PharmacyVisit").
		Preload("MedicineOrder.PharmacyRoom").
		Preload("MedicineOrder.Prescriber").
		Preload("MedicineOrder.DeliveredBy").
		Preload("Medicine").
		First(&item, medicineOrderItemID).Error; err != nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: Item not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order item not found"})
		return
	}

	// Check if item has been dispensed
	if item.Status != models.ItemStatusDelivered && item.DispensedQty == 0 {
		log.Printf("[MEDICATION DISPENSE] ERROR: Item not yet dispensed")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item belum di-dispense"})
		return
	}

	// Check if MedicationRequest already sent
	if item.SatusehatMedicationRequestID == "" {
		log.Printf("[MEDICATION DISPENSE] ERROR: MedicationRequest not yet sent")
		c.JSON(http.StatusBadRequest, gin.H{"error": "MedicationRequest harus dikirim terlebih dahulu"})
		return
	}

	// Check if already sent
	if item.SatusehatMedicationDispenseID != "" {
		log.Printf("[MEDICATION DISPENSE] Already sent: %s", item.SatusehatMedicationDispenseID)
		c.JSON(http.StatusOK, gin.H{
			"message":                          "MedicationDispense sudah pernah dikirim",
			"satusehat_medication_dispense_id": item.SatusehatMedicationDispenseID,
		})
		return
	}

	order := item.MedicineOrder
	if order == nil || order.Registration == nil || order.Registration.Patient == nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: Invalid order data")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data order tidak lengkap"})
		return
	}

	patient := order.Registration.Patient

	// Get Patient IHS Number
	if patient.SatuSehatID == "" {
		log.Printf("[MEDICATION DISPENSE] ERROR: Patient IHS not found")
		c.JSON(http.StatusBadRequest, gin.H{"error": "IHS Number pasien belum tersedia. Silakan lookup terlebih dahulu."})
		return
	}

	// Get Encounter ID from source visit
	if order.SourceVisit == nil || order.SourceVisit.SatuSehatEncounterID == "" {
		log.Printf("[MEDICATION DISPENSE] ERROR: Encounter ID not found")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter ID belum tersedia. Silakan kirim Encounter terlebih dahulu."})
		return
	}

	// Get pharmacist/dispenser IHS - prioritas: item.DispensedBy > order.DeliveredBy > current user
	pharmacistIHS := ""
	pharmacistName := "Apoteker"

	// 1. Coba dari item.DispensedBy (petugas farmasi yang menyerahkan item ini)
	if item.DispensedBy != nil {
		pharmacistIHS = item.DispensedBy.SatuSehatID
		pharmacistName = item.DispensedBy.NamaLengkap
		log.Printf("[MEDICATION DISPENSE] Using item.DispensedBy: %s (%s)", pharmacistName, pharmacistIHS)
	}

	// 2. Fallback ke order.DeliveredBy
	if pharmacistIHS == "" && order.DeliveredBy != nil {
		pharmacistIHS = order.DeliveredBy.SatuSehatID
		pharmacistName = order.DeliveredBy.NamaLengkap
		log.Printf("[MEDICATION DISPENSE] Using order.DeliveredBy: %s (%s)", pharmacistName, pharmacistIHS)
	}

	// 3. Fallback ke current user (yang sedang mengirim ke SatuSehat)
	if pharmacistIHS == "" {
		userIDVal, exists := c.Get("userID")
		if exists && userIDVal != nil {
			userID := userIDVal.(uint)
			var user models.User
			if err := database.DB.Preload("Employee").First(&user, userID).Error; err == nil && user.Employee != nil {
				pharmacistIHS = user.Employee.SatuSehatID
				pharmacistName = user.Employee.NamaLengkap
				log.Printf("[MEDICATION DISPENSE] Using current user: %s (%s)", pharmacistName, pharmacistIHS)
			}
		}
	}

	if pharmacistIHS == "" {
		log.Printf("[MEDICATION DISPENSE] ERROR: Pharmacist IHS not found")
		c.JSON(http.StatusBadRequest, gin.H{"error": "IHS Number apoteker belum tersedia. Silakan lookup terlebih dahulu."})
		return
	}

	// Get Organization ID from config
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		log.Printf("[MEDICATION DISPENSE] ERROR: Org ID not found")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Organization ID tidak ditemukan di konfigurasi SatuSehat"})
		return
	}

	// Get pharmacy location ID
	locationID := ""
	locationName := "Farmasi"
	if order.PharmacyRoom != nil {
		locationID = order.PharmacyRoom.SatuSehatID
		locationName = order.PharmacyRoom.Name
	}

	// Get KFA code for medicine
	var kfaMapping models.MedicineKFAMapping
	if err := database.DB.Where("medicine_id = ?", item.MedicineID).First(&kfaMapping).Error; err != nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: KFA mapping not found: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mapping KFA untuk obat ini belum tersedia. Silakan mapping terlebih dahulu."})
		return
	}

	// Format timestamps
	whenPrepared := time.Now().Format(time.RFC3339)
	whenHandedOver := time.Now().Format(time.RFC3339)
	if item.DispensedAt != nil {
		whenHandedOver = item.DispensedAt.Format(time.RFC3339)
		whenPrepared = item.DispensedAt.Add(-5 * time.Minute).Format(time.RFC3339) // Assume 5 mins before
	}

	// Parse duration
	duration := 0
	if item.Duration != "" {
		fmt.Sscanf(item.Duration, "%d", &duration)
	}

	// Determine category
	category := "outpatient"
	if order.SourceVisit != nil && order.SourceVisit.Room != nil {
		switch order.SourceVisit.Room.RoomType {
		case "rawat_inap", "inpatient", "icu", "nicu", "picu", "iccu":
			category = "inpatient"
		}
	}

	// Build dispense number
	dispenseNumber := fmt.Sprintf("%s-D-%d", order.OrderNumber, item.ID)

	// Build FHIR MedicationDispense
	medDispense := BuildFHIRMedicationDispense(MedicationDispenseParams{
		PatientIHS:             patient.SatuSehatID,
		PatientName:            patient.NamaLengkap,
		EncounterID:            order.SourceVisit.SatuSehatEncounterID,
		PractitionerIHS:        pharmacistIHS,
		PractitionerName:       pharmacistName,
		LocationID:             locationID,
		LocationName:           locationName,
		MedicationRequestID:    item.SatusehatMedicationRequestID,
		KFACode:                kfaMapping.KFACode,
		MedicationName:         item.Medicine.Name,
		MedicationForm:         kfaMapping.KFAForm,
		Quantity:               item.DispensedQty,
		Unit:                   item.Unit,
		Dosage:                 item.Dosage,
		Frequency:              item.Frequency,
		Route:                  item.Route,
		Duration:               duration,
		OrganizationID:         orgID,
		PrescriptionNumber:     order.OrderNumber,
		DispenseNumber:         dispenseNumber,
		WhenPrepared:           whenPrepared,
		WhenHandedOver:         whenHandedOver,
		Category:               category,
		IsSubstituted:          item.IsSubstituted,
		SubstitutionReasonCode: "RR",
		SubstitutionReasonText: item.SubstitutionReason,
	})

	log.Printf("[MEDICATION DISPENSE] Sending to SatuSehat...")

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/MedicationDispense", medDispense)
	if err != nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: Request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION DISPENSE] Response [%d]: %s", statusCode, string(body))

	if statusCode != http.StatusCreated && statusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		log.Printf("[MEDICATION DISPENSE] ERROR: SatuSehat rejected with status %d", statusCode)
		c.JSON(statusCode, gin.H{
			"error":              "SatuSehat menolak request",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: Failed to parse response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	medicationDispenseID, ok := fhirResponse["id"].(string)
	if !ok {
		log.Printf("[MEDICATION DISPENSE] ERROR: No ID in response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Response tidak mengandung ID"})
		return
	}

	log.Printf("[MEDICATION DISPENSE] SUCCESS: Got ID %s", medicationDispenseID)

	// Update medicine order item with SatuSehat ID
	item.SatusehatMedicationDispenseID = medicationDispenseID
	if err := database.DB.Save(&item).Error; err != nil {
		log.Printf("[MEDICATION DISPENSE] ERROR: Failed to save ID: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ID SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION DISPENSE] Completed successfully for item %s", medicineOrderItemID)

	c.JSON(http.StatusOK, gin.H{
		"message":                          "Dispense obat berhasil dikirim ke SatuSehat",
		"satusehat_medication_dispense_id": medicationDispenseID,
		"fhir_response":                    fhirResponse,
	})
}

// SendAllMedicationDispensesToSatuSehat sends all dispensed items for an order
// POST /api/integrations/satusehat/order/:id/send-dispenses
func SendAllMedicationDispensesToSatuSehat(c *gin.Context) {
	orderID := c.Param("id")

	log.Printf("[MEDICATION DISPENSE ALL] Starting for order ID: %s", orderID)

	// Get medicine order with all items
	var order models.MedicineOrder
	if err := database.DB.
		Preload("Items").
		Preload("Items.Medicine").
		First(&order, orderID).Error; err != nil {
		log.Printf("[MEDICATION DISPENSE ALL] ERROR: Order not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	// Check if order has been delivered
	if order.Status != models.OrderStatusDelivered && order.Status != models.OrderStatusPartial {
		log.Printf("[MEDICATION DISPENSE ALL] ERROR: Order not yet dispensed")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order belum di-dispense"})
		return
	}

	results := []map[string]interface{}{}
	successCount := 0
	errorCount := 0

	for _, item := range order.Items {
		// Skip items not dispensed or already sent
		if item.DispensedQty == 0 {
			continue
		}

		if item.SatusehatMedicationDispenseID != "" {
			results = append(results, map[string]interface{}{
				"item_id":                          item.ID,
				"medicine_name":                    item.Medicine.Name,
				"status":                           "already_sent",
				"satusehat_medication_dispense_id": item.SatusehatMedicationDispenseID,
			})
			successCount++
			continue
		}

		if item.SatusehatMedicationRequestID == "" {
			results = append(results, map[string]interface{}{
				"item_id":       item.ID,
				"medicine_name": item.Medicine.Name,
				"status":        "error",
				"message":       "MedicationRequest belum dikirim",
			})
			errorCount++
			continue
		}

		// Create a mock context to call individual send function
		// For now, we'll just mark for later processing
		results = append(results, map[string]interface{}{
			"item_id":       item.ID,
			"medicine_name": item.Medicine.Name,
			"status":        "pending",
			"message":       "Gunakan endpoint individual untuk mengirim",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Proses pengiriman dispense",
		"success_count": successCount,
		"error_count":   errorCount,
		"results":       results,
	})
}

// ============================================================================
// QUESTIONNAIRE RESPONSE (PENGKAJIAN RESEP)
// ============================================================================

// QuestionnaireResponseParams contains parameters for building FHIR QuestionnaireResponse
type QuestionnaireResponseParams struct {
	EncounterID       string
	PatientID         string
	PatientName       string
	PractitionerID    string
	PractitionerName  string
	AuthoredDate      string // YYYY-MM-DDTHH:MM:SS+07:00
	MedicationRequest string // MedicationRequest ID reference

	// Prescription Review Data from SIMRS (Telaah Resep)
	DrugInteractionCheck  bool // Cek interaksi obat - maps to 3.5
	DoseCheck             bool // Cek dosis - maps to 2.2 and 3.1
	DuplicationCheck      bool // Cek duplikasi - maps to 3.2
	AllergyCheck          bool // Cek alergi - maps to 3.3
	ContraindicationCheck bool // Cek kontraindikasi - maps to 3.4
	IndicationCheck       bool // Cek indikasi - maps to 3.1
	IsApproved            bool // Final approval status
}

// BuildFHIRQuestionnaireResponse builds FHIR QuestionnaireResponse for prescription assessment
// Based on SatuSehat Questionnaire Q0007 - Pengkajian Resep
// This function now uses actual prescription review data from SIMRS PrescriptionReview
func BuildFHIRQuestionnaireResponse(params QuestionnaireResponseParams) map[string]interface{} {
	// Helper function to get answer coding based on approval/check status
	getSesuaiCoding := func(isOK bool) map[string]interface{} {
		if isOK {
			return map[string]interface{}{
				"valueCoding": map[string]interface{}{
					"system":  "http://terminology.kemkes.go.id/CodeSystem/clinical-term",
					"code":    "OV000052",
					"display": "Sesuai",
				},
			}
		}
		return map[string]interface{}{
			"valueCoding": map[string]interface{}{
				"system":  "http://terminology.kemkes.go.id/CodeSystem/clinical-term",
				"code":    "OV000053",
				"display": "Tidak Sesuai",
			},
		}
	}

	// Build items sesuai dengan Questionnaire Q0007 - Pengkajian Resep
	// Mapping from SIMRS PrescriptionReview:
	// - IsApproved -> 1.x (Administrasi) - jika disetujui berarti semua administrasi OK
	// - DoseCheck -> 2.2 (dosis dan jumlah obat) & 3.1 (ketepatan dosis)
	// - IsApproved -> 2.x (Farmasetik) - jika disetujui berarti farmasetik OK
	// - IndicationCheck + DoseCheck -> 3.1 (ketepatan indikasi, dosis)
	// - DuplicationCheck -> 3.2 (duplikasi) - inverted: checklist true means no duplication found
	// - AllergyCheck -> 3.3 (alergi) - inverted: checklist true means no allergy issue
	// - ContraindicationCheck -> 3.4 (kontraindikasi) - inverted: checklist true means no contraindication
	// - DrugInteractionCheck -> 3.5 (interaksi obat) - inverted: checklist true means no interaction issue

	items := []map[string]interface{}{
		{
			"linkId": "1",
			"text":   "Persyaratan Administrasi",
			"item": []map[string]interface{}{
				{
					"linkId": "1.1",
					"text":   "Apakah nama, umur, jenis kelamin, berat badan dan tinggi badan pasien sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
				{
					"linkId": "1.2",
					"text":   "Apakah nama, nomor ijin, alamat dan paraf dokter sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
				{
					"linkId": "1.3",
					"text":   "Apakah tanggal resep sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
				{
					"linkId": "1.4",
					"text":   "Apakah ruangan/unit asal resep sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
			},
		},
		{
			"linkId": "2",
			"text":   "Persyaratan Farmasetik",
			"item": []map[string]interface{}{
				{
					"linkId": "2.1",
					"text":   "Apakah nama obat, bentuk dan kekuatan sediaan sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
				{
					"linkId": "2.2",
					"text":   "Apakah dosis dan jumlah obat sudah sesuai?",
					"answer": []map[string]interface{}{
						// Uses DoseCheck from SIMRS - if checked, dose is verified OK
						getSesuaiCoding(params.DoseCheck),
					},
				},
				{
					"linkId": "2.3",
					"text":   "Apakah stabilitas obat sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
				{
					"linkId": "2.4",
					"text":   "Apakah aturan dan cara penggunaan obat sudah sesuai?",
					"answer": []map[string]interface{}{
						getSesuaiCoding(params.IsApproved),
					},
				},
			},
		},
		{
			"linkId": "3",
			"text":   "Persyaratan Klinis",
			"item": []map[string]interface{}{
				{
					"linkId": "3.1",
					"text":   "Apakah ketepatan indikasi, dosis, dan waktu penggunaan obat sudah sesuai?",
					"answer": []map[string]interface{}{
						// Uses IndicationCheck AND DoseCheck - both must be true for "Sesuai"
						getSesuaiCoding(params.IndicationCheck && params.DoseCheck),
					},
				},
				{
					"linkId": "3.2",
					"text":   "Apakah terdapat duplikasi pengobatan?",
					"answer": []map[string]interface{}{
						// DuplicationCheck=true means pharmacist verified NO duplication (negative question)
						// So we invert: if checked=true, answer is false (no duplication found)
						{"valueBoolean": !params.DuplicationCheck},
					},
				},
				{
					"linkId": "3.3",
					"text":   "Apakah terdapat alergi dan reaksi obat yang tidak dikehendaki (ROTD)?",
					"answer": []map[string]interface{}{
						// AllergyCheck=true means pharmacist verified NO allergy issue
						// So we invert: if checked=true, answer is false (no allergy found)
						{"valueBoolean": !params.AllergyCheck},
					},
				},
				{
					"linkId": "3.4",
					"text":   "Apakah terdapat kontraindikasi pengobatan?",
					"answer": []map[string]interface{}{
						// ContraindicationCheck=true means pharmacist verified NO contraindication
						// So we invert: if checked=true, answer is false (no contraindication found)
						{"valueBoolean": !params.ContraindicationCheck},
					},
				},
				{
					"linkId": "3.5",
					"text":   "Apakah terdapat dampak interaksi obat?",
					"answer": []map[string]interface{}{
						// DrugInteractionCheck=true means pharmacist verified NO drug interaction
						// So we invert: if checked=true, answer is false (no interaction found)
						{"valueBoolean": !params.DrugInteractionCheck},
					},
				},
			},
		},
	}

	// Add linkId 4 with reference to MedicationRequest (not basedOn!)
	// This is the correct way to reference MedicationRequest in QuestionnaireResponse
	if params.MedicationRequest != "" {
		items = append(items, map[string]interface{}{
			"linkId": "4",
			"text":   "Resep yang dilakukan pengkajian resep",
			"answer": []map[string]interface{}{
				{
					"valueReference": map[string]interface{}{
						"reference": "MedicationRequest/" + params.MedicationRequest,
					},
				},
			},
		})
	}

	questionnaireResponse := map[string]interface{}{
		"resourceType":  "QuestionnaireResponse",
		"questionnaire": "https://fhir.kemkes.go.id/Questionnaire/Q0007", // Pengkajian Resep
		"status":        "completed",
		"subject": map[string]interface{}{
			"reference": "Patient/" + params.PatientID,
			"display":   params.PatientName,
		},
		"encounter": map[string]interface{}{
			"reference": "Encounter/" + params.EncounterID,
		},
		"authored": params.AuthoredDate,
		"author": map[string]interface{}{
			"reference": "Practitioner/" + params.PractitionerID,
			"display":   params.PractitionerName,
		},
		"source": map[string]interface{}{
			"reference": "Patient/" + params.PatientID,
		},
		"item": items,
	}

	return questionnaireResponse
}

// ============================================================================
// MEDICATION ADMINISTRATION (PEMBERIAN OBAT)
// ============================================================================

// MedicationAdministrationParams contains parameters for building FHIR MedicationAdministration
type MedicationAdministrationParams struct {
	OrganizationID      string
	EncounterID         string
	PatientID           string
	PractitionerID      string
	MedicationRequestID string
	// Medication details (contained)
	KFACode        string
	MedicationName string
	MedicationForm string
	// Administration details
	Status        string // completed, in-progress, not-done, on-hold, stopped
	EffectiveTime string // When administered (YYYY-MM-DDTHH:MM:SS+07:00)
	DoseValue     float64
	DoseUnit      string
	RouteCode     string // Route of administration
	RouteDisplay  string
	Note          string // Additional notes
}

// BuildFHIRMedicationAdministration builds FHIR MedicationAdministration resource
func BuildFHIRMedicationAdministration(params MedicationAdministrationParams) map[string]interface{} {
	// Build contained medication
	formCode, formDisplay := mapMedicationForm(params.MedicationForm)

	containedMedication := map[string]interface{}{
		"resourceType": "Medication",
		"id":           "med-contained",
		"meta": map[string]interface{}{
			"profile": []string{
				"https://fhir.kemkes.go.id/r4/StructureDefinition/Medication",
			},
		},
		"identifier": []map[string]interface{}{
			{
				"use":    "official",
				"system": "http://sys-ids.kemkes.go.id/medication/" + params.OrganizationID,
				"value":  params.KFACode,
			},
		},
		"code": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://sys-ids.kemkes.go.id/kfa",
					"code":    params.KFACode,
					"display": params.MedicationName,
				},
			},
		},
		"status": "active",
		"form": map[string]interface{}{
			"coding": []map[string]interface{}{
				{
					"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-form",
					"code":    formCode,
					"display": formDisplay,
				},
			},
		},
		"extension": []map[string]interface{}{
			{
				"url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
				"valueCodeableConcept": map[string]interface{}{
					"coding": []map[string]interface{}{
						{
							"system":  "http://terminology.kemkes.go.id/CodeSystem/medication-type",
							"code":    "NC",
							"display": "Non-compound",
						},
					},
				},
			},
		},
	}

	// Build MedicationAdministration
	status := params.Status
	if status == "" {
		status = "completed"
	}

	medicationAdmin := map[string]interface{}{
		"resourceType": "MedicationAdministration",
		"contained":    []map[string]interface{}{containedMedication},
		"status":       status,
		"medicationReference": map[string]interface{}{
			"reference": "#med-contained",
			"display":   params.MedicationName,
		},
		"subject": map[string]interface{}{
			"reference": "Patient/" + params.PatientID,
		},
		"context": map[string]interface{}{
			"reference": "Encounter/" + params.EncounterID,
		},
		"effectiveDateTime": params.EffectiveTime,
		"performer": []map[string]interface{}{
			{
				"actor": map[string]interface{}{
					"reference": "Practitioner/" + params.PractitionerID,
				},
			},
		},
	}

	// Add request reference if provided
	if params.MedicationRequestID != "" {
		medicationAdmin["request"] = map[string]interface{}{
			"reference": "MedicationRequest/" + params.MedicationRequestID,
		}
	}

	// Add dosage
	if params.DoseValue > 0 {
		dosage := map[string]interface{}{
			"dose": map[string]interface{}{
				"value":  params.DoseValue,
				"unit":   params.DoseUnit,
				"system": "http://unitsofmeasure.org",
				"code":   params.DoseUnit,
			},
		}

		// Add route if provided
		if params.RouteCode != "" {
			routeCode, routeDisplay := mapMedicationRoute(params.RouteCode)
			if params.RouteDisplay != "" {
				routeDisplay = params.RouteDisplay
			}
			dosage["route"] = map[string]interface{}{
				"coding": []map[string]interface{}{
					{
						"system":  "http://www.whocc.no/atc",
						"code":    routeCode,
						"display": routeDisplay,
					},
				},
			}
		}

		medicationAdmin["dosage"] = dosage
	}

	// Add note if provided
	if params.Note != "" {
		medicationAdmin["note"] = []map[string]interface{}{
			{"text": params.Note},
		}
	}

	return medicationAdmin
}

// SendQuestionnaireResponseToSatuSehat sends prescription assessment (pengkajian resep)
// @Summary Send QuestionnaireResponse to SatuSehat
// @Description Sends prescription assessment as FHIR QuestionnaireResponse
// @Tags SatuSehat-FHIR
// @Accept json
// @Produce json
// @Param medicine_order_id path string true "Medicine Order ID"
// @Success 200 {object} map[string]interface{}
// @Router /satusehat/fhir/medicine-order/{medicine_order_id}/questionnaire-response [post]
func SendQuestionnaireResponseToSatuSehat(c *gin.Context) {
	orderID := c.Param("medicine_order_id")

	log.Printf("[QUESTIONNAIRE_RESPONSE] Starting for order ID: %s", orderID)

	// Get medicine order with related data
	var order models.MedicineOrder
	if err := database.DB.Preload("SourceVisit.Registration.Patient").
		Preload("Prescriber").
		Preload("ReviewedBy").
		First(&order, orderID).Error; err != nil {
		log.Printf("[QUESTIONNAIRE_RESPONSE] ERROR: Order not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Order obat tidak ditemukan"})
		return
	}

	// Validate prerequisites
	if order.SourceVisit == nil || order.SourceVisit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	patientID := ""
	if order.SourceVisit.Registration != nil && order.SourceVisit.Registration.Patient != nil {
		patientID = order.SourceVisit.Registration.Patient.SatuSehatID
	}
	if patientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum terdaftar di SatuSehat"})
		return
	}

	// Get pharmacist ID (person who assesses the prescription)
	pharmacistID := ""
	pharmacistName := ""
	if order.ReviewedBy != nil && order.ReviewedBy.SatuSehatID != "" {
		pharmacistID = order.ReviewedBy.SatuSehatID
		pharmacistName = order.ReviewedBy.NamaLengkap
	} else if order.Prescriber != nil && order.Prescriber.SatuSehatID != "" {
		pharmacistID = order.Prescriber.SatuSehatID
		pharmacistName = order.Prescriber.NamaLengkap
	}

	if pharmacistID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas farmasi belum terdaftar di SatuSehat"})
		return
	}

	// Get patient name
	patientName := ""
	if order.SourceVisit.Registration != nil && order.SourceVisit.Registration.Patient != nil {
		patientName = order.SourceVisit.Registration.Patient.NamaLengkap
	}

	// Get one MedicationRequest ID from order items
	var orderItem models.MedicineOrderItem
	if err := database.DB.Where("medicine_order_id = ? AND satusehat_medication_request_id != ''", order.ID).
		First(&orderItem).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak ada MedicationRequest yang sudah dikirim"})
		return
	}

	// Get prescription review data from SIMRS (Telaah Resep)
	var prescriptionReview models.PrescriptionReview
	hasReview := false
	if err := database.DB.Where("medicine_order_id = ?", order.ID).First(&prescriptionReview).Error; err == nil {
		hasReview = true
		log.Printf("[QUESTIONNAIRE_RESPONSE] Found prescription review ID: %d, IsApproved: %v", prescriptionReview.ID, prescriptionReview.IsApproved)
	} else {
		log.Printf("[QUESTIONNAIRE_RESPONSE] WARNING: No prescription review found for order %d, using default values", order.ID)
	}

	// Build questionnaire response params with actual review data
	qrParams := QuestionnaireResponseParams{
		EncounterID:       order.SourceVisit.SatuSehatEncounterID,
		PatientID:         patientID,
		PatientName:       patientName,
		PractitionerID:    pharmacistID,
		PractitionerName:  pharmacistName,
		AuthoredDate:      time.Now().Format("2006-01-02T15:04:05+07:00"),
		MedicationRequest: orderItem.SatusehatMedicationRequestID,
	}

	// If prescription review exists, use actual review data
	if hasReview {
		qrParams.DrugInteractionCheck = prescriptionReview.DrugInteractionCheck
		qrParams.DoseCheck = prescriptionReview.DoseCheck
		qrParams.DuplicationCheck = prescriptionReview.DuplicationCheck
		qrParams.AllergyCheck = prescriptionReview.AllergyCheck
		qrParams.ContraindicationCheck = prescriptionReview.ContraindicationCheck
		qrParams.IndicationCheck = prescriptionReview.IndicationCheck
		qrParams.IsApproved = prescriptionReview.IsApproved
	} else {
		// Default values when no review exists (assume all OK for backward compatibility)
		qrParams.DrugInteractionCheck = true
		qrParams.DoseCheck = true
		qrParams.DuplicationCheck = true
		qrParams.AllergyCheck = true
		qrParams.ContraindicationCheck = true
		qrParams.IndicationCheck = true
		qrParams.IsApproved = true
	}

	// Build questionnaire response
	qr := BuildFHIRQuestionnaireResponse(qrParams)

	log.Printf("[QUESTIONNAIRE_RESPONSE] Sending to SatuSehat...")

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/QuestionnaireResponse", qr)
	if err != nil {
		log.Printf("[QUESTIONNAIRE_RESPONSE] ERROR: Request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[QUESTIONNAIRE_RESPONSE] Response [%d]: %s", statusCode, string(body))

	if statusCode != http.StatusCreated && statusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		c.JSON(statusCode, gin.H{
			"error":              "SatuSehat menolak request",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	qrID, _ := fhirResponse["id"].(string)

	log.Printf("[QUESTIONNAIRE_RESPONSE] SUCCESS: Got ID %s", qrID)

	// Save to database
	order.SatusehatQuestionnaireResponseID = qrID
	if err := database.DB.Save(&order).Error; err != nil {
		log.Printf("[QUESTIONNAIRE_RESPONSE] WARNING: Failed to save ID: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                             "QuestionnaireResponse berhasil dikirim",
		"satusehat_questionnaire_response_id": qrID,
		"fhir_response":                       fhirResponse,
	})
}

// SendMedicationAdministrationToSatuSehat sends medication administration record
// @Summary Send MedicationAdministration to SatuSehat
// @Description Sends medication administration as FHIR MedicationAdministration
// @Tags SatuSehat-FHIR
// @Accept json
// @Produce json
// @Param item_id path string true "Medicine Order Item ID"
// @Success 200 {object} map[string]interface{}
// @Router /satusehat/fhir/medicine-order-item/{item_id}/administration [post]
func SendMedicationAdministrationToSatuSehat(c *gin.Context) {
	itemID := c.Param("item_id")

	log.Printf("[MEDICATION_ADMIN] Starting for item ID: %s", itemID)

	// Get order item with related data
	var item models.MedicineOrderItem
	if err := database.DB.Preload("MedicineOrder.SourceVisit.Registration.Patient").
		Preload("MedicineOrder.Prescriber").
		Preload("MedicineOrder.ReviewedBy").
		Preload("Medicine").
		First(&item, itemID).Error; err != nil {
		log.Printf("[MEDICATION_ADMIN] ERROR: Item not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Item order obat tidak ditemukan"})
		return
	}

	order := item.MedicineOrder

	// Validate prerequisites
	if order == nil || order.SourceVisit == nil || order.SourceVisit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	// MedicationRequest must be sent first
	if item.SatusehatMedicationRequestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "MedicationRequest belum dikirim"})
		return
	}

	patientID := ""
	if order.SourceVisit.Registration != nil && order.SourceVisit.Registration.Patient != nil {
		patientID = order.SourceVisit.Registration.Patient.SatuSehatID
	}
	if patientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum terdaftar di SatuSehat"})
		return
	}

	// Get practitioner who administered
	practitionerID := ""
	if order.ReviewedBy != nil && order.ReviewedBy.SatuSehatID != "" {
		practitionerID = order.ReviewedBy.SatuSehatID
	} else if order.Prescriber != nil && order.Prescriber.SatuSehatID != "" {
		practitionerID = order.Prescriber.SatuSehatID
	}

	if practitionerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Petugas tidak terdaftar di SatuSehat"})
		return
	}

	// Get config
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]

	// Get KFA mapping
	var kfaMapping models.MedicineKFAMapping
	if err := database.DB.Where("medicine_id = ?", item.Medicine.ID).First(&kfaMapping).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Obat belum di-mapping ke KFA"})
		return
	}

	// Build MedicationAdministration
	medAdmin := BuildFHIRMedicationAdministration(MedicationAdministrationParams{
		OrganizationID:      orgID,
		EncounterID:         order.SourceVisit.SatuSehatEncounterID,
		PatientID:           patientID,
		PractitionerID:      practitionerID,
		MedicationRequestID: item.SatusehatMedicationRequestID,
		KFACode:             kfaMapping.KFACode,
		MedicationName:      item.Medicine.Name,
		MedicationForm:      string(item.Medicine.Form),
		Status:              "completed",
		EffectiveTime:       time.Now().Format("2006-01-02T15:04:05+07:00"),
		DoseValue:           float64(item.Quantity),
		DoseUnit:            item.Unit,
		RouteCode:           item.Route,
		Note:                item.Instructions,
	})

	log.Printf("[MEDICATION_ADMIN] Sending to SatuSehat...")

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/MedicationAdministration", medAdmin)
	if err != nil {
		log.Printf("[MEDICATION_ADMIN] ERROR: Request failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim ke SatuSehat: " + err.Error()})
		return
	}

	log.Printf("[MEDICATION_ADMIN] Response [%d]: %s", statusCode, string(body))

	if statusCode != http.StatusCreated && statusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		c.JSON(statusCode, gin.H{
			"error":              "SatuSehat menolak request",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	adminID, _ := fhirResponse["id"].(string)

	log.Printf("[MEDICATION_ADMIN] SUCCESS: Got ID %s", adminID)

	// Save to database
	item.SatusehatMedicationAdministrationID = adminID
	if err := database.DB.Save(&item).Error; err != nil {
		log.Printf("[MEDICATION_ADMIN] WARNING: Failed to save ID: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                                "MedicationAdministration berhasil dikirim",
		"satusehat_medication_administration_id": adminID,
		"fhir_response":                          fhirResponse,
	})
}

// ============================================================================
// Composition (Resume Medis) - FHIR R4
// ============================================================================

// FHIRComposition represents FHIR Composition resource (Resume Medis)
type FHIRComposition struct {
	ResourceType string                   `json:"resourceType"`
	Identifier   *FHIRIdentifier          `json:"identifier,omitempty"`
	Status       string                   `json:"status"`
	Type         *FHIRCodeableConcept     `json:"type"`
	Category     []FHIRCodeableConcept    `json:"category,omitempty"`
	Subject      *FHIRReference           `json:"subject"`
	Encounter    *FHIRReference           `json:"encounter"`
	Date         string                   `json:"date"`
	Author       []FHIRReference          `json:"author"`
	Title        string                   `json:"title"`
	Custodian    *FHIRReference           `json:"custodian,omitempty"`
	Section      []FHIRCompositionSection `json:"section,omitempty"`
}

// FHIRCompositionSection represents a section within Composition
type FHIRCompositionSection struct {
	Title string               `json:"title"`
	Code  *FHIRCodeableConcept `json:"code"`
	Text  *FHIRNarrative       `json:"text,omitempty"`
	Entry []FHIRReference      `json:"entry,omitempty"`
}

// FHIRNarrative represents FHIR Narrative element
type FHIRNarrative struct {
	Status string `json:"status"`
	Div    string `json:"div"`
}

// BuildFHIRCompositionParams contains all data needed to build a Composition
type BuildFHIRCompositionParams struct {
	OrgID           string
	Visit           *models.Visit
	Patient         *models.Patient
	Doctor          *models.Employee
	EncounterID     string
	Complaint       string
	Diagnoses       []models.Diagnosis
	MedicationItems []models.MedicineOrderItem
	Procedures      []models.VisitProcedure
}

// BuildFHIRComposition creates FHIR Composition resource (Resume Medis)
func BuildFHIRComposition(params BuildFHIRCompositionParams) (*FHIRComposition, error) {
	if params.Patient == nil || params.Patient.SatuSehatID == "" {
		return nil, fmt.Errorf("pasien belum memiliki IHS Number")
	}
	if params.Doctor == nil || params.Doctor.SatuSehatID == "" {
		return nil, fmt.Errorf("dokter belum memiliki SatuSehat ID")
	}
	if params.EncounterID == "" {
		return nil, fmt.Errorf("encounter belum dikirim ke SatuSehat")
	}

	// Determine title based on visit type
	title := "Resume Medis Rawat Jalan"
	if params.Visit.VisitType == models.VisitTypeInpatient {
		title = "Resume Medis Rawat Inap"
	} else if params.Visit.VisitType == models.VisitTypeEmergency {
		title = "Resume Medis Gawat Darurat"
	}

	composition := &FHIRComposition{
		ResourceType: "Composition",
		Identifier: &FHIRIdentifier{
			System: "http://sys-ids.kemkes.go.id/composition/" + params.OrgID,
			Value:  fmt.Sprintf("COMP-%s", params.Visit.VisitNumber),
		},
		Status: "final",
		Type: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    "18842-5",
					Display: "Discharge summary",
				},
			},
		},
		Category: []FHIRCodeableConcept{
			{
				Coding: []FHIRCoding{
					{
						System:  "http://loinc.org",
						Code:    "LP173421-1",
						Display: "Report",
					},
				},
			},
		},
		Subject: &FHIRReference{
			Reference: "Patient/" + params.Patient.SatuSehatID,
			Display:   params.Patient.NamaLengkap,
		},
		Encounter: &FHIRReference{
			Reference: "Encounter/" + params.EncounterID,
		},
		Date: time.Now().Format("2006-01-02T15:04:05+07:00"),
		Author: []FHIRReference{
			{
				Reference: "Practitioner/" + params.Doctor.SatuSehatID,
				Display:   params.Doctor.NamaLengkap,
			},
		},
		Title: title,
		Custodian: &FHIRReference{
			Reference: "Organization/" + params.OrgID,
		},
		Section: []FHIRCompositionSection{},
	}

	// === Section 1: Keluhan Utama (Chief Complaint) ===
	complaint := params.Complaint
	if complaint == "" {
		complaint = "-"
	}
	chiefComplaintSection := FHIRCompositionSection{
		Title: "Keluhan Utama",
		Code: &FHIRCodeableConcept{
			Coding: []FHIRCoding{
				{
					System:  "http://loinc.org",
					Code:    "10154-3",
					Display: "Chief complaint",
				},
			},
		},
		Text: &FHIRNarrative{
			Status: "generated",
			Div:    fmt.Sprintf("<div xmlns=\"http://www.w3.org/1999/xhtml\">%s</div>", escapeXHTML(complaint)),
		},
	}
	composition.Section = append(composition.Section, chiefComplaintSection)

	// === Section 2: Diagnosis ===
	if len(params.Diagnoses) > 0 {
		diagTexts := []string{}
		diagEntries := []FHIRReference{}
		for _, d := range params.Diagnoses {
			diagTexts = append(diagTexts, fmt.Sprintf("%s - %s", d.ICD10Code, d.ICD10Name))
			if d.SatuSehatConditionID != "" {
				diagEntries = append(diagEntries, FHIRReference{
					Reference: "Condition/" + d.SatuSehatConditionID,
				})
			}
		}

		diagnosisSection := FHIRCompositionSection{
			Title: "Diagnosis",
			Code: &FHIRCodeableConcept{
				Coding: []FHIRCoding{
					{
						System:  "http://loinc.org",
						Code:    "29548-5",
						Display: "Diagnosis",
					},
				},
			},
			Text: &FHIRNarrative{
				Status: "generated",
				Div:    fmt.Sprintf("<div xmlns=\"http://www.w3.org/1999/xhtml\">%s</div>", escapeXHTML(strings.Join(diagTexts, "; "))),
			},
			Entry: diagEntries,
		}
		composition.Section = append(composition.Section, diagnosisSection)
	}

	// === Section 3: Tatalaksana (Plan of Care) ===
	tatalaksanaTexts := []string{}
	tatalaksanaEntries := []FHIRReference{}

	// Add medication requests
	for _, med := range params.MedicationItems {
		medicineName := "Obat"
		if med.Medicine != nil {
			medicineName = med.Medicine.Name
		}
		tatalaksanaTexts = append(tatalaksanaTexts, fmt.Sprintf("%s %v %s (%s)", medicineName, med.Quantity, med.Unit, med.Dosage))
		if med.SatusehatMedicationRequestID != "" {
			tatalaksanaEntries = append(tatalaksanaEntries, FHIRReference{
				Reference: "MedicationRequest/" + med.SatusehatMedicationRequestID,
			})
		}
	}

	// Add procedures
	for _, p := range params.Procedures {
		if p.Procedure != nil {
			tatalaksanaTexts = append(tatalaksanaTexts, fmt.Sprintf("Tindakan: %s (%s)", p.Procedure.Name, p.Procedure.Code))
		}
		if p.SatusehatProcedureID != "" {
			tatalaksanaEntries = append(tatalaksanaEntries, FHIRReference{
				Reference: "Procedure/" + p.SatusehatProcedureID,
			})
		}
	}

	if len(tatalaksanaTexts) > 0 || len(tatalaksanaEntries) > 0 {
		tatalaksanaText := "-"
		if len(tatalaksanaTexts) > 0 {
			tatalaksanaText = strings.Join(tatalaksanaTexts, "; ")
		}
		tatalaksanaSection := FHIRCompositionSection{
			Title: "Tatalaksana",
			Code: &FHIRCodeableConcept{
				Coding: []FHIRCoding{
					{
						System:  "http://loinc.org",
						Code:    "18776-5",
						Display: "Plan of care",
					},
				},
			},
			Text: &FHIRNarrative{
				Status: "generated",
				Div:    fmt.Sprintf("<div xmlns=\"http://www.w3.org/1999/xhtml\">%s</div>", escapeXHTML(tatalaksanaText)),
			},
			Entry: tatalaksanaEntries,
		}
		composition.Section = append(composition.Section, tatalaksanaSection)
	}

	return composition, nil
}

// escapeXHTML escapes special characters for XHTML narrative div
func escapeXHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

// SendCompositionToSatuSehat sends Resume Medis (Composition) for a visit
func SendCompositionToSatuSehat(c *gin.Context) {
	visitID := c.Param("id")
	log.Println("=== SendCompositionToSatuSehat called ===")
	log.Printf("Visit ID: %s\n", visitID)

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Doctor").
		Preload("Room").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Check if already sent
	if visit.SatuSehatCompositionID != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":                    "Composition sudah dikirim ke SatuSehat",
			"satusehat_composition_id": visit.SatuSehatCompositionID,
		})
		return
	}

	// Validate encounter must be sent first
	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Encounter belum dikirim ke SatuSehat"})
		return
	}

	patient := visit.Registration.Patient
	if patient == nil || patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien belum memiliki IHS Number"})
		return
	}

	if visit.Doctor == nil || visit.Doctor.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter belum memiliki SatuSehat ID"})
		return
	}

	// Get organization ID
	configMap, err := getSatuSehatConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca konfigurasi SatuSehat"})
		return
	}
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Load diagnoses
	var diagnoses []models.Diagnosis
	originalRMVisitQuery(visit.ID).Find(&diagnoses)

	// Load medication items
	var medicationItems []models.MedicineOrderItem
	database.DB.Preload("Medicine").
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_orders.source_visit_id = ? AND medicine_orders.is_casemix = ?", visit.ID, false).
		Find(&medicationItems)

	// Load procedures
	var procedures []models.VisitProcedure
	originalRMVisitQuery(visit.ID).Preload("Procedure").Find(&procedures)

	// Build FHIR Composition
	composition, err := BuildFHIRComposition(BuildFHIRCompositionParams{
		OrgID:           orgID,
		Visit:           &visit,
		Patient:         patient,
		Doctor:          visit.Doctor,
		EncounterID:     visit.SatuSehatEncounterID,
		Complaint:       visit.Complaint,
		Diagnoses:       diagnoses,
		MedicationItems: medicationItems,
		Procedures:      procedures,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[COMPOSITION] Sending to SatuSehat for visit %s...\n", visit.VisitNumber)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/Composition", composition)
	if err != nil {
		log.Printf("[COMPOSITION] ERROR: Request failed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengirim Composition: " + err.Error()})
		return
	}

	log.Printf("[COMPOSITION] Response [%d]: %s\n", statusCode, string(body))

	if statusCode != http.StatusOK && statusCode != http.StatusCreated {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		// Check for duplicate
		if statusCode == 400 {
			if issue, ok := errorResponse["issue"].([]interface{}); ok && len(issue) > 0 {
				if firstIssue, ok := issue[0].(map[string]interface{}); ok {
					code, _ := firstIssue["code"].(string)
					if strings.Contains(code, "duplicate") {
						visit.SatuSehatCompositionID = "DUPLICATE_DETECTED"
						database.DB.Save(&visit)

						c.JSON(http.StatusOK, gin.H{
							"message":                  "Composition sudah pernah dikirim sebelumnya",
							"satusehat_composition_id": "DUPLICATE",
							"note":                     "Composition ini sudah ada di SatuSehat",
						})
						return
					}
				}
			}
		}

		c.JSON(statusCode, gin.H{
			"error":              "Gagal mengirim Composition ke SatuSehat",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	compositionID, _ := fhirResponse["id"].(string)
	log.Printf("[COMPOSITION] SUCCESS: Got ID %s\n", compositionID)

	// Save to database
	visit.SatuSehatCompositionID = compositionID
	if err := database.DB.Save(&visit).Error; err != nil {
		log.Printf("[COMPOSITION] WARNING: Gagal menyimpan Composition ID: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                  "Composition (Resume Medis) berhasil dikirim ke SatuSehat",
		"visit_id":                 visit.ID,
		"visit_number":             visit.VisitNumber,
		"satusehat_composition_id": compositionID,
		"fhir_response":            fhirResponse,
	})
}

// ============================================================================
// CLINICAL IMPRESSION (Penilaian Klinis)
// Reference: https://satusehat.kemkes.go.id/platform/docs/id/playbook
// Jenis: Riwayat Perjalanan Penyakit, Rasional Klinis, Prognosis, Asesmen Triage
// ============================================================================

// ClinicalImpressionType constants
const (
	ClinicalImpressionTypeHistory   = "history"   // Riwayat Perjalanan Penyakit - SNOMED 312850006
	ClinicalImpressionTypeRationale = "rationale" // Rasional Klinis - Kemkes TK000056
	ClinicalImpressionTypePrognosis = "prognosis" // Prognosis - Kemkes TK000057
	ClinicalImpressionTypeTriage    = "triage"    // Asesmen Triage (IGD) - SNOMED 312850006
)

// FHIRClinicalImpression represents FHIR ClinicalImpression resource
type FHIRClinicalImpression struct {
	ResourceType      string                                `json:"resourceType"`
	Identifier        []FHIRIdentifier                      `json:"identifier,omitempty"`
	Status            string                                `json:"status"` // in-progress, completed
	Code              *FHIRCodeableConcept                  `json:"code,omitempty"`
	Subject           *FHIRReference                        `json:"subject"`
	Encounter         *FHIRReference                        `json:"encounter,omitempty"`
	EffectiveDateTime string                                `json:"effectiveDateTime,omitempty"`
	Date              string                                `json:"date,omitempty"`
	Assessor          *FHIRReference                        `json:"assessor,omitempty"`
	Investigation     []FHIRClinicalImpressionInvestigation `json:"investigation,omitempty"`
	Summary           string                                `json:"summary,omitempty"`
	Finding           []FHIRClinicalImpressionFinding       `json:"finding,omitempty"`
	PrognosisCode     []FHIRCodeableConcept                 `json:"prognosisCodeableConcept,omitempty"`
}

// FHIRClinicalImpressionInvestigation represents investigation section
type FHIRClinicalImpressionInvestigation struct {
	Code *FHIRCodeableConcept `json:"code"`
	Item []FHIRReference      `json:"item,omitempty"`
}

// FHIRClinicalImpressionFinding represents finding section
type FHIRClinicalImpressionFinding struct {
	ItemCodeableConcept *FHIRCodeableConcept `json:"itemCodeableConcept,omitempty"`
	ItemReference       *FHIRReference       `json:"itemReference,omitempty"`
	Basis               string               `json:"basis,omitempty"`
}

// BuildFHIRClinicalImpressionParams contains parameters for building ClinicalImpression
type BuildFHIRClinicalImpressionParams struct {
	Type             string // history, rationale, prognosis, triage
	OrgID            string
	VisitID          uint
	VisitNumber      string
	PatientIHS       string
	PatientName      string
	EncounterID      string
	PractitionerIHS  string
	PractitionerName string
	EffectiveTime    *time.Time
	Summary          string
	PrognosisCode    string // PRG001 (Baik), PRG002 (Sedang), PRG003 (Buruk)
	PrognosisText    string
	// Triage specific
	TriageLevel   string
	GCSScore      int
	Consciousness string
	// Investigation (optional references to Observation)
	ObservationIDs []string
}

// BuildFHIRClinicalImpression creates FHIR ClinicalImpression resource
func BuildFHIRClinicalImpression(params BuildFHIRClinicalImpressionParams) *FHIRClinicalImpression {
	now := time.Now().Format(time.RFC3339)
	effectiveTime := now
	if params.EffectiveTime != nil {
		effectiveTime = params.EffectiveTime.Format(time.RFC3339)
	}

	// Determine code based on type
	var code *FHIRCodeableConcept
	switch params.Type {
	case ClinicalImpressionTypeHistory, ClinicalImpressionTypeTriage:
		// Riwayat Perjalanan Penyakit & Asesmen Triage - SNOMED
		code = &FHIRCodeableConcept{
			Coding: []FHIRCoding{{
				System:  "http://snomed.info/sct",
				Code:    "312850006",
				Display: "History of disorder",
			}},
		}
	case ClinicalImpressionTypeRationale:
		// Rasional Klinis - Kemkes
		code = &FHIRCodeableConcept{
			Coding: []FHIRCoding{{
				System:  "http://terminology.kemkes.go.id",
				Code:    "TK000056",
				Display: "Rasional Klinis",
			}},
		}
	case ClinicalImpressionTypePrognosis:
		// Prognosis - Kemkes
		code = &FHIRCodeableConcept{
			Coding: []FHIRCoding{{
				System:  "http://terminology.kemkes.go.id",
				Code:    "TK000057",
				Display: "Prognosis",
			}},
		}
	}

	// Build identifier
	identifier := []FHIRIdentifier{{
		System: fmt.Sprintf("http://sys-ids.kemkes.go.id/clinical-impression/%s", params.OrgID),
		Value:  fmt.Sprintf("%s-%s-%d", params.VisitNumber, params.Type, time.Now().Unix()),
	}}

	// Build clinical impression
	clinicalImpression := &FHIRClinicalImpression{
		ResourceType: "ClinicalImpression",
		Identifier:   identifier,
		Status:       "completed",
		Code:         code,
		Subject: &FHIRReference{
			Reference: fmt.Sprintf("Patient/%s", params.PatientIHS),
			Display:   params.PatientName,
		},
		EffectiveDateTime: effectiveTime,
		Date:              now,
		Summary:           params.Summary,
	}

	// Add Encounter reference if available
	if params.EncounterID != "" {
		clinicalImpression.Encounter = &FHIRReference{
			Reference: fmt.Sprintf("Encounter/%s", params.EncounterID),
		}
	}

	// Add Assessor reference
	if params.PractitionerIHS != "" {
		clinicalImpression.Assessor = &FHIRReference{
			Reference: fmt.Sprintf("Practitioner/%s", params.PractitionerIHS),
			Display:   params.PractitionerName,
		}
	}

	// Add Prognosis code for prognosis type
	if params.Type == ClinicalImpressionTypePrognosis && params.PrognosisCode != "" {
		prognosisDisplay := "Tidak Diketahui"
		switch params.PrognosisCode {
		case "PRG001":
			prognosisDisplay = "Baik"
		case "PRG002":
			prognosisDisplay = "Sedang"
		case "PRG003":
			prognosisDisplay = "Buruk"
		}
		clinicalImpression.PrognosisCode = []FHIRCodeableConcept{{
			Coding: []FHIRCoding{{
				System:  "http://terminology.kemkes.go.id",
				Code:    params.PrognosisCode,
				Display: prognosisDisplay,
			}},
		}}
	}

	// Add Investigation references (for Rasional Klinis - link to Observations)
	if params.Type == ClinicalImpressionTypeRationale && len(params.ObservationIDs) > 0 {
		items := make([]FHIRReference, 0, len(params.ObservationIDs))
		for _, obsID := range params.ObservationIDs {
			items = append(items, FHIRReference{
				Reference: fmt.Sprintf("Observation/%s", obsID),
				Display:   "Hasil Pemeriksaan",
			})
		}
		clinicalImpression.Investigation = []FHIRClinicalImpressionInvestigation{{
			Code: &FHIRCodeableConcept{
				Coding: []FHIRCoding{{
					System:  "http://snomed.info/sct",
					Code:    "271336007",
					Display: "Examination / signs",
				}},
			},
			Item: items,
		}}
	}

	return clinicalImpression
}

// mapPrognosisTextToCode maps prognosis text to Kemkes code
func mapPrognosisTextToCode(text string) string {
	lowerText := strings.ToLower(text)
	if strings.Contains(lowerText, "baik") || strings.Contains(lowerText, "good") ||
		strings.Contains(lowerText, "quo ad vitam bonam") || strings.Contains(lowerText, "ad bonam") {
		return "PRG001"
	}
	if strings.Contains(lowerText, "sedang") || strings.Contains(lowerText, "dubia") ||
		strings.Contains(lowerText, "quo ad vitam dubia") || strings.Contains(lowerText, "ad dubia") {
		return "PRG002"
	}
	if strings.Contains(lowerText, "buruk") || strings.Contains(lowerText, "jelek") ||
		strings.Contains(lowerText, "poor") || strings.Contains(lowerText, "malam") ||
		strings.Contains(lowerText, "quo ad vitam malam") || strings.Contains(lowerText, "ad malam") {
		return "PRG003"
	}
	return "" // Unknown - will send as text only
}

// SendClinicalImpressionToSatuSehat sends ClinicalImpression to SatuSehat
// POST /api/integrations/satusehat/clinical-impression/:id/send?type=history|rationale|prognosis|triage
func SendClinicalImpressionToSatuSehat(c *gin.Context) {
	visitIDStr := c.Param("id")
	visitID, err := strconv.ParseUint(visitIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visit ID"})
		return
	}

	// Get type from query parameter
	impressionType := c.DefaultQuery("type", "history")
	if impressionType != ClinicalImpressionTypeHistory &&
		impressionType != ClinicalImpressionTypeRationale &&
		impressionType != ClinicalImpressionTypePrognosis &&
		impressionType != ClinicalImpressionTypeTriage {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid type. Must be one of: history, rationale, prognosis, triage",
		})
		return
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Doctor").
		Preload("Room").
		First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Validate prerequisites
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "Pasien belum memiliki IHS Number",
			"patient_id":   patient.ID,
			"patient_name": patient.NamaLengkap,
		})
		return
	}

	if visit.Doctor == nil || visit.Doctor.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Dokter belum memiliki IHS Number",
		})
		return
	}

	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":       "Encounter belum dikirim ke SatuSehat",
			"visit_id":    visit.ID,
			"next_action": "Kirim Encounter terlebih dahulu",
		})
		return
	}

	// Get organization ID
	configMap, _ := getSatuSehatConfig()
	orgID := configMap["organization_id"]
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID belum dikonfigurasi"})
		return
	}

	// Build params based on type
	params := BuildFHIRClinicalImpressionParams{
		Type:             impressionType,
		OrgID:            orgID,
		VisitID:          visit.ID,
		VisitNumber:      visit.VisitNumber,
		PatientIHS:       patient.SatuSehatID,
		PatientName:      patient.NamaLengkap,
		EncounterID:      visit.SatuSehatEncounterID,
		PractitionerIHS:  visit.Doctor.SatuSehatID,
		PractitionerName: visit.Doctor.NamaLengkap,
		EffectiveTime:    visit.StartTime,
	}

	// Get summary based on type
	switch impressionType {
	case ClinicalImpressionTypeHistory:
		// Get DiagnosisSummary
		var diagSummary models.DiagnosisSummary
		if err := originalRMVisitQuery(visit.ID).First(&diagSummary).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Data kesan klinis (riwayat perjalanan penyakit) belum diisi",
				"visit_id":    visit.ID,
				"next_action": "Isi form Diagnosis Summary / Kesan Klinis terlebih dahulu",
			})
			return
		}
		if diagSummary.ClinicalImpression == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Field clinical_impression masih kosong",
				"visit_id":    visit.ID,
				"next_action": "Isi kesan klinis pada form Diagnosis Summary",
			})
			return
		}

		// Check if already sent
		if diagSummary.SatusehatClinicalImpressionHistoryID != "" {
			c.JSON(http.StatusOK, gin.H{
				"message":                          "ClinicalImpression (Riwayat Perjalanan Penyakit) sudah pernah dikirim",
				"satusehat_clinical_impression_id": diagSummary.SatusehatClinicalImpressionHistoryID,
				"type":                             impressionType,
			})
			return
		}

		// Build summary from clinical impression + anamnesis if available
		summary := diagSummary.ClinicalImpression

		// Optionally append anamnesis data
		var anamnesis models.Anamnesis
		if err := originalRMVisitQuery(visit.ID).First(&anamnesis).Error; err == nil {
			if anamnesis.ChiefComplaint != "" && !strings.Contains(summary, anamnesis.ChiefComplaint) {
				summary = fmt.Sprintf("Keluhan Utama: %s. %s", anamnesis.ChiefComplaint, summary)
			}
		}

		params.Summary = summary

	case ClinicalImpressionTypeRationale:
		// Get AssessmentPlan
		var assessmentPlan models.AssessmentPlan
		if err := originalRMVisitQuery(visit.ID).First(&assessmentPlan).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Data asesmen klinis belum diisi",
				"visit_id":    visit.ID,
				"next_action": "Isi form Assessment Plan terlebih dahulu",
			})
			return
		}
		if assessmentPlan.ClinicalAssessment == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Field clinical_assessment masih kosong",
				"visit_id":    visit.ID,
				"next_action": "Isi kesan klinis pada form Assessment Plan",
			})
			return
		}

		// Check if already sent
		if assessmentPlan.SatusehatClinicalImpressionRationaleID != "" {
			c.JSON(http.StatusOK, gin.H{
				"message":                          "ClinicalImpression (Rasional Klinis) sudah pernah dikirim",
				"satusehat_clinical_impression_id": assessmentPlan.SatusehatClinicalImpressionRationaleID,
				"type":                             impressionType,
			})
			return
		}

		params.Summary = assessmentPlan.ClinicalAssessment

		// TODO: Get observation IDs that have been sent to SatuSehat
		// This can be enhanced to include references to sent Observations

	case ClinicalImpressionTypePrognosis:
		// Get AssessmentPlan for prognosis
		var assessmentPlan models.AssessmentPlan
		if err := originalRMVisitQuery(visit.ID).First(&assessmentPlan).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Data prognosis belum diisi",
				"visit_id":    visit.ID,
				"next_action": "Isi form Assessment Plan terlebih dahulu",
			})
			return
		}
		if assessmentPlan.Prognosis == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Field prognosis masih kosong",
				"visit_id":    visit.ID,
				"next_action": "Isi prognosis pada form Assessment Plan",
			})
			return
		}

		// Check if already sent
		if assessmentPlan.SatusehatClinicalImpressionPrognosisID != "" {
			c.JSON(http.StatusOK, gin.H{
				"message":                          "ClinicalImpression (Prognosis) sudah pernah dikirim",
				"satusehat_clinical_impression_id": assessmentPlan.SatusehatClinicalImpressionPrognosisID,
				"type":                             impressionType,
			})
			return
		}

		params.Summary = assessmentPlan.Prognosis
		params.PrognosisCode = mapPrognosisTextToCode(assessmentPlan.Prognosis)
		params.PrognosisText = assessmentPlan.Prognosis

	case ClinicalImpressionTypeTriage:
		// Get Triage data (IGD only)
		var triage models.Triage
		if err := originalRMVisitQuery(visit.ID).First(&triage).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Data triage tidak ditemukan",
				"visit_id":    visit.ID,
				"next_action": "Asesmen Triage hanya untuk kunjungan IGD yang sudah ditriage",
			})
			return
		}
		if triage.TriageAssessment == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":       "Field triage_assessment masih kosong",
				"visit_id":    visit.ID,
				"next_action": "Isi asesmen pada form Triage",
			})
			return
		}

		// Check if already sent
		if triage.SatusehatClinicalImpressionTriageID != "" {
			c.JSON(http.StatusOK, gin.H{
				"message":                          "ClinicalImpression (Asesmen Triage) sudah pernah dikirim",
				"satusehat_clinical_impression_id": triage.SatusehatClinicalImpressionTriageID,
				"type":                             impressionType,
			})
			return
		}

		// Build comprehensive summary for triage
		var summaryParts []string
		if triage.TriageLevel != "" {
			summaryParts = append(summaryParts, fmt.Sprintf("ESI Level %s", triage.TriageLevel))
		}
		gcsTotal := triage.GCSTotal()
		if gcsTotal > 0 {
			summaryParts = append(summaryParts, fmt.Sprintf("GCS %d (E%d V%d M%d)", gcsTotal, triage.GCSE, triage.GCSV, triage.GCSM))
		}
		if triage.Consciousness != "" {
			summaryParts = append(summaryParts, fmt.Sprintf("Kesadaran: %s", triage.Consciousness))
		}
		summaryParts = append(summaryParts, triage.TriageAssessment)

		params.Summary = strings.Join(summaryParts, ". ")
		params.TriageLevel = triage.TriageLevel
		params.GCSScore = gcsTotal
		params.Consciousness = triage.Consciousness
	}

	// Build FHIR resource
	clinicalImpression := BuildFHIRClinicalImpression(params)

	// Log payload
	payloadJSON, _ := json.MarshalIndent(clinicalImpression, "", "  ")
	log.Printf("[CLINICAL_IMPRESSION] Sending %s:\n%s\n", impressionType, string(payloadJSON))

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/ClinicalImpression", clinicalImpression)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal mengirim ke SatuSehat: " + err.Error(),
		})
		return
	}

	// Handle error response
	if statusCode >= 400 {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)
		log.Printf("[CLINICAL_IMPRESSION] ERROR %d: %v\n", statusCode, errorResponse)

		c.JSON(statusCode, gin.H{
			"error":              "Gagal mengirim ClinicalImpression ke SatuSehat",
			"status_code":        statusCode,
			"type":               impressionType,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var fhirResponse map[string]interface{}
	if err := json.Unmarshal(body, &fhirResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parse response: " + err.Error()})
		return
	}

	clinicalImpressionID, _ := fhirResponse["id"].(string)
	log.Printf("[CLINICAL_IMPRESSION] SUCCESS: Type=%s, ID=%s\n", impressionType, clinicalImpressionID)

	// Save to database based on type
	now := time.Now()
	var updateErr error
	switch impressionType {
	case ClinicalImpressionTypeHistory:
		updateErr = database.DB.Model(&models.DiagnosisSummary{}).
			Where("visit_id = ? AND is_casemix = ?", visit.ID, false).
			Updates(map[string]interface{}{
				"satusehat_clinical_impression_history_id": clinicalImpressionID,
				"satusehat_clinical_impression_history_at": now,
			}).Error

	case ClinicalImpressionTypeRationale:
		updateErr = database.DB.Model(&models.AssessmentPlan{}).
			Where("visit_id = ? AND is_casemix = ?", visit.ID, false).
			Updates(map[string]interface{}{
				"satusehat_clinical_impression_rationale_id": clinicalImpressionID,
				"satusehat_clinical_impression_rationale_at": now,
			}).Error

	case ClinicalImpressionTypePrognosis:
		updateErr = database.DB.Model(&models.AssessmentPlan{}).
			Where("visit_id = ? AND is_casemix = ?", visit.ID, false).
			Updates(map[string]interface{}{
				"satusehat_clinical_impression_prognosis_id": clinicalImpressionID,
				"satusehat_clinical_impression_prognosis_at": now,
			}).Error

	case ClinicalImpressionTypeTriage:
		updateErr = database.DB.Model(&models.Triage{}).
			Where("visit_id = ? AND is_casemix = ?", visit.ID, false).
			Updates(map[string]interface{}{
				"satusehat_clinical_impression_triage_id": clinicalImpressionID,
				"satusehat_clinical_impression_triage_at": now,
			}).Error
	}

	if updateErr != nil {
		log.Printf("[CLINICAL_IMPRESSION] WARNING: Gagal menyimpan ke database: %v\n", updateErr)
	} else {
		log.Printf("[CLINICAL_IMPRESSION] Database updated successfully for visit_id=%d, type=%s\n", visit.ID, impressionType)
	}

	// Get type display name
	typeDisplay := map[string]string{
		ClinicalImpressionTypeHistory:   "Riwayat Perjalanan Penyakit",
		ClinicalImpressionTypeRationale: "Rasional Klinis",
		ClinicalImpressionTypePrognosis: "Prognosis",
		ClinicalImpressionTypeTriage:    "Asesmen Triage",
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                          fmt.Sprintf("ClinicalImpression (%s) berhasil dikirim ke SatuSehat", typeDisplay[impressionType]),
		"visit_id":                         visit.ID,
		"visit_number":                     visit.VisitNumber,
		"type":                             impressionType,
		"type_display":                     typeDisplay[impressionType],
		"satusehat_clinical_impression_id": clinicalImpressionID,
		"fhir_response":                    fhirResponse,
	})
}

// GetClinicalImpressionStatus returns the status of ClinicalImpression for a visit
func GetClinicalImpressionStatus(c *gin.Context) {
	visitIDStr := c.Param("id")
	visitID, err := strconv.ParseUint(visitIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visit ID"})
		return
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Doctor").
		Preload("Room").
		First(&visit, uint(visitID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Check patient IHS
	patientHasIHS := false
	if visit.Registration != nil && visit.Registration.Patient != nil {
		patientHasIHS = visit.Registration.Patient.SatuSehatID != ""
	}

	// Check practitioner IHS
	practitionerHasIHS := false
	if visit.Doctor != nil {
		practitionerHasIHS = visit.Doctor.SatuSehatID != ""
	}

	// Check encounter sent
	encounterSent := visit.SatuSehatEncounterID != ""

	// Build status for each type
	type ClinicalImpressionTypeStatus struct {
		Type        string `json:"type"`
		TypeDisplay string `json:"type_display"`
		DataExists  bool   `json:"data_exists"`
		DataField   string `json:"data_field,omitempty"`
		Sent        bool   `json:"sent"`
		SatuSehatID string `json:"satusehat_id,omitempty"`
		SentAt      string `json:"sent_at,omitempty"`
		CanSend     bool   `json:"can_send"`
		BlockedBy   string `json:"blocked_by,omitempty"`
	}

	statuses := make([]ClinicalImpressionTypeStatus, 0, 4)

	// 1. Riwayat Perjalanan Penyakit
	var diagSummary models.DiagnosisSummary
	historyStatus := ClinicalImpressionTypeStatus{
		Type:        ClinicalImpressionTypeHistory,
		TypeDisplay: "Riwayat Perjalanan Penyakit",
		DataField:   "diagnosis_summary.clinical_impression",
	}
	if err := originalRMVisitQuery(visit.ID).First(&diagSummary).Error; err == nil {
		historyStatus.DataExists = diagSummary.ClinicalImpression != ""
		historyStatus.Sent = diagSummary.SatusehatClinicalImpressionHistoryID != ""
		historyStatus.SatuSehatID = diagSummary.SatusehatClinicalImpressionHistoryID
		if diagSummary.SatusehatClinicalImpressionHistoryAt != nil {
			historyStatus.SentAt = diagSummary.SatusehatClinicalImpressionHistoryAt.Format(time.RFC3339)
		}
	}
	historyStatus.CanSend = patientHasIHS && practitionerHasIHS && encounterSent && historyStatus.DataExists && !historyStatus.Sent
	if !patientHasIHS {
		historyStatus.BlockedBy = "Patient IHS"
	} else if !practitionerHasIHS {
		historyStatus.BlockedBy = "Practitioner IHS"
	} else if !encounterSent {
		historyStatus.BlockedBy = "Encounter"
	} else if !historyStatus.DataExists {
		historyStatus.BlockedBy = "Data kesan klinis"
	}
	statuses = append(statuses, historyStatus)

	// 2. Rasional Klinis
	var assessmentPlan models.AssessmentPlan
	originalRMVisitQuery(visit.ID).First(&assessmentPlan)

	rationaleStatus := ClinicalImpressionTypeStatus{
		Type:        ClinicalImpressionTypeRationale,
		TypeDisplay: "Rasional Klinis",
		DataField:   "assessment_plan.clinical_assessment",
		DataExists:  assessmentPlan.ClinicalAssessment != "",
		Sent:        assessmentPlan.SatusehatClinicalImpressionRationaleID != "",
		SatuSehatID: assessmentPlan.SatusehatClinicalImpressionRationaleID,
	}
	if assessmentPlan.SatusehatClinicalImpressionRationaleAt != nil {
		rationaleStatus.SentAt = assessmentPlan.SatusehatClinicalImpressionRationaleAt.Format(time.RFC3339)
	}
	rationaleStatus.CanSend = patientHasIHS && practitionerHasIHS && encounterSent && rationaleStatus.DataExists && !rationaleStatus.Sent
	if !patientHasIHS {
		rationaleStatus.BlockedBy = "Patient IHS"
	} else if !practitionerHasIHS {
		rationaleStatus.BlockedBy = "Practitioner IHS"
	} else if !encounterSent {
		rationaleStatus.BlockedBy = "Encounter"
	} else if !rationaleStatus.DataExists {
		rationaleStatus.BlockedBy = "Data asesmen klinis"
	}
	statuses = append(statuses, rationaleStatus)

	// 3. Prognosis
	prognosisStatus := ClinicalImpressionTypeStatus{
		Type:        ClinicalImpressionTypePrognosis,
		TypeDisplay: "Prognosis",
		DataField:   "assessment_plan.prognosis",
		DataExists:  assessmentPlan.Prognosis != "",
		Sent:        assessmentPlan.SatusehatClinicalImpressionPrognosisID != "",
		SatuSehatID: assessmentPlan.SatusehatClinicalImpressionPrognosisID,
	}
	if assessmentPlan.SatusehatClinicalImpressionPrognosisAt != nil {
		prognosisStatus.SentAt = assessmentPlan.SatusehatClinicalImpressionPrognosisAt.Format(time.RFC3339)
	}
	prognosisStatus.CanSend = patientHasIHS && practitionerHasIHS && encounterSent && prognosisStatus.DataExists && !prognosisStatus.Sent
	if !patientHasIHS {
		prognosisStatus.BlockedBy = "Patient IHS"
	} else if !practitionerHasIHS {
		prognosisStatus.BlockedBy = "Practitioner IHS"
	} else if !encounterSent {
		prognosisStatus.BlockedBy = "Encounter"
	} else if !prognosisStatus.DataExists {
		prognosisStatus.BlockedBy = "Data prognosis"
	}
	statuses = append(statuses, prognosisStatus)

	// 4. Asesmen Triage (only for IGD)
	var triage models.Triage
	triageStatus := ClinicalImpressionTypeStatus{
		Type:        ClinicalImpressionTypeTriage,
		TypeDisplay: "Asesmen Triage (IGD)",
		DataField:   "triage.triage_assessment",
	}
	if err := originalRMVisitQuery(visit.ID).First(&triage).Error; err == nil {
		triageStatus.DataExists = triage.TriageAssessment != ""
		triageStatus.Sent = triage.SatusehatClinicalImpressionTriageID != ""
		triageStatus.SatuSehatID = triage.SatusehatClinicalImpressionTriageID
		if triage.SatusehatClinicalImpressionTriageAt != nil {
			triageStatus.SentAt = triage.SatusehatClinicalImpressionTriageAt.Format(time.RFC3339)
		}
		triageStatus.CanSend = patientHasIHS && practitionerHasIHS && encounterSent && triageStatus.DataExists && !triageStatus.Sent
		if !patientHasIHS {
			triageStatus.BlockedBy = "Patient IHS"
		} else if !practitionerHasIHS {
			triageStatus.BlockedBy = "Practitioner IHS"
		} else if !encounterSent {
			triageStatus.BlockedBy = "Encounter"
		} else if !triageStatus.DataExists {
			triageStatus.BlockedBy = "Data asesmen triage"
		}
		statuses = append(statuses, triageStatus)
	}

	// Count statistics
	totalAvailable := 0
	totalSent := 0
	totalCanSend := 0
	for _, s := range statuses {
		if s.DataExists {
			totalAvailable++
		}
		if s.Sent {
			totalSent++
		}
		if s.CanSend {
			totalCanSend++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"visit_id":     visit.ID,
		"visit_number": visit.VisitNumber,
		"prerequisites": gin.H{
			"patient_ihs":      patientHasIHS,
			"practitioner_ihs": practitionerHasIHS,
			"encounter_sent":   encounterSent,
		},
		"statuses": statuses,
		"summary": gin.H{
			"total_types":     len(statuses),
			"total_available": totalAvailable,
			"total_sent":      totalSent,
			"total_can_send":  totalCanSend,
		},
	})
}

// ============================================================================
// Patient Allergy Handlers for SatuSehat Integration
// Uses existing BuildFHIRAllergyIntolerance function
// ============================================================================

// SendAllergyIntoleranceToSatuSehat sends a patient allergy as FHIR AllergyIntolerance to SatuSehat
func SendAllergyIntoleranceToSatuSehat(c *gin.Context) {
	allergyID := c.Param("id")

	var allergy models.PatientAllergy
	if err := database.DB.Preload("Patient").Preload("Visit.Registration").Preload("Visit.Doctor").Preload("RecordedByUser").First(&allergy, allergyID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Alergi tidak ditemukan"})
		return
	}

	// Check if already sent
	if allergy.SatuSehatID != "" {
		c.JSON(http.StatusOK, gin.H{
			"message":      "Alergi sudah dikirim sebelumnya",
			"allergy_id":   allergy.ID,
			"satusehat_id": allergy.SatuSehatID,
			"is_duplicate": true,
		})
		return
	}

	// Validate patient has IHS
	if allergy.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}

	if allergy.Patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Pasien belum memiliki IHS Number",
			"message": "Silakan lookup IHS Number pasien terlebih dahulu",
		})
		return
	}

	// Get encounter ID if visit exists
	encounterID := ""
	practitionerIHS := ""
	if allergy.Visit != nil {
		encounterID = allergy.Visit.SatuSehatEncounterID
		if allergy.Visit.Doctor != nil {
			practitionerIHS = allergy.Visit.Doctor.SatuSehatID
		}
	}

	// Map category to FHIR format
	category := mapAllergyCategoryToFHIR(allergy.Category)
	criticality := mapAllergyCriticalityToFHIR(allergy.Criticality)

	// Build FHIR AllergyIntolerance using existing function
	allergyResource := BuildFHIRAllergyIntolerance(
		allergy.SnomedCode,
		allergy.SnomedDisplay,
		category,
		criticality,
		allergy.Patient.SatuSehatID,
		encounterID,
		practitionerIHS,
		allergy.Notes,
	)

	// Send to SatuSehat
	body, statusCode, err := SatuSehatFHIRRequest("POST", "/AllergyIntolerance", allergyResource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if statusCode != 200 && statusCode != 201 {
		var errorResponse map[string]interface{}
		json.Unmarshal(body, &errorResponse)

		c.JSON(statusCode, gin.H{
			"error":              "Gagal mengirim AllergyIntolerance ke SatuSehat",
			"status_code":        statusCode,
			"satusehat_response": errorResponse,
		})
		return
	}

	// Parse response
	var response map[string]interface{}
	json.Unmarshal(body, &response)

	satuSehatID := ""
	if id, ok := response["id"].(string); ok {
		satuSehatID = id
	}

	// Update allergy with SatuSehat data
	now := time.Now()
	allergy.SatuSehatID = satuSehatID
	allergy.SatuSehatSentAt = &now
	database.DB.Save(&allergy)

	c.JSON(http.StatusOK, gin.H{
		"message":      "AllergyIntolerance berhasil dikirim ke SatuSehat",
		"allergy_id":   allergy.ID,
		"snomed_code":  allergy.SnomedCode,
		"satusehat_id": satuSehatID,
		"response":     response,
	})
}

// mapAllergyCategoryToFHIR maps internal category to FHIR category
func mapAllergyCategoryToFHIR(category string) string {
	switch category {
	case models.AllergyCategoryMedication:
		return "medication"
	case models.AllergyCategoryFood:
		return "food"
	case models.AllergyCategoryEnvironment:
		return "environment"
	case models.AllergyCategoryBiologic:
		return "biologic"
	default:
		return "medication"
	}
}

// mapAllergyCriticalityToFHIR maps internal criticality to FHIR criticality
func mapAllergyCriticalityToFHIR(criticality string) string {
	switch criticality {
	case models.AllergyCriticalityLow:
		return "low"
	case models.AllergyCriticalityHigh:
		return "high"
	case models.AllergyCriticalityUnableToAssess:
		return "unable-to-assess"
	default:
		return "low"
	}
}

// SendVisitAllergiesToSatuSehat sends all patient allergies for a visit to SatuSehat
func SendVisitAllergiesToSatuSehat(c *gin.Context) {
	visitID := c.Param("id")

	var visit models.Visit
	if err := database.DB.Preload("Registration.Patient").Preload("Doctor").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	// Validate patient
	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data pasien tidak tersedia"})
		return
	}

	patient := visit.Registration.Patient
	if patient.SatuSehatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Pasien belum memiliki IHS Number",
			"message": "Silakan lookup IHS Number pasien terlebih dahulu",
		})
		return
	}

	// Check encounter exists
	if visit.SatuSehatEncounterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Encounter belum dikirim ke SatuSehat",
			"message": "Silakan kirim Encounter terlebih dahulu",
		})
		return
	}

	// Get all active allergies for this patient that haven't been sent
	var allergies []models.PatientAllergy
	if err := database.DB.Where("patient_id = ? AND is_active = ? AND (satusehat_id IS NULL OR satusehat_id = '')",
		patient.ID, true).Find(&allergies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(allergies) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":      "Tidak ada alergi yang perlu dikirim",
			"sent":         0,
			"already_sent": 0,
		})
		return
	}

	// Get practitioner info
	practitionerIHS := ""
	if visit.Doctor != nil {
		practitionerIHS = visit.Doctor.SatuSehatID
	}

	var sent []map[string]interface{}
	var failed []map[string]interface{}

	for _, allergy := range allergies {
		category := mapAllergyCategoryToFHIR(allergy.Category)
		criticality := mapAllergyCriticalityToFHIR(allergy.Criticality)

		allergyResource := BuildFHIRAllergyIntolerance(
			allergy.SnomedCode,
			allergy.SnomedDisplay,
			category,
			criticality,
			patient.SatuSehatID,
			visit.SatuSehatEncounterID,
			practitionerIHS,
			allergy.Notes,
		)

		body, statusCode, err := SatuSehatFHIRRequest("POST", "/AllergyIntolerance", allergyResource)
		if err != nil {
			failed = append(failed, map[string]interface{}{
				"allergy_id":  allergy.ID,
				"snomed_code": allergy.SnomedCode,
				"error":       err.Error(),
			})
			continue
		}

		if statusCode != 200 && statusCode != 201 {
			var errorResponse map[string]interface{}
			json.Unmarshal(body, &errorResponse)
			failed = append(failed, map[string]interface{}{
				"allergy_id":  allergy.ID,
				"snomed_code": allergy.SnomedCode,
				"status_code": statusCode,
				"error":       errorResponse,
			})
			continue
		}

		// Parse response
		var response map[string]interface{}
		json.Unmarshal(body, &response)

		satuSehatID := ""
		if id, ok := response["id"].(string); ok {
			satuSehatID = id
		}

		// Update allergy with SatuSehat data
		now := time.Now()
		allergy.SatuSehatID = satuSehatID
		allergy.SatuSehatSentAt = &now
		database.DB.Save(&allergy)

		sent = append(sent, map[string]interface{}{
			"allergy_id":   allergy.ID,
			"snomed_code":  allergy.SnomedCode,
			"satusehat_id": satuSehatID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("Berhasil mengirim %d dari %d alergi ke SatuSehat", len(sent), len(allergies)),
		"sent_count":   len(sent),
		"failed_count": len(failed),
		"sent":         sent,
		"failed":       failed,
	})
}

// GetPatientAllergyStatusForSatuSehat returns allergy sending status for a patient
func GetPatientAllergyStatusForSatuSehat(c *gin.Context) {
	patientID := c.Param("patient_id")

	var patient models.Patient
	if err := database.DB.First(&patient, patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Get all allergies for this patient
	var allergies []models.PatientAllergy
	database.DB.Where("patient_id = ?", patient.ID).Order("created_at DESC").Find(&allergies)

	type AllergyStatus struct {
		ID            uint       `json:"id"`
		SnomedCode    string     `json:"snomed_code"`
		SnomedDisplay string     `json:"snomed_display"`
		Category      string     `json:"category"`
		Criticality   string     `json:"criticality"`
		IsActive      bool       `json:"is_active"`
		SatuSehatID   string     `json:"satusehat_id,omitempty"`
		SatuSehatSent bool       `json:"satusehat_sent"`
		SentAt        *time.Time `json:"sent_at,omitempty"`
		CanSend       bool       `json:"can_send"`
		BlockedBy     string     `json:"blocked_by,omitempty"`
	}

	var statuses []AllergyStatus
	patientHasIHS := patient.SatuSehatID != ""

	for _, allergy := range allergies {
		status := AllergyStatus{
			ID:            allergy.ID,
			SnomedCode:    allergy.SnomedCode,
			SnomedDisplay: allergy.SnomedDisplay,
			Category:      allergy.Category,
			Criticality:   allergy.Criticality,
			IsActive:      allergy.IsActive,
			SatuSehatID:   allergy.SatuSehatID,
			SatuSehatSent: allergy.SatuSehatID != "",
			SentAt:        allergy.SatuSehatSentAt,
			CanSend:       patientHasIHS && allergy.IsActive && allergy.SatuSehatID == "",
		}

		if !patientHasIHS {
			status.BlockedBy = "Patient IHS"
		} else if !allergy.IsActive {
			status.BlockedBy = "Allergy inactive"
		} else if allergy.SatuSehatID != "" {
			status.BlockedBy = "Already sent"
		}

		statuses = append(statuses, status)
	}

	// Count statistics
	totalActive := 0
	totalSent := 0
	totalCanSend := 0
	for _, s := range statuses {
		if s.IsActive {
			totalActive++
		}
		if s.SatuSehatSent {
			totalSent++
		}
		if s.CanSend {
			totalCanSend++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"patient_id":   patient.ID,
		"patient_name": patient.NamaLengkap,
		"patient_ihs":  patient.SatuSehatID,
		"has_ihs":      patientHasIHS,
		"allergies":    statuses,
		"summary": gin.H{
			"total":          len(statuses),
			"total_active":   totalActive,
			"total_sent":     totalSent,
			"total_can_send": totalCanSend,
		},
	})
}
