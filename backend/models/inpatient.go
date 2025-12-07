package models

import (
	"time"

	"gorm.io/gorm"
)

// ===========================================================================
// CPPT - Catatan Perkembangan Pasien Terintegrasi
// Integrated Patient Progress Notes (for Inpatient)
// ===========================================================================

// CPPT represents integrated progress notes for inpatient care
// Format SOAP (Subjective, Objective, Assessment, Plan)
type CPPT struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Record Date/Time - Waktu pencatatan (bisa berbeda dari created_at)
	RecordDate time.Time `gorm:"not null" json:"record_date"`

	// Profession/Role of the recorder
	Profession string `gorm:"size:50;not null" json:"profession"` // dokter, perawat, bidan, gizi, farmasi, dll

	// SOAP Format
	Subjective string `gorm:"type:text" json:"subjective,omitempty"` // Keluhan/apa yang dirasakan pasien
	Objective  string `gorm:"type:text" json:"objective,omitempty"`  // Hasil pemeriksaan fisik, vital sign, lab, dll
	Assessment string `gorm:"type:text" json:"assessment,omitempty"` // Diagnosis/masalah keperawatan
	Plan       string `gorm:"type:text" json:"plan,omitempty"`       // Rencana tindakan/terapi

	// Instruction - Instruksi khusus
	Instruction string `gorm:"type:text" json:"instruction,omitempty"`

	// Vital Signs (Optional - bisa diisi di sini atau di ObjectiveF)
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`      // mmHg
	HeartRate        int    `gorm:"default:0" json:"heart_rate,omitempty"`        // x/menit
	RespiratoryRate  int    `gorm:"default:0" json:"respiratory_rate,omitempty"`  // x/menit
	Temperature      string `gorm:"size:20" json:"temperature,omitempty"`         // °C
	OxygenSaturation int    `gorm:"default:0" json:"oxygen_saturation,omitempty"` // %
	PainScale        int    `gorm:"default:0" json:"pain_scale,omitempty"`        // 0-10

	// Verification
	IsVerified   bool       `gorm:"default:false" json:"is_verified"`
	VerifiedByID *uint      `gorm:"index" json:"verified_by_id,omitempty"`
	VerifiedBy   *User      `gorm:"foreignKey:VerifiedByID" json:"verified_by,omitempty"`
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (CPPT) TableName() string {
	return "cppts"
}

// CPPT Profession constants
const (
	CPPTProfessionDoctor    = "dokter"
	CPPTProfessionNurse     = "perawat"
	CPPTProfessionMidwife   = "bidan"
	CPPTProfessionNutrition = "gizi"
	CPPTProfessionPharmacy  = "farmasi"
	CPPTProfessionPhysio    = "fisioterapi"
	CPPTProfessionOther     = "lainnya"
)

// ===========================================================================
// BALANCE CAIRAN - Fluid Balance Chart
// Pencatatan intake dan output cairan pasien rawat inap
// ===========================================================================

// FluidBalance represents fluid intake and output record
type FluidBalance struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Record Period
	RecordDate time.Time `gorm:"not null;index" json:"record_date"`  // Tanggal pencatatan
	ShiftType  string    `gorm:"size:20;not null" json:"shift_type"` // pagi, siang, malam / shift1, shift2, shift3

	// ==================== INTAKE (Masukan) ====================
	// Oral
	OralDrink    float64 `gorm:"type:decimal(10,2);default:0" json:"oral_drink"`    // Minum (ml)
	OralFood     float64 `gorm:"type:decimal(10,2);default:0" json:"oral_food"`     // Air dari makanan (ml)
	OralMedicine float64 `gorm:"type:decimal(10,2);default:0" json:"oral_medicine"` // Obat oral (ml)

	// Parenteral (IV)
	IVFluid      float64 `gorm:"type:decimal(10,2);default:0" json:"iv_fluid"`      // Cairan infus (ml)
	IVMedicine   float64 `gorm:"type:decimal(10,2);default:0" json:"iv_medicine"`   // Obat IV (ml)
	BloodProduct float64 `gorm:"type:decimal(10,2);default:0" json:"blood_product"` // Produk darah (ml)

	// Enteral (NGT/OGT)
	EnteralFeed float64 `gorm:"type:decimal(10,2);default:0" json:"enteral_feed"` // Feeding tube (ml)

	// Other Intake
	OtherIntake     float64 `gorm:"type:decimal(10,2);default:0" json:"other_intake"` // Intake lainnya (ml)
	OtherIntakeNote string  `gorm:"size:255" json:"other_intake_note,omitempty"`      // Keterangan intake lain

	// ==================== OUTPUT (Keluaran) ====================
	// Urine
	UrineAmount   float64 `gorm:"type:decimal(10,2);default:0" json:"urine_amount"` // Urine (ml)
	UrineColor    string  `gorm:"size:50" json:"urine_color,omitempty"`             // Warna urine
	UrineCatheter bool    `gorm:"default:false" json:"urine_catheter"`              // Menggunakan kateter?

	// Feces/BAB
	FecesAmount float64 `gorm:"type:decimal(10,2);default:0" json:"feces_amount"` // BAB (ml/gram)
	FecesFreq   int     `gorm:"default:0" json:"feces_freq"`                      // Frekuensi BAB
	FecesType   string  `gorm:"size:50" json:"feces_type,omitempty"`              // Konsistensi (cair/padat/dll)

	// Vomit
	VomitAmount float64 `gorm:"type:decimal(10,2);default:0" json:"vomit_amount"` // Muntah (ml)
	VomitFreq   int     `gorm:"default:0" json:"vomit_freq"`                      // Frekuensi muntah

	// Drainage
	DrainAmount float64 `gorm:"type:decimal(10,2);default:0" json:"drain_amount"` // Drain/selang (ml)
	DrainType   string  `gorm:"size:100" json:"drain_type,omitempty"`             // Jenis drain (WSD, NGT, dll)
	DrainColor  string  `gorm:"size:50" json:"drain_color,omitempty"`             // Warna cairan drain

	// Blood Loss
	BloodLoss     float64 `gorm:"type:decimal(10,2);default:0" json:"blood_loss"` // Perdarahan (ml)
	BloodLossNote string  `gorm:"size:255" json:"blood_loss_note,omitempty"`      // Keterangan perdarahan

	// Insensible Water Loss (IWL)
	IWL float64 `gorm:"type:decimal(10,2);default:0" json:"iwl"` // IWL (ml) - biasanya dihitung

	// Other Output
	OtherOutput     float64 `gorm:"type:decimal(10,2);default:0" json:"other_output"` // Output lainnya (ml)
	OtherOutputNote string  `gorm:"size:255" json:"other_output_note,omitempty"`      // Keterangan output lain

	// ==================== CALCULATED FIELDS ====================
	TotalIntake float64 `gorm:"type:decimal(10,2);default:0" json:"total_intake"` // Total masukan (ml)
	TotalOutput float64 `gorm:"type:decimal(10,2);default:0" json:"total_output"` // Total keluaran (ml)
	Balance     float64 `gorm:"type:decimal(10,2);default:0" json:"balance"`      // Selisih intake - output

	// Notes
	Notes string `gorm:"type:text" json:"notes,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (FluidBalance) TableName() string {
	return "fluid_balances"
}

// CalculateTotals calculates total intake, output, and balance
func (fb *FluidBalance) CalculateTotals() {
	fb.TotalIntake = fb.OralDrink + fb.OralFood + fb.OralMedicine +
		fb.IVFluid + fb.IVMedicine + fb.BloodProduct +
		fb.EnteralFeed + fb.OtherIntake

	fb.TotalOutput = fb.UrineAmount + fb.FecesAmount + fb.VomitAmount +
		fb.DrainAmount + fb.BloodLoss + fb.IWL + fb.OtherOutput

	fb.Balance = fb.TotalIntake - fb.TotalOutput
}

// Shift type constants
const (
	ShiftTypeMorning   = "pagi"  // 07:00 - 14:00
	ShiftTypeAfternoon = "siang" // 14:00 - 21:00
	ShiftTypeNight     = "malam" // 21:00 - 07:00
)
