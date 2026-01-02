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

// ===========================================================================
// NURSING CARE - Asuhan Keperawatan
// Dokumentasi asuhan keperawatan berdasarkan SDKI-SLKI-SIKI
// ===========================================================================

// NursingCare represents nursing care documentation
// Menggunakan standar SDKI (Standar Diagnosis Keperawatan Indonesia),
// SLKI (Standar Luaran Keperawatan Indonesia),
// SIKI (Standar Intervensi Keperawatan Indonesia)
type NursingCare struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"` // Multiple entries per visit
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Record Date/Time
	RecordDate time.Time `gorm:"not null" json:"record_date"`
	ShiftType  string    `gorm:"size:20" json:"shift_type,omitempty"` // pagi, siang, malam

	// ==================== PENGKAJIAN (Assessment) ====================
	// Keluhan & Status
	ChiefComplaint      string `gorm:"type:text" json:"chief_complaint,omitempty"`      // Keluhan utama
	PainAssessment      string `gorm:"type:text" json:"pain_assessment,omitempty"`      // Pengkajian nyeri (lokasi, skala, karakteristik)
	PainScale           int    `gorm:"default:0" json:"pain_scale,omitempty"`           // Skala nyeri 0-10
	ConsciousnessLevel  string `gorm:"size:50" json:"consciousness_level,omitempty"`    // Tingkat kesadaran (CM, Apatis, Somnolen, dll)
	FunctionalStatus    string `gorm:"size:50" json:"functional_status,omitempty"`      // Mandiri, Partial, Total
	FallRiskAssessment  string `gorm:"type:text" json:"fall_risk_assessment,omitempty"` // Pengkajian risiko jatuh
	FallRiskScore       int    `gorm:"default:0" json:"fall_risk_score,omitempty"`      // Skor risiko jatuh
	NutritionAssessment string `gorm:"type:text" json:"nutrition_assessment,omitempty"` // Pengkajian nutrisi
	SkinAssessment      string `gorm:"type:text" json:"skin_assessment,omitempty"`      // Pengkajian kulit/integritas kulit
	PressureUlcerRisk   string `gorm:"size:50" json:"pressure_ulcer_risk,omitempty"`    // Risiko luka tekan (rendah/sedang/tinggi)

	// Vital Signs at Assessment
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`      // mmHg
	HeartRate        int    `gorm:"default:0" json:"heart_rate,omitempty"`        // x/menit
	RespiratoryRate  int    `gorm:"default:0" json:"respiratory_rate,omitempty"`  // x/menit
	Temperature      string `gorm:"size:20" json:"temperature,omitempty"`         // °C
	OxygenSaturation int    `gorm:"default:0" json:"oxygen_saturation,omitempty"` // %

	// ==================== DIAGNOSIS KEPERAWATAN (SDKI) ====================
	NursingDiagnosis     string `gorm:"type:text" json:"nursing_diagnosis,omitempty"`    // Diagnosis keperawatan (kode & deskripsi SDKI)
	NursingDiagnosisCode string `gorm:"size:20" json:"nursing_diagnosis_code,omitempty"` // Kode SDKI (contoh: D.0001)
	ProblemEtiology      string `gorm:"type:text" json:"problem_etiology,omitempty"`     // Etiologi/penyebab masalah
	SignsSymptoms        string `gorm:"type:text" json:"signs_symptoms,omitempty"`       // Tanda & gejala (batasan karakteristik)

	// ==================== LUARAN KEPERAWATAN (SLKI) ====================
	NursingOutcome     string `gorm:"type:text" json:"nursing_outcome,omitempty"`    // Target/luaran yang diharapkan
	NursingOutcomeCode string `gorm:"size:20" json:"nursing_outcome_code,omitempty"` // Kode SLKI (contoh: L.01001)
	OutcomeIndicators  string `gorm:"type:text" json:"outcome_indicators,omitempty"` // Indikator luaran
	OutcomeTarget      string `gorm:"size:50" json:"outcome_target,omitempty"`       // Target pencapaian (meningkat/menurun/membaik)

	// ==================== INTERVENSI KEPERAWATAN (SIKI) ====================
	NursingIntervention     string `gorm:"type:text" json:"nursing_intervention,omitempty"`    // Intervensi keperawatan
	NursingInterventionCode string `gorm:"size:20" json:"nursing_intervention_code,omitempty"` // Kode SIKI (contoh: I.01001)
	ObservationActions      string `gorm:"type:text" json:"observation_actions,omitempty"`     // Tindakan observasi
	TherapeuticActions      string `gorm:"type:text" json:"therapeutic_actions,omitempty"`     // Tindakan terapeutik
	EducationActions        string `gorm:"type:text" json:"education_actions,omitempty"`       // Tindakan edukasi
	CollaborationActions    string `gorm:"type:text" json:"collaboration_actions,omitempty"`   // Tindakan kolaborasi

	// ==================== IMPLEMENTASI ====================
	Implementation     string    `gorm:"type:text" json:"implementation,omitempty"`   // Tindakan yang dilakukan
	ImplementationTime time.Time `json:"implementation_time,omitempty"`               // Waktu implementasi
	PatientResponse    string    `gorm:"type:text" json:"patient_response,omitempty"` // Respon pasien terhadap tindakan

	// ==================== EVALUASI (SOAP) ====================
	EvaluationSubjective string `gorm:"type:text" json:"evaluation_subjective,omitempty"` // S - Keluhan pasien setelah tindakan
	EvaluationObjective  string `gorm:"type:text" json:"evaluation_objective,omitempty"`  // O - Hasil observasi/pemeriksaan
	EvaluationAnalysis   string `gorm:"type:text" json:"evaluation_analysis,omitempty"`   // A - Analisis masalah (teratasi/belum/sebagian)
	EvaluationPlanning   string `gorm:"type:text" json:"evaluation_planning,omitempty"`   // P - Rencana tindak lanjut
	ProblemStatus        string `gorm:"size:30" json:"problem_status,omitempty"`          // teratasi, teratasi_sebagian, belum_teratasi

	// Additional Notes
	Notes string `gorm:"type:text" json:"notes,omitempty"` // Catatan tambahan

	// Verification
	IsVerified   bool       `gorm:"default:false" json:"is_verified"`
	VerifiedByID *uint      `gorm:"index" json:"verified_by_id,omitempty"`
	VerifiedBy   *User      `gorm:"foreignKey:VerifiedByID" json:"verified_by,omitempty"`
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (NursingCare) TableName() string {
	return "nursing_cares"
}

// Problem status constants
const (
	ProblemStatusResolved        = "teratasi"
	ProblemStatusPartialResolved = "teratasi_sebagian"
	ProblemStatusUnresolved      = "belum_teratasi"
)

// ===========================================================================
// BED TRANSFER - Mutasi Pasien (Pindah Kamar/Bed)
// ===========================================================================

// BedTransfer represents a patient bed transfer/mutation record
type BedTransfer struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Source (From) - nullable for initial placement
	FromRoomID uint  `gorm:"index" json:"from_room_id"`
	FromRoom   *Room `gorm:"foreignKey:FromRoomID" json:"from_room,omitempty"`
	FromBedID  *uint `gorm:"index" json:"from_bed_id,omitempty"`
	FromBed    *Bed  `gorm:"foreignKey:FromBedID" json:"from_bed,omitempty"`

	// Destination (To)
	ToRoomID uint  `gorm:"not null;index" json:"to_room_id"`
	ToRoom   *Room `gorm:"foreignKey:ToRoomID" json:"to_room,omitempty"`
	ToBedID  uint  `gorm:"not null;index" json:"to_bed_id"`
	ToBed    *Bed  `gorm:"foreignKey:ToBedID" json:"to_bed,omitempty"`

	// Transfer Details
	TransferDate   time.Time `gorm:"not null" json:"transfer_date"`
	TransferReason string    `gorm:"type:text" json:"transfer_reason"` // Alasan pindah kamar
	TransferType   string    `gorm:"size:30" json:"transfer_type"`     // upgrade, downgrade, medical, request, other

	// Old and New Inpatient Class (for billing adjustment)
	OldInpatientClass string `gorm:"size:20" json:"old_inpatient_class,omitempty"`
	NewInpatientClass string `gorm:"size:20" json:"new_inpatient_class,omitempty"`

	Notes string `gorm:"type:text" json:"notes,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (BedTransfer) TableName() string {
	return "bed_transfers"
}

// Transfer type constants
const (
	TransferTypeUpgrade   = "upgrade"   // Naik kelas
	TransferTypeDowngrade = "downgrade" // Turun kelas
	TransferTypeMedical   = "medical"   // Kebutuhan medis
	TransferTypeRequest   = "request"   // Permintaan pasien
	TransferTypeOther     = "other"     // Lainnya
)

// ===========================================================================
// ADMISSION REQUEST - Permintaan Rawat Inap
// Request dari dokter/perawat untuk memasukkan pasien ke rawat inap
// Diproses oleh bagian Pendaftaran/Admisi
// ===========================================================================

// AdmissionRequestStatus represents the status of admission request
type AdmissionRequestStatus string

const (
	AdmissionRequestStatusPending   AdmissionRequestStatus = "pending"   // Menunggu diproses
	AdmissionRequestStatusApproved  AdmissionRequestStatus = "approved"  // Disetujui dan diproses
	AdmissionRequestStatusRejected  AdmissionRequestStatus = "rejected"  // Ditolak
	AdmissionRequestStatusCancelled AdmissionRequestStatus = "cancelled" // Dibatalkan
)

// AdmissionRequest represents a request to admit patient to inpatient
type AdmissionRequest struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Request Number - auto generated
	RequestNumber string `gorm:"size:50;uniqueIndex;not null" json:"request_number"`

	// Source Visit - kunjungan asal (UGD/Poli)
	SourceVisitID uint   `gorm:"not null;index" json:"source_visit_id"`
	SourceVisit   *Visit `gorm:"foreignKey:SourceVisitID" json:"source_visit,omitempty"`

	// Registration - tetap menggunakan registrasi yang sama
	RegistrationID uint          `gorm:"not null;index" json:"registration_id"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`

	// Request Details from Doctor/Nurse
	AdmissionType   string `gorm:"size:30;not null" json:"admission_type"`   // elektif, emergency
	AdmissionReason string `gorm:"type:text" json:"admission_reason"`        // Alasan rawat inap
	Diagnosis       string `gorm:"type:text" json:"diagnosis,omitempty"`     // Diagnosis sementara
	Priority        string `gorm:"size:20;default:'normal'" json:"priority"` // normal, urgent, emergency
	PreferredClass  string `gorm:"size:30" json:"preferred_class,omitempty"` // Kelas yang diminta (vvip, vip, 1, 2, 3)
	SpecialNotes    string `gorm:"type:text" json:"special_notes,omitempty"` // Catatan khusus (isolasi, dll)

	// Status
	Status AdmissionRequestStatus `gorm:"size:20;default:'pending';index" json:"status"`

	// Requested By (Doctor/Nurse who made the request)
	RequestedByID uint      `gorm:"not null;index" json:"requested_by_id"`
	RequestedBy   *User     `gorm:"foreignKey:RequestedByID" json:"requested_by,omitempty"`
	RequestedAt   time.Time `gorm:"not null" json:"requested_at"`

	// ========== Filled by Admission Staff ==========

	// Approved Room and Bed (filled by admission staff)
	ApprovedRoomID *uint `gorm:"index" json:"approved_room_id,omitempty"`
	ApprovedRoom   *Room `gorm:"foreignKey:ApprovedRoomID" json:"approved_room,omitempty"`
	ApprovedBedID  *uint `gorm:"index" json:"approved_bed_id,omitempty"`
	ApprovedBed    *Bed  `gorm:"foreignKey:ApprovedBedID" json:"approved_bed,omitempty"`

	// DPJP - Dokter Penanggung Jawab Pasien (filled by admission staff)
	DoctorID *uint     `gorm:"index" json:"doctor_id,omitempty"`
	Doctor   *Employee `gorm:"foreignKey:DoctorID" json:"doctor,omitempty"`

	// Inpatient Class (from selected room)
	InpatientClass string `gorm:"size:30" json:"inpatient_class,omitempty"`

	// Created Inpatient Visit (after approved)
	InpatientVisitID *uint  `gorm:"index" json:"inpatient_visit_id,omitempty"`
	InpatientVisit   *Visit `gorm:"foreignKey:InpatientVisitID" json:"inpatient_visit,omitempty"`

	// Processed By (Admission staff who processed the request)
	ProcessedByID *uint      `gorm:"index" json:"processed_by_id,omitempty"`
	ProcessedBy   *User      `gorm:"foreignKey:ProcessedByID" json:"processed_by,omitempty"`
	ProcessedAt   *time.Time `json:"processed_at,omitempty"`

	// Rejection/Cancellation
	RejectionReason string `gorm:"type:text" json:"rejection_reason,omitempty"`

	// Notes
	AdminNotes string `gorm:"type:text" json:"admin_notes,omitempty"` // Catatan dari admin pendaftaran
}

func (AdmissionRequest) TableName() string {
	return "admission_requests"
}
