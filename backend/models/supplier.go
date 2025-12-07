package models

import (
	"time"

	"gorm.io/gorm"
)

// Supplier represents a supplier in the system
type Supplier struct {
	ID              uint           `gorm:"primarykey" json:"id"`
	Code            string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Name            string         `gorm:"type:varchar(255);not null" json:"name"`
	Address         string         `gorm:"type:text" json:"address"`
	Phone           string         `gorm:"type:varchar(50)" json:"phone"`
	Email           string         `gorm:"type:varchar(100)" json:"email"`
	NPWP            string         `gorm:"type:varchar(50)" json:"npwp"`
	ContactPerson   string         `gorm:"type:varchar(100)" json:"contact_person"`
	ContactPhone    string         `gorm:"type:varchar(50)" json:"contact_phone"`
	BankName        string         `gorm:"type:varchar(100)" json:"bank_name"`
	BankAccount     string         `gorm:"type:varchar(50)" json:"bank_account"`
	BankAccountName string         `gorm:"type:varchar(100)" json:"bank_account_name"`
	Notes           string         `gorm:"type:text" json:"notes"`
	IsActive        bool           `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// TableName returns the table name for Supplier
func (Supplier) TableName() string {
	return "suppliers"
}
