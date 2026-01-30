package models

import (
	"time"

	"gorm.io/gorm"
)

// ============================================================================
// LOINC MASTER (Master Data LOINC dari Kemkes IHS)
// Table: loinc
// ============================================================================

// LoincMaster represents LOINC terminology data from Kemkes
type LoincMaster struct {
	ID                   uint   `gorm:"primarykey" json:"id"`
	KategoriPemeriksaan  string `gorm:"size:150" json:"kategori_pemeriksaan"`
	NamaPemeriksaan      string `gorm:"size:250" json:"nama_pemeriksaan"`
	PermintaanHasil      string `gorm:"size:150" json:"permintaan_hasil"`
	Spesimen             string `gorm:"size:100" json:"spesimen"`
	TipeHasilPemeriksaan string `gorm:"size:100" json:"tipe_hasil_pemeriksaan"`
	Satuan               string `gorm:"size:80" json:"satuan"`
	MetodeAnalisis       string `gorm:"size:120" json:"metode_analisis"`
	Code                 string `gorm:"size:20" json:"code"`
	Display              string `gorm:"type:text" json:"display"`
	Component            string `gorm:"type:text" json:"component"`
	Property             string `gorm:"size:25" json:"property"`
	Timing               string `gorm:"size:10" json:"timing"`
	System               string `gorm:"size:100" json:"system"`
	Scale                string `gorm:"size:10" json:"scale"`
	Method               string `gorm:"size:120" json:"method"`
	UnitOfMeasure        string `gorm:"size:25" json:"unit_of_measure"`
	CodeSystem           string `gorm:"type:text" json:"code_system"`
	BodySiteCode         string `gorm:"size:25" json:"body_site_code"`
	BodySiteDisplay      string `gorm:"size:300" json:"body_site_display"`
	BodySiteCodeSistem   string `gorm:"size:300" json:"body_site_code_sistem"`
	VersionFirstReleased string `gorm:"size:8" json:"version_first_released"`
	VersionLastChanged   string `gorm:"size:8" json:"version_last_changed"`
}

func (LoincMaster) TableName() string {
	return "loinc"
}

// ============================================================================
// SNOMED CT MASTER (Master Data SNOMED CT dari Kemkes IHS)
// Table: snomed_ct
// ============================================================================

// SnomedMaster represents SNOMED CT data from Kemkes
type SnomedMaster struct {
	PkID               uint   `gorm:"primarykey;column:pk_id" json:"pk_id"`
	ID                 int    `gorm:"column:id" json:"id"`
	EffectiveTime      *int   `gorm:"column:effectiveTime" json:"effectiveTime"`
	Active             int    `gorm:"default:0;column:active" json:"active"`
	ModuleId           string `gorm:"size:50;column:moduleId" json:"moduleId"`
	ConceptId          string `gorm:"size:50;column:conceptId" json:"conceptId"`
	LanguageCode       string `gorm:"size:50;column:languageCode" json:"languageCode"`
	TypeId             string `gorm:"size:50;column:typeId" json:"typeId"`
	Term               string `gorm:"size:300;column:term" json:"term"`
	CaseSignificanceId string `gorm:"size:50;column:caseSignificanceId" json:"caseSignificanceId"`
}

func (SnomedMaster) TableName() string {
	return "snomed_ct"
}

// ============================================================================
// PROCEDURE LOINC MAPPING
// Mapping antara Procedure SIMRS dengan kode LOINC dan SNOMED
// ============================================================================

// ProcedureLoincMapping represents the mapping between local procedure and LOINC/SNOMED codes
type ProcedureLoincMapping struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Local Procedure Reference
	ProcedureID uint       `gorm:"not null;uniqueIndex" json:"procedure_id"` // One procedure = one mapping
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`

	// LOINC Information (Required)
	LoincCode    string `gorm:"not null;size:20;index" json:"loinc_code"` // e.g., "2339-0"
	LoincDisplay string `gorm:"not null;size:500" json:"loinc_display"`   // e.g., "Glucose [Mass/volume] in Blood"

	// SNOMED Category (Required) - Lab or Imaging
	SnomedCategoryCode    string `gorm:"not null;size:20" json:"snomed_category_code"` // "108252007" or "363679005"
	SnomedCategoryDisplay string `gorm:"size:200" json:"snomed_category_display"`      // "Laboratory procedure" or "Imaging"

	// SNOMED Specimen Type (Required for Lab, optional for Radiology)
	SnomedSpecimenCode    string `gorm:"size:20" json:"snomed_specimen_code"`     // e.g., "119297000"
	SnomedSpecimenDisplay string `gorm:"size:200" json:"snomed_specimen_display"` // e.g., "Blood specimen"

	// SNOMED Body Site (Optional, mainly for Radiology)
	SnomedBodySiteCode    string `gorm:"size:20" json:"snomed_bodysite_code"`     // e.g., "51185008"
	SnomedBodySiteDisplay string `gorm:"size:200" json:"snomed_bodysite_display"` // e.g., "Thorax"

	// Verification
	IsVerified   bool       `gorm:"default:false" json:"is_verified"` // Sudah diverifikasi
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`
	VerifiedByID *uint      `json:"verified_by_id,omitempty"`
	VerifiedBy   *User      `gorm:"foreignKey:VerifiedByID" json:"verified_by,omitempty"`

	// Status
	IsActive bool   `gorm:"default:true" json:"is_active"`
	Notes    string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for ProcedureLoincMapping
func (ProcedureLoincMapping) TableName() string {
	return "procedure_loinc_mappings"
}

// ============================================================================
// CONSTANTS FOR SNOMED CATEGORIES
// ============================================================================

const (
	// Procedure Categories
	SnomedCodeLaboratoryProcedure = "108252007"
	SnomedCodeImaging             = "363679005"

	// Common Specimen Types
	SnomedCodeBloodSpecimen  = "119297000"
	SnomedCodeUrineSpecimen  = "122575003"
	SnomedCodeSputumSpecimen = "119334006"
	SnomedCodeStoolSpecimen  = "119339001"
	SnomedCodeSerumSpecimen  = "119364003"
	SnomedCodePlasmaSpecimen = "119361006"
	SnomedCodeCSFSpecimen    = "258450006"
	SnomedCodeThroatSwab     = "258529004"
	SnomedCodeWholeBlood     = "258580003"
	SnomedCodeTissueSpecimen = "119376003"
)

// GetSnomedCategoryDisplay returns display text for SNOMED category code
func GetSnomedCategoryDisplay(code string) string {
	displays := map[string]string{
		SnomedCodeLaboratoryProcedure: "Laboratory procedure",
		SnomedCodeImaging:             "Imaging",
	}
	if display, ok := displays[code]; ok {
		return display
	}
	return ""
}

// GetSnomedSpecimenDisplay returns display text for SNOMED specimen code
func GetSnomedSpecimenDisplay(code string) string {
	displays := map[string]string{
		SnomedCodeBloodSpecimen:  "Blood specimen",
		SnomedCodeUrineSpecimen:  "Urine specimen",
		SnomedCodeSputumSpecimen: "Sputum specimen",
		SnomedCodeStoolSpecimen:  "Stool specimen",
		SnomedCodeSerumSpecimen:  "Serum specimen",
		SnomedCodePlasmaSpecimen: "Plasma specimen",
		SnomedCodeCSFSpecimen:    "Cerebrospinal fluid sample",
		SnomedCodeThroatSwab:     "Throat swab",
		SnomedCodeWholeBlood:     "Whole blood sample",
		SnomedCodeTissueSpecimen: "Tissue specimen",
	}
	if display, ok := displays[code]; ok {
		return display
	}
	return ""
}
