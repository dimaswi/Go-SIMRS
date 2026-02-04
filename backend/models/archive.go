package models

import (
	"time"

	"gorm.io/gorm"
)

// ===========================================================================
// MEDICAL RECORD ARCHIVE - Arsip Rekam Medis
// ===========================================================================

// ArchiveStatus represents the status of archived medical records
type ArchiveStatus string

const (
	ArchiveStatusActive    ArchiveStatus = "active"    // Aktif - masih digunakan
	ArchiveStatusInactive  ArchiveStatus = "inactive"  // Inaktif - tidak ada kunjungan dalam periode tertentu
	ArchiveStatusArchived  ArchiveStatus = "archived"  // Sudah diarsipkan
	ArchiveStatusDestroyed ArchiveStatus = "destroyed" // Sudah dimusnahkan
)

// ArchiveLocation represents the physical location of archived records
type ArchiveLocation string

const (
	ArchiveLocationActive   ArchiveLocation = "active_storage"   // Rak aktif
	ArchiveLocationInactive ArchiveLocation = "inactive_storage" // Gudang arsip inaktif
	ArchiveLocationDigital  ArchiveLocation = "digital"          // Arsip digital
	ArchiveLocationOffsite  ArchiveLocation = "offsite"          // Lokasi luar (gudang eksternal)
)

// MedicalRecordArchive represents the archive status and tracking for patient medical records
type MedicalRecordArchive struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Patient Reference
	PatientID uint     `gorm:"not null;uniqueIndex" json:"patient_id"`
	Patient   *Patient `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	NoRM      string   `gorm:"size:20;not null;index" json:"no_rm"` // Denormalized for quick lookup

	// Archive Status
	Status       ArchiveStatus   `gorm:"size:20;not null;default:'active'" json:"status"`
	Location     ArchiveLocation `gorm:"size:30;not null;default:'active_storage'" json:"location"`
	LocationCode string          `gorm:"size:50" json:"location_code,omitempty"` // Kode rak/lokasi fisik (contoh: A-01-02)
	ShelfNumber  string          `gorm:"size:20" json:"shelf_number,omitempty"`  // Nomor rak
	BoxNumber    string          `gorm:"size:20" json:"box_number,omitempty"`    // Nomor box/folder
	FolderColor  string          `gorm:"size:20" json:"folder_color,omitempty"`  // Warna folder (untuk sistem terminal digit)

	// Volume Tracking
	TotalDocuments int `gorm:"default:0" json:"total_documents"` // Jumlah dokumen dalam folder
	TotalPages     int `gorm:"default:0" json:"total_pages"`     // Estimasi jumlah halaman
	TotalVolumes   int `gorm:"default:1" json:"total_volumes"`   // Jumlah volume/map

	// Activity Tracking
	LastVisitDate    *time.Time `gorm:"type:date" json:"last_visit_date,omitempty"`  // Tanggal kunjungan terakhir
	LastAccessDate   *time.Time `gorm:"type:date" json:"last_access_date,omitempty"` // Tanggal akses terakhir (dipinjam)
	TotalVisits      int        `gorm:"default:0" json:"total_visits"`               // Total kunjungan pasien
	InactivityMonths int        `gorm:"default:0" json:"inactivity_months"`          // Berapa bulan tidak aktif

	// Retention Schedule
	RetentionYears       int        `gorm:"default:5" json:"retention_years"`                  // Masa simpan (tahun)
	RetentionStartDate   *time.Time `gorm:"type:date" json:"retention_start_date,omitempty"`   // Mulai perhitungan retensi
	ScheduledArchiveDate *time.Time `gorm:"type:date" json:"scheduled_archive_date,omitempty"` // Jadwal pindah ke arsip inaktif
	ScheduledDestroyDate *time.Time `gorm:"type:date" json:"scheduled_destroy_date,omitempty"` // Jadwal pemusnahan

	// Digital Archive
	IsDigitized   bool       `gorm:"default:false" json:"is_digitized"`       // Sudah didigitalisasi
	DigitalPath   string     `gorm:"size:500" json:"digital_path,omitempty"`  // Path file digital
	DigitalSize   int64      `gorm:"default:0" json:"digital_size,omitempty"` // Ukuran file digital (bytes)
	DigitizedAt   *time.Time `json:"digitized_at,omitempty"`
	DigitizedByID *uint      `gorm:"index" json:"digitized_by_id,omitempty"`
	DigitizedBy   *User      `gorm:"foreignKey:DigitizedByID" json:"digitized_by,omitempty"`

	// Audit Trail
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	UpdatedByID *uint `gorm:"index" json:"updated_by_id,omitempty"`
	UpdatedBy   *User `gorm:"foreignKey:UpdatedByID" json:"updated_by,omitempty"`

	// Notes
	Notes string `gorm:"type:text" json:"notes,omitempty"`
}

func (MedicalRecordArchive) TableName() string {
	return "medical_record_archives"
}

// ArchiveMovement tracks the movement/loan history of physical medical records
type ArchiveMovement struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Archive Reference
	ArchiveID uint                  `gorm:"not null;index" json:"archive_id"`
	Archive   *MedicalRecordArchive `gorm:"foreignKey:ArchiveID" json:"archive,omitempty"`
	NoRM      string                `gorm:"size:20;not null;index" json:"no_rm"`

	// Movement Type
	MovementType string `gorm:"size:30;not null" json:"movement_type"` // borrow, return, transfer, archive, retrieve

	// For Borrow/Return
	BorrowedByID   *uint      `gorm:"index" json:"borrowed_by_id,omitempty"`
	BorrowedBy     *User      `gorm:"foreignKey:BorrowedByID" json:"borrowed_by,omitempty"`
	BorrowedByName string     `gorm:"size:100" json:"borrowed_by_name,omitempty"` // Nama jika bukan user (dokter, perawat, dll)
	BorrowReason   string     `gorm:"size:200" json:"borrow_reason,omitempty"`
	BorrowedAt     time.Time  `json:"borrowed_at"`
	DueDate        *time.Time `gorm:"type:date" json:"due_date,omitempty"`
	ReturnedAt     *time.Time `json:"returned_at,omitempty"`

	// For Transfer
	FromLocation     ArchiveLocation `gorm:"size:30" json:"from_location,omitempty"`
	FromLocationCode string          `gorm:"size:50" json:"from_location_code,omitempty"`
	ToLocation       ArchiveLocation `gorm:"size:30" json:"to_location,omitempty"`
	ToLocationCode   string          `gorm:"size:50" json:"to_location_code,omitempty"`

	// Status
	Status string `gorm:"size:20;default:'active'" json:"status"` // active (dipinjam), returned, overdue

	// Audit
	ProcessedByID *uint `gorm:"index" json:"processed_by_id,omitempty"`
	ProcessedBy   *User `gorm:"foreignKey:ProcessedByID" json:"processed_by,omitempty"`

	Notes string `gorm:"type:text" json:"notes,omitempty"`
}

func (ArchiveMovement) TableName() string {
	return "archive_movements"
}

// ArchiveDestruction tracks the destruction of medical records after retention period
type ArchiveDestruction struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Destruction Batch Info
	BatchNumber     string    `gorm:"size:50;not null;uniqueIndex" json:"batch_number"` // Nomor batch pemusnahan
	DestructionDate time.Time `gorm:"type:date;not null" json:"destruction_date"`
	DestructionType string    `gorm:"size:30;not null" json:"destruction_type"` // shredding, incineration, digital_deletion

	// Records Destroyed
	TotalRecords int `gorm:"default:0" json:"total_records"` // Jumlah rekam medis dimusnahkan

	// Approval Chain
	ProposedByID *uint     `gorm:"index" json:"proposed_by_id,omitempty"`
	ProposedBy   *User     `gorm:"foreignKey:ProposedByID" json:"proposed_by,omitempty"`
	ProposedAt   time.Time `json:"proposed_at"`

	ApprovedByID *uint      `gorm:"index" json:"approved_by_id,omitempty"`
	ApprovedBy   *User      `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`

	ExecutedByID *uint      `gorm:"index" json:"executed_by_id,omitempty"`
	ExecutedBy   *User      `gorm:"foreignKey:ExecutedByID" json:"executed_by,omitempty"`
	ExecutedAt   *time.Time `json:"executed_at,omitempty"`

	// Witnesses
	Witness1Name string `gorm:"size:100" json:"witness1_name,omitempty"`
	Witness1Role string `gorm:"size:50" json:"witness1_role,omitempty"`
	Witness2Name string `gorm:"size:100" json:"witness2_name,omitempty"`
	Witness2Role string `gorm:"size:50" json:"witness2_role,omitempty"`

	// Status
	Status string `gorm:"size:20;default:'proposed'" json:"status"` // proposed, approved, executed, cancelled

	// Documentation
	BeritaAcaraNumber string `gorm:"size:50" json:"berita_acara_number,omitempty"` // Nomor berita acara
	BeritaAcaraPath   string `gorm:"size:500" json:"berita_acara_path,omitempty"`  // Path dokumen berita acara

	Notes string `gorm:"type:text" json:"notes,omitempty"`
}

func (ArchiveDestruction) TableName() string {
	return "archive_destructions"
}

// ArchiveDestructionItem lists individual records in a destruction batch
type ArchiveDestructionItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Destruction Reference
	DestructionID uint                `gorm:"not null;index" json:"destruction_id"`
	Destruction   *ArchiveDestruction `gorm:"foreignKey:DestructionID" json:"destruction,omitempty"`

	// Archive Reference (will be set to destroyed after execution)
	ArchiveID uint                  `gorm:"not null;index" json:"archive_id"`
	Archive   *MedicalRecordArchive `gorm:"foreignKey:ArchiveID" json:"archive,omitempty"`

	// Snapshot of destroyed record
	NoRM        string     `gorm:"size:20;not null" json:"no_rm"`
	PatientName string     `gorm:"size:150" json:"patient_name"`
	LastVisit   *time.Time `gorm:"type:date" json:"last_visit,omitempty"`
	TotalPages  int        `gorm:"default:0" json:"total_pages"`
}

func (ArchiveDestructionItem) TableName() string {
	return "archive_destruction_items"
}

// ArchiveSetting stores archive-related settings
type ArchiveSetting struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Key         string `gorm:"size:50;not null;uniqueIndex" json:"key"`
	Value       string `gorm:"type:text" json:"value"`
	Description string `gorm:"size:200" json:"description,omitempty"`
}

func (ArchiveSetting) TableName() string {
	return "archive_settings"
}

// Default archive settings
var DefaultArchiveSettings = []ArchiveSetting{
	{Key: "retention_active_years", Value: "5", Description: "Masa simpan arsip aktif (tahun)"},
	{Key: "retention_inactive_years", Value: "10", Description: "Masa simpan arsip inaktif (tahun)"},
	{Key: "inactivity_threshold_months", Value: "24", Description: "Batas tidak aktif untuk pindah ke inaktif (bulan)"},
	{Key: "borrow_duration_days", Value: "3", Description: "Durasi peminjaman default (hari)"},
	{Key: "overdue_reminder_days", Value: "1", Description: "Reminder sebelum jatuh tempo (hari)"},
	{Key: "filing_system", Value: "terminal_digit", Description: "Sistem penyimpanan (terminal_digit, straight_numerical, middle_digit)"},
	{Key: "color_coding_enabled", Value: "true", Description: "Aktifkan sistem warna folder"},
}
