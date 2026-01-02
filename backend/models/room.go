package models

import (
	"time"

	"gorm.io/gorm"
)

// Room represents a hospital room/unit (Ruangan)
// Can be: Rawat Inap, Poliklinik, UGD, Laboratorium, Radiologi, Farmasi, etc.
type Room struct {
	ID              uint           `gorm:"primarykey" json:"id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	Code            string         `gorm:"not null;size:20" json:"code"`
	Name            string         `gorm:"not null;size:100" json:"name"`
	QueueCode       string         `gorm:"size:5" json:"queue_code"`                             // kode antrean ruangan (A, B, L, R, dll)
	ServiceType     string         `gorm:"not null;size:50" json:"service_type"`                 // service_type from master data (rawat_jalan, rawat_inap, penunjang, administrasi)
	RoomType        string         `gorm:"not null;size:50" json:"room_type"`                    // room_type from master data (rawat_inap, icu, poliklinik, laboratorium, etc)
	RoomClass       string         `gorm:"size:50" json:"room_class"`                            // room_class from master data (vvip, vip, kelas_1, etc) - optional for non-bed rooms
	TotalFloors     int            `gorm:"default:1" json:"total_floors"`                        // jumlah lantai di ruangan ini
	RegistrationFee float64        `gorm:"type:decimal(15,2);default:0" json:"registration_fee"` // Tarif pendaftaran per ruangan
	TariffPerDay    float64        `gorm:"type:decimal(15,2);default:0" json:"tariff_per_day"`   // Legacy: tarif per hari (untuk backward compatibility)
	Facilities      string         `gorm:"type:text" json:"facilities"`                          // fasilitas umum ruangan
	Description     string         `gorm:"type:text" json:"description"`                         // deskripsi ruangan
	HasBed          bool           `gorm:"default:false" json:"has_bed"`                         // apakah ruangan ini punya tempat tidur
	HasSchedule     bool           `gorm:"default:false" json:"has_schedule"`                    // apakah ruangan ini butuh jadwal (untuk poli)
	IsActive        bool           `gorm:"default:true" json:"is_active"`
	PICEmployeeID   *uint          `gorm:"index" json:"pic_employee_id"`                           // Penanggung Jawab Ruangan
	PICEmployee     *Employee      `gorm:"foreignKey:PICEmployeeID" json:"pic_employee,omitempty"` // Person In Charge
	Units           []RoomUnit     `gorm:"foreignKey:RoomID" json:"units,omitempty"`               // Daftar kamar (untuk ruangan dengan bed)
	Schedules       []Schedule     `gorm:"foreignKey:RoomID" json:"schedules,omitempty"`           // Jadwal operasional ruangan
	Tariffs         []RoomTariff   `gorm:"foreignKey:RoomID" json:"tariffs,omitempty"`             // Tarif per kelas pasien
	TotalBeds       int            `gorm:"-" json:"total_beds"`                                    // Computed field
	AvailableBeds   int            `gorm:"-" json:"available_beds"`                                // Computed field
}

// TableName sets the table name for Room
func (Room) TableName() string {
	return "rooms"
}

// RoomTariff represents tariff per patient class for a room (especially for inpatient)
// Similar to ProcedureTariff structure
type RoomTariff struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID uint  `gorm:"not null;index;uniqueIndex:idx_room_class" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`

	// Kelas Pasien
	PatientClass string `gorm:"not null;size:20;uniqueIndex:idx_room_class" json:"patient_class"` // non_kelas, kelas_3, kelas_2, kelas_1, vip, vvip

	// Komponen Tarif Per Hari
	Akomodasi    float64 `gorm:"type:decimal(15,2);default:0" json:"akomodasi"`    // Biaya akomodasi/kamar
	Makan        float64 `gorm:"type:decimal(15,2);default:0" json:"makan"`        // Biaya makan
	Perawatan    float64 `gorm:"type:decimal(15,2);default:0" json:"perawatan"`    // Biaya perawatan
	Administrasi float64 `gorm:"type:decimal(15,2);default:0" json:"administrasi"` // Biaya administrasi
	Lainnya      float64 `gorm:"type:decimal(15,2);default:0" json:"lainnya"`      // Biaya lainnya

	IsActive bool `gorm:"default:true" json:"is_active"`
}

// TableName sets the table name for RoomTariff
func (RoomTariff) TableName() string {
	return "room_tariffs"
}

// GetTotal returns the total tariff per day for this class (including administrasi)
func (rt *RoomTariff) GetTotal() float64 {
	return rt.Akomodasi + rt.Makan + rt.Perawatan + rt.Administrasi + rt.Lainnya
}

// GetTotalPerDay returns the tariff per day for inpatient (excluding administrasi)
// Administrasi is only charged once at registration, not per day
func (rt *RoomTariff) GetTotalPerDay() float64 {
	return rt.Akomodasi + rt.Makan + rt.Perawatan + rt.Lainnya
}

// RoomUnit represents a unit/chamber within a room (Kamar)
// Example: BIR ALI 1, BIR ALI 2, BIR ALI 3
type RoomUnit struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	RoomID    uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room_id"`
	Room      *Room          `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	Code      string         `gorm:"not null;size:30" json:"code"`  // e.g., "BIR ALI 1"
	Name      string         `gorm:"not null;size:100" json:"name"` // e.g., "Kamar 1"
	Floor     int            `gorm:"default:1" json:"floor"`        // lantai berapa
	Capacity  int            `gorm:"default:1" json:"capacity"`     // kapasitas bed di kamar ini
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	Notes     string         `gorm:"type:text" json:"notes"`
	Beds      []Bed          `gorm:"foreignKey:RoomUnitID" json:"beds,omitempty"`
}

// TableName sets the table name for RoomUnit
func (RoomUnit) TableName() string {
	return "room_units"
}

// Bed represents a bed within a room unit (Tempat Tidur)
type Bed struct {
	ID             uint           `gorm:"primarykey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	RoomUnitID     uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room_unit_id"`
	RoomUnit       *RoomUnit      `gorm:"foreignKey:RoomUnitID" json:"room_unit,omitempty"`
	BedNumber      string         `gorm:"not null;size:20" json:"bed_number"`        // e.g., "A", "B", "1", "2"
	BedType        string         `gorm:"size:50" json:"bed_type"`                   // bed_type from master data
	Status         string         `gorm:"size:50;default:'available'" json:"status"` // bed_status from master data
	Notes          string         `gorm:"type:text" json:"notes"`
	CurrentPatient *BedPatient    `gorm:"-" json:"current_patient,omitempty"` // Virtual field: patient currently occupying this bed
}

// BedPatient represents patient info for bed occupancy display
type BedPatient struct {
	Name                string     `json:"name"`
	MedicalRecordNumber string     `json:"medical_record_number"`
	NIK                 string     `json:"nik,omitempty"`
	Gender              string     `json:"gender,omitempty"`
	BirthDate           *time.Time `json:"birth_date,omitempty"`
	Age                 int        `json:"age,omitempty"`
	Address             string     `json:"address,omitempty"`
	Phone               string     `json:"phone,omitempty"`
	InsuranceType       string     `json:"insurance_type,omitempty"`
	InsuranceNumber     string     `json:"insurance_number,omitempty"`
	AdmissionDate       *time.Time `json:"admission_date,omitempty"`
	Diagnosis           string     `json:"diagnosis,omitempty"`
	DoctorName          string     `json:"doctor_name,omitempty"`
	RoomName            string     `json:"room_name,omitempty"`
	UnitName            string     `json:"unit_name,omitempty"`
	VisitID             uint       `json:"visit_id"`
	PatientID           uint       `json:"patient_id,omitempty"`
}

// TableName sets the table name for Bed
func (Bed) TableName() string {
	return "beds"
}

// RoomStaff represents additional staff assigned to a room
type RoomStaff struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	RoomID     uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room_id"`
	Room       *Room          `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	EmployeeID uint           `gorm:"not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"employee_id"`
	Employee   *Employee      `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
	RoleType   string         `gorm:"size:50" json:"role_type"`        // room_staff_role from master data
	IsPrimary  bool           `gorm:"default:false" json:"is_primary"` // primary staff for this room
	StartDate  *time.Time     `json:"start_date,omitempty"`
	EndDate    *time.Time     `json:"end_date,omitempty"`
	Notes      string         `gorm:"type:text" json:"notes"`
}

// TableName sets the table name for RoomStaff
func (RoomStaff) TableName() string {
	return "room_staff"
}

// ComputeBedStats computes the total and available beds for a room
func (r *Room) ComputeBedStats(db *gorm.DB) {
	var total, available int64

	// Get all units for this room and count beds
	db.Model(&Bed{}).
		Joins("JOIN room_units ON room_units.id = beds.room_unit_id").
		Where("room_units.room_id = ? AND room_units.deleted_at IS NULL AND beds.deleted_at IS NULL", r.ID).
		Count(&total)

	db.Model(&Bed{}).
		Joins("JOIN room_units ON room_units.id = beds.room_unit_id").
		Where("room_units.room_id = ? AND room_units.deleted_at IS NULL AND beds.deleted_at IS NULL AND beds.status = ?", r.ID, "available").
		Count(&available)

	r.TotalBeds = int(total)
	r.AvailableBeds = int(available)
}

// GetBedCount returns total bed count for a room unit
func (ru *RoomUnit) GetBedCount(db *gorm.DB) int64 {
	var count int64
	db.Model(&Bed{}).Where("room_unit_id = ?", ru.ID).Count(&count)
	return count
}
