package models

import (
	"time"

	"gorm.io/gorm"
)

// ProcedureTariff represents tariff components for each patient class
// Struktur tarif berdasarkan kelas pasien dengan komponen biaya
type ProcedureTariff struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProcedureID uint       `gorm:"not null;index;uniqueIndex:idx_procedure_class" json:"procedure_id"`
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`

	// Kelas Pasien
	PatientClass string `gorm:"not null;size:20;uniqueIndex:idx_procedure_class" json:"patient_class"` // non_kelas, kelas_3, kelas_2, kelas_1, vip, vvip, hcu, intensif, isolasi

	// Komponen Tarif
	Administrasi   float64 `gorm:"type:decimal(15,2);default:0" json:"administrasi"`    // Biaya Administrasi
	Sarana         float64 `gorm:"type:decimal(15,2);default:0" json:"sarana"`          // Sarana (fasilitas)
	BHP            float64 `gorm:"type:decimal(15,2);default:0" json:"bhp"`             // Bahan Habis Pakai
	DokterOperator float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_operator"` // Jasa Dokter Operator
	DokterAnastesi float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_anastesi"` // Jasa Dokter Anastesi
	DokterLainnya  float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_lainnya"`  // Jasa Dokter Lainnya
	PenataAnastesi float64 `gorm:"type:decimal(15,2);default:0" json:"penata_anastesi"` // Jasa Penata Anastesi
	Paramedis      float64 `gorm:"type:decimal(15,2);default:0" json:"paramedis"`       // Jasa Paramedis
	NonMedis       float64 `gorm:"type:decimal(15,2);default:0" json:"non_medis"`       // Jasa Non Medis
}

// TableName sets the table name for ProcedureTariff
func (ProcedureTariff) TableName() string {
	return "procedure_tariffs"
}

// GetTotal returns the total tariff for this class
func (pt *ProcedureTariff) GetTotal() float64 {
	return pt.Administrasi + pt.Sarana + pt.BHP + pt.DokterOperator + pt.DokterAnastesi + pt.DokterLainnya + pt.PenataAnastesi + pt.Paramedis + pt.NonMedis
}

// Procedure represents a medical procedure/service (Tindakan Medis)
type Procedure struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Basic Information
	Code        string `gorm:"not null;uniqueIndex;size:20" json:"code"` // Kode tindakan
	Name        string `gorm:"not null;size:255" json:"name"`            // Nama tindakan
	Description string `gorm:"type:text" json:"description"`             // Deskripsi tindakan

	// Procedure Type: medical, radiology, laboratory
	ProcedureType string `gorm:"size:20;default:'medical';index" json:"procedure_type"` // Jenis tindakan

	// INA-CBG Classification
	INACBGCode     string `gorm:"size:20;index" json:"inacbg_code"` // Kode INA-CBG
	INACBGName     string `gorm:"size:255" json:"inacbg_name"`      // Nama INA-CBG
	ProcedureGroup string `gorm:"size:100" json:"procedure_group"`  // Kelompok tindakan
	Specialty      string `gorm:"size:100" json:"specialty"`        // Spesialisasi
	BodySystem     string `gorm:"size:100" json:"body_system"`      // Sistem tubuh

	// Classification Codes
	ICD9CMCode   string `gorm:"size:20;index" json:"icd9cm_code"`   // ICD-9-CM Procedure Code
	ICD10PCSCode string `gorm:"size:20;index" json:"icd10pcs_code"` // ICD-10-PCS Code

	// Procedure Details
	Duration           int    `gorm:"default:0" json:"duration"`                // Estimasi durasi dalam menit
	RequiresAnesthesia bool   `gorm:"default:false" json:"requires_anesthesia"` // Perlu anestesi
	AnesthesiaType     string `gorm:"size:50" json:"anesthesia_type"`           // Jenis anestesi
	IsEmergency        bool   `gorm:"default:false" json:"is_emergency"`        // Tindakan darurat
	IsSurgical         bool   `gorm:"default:false" json:"is_surgical"`         // Tindakan bedah

	// Service Type Compatibility
	ServiceType string `gorm:"size:50" json:"service_type"` // rawat_jalan, rawat_inap, penunjang, all

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"`

	// Relations
	Tariffs        []ProcedureTariff    `gorm:"foreignKey:ProcedureID" json:"tariffs,omitempty"`
	Parameters     []ProcedureParameter `gorm:"foreignKey:ProcedureID" json:"parameters,omitempty"`
	RoomProcedures []RoomProcedure      `gorm:"foreignKey:ProcedureID" json:"room_procedures,omitempty"`
}

// TableName sets the table name for Procedure
func (Procedure) TableName() string {
	return "procedures"
}

// RoomProcedure represents the assignment of a procedure to a room
type RoomProcedure struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID      uint       `gorm:"not null;index;uniqueIndex:idx_room_procedure" json:"room_id"`
	Room        *Room      `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room,omitempty"`
	ProcedureID uint       `gorm:"not null;index;uniqueIndex:idx_room_procedure" json:"procedure_id"`
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"procedure,omitempty"`

	// Room-specific settings
	IsAvailable     bool   `gorm:"default:true" json:"is_available"`      // Tersedia di ruangan ini
	MaxPerDay       int    `gorm:"default:0" json:"max_per_day"`          // Maksimal tindakan per hari
	RequiresBooking bool   `gorm:"default:false" json:"requires_booking"` // Perlu booking
	Notes           string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for RoomProcedure
func (RoomProcedure) TableName() string {
	return "room_procedures"
}

// ProcedureCategory represents categories for procedures
type ProcedureCategory struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code        string `gorm:"not null;uniqueIndex;size:20" json:"code"`
	Name        string `gorm:"not null;size:100" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	ParentID    *uint  `gorm:"index" json:"parent_id"`
	SortOrder   int    `gorm:"default:0" json:"sort_order"`
	IsActive    bool   `gorm:"default:true" json:"is_active"`
}

// TableName sets the table name for ProcedureCategory
func (ProcedureCategory) TableName() string {
	return "procedure_categories"
}

// Patient class constants
const (
	PatientClassNonKelas = "non_kelas"
	PatientClassKelas3   = "kelas_3"
	PatientClassKelas2   = "kelas_2"
	PatientClassKelas1   = "kelas_1"
	PatientClassVIP      = "vip"
	PatientClassVVIP     = "vvip"
	PatientClassHCU      = "hcu"
	PatientClassIntensif = "intensif"
	PatientClassIsolasi  = "isolasi"
)

// GetAllPatientClasses returns all patient classes in order
func GetAllPatientClasses() []string {
	return []string{
		PatientClassNonKelas,
		PatientClassKelas3,
		PatientClassKelas2,
		PatientClassKelas1,
		PatientClassVIP,
		PatientClassVVIP,
		PatientClassHCU,
		PatientClassIntensif,
		PatientClassIsolasi,
	}
}

// GetPatientClassLabel returns the display label for a patient class
func GetPatientClassLabel(class string) string {
	labels := map[string]string{
		PatientClassNonKelas: "Non Kelas",
		PatientClassKelas3:   "Kelas III",
		PatientClassKelas2:   "Kelas II",
		PatientClassKelas1:   "Kelas I",
		PatientClassVIP:      "VIP",
		PatientClassVVIP:     "VVIP",
		PatientClassHCU:      "HCU",
		PatientClassIntensif: "Intensif",
		PatientClassIsolasi:  "Isolasi",
	}
	if label, ok := labels[class]; ok {
		return label
	}
	return class
}
