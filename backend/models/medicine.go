package models

import (
	"time"

	"gorm.io/gorm"
)

// MedicineCategory represents the category of medicine
type MedicineCategory string

const (
	MedicineCategoryGeneric     MedicineCategory = "generic"     // Obat Generik
	MedicineCategoryPatent      MedicineCategory = "patent"      // Obat Paten
	MedicineCategoryHerbal      MedicineCategory = "herbal"      // Obat Herbal
	MedicineCategoryTraditional MedicineCategory = "traditional" // Obat Tradisional
	MedicineCategoryBiological  MedicineCategory = "biological"  // Obat Biologis
)

// MedicineType represents the type/classification of medicine
type MedicineType string

const (
	MedicineTypeOTC         MedicineType = "otc"         // Obat Bebas (Over The Counter)
	MedicineTypeLimited     MedicineType = "limited"     // Obat Bebas Terbatas
	MedicineTypeHard        MedicineType = "hard"        // Obat Keras
	MedicineTypeNarcotic    MedicineType = "narcotic"    // Narkotika
	MedicineTypePsychotrope MedicineType = "psychotrope" // Psikotropika
)

// MedicineForm represents the pharmaceutical form of medicine
type MedicineForm string

const (
	MedicineFormTablet      MedicineForm = "tablet"      // Tablet
	MedicineFormCapsule     MedicineForm = "capsule"     // Kapsul
	MedicineFormSyrup       MedicineForm = "syrup"       // Sirup
	MedicineFormInjection   MedicineForm = "injection"   // Injeksi
	MedicineFormCream       MedicineForm = "cream"       // Krim
	MedicineFormOintment    MedicineForm = "ointment"    // Salep
	MedicineFormDrops       MedicineForm = "drops"       // Tetes
	MedicineFormPowder      MedicineForm = "powder"      // Serbuk
	MedicineFormInfusion    MedicineForm = "infusion"    // Infus
	MedicineFormSuppository MedicineForm = "suppository" // Supositoria
	MedicineFormInhaler     MedicineForm = "inhaler"     // Inhaler
	MedicineFormPatch       MedicineForm = "patch"       // Patch/Koyo
	MedicineFormOther       MedicineForm = "other"       // Lainnya
)

// Medicine represents master data for medicines/drugs
type Medicine struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Basic Information
	Code         string           `gorm:"not null;uniqueIndex;size:50" json:"code"`   // Kode Obat (unique)
	Name         string           `gorm:"not null;size:200" json:"name"`              // Nama Obat
	GenericName  string           `gorm:"size:200" json:"generic_name"`               // Nama Generik
	Description  string           `gorm:"type:text" json:"description"`               // Deskripsi
	Category     MedicineCategory `gorm:"not null;size:50" json:"category"`           // Kategori
	Type         MedicineType     `gorm:"not null;size:50;default:'otc'" json:"type"` // Jenis/Golongan Obat
	Form         MedicineForm     `gorm:"not null;size:50" json:"form"`               // Bentuk Sediaan
	Strength     string           `gorm:"size:100" json:"strength"`                   // Kekuatan/Dosis (e.g., "500mg", "10ml")
	Unit         string           `gorm:"not null;size:50" json:"unit"`               // Satuan (tablet, kapsul, botol, ampul)
	Manufacturer string           `gorm:"size:200" json:"manufacturer"`               // Pabrik/Produsen

	// Stock Information (stok aktual ada di RoomMedicine per ruangan)
	MinStock      int     `gorm:"default:0" json:"min_stock"`                         // Stok Minimum Global
	MaxStock      int     `gorm:"default:0" json:"max_stock"`                         // Stok Maksimum Global
	PurchasePrice float64 `gorm:"type:decimal(15,2);default:0" json:"purchase_price"` // Harga Beli (HNA)
	SellingPrice  float64 `gorm:"type:decimal(15,2);default:0" json:"selling_price"`  // Harga Jual (HET)

	// Medical Information
	Indication       string `gorm:"type:text" json:"indication"`       // Indikasi
	Contraindication string `gorm:"type:text" json:"contraindication"` // Kontraindikasi
	SideEffects      string `gorm:"type:text" json:"side_effects"`     // Efek Samping
	Dosage           string `gorm:"type:text" json:"dosage"`           // Dosis
	Interaction      string `gorm:"type:text" json:"interaction"`      // Interaksi Obat
	StorageInfo      string `gorm:"type:text" json:"storage_info"`     // Cara Penyimpanan

	// Status
	IsActive      bool `gorm:"default:true" json:"is_active"`
	RequireRecipe bool `gorm:"default:false" json:"require_recipe"` // Butuh Resep Dokter

	// Additional Info
	Notes    string `gorm:"type:text" json:"notes"`
	ImageURL string `gorm:"size:255" json:"image_url"`
}

// TableName sets the table name for Medicine
func (Medicine) TableName() string {
	return "medicines"
}

// MedicineBatch represents batch/lot information for medicines
type MedicineBatch struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Medicine Reference
	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// Batch Information
	BatchNumber     string     `gorm:"not null;size:100" json:"batch_number"`    // Nomor Batch
	ExpiryDate      time.Time  `gorm:"not null" json:"expiry_date"`              // Tanggal Kadaluarsa
	ManufactureDate *time.Time `json:"manufacture_date,omitempty"`               // Tanggal Produksi
	Quantity        int        `gorm:"not null;default:0" json:"quantity"`       // Jumlah dalam batch
	RemainingQty    int        `gorm:"not null;default:0" json:"remaining_qty"`  // Sisa stok batch
	PurchasePrice   float64    `gorm:"type:decimal(15,2)" json:"purchase_price"` // Harga Beli per unit
	Supplier        string     `gorm:"size:200" json:"supplier"`                 // Supplier

	// Location
	Location string `gorm:"size:200" json:"location"` // Lokasi penyimpanan

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"`

	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for MedicineBatch
func (MedicineBatch) TableName() string {
	return "medicine_batches"
}

// RoomMedicine represents medicine assigned to a room (depo/storage in room)
type RoomMedicine struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Room Assignment
	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	// Medicine
	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// Quantity
	Quantity    int `gorm:"not null;default:0" json:"quantity"` // Jumlah yang di-assign
	MinQuantity int `gorm:"default:0" json:"min_quantity"`      // Minimum untuk room ini

	// Notes
	Notes string `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for RoomMedicine
func (RoomMedicine) TableName() string {
	return "room_medicines"
}

// MedicineTransaction represents medicine movement/transaction
type MedicineTransaction struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Transaction Type
	TransactionType string `gorm:"not null;size:50" json:"transaction_type"` // in, out, transfer, adjustment, disposal, dispensing

	// Medicine Reference
	MedicineID      uint           `gorm:"not null;index" json:"medicine_id"`
	Medicine        *Medicine      `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	MedicineBatchID *uint          `gorm:"index" json:"medicine_batch_id"` // For batch-level tracking
	MedicineBatch   *MedicineBatch `gorm:"foreignKey:MedicineBatchID" json:"medicine_batch,omitempty"`

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

// TableName sets the table name for MedicineTransaction
func (MedicineTransaction) TableName() string {
	return "medicine_transactions"
}
