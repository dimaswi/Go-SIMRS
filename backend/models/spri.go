package models

import (
	"time"

	"gorm.io/gorm"
)

// SPRI adalah model untuk menyimpan data SPRI (Surat Perintah Rawat Inap)
type SPRI struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Nomor SPRI dari BPJS (atau lokal sementara dengan prefix "LOCAL-")
	NoSPRI string `gorm:"uniqueIndex;size:50;not null" json:"no_spri"`
	// Apakah sudah terkirim ke BPJS VClaim (false = draft lokal)
	IsBPJS bool `gorm:"default:false" json:"is_bpjs"`

	// Link ke SIMRS
	RegistrationID *uint         `gorm:"index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`
	PatientID      uint          `gorm:"not null;index" json:"patient_id"`
	Patient        *Patient      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	VisitID        *uint         `gorm:"index" json:"visit_id"`
	Visit          *Visit        `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	SEPID          *uint         `gorm:"index" json:"sep_id"`
	SEP            *SEP          `gorm:"foreignKey:SEPID" json:"sep,omitempty"`

	// Data Peserta BPJS
	NoKartu  string `gorm:"size:20;not null;index" json:"no_kartu"`
	Nama     string `gorm:"size:150" json:"nama"`
	Kelamin  string `gorm:"size:20" json:"kelamin"`
	TglLahir string `gorm:"size:10" json:"tgl_lahir"`

	// Data Rencana Kontrol
	TglRencanaKontrol string `gorm:"size:10;not null" json:"tgl_rencana_kontrol"` // yyyy-mm-dd
	KodePoli          string `gorm:"size:50;index" json:"kode_poli"`
	NamaPoli          string `gorm:"size:200" json:"nama_poli"`
	KodeDokter        string `gorm:"size:20;index" json:"kode_dokter"`
	NamaDokter        string `gorm:"size:200" json:"nama_dokter"`
	NamaDiagnosa      string `gorm:"size:500" json:"nama_diagnosa"`

	// User yang membuat
	UserBuat string `gorm:"size:50" json:"user_buat"`

	// Status
	Status string `gorm:"size:20;default:'active'" json:"status"` // active, used, cancelled
}

// TableName returns table name for SPRI
func (SPRI) TableName() string {
	return "spri"
}
