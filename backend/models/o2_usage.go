package models

import (
	"time"

	"gorm.io/gorm"
)

// O2UsageRecord represents a single oxygen usage session for an inpatient visit.
// Billing model: per tabung (tank), bukan per liter.
type O2UsageRecord struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	// Oxygen session details
	TankType       string    `gorm:"size:20;not null" json:"tank_type"`       // besar, kecil
	FlowRate       float64   `gorm:"not null" json:"flow_rate"`               // L/menit (untuk dokumentasi klinis)
	DeliveryMethod string    `gorm:"size:100;not null" json:"delivery_method"` // nasal_kanul, simple_mask, nrm, venturi_mask
	StartedAt      time.Time `gorm:"not null;index" json:"started_at"`
	StoppedAt      *time.Time `json:"stopped_at"` // nil = masih berjalan

	// Billing: per liter / per minute
	DurationMinutes int     `gorm:"default:0" json:"duration_minutes"` // computed on stop
	BasePrice       float64 `gorm:"default:0" json:"base_price"`       // harga per liter dari master data (snapshot)
	TotalCharge     float64 `gorm:"default:0" json:"total_charge"`     // FlowRate × DurationMinutes × BasePrice
	Billed          bool    `gorm:"default:false" json:"billed"`

	Notes string `gorm:"type:text" json:"notes,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	StoppedByID *uint `gorm:"index" json:"stopped_by_id,omitempty"`
	StoppedBy   *User `gorm:"foreignKey:StoppedByID" json:"stopped_by,omitempty"`
}

func (O2UsageRecord) TableName() string {
	return "o2_usage_records"
}
