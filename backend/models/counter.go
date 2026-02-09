package models

import (
	"time"

	"gorm.io/gorm"
)

// Counter represents a registration counter/loket
type Counter struct {
	ID           uint           `json:"id" gorm:"primarykey"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Name         string         `json:"name" gorm:"size:100;not null"`      // e.g., "Loket 1", "Loket VIP"
	Code         string         `json:"code" gorm:"size:20;not null;index"` // e.g., "L1", "LVIP"
	Description  string         `json:"description" gorm:"type:text"`       // Optional description
	IsActive     bool           `json:"is_active" gorm:"default:true"`      // Active/inactive status
	IsOpen       bool           `json:"is_open" gorm:"default:false"`       // Open/closed for daily operation
	DisplayOrder int            `json:"display_order" gorm:"default:0"`     // Order for display
	Location     string         `json:"location" gorm:"size:200"`           // Physical location
}

// TableName specifies the table name for Counter
func (Counter) TableName() string {
	return "counters"
}
