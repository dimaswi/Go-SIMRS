package models

import (
	"time"

	"gorm.io/gorm"
)

// SuratKontrol adalah model untuk menyimpan data Surat Kontrol (SKDP) rawat jalan
// Dibuat saat dokter order kontrol untuk pasien pulang
type SuratKontrol struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Nomor Surat Kontrol dari BPJS
	NoSuratKontrol string `gorm:"uniqueIndex;size:50;not null" json:"no_surat_kontrol"`

	// Link ke SIMRS
	RegistrationID *uint         `gorm:"index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`
	PatientID      uint          `gorm:"not null;index" json:"patient_id"`
	Patient        *Patient      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	VisitID        *uint         `gorm:"index" json:"visit_id"`
	Visit          *Visit        `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	SEPID          *uint         `gorm:"index" json:"sep_id"`
	SEP            *SEP          `gorm:"foreignKey:SEPID" json:"sep,omitempty"`

	// Data dari SEP Asal
	NoSEP string `gorm:"size:50;not null;index" json:"no_sep"` // SEP kunjungan saat ini

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

	// Data PRB (Program Rujuk Balik) - Optional
	IsPRB         bool   `gorm:"default:false" json:"is_prb"`
	KdStatusPRB   string `gorm:"size:10" json:"kd_status_prb"` // 01-09
	NamaStatusPRB string `gorm:"size:100" json:"nama_status_prb"`
	DataPRB       string `gorm:"type:text" json:"data_prb"` // JSON string of PRB data

	// User yang membuat
	UserBuat string `gorm:"size:50" json:"user_buat"`

	// Status
	Status string `gorm:"size:20;default:'active'" json:"status"` // active, used, cancelled
}

// TableName returns table name for SuratKontrol
func (SuratKontrol) TableName() string {
	return "surat_kontrol"
}

// PRBStatusOptions adalah pilihan status PRB
var PRBStatusOptions = []struct {
	Kode string `json:"kode"`
	Nama string `json:"nama"`
}{
	{"01", "Diabetes Melitus"},
	{"02", "Hipertensi"},
	{"03", "Asma"},
	{"04", "Penyakit Jantung"},
	{"05", "PPOK"},
	{"06", "Skizofrenia"},
	{"07", "Stroke"},
	{"08", "Epilepsi"},
	{"09", "SLE"},
}

// PRBFormData adalah struktur data form PRB
type PRBFormData struct {
	// Diabetes Melitus (01), Stroke (07)
	HBA1C       *float64 `json:"HBA1C,omitempty"`        // 0.1 - 15
	GDP         *float64 `json:"GDP,omitempty"`          // 10 - 500
	GD2JPP      *float64 `json:"GD2JPP,omitempty"`       // 10 - 500
	EGFR        *float64 `json:"eGFR,omitempty"`         // 5 - 150
	TDSistolik  *float64 `json:"TD_Sistolik,omitempty"`  // 20 - 200
	TDDiastolik *float64 `json:"TD_Diastolik,omitempty"` // 20 - 200
	LDL         *float64 `json:"LDL,omitempty"`          // 20 - 500

	// Hipertensi (02), Penyakit Jantung (04)
	RataTDSistolik  *float64 `json:"Rata_TD_Sistolik,omitempty"`  // 20 - 200
	RataTDDiastolik *float64 `json:"Rata_TD_Diastolik,omitempty"` // 20 - 200
	JantungKoroner  *int     `json:"JantungKoroner,omitempty"`    // 0 atau 1
	Stroke          *int     `json:"Stroke,omitempty"`            // 0 atau 1
	VaskularPerifer *int     `json:"VaskularPerifer,omitempty"`   // 0 atau 1
	Aritmia         *int     `json:"Aritmia,omitempty"`           // 0 atau 1
	AtrialFibrilasi *int     `json:"AtrialFibrilasi,omitempty"`   // 0 atau 1

	// Penyakit Jantung (04)
	NadiIstirahat       *float64 `json:"NadiIstirahat,omitempty"`       // 20 - 200
	SesakNapas3Bulan    *int     `json:"SesakNapas3Bulan,omitempty"`    // 0 atau 1
	NyeriDada3Bulan     *int     `json:"NyeriDada3Bulan,omitempty"`     // 0 atau 1
	SesakNapasAktivitas *int     `json:"SesakNapasAktivitas,omitempty"` // 0 atau 1
	NyeriDadaAktivitas  *int     `json:"NyeriDadaAktivitas,omitempty"`  // 0 atau 1

	// Asma (03)
	Terkontrol        *int     `json:"Terkontrol,omitempty"`        // 0 atau 1
	Gejala2xMinggu    *int     `json:"Gejala2xMinggu,omitempty"`    // 0 atau 1
	BangunMalam       *int     `json:"BangunMalam,omitempty"`       // 0 atau 1
	KeterbatasanFisik *int     `json:"KeterbatasanFisik,omitempty"` // 0 atau 1
	FungsiParu        *float64 `json:"FungsiParu,omitempty"`        // 0 - 100

	// PPOK (05)
	SkorMMRC          *float64 `json:"SkorMMRC,omitempty"`          // 0 - 40
	Eksaserbasi1Tahun *int     `json:"Eksaserbasi1Tahun,omitempty"` // 0 atau 1
	MampuAktivitas    *int     `json:"MampuAktivitas,omitempty"`    // 0 atau 1

	// Epilepsi (08)
	Epileptik6Bulan *int `json:"Epileptik6Bulan,omitempty"` // 0 atau 1
	EfekSampingOAB  *int `json:"EfekSampingOAB,omitempty"`  // 0 atau 1
	HamilMenyusui   *int `json:"HamilMenyusui,omitempty"`   // 0 atau 1

	// Skizofrenia (06)
	Remisi        *float64 `json:"Remisi,omitempty"`        // 0 - 100
	TerapiRumatan *int     `json:"TerapiRumatan,omitempty"` // 0 atau 1
	Usia          *int     `json:"Usia,omitempty"`          // 1 - 100

	// Stroke (07)
	AsamUrat *float64 `json:"AsamUrat,omitempty"` // 0.1 - 20

	// SLE (09)
	RemisiSLE *float64 `json:"RemisiSLE,omitempty"` // 0 - 100
	Hamil     *int     `json:"Hamil,omitempty"`     // 0 atau 1
}
