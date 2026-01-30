package models

import (
	"time"

	"gorm.io/gorm"
)

// Medicine Order Status Constants
const (
	OrderStatusPending   = "pending"   // Menunggu review farmasi
	OrderStatusReviewed  = "reviewed"  // Sudah ditelaah
	OrderStatusPreparing = "preparing" // Sedang disiapkan
	OrderStatusReady     = "ready"     // Siap diserahkan
	OrderStatusDelivered = "delivered" // Sudah diserahkan ke pasien
	OrderStatusCancelled = "cancelled" // Dibatalkan
	OrderStatusPartial   = "partial"   // Sebagian sudah diserahkan
	OrderStatusReturned  = "returned"  // Ada pengembalian
)

// Order Item Status Constants
const (
	ItemStatusOrdered   = "ordered"   // Baru di-order
	ItemStatusAvailable = "available" // Tersedia di farmasi
	ItemStatusReady     = "ready"     // Sudah disiapkan
	ItemStatusDelivered = "delivered" // Sudah diserahkan
	ItemStatusReturned  = "returned"  // Dikembalikan
	ItemStatusCancelled = "cancelled" // Dibatalkan
)

// MedicineOrder represents a prescription/medicine order from doctor to pharmacy
type MedicineOrder struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Order Number
	OrderNumber string `gorm:"not null;uniqueIndex;size:50" json:"order_number"` // RX-YYYYMMDD-XXXX

	// Source Visit (from clinical room - poli, ugd, rawat inap)
	SourceVisitID uint   `gorm:"not null;index" json:"source_visit_id"`
	SourceVisit   *Visit `gorm:"foreignKey:SourceVisitID" json:"source_visit,omitempty"`

	// Pharmacy Visit (created when order is made)
	PharmacyVisitID *uint  `gorm:"index" json:"pharmacy_visit_id"`
	PharmacyVisit   *Visit `gorm:"foreignKey:PharmacyVisitID" json:"pharmacy_visit,omitempty"`

	// Source Room (where the order was created - poli, ugd, rawat inap)
	SourceRoomID uint  `gorm:"not null;index" json:"source_room_id"`
	SourceRoom   *Room `gorm:"foreignKey:SourceRoomID" json:"source_room,omitempty"`

	// Pharmacy Room (depo farmasi yang dituju)
	PharmacyRoomID uint  `gorm:"not null;index" json:"pharmacy_room_id"`
	PharmacyRoom   *Room `gorm:"foreignKey:PharmacyRoomID" json:"pharmacy_room,omitempty"`

	// Patient Reference (for quick access)
	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	// Prescriber (Doctor who ordered)
	PrescriberID uint      `gorm:"not null;index" json:"prescriber_id"`
	Prescriber   *Employee `gorm:"foreignKey:PrescriberID" json:"prescriber,omitempty"`

	// Order Details
	PrescriptionType string `gorm:"size:50;default:'regular'" json:"prescription_type"` // regular, racikan, prn
	Priority         string `gorm:"size:20;default:'normal'" json:"priority"`           // urgent, normal
	Diagnosis        string `gorm:"type:text" json:"diagnosis"`                         // Diagnosis terkait
	Notes            string `gorm:"type:text" json:"notes"`                             // Catatan dokter

	// Status
	Status string `gorm:"size:20;default:'pending'" json:"status"`

	// Review by Pharmacist
	ReviewedByID *uint      `gorm:"index" json:"reviewed_by_id"`
	ReviewedBy   *Employee  `gorm:"foreignKey:ReviewedByID" json:"reviewed_by,omitempty"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
	ReviewNotes  string     `gorm:"type:text" json:"review_notes"`

	// Delivery
	DeliveredByID *uint      `gorm:"index" json:"delivered_by_id"`
	DeliveredBy   *Employee  `gorm:"foreignKey:DeliveredByID" json:"delivered_by,omitempty"`
	DeliveredAt   *time.Time `json:"delivered_at,omitempty"`

	// SatuSehat Integration
	SatusehatQuestionnaireResponseID string `gorm:"size:100" json:"satusehat_questionnaire_response_id"` // FHIR QuestionnaireResponse ID

	// Relation to Items
	Items []MedicineOrderItem `gorm:"foreignKey:MedicineOrderID" json:"items,omitempty"`
}

// TableName sets the table name for MedicineOrder
func (MedicineOrder) TableName() string {
	return "medicine_orders"
}

// MedicineOrderItem represents individual medicine item in an order
type MedicineOrderItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Order Reference
	MedicineOrderID uint           `gorm:"not null;index" json:"medicine_order_id"`
	MedicineOrder   *MedicineOrder `gorm:"foreignKey:MedicineOrderID" json:"medicine_order,omitempty"`

	// Medicine
	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// Ordered Quantity
	Quantity int    `gorm:"not null" json:"quantity"` // Jumlah yang di-order
	Unit     string `gorm:"size:50" json:"unit"`      // Satuan (tablet, kapsul, botol, dll)

	// Instructions
	Dosage       string `gorm:"size:100" json:"dosage"`        // Dosis (3x1, 2x2, dll)
	Frequency    string `gorm:"size:100" json:"frequency"`     // Frekuensi (sehari, seminggu)
	Route        string `gorm:"size:50" json:"route"`          // Cara pakai (oral, topikal, injeksi)
	Duration     string `gorm:"size:50" json:"duration"`       // Durasi (7 hari, 1 minggu)
	Instructions string `gorm:"type:text" json:"instructions"` // Instruksi tambahan (sesudah makan, dll)

	// Status
	Status string `gorm:"size:20;default:'ordered'" json:"status"`

	// Dispensed Info
	DispensedQty    int            `gorm:"default:0" json:"dispensed_qty"` // Jumlah yang diserahkan
	MedicineBatchID *uint          `gorm:"index" json:"medicine_batch_id"` // Batch yang digunakan
	MedicineBatch   *MedicineBatch `gorm:"foreignKey:MedicineBatchID" json:"medicine_batch,omitempty"`
	DispensedByID   *uint          `gorm:"index" json:"dispensed_by_id"` // Petugas farmasi yang menyerahkan
	DispensedBy     *Employee      `gorm:"foreignKey:DispensedByID" json:"dispensed_by,omitempty"`
	DispensedAt     *time.Time     `json:"dispensed_at,omitempty"`

	// Return Info
	ReturnedQty int        `gorm:"default:0" json:"returned_qty"` // Jumlah yang dikembalikan
	ReturnedAt  *time.Time `json:"returned_at,omitempty"`
	ReturnNotes string     `gorm:"type:text" json:"return_notes"`

	// Substitution (jika obat diganti)
	IsSubstituted       bool   `gorm:"default:false" json:"is_substituted"`
	SubstitutedMedicine string `gorm:"size:200" json:"substituted_medicine"` // Nama obat pengganti
	SubstitutionReason  string `gorm:"type:text" json:"substitution_reason"`

	// SatuSehat Integration
	SatusehatMedicationRequestID        string `gorm:"size:100" json:"satusehat_medication_request_id"`        // FHIR MedicationRequest ID
	SatusehatMedicationDispenseID       string `gorm:"size:100" json:"satusehat_medication_dispense_id"`       // FHIR MedicationDispense ID
	SatusehatMedicationAdministrationID string `gorm:"size:100" json:"satusehat_medication_administration_id"` // FHIR MedicationAdministration ID

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for MedicineOrderItem
func (MedicineOrderItem) TableName() string {
	return "medicine_order_items"
}

// PrescriptionReview represents pharmacist review of a prescription
type PrescriptionReview struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Order Reference
	MedicineOrderID uint           `gorm:"not null;index" json:"medicine_order_id"`
	MedicineOrder   *MedicineOrder `gorm:"foreignKey:MedicineOrderID" json:"medicine_order,omitempty"`

	// Reviewer
	ReviewerID uint      `gorm:"not null;index" json:"reviewer_id"`
	Reviewer   *Employee `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`

	// Review Checklist
	DrugInteractionCheck  bool `gorm:"default:false" json:"drug_interaction_check"` // Cek interaksi obat
	DoseCheck             bool `gorm:"default:false" json:"dose_check"`             // Cek dosis
	DuplicationCheck      bool `gorm:"default:false" json:"duplication_check"`      // Cek duplikasi
	AllergyCheck          bool `gorm:"default:false" json:"allergy_check"`          // Cek alergi
	ContraindicationCheck bool `gorm:"default:false" json:"contraindication_check"` // Cek kontraindikasi
	IndicationCheck       bool `gorm:"default:false" json:"indication_check"`       // Cek indikasi

	// Review Result
	IsApproved bool   `gorm:"default:true" json:"is_approved"` // Apakah disetujui
	Notes      string `gorm:"type:text" json:"notes"`          // Catatan review
	Warnings   string `gorm:"type:text" json:"warnings"`       // Peringatan untuk pasien
	Suggestion string `gorm:"type:text" json:"suggestion"`     // Saran untuk dokter

	// Communication with Doctor
	RequiresDoctorConfirmation bool       `gorm:"default:false" json:"requires_doctor_confirmation"`
	DoctorConfirmedAt          *time.Time `json:"doctor_confirmed_at,omitempty"`
}

// TableName sets the table name for PrescriptionReview
func (PrescriptionReview) TableName() string {
	return "prescription_reviews"
}

// MedicineReturn represents returned medicine from patient
type MedicineReturn struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Return Number
	ReturnNumber string `gorm:"not null;uniqueIndex;size:50" json:"return_number"` // RET-YYYYMMDD-XXXX

	// Order Reference
	MedicineOrderID uint           `gorm:"not null;index" json:"medicine_order_id"`
	MedicineOrder   *MedicineOrder `gorm:"foreignKey:MedicineOrderID" json:"medicine_order,omitempty"`

	// Item Reference (optional - if returning specific item)
	MedicineOrderItemID *uint              `gorm:"index" json:"medicine_order_item_id"`
	MedicineOrderItem   *MedicineOrderItem `gorm:"foreignKey:MedicineOrderItemID" json:"medicine_order_item,omitempty"`

	// Medicine being returned
	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// Quantity
	Quantity int `gorm:"not null" json:"quantity"` // Jumlah yang dikembalikan

	// Return Details
	ReturnReason string `gorm:"type:text" json:"return_reason"` // Alasan pengembalian
	Condition    string `gorm:"size:50" json:"condition"`       // Kondisi obat (baik, rusak, kadaluarsa)

	// Processing
	ReceivedByID uint      `gorm:"not null;index" json:"received_by_id"`
	ReceivedBy   *Employee `gorm:"foreignKey:ReceivedByID" json:"received_by,omitempty"`

	// Stock Update
	IsRestocked   bool   `gorm:"default:false" json:"is_restocked"` // Apakah dikembalikan ke stok
	RestockRoomID *uint  `gorm:"index" json:"restock_room_id"`
	RestockRoom   *Room  `gorm:"foreignKey:RestockRoomID" json:"restock_room,omitempty"`
	RestockNotes  string `gorm:"type:text" json:"restock_notes"`

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for MedicineReturn
func (MedicineReturn) TableName() string {
	return "medicine_returns"
}
