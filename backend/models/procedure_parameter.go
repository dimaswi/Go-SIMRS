package models

import (
	"time"

	"gorm.io/gorm"
)

// ========================================
// PROCEDURE PARAMETER (Parameter Tindakan)
// Parameter yang di-assign ke tindakan berdasarkan jenisnya
// ========================================

// ProcedureParameter represents a parameter template for procedure results
// Digunakan untuk semua jenis tindakan: medis, radiologi, laboratorium
type ProcedureParameter struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	ProcedureID uint       `gorm:"not null;index" json:"procedure_id"`
	Procedure   *Procedure `gorm:"foreignKey:ProcedureID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`

	// Parameter Details
	Code        string `gorm:"not null;size:50" json:"code"`             // Kode parameter: klinis, kesan, hb, leukosit, catatan
	Name        string `gorm:"not null;size:100" json:"name"`            // Nama: Klinis, Kesan, Hemoglobin, Leukosit, Catatan
	Description string `gorm:"type:text" json:"description"`             // Deskripsi parameter
	InputType   string `gorm:"size:20;default:'text'" json:"input_type"` // text, textarea, number, select, checkbox
	Options     string `gorm:"type:text" json:"options"`                 // JSON array untuk select options

	// Lab-specific fields (untuk parameter laboratorium)
	Unit          string  `gorm:"size:50" json:"unit"`                              // Satuan: g/dL, /uL, mg/dL
	NormalMin     float64 `gorm:"type:decimal(15,4);default:0" json:"normal_min"`   // Nilai normal minimum
	NormalMax     float64 `gorm:"type:decimal(15,4);default:0" json:"normal_max"`   // Nilai normal maximum
	NormalText    string  `gorm:"size:100" json:"normal_text"`                      // Nilai normal teks: "Negatif", "Non-Reaktif"
	CriticalMin   float64 `gorm:"type:decimal(15,4);default:0" json:"critical_min"` // Nilai kritis minimum
	CriticalMax   float64 `gorm:"type:decimal(15,4);default:0" json:"critical_max"` // Nilai kritis maximum
	DecimalPlaces int     `gorm:"default:2" json:"decimal_places"`                  // Jumlah desimal

	// Display settings
	IsRequired bool `gorm:"default:false" json:"is_required"` // Wajib diisi
	SortOrder  int  `gorm:"default:0" json:"sort_order"`      // Urutan tampil
	IsActive   bool `gorm:"default:true" json:"is_active"`    // Status aktif
}

// TableName sets the table name
func (ProcedureParameter) TableName() string {
	return "procedure_parameters"
}

// ========================================
// PROCEDURE TYPE CONSTANTS
// ========================================

const (
	ProcedureTypeMedical      = "medical"      // Tindakan medis umum
	ProcedureTypeConsultation = "consultation" // Tindakan konsultasi
	ProcedureTypeRadiology    = "radiology"    // Tindakan radiologi
	ProcedureTypeLaboratory   = "laboratory"   // Tindakan laboratorium
)

// GetProcedureTypes returns all procedure types
func GetProcedureTypes() []map[string]string {
	return []map[string]string{
		{"code": ProcedureTypeMedical, "name": "Tindakan Medis"},
		{"code": ProcedureTypeConsultation, "name": "Konsultasi"},
		{"code": ProcedureTypeRadiology, "name": "Radiologi"},
		{"code": ProcedureTypeLaboratory, "name": "Laboratorium"},
	}
}

// ========================================
// DEFAULT PARAMETERS TEMPLATES
// ========================================

// GetDefaultMedicalParameters returns default parameters for medical procedures
func GetDefaultMedicalParameters() []map[string]interface{} {
	return []map[string]interface{}{
		{"code": "indikasi", "name": "Indikasi", "input_type": "textarea", "is_required": false, "sort_order": 1},
		{"code": "catatan_tindakan", "name": "Catatan Tindakan", "input_type": "textarea", "is_required": false, "sort_order": 2},
		{"code": "hasil", "name": "Hasil", "input_type": "textarea", "is_required": false, "sort_order": 3},
		{"code": "komplikasi", "name": "Komplikasi", "input_type": "textarea", "is_required": false, "sort_order": 4},
		{"code": "tindak_lanjut", "name": "Tindak Lanjut", "input_type": "textarea", "is_required": false, "sort_order": 5},
	}
}

// GetDefaultRadiologyParameters returns default parameters for radiology procedures
func GetDefaultRadiologyParameters() []map[string]interface{} {
	return []map[string]interface{}{
		{"code": "klinis", "name": "Klinis", "input_type": "textarea", "is_required": true, "sort_order": 1},
		{"code": "hasil_pemeriksaan", "name": "Hasil Pemeriksaan", "input_type": "textarea", "is_required": true, "sort_order": 2},
		{"code": "kesan", "name": "Kesan", "input_type": "textarea", "is_required": true, "sort_order": 3},
		{"code": "usul", "name": "Usul", "input_type": "textarea", "is_required": false, "sort_order": 4},
		{"code": "is_kritis", "name": "Nilai Kritis", "input_type": "checkbox", "is_required": false, "sort_order": 5},
		{"code": "catatan_kritis", "name": "Catatan Kritis", "input_type": "textarea", "is_required": false, "sort_order": 6},
	}
}

// GetDefaultLabParametersDL returns default parameters for Darah Lengkap (Complete Blood Count)
func GetDefaultLabParametersDL() []map[string]interface{} {
	return []map[string]interface{}{
		{"code": "hemoglobin", "name": "Hemoglobin (HB)", "input_type": "number", "unit": "g/dL", "normal_min": 12.0, "normal_max": 16.0, "critical_min": 7.0, "critical_max": 20.0, "decimal_places": 1, "is_required": true, "sort_order": 1},
		{"code": "leukosit", "name": "Leukosit", "input_type": "number", "unit": "/uL", "normal_min": 4000, "normal_max": 10000, "critical_min": 2000, "critical_max": 30000, "decimal_places": 0, "is_required": true, "sort_order": 2},
		{"code": "eritrosit", "name": "Eritrosit", "input_type": "number", "unit": "juta/uL", "normal_min": 4.0, "normal_max": 5.5, "critical_min": 2.0, "critical_max": 8.0, "decimal_places": 2, "is_required": true, "sort_order": 3},
		{"code": "hematokrit", "name": "Hematokrit", "input_type": "number", "unit": "%", "normal_min": 36, "normal_max": 48, "critical_min": 20, "critical_max": 60, "decimal_places": 1, "is_required": true, "sort_order": 4},
		{"code": "trombosit", "name": "Trombosit", "input_type": "number", "unit": "/uL", "normal_min": 150000, "normal_max": 400000, "critical_min": 50000, "critical_max": 1000000, "decimal_places": 0, "is_required": true, "sort_order": 5},
		{"code": "mcv", "name": "MCV", "input_type": "number", "unit": "fL", "normal_min": 80, "normal_max": 96, "decimal_places": 1, "is_required": false, "sort_order": 6},
		{"code": "mch", "name": "MCH", "input_type": "number", "unit": "pg", "normal_min": 27, "normal_max": 33, "decimal_places": 1, "is_required": false, "sort_order": 7},
		{"code": "mchc", "name": "MCHC", "input_type": "number", "unit": "g/dL", "normal_min": 32, "normal_max": 36, "decimal_places": 1, "is_required": false, "sort_order": 8},
	}
}

// GetDefaultLabParametersKimiaDarah returns parameters for blood chemistry
func GetDefaultLabParametersKimiaDarah() []map[string]interface{} {
	return []map[string]interface{}{
		{"code": "gula_darah_puasa", "name": "Gula Darah Puasa", "input_type": "number", "unit": "mg/dL", "normal_min": 70, "normal_max": 100, "critical_min": 40, "critical_max": 500, "decimal_places": 0, "is_required": false, "sort_order": 1},
		{"code": "gula_darah_2pp", "name": "Gula Darah 2 Jam PP", "input_type": "number", "unit": "mg/dL", "normal_min": 70, "normal_max": 140, "critical_min": 40, "critical_max": 500, "decimal_places": 0, "is_required": false, "sort_order": 2},
		{"code": "gula_darah_sewaktu", "name": "Gula Darah Sewaktu", "input_type": "number", "unit": "mg/dL", "normal_min": 70, "normal_max": 200, "critical_min": 40, "critical_max": 500, "decimal_places": 0, "is_required": false, "sort_order": 3},
		{"code": "ureum", "name": "Ureum", "input_type": "number", "unit": "mg/dL", "normal_min": 10, "normal_max": 50, "critical_max": 200, "decimal_places": 1, "is_required": false, "sort_order": 4},
		{"code": "creatinin", "name": "Creatinin", "input_type": "number", "unit": "mg/dL", "normal_min": 0.6, "normal_max": 1.2, "critical_max": 10, "decimal_places": 2, "is_required": false, "sort_order": 5},
		{"code": "sgot", "name": "SGOT", "input_type": "number", "unit": "U/L", "normal_min": 0, "normal_max": 40, "critical_max": 1000, "decimal_places": 0, "is_required": false, "sort_order": 6},
		{"code": "sgpt", "name": "SGPT", "input_type": "number", "unit": "U/L", "normal_min": 0, "normal_max": 41, "critical_max": 1000, "decimal_places": 0, "is_required": false, "sort_order": 7},
		{"code": "kolesterol_total", "name": "Kolesterol Total", "input_type": "number", "unit": "mg/dL", "normal_min": 0, "normal_max": 200, "decimal_places": 0, "is_required": false, "sort_order": 8},
		{"code": "trigliserida", "name": "Trigliserida", "input_type": "number", "unit": "mg/dL", "normal_min": 0, "normal_max": 150, "decimal_places": 0, "is_required": false, "sort_order": 9},
		{"code": "asam_urat", "name": "Asam Urat", "input_type": "number", "unit": "mg/dL", "normal_min": 2.4, "normal_max": 7.0, "decimal_places": 1, "is_required": false, "sort_order": 10},
	}
}

// ========================================
// INPUT TYPE CONSTANTS
// ========================================

const (
	InputTypeText     = "text"
	InputTypeTextarea = "textarea"
	InputTypeNumber   = "number"
	InputTypeSelect   = "select"
	InputTypeCheckbox = "checkbox"
	InputTypeDate     = "date"
	InputTypeTime     = "time"
)

// GetInputTypes returns all input types
func GetInputTypes() []map[string]string {
	return []map[string]string{
		{"code": InputTypeText, "name": "Teks"},
		{"code": InputTypeTextarea, "name": "Teks Panjang"},
		{"code": InputTypeNumber, "name": "Angka"},
		{"code": InputTypeSelect, "name": "Pilihan"},
		{"code": InputTypeCheckbox, "name": "Checkbox"},
		{"code": InputTypeDate, "name": "Tanggal"},
		{"code": InputTypeTime, "name": "Waktu"},
	}
}
