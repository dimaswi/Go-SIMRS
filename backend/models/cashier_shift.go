package models

import (
	"time"

	"gorm.io/gorm"
)

// CashierShift represents a cashier's working shift
type CashierShift struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	CashierID uint  `gorm:"not null;index" json:"cashier_id"`
	Cashier   *User `gorm:"foreignKey:CashierID" json:"cashier,omitempty"`

	StartTime time.Time  `gorm:"not null" json:"start_time"`
	EndTime   *time.Time `json:"end_time,omitempty"`

	OpeningBalance float64 `gorm:"type:decimal(15,2);not null;default:0" json:"opening_balance"`
	ClosingBalance float64 `gorm:"type:decimal(15,2);default:0" json:"closing_balance"` // Calculated expected cash balance
	ActualBalance  float64 `gorm:"type:decimal(15,2);default:0" json:"actual_balance"`  // Cash manually counted by cashier

	Status string `gorm:"size:20;not null;default:'active'" json:"status"` // active, closed

	Notes string `gorm:"type:text" json:"notes"`

	// Relasi ke payments
	Payments []BillingPayment `gorm:"foreignKey:CashierShiftID" json:"payments,omitempty"`
}

// TableName sets the table name for CashierShift
func (CashierShift) TableName() string {
	return "cashier_shifts"
}
