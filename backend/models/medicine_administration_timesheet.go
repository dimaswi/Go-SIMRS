package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	TimesheetStatusScheduled       = "scheduled"
	TimesheetStatusGiven           = "given"
	TimesheetStatusHeld            = "held"
	TimesheetStatusSkipped         = "skipped"
	TimesheetStatusRefused         = "refused"
	TimesheetStatusUnavailable     = "not_available"
	TimesheetStatusContraindicated = "contraindicated"
	TimesheetStatusPatientAbsent   = "patient_absent"

	TimesheetReasonClinicalHold       = "clinical_hold"
	TimesheetReasonContraindication   = "contraindication"
	TimesheetReasonPatientRefused     = "patient_refused"
	TimesheetReasonDrugUnavailable    = "drug_unavailable"
	TimesheetReasonPatientUnavailable = "patient_unavailable"
	TimesheetReasonOther              = "other"
)

// MedicineAdministrationTimesheetItem stores user-selected medication rows for a visit timesheet.
type MedicineAdministrationTimesheetItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	MedicineName string `gorm:"size:200;not null" json:"medicine_name"`
	MedicineCode string `gorm:"size:50" json:"medicine_code"`
	Quantity     int    `gorm:"not null;default:1" json:"quantity"`
	Unit         string `gorm:"size:50" json:"unit"`
	Dosage       string `gorm:"type:text" json:"dosage"`
	Frequency    string `gorm:"type:text" json:"frequency"`
	Route        string `gorm:"type:text" json:"route"`
	Duration     string `gorm:"type:text" json:"duration"`
	Instructions string `gorm:"type:text" json:"instructions"`
}

func (MedicineAdministrationTimesheetItem) TableName() string {
	return "medicine_administration_timesheet_items"
}

// MedicineAdministrationTimesheet stores hourly administration status for in-room medications.
type MedicineAdministrationTimesheet struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	MedicineOrderID uint           `gorm:"not null;index" json:"medicine_order_id"`
	MedicineOrder   *MedicineOrder `gorm:"foreignKey:MedicineOrderID" json:"medicine_order,omitempty"`

	MedicineOrderItemID uint               `gorm:"not null;index:idx_timesheet_item_slot,unique;index" json:"medicine_order_item_id"`
	MedicineOrderItem   *MedicineOrderItem `gorm:"foreignKey:MedicineOrderItemID" json:"medicine_order_item,omitempty"`

	ScheduledAt  time.Time `gorm:"not null;index:idx_timesheet_item_slot,unique;index" json:"scheduled_at"`
	Status       string    `gorm:"size:30;not null;default:'scheduled';index" json:"status"`
	ReasonCode   string    `gorm:"size:40;index" json:"reason_code"`
	ReasonDetail string    `gorm:"type:text" json:"reason_detail"`

	AdministeredAt *time.Time `json:"administered_at,omitempty"`
	AdministeredBy *uint      `gorm:"index" json:"administered_by,omitempty"`
	Notes          string     `gorm:"type:text" json:"notes"`
}

func (MedicineAdministrationTimesheet) TableName() string {
	return "medicine_administration_timesheets"
}

// MedicineAdministrationTimesheetEntry stores hourly administration status for manual timesheet items.
type MedicineAdministrationTimesheetEntry struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	TimesheetItemID uint                                 `gorm:"not null;index:idx_manual_timesheet_item_slot,unique;index" json:"timesheet_item_id"`
	TimesheetItem   *MedicineAdministrationTimesheetItem `gorm:"foreignKey:TimesheetItemID" json:"timesheet_item,omitempty"`

	ScheduledAt  time.Time `gorm:"not null;index:idx_manual_timesheet_item_slot,unique;index" json:"scheduled_at"`
	Status       string    `gorm:"size:30;not null;default:'scheduled';index" json:"status"`
	ReasonCode   string    `gorm:"size:40;index" json:"reason_code"`
	ReasonDetail string    `gorm:"type:text" json:"reason_detail"`

	AdministeredAt *time.Time `json:"administered_at,omitempty"`
	AdministeredBy *uint      `gorm:"index" json:"administered_by,omitempty"`
	Notes          string     `gorm:"type:text" json:"notes"`
}

func (MedicineAdministrationTimesheetEntry) TableName() string {
	return "medicine_administration_timesheet_entries"
}
