package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	VisitMedicineStatusRecorded  = "recorded"
	VisitMedicineStatusCancelled = "cancelled"
)

// VisitMedicineItem represents medicine taken directly from room stock for a visit.
type VisitMedicineItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	RoomMedicineID *uint         `gorm:"index" json:"room_medicine_id,omitempty"`
	RoomMedicine   *RoomMedicine `gorm:"foreignKey:RoomMedicineID" json:"room_medicine,omitempty"`

	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	Quantity int    `gorm:"not null" json:"quantity"`
	Unit     string `gorm:"size:50" json:"unit"`

	Dosage       string `gorm:"size:100" json:"dosage"`
	Frequency    string `gorm:"size:100" json:"frequency"`
	Route        string `gorm:"size:50" json:"route"`
	Duration     string `gorm:"size:50" json:"duration"`
	Instructions string `gorm:"type:text" json:"instructions"`
	Notes        string `gorm:"type:text" json:"notes"`

	Status string `gorm:"size:20;default:'recorded'" json:"status"`
}

func (VisitMedicineItem) TableName() string {
	return "visit_medicine_items"
}
