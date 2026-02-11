package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Email      string         `gorm:"not null;size:150" json:"email"`
	Username   string         `gorm:"not null;size:50" json:"username"`
	Password   string         `gorm:"not null;size:255" json:"-"`
	FullName   string         `gorm:"size:100" json:"full_name"`
	IsActive   bool           `gorm:"default:true" json:"is_active"`
	RoleID     uint           `gorm:"not null;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"role_id"`
	Role       Role           `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	EmployeeID *uint          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"employee_id,omitempty"`
	Employee   *Employee      `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`

	// Signature PIN (6-digit PIN for digital signature verification)
	SignaturePin      string     `gorm:"size:255" json:"-"`              // Hashed PIN, never exposed in JSON
	SignaturePinSetAt *time.Time `json:"signature_pin_set_at,omitempty"` // When PIN was last set
	HasSignaturePin   bool       `gorm:"-" json:"has_signature_pin"`     // Computed field for frontend
}

// HashPassword hashes the user password
func (u *User) HashPassword(password string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	if err != nil {
		return err
	}
	u.Password = string(bytes)
	return nil
}

// CheckPassword checks if the provided password matches
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// HashSignaturePin hashes the signature PIN
func (u *User) HashSignaturePin(pin string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(pin), 14)
	if err != nil {
		return err
	}
	u.SignaturePin = string(bytes)
	return nil
}

// CheckSignaturePin checks if the provided PIN matches
func (u *User) CheckSignaturePin(pin string) bool {
	if u.SignaturePin == "" {
		return false
	}
	err := bcrypt.CompareHashAndPassword([]byte(u.SignaturePin), []byte(pin))
	return err == nil
}

// AfterFind hook to set computed fields
func (u *User) AfterFind(tx *gorm.DB) error {
	u.HasSignaturePin = u.SignaturePin != ""
	return nil
}
