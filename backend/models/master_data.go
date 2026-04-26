package models

import (
	"time"

	"gorm.io/gorm"
)

// MasterDataCategory represents the category of master data
type MasterDataCategory string

const (
	CategoryEmployeeType     MasterDataCategory = "employee_type"
	CategoryEmploymentStatus MasterDataCategory = "employment_status"
	CategoryReligion         MasterDataCategory = "religion"
	CategoryMaritalStatus    MasterDataCategory = "marital_status"
	CategoryEducationLevel   MasterDataCategory = "education_level"
	CategoryGender           MasterDataCategory = "gender"
	CategoryBloodType        MasterDataCategory = "blood_type"
	CategoryRhesusType       MasterDataCategory = "rhesus_type"
	CategoryInsuranceType    MasterDataCategory = "insurance_type"
	CategoryInsuranceCompany MasterDataCategory = "insurance_company" // Daftar Perusahaan Asuransi
	CategoryBPJSClass        MasterDataCategory = "bpjs_class"
	CategoryRelationship     MasterDataCategory = "relationship"
	CategoryDepartment       MasterDataCategory = "department"
	CategoryPosition         MasterDataCategory = "position"
	CategorySpecialization   MasterDataCategory = "specialization"
	CategoryBank             MasterDataCategory = "bank"
	CategoryOccupation       MasterDataCategory = "occupation" // Pekerjaan
	// Room Management Categories
	CategoryServiceType   MasterDataCategory = "service_type"
	CategoryRoomType      MasterDataCategory = "room_type"
	CategoryRoomClass     MasterDataCategory = "room_class"
	CategoryBedType       MasterDataCategory = "bed_type"
	CategoryBedStatus     MasterDataCategory = "bed_status"
	CategoryRoomStaffRole MasterDataCategory = "room_staff_role"
	// Procedure Management Categories
	CategoryProcedureType        MasterDataCategory = "procedure_type"         // Jenis Tindakan (medical, radiology, laboratory)
	CategoryProcedureServiceType MasterDataCategory = "procedure_service_type" // Jenis Layanan Tindakan
	CategoryProcedureGroup       MasterDataCategory = "procedure_group"        // Kelompok Tindakan
	CategoryProcedureSpecialty   MasterDataCategory = "procedure_specialty"    // Spesialisasi Tindakan
	CategoryPatientClass         MasterDataCategory = "patient_class"          // Kelas Pasien untuk Tarif
	CategoryAnesthesiaType       MasterDataCategory = "anesthesia_type"        // Jenis Anestesi
	// Inventory Management Categories
	CategoryInventoryCategory  MasterDataCategory = "inventory_category"  // Kategori Inventaris
	CategoryInventoryCondition MasterDataCategory = "inventory_condition" // Kondisi Inventaris
	CategoryInventoryStatus    MasterDataCategory = "inventory_status"    // Status Inventaris
	CategoryInventoryUnit      MasterDataCategory = "inventory_unit"      // Satuan Inventaris
	// Medicine/Pharmacy Categories
	CategoryMedicineCategory MasterDataCategory = "medicine_category" // Kategori Obat
	CategoryMedicineType     MasterDataCategory = "medicine_type"     // Jenis/Golongan Obat
	CategoryMedicineForm     MasterDataCategory = "medicine_form"     // Bentuk Sediaan Obat
	CategoryMedicineUnit     MasterDataCategory = "medicine_unit"     // Satuan Obat

	// Medical Record Categories (SATUSEHAT Compliant)
	CategoryArrivalMode        MasterDataCategory = "arrival_mode"         // Moda Kedatangan
	CategoryTriageLevel        MasterDataCategory = "triage_level"         // Level Triase (ESI)
	CategoryGeneralCondition   MasterDataCategory = "general_condition"    // Keadaan Umum
	CategoryConsciousnessLevel MasterDataCategory = "consciousness_level"  // Tingkat Kesadaran
	CategoryAirwayStatus       MasterDataCategory = "airway_status"        // Status Jalan Napas
	CategoryBreathingStatus    MasterDataCategory = "breathing_status"     // Status Pernapasan
	CategoryCirculationStatus  MasterDataCategory = "circulation_status"   // Status Sirkulasi
	CategoryAkralStatus        MasterDataCategory = "akral_status"         // Status Akral
	CategoryCRTStatus          MasterDataCategory = "crt_status"           // Capillary Refill Time
	CategoryPupilStatus        MasterDataCategory = "pupil_status"         // Status Pupil
	CategoryClinicalStatus     MasterDataCategory = "clinical_status"      // Status Klinis Diagnosis (FHIR)
	CategoryVerificationStatus MasterDataCategory = "verification_status"  // Status Verifikasi Diagnosis (FHIR)
	CategorySeverityLevel      MasterDataCategory = "severity_level"       // Tingkat Keparahan
	CategoryDispositionType    MasterDataCategory = "disposition_type"     // Jenis Disposisi/Pemulangan
	CategoryDischargeStatus    MasterDataCategory = "discharge_status"     // Status Keluar Pasien
	CategoryDischargeCondition MasterDataCategory = "discharge_condition"  // Kondisi Keluar Pasien
	CategoryBodyMarkerCategory MasterDataCategory = "body_marker_category" // Kategori Gambar Marker Tubuh
	CategoryBodyMarkerImage    MasterDataCategory = "body_marker_image"    // Master Gambar Marker Tubuh
)

// MasterData represents a master data entry
type MasterData struct {
	ID          uint               `json:"id" gorm:"primaryKey"`
	Category    MasterDataCategory `json:"category" gorm:"type:varchar(50);not null;index:idx_master_category"`
	Code        string             `json:"code" gorm:"type:varchar(50);not null;index:idx_master_code"`
	Name        string             `json:"name" gorm:"type:varchar(100);not null"`
	Description string             `json:"description" gorm:"type:text"`
	SortOrder   int                `json:"sort_order" gorm:"default:0"`
	IsActive    bool               `json:"is_active" gorm:"default:true"`
	IsDefault   bool               `json:"is_default" gorm:"default:false"`
	ParentID    *uint              `json:"parent_id" gorm:"index"`
	Parent      *MasterData        `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Metadata    string             `json:"metadata" gorm:"type:text"` // JSON string for additional data
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	DeletedAt   gorm.DeletedAt     `json:"-" gorm:"index"`
}

// TableName specifies the table name for MasterData
func (MasterData) TableName() string {
	return "master_data"
}

// GetCategoryLabel returns the Indonesian label for a category
func GetCategoryLabel(category MasterDataCategory) string {
	labels := map[MasterDataCategory]string{
		CategoryEmployeeType:     "Tipe Karyawan",
		CategoryEmploymentStatus: "Status Kepegawaian",
		CategoryReligion:         "Agama",
		CategoryMaritalStatus:    "Status Perkawinan",
		CategoryEducationLevel:   "Tingkat Pendidikan",
		CategoryGender:           "Jenis Kelamin",
		CategoryBloodType:        "Golongan Darah",
		CategoryRhesusType:       "Rhesus",
		CategoryInsuranceType:    "Jenis Jaminan",
		CategoryInsuranceCompany: "Perusahaan Asuransi",
		CategoryBPJSClass:        "Kelas BPJS",
		CategoryRelationship:     "Hubungan Keluarga",
		CategoryDepartment:       "Departemen",
		CategoryPosition:         "Jabatan",
		CategorySpecialization:   "Spesialisasi",
		CategoryBank:             "Bank",
		CategoryOccupation:       "Pekerjaan",
		// Room Management
		CategoryServiceType:   "Jenis Layanan",
		CategoryRoomType:      "Tipe Ruangan",
		CategoryRoomClass:     "Kelas Ruangan",
		CategoryBedType:       "Tipe Tempat Tidur",
		CategoryBedStatus:     "Status Tempat Tidur",
		CategoryRoomStaffRole: "Peran Staff Ruangan",
		// Procedure Management
		CategoryProcedureServiceType: "Jenis Layanan Tindakan",
		CategoryProcedureGroup:       "Kelompok Tindakan",
		CategoryProcedureSpecialty:   "Spesialisasi Tindakan",
		CategoryPatientClass:         "Kelas Pasien",
		CategoryAnesthesiaType:       "Jenis Anestesi",
		// Medical Record
		CategoryArrivalMode:        "Moda Kedatangan",
		CategoryTriageLevel:        "Level Triase",
		CategoryGeneralCondition:   "Keadaan Umum",
		CategoryConsciousnessLevel: "Tingkat Kesadaran",
		CategoryAirwayStatus:       "Status Jalan Napas",
		CategoryBreathingStatus:    "Status Pernapasan",
		CategoryCirculationStatus:  "Status Sirkulasi",
		CategoryAkralStatus:        "Status Akral",
		CategoryCRTStatus:          "Capillary Refill Time",
		CategoryPupilStatus:        "Status Pupil",
		CategoryClinicalStatus:     "Status Klinis Diagnosis",
		CategoryVerificationStatus: "Status Verifikasi Diagnosis",
		CategorySeverityLevel:      "Tingkat Keparahan",
		CategoryDispositionType:    "Jenis Disposisi",
		CategoryDischargeStatus:    "Status Keluar",
		CategoryDischargeCondition: "Kondisi Keluar",
		CategoryBodyMarkerCategory: "Kategori Marker Tubuh",
		CategoryBodyMarkerImage:    "Gambar Marker Tubuh",
	}
	if label, ok := labels[category]; ok {
		return label
	}
	return string(category)
}

// GetCategoryDescription returns the description for a category
func GetCategoryDescription(category MasterDataCategory) string {
	descriptions := map[MasterDataCategory]string{
		CategoryEmployeeType:     "Klasifikasi tipe karyawan (dokter, perawat, dll)",
		CategoryEmploymentStatus: "Status kepegawaian (PNS, kontrak, dll)",
		CategoryReligion:         "Data agama yang diakui",
		CategoryMaritalStatus:    "Status perkawinan",
		CategoryEducationLevel:   "Tingkat pendidikan formal",
		CategoryGender:           "Jenis kelamin",
		CategoryBloodType:        "Golongan darah",
		CategoryRhesusType:       "Rhesus darah (Positif/Negatif)",
		CategoryInsuranceType:    "Jenis jaminan kesehatan (Umum, BPJS, Asuransi)",
		CategoryBPJSClass:        "Kelas BPJS Kesehatan (I, II, III)",
		CategoryRelationship:     "Hubungan keluarga untuk kontak darurat",
		CategoryDepartment:       "Departemen/unit kerja di rumah sakit",
		CategoryPosition:         "Jabatan struktural dan fungsional",
		CategorySpecialization:   "Spesialisasi medis",
		CategoryBank:             "Daftar bank untuk data rekening",
		CategoryOccupation:       "Pekerjaan pasien",
		// Room Management
		CategoryServiceType:   "Jenis layanan ruangan (rawat jalan, rawat inap, penunjang, administrasi)",
		CategoryRoomType:      "Tipe ruangan (poliklinik, rawat inap, laboratorium, dll)",
		CategoryRoomClass:     "Kelas ruangan (VIP, I, II, III)",
		CategoryBedType:       "Tipe tempat tidur",
		CategoryBedStatus:     "Status tempat tidur (tersedia, terisi, maintenance)",
		CategoryRoomStaffRole: "Peran staff dalam ruangan (kepala ruangan, perawat jaga, dll)",
		// Procedure Management
		CategoryProcedureServiceType: "Jenis layanan tindakan (rawat jalan, rawat inap, penunjang)",
		CategoryProcedureGroup:       "Kelompok tindakan medis (bedah, non-bedah, diagnostik, dll)",
		CategoryProcedureSpecialty:   "Spesialisasi medis untuk tindakan",
		CategoryPatientClass:         "Kelas pasien untuk penentuan tarif tindakan",
		CategoryAnesthesiaType:       "Jenis anestesi untuk tindakan",
		// Medical Record
		CategoryArrivalMode:        "Cara kedatangan pasien ke UGD (ambulans, kendaraan pribadi, dll)",
		CategoryGeneralCondition:   "Keadaan umum pasien (Baik, Sedang, Lemah, Buruk)",
		CategoryTriageLevel:        "Level triase berdasarkan ESI (Emergency Severity Index)",
		CategoryConsciousnessLevel: "Tingkat kesadaran pasien (Composmentis, Apatis, Somnolen, dll)",
		CategoryAirwayStatus:       "Status jalan napas pasien (bebas, tersumbat, dll)",
		CategoryBreathingStatus:    "Status pernapasan pasien (spontan, sesak, dll)",
		CategoryCirculationStatus:  "Status sirkulasi/peredaran darah pasien",
		CategoryAkralStatus:        "Status akral/ujung jari pasien (hangat, dingin, dll)",
		CategoryCRTStatus:          "Capillary Refill Time / waktu pengisian kapiler",
		CategoryPupilStatus:        "Status pupil mata pasien (isokor, miosis, midriasis)",
		CategoryClinicalStatus:     "Status klinis diagnosis sesuai FHIR/SATUSEHAT",
		CategoryVerificationStatus: "Status verifikasi diagnosis sesuai FHIR/SATUSEHAT",
		CategorySeverityLevel:      "Tingkat keparahan kondisi/diagnosis",
		CategoryDispositionType:    "Jenis pemulangan pasien (pulang, rawat inap, rujuk, dll)",
		CategoryDischargeStatus:    "Status keluar pasien dari pelayanan kesehatan",
		CategoryDischargeCondition: "Kondisi fisik/medis pasien saat keluar",
		CategoryBodyMarkerCategory: "Kategori kelompok gambar untuk marker tubuh (misalnya anterior, posterior, pediatrik)",
		CategoryBodyMarkerImage:    "Master gambar anatomi tubuh yang dipilih pada tab marker rekam medis",
	}
	if desc, ok := descriptions[category]; ok {
		return desc
	}
	return ""
}

// GetAllCategories returns all available categories (deprecated, use GetAllCategoriesInfo)
func GetAllCategories() []map[string]string {
	categories := []MasterDataCategory{
		CategoryEmployeeType,
		CategoryEmploymentStatus,
		CategoryReligion,
		CategoryMaritalStatus,
		CategoryEducationLevel,
		CategoryGender,
		CategoryBloodType,
		CategoryRelationship,
		CategoryDepartment,
		CategoryPosition,
		CategorySpecialization,
		CategoryBank,
		// Room Management
		CategoryRoomType,
		CategoryRoomClass,
		CategoryBedType,
		CategoryBedStatus,
		CategoryRoomStaffRole,
		// Procedure Management
		CategoryProcedureServiceType,
		CategoryProcedureGroup,
		CategoryProcedureSpecialty,
		CategoryPatientClass,
		CategoryAnesthesiaType,
		// Medical Record
		CategoryArrivalMode,
		CategoryGeneralCondition,
		CategoryTriageLevel,
		CategoryConsciousnessLevel,
		CategoryAirwayStatus,
		CategoryBreathingStatus,
		CategoryCirculationStatus,
		CategoryAkralStatus,
		CategoryCRTStatus,
		CategoryPupilStatus,
		CategoryClinicalStatus,
		CategoryVerificationStatus,
		CategorySeverityLevel,
		CategoryDispositionType,
		CategoryBodyMarkerCategory,
		CategoryBodyMarkerImage,
	}

	result := make([]map[string]string, len(categories))
	for i, cat := range categories {
		result[i] = map[string]string{
			"code":  string(cat),
			"label": GetCategoryLabel(cat),
		}
	}
	return result
}

// GetAllCategoriesInfo returns all available categories with name and description
func GetAllCategoriesInfo() []map[string]string {
	categories := []MasterDataCategory{
		CategoryGender,
		CategoryReligion,
		CategoryMaritalStatus,
		CategoryEducationLevel,
		CategoryEmployeeType,
		CategoryEmploymentStatus,
		CategoryBloodType,
		CategoryRelationship,
		CategoryBank,
		CategoryDepartment,
		CategoryPosition,
		CategorySpecialization,
		// Room Management
		CategoryRoomType,
		CategoryRoomClass,
		CategoryBedType,
		CategoryBedStatus,
		CategoryRoomStaffRole,
		// Procedure Management
		CategoryProcedureServiceType,
		CategoryProcedureGroup,
		CategoryProcedureSpecialty,
		CategoryPatientClass,
		CategoryAnesthesiaType,
		// Medical Record
		CategoryGeneralCondition,
		CategoryArrivalMode,
		CategoryTriageLevel,
		CategoryConsciousnessLevel,
		CategoryAirwayStatus,
		CategoryBreathingStatus,
		CategoryCirculationStatus,
		CategoryAkralStatus,
		CategoryCRTStatus,
		CategoryPupilStatus,
		CategoryClinicalStatus,
		CategoryVerificationStatus,
		CategorySeverityLevel,
		CategoryDispositionType,
		CategoryBodyMarkerCategory,
		CategoryBodyMarkerImage,
	}

	result := make([]map[string]string, len(categories))
	for i, cat := range categories {
		result[i] = map[string]string{
			"code":        string(cat),
			"name":        GetCategoryLabel(cat),
			"description": GetCategoryDescription(cat),
		}
	}
	return result
}
