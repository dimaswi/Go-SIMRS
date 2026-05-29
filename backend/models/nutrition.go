package models

import (
	"time"

	"gorm.io/gorm"
)

// ==========================================
// NUTRITION / GIZI MANAGEMENT
// ==========================================

// Nutrition Menu Category Constants
const (
	NutritionCategoryMakananPokok = "makanan_pokok" // Nasi, bubur, dll
	NutritionCategoryLauk         = "lauk"          // Lauk pauk
	NutritionCategorySayur        = "sayur"         // Sayuran
	NutritionCategoryBuah         = "buah"          // Buah-buahan
	NutritionCategorySnack        = "snack"         // Makanan ringan
	NutritionCategoryMinuman      = "minuman"       // Minuman
	NutritionCategorySuplemen     = "suplemen"      // Suplemen gizi
	NutritionCategoryLainnya      = "lainnya"       // Lainnya
)

// Nutrition Diet Type Constants
const (
	NutritionDietBiasa         = "biasa"          // Diet biasa / umum
	NutritionDietLunak         = "lunak"          // Makanan lunak
	NutritionDietSaring        = "saring"         // Makanan saring
	NutritionDietCair          = "cair"           // Makanan cair
	NutritionDietDM            = "dm"             // Diet Diabetes Mellitus
	NutritionDietRendahGaram   = "rendah_garam"   // Diet Rendah Garam
	NutritionDietRendahLemak   = "rendah_lemak"   // Diet Rendah Lemak
	NutritionDietTinggiKalori  = "tinggi_kalori"  // Diet Tinggi Kalori Tinggi Protein
	NutritionDietRendahProtein = "rendah_protein" // Diet Rendah Protein
	NutritionDietRendahPurin   = "rendah_purin"   // Diet Rendah Purin
	NutritionDietLambung       = "lambung"        // Diet Lambung
	NutritionDietJantung       = "jantung"        // Diet Jantung
	NutritionDietGinjal        = "ginjal"         // Diet Ginjal
	NutritionDietHati          = "hati"           // Diet Hati
	NutritionDietLainnya       = "lainnya"        // Diet khusus lainnya
)

// Nutrition Meal Time Constants
const (
	NutritionMealPagi       = "pagi"        // Makan Pagi
	NutritionMealSnackPagi  = "snack_pagi"  // Snack Pagi
	NutritionMealSiang      = "siang"       // Makan Siang
	NutritionMealSnackSore  = "snack_sore"  // Snack Sore
	NutritionMealSore       = "sore"        // Makan Sore/Malam
	NutritionMealSnackMalam = "snack_malam" // Snack Malam
)

// NutritionMenu represents a food/drink item in the nutrition master data
// Master Menu Makanan
type NutritionMenu struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Basic Information
	Code        string `gorm:"not null;uniqueIndex;size:20" json:"code"` // Kode menu (MNU-001)
	Name        string `gorm:"not null;size:200" json:"name"`            // Nama menu
	Description string `gorm:"type:text" json:"description,omitempty"`   // Deskripsi menu
	Category    string `gorm:"not null;size:50;index" json:"category"`   // makanan_pokok, lauk, sayur, buah, snack, minuman, suplemen
	DietTypes   string `gorm:"type:text" json:"diet_types,omitempty"`    // JSON array: ["biasa", "dm", "rendah_garam"] - diet yang cocok

	// Nutritional Information (per porsi)
	Calories     float64 `gorm:"type:decimal(10,2);default:0" json:"calories"`     // Kalori (kkal)
	Protein      float64 `gorm:"type:decimal(10,2);default:0" json:"protein"`      // Protein (gram)
	Fat          float64 `gorm:"type:decimal(10,2);default:0" json:"fat"`          // Lemak (gram)
	Carbohydrate float64 `gorm:"type:decimal(10,2);default:0" json:"carbohydrate"` // Karbohidrat (gram)
	Fiber        float64 `gorm:"type:decimal(10,2);default:0" json:"fiber"`        // Serat (gram)
	Sodium       float64 `gorm:"type:decimal(10,2);default:0" json:"sodium"`       // Natrium (mg)

	// Serving
	ServingSize string  `gorm:"size:50" json:"serving_size,omitempty"`          // Ukuran porsi (contoh: "1 porsi", "200ml")
	UnitPrice   float64 `gorm:"type:decimal(15,2);default:0" json:"unit_price"` // Harga per porsi

	// Status
	IsActive bool   `gorm:"default:true" json:"is_active"`
	Notes    string `gorm:"type:text" json:"notes,omitempty"`

	// Relations
	Ingredients []NutritionMenuIngredient `gorm:"foreignKey:MenuID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"ingredients,omitempty"`
}

func (NutritionMenu) TableName() string {
	return "nutrition_menus"
}

// NutritionPackage represents a meal package (collection of menu items)
// Master Paket Makanan
type NutritionPackage struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Basic Information
	Code        string `gorm:"not null;uniqueIndex;size:20" json:"code"` // Kode paket (PKT-001)
	Name        string `gorm:"not null;size:200" json:"name"`            // Nama paket (contoh: "Paket Diet DM Pagi")
	Description string `gorm:"type:text" json:"description,omitempty"`   // Deskripsi paket
	DietType    string `gorm:"not null;size:50;index" json:"diet_type"`  // Jenis diet paket ini
	MealTime    string `gorm:"not null;size:20;index" json:"meal_time"`  // Waktu makan: pagi, siang, sore, snack_pagi, snack_sore

	// Computed Nutritional Info (total dari semua item)
	TotalCalories     float64 `gorm:"type:decimal(10,2);default:0" json:"total_calories"`
	TotalProtein      float64 `gorm:"type:decimal(10,2);default:0" json:"total_protein"`
	TotalFat          float64 `gorm:"type:decimal(10,2);default:0" json:"total_fat"`
	TotalCarbohydrate float64 `gorm:"type:decimal(10,2);default:0" json:"total_carbohydrate"`

	// Pricing
	Price float64 `gorm:"type:decimal(15,2);default:0" json:"price"` // Harga paket (bisa override total item price)

	// Status
	IsActive bool   `gorm:"default:true" json:"is_active"`
	Notes    string `gorm:"type:text" json:"notes,omitempty"`

	// Relations
	Items []NutritionPackageItem `gorm:"foreignKey:PackageID" json:"items,omitempty"`
}

func (NutritionPackage) TableName() string {
	return "nutrition_packages"
}

// NutritionPackageItem represents a single menu item within a package
type NutritionPackageItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	PackageID uint              `gorm:"not null;index:idx_package_menu" json:"package_id"`
	Package   *NutritionPackage `gorm:"foreignKey:PackageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`

	MenuID uint           `gorm:"not null;index:idx_package_menu" json:"menu_id"`
	Menu   *NutritionMenu `gorm:"foreignKey:MenuID" json:"menu,omitempty"`

	Quantity float64 `gorm:"type:decimal(10,2);default:1" json:"quantity"` // Jumlah porsi
	Notes    string  `gorm:"type:text" json:"notes,omitempty"`             // Catatan khusus
}

func (NutritionPackageItem) TableName() string {
	return "nutrition_package_items"
}

// NutritionOrder represents a nutrition/meal order for an inpatient per day
// Order Gizi Pasien Rawat Inap
type NutritionOrder struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Patient & Visit Reference
	VisitID   uint     `gorm:"not null;index" json:"visit_id"`
	Visit     *Visit   `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	PatientID uint     `gorm:"not null;index" json:"patient_id"`
	Patient   *Patient `gorm:"foreignKey:PatientID" json:"patient,omitempty"`

	// Order Details
	OrderDate time.Time `gorm:"not null;index" json:"order_date"`               // Tanggal menu berlaku
	MealTime  string    `gorm:"not null;size:20;index" json:"meal_time"`        // pagi, siang, sore, snack_pagi, snack_sore, snack_malam
	DietType  string    `gorm:"not null;size:50" json:"diet_type"`              // Jenis diet
	Status    string    `gorm:"not null;size:20;default:'draft'" json:"status"` // draft, confirmed, preparing, delivered, cancelled

	// Package reference (optional - if using package)
	PackageID *uint             `gorm:"index" json:"package_id,omitempty"`
	Package   *NutritionPackage `gorm:"foreignKey:PackageID" json:"package,omitempty"`

	// Room & Bed info (denormalized for kitchen display)
	RoomName string `gorm:"size:100" json:"room_name,omitempty"` // Nama ruangan
	BedName  string `gorm:"size:50" json:"bed_name,omitempty"`   // Nama bed

	// Ordered by (ahli gizi)
	OrderedByID *uint     `gorm:"index" json:"ordered_by_id,omitempty"`
	OrderedBy   *Employee `gorm:"foreignKey:OrderedByID" json:"ordered_by,omitempty"`

	// Delivery tracking
	PreparedAt  *time.Time `json:"prepared_at,omitempty"`
	DeliveredAt *time.Time `json:"delivered_at,omitempty"`
	DeliveredBy *uint      `gorm:"index" json:"delivered_by_id,omitempty"`

	// Notes
	AllergyNotes string `gorm:"type:text" json:"allergy_notes,omitempty"` // Catatan alergi makanan
	SpecialNotes string `gorm:"type:text" json:"special_notes,omitempty"` // Catatan khusus lainnya

	// Relations
	Items []NutritionOrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
}

func (NutritionOrder) TableName() string {
	return "nutrition_orders"
}

// NutritionOrderItem represents a single menu item in a nutrition order
type NutritionOrderItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	OrderID uint            `gorm:"not null;index" json:"order_id"`
	Order   *NutritionOrder `gorm:"foreignKey:OrderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`

	MenuID uint           `gorm:"not null;index" json:"menu_id"`
	Menu   *NutritionMenu `gorm:"foreignKey:MenuID" json:"menu,omitempty"`

	Quantity float64 `gorm:"type:decimal(10,2);default:1" json:"quantity"` // Jumlah porsi
	Notes    string  `gorm:"type:text" json:"notes,omitempty"`             // Catatan per item
}

func (NutritionOrderItem) TableName() string {
	return "nutrition_order_items"
}

// ==========================================
// HELPER LABELS
// ==========================================

var NutritionCategoryLabels = map[string]string{
	NutritionCategoryMakananPokok: "Makanan Pokok",
	NutritionCategoryLauk:         "Lauk Pauk",
	NutritionCategorySayur:        "Sayuran",
	NutritionCategoryBuah:         "Buah-buahan",
	NutritionCategorySnack:        "Makanan Ringan",
	NutritionCategoryMinuman:      "Minuman",
	NutritionCategorySuplemen:     "Suplemen Gizi",
	NutritionCategoryLainnya:      "Lainnya",
}

var NutritionDietTypeLabels = map[string]string{
	NutritionDietBiasa:         "Diet Biasa",
	NutritionDietLunak:         "Makanan Lunak",
	NutritionDietSaring:        "Makanan Saring",
	NutritionDietCair:          "Makanan Cair",
	NutritionDietDM:            "Diet Diabetes Mellitus",
	NutritionDietRendahGaram:   "Diet Rendah Garam",
	NutritionDietRendahLemak:   "Diet Rendah Lemak",
	NutritionDietTinggiKalori:  "Diet Tinggi Kalori Tinggi Protein",
	NutritionDietRendahProtein: "Diet Rendah Protein",
	NutritionDietRendahPurin:   "Diet Rendah Purin",
	NutritionDietLambung:       "Diet Lambung",
	NutritionDietJantung:       "Diet Jantung",
	NutritionDietGinjal:        "Diet Ginjal",
	NutritionDietHati:          "Diet Hati",
	NutritionDietLainnya:       "Diet Lainnya",
}

var NutritionMealTimeLabels = map[string]string{
	NutritionMealPagi:       "Makan Pagi",
	NutritionMealSnackPagi:  "Snack Pagi",
	NutritionMealSiang:      "Makan Siang",
	NutritionMealSnackSore:  "Snack Sore",
	NutritionMealSore:       "Makan Sore",
	NutritionMealSnackMalam: "Snack Malam",
}

// Nutrition Ingredient Unit Constants
const (
	NutritionIngredientUnitGram        = "gram"
	NutritionIngredientUnitMl          = "ml"
	NutritionIngredientUnitPcs         = "pcs"
	NutritionIngredientUnitBuah        = "buah"
	NutritionIngredientUnitSendokMakan = "sendok_makan"
	NutritionIngredientUnitSendokTeh   = "sendok_teh"
)

var NutritionIngredientUnitLabels = map[string]string{
	NutritionIngredientUnitGram:        "Gram",
	NutritionIngredientUnitMl:          "Mililiter",
	NutritionIngredientUnitPcs:         "Pcs",
	NutritionIngredientUnitBuah:        "Buah",
	NutritionIngredientUnitSendokMakan: "Sendok Makan",
	NutritionIngredientUnitSendokTeh:   "Sendok Teh",
}

// NutritionIngredient represents master ingredient data for nutrition menus.
type NutritionIngredient struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code          string  `gorm:"not null;uniqueIndex;size:20" json:"code"`            // Kode bahan (BAH-001)
	Name          string  `gorm:"not null;size:200;index" json:"name"`                 // Nama bahan
	Category      string  `gorm:"size:100;index" json:"category,omitempty"`            // Kelompok bahan (sayur, lauk, bumbu, dll)
	DefaultUnit   string  `gorm:"not null;size:30;default:'gram'" json:"default_unit"` // Satuan default berat/isi
	DefaultWeight float64 `gorm:"type:decimal(12,2);default:0" json:"default_weight"`  // Berat/isi default per 1 kemasan
	IsActive      bool    `gorm:"default:true" json:"is_active"`
	Notes         string  `gorm:"type:text" json:"notes,omitempty"`
}

func (NutritionIngredient) TableName() string {
	return "nutrition_ingredients"
}

// NutritionMenuIngredient stores ingredient composition for one menu portion.
type NutritionMenuIngredient struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	MenuID uint `gorm:"not null;index:idx_menu_ingredient" json:"menu_id"`

	IngredientID uint                 `gorm:"not null;index:idx_menu_ingredient" json:"ingredient_id"`
	Ingredient   *NutritionIngredient `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`

	WeightPerPortion float64 `gorm:"type:decimal(10,2);default:0" json:"weight_per_portion"` // Berat per 1 porsi
	Unit             string  `gorm:"not null;size:30;default:'gram'" json:"unit"`            // Satuan berat/jumlah
	Notes            string  `gorm:"type:text" json:"notes,omitempty"`
}

func (NutritionMenuIngredient) TableName() string {
	return "nutrition_menu_ingredients"
}

// NutritionIngredientInvoice represents ingredient purchase invoice input in nutrition module.
// Tidak mempengaruhi stok, hanya pencatatan faktur bahan.
type NutritionIngredientInvoice struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code          string                           `gorm:"not null;uniqueIndex;size:20" json:"code"`             // Kode internal faktur (NFIyyyyMMddxxx)
	InvoiceNumber string                           `gorm:"not null;size:100;index" json:"invoice_number"`        // Nomor faktur vendor
	InvoiceDate   time.Time                        `gorm:"not null;index" json:"invoice_date"`                   // Tanggal faktur
	SupplierName  string                           `gorm:"size:200;index" json:"supplier_name,omitempty"`        // Nama supplier
	ReceivedByID  *uint                            `gorm:"index" json:"received_by_id,omitempty"`                // Petugas input/terima
	ReceivedBy    *Employee                        `gorm:"foreignKey:ReceivedByID" json:"received_by,omitempty"` // Relasi petugas
	TotalAmount   float64                          `gorm:"type:decimal(15,2);default:0" json:"total_amount"`     // Total nominal faktur (computed)
	Notes         string                           `gorm:"type:text" json:"notes,omitempty"`
	Items         []NutritionIngredientInvoiceItem `gorm:"foreignKey:InvoiceID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"items,omitempty"`
}

func (NutritionIngredientInvoice) TableName() string {
	return "nutrition_ingredient_invoices"
}

// NutritionIngredientInvoiceItem stores ingredient lines in one nutrition invoice.
type NutritionIngredientInvoiceItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	InvoiceID uint                        `gorm:"not null;index:idx_nutrition_invoice_ingredient" json:"invoice_id"`
	Invoice   *NutritionIngredientInvoice `gorm:"foreignKey:InvoiceID" json:"-"`

	IngredientID uint                 `gorm:"not null;index:idx_nutrition_invoice_ingredient" json:"ingredient_id"`
	Ingredient   *NutritionIngredient `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`

	Quantity    float64 `gorm:"type:decimal(12,2);default:0" json:"quantity"`       // Jumlah kemasan
	Unit        string  `gorm:"not null;size:30;default:'kemasan'" json:"unit"`     // Satuan kemasan (kemasan/pcs/bungkus)
	UnitWeight  float64 `gorm:"type:decimal(12,2);default:0" json:"unit_weight"`    // Berat/isi per kemasan (snapshot master)
	WeightUnit  string  `gorm:"not null;size:30;default:'gram'" json:"weight_unit"` // Satuan berat/isi
	TotalWeight float64 `gorm:"type:decimal(12,2);default:0" json:"total_weight"`   // quantity * unit_weight
	UnitPrice   float64 `gorm:"type:decimal(15,2);default:0" json:"unit_price"`     // Harga per kemasan
	LineTotal   float64 `gorm:"type:decimal(15,2);default:0" json:"line_total"`     // quantity * unit_price
	Notes       string  `gorm:"type:text" json:"notes,omitempty"`
}

func (NutritionIngredientInvoiceItem) TableName() string {
	return "nutrition_ingredient_invoice_items"
}
