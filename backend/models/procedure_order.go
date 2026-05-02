package models

import (
	"time"

	"gorm.io/gorm"
)

// Procedure Order Status Constants
const (
	ProcedureOrderStatusPending    = "pending"     // Menunggu dikerjakan
	ProcedureOrderStatusInProgress = "in_progress" // Sedang dikerjakan
	ProcedureOrderStatusCompleted  = "completed"   // Selesai
	ProcedureOrderStatusCancelled  = "cancelled"   // Dibatalkan
)

// Procedure Order Type Constants
const (
	ProcedureOrderTypeRadiology    = "radiology"    // Order Radiologi
	ProcedureOrderTypeLaboratory   = "laboratory"   // Order Laboratorium
	ProcedureOrderTypeConsultation = "consultation" // Order Konsultasi
	ProcedureOrderTypeSurgery      = "surgery"      // Order Operasi/Bedah
)

// ProcedureOrder represents an order for radiology or laboratory procedure
type ProcedureOrder struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Order Number
	OrderNumber string `gorm:"not null;uniqueIndex;size:50" json:"order_number"` // RAD-YYYYMMDD-XXXX or LAB-YYYYMMDD-XXXX

	// Order Type: radiology or laboratory
	OrderType string `gorm:"not null;size:20;index" json:"order_type"`

	// Source Visit (from clinical room - poli, ugd, rawat inap)
	SourceVisitID uint   `gorm:"not null;index" json:"source_visit_id"`
	SourceVisit   *Visit `gorm:"foreignKey:SourceVisitID" json:"source_visit,omitempty"`

	// Target Visit (created when order is made - visit to radiology/lab room)
	TargetVisitID *uint  `gorm:"index" json:"target_visit_id"`
	TargetVisit   *Visit `gorm:"foreignKey:TargetVisitID" json:"target_visit,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	// Source Room (where the order was created - poli, ugd, rawat inap)
	SourceRoomID uint  `gorm:"not null;index" json:"source_room_id"`
	SourceRoom   *Room `gorm:"foreignKey:SourceRoomID" json:"source_room,omitempty"`

	// Target Room (radiologi/laboratorium yang dituju)
	TargetRoomID uint  `gorm:"not null;index" json:"target_room_id"`
	TargetRoom   *Room `gorm:"foreignKey:TargetRoomID" json:"target_room,omitempty"`

	// Patient Reference (for quick access)
	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	// Ordering Doctor
	OrderedByID uint      `gorm:"not null;index" json:"ordered_by_id"`
	OrderedBy   *Employee `gorm:"foreignKey:OrderedByID" json:"ordered_by,omitempty"`

	// Surgery-specific fields
	SurgeonDoctorID *uint      `gorm:"index" json:"surgeon_doctor_id"`                // Dokter Bedah yang dituju
	SurgeonDoctor   *Employee  `gorm:"foreignKey:SurgeonDoctorID" json:"surgeon_doctor,omitempty"`
	ScheduledDate   *time.Time `json:"scheduled_date,omitempty"` // Tanggal/waktu jadwal operasi

	// Order Details
	Priority      string `gorm:"size:20;default:'normal'" json:"priority"` // urgent, cito, normal
	ClinicalNotes string `gorm:"type:text" json:"clinical_notes"`          // Catatan klinis/indikasi
	Diagnosis     string `gorm:"type:text" json:"diagnosis"`               // Diagnosis
	Notes         string `gorm:"type:text" json:"notes"`                   // Catatan tambahan

	// Status
	Status string `gorm:"size:20;default:'pending'" json:"status"`

	// Performed by (Petugas yang mengerjakan)
	PerformedByID *uint      `gorm:"index" json:"performed_by_id"`
	PerformedBy   *Employee  `gorm:"foreignKey:PerformedByID" json:"performed_by,omitempty"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`

	// Results (General)
	ResultSummary string `gorm:"type:text" json:"result_summary"`  // Ringkasan hasil
	Conclusion    string `gorm:"type:text" json:"conclusion"`      // Kesimpulan/Kesan
	Suggestion    string `gorm:"type:text" json:"suggestion"`      // Saran
	IsCritical    bool   `gorm:"default:false" json:"is_critical"` // Nilai kritis
	CriticalNotes string `gorm:"type:text" json:"critical_notes"`  // Catatan nilai kritis

	// Validated by (Dokter yang validasi hasil)
	ValidatedByID *uint      `gorm:"index" json:"validated_by_id"`
	ValidatedBy   *Employee  `gorm:"foreignKey:ValidatedByID" json:"validated_by,omitempty"`
	ValidatedAt   *time.Time `json:"validated_at,omitempty"`

	// Attachments (for radiology images, etc)
	AttachmentURLs string `gorm:"type:text" json:"attachment_urls"` // JSON array of URLs

	// Relations
	Items        []ProcedureOrderItem `gorm:"foreignKey:ProcedureOrderID" json:"items,omitempty"`
	Consultation *Consultation        `gorm:"foreignKey:ProcedureOrderID" json:"consultation,omitempty"` // For consultation orders
}

// TableName sets the table name for ProcedureOrder
func (ProcedureOrder) TableName() string {
	return "procedure_orders"
}

// ProcedureOrderItem represents individual procedure in an order
type ProcedureOrderItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Order Reference
	ProcedureOrderID uint            `gorm:"not null;index" json:"procedure_order_id"`
	ProcedureOrder   *ProcedureOrder `gorm:"foreignKey:ProcedureOrderID" json:"procedure_order,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	// Procedure
	ProcedureID uint       `gorm:"not null;index" json:"procedure_id"`
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`

	// Status
	Status string `gorm:"size:20;default:'pending'" json:"status"` // pending, in_progress, completed, cancelled

	// Performed
	PerformedByID *uint      `gorm:"index" json:"performed_by_id"`
	PerformedBy   *Employee  `gorm:"foreignKey:PerformedByID" json:"performed_by,omitempty"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`

	// Notes
	Notes string `gorm:"type:text" json:"notes"`

	// SatuSehat Integration IDs
	SatusehatServiceRequestID   string `gorm:"size:100" json:"satusehat_servicerequest_id"`   // FHIR ServiceRequest ID
	SatusehatSpecimenID         string `gorm:"size:100" json:"satusehat_specimen_id"`         // FHIR Specimen ID
	SatusehatDiagnosticReportID string `gorm:"size:100" json:"satusehat_diagnosticreport_id"` // FHIR DiagnosticReport ID

	// Results (for this specific procedure)
	Results []ProcedureOrderResult `gorm:"foreignKey:ProcedureOrderItemID" json:"results,omitempty"`
}

// TableName sets the table name for ProcedureOrderItem
func (ProcedureOrderItem) TableName() string {
	return "procedure_order_items"
}

// ProcedureOrderResult stores the dynamic parameter results for each procedure item
type ProcedureOrderResult struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Item Reference
	ProcedureOrderItemID uint                `gorm:"not null;index" json:"procedure_order_item_id"`
	ProcedureOrderItem   *ProcedureOrderItem `gorm:"foreignKey:ProcedureOrderItemID" json:"procedure_order_item,omitempty"`

	// Casemix Support
	IsCasemix       bool  `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	// Parameter Reference
	ProcedureParameterID uint                `gorm:"not null;index" json:"procedure_parameter_id"`
	ProcedureParameter   *ProcedureParameter `gorm:"foreignKey:ProcedureParameterID" json:"procedure_parameter,omitempty"`

	// Value (stored as string, parsed based on parameter type)
	Value        string  `gorm:"type:text" json:"value"`                            // Nilai hasil
	NumericValue float64 `gorm:"type:decimal(15,4);default:0" json:"numeric_value"` // Nilai numerik (untuk lab)

	// Status flags (for lab results)
	IsNormal   bool `gorm:"default:true" json:"is_normal"`    // Apakah normal
	IsLow      bool `gorm:"default:false" json:"is_low"`      // Apakah rendah
	IsHigh     bool `gorm:"default:false" json:"is_high"`     // Apakah tinggi
	IsCritical bool `gorm:"default:false" json:"is_critical"` // Apakah kritis

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for ProcedureOrderResult
func (ProcedureOrderResult) TableName() string {
	return "procedure_order_results"
}
