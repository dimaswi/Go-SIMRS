package models

import (
	"time"

	"gorm.io/gorm"
)

// DayOfWeek represents day of week
type DayOfWeek int

const (
	Sunday    DayOfWeek = 0
	Monday    DayOfWeek = 1
	Tuesday   DayOfWeek = 2
	Wednesday DayOfWeek = 3
	Thursday  DayOfWeek = 4
	Friday    DayOfWeek = 5
	Saturday  DayOfWeek = 6
)

// GetDayName returns Indonesian day name
func (d DayOfWeek) GetDayName() string {
	days := map[DayOfWeek]string{
		Sunday:    "Minggu",
		Monday:    "Senin",
		Tuesday:   "Selasa",
		Wednesday: "Rabu",
		Thursday:  "Kamis",
		Friday:    "Jumat",
		Saturday:  "Sabtu",
	}
	return days[d]
}

// Schedule represents operational schedule for a room (e.g., Poliklinik)
// This defines when the room is open for service
type Schedule struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID    uint  `gorm:"not null;index" json:"room_id"`
	Room      *Room `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room,omitempty"`
	DayOfWeek int   `gorm:"not null" json:"day_of_week"` // 0=Sunday, 1=Monday, ..., 6=Saturday

	StartTime string `gorm:"size:5;not null" json:"start_time"` // Format: "HH:MM" e.g., "08:00"
	EndTime   string `gorm:"size:5;not null" json:"end_time"`   // Format: "HH:MM" e.g., "16:00"

	MaxPatients int    `gorm:"default:0" json:"max_patients"` // Max patients per session, 0 = unlimited
	IsActive    bool   `gorm:"default:true" json:"is_active"`
	Notes       string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for Schedule
func (Schedule) TableName() string {
	return "schedules"
}

// DayName returns the Indonesian day name for the schedule
func (s *Schedule) DayName() string {
	return DayOfWeek(s.DayOfWeek).GetDayName()
}

// DoctorSchedule represents a doctor's practice schedule at a specific room
// This is linked to both the doctor (Employee) and the room's schedule
type DoctorSchedule struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID     uint      `gorm:"not null;index" json:"room_id"`
	Room       *Room     `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room,omitempty"`
	EmployeeID uint      `gorm:"not null;index" json:"employee_id"`
	Employee   *Employee `gorm:"foreignKey:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"employee,omitempty"`

	DayOfWeek int    `gorm:"not null" json:"day_of_week"`       // 0=Sunday, 1=Monday, ..., 6=Saturday
	StartTime string `gorm:"size:5;not null" json:"start_time"` // Format: "HH:MM"
	EndTime   string `gorm:"size:5;not null" json:"end_time"`   // Format: "HH:MM"

	MaxPatients   int        `gorm:"default:0" json:"max_patients"`                   // Max patients for this doctor's session
	ConsultFee    float64    `gorm:"type:decimal(15,2);default:0" json:"consult_fee"` // Doctor's consultation fee
	IsActive      bool       `gorm:"default:true" json:"is_active"`
	EffectiveFrom *time.Time `json:"effective_from,omitempty"` // When this schedule becomes effective
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`   // When this schedule ends (null = indefinite)
	Notes         string     `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for DoctorSchedule
func (DoctorSchedule) TableName() string {
	return "doctor_schedules"
}

// DayName returns the Indonesian day name
func (ds *DoctorSchedule) DayName() string {
	return DayOfWeek(ds.DayOfWeek).GetDayName()
}

// ScheduleException represents exceptions to regular schedules (holidays, special closures, etc.)
type ScheduleException struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID     *uint     `gorm:"index" json:"room_id"` // If null, applies to all rooms
	Room       *Room     `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room,omitempty"`
	EmployeeID *uint     `gorm:"index" json:"employee_id"` // If null, applies to room only
	Employee   *Employee `gorm:"foreignKey:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"employee,omitempty"`

	ExceptionDate time.Time `gorm:"not null;index" json:"exception_date"`   // The date of exception
	ExceptionType string    `gorm:"size:20;not null" json:"exception_type"` // "closed", "modified", "holiday"

	// For modified schedules (optional override times)
	StartTime *string `gorm:"size:5" json:"start_time,omitempty"`
	EndTime   *string `gorm:"size:5" json:"end_time,omitempty"`

	Reason   string `gorm:"size:200" json:"reason"` // e.g., "Libur Nasional", "Cuti Dokter"
	IsActive bool   `gorm:"default:true" json:"is_active"`
}

// TableName sets the table name for ScheduleException
func (ScheduleException) TableName() string {
	return "schedule_exceptions"
}
