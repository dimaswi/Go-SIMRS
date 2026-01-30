package models

import (
	"time"

	"gorm.io/gorm"
)

// KFAProductType represents the type of KFA product
type KFAProductType string

const (
	KFAProductTypeObat          KFAProductType = "obat"           // Obat
	KFAProductTypeAlatKesehatan KFAProductType = "alat_kesehatan" // Alat Kesehatan
)

// MedicineKFAMapping represents the mapping between local medicine and SatuSehat KFA code
type MedicineKFAMapping struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Local Medicine Reference
	MedicineID uint      `gorm:"not null;uniqueIndex" json:"medicine_id"` // One medicine can only have one KFA mapping
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// KFA (Kode Farmasi Indonesia) Information
	KFACode        string         `gorm:"not null;size:50;index" json:"kfa_code"`          // Kode KFA (e.g., "93001295")
	KFAName        string         `gorm:"not null;size:500" json:"kfa_name"`               // Nama di KFA
	KFAProductType KFAProductType `gorm:"not null;size:50;default:'obat'" json:"kfa_type"` // Tipe produk KFA
	KFAFarmalkes   string         `gorm:"size:100" json:"kfa_farmalkes"`                   // Kode Farmalkes (jika ada)

	// Additional KFA Info
	KFADisplayName  string `gorm:"size:500" json:"kfa_display_name"` // Display name untuk FHIR
	KFAForm         string `gorm:"size:100" json:"kfa_form"`         // Bentuk sediaan di KFA
	KFAStrength     string `gorm:"size:100" json:"kfa_strength"`     // Kekuatan di KFA
	KFAManufacturer string `gorm:"size:200" json:"kfa_manufacturer"` // Produsen di KFA

	// Verification
	IsVerified   bool       `gorm:"default:false" json:"is_verified"` // Sudah diverifikasi mapping-nya
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`            // Waktu verifikasi
	VerifiedByID *uint      `json:"verified_by_id,omitempty"`         // User yang memverifikasi
	VerifiedBy   *User      `gorm:"foreignKey:VerifiedByID" json:"verified_by,omitempty"`

	// Status
	IsActive bool   `gorm:"default:true" json:"is_active"`
	Notes    string `gorm:"type:text" json:"notes"` // Catatan tambahan

	// SatuSehat Medication Resource
	SatuSehatMedicationID string     `gorm:"size:100;index" json:"satusehat_medication_id"` // ID Medication resource di SatuSehat
	SatuSehatSentAt       *time.Time `json:"satusehat_sent_at,omitempty"`                   // Waktu kirim ke SatuSehat
}

// TableName sets the table name for MedicineKFAMapping
func (MedicineKFAMapping) TableName() string {
	return "medicine_kfa_mappings"
}

// KFAMaster represents the master data of KFA codes (can be imported from SatuSehat)
type KFAMaster struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// KFA Information
	KFACode        string         `gorm:"not null;uniqueIndex;size:50" json:"kfa_code"` // Kode KFA unik
	KFAName        string         `gorm:"not null;size:500;index" json:"kfa_name"`      // Nama produk
	KFAProductType KFAProductType `gorm:"not null;size:50;default:'obat'" json:"kfa_type"`
	KFAFarmalkes   string         `gorm:"size:100" json:"kfa_farmalkes"` // Kode Farmalkes

	// Product Details
	Form         string `gorm:"size:100" json:"form"`         // Bentuk sediaan
	Strength     string `gorm:"size:100" json:"strength"`     // Kekuatan/Dosis
	Manufacturer string `gorm:"size:200" json:"manufacturer"` // Produsen
	Category     string `gorm:"size:100" json:"category"`     // Kategori obat

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"`

	// SatuSehat Sync Info
	SyncedAt *time.Time `json:"synced_at,omitempty"` // Last sync from SatuSehat
}

// TableName sets the table name for KFAMaster
func (KFAMaster) TableName() string {
	return "kfa_masters"
}
