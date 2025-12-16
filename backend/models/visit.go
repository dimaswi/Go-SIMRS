package models

import (
	"time"

	"gorm.io/gorm"
)

// Visit represents a patient visit to a specific room/department
// One Registration can have multiple Visits (e.g., Poli -> Lab -> Radiologi)
type Visit struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitNumber    string        `gorm:"size:50;not null;uniqueIndex" json:"visit_number"` // Nomor unik visit (VIS20241206001)
	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	DoctorID *uint     `gorm:"index" json:"doctor_id,omitempty"`
	Doctor   *Employee `gorm:"foreignKey:DoctorID" json:"doctor,omitempty"`

	VisitType     string `gorm:"size:50;not null" json:"visit_type"`   // consultation, procedure, lab, radiology, pharmacy, inpatient
	VisitPurpose  string `gorm:"type:text" json:"visit_purpose"`       // Tujuan kunjungan
	ReferralFrom  *uint  `gorm:"index" json:"referral_from,omitempty"` // Rujukan dari visit ID mana
	ReferralVisit *Visit `gorm:"foreignKey:ReferralFrom" json:"referral_visit,omitempty"`

	Status      string     `gorm:"size:20;default:'waiting';index" json:"status"` // waiting, in_queue, in_progress, completed, cancelled
	CheckInTime *time.Time `json:"check_in_time,omitempty"`                       // Waktu check-in/terdaftar
	StartTime   *time.Time `json:"start_time,omitempty"`                          // Waktu mulai dilayani
	EndTime     *time.Time `json:"end_time,omitempty"`                            // Waktu selesai

	Complaint string `gorm:"type:text" json:"complaint"` // Keluhan pasien
	Diagnosis string `gorm:"type:text" json:"diagnosis"` // Diagnosis
	Treatment string `gorm:"type:text" json:"treatment"` // Tindakan/treatment
	Notes     string `gorm:"type:text" json:"notes"`

	// Inpatient Fields (Rawat Inap)
	BedID          *uint      `gorm:"index" json:"bed_id,omitempty"`            // Bed assignment untuk rawat inap
	Bed            *Bed       `gorm:"foreignKey:BedID" json:"bed,omitempty"`    // Relasi ke bed
	AdmissionTime  *time.Time `json:"admission_time,omitempty"`                 // Waktu masuk rawat inap
	DischargeTime  *time.Time `json:"discharge_time,omitempty"`                 // Waktu keluar rawat inap
	InpatientClass string     `gorm:"size:20" json:"inpatient_class,omitempty"` // Kelas rawat inap (untuk billing)
	InpatientDays  int        `gorm:"default:0" json:"inpatient_days"`          // Jumlah hari rawat inap (computed)

	// Relationships
	RoomQueue *RoomQueue `gorm:"foreignKey:VisitID" json:"room_queue,omitempty"` // 1 Visit = 1 RoomQueue
}

// TableName specifies the table name for Visit
func (Visit) TableName() string {
	return "visits"
}

// VisitType constants
const (
	VisitTypeConsultation = "consultation" // Order Konsultasi (rujukan dari visit lain)
	VisitTypeProcedure    = "procedure"    // Tindakan medis
	VisitTypeLab          = "lab"          // Laboratorium
	VisitTypeRadiology    = "radiology"    // Radiologi
	VisitTypePharmacy     = "pharmacy"     // Farmasi
	VisitTypeInpatient    = "inpatient"    // Rawat Inap
	VisitTypeOutpatient   = "outpatient"   // Rawat Jalan (kunjungan Poli biasa)
	VisitTypeEmergency    = "emergency"    // Gawat Darurat (kunjungan UGD biasa)
	VisitTypeOther        = "other"        // Lainnya
)

// VisitStatus constants
const (
	VisitStatusWaiting    = "waiting"     // Menunggu
	VisitStatusInQueue    = "in_queue"    // Dalam antrian
	VisitStatusInProgress = "in_progress" // Sedang dilayani
	VisitStatusCompleted  = "completed"   // Selesai
	VisitStatusCancelled  = "cancelled"   // Dibatalkan
)
