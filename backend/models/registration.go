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
	Status             string     `json:"status" gorm:"size:20;default:'registered'"` // registered, in_queue, in_progress, completed, discharged, cancelled
	DischargedAt       *time.Time `json:"discharged_at,omitempty"`                    // Waktu pulang/dipulangkan
	RegisteredByID     uint       `json:"registered_by_id"`
	RegisteredBy       *User      `json:"registered_by,omitempty" gorm:"foreignKey:RegisteredByID"`
	Notes              string     `json:"notes" gorm:"type:text"`
	VisitNumber        int        `json:"visit_number"` // Kunjungan ke-N untuk pasien ini (lifetime count)

	// Relationships - One Registration can have multiple Visits
	Visits []Visit `json:"visits,omitempty" gorm:"foreignKey:RegistrationID"`

	// For easier access to primary visit
	Visit *Visit `json:"visit,omitempty" gorm:"foreignKey:RegistrationID"`
}

// TableName specifies the table name for Registration
func (Registration) TableName() string {
	return "registrations"
}
