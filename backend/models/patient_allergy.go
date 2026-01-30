package models

import (
	"time"

	"gorm.io/gorm"
)

// PatientAllergy stores patient allergy data with SNOMED CT codes
// Used for structured allergy recording in medical records
type PatientAllergy struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// References
	PatientID uint `gorm:"not null;index" json:"patient_id"`
	VisitID   uint `gorm:"index" json:"visit_id"` // Visit where allergy was recorded

	// SNOMED CT Code (from snomed_ct table)
	SnomedCode    string `gorm:"size:20;not null" json:"snomed_code"`     // e.g., "91936005"
	SnomedDisplay string `gorm:"size:255;not null" json:"snomed_display"` // e.g., "Allergy to penicillin"

	// Category: food, medication, environment, biologic
	Category string `gorm:"size:50;not null;default:'medication'" json:"category"`

	// Criticality: low, high, unable-to-assess
	Criticality string `gorm:"size:50;default:'low'" json:"criticality"`

	// Additional info
	Notes      string     `gorm:"type:text" json:"notes"`
	OnsetDate  *time.Time `json:"onset_date,omitempty"` // When allergy first occurred
	RecordedAt time.Time  `gorm:"not null" json:"recorded_at"`
	RecordedBy *uint      `json:"recorded_by,omitempty"` // User ID who recorded (optional)

	// SatuSehat integration
	SatuSehatID     string     `gorm:"size:100" json:"satusehat_id,omitempty"`
	SatuSehatSentAt *time.Time `json:"satusehat_sent_at,omitempty"`

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"` // False if allergy resolved

	// Relations
	Patient        *Patient `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Visit          *Visit   `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	RecordedByUser *User    `gorm:"foreignKey:RecordedBy" json:"recorded_by_user,omitempty"`
}

func (PatientAllergy) TableName() string {
	return "patient_allergies"
}

// AllergyCategory constants
const (
	AllergyCategoryFood        = "food"
	AllergyCategoryMedication  = "medication"
	AllergyCategoryEnvironment = "environment"
	AllergyCategoryBiologic    = "biologic"
)

// AllergyCriticality constants
const (
	AllergyCriticalityLow            = "low"
	AllergyCriticalityHigh           = "high"
	AllergyCriticalityUnableToAssess = "unable-to-assess"
)

// GetAllergyCategoryOptions returns available allergy categories
func GetAllergyCategoryOptions() []map[string]string {
	return []map[string]string{
		{"value": AllergyCategoryMedication, "label": "Obat"},
		{"value": AllergyCategoryFood, "label": "Makanan"},
		{"value": AllergyCategoryEnvironment, "label": "Lingkungan"},
		{"value": AllergyCategoryBiologic, "label": "Biologis"},
	}
}

// GetAllergyCriticalityOptions returns available criticality levels
func GetAllergyCriticalityOptions() []map[string]string {
	return []map[string]string{
		{"value": AllergyCriticalityLow, "label": "Rendah"},
		{"value": AllergyCriticalityHigh, "label": "Tinggi"},
		{"value": AllergyCriticalityUnableToAssess, "label": "Tidak Dapat Dinilai"},
	}
}
