package models

import (
	"time"

	"gorm.io/gorm"
)

// Billing Status Constants
const (
	BillingStatusDraft     = "draft"     // Masih draft, bisa di-regenerate
	BillingStatusPending   = "pending"   // Menunggu pembayaran
	BillingStatusPartial   = "partial"   // Pembayaran sebagian
	BillingStatusPaid      = "paid"      // Lunas
	BillingStatusCancelled = "cancelled" // Dibatalkan
)

// Billing Item Type Constants
const (
	BillingItemTypeRegistration = "registration" // Biaya pendaftaran
	BillingItemTypeProcedure    = "procedure"    // Biaya tindakan
	BillingItemTypeRadiology    = "radiology"    // Biaya radiologi
	BillingItemTypeLaboratory   = "laboratory"   // Biaya laboratorium
	BillingItemTypeConsultation = "consultation" // Biaya konsultasi
	BillingItemTypeMedicine     = "medicine"     // Biaya obat
	BillingItemTypeRoom         = "room"         // Biaya kamar rawat inap
	BillingItemTypeOther        = "other"        // Biaya lainnya
)

// Payment Method Constants
const (
	PaymentMethodCash      = "cash"
	PaymentMethodBPJS      = "bpjs"
	PaymentMethodInsurance = "insurance"
	PaymentMethodDebit     = "debit"
	PaymentMethodCredit    = "credit"
	PaymentMethodTransfer  = "transfer"
)

// Billing represents a billing record for a visit
type Billing struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Billing Number
	BillingNumber string `gorm:"not null;uniqueIndex;size:50" json:"billing_number"` // BILL-YYYYMMDD-XXXX

	// Visit Reference (1 billing per visit)
	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Registration Reference (for quick access)
	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	// Patient Class (determines tariff)
	PatientClass string `gorm:"size:20;not null" json:"patient_class"` // non_kelas, kelas_3, kelas_2, kelas_1, vip, vvip

	// Billing Summary
	TotalAmount     float64 `gorm:"type:decimal(15,2);default:0" json:"total_amount"`     // Total tagihan
	DiscountAmount  float64 `gorm:"type:decimal(15,2);default:0" json:"discount_amount"`  // Potongan/diskon
	AdjustAmount    float64 `gorm:"type:decimal(15,2);default:0" json:"adjust_amount"`    // Penyesuaian (+ atau -)
	FinalAmount     float64 `gorm:"type:decimal(15,2);default:0" json:"final_amount"`     // Total akhir setelah diskon & penyesuaian
	PaidAmount      float64 `gorm:"type:decimal(15,2);default:0" json:"paid_amount"`      // Jumlah yang sudah dibayar
	RemainingAmount float64 `gorm:"type:decimal(15,2);default:0" json:"remaining_amount"` // Sisa tagihan

	// Status
	Status string `gorm:"size:20;default:'draft'" json:"status"` // draft, pending, partial, paid, cancelled

	// Payment Info
	PaymentMethod string     `gorm:"size:20" json:"payment_method"` // cash, bpjs, insurance
	BPJSNumber    string     `gorm:"size:30" json:"bpjs_number"`
	InsuranceName string     `gorm:"size:100" json:"insurance_name"`
	InsuranceNo   string     `gorm:"size:50" json:"insurance_no"`
	PaidAt        *time.Time `json:"paid_at,omitempty"` // Waktu lunas

	// Discount Info
	DiscountReason string `gorm:"type:text" json:"discount_reason"`
	AdjustReason   string `gorm:"type:text" json:"adjust_reason"`

	// Generated/Finalized by
	GeneratedByID *uint      `gorm:"index" json:"generated_by_id"`
	GeneratedBy   *User      `gorm:"foreignKey:GeneratedByID" json:"generated_by,omitempty"`
	GeneratedAt   *time.Time `json:"generated_at,omitempty"`

	FinalizedByID *uint      `gorm:"index" json:"finalized_by_id"`
	FinalizedBy   *User      `gorm:"foreignKey:FinalizedByID" json:"finalized_by,omitempty"`
	FinalizedAt   *time.Time `json:"finalized_at,omitempty"`

	// Notes
	Notes string `gorm:"type:text" json:"notes"`

	// BPJS/INA-CBG Fields
	InaCBGCode        string  `gorm:"size:20" json:"inacbg_code"`                            // Kode INA-CBG
	InaCBGDescription string  `gorm:"size:255" json:"inacbg_description"`                    // Deskripsi INA-CBG
	InaCBGTariff      float64 `gorm:"type:decimal(15,2);default:0" json:"inacbg_tariff"`     // Tarif INA-CBG
	BPJSClaimAmount   float64 `gorm:"type:decimal(15,2);default:0" json:"bpjs_claim_amount"` // Klaim BPJS yang diajukan

	// Relations
	Items    []BillingItem    `gorm:"foreignKey:BillingID" json:"items,omitempty"`
	Payments []BillingPayment `gorm:"foreignKey:BillingID" json:"payments,omitempty"`
}

// TableName sets the table name for Billing
func (Billing) TableName() string {
	return "billings"
}

// CalculateTotals recalculates billing totals
func (b *Billing) CalculateTotals() {
	var total float64
	for _, item := range b.Items {
		total += item.Subtotal
	}
	b.TotalAmount = total
	b.FinalAmount = total - b.DiscountAmount + b.AdjustAmount
	b.RemainingAmount = b.FinalAmount - b.PaidAmount
}

// BillingItem represents individual billing line item
type BillingItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Billing Reference
	BillingID uint     `gorm:"not null;index" json:"billing_id"`
	Billing   *Billing `gorm:"foreignKey:BillingID" json:"billing,omitempty"`

	// Source Visit Reference (which visit generated this item)
	SourceVisitID *uint  `gorm:"index" json:"source_visit_id"`
	SourceVisit   *Visit `gorm:"foreignKey:SourceVisitID" json:"source_visit,omitempty"`

	// Item Type
	ItemType string `gorm:"not null;size:20" json:"item_type"` // registration, procedure, radiology, laboratory, medicine, room, other

	// Reference ID (links to specific record)
	ReferenceID   uint   `gorm:"index" json:"reference_id"`             // ID of related record
	ReferenceType string `gorm:"size:50" json:"reference_type"`         // procedure_order_item, medicine_order_item, etc.
	ReferenceCode string `gorm:"size:50" json:"reference_code"`         // Code of the item (for display)
	Description   string `gorm:"type:text;not null" json:"description"` // Description of the item

	// Pricing
	Quantity  int     `gorm:"not null;default:1" json:"quantity"` // Jumlah
	Unit      string  `gorm:"size:50" json:"unit"`                // Satuan
	UnitPrice float64 `gorm:"type:decimal(15,2);not null" json:"unit_price"`
	Subtotal  float64 `gorm:"type:decimal(15,2);not null" json:"subtotal"`

	// Tariff Components (for procedures)
	Administrasi   float64 `gorm:"type:decimal(15,2);default:0" json:"administrasi"`
	Sarana         float64 `gorm:"type:decimal(15,2);default:0" json:"sarana"`
	BHP            float64 `gorm:"type:decimal(15,2);default:0" json:"bhp"`
	DokterOperator float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_operator"`
	DokterAnastesi float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_anastesi"`
	DokterLainnya  float64 `gorm:"type:decimal(15,2);default:0" json:"dokter_lainnya"`
	PenataAnastesi float64 `gorm:"type:decimal(15,2);default:0" json:"penata_anastesi"`
	Paramedis      float64 `gorm:"type:decimal(15,2);default:0" json:"paramedis"`
	NonMedis       float64 `gorm:"type:decimal(15,2);default:0" json:"non_medis"`

	// Room Tariff Components (for inpatient)
	Akomodasi float64 `gorm:"type:decimal(15,2);default:0" json:"akomodasi"`
	Makan     float64 `gorm:"type:decimal(15,2);default:0" json:"makan"`
	Perawatan float64 `gorm:"type:decimal(15,2);default:0" json:"perawatan"`
	Lainnya   float64 `gorm:"type:decimal(15,2);default:0" json:"lainnya"`

	// Performer Info (who performed/ordered/registered)
	PerformedByID   *uint  `gorm:"index" json:"performed_by_id"`      // User/Employee ID who performed
	PerformedByName string `gorm:"size:100" json:"performed_by_name"` // Name of performer (cached for display)
	PerformedByRole string `gorm:"size:50" json:"performed_by_role"`  // Role: dokter, perawat, admin, etc.

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for BillingItem
func (BillingItem) TableName() string {
	return "billing_items"
}

// BillingPayment represents a payment transaction
type BillingPayment struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Payment Number
	PaymentNumber string `gorm:"not null;uniqueIndex;size:50" json:"payment_number"` // PAY-YYYYMMDD-XXXX

	// Billing Reference
	BillingID uint     `gorm:"not null;index" json:"billing_id"`
	Billing   *Billing `gorm:"foreignKey:BillingID" json:"billing,omitempty"`

	// Payment Details
	PaymentMethod string    `gorm:"not null;size:20" json:"payment_method"` // cash, bpjs, insurance, debit, credit, transfer
	Amount        float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	PaymentDate   time.Time `gorm:"not null" json:"payment_date"`

	// For cash payments
	ReceivedAmount float64 `gorm:"type:decimal(15,2);default:0" json:"received_amount"` // Jumlah diterima
	ChangeAmount   float64 `gorm:"type:decimal(15,2);default:0" json:"change_amount"`   // Kembalian

	// For BPJS
	BPJSNumber    string  `gorm:"size:30" json:"bpjs_number"`
	BPJSClaimCode string  `gorm:"size:50" json:"bpjs_claim_code"`
	BPJSAmount    float64 `gorm:"type:decimal(15,2);default:0" json:"bpjs_amount"`

	// For Insurance
	InsuranceName      string  `gorm:"size:100" json:"insurance_name"`
	InsuranceNumber    string  `gorm:"size:50" json:"insurance_number"`
	InsuranceClaimCode string  `gorm:"size:50" json:"insurance_claim_code"`
	InsuranceAmount    float64 `gorm:"type:decimal(15,2);default:0" json:"insurance_amount"`

	// For card/transfer
	BankName        string `gorm:"size:100" json:"bank_name"`
	CardNumber      string `gorm:"size:30" json:"card_number"` // Last 4 digits only
	ReferenceNumber string `gorm:"size:50" json:"reference_number"`

	// Cashier
	CashierID uint  `gorm:"not null;index" json:"cashier_id"`
	Cashier   *User `gorm:"foreignKey:CashierID" json:"cashier,omitempty"`

	// Status
	Status string `gorm:"size:20;default:'completed'" json:"status"` // completed, voided, refunded

	// Void/Refund Info
	VoidedByID   *uint      `gorm:"index" json:"voided_by_id"`
	VoidedBy     *User      `gorm:"foreignKey:VoidedByID" json:"voided_by,omitempty"`
	VoidedAt     *time.Time `json:"voided_at,omitempty"`
	VoidedReason string     `gorm:"type:text" json:"voided_reason"`

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for BillingPayment
func (BillingPayment) TableName() string {
	return "billing_payments"
}

// RegistrationTariff represents tariff for registration based on service type
type RegistrationTariff struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Service Type
	ServiceType string `gorm:"not null;size:50;uniqueIndex:idx_service_payment" json:"service_type"` // rawat_jalan, rawat_inap, gawat_darurat

	// Payment Method
	PaymentMethod string `gorm:"not null;size:20;uniqueIndex:idx_service_payment" json:"payment_method"` // cash, bpjs, insurance

	// Tariff
	TariffAmount float64 `gorm:"type:decimal(15,2);not null" json:"tariff_amount"`

	// Description
	Description string `gorm:"type:text" json:"description"`

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"`
}

// TableName sets the table name for RegistrationTariff
func (RegistrationTariff) TableName() string {
	return "registration_tariffs"
}
