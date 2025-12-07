package models

import (
	"time"

	"gorm.io/gorm"
)

// Request Status Constants
const (
	RequestStatusDraft     = "draft"
	RequestStatusPending   = "pending"
	RequestStatusApproved  = "approved"
	RequestStatusRejected  = "rejected"
	RequestStatusPartial   = "partial"
	RequestStatusCompleted = "completed"
	RequestStatusCancelled = "cancelled"
)

// Request Type Constants
const (
	RequestTypeInventory = "inventory"
	RequestTypeMedicine  = "medicine"
)

// StockRequest represents a request for inventory/medicine from one room to another (e.g., from ward to pharmacy depot)
type StockRequest struct {
	ID              uint               `gorm:"primarykey" json:"id"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	DeletedAt       gorm.DeletedAt     `gorm:"index" json:"-"`
	RequestNumber   string             `gorm:"uniqueIndex;size:50;not null" json:"request_number"` // Format: REQ-INV-2024-0001 or REQ-MED-2024-0001
	RequestType     string             `gorm:"size:20;not null" json:"request_type"`               // inventory, medicine
	FromRoomID      uint               `gorm:"not null;index" json:"from_room_id"`                 // Ruangan yang meminta
	FromRoom        *Room              `gorm:"foreignKey:FromRoomID" json:"from_room,omitempty"`
	ToRoomID        uint               `gorm:"not null;index" json:"to_room_id"` // Depo Farmasi / Gudang tujuan
	ToRoom          *Room              `gorm:"foreignKey:ToRoomID" json:"to_room,omitempty"`
	Status          string             `gorm:"size:20;not null;default:'draft'" json:"status"` // draft, pending, approved, rejected, partial, completed, cancelled
	Priority        string             `gorm:"size:20;default:'normal'" json:"priority"`       // low, normal, high, urgent
	RequestDate     time.Time          `gorm:"not null" json:"request_date"`
	RequiredDate    *time.Time         `json:"required_date,omitempty"`  // Tanggal dibutuhkan
	ApprovedDate    *time.Time         `json:"approved_date,omitempty"`  // Tanggal disetujui
	CompletedDate   *time.Time         `json:"completed_date,omitempty"` // Tanggal selesai distribusi
	RequestedByID   uint               `gorm:"not null;index" json:"requested_by_id"`
	RequestedBy     *User              `gorm:"foreignKey:RequestedByID" json:"requested_by,omitempty"`
	ApprovedByID    *uint              `gorm:"index" json:"approved_by_id"`
	ApprovedBy      *User              `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
	CompletedByID   *uint              `gorm:"index" json:"completed_by_id"`
	CompletedBy     *User              `gorm:"foreignKey:CompletedByID" json:"completed_by,omitempty"`
	Reason          string             `gorm:"type:text" json:"reason"`                // Alasan permintaan
	RejectionReason string             `gorm:"type:text" json:"rejection_reason"`      // Alasan penolakan
	Notes           string             `gorm:"type:text" json:"notes"`                 // Catatan tambahan
	Items           []StockRequestItem `gorm:"foreignKey:StockRequestID" json:"items"` // Detail item yang diminta
}

// TableName sets the table name for StockRequest
func (StockRequest) TableName() string {
	return "stock_requests"
}

// StockRequestItem represents an item in a stock request
type StockRequestItem struct {
	ID                uint           `gorm:"primarykey" json:"id"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
	StockRequestID    uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"stock_request_id"`
	StockRequest      *StockRequest  `gorm:"foreignKey:StockRequestID" json:"-"`
	InventoryID       *uint          `gorm:"index" json:"inventory_id,omitempty"` // For inventory requests
	Inventory         *Inventory     `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`
	MedicineID        *uint          `gorm:"index" json:"medicine_id,omitempty"` // For medicine requests
	Medicine          *Medicine      `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	QuantityRequested int            `gorm:"not null" json:"quantity_requested"`  // Jumlah yang diminta
	QuantityApproved  int            `gorm:"default:0" json:"quantity_approved"`  // Jumlah yang disetujui
	QuantityFulfilled int            `gorm:"default:0" json:"quantity_fulfilled"` // Jumlah yang sudah dikirim
	Unit              string         `gorm:"size:30" json:"unit"`                 // Satuan
	Notes             string         `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for StockRequestItem
func (StockRequestItem) TableName() string {
	return "stock_request_items"
}

// StockDistribution represents the actual distribution/fulfillment of a stock request
type StockDistribution struct {
	ID                 uint                    `gorm:"primarykey" json:"id"`
	CreatedAt          time.Time               `json:"created_at"`
	UpdatedAt          time.Time               `json:"updated_at"`
	DeletedAt          gorm.DeletedAt          `gorm:"index" json:"-"`
	DistributionNumber string                  `gorm:"uniqueIndex;size:50;not null" json:"distribution_number"` // Format: DIST-2024-0001
	StockRequestID     *uint                   `gorm:"index" json:"stock_request_id,omitempty"`                 // Linked to request (nullable for manual distribution)
	StockRequest       *StockRequest           `gorm:"foreignKey:StockRequestID" json:"stock_request,omitempty"`
	FromRoomID         uint                    `gorm:"not null;index" json:"from_room_id"` // Depo/Gudang
	FromRoom           *Room                   `gorm:"foreignKey:FromRoomID" json:"from_room,omitempty"`
	ToRoomID           uint                    `gorm:"not null;index" json:"to_room_id"` // Ruangan tujuan
	ToRoom             *Room                   `gorm:"foreignKey:ToRoomID" json:"to_room,omitempty"`
	DistributionDate   time.Time               `gorm:"not null" json:"distribution_date"`
	DistributedByID    uint                    `gorm:"not null;index" json:"distributed_by_id"`
	DistributedBy      *User                   `gorm:"foreignKey:DistributedByID" json:"distributed_by,omitempty"`
	ReceivedByID       *uint                   `gorm:"index" json:"received_by_id"`
	ReceivedBy         *User                   `gorm:"foreignKey:ReceivedByID" json:"received_by,omitempty"`
	ReceivedDate       *time.Time              `json:"received_date,omitempty"`
	Status             string                  `gorm:"size:20;not null;default:'pending'" json:"status"` // pending, delivered, received
	Notes              string                  `gorm:"type:text" json:"notes"`
	Items              []StockDistributionItem `gorm:"foreignKey:StockDistributionID" json:"items"`
}

// TableName sets the table name for StockDistribution
func (StockDistribution) TableName() string {
	return "stock_distributions"
}

// StockDistributionItem represents an item in a distribution
type StockDistributionItem struct {
	ID                  uint               `gorm:"primarykey" json:"id"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
	DeletedAt           gorm.DeletedAt     `gorm:"index" json:"-"`
	StockDistributionID uint               `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"stock_distribution_id"`
	StockDistribution   *StockDistribution `gorm:"foreignKey:StockDistributionID" json:"-"`
	StockRequestItemID  *uint              `gorm:"index" json:"stock_request_item_id,omitempty"` // Linked to request item
	StockRequestItem    *StockRequestItem  `gorm:"foreignKey:StockRequestItemID" json:"stock_request_item,omitempty"`
	InventoryID         *uint              `gorm:"index" json:"inventory_id,omitempty"`
	Inventory           *Inventory         `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`
	MedicineID          *uint              `gorm:"index" json:"medicine_id,omitempty"`
	Medicine            *Medicine          `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	BatchNumber         string             `gorm:"size:50" json:"batch_number,omitempty"`
	ExpiryDate          *time.Time         `json:"expiry_date,omitempty"`
	Quantity            int                `gorm:"not null" json:"quantity"`
	Unit                string             `gorm:"size:30" json:"unit"`
	Notes               string             `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for StockDistributionItem
func (StockDistributionItem) TableName() string {
	return "stock_distribution_items"
}

// Purchase represents a purchase order for inventory/medicine
type Purchase struct {
	ID              uint           `gorm:"primarykey" json:"id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	PurchaseNumber  string         `gorm:"uniqueIndex;size:50;not null" json:"purchase_number"` // Format: PO-2024-0001
	PurchaseType    string         `gorm:"size:20;not null" json:"purchase_type"`               // inventory, medicine
	SupplierID      *uint          `gorm:"index" json:"supplier_id,omitempty"`                  // Optional supplier reference
	Supplier        *Supplier      `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	SupplierName    string         `gorm:"size:200" json:"supplier_name"`
	SupplierContact string         `gorm:"size:100" json:"supplier_contact"`
	ToRoomID        uint           `gorm:"not null;index" json:"to_room_id"` // Depo Farmasi / Gudang tujuan
	ToRoom          *Room          `gorm:"foreignKey:ToRoomID" json:"to_room,omitempty"`
	Status          string         `gorm:"size:20;not null;default:'draft'" json:"status"` // draft, ordered, partial, received, cancelled
	OrderDate       *time.Time     `json:"order_date,omitempty"`
	ExpectedDate    *time.Time     `json:"expected_date,omitempty"`
	ReceivedDate    *time.Time     `json:"received_date,omitempty"`
	TotalAmount     float64        `gorm:"type:decimal(15,2);default:0" json:"total_amount"`
	CreatedByID     uint           `gorm:"not null;index" json:"created_by_id"`
	CreatedBy       *User          `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	ApprovedByID    *uint          `gorm:"index" json:"approved_by_id"`
	ApprovedBy      *User          `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
	ReceivedByID    *uint          `gorm:"index" json:"received_by_id"`
	ReceivedBy      *User          `gorm:"foreignKey:ReceivedByID" json:"received_by,omitempty"`
	Notes           string         `gorm:"type:text" json:"notes"`
	Items           []PurchaseItem `gorm:"foreignKey:PurchaseID" json:"items"`
}

// TableName sets the table name for Purchase
func (Purchase) TableName() string {
	return "purchases"
}

// PurchaseItem represents an item in a purchase order
type PurchaseItem struct {
	ID               uint           `gorm:"primarykey" json:"id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	PurchaseID       uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"purchase_id"`
	Purchase         *Purchase      `gorm:"foreignKey:PurchaseID" json:"-"`
	InventoryID      *uint          `gorm:"index" json:"inventory_id,omitempty"`
	Inventory        *Inventory     `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`
	MedicineID       *uint          `gorm:"index" json:"medicine_id,omitempty"`
	Medicine         *Medicine      `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	QuantityOrdered  int            `gorm:"not null" json:"quantity_ordered"`
	QuantityReceived int            `gorm:"default:0" json:"quantity_received"`
	Unit             string         `gorm:"size:30" json:"unit"`
	UnitPrice        float64        `gorm:"type:decimal(15,2);default:0" json:"unit_price"`
	TotalPrice       float64        `gorm:"type:decimal(15,2);default:0" json:"total_price"`
	BatchNumber      string         `gorm:"size:50" json:"batch_number,omitempty"`
	ExpiryDate       *time.Time     `json:"expiry_date,omitempty"`
	Notes            string         `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for PurchaseItem
func (PurchaseItem) TableName() string {
	return "purchase_items"
}

// StockOpname represents a stock taking/audit
type StockOpname struct {
	ID            uint              `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	DeletedAt     gorm.DeletedAt    `gorm:"index" json:"-"`
	OpnameNumber  string            `gorm:"uniqueIndex;size:50;not null" json:"opname_number"` // Format: OPN-2024-0001
	OpnameType    string            `gorm:"size:20;not null" json:"opname_type"`               // inventory, medicine
	RoomID        uint              `gorm:"not null;index" json:"room_id"`
	Room          *Room             `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	OpnameDate    time.Time         `gorm:"not null" json:"opname_date"`
	Status        string            `gorm:"size:20;not null;default:'draft'" json:"status"` // draft, in_progress, completed, approved
	ConductedByID uint              `gorm:"not null;index" json:"conducted_by_id"`
	ConductedBy   *User             `gorm:"foreignKey:ConductedByID" json:"conducted_by,omitempty"`
	ApprovedByID  *uint             `gorm:"index" json:"approved_by_id"`
	ApprovedBy    *User             `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
	ApprovedDate  *time.Time        `json:"approved_date,omitempty"`
	Notes         string            `gorm:"type:text" json:"notes"`
	Items         []StockOpnameItem `gorm:"foreignKey:StockOpnameID" json:"items"`
}

// TableName sets the table name for StockOpname
func (StockOpname) TableName() string {
	return "stock_opnames"
}

// StockOpnameItem represents an item in a stock opname
type StockOpnameItem struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	StockOpnameID uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"stock_opname_id"`
	StockOpname   *StockOpname   `gorm:"foreignKey:StockOpnameID" json:"-"`
	InventoryID   *uint          `gorm:"index" json:"inventory_id,omitempty"`
	Inventory     *Inventory     `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`
	MedicineID    *uint          `gorm:"index" json:"medicine_id,omitempty"`
	Medicine      *Medicine      `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	SystemStock   int            `gorm:"not null" json:"system_stock"`   // Stok di sistem
	PhysicalStock int            `gorm:"not null" json:"physical_stock"` // Stok fisik hasil hitung
	Difference    int            `gorm:"not null" json:"difference"`     // Selisih (physical - system)
	Unit          string         `gorm:"size:30" json:"unit"`
	Notes         string         `gorm:"type:text" json:"notes"` // Catatan untuk selisih
}

// TableName sets the table name for StockOpnameItem
func (StockOpnameItem) TableName() string {
	return "stock_opname_items"
}
