package models

import (
	"time"

	"gorm.io/gorm"
)

// InventoryCategory represents the category of inventory items
type InventoryCategory string

const (
	InventoryCategoryMedical        InventoryCategory = "medical"        // Alat Medis
	InventoryCategoryNonMedical     InventoryCategory = "non_medical"    // Alat Non-Medis
	InventoryCategoryConsumable     InventoryCategory = "consumable"     // Bahan Habis Pakai
	InventoryCategoryEquipment      InventoryCategory = "equipment"      // Peralatan
	InventoryCategoryFurniture      InventoryCategory = "furniture"      // Furniture
	InventoryCategoryElectronic     InventoryCategory = "electronic"     // Elektronik
	InventoryCategoryInfrastructure InventoryCategory = "infrastructure" // Infrastruktur
)

// InventoryCondition represents the condition of an inventory item
type InventoryCondition string

const (
	InventoryConditionNew      InventoryCondition = "new"      // Baru
	InventoryConditionGood     InventoryCondition = "good"     // Baik
	InventoryConditionFair     InventoryCondition = "fair"     // Cukup
	InventoryConditionDamaged  InventoryCondition = "damaged"  // Rusak Ringan
	InventoryConditionBroken   InventoryCondition = "broken"   // Rusak Berat
	InventoryConditionDisposed InventoryCondition = "disposed" // Dihapuskan
)

// InventoryStatus represents the status of an inventory item
type InventoryStatus string

const (
	InventoryStatusAvailable   InventoryStatus = "available"   // Tersedia
	InventoryStatusInUse       InventoryStatus = "in_use"      // Sedang Digunakan
	InventoryStatusMaintenance InventoryStatus = "maintenance" // Dalam Perawatan
	InventoryStatusReserved    InventoryStatus = "reserved"    // Direservasi
	InventoryStatusDisposed    InventoryStatus = "disposed"    // Dihapuskan
)

// Inventory represents master data for inventory items
type Inventory struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Basic Information
	Code        string            `gorm:"not null;uniqueIndex;size:50" json:"code"` // Kode Barang (unique)
	Name        string            `gorm:"not null;size:200" json:"name"`            // Nama Barang
	Description string            `gorm:"type:text" json:"description"`             // Deskripsi
	Category    InventoryCategory `gorm:"not null;size:50" json:"category"`         // Kategori
	Unit        string            `gorm:"not null;size:50" json:"unit"`             // Satuan (pcs, unit, set, box, etc)
	Brand       string            `gorm:"size:100" json:"brand"`                    // Merek
	Model       string            `gorm:"size:100" json:"model"`                    // Model/Tipe

	// Inventory Details (stok aktual ada di RoomInventory per ruangan)
	MinStock     int     `gorm:"default:0" json:"min_stock"`                      // Stok Minimum Global (untuk alert)
	MaxStock     int     `gorm:"default:0" json:"max_stock"`                      // Stok Maksimum Global
	CurrentStock int     `gorm:"-" json:"current_stock"`                          // Stok untuk kebutuhan display (bukan data master tersimpan)
	Price        float64 `gorm:"type:decimal(15,2);default:0" json:"price"`       // Harga Satuan
	TotalValue   float64 `gorm:"type:decimal(15,2);default:0" json:"total_value"` // Nilai Total (computed)

	// Classification
	IsConsumable  bool `gorm:"default:false" json:"is_consumable"`  // Apakah barang habis pakai
	IsReusable    bool `gorm:"default:true" json:"is_reusable"`     // Apakah bisa dipakai ulang
	RequireSerial bool `gorm:"default:false" json:"require_serial"` // Apakah butuh serial number
	IsActive      bool `gorm:"default:true" json:"is_active"`

	// Additional Info
	Specifications string `gorm:"type:text" json:"specifications"` // Spesifikasi teknis
	Notes          string `gorm:"type:text" json:"notes"`

	// Image
	ImageURL string `gorm:"size:255" json:"image_url"`

	// Relations
	Items []InventoryItem `gorm:"foreignKey:InventoryID" json:"items,omitempty"`
}

// TableName sets the table name for Inventory
func (Inventory) TableName() string {
	return "inventories"
}

// InventoryItem represents individual inventory items (for items that need tracking per unit)
type InventoryItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Parent Inventory
	InventoryID uint       `gorm:"not null;index" json:"inventory_id"`
	Inventory   *Inventory `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`

	// Item Details
	SerialNumber string             `gorm:"size:100" json:"serial_number"`                      // Nomor Seri (if applicable)
	AssetNumber  string             `gorm:"size:100" json:"asset_number"`                       // Nomor Aset
	Barcode      string             `gorm:"size:100" json:"barcode"`                            // Barcode
	Condition    InventoryCondition `gorm:"not null;size:50;default:'good'" json:"condition"`   // Kondisi
	Status       InventoryStatus    `gorm:"not null;size:50;default:'available'" json:"status"` // Status

	// Purchase Info
	PurchaseDate  *time.Time `json:"purchase_date,omitempty"`                  // Tanggal Pembelian
	PurchasePrice float64    `gorm:"type:decimal(15,2)" json:"purchase_price"` // Harga Pembelian
	Supplier      string     `gorm:"size:200" json:"supplier"`                 // Supplier/Vendor
	WarrantyEnd   *time.Time `json:"warranty_end,omitempty"`                   // Tanggal Berakhir Garansi

	// Location - Can be assigned to Room
	RoomID     *uint     `gorm:"index" json:"room_id"`
	Room       *Room     `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	RoomUnitID *uint     `gorm:"index" json:"room_unit_id"`
	RoomUnit   *RoomUnit `gorm:"foreignKey:RoomUnitID" json:"room_unit,omitempty"`
	Location   string    `gorm:"size:200" json:"location"` // Lokasi spesifik (jika tidak di room)

	// Maintenance
	LastMaintenanceDate *time.Time `json:"last_maintenance_date,omitempty"` // Tanggal Perawatan Terakhir
	NextMaintenanceDate *time.Time `json:"next_maintenance_date,omitempty"` // Tanggal Perawatan Berikutnya

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for InventoryItem
func (InventoryItem) TableName() string {
	return "inventory_items"
}

// RoomInventory represents inventory assigned to a room (for bulk/consumable items)
type RoomInventory struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Room Assignment
	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	// Inventory
	InventoryID uint       `gorm:"not null;index" json:"inventory_id"`
	Inventory   *Inventory `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`

	// Quantity
	Quantity    int `gorm:"not null;default:0" json:"quantity"` // Jumlah yang di-assign
	MinQuantity int `gorm:"default:0" json:"min_quantity"`      // Minimum untuk room ini

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for RoomInventory
func (RoomInventory) TableName() string {
	return "room_inventories"
}

// InventoryTransaction represents inventory movement/transaction
type InventoryTransaction struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Transaction Type
	TransactionType string `gorm:"not null;size:50" json:"transaction_type"` // in, out, transfer, adjustment, disposal

	// Inventory Reference
	InventoryID     uint           `gorm:"not null;index" json:"inventory_id"`
	Inventory       *Inventory     `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`
	InventoryItemID *uint          `gorm:"index" json:"inventory_item_id"` // For item-level tracking
	InventoryItem   *InventoryItem `gorm:"foreignKey:InventoryItemID" json:"inventory_item,omitempty"`

	// Quantity
	Quantity      int `gorm:"not null" json:"quantity"`       // Jumlah
	PreviousStock int `gorm:"not null" json:"previous_stock"` // Stok Sebelumnya
	CurrentStock  int `gorm:"not null" json:"current_stock"`  // Stok Sesudah

	// Source & Destination (for transfer)
	FromRoomID *uint `gorm:"index" json:"from_room_id"`
	FromRoom   *Room `gorm:"foreignKey:FromRoomID" json:"from_room,omitempty"`
	ToRoomID   *uint `gorm:"index" json:"to_room_id"`
	ToRoom     *Room `gorm:"foreignKey:ToRoomID" json:"to_room,omitempty"`

	// Transaction Details
	TransactionDate time.Time `gorm:"not null" json:"transaction_date"`
	ReferenceNumber string    `gorm:"size:100" json:"reference_number"` // No. Referensi
	Reason          string    `gorm:"type:text" json:"reason"`          // Alasan

	// User who made the transaction
	UserID uint  `gorm:"not null;index" json:"user_id"`
	User   *User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for InventoryTransaction
func (InventoryTransaction) TableName() string {
	return "inventory_transactions"
}
