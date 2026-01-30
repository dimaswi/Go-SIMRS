package models

import (
	"time"

	"gorm.io/gorm"
)

// ===========================================================================
// VISIT PROCEDURE - Tindakan yang dilakukan saat kunjungan
// Berbeda dengan ProcedureOrder (order tindakan ke ruangan lain)
// VisitProcedure adalah tindakan yang dikerjakan langsung di ruangan visit
// ===========================================================================

// VisitProcedure represents a procedure performed during a visit
// Tindakan yang dikerjakan langsung di ruangan (bukan order ke ruangan lain)
type VisitProcedure struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Foreign Keys
	VisitID     uint       `gorm:"not null;index" json:"visit_id"`
	Visit       *Visit     `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	ProcedureID uint       `gorm:"not null;index" json:"procedure_id"`
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`

	// Status
	Status string `gorm:"size:30;default:'pending'" json:"status"` // pending, in_progress, completed, cancelled

	// Timing
	PerformedAt *time.Time `json:"performed_at,omitempty"` // Waktu tindakan dilakukan

	// Notes
	Notes string `gorm:"type:text" json:"notes,omitempty"` // Catatan tambahan

	// SatuSehat Integration
	SatusehatProcedureID        string `gorm:"size:100" json:"satusehat_procedure_id"`        // FHIR Procedure ID
	SatusehatServiceRequestID   string `gorm:"size:100" json:"satusehat_servicerequest_id"`   // FHIR ServiceRequest ID
	SatusehatSpecimenID         string `gorm:"size:100" json:"satusehat_specimen_id"`         // FHIR Specimen ID
	SatusehatDiagnosticReportID string `gorm:"size:100" json:"satusehat_diagnosticreport_id"` // FHIR DiagnosticReport ID
	SatusehatObservationIDs     string `gorm:"type:text" json:"satusehat_observation_ids"`    // JSON array of Observation IDs

	// Audit Trail - siapa yang membuat dan mengisi
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"` // User yang membuat record
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	FilledByID  *uint `gorm:"index" json:"filled_by_id,omitempty"` // User yang mengisi/melakukan tindakan
	FilledBy    *User `gorm:"foreignKey:FilledByID" json:"filled_by,omitempty"`

	// Results - relation ke detail hasil
	Results []VisitProcedureResult `gorm:"foreignKey:VisitProcedureID" json:"results,omitempty"`
}

// TableName sets the table name
func (VisitProcedure) TableName() string {
	return "visit_procedures"
}

// VisitProcedureResult represents the result values for a procedure
// Menyimpan nilai parameter hasil dari tindakan
type VisitProcedureResult struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Foreign Keys
	VisitProcedureID uint                `gorm:"not null;index" json:"visit_procedure_id"`
	VisitProcedure   *VisitProcedure     `gorm:"foreignKey:VisitProcedureID" json:"-"`
	ParameterID      uint                `gorm:"not null;index" json:"parameter_id"`
	Parameter        *ProcedureParameter `gorm:"foreignKey:ParameterID" json:"parameter,omitempty"`

	// Result Value
	Value      string  `gorm:"type:text" json:"value"`                        // Nilai hasil (string untuk fleksibilitas)
	NumValue   float64 `gorm:"type:decimal(15,4);default:0" json:"num_value"` // Nilai numerik (untuk lab)
	IsAbnormal bool    `gorm:"default:false" json:"is_abnormal"`              // Flag nilai abnormal
	IsCritical bool    `gorm:"default:false" json:"is_critical"`              // Flag nilai kritis

	// Audit
	FilledByID *uint `gorm:"index" json:"filled_by_id,omitempty"`
	FilledBy   *User `gorm:"foreignKey:FilledByID" json:"filled_by,omitempty"`
}

// TableName sets the table name
func (VisitProcedureResult) TableName() string {
	return "visit_procedure_results"
}

// Visit Procedure Status constants
const (
	VisitProcedureStatusPending    = "pending"
	VisitProcedureStatusInProgress = "in_progress"
	VisitProcedureStatusCompleted  = "completed"
	VisitProcedureStatusCancelled  = "cancelled"
)
