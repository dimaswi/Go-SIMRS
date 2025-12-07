package models

import (
	"time"

	"gorm.io/gorm"
)

// Queue represents a patient queue entry for registration counter
type Queue struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	QueueNumber string         `json:"queue_number" gorm:"size:20;not null"`             // A001, B001, E001
	QueueDate   time.Time      `json:"queue_date" gorm:"type:date;not null;index"`       // Date of queue
	QueueType   string         `json:"queue_type" gorm:"size:20;default:'general'"`      // general, bpjs, emergency
	CounterID   uint           `json:"counter_id" gorm:"not null"`                       // Registration counter ID (FK)
	Counter     *Counter       `json:"counter,omitempty" gorm:"foreignKey:CounterID"`    // Counter relation
	Status      string         `json:"status" gorm:"size:20;default:'waiting'"`          // waiting, called, serving, completed, cancelled, skipped
	CalledAt    *time.Time     `json:"called_at"`                                        // When the queue was called
	CalledByID  *uint          `json:"called_by_id"`                                     // User who called this queue
	CalledBy    *User          `json:"called_by,omitempty" gorm:"foreignKey:CalledByID"` // User relation
	ServicedAt  *time.Time     `json:"serviced_at"`                                      // When service started
	CompletedAt *time.Time     `json:"completed_at"`                                     // When service completed
	Notes       string         `json:"notes" gorm:"type:text"`                           // Optional notes
}

// TableName specifies the table name for Queue
func (Queue) TableName() string {
	return "queues"
}

// QueueCounter tracks the last queue number per type per day
type QueueCounter struct {
	ID         uint           `json:"id" gorm:"primarykey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	QueueDate  time.Time      `json:"queue_date" gorm:"type:date;not null;uniqueIndex:idx_queue_counter"`
	QueueType  string         `json:"queue_type" gorm:"size:20;not null;uniqueIndex:idx_queue_counter"`
	LastNumber int            `json:"last_number" gorm:"default:0"`
}

// TableName specifies the table name for QueueCounter
func (QueueCounter) TableName() string {
	return "queue_counters"
}
