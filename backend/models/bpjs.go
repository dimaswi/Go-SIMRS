package models

import (
	"time"

	"gorm.io/gorm"
)

// BPJSConfig stores BPJS API configuration
type BPJSConfig struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Key         string         `gorm:"uniqueIndex;not null;size:100" json:"key"`
	Value       string         `gorm:"type:text" json:"value"`
	Description string         `gorm:"type:text" json:"description"`
	IsEncrypted bool           `gorm:"default:false" json:"is_encrypted"`
	IsSecret    bool           `gorm:"default:false" json:"is_secret"` // If true, don't return value to frontend
}

// BPJSQueue stores BPJS online queue data
type BPJSQueue struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// BPJS Data
	KodeBooking    string    `gorm:"uniqueIndex;not null;size:50" json:"kode_booking"`
	NomorAntrean   string    `gorm:"not null;size:20" json:"nomor_antrean"`
	AngkaAntrean   int       `json:"angka_antrean"`
	NoKartu        string    `gorm:"not null;size:20;index" json:"no_kartu"`
	NIK            string    `gorm:"not null;size:20;index" json:"nik"`
	NamaPasien     string    `gorm:"not null;size:100" json:"nama_pasien"`
	NoHP           string    `gorm:"size:20" json:"no_hp"`
	TanggalPeriksa time.Time `gorm:"not null;index" json:"tanggal_periksa"`

	// Poli Info
	KodePoli   string `gorm:"not null;size:10;index" json:"kode_poli"`
	NamaPoli   string `gorm:"size:100" json:"nama_poli"`
	KodeDokter string `gorm:"size:20" json:"kode_dokter"`
	NamaDokter string `gorm:"size:100" json:"nama_dokter"`
	JamPraktek string `gorm:"size:20" json:"jam_praktek"`

	// Reference
	JenisKunjungan int    `gorm:"default:2" json:"jenis_kunjungan"` // 1=FKTP, 2=Internal, 3=Kontrol, 4=Antar RS
	NomorReferensi string `gorm:"size:50" json:"nomor_referensi"`
	PasienBaru     int    `gorm:"default:0" json:"pasien_baru"`

	// Status Tracking
	Status      string     `gorm:"default:'pending';size:20" json:"status"` // pending, checkedin, serving, completed, cancelled
	CheckedInAt *time.Time `json:"checked_in_at"`

	// Task Tracking (BPJS Task IDs)
	Task1At  *time.Time `json:"task_1_at"`  // Mulai tunggu admisi
	Task2At  *time.Time `json:"task_2_at"`  // Selesai tunggu admisi
	Task3At  *time.Time `json:"task_3_at"`  // Mulai tunggu poli
	Task4At  *time.Time `json:"task_4_at"`  // Dipanggil dokter
	Task5At  *time.Time `json:"task_5_at"`  // Mulai periksa
	Task6At  *time.Time `json:"task_6_at"`  // Selesai periksa
	Task7At  *time.Time `json:"task_7_at"`  // Mulai tunggu farmasi
	Task99At *time.Time `json:"task_99_at"` // Selesai/Batal

	// Link to SIMRS
	PatientID      *uint `json:"patient_id"`
	RegistrationID *uint `json:"registration_id"`
	VisitID        *uint `json:"visit_id"`
	RoomQueueID    *uint `json:"room_queue_id"`

	// Sync Status
	SyncStatus string     `gorm:"default:'synced';size:20" json:"sync_status"` // synced, pending, failed
	LastSyncAt *time.Time `json:"last_sync_at"`
	SyncError  string     `gorm:"type:text" json:"sync_error"`
	Notes      string     `gorm:"type:text" json:"notes"`

	// Relations
	Patient      *Patient      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Registration *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`
	Visit        *Visit        `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	RoomQueue    *RoomQueue    `gorm:"foreignKey:RoomQueueID" json:"room_queue,omitempty"`
}

// BPJSSyncLog stores API request/response logs
type BPJSSyncLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	// Request Info
	Endpoint    string `gorm:"not null;size:255;index" json:"endpoint"`
	Method      string `gorm:"not null;size:10" json:"method"`
	RequestBody string `gorm:"type:text" json:"request_body"`

	// Response Info
	ResponseCode int    `json:"response_code"`
	ResponseBody string `gorm:"type:text" json:"response_body"`

	// Status
	Status       string `gorm:"not null;size:20;index" json:"status"` // success, failed, timeout
	ErrorMessage string `gorm:"type:text" json:"error_message"`

	// Timing
	RequestAt  time.Time  `gorm:"not null;index" json:"request_at"`
	ResponseAt *time.Time `json:"response_at"`
	DurationMs int        `json:"duration_ms"`

	// Reference
	ReferenceType string `gorm:"size:50" json:"reference_type"` // bpjs_queue, sep, claim
	ReferenceID   *uint  `json:"reference_id"`
}

// BPJSPoliMapping maps SIMRS rooms to BPJS poli codes
type BPJSPoliMapping struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// SIMRS Room
	RoomID   uint   `gorm:"not null;uniqueIndex" json:"room_id"`
	RoomCode string `gorm:"size:20" json:"room_code"`
	RoomName string `gorm:"size:100" json:"room_name"`

	// BPJS Poli
	KodePoliBPJS string `gorm:"not null;size:10;index" json:"kode_poli_bpjs"`
	NamaPoliBPJS string `gorm:"size:100" json:"nama_poli_bpjs"`

	IsActive bool `gorm:"default:true" json:"is_active"`

	// Relations
	Room           *Room               `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	DoctorMappings []BPJSDoctorMapping `gorm:"foreignKey:PoliMappingID" json:"doctor_mappings,omitempty"`
}

// BPJSDoctorMapping maps SIMRS doctor schedules to BPJS doctor codes
// Each doctor can have different BPJS codes for different poli
type BPJSDoctorMapping struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Link to Poli Mapping
	PoliMappingID uint             `gorm:"not null;index" json:"poli_mapping_id"`
	PoliMapping   *BPJSPoliMapping `gorm:"foreignKey:PoliMappingID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"poli_mapping,omitempty"`

	// SIMRS Doctor Schedule
	DoctorScheduleID uint            `gorm:"index" json:"doctor_schedule_id"` // Optional - specific schedule
	DoctorSchedule   *DoctorSchedule `gorm:"foreignKey:DoctorScheduleID" json:"doctor_schedule,omitempty"`

	// SIMRS Employee (Doctor)
	EmployeeID   uint      `gorm:"not null;index" json:"employee_id"`
	Employee     *Employee `gorm:"foreignKey:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"employee,omitempty"`
	EmployeeName string    `gorm:"size:100" json:"employee_name"` // Cache for display

	// BPJS Doctor Info
	KodeDokterBPJS string `gorm:"not null;size:20;index" json:"kode_dokter_bpjs"`
	NamaDokterBPJS string `gorm:"size:100" json:"nama_dokter_bpjs"`

	// Schedule Info from BPJS (for display/validation)
	JadwalHari  string `gorm:"size:50" json:"jadwal_hari"` // e.g., "Senin, Rabu, Jumat"
	JamPraktek  string `gorm:"size:50" json:"jam_praktek"` // e.g., "08:00-12:00"
	KuotaJKN    int    `gorm:"default:0" json:"kuota_jkn"` // Kuota pasien JKN per hari
	KuotaNonJKN int    `gorm:"default:0" json:"kuota_non_jkn"`

	IsActive bool `gorm:"default:true" json:"is_active"`
}

// TableName returns the table name for BPJSConfig
func (BPJSConfig) TableName() string {
	return "bpjs_configs"
}

// TableName returns the table name for BPJSQueue
func (BPJSQueue) TableName() string {
	return "bpjs_queues"
}

// TableName returns the table name for BPJSSyncLog
func (BPJSSyncLog) TableName() string {
	return "bpjs_sync_logs"
}

// TableName returns the table name for BPJSPoliMapping
func (BPJSPoliMapping) TableName() string {
	return "bpjs_poli_mappings"
}

// TableName returns the table name for BPJSDoctorMapping
func (BPJSDoctorMapping) TableName() string {
	return "bpjs_doctor_mappings"
}

// BPJS Config Keys
const (
	BPJSConfigConsID          = "bpjs_cons_id"
	BPJSConfigSecretKey       = "bpjs_secret_key"
	BPJSConfigUserKey         = "bpjs_user_key"
	BPJSConfigKodePPK         = "bpjs_kode_ppk"
	BPJSConfigNamaPPK         = "bpjs_nama_ppk"
	BPJSConfigEnvironment     = "bpjs_environment"
	BPJSConfigBaseURLDev      = "bpjs_base_url_dev"
	BPJSConfigBaseURLProd     = "bpjs_base_url_prod"
	BPJSConfigSyncInterval    = "bpjs_sync_interval_minutes"
	BPJSConfigAutoSyncEnabled = "bpjs_auto_sync_enabled"
)

// Default BPJS Config values
var DefaultBPJSConfigs = []BPJSConfig{
	{Key: BPJSConfigConsID, Value: "", Description: "Consumer ID dari BPJS", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigSecretKey, Value: "", Description: "Secret Key dari BPJS", IsEncrypted: true, IsSecret: true},
	{Key: BPJSConfigUserKey, Value: "", Description: "User Key dari BPJS", IsEncrypted: true, IsSecret: true},
	{Key: BPJSConfigKodePPK, Value: "", Description: "Kode Faskes/PPK", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigNamaPPK, Value: "", Description: "Nama Faskes", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigEnvironment, Value: "development", Description: "Environment: development atau production", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigBaseURLDev, Value: "https://apijkn-dev.bpjs-kesehatan.go.id", Description: "Base URL Development", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigBaseURLProd, Value: "https://apijkn.bpjs-kesehatan.go.id", Description: "Base URL Production", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigSyncInterval, Value: "5", Description: "Interval sinkronisasi dalam menit", IsEncrypted: false, IsSecret: false},
	{Key: BPJSConfigAutoSyncEnabled, Value: "false", Description: "Enable auto sync", IsEncrypted: false, IsSecret: false},
}
