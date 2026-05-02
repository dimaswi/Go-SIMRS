package models

import (
	"time"

	"gorm.io/gorm"
)

// FallRiskAssessment represents a fall risk assessment
// Mendukung Morse Fall Scale (Dewasa), Humpty Dumpty (Anak), dan Ontario Modified Stratify (Geriatri)
type FallRiskAssessment struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	RecordDate time.Time `gorm:"not null;index" json:"record_date"`

	ScaleType  string `gorm:"size:50;not null" json:"scale_type"` // morse, humpty_dumpty, stratify
	ItemsJSON  string `gorm:"type:text" json:"items_json"`        // Detail pilihan dalam format JSON
	TotalScore int    `gorm:"not null" json:"total_score"`        // Total skor
	RiskLevel  string `gorm:"size:50;not null" json:"risk_level"` // rendah, sedang, tinggi
	RiskAction string `gorm:"type:text" json:"risk_action"`       // Tindakan yang dilakukan (JSON array)
	Notes      string `gorm:"type:text" json:"notes,omitempty"`

	// Audit
	AssessedByID *uint `gorm:"index" json:"assessed_by_id,omitempty"`
	AssessedBy   *User `gorm:"foreignKey:AssessedByID" json:"assessed_by,omitempty"`
}

func (FallRiskAssessment) TableName() string {
	return "fall_risk_assessments"
}
