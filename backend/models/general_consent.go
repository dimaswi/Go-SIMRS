package models

import (
	"time"

	"gorm.io/gorm"
)

type GeneralConsent struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"uniqueIndex;not null" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Siapa yang menyetujui
	SignerName     string `gorm:"size:255" json:"signer_name"`
	SignerRelation string `gorm:"size:100" json:"signer_relation"` // "pasien", "suami", "istri", "anak", "ayah", dll

	// Data Penanggung Jawab Lengkap
	PjNama         string `gorm:"size:255" json:"pj_nama"`
	PjUmur         int    `json:"pj_umur"`
	PjJenisKelamin string `gorm:"size:20" json:"pj_jenis_kelamin"`
	PjAlamat       string `gorm:"type:text" json:"pj_alamat"`
	PjNoIdentitas  string `gorm:"size:50" json:"pj_no_identitas"`
	PjNoTelp       string `gorm:"size:20" json:"pj_no_telp"`
	PjHubungan     string `gorm:"size:100" json:"pj_hubungan"`

	// Daftar pihak yang diberi kuasa
	AuthorizedPersons []GeneralConsentAuthorizedPerson `gorm:"foreignKey:GeneralConsentID" json:"authorized_persons,omitempty"`

	// Audit
	CreatedByID *uint `json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	UpdatedByID *uint `json:"updated_by_id,omitempty"`
	UpdatedBy   *User `gorm:"foreignKey:UpdatedByID" json:"updated_by,omitempty"`
}

type GeneralConsentAuthorizedPerson struct {
	ID               uint           `gorm:"primarykey" json:"id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	
	GeneralConsentID uint           `gorm:"index;not null" json:"general_consent_id"`
	Name             string         `gorm:"size:255" json:"name"`
	Relation         string         `gorm:"size:100" json:"relation"`
	Phone            string         `gorm:"size:50" json:"phone"`
}

func (GeneralConsent) TableName() string {
	return "general_consents"
}

func (GeneralConsentAuthorizedPerson) TableName() string {
	return "general_consent_authorized_persons"
}
