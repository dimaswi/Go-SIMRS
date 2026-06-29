package models

import (
	"time"

	"gorm.io/gorm"
)

// Registration represents a patient registration/visit
type Registration struct {
	gorm.Model
	RegistrationNumber string     `json:"registration_number" gorm:"size:30;uniqueIndex;not null"`
	RegistrationDate   time.Time  `json:"registration_date" gorm:"type:date;not null;index"`
	RegistrationType   string     `json:"registration_type" gorm:"size:20;default:'outpatient'"` // outpatient, inpatient, emergency
	PatientID          uint       `json:"patient_id" gorm:"not null;index"`
	Patient            *Patient   `json:"patient,omitempty" gorm:"foreignKey:PatientID"`
	QueueID            *uint      `json:"queue_id"`
	Queue              *Queue     `json:"queue,omitempty" gorm:"foreignKey:QueueID"`
	DestinationRoomID  uint       `json:"destination_room_id" gorm:"not null"` // Initial destination room
	DestinationRoom    *Room      `json:"destination_room,omitempty" gorm:"foreignKey:DestinationRoomID"`
	DoctorID           *uint      `json:"doctor_id"`
	Doctor             *Employee  `json:"doctor,omitempty" gorm:"foreignKey:DoctorID"`
	PaymentMethod      string     `json:"payment_method" gorm:"size:20;default:'cash'"` // cash, bpjs, insurance
	BPJSNumber         string     `json:"bpjs_number" gorm:"size:20"`
	InsuranceName      string     `json:"insurance_name" gorm:"size:100"`
	InsuranceNumber    string     `json:"insurance_number" gorm:"size:50"`
	Complaint          string     `json:"complaint" gorm:"type:text"`                 // Keluhan utama
	Status             string     `json:"status" gorm:"size:20;default:'registered'"` // registered, scheduled, in_queue, in_progress, completed, discharged, cancelled, no_show
	DischargedAt       *time.Time `json:"discharged_at,omitempty"`                    // Waktu pulang/dipulangkan
	RegisteredByID     uint       `json:"registered_by_id"`
	RegisteredBy       *User      `json:"registered_by,omitempty" gorm:"foreignKey:RegisteredByID"`
	Notes              string     `json:"notes" gorm:"type:text"`
	VisitNumber        int        `json:"visit_number"` // Kunjungan ke-N untuk pasien ini (lifetime count)

	// SEP (Surat Eligibilitas Peserta) untuk BPJS
	SEPNumber   string `json:"sep_number" gorm:"size:50;index"` // Nomor SEP dari VClaim
	NoRujukan   string `json:"no_rujukan" gorm:"size:50"`       // Nomor rujukan BPJS
	AsalRujukan string `json:"asal_rujukan" gorm:"size:5"`      // 1=Faskes 1, 2=Faskes 2
	TglRujukan  string `json:"tgl_rujukan" gorm:"size:10"`      // Tanggal rujukan

	// Follow-up / Scheduled Registration fields
	IsFollowUp    bool       `json:"is_follow_up" gorm:"default:false"`                       // Flag untuk jadwal kontrol
	SourceVisitID *uint      `json:"source_visit_id" gorm:"index"`                            // Visit ID asal yang order kontrol
	SourceVisit   *Visit     `json:"source_visit,omitempty" gorm:"foreignKey:SourceVisitID"`  // Relasi ke visit asal
	ScheduledDate *time.Time `json:"scheduled_date" gorm:"type:date;index"`                   // Tanggal yang dijadwalkan kontrol
	CheckedInAt   *time.Time `json:"checked_in_at,omitempty"`                                 // Waktu pasien check-in/datang
	CheckedInByID *uint      `json:"checked_in_by_id,omitempty"`                              // User yang melakukan check-in
	CheckedInBy   *User      `json:"checked_in_by,omitempty" gorm:"foreignKey:CheckedInByID"` // Relasi ke user check-in

	// Relationships - One Registration can have multiple Visits
	Visits []Visit `json:"visits,omitempty" gorm:"foreignKey:RegistrationID"`

	// For easier access to primary visit
	Visit *Visit `json:"visit,omitempty" gorm:"foreignKey:RegistrationID"`

	// SEP relation
	SEP *SEP `json:"sep,omitempty" gorm:"foreignKey:RegistrationID"`

	// Surat Kontrol relation
	SuratKontrol *SuratKontrol `json:"surat_kontrol,omitempty" gorm:"foreignKey:RegistrationID"`
}

// Registration Status constants
const (
	RegistrationStatusRegistered = "registered" // Pendaftaran biasa
	RegistrationStatusScheduled  = "scheduled"  // Jadwal kontrol (belum datang)
	RegistrationStatusInQueue    = "in_queue"   // Dalam antrian
	RegistrationStatusInProgress = "in_progress"
	RegistrationStatusCompleted  = "completed"
	RegistrationStatusDischarged = "discharged"
	RegistrationStatusCancelled  = "cancelled"
	RegistrationStatusNoShow     = "no_show" // Tidak datang setelah 30 hari
)

// TableName specifies the table name for Registration
func (Registration) TableName() string {
	return "registrations"
}
