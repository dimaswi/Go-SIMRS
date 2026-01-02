package models

import (
	"time"

	"gorm.io/gorm"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeVisitCreated      NotificationType = "visit_created"
	NotificationTypeAdmissionRequest  NotificationType = "admission_request"
	NotificationTypeAdmissionApproved NotificationType = "admission_approved"
	NotificationTypeAdmissionRejected NotificationType = "admission_rejected"
	NotificationTypePatientTransfer   NotificationType = "patient_transfer"
	NotificationTypeProcedureOrder    NotificationType = "procedure_order"
	NotificationTypeMedicineOrder     NotificationType = "medicine_order"
	NotificationTypeBedTransfer       NotificationType = "bed_transfer"
	NotificationTypeDischarge         NotificationType = "discharge"
	NotificationTypeGeneral           NotificationType = "general"
)

// Notification represents a notification for a user
type Notification struct {
	ID        uint             `json:"id" gorm:"primaryKey"`
	UserID    uint             `json:"user_id" gorm:"index;not null"`
	RoomID    *uint            `json:"room_id" gorm:"index"` // Target room for room-based notifications
	Type      NotificationType `json:"type" gorm:"type:varchar(50);not null"`
	Title     string           `json:"title" gorm:"type:varchar(255);not null"`
	Message   string           `json:"message" gorm:"type:text;not null"`
	Data      string           `json:"data" gorm:"type:text"` // JSON data for additional info
	IsRead    bool             `json:"is_read" gorm:"default:false"`
	ReadAt    *time.Time       `json:"read_at"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
	DeletedAt gorm.DeletedAt   `json:"-" gorm:"index"`

	// Relations
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Room *Room `json:"room,omitempty" gorm:"foreignKey:RoomID"`
}

// UserRoomAssignment links users to rooms they're assigned to
type UserRoomAssignment struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    uint           `json:"user_id" gorm:"index;not null"`
	RoomID    uint           `json:"room_id" gorm:"index;not null"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Relations
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Room *Room `json:"room,omitempty" gorm:"foreignKey:RoomID"`
}

// NotificationRequest for creating notifications
type NotificationRequest struct {
	UserID  uint             `json:"user_id"`
	RoomID  *uint            `json:"room_id"`
	Type    NotificationType `json:"type"`
	Title   string           `json:"title" binding:"required"`
	Message string           `json:"message" binding:"required"`
	Data    string           `json:"data"`
}

// NotificationResponse for API responses
type NotificationResponse struct {
	ID        uint             `json:"id"`
	Type      NotificationType `json:"type"`
	Title     string           `json:"title"`
	Message   string           `json:"message"`
	Data      string           `json:"data"`
	IsRead    bool             `json:"is_read"`
	ReadAt    *time.Time       `json:"read_at"`
	CreatedAt time.Time        `json:"created_at"`
	Room      *RoomBasic       `json:"room,omitempty"`
}

// RoomBasic for notification room info
type RoomBasic struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

func (Notification) TableName() string {
	return "notifications"
}

func (UserRoomAssignment) TableName() string {
	return "user_room_assignments"
}
