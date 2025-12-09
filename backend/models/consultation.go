package models

import (
	"time"

	"gorm.io/gorm"
)

// Consultation represents a consultation response/answer
// Untuk menjawab order konsultasi dari dokter lain
type Consultation struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Visit reference
	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Consultation Order reference (optional)
	ProcedureOrderID *uint           `gorm:"index" json:"procedure_order_id,omitempty"`
	ProcedureOrder   *ProcedureOrder `gorm:"foreignKey:ProcedureOrderID" json:"procedure_order,omitempty"`

	// SOAP Format for consultation response
	Subjective string `gorm:"type:text" json:"subjective,omitempty"` // S - Keluhan/apa yang dirasakan pasien
	Objective  string `gorm:"type:text" json:"objective,omitempty"`  // O - Hasil pemeriksaan fisik, vital sign, dll
	Assessment string `gorm:"type:text" json:"assessment,omitempty"` // A - Diagnosis/penilaian konsultan
	Plan       string `gorm:"type:text" json:"plan,omitempty"`       // P - Rencana tindakan/saran dari konsultan

	// Additional fields
	Recommendation string `gorm:"type:text" json:"recommendation,omitempty"` // Rekomendasi khusus
	Notes          string `gorm:"type:text" json:"notes,omitempty"`          // Catatan tambahan

	// Consultant (dokter yang memberikan jawaban konsultasi)
	ConsultantID *uint     `gorm:"index" json:"consultant_id,omitempty"`
	Consultant   *Employee `gorm:"foreignKey:ConsultantID" json:"consultant,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (Consultation) TableName() string {
	return "consultations"
}
