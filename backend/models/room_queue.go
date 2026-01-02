package models

import (
	"time"

	"gorm.io/gorm"
)

// RoomQueue represents a queue entry for a specific room
// Each Visit gets one RoomQueue for the destination room
type RoomQueue struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	QueueNumber string    `gorm:"size:20;not null;index" json:"queue_number"` // A001, B012, L005, R003
	QueueCode   string    `gorm:"size:10;not null" json:"queue_code"`         // A, B, L, R (prefix per room)
	QueueDate   time.Time `gorm:"type:date;not null;index" json:"queue_date"` // Tanggal antrian

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"` // 1 visit = 1 room queue
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	Priority string `gorm:"size:20;default:'normal'" json:"priority"`      // normal, urgent, emergency
	Status   string `gorm:"size:20;default:'waiting';index" json:"status"` // waiting, called, serving, completed, skipped, cancelled

	// Call tracking
	CalledAt   *time.Time `json:"called_at,omitempty"`
	CalledByID *uint      `gorm:"index" json:"called_by_id,omitempty"`
	CalledBy   *User      `gorm:"foreignKey:CalledByID" json:"called_by,omitempty"`

	// Service tracking
	ServedAt    *time.Time `json:"served_at,omitempty"`    // Waktu mulai dilayani
	CompletedAt *time.Time `json:"completed_at,omitempty"` // Waktu selesai dilayani

	// Wait time estimation
	EstimatedWaitTime int `gorm:"default:0" json:"estimated_wait_time"` // Estimasi waktu tunggu dalam menit

	Notes string `gorm:"type:text" json:"notes"`
}

// TableName specifies the table name for RoomQueue
func (RoomQueue) TableName() string {
	return "room_queues"
}

// RoomQueuePriority constants
const (
	RoomQueuePriorityNormal    = "normal"
	RoomQueuePriorityUrgent    = "urgent"
	RoomQueuePriorityEmergency = "emergency"

	// Alias for backward compatibility
	PriorityNormal    = RoomQueuePriorityNormal
	PriorityUrgent    = RoomQueuePriorityUrgent
	PriorityEmergency = RoomQueuePriorityEmergency
)

// RoomQueueStatus constants
const (
	RoomQueueStatusReserved  = "reserved"  // Antrian dipesan (kontrol/jadwal - belum check-in)
	RoomQueueStatusWaiting   = "waiting"   // Menunggu dipanggil (sudah check-in/aktif)
	RoomQueueStatusCalled    = "called"    // Sedang dipanggil
	RoomQueueStatusServing   = "serving"   // Sedang dilayani
	RoomQueueStatusCompleted = "completed" // Selesai
	RoomQueueStatusSkipped   = "skipped"   // Dilewati
	RoomQueueStatusCancelled = "cancelled" // Dibatalkan
)

// GetDisplayInfo returns patient and registration info for display
func (rq *RoomQueue) GetDisplayInfo() map[string]interface{} {
	if rq.Visit == nil || rq.Visit.Registration == nil || rq.Visit.Registration.Patient == nil {
		return map[string]interface{}{
			"queue_number": rq.QueueNumber,
			"status":       rq.Status,
		}
	}

	patient := rq.Visit.Registration.Patient
	return map[string]interface{}{
		"queue_number":  rq.QueueNumber,
		"patient_name":  patient.NamaLengkap,
		"patient_no_rm": patient.NoRM,
		"room_name":     rq.Room.Name,
		"status":        rq.Status,
		"priority":      rq.Priority,
		"called_at":     rq.CalledAt,
	}
}
