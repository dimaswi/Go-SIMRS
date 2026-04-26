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
