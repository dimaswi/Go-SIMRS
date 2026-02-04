package models

import (
	"time"

	"gorm.io/gorm"
)

// ClaimState represents the state machine for E-Klaim
type ClaimState string

const (
	ClaimStateDraft         ClaimState = "DRAFT"
	ClaimStateIDRGGrouped   ClaimState = "IDRG_GROUPED"
	ClaimStateIDRGFinal     ClaimState = "IDRG_FINAL"
	ClaimStateINACBGGrouped ClaimState = "INACBG_GROUPED"
	ClaimStateINACBGFinal   ClaimState = "INACBG_FINAL"
	ClaimStateClaimFinal    ClaimState = "CLAIM_FINAL"
	ClaimStateSent          ClaimState = "SENT"
	ClaimStateVerified      ClaimState = "VERIFIED"
	ClaimStateDisputed      ClaimState = "DISPUTED"
	ClaimStateRejected      ClaimState = "REJECTED"
)

// AdmissionType represents cara masuk pasien
type AdmissionType string

const (
	AdmissionIGD      AdmissionType = "1" // IGD
	AdmissionPoli     AdmissionType = "2" // Poliklinik/Rawat Jalan
	AdmissionReferral AdmissionType = "3" // Rujukan Langsung dari RS Lain
	AdmissionBorn     AdmissionType = "4" // Lahir di Rumah Sakit
)

// DischargeType represents jenis/cara keluar
type DischargeType string

const (
	DischargeImproved    DischargeType = "1" // Sembuh/Membaik
	DischargeReferred    DischargeType = "2" // Rujuk ke RS lain
	DischargeAPS         DischargeType = "3" // Atas Permintaan Sendiri
	DischargeDied        DischargeType = "4" // Meninggal
	DischargeDiedLess48h DischargeType = "5" // Meninggal <48 jam
	DischargeDiedMore48h DischargeType = "6" // Meninggal ≥48 jam
)

// JenisRawat represents jenis rawat
type JenisRawat string

const (
	JenisRawatJalan JenisRawat = "1" // Rawat Jalan
	JenisRawatInap  JenisRawat = "2" // Rawat Inap
	JenisRawatIGD   JenisRawat = "3" // IGD
)

// ProcedureSetting represents setting/lokasi prosedur
type ProcedureSetting string

const (
	ProcedureSettingOR    ProcedureSetting = "OR"     // Operating Room
	ProcedureSettingNonOR ProcedureSetting = "NON_OR" // Non-Operating Room
	ProcedureSettingICU   ProcedureSetting = "ICU"    // ICU
	ProcedureSettingCath  ProcedureSetting = "CATH"   // Catheterization Lab
	ProcedureSettingEndo  ProcedureSetting = "ENDO"   // Endoscopy
	ProcedureSettingOther ProcedureSetting = "OTHER"  // Lainnya
)

// EKlaim represents a single E-Klaim record
type EKlaim struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Reference to Visit
	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// State Machine
	State          ClaimState `gorm:"size:30;default:'DRAFT';index" json:"state"`
	IDRGValid      bool       `gorm:"default:false" json:"idrg_valid"`
	INACBGValid    bool       `gorm:"default:false" json:"inacbg_valid"`
	LastError      string     `gorm:"type:text" json:"last_error,omitempty"`
	LastErrorAt    *time.Time `json:"last_error_at,omitempty"`
	LastGroupingAt *time.Time `json:"last_grouping_at,omitempty"`

	// SEP Data
	NoSEP          string        `gorm:"size:50;index" json:"no_sep"`
	NoKartu        string        `gorm:"size:20" json:"no_kartu"`
	TglMasuk       *time.Time    `json:"tgl_masuk"`
	TglPulang      *time.Time    `json:"tgl_pulang"`
	JenisPelayanan string        `gorm:"size:5" json:"jenis_pelayanan"` // 1=RI, 2=RJ
	JenisRawat     JenisRawat    `gorm:"size:5" json:"jenis_rawat"`
	CaraMasuk      AdmissionType `gorm:"size:5" json:"cara_masuk"`
	JenisKeluar    DischargeType `gorm:"size:5" json:"jenis_keluar"`

	// Patient Info (from SEP)
	TglLahir     *time.Time `json:"tgl_lahir"`
	JenisKelamin string     `gorm:"size:5" json:"jenis_kelamin"` // P=Perempuan, L=Laki-laki
	BeratBadan   float64    `json:"berat_badan"`

	// Tarif RS
	TarifRS       float64 `json:"tarif_rs"`
	TarifProsedur float64 `json:"tarif_prosedur"`
	TarifAlkes    float64 `json:"tarif_alkes"`
	TarifObat     float64 `json:"tarif_obat"`
	TarifKamar    float64 `json:"tarif_kamar"`
	TarifLainnya  float64 `json:"tarif_lainnya"`
	TotalTarifRS  float64 `json:"total_tarif_rs"`

	// ICU/NICU specific
	LOS         int `json:"los"`           // Length of Stay
	LOSICU      int `json:"los_icu"`       // LOS in ICU
	LOSNICU     int `json:"los_nicu"`      // LOS in NICU
	Ventilator  int `json:"ventilator"`    // Jam penggunaan ventilator
	AdlSubAcute int `json:"adl_sub_acute"` // ADL Sub Acute
	AdlChronic  int `json:"adl_chronic"`   // ADL Chronic

	// Neonatus specific
	ApgarMenit1   int     `json:"apgar_menit_1"`
	ApgarMenit5   int     `json:"apgar_menit_5"`
	BeratLahir    float64 `json:"berat_lahir"`
	UmurKehamilan int     `json:"umur_kehamilan"` // dalam minggu

	// iDRG Grouping Result
	IDRGCode        string     `gorm:"size:20" json:"idrg_code"`
	IDRGDescription string     `gorm:"size:500" json:"idrg_description"`
	IDRGTarif       float64    `json:"idrg_tarif"`
	IDRGGroupedAt   *time.Time `json:"idrg_grouped_at"`
	IDRGFinalizedAt *time.Time `json:"idrg_finalized_at"`
	IDRGFinalizedBy *uint      `json:"idrg_finalized_by"`
	IDRGRawResponse string     `gorm:"type:text" json:"idrg_raw_response,omitempty"`

	// INACBG Grouping Result
	INACBGCode        string     `gorm:"size:20" json:"inacbg_code"`
	INACBGDescription string     `gorm:"size:500" json:"inacbg_description"`
	INACBGTarif       float64    `json:"inacbg_tarif"`
	INACBGGroupedAt   *time.Time `json:"inacbg_grouped_at"`
	INACBGFinalizedAt *time.Time `json:"inacbg_finalized_at"`
	INACBGFinalizedBy *uint      `json:"inacbg_finalized_by"`
	INACBGRawResponse string     `gorm:"type:text" json:"inacbg_raw_response,omitempty"`

	// Final Claim
	ClaimFinalizedAt *time.Time `json:"claim_finalized_at"`
	ClaimFinalizedBy *uint      `json:"claim_finalized_by"`
	ClaimSentAt      *time.Time `json:"claim_sent_at"`
	ClaimSentBy      *uint      `json:"claim_sent_by"`

	// Verification Result
	VerifiedAt         *time.Time `json:"verified_at"`
	VerificationStatus string     `gorm:"size:20" json:"verification_status"` // LAYAK, TIDAK_LAYAK, PENDING
	VerificationNote   string     `gorm:"type:text" json:"verification_note"`
	TarifVerifikasi    float64    `json:"tarif_verifikasi"`

	// Relations
	Diagnoses  []EKlaimDiagnosis `gorm:"foreignKey:EKlaimID" json:"diagnoses,omitempty"`
	Procedures []EKlaimProcedure `gorm:"foreignKey:EKlaimID" json:"procedures,omitempty"`
	Logs       []EKlaimLog       `gorm:"foreignKey:EKlaimID" json:"logs,omitempty"`
}

// EKlaimDiagnosis represents diagnosis for E-Klaim
type EKlaimDiagnosis struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimID uint `gorm:"not null;index" json:"eklaim_id"`

	// Diagnosis Info
	Code      string `gorm:"size:20;not null" json:"code"`    // ICD-10 Code
	Name      string `gorm:"size:500" json:"name"`            // Diagnosis name
	IsPrimary bool   `gorm:"default:false" json:"is_primary"` // Primary diagnosis
	Source    string `gorm:"size:20" json:"source"`           // "idrg" or "inacbg"
	IsIMCode  bool   `gorm:"default:false" json:"is_im_code"` // Indonesian Modification
	Sequence  int    `gorm:"default:0" json:"sequence"`       // Order/urutan

	// Warning for INACBG (if IM code not valid)
	HasWarning     bool   `gorm:"default:false" json:"has_warning"`
	WarningMessage string `gorm:"size:500" json:"warning_message,omitempty"`
	SuggestedCode  string `gorm:"size:20" json:"suggested_code,omitempty"`
}

// EKlaimProcedure represents procedure for E-Klaim
type EKlaimProcedure struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimID uint `gorm:"not null;index" json:"eklaim_id"`

	// Procedure Info
	Code         string           `gorm:"size:20;not null" json:"code"`    // ICD-9-CM Code
	Name         string           `gorm:"size:500" json:"name"`            // Procedure name
	Multiplicity int              `gorm:"default:1" json:"multiplicity"`   // Jumlah pengulangan (1-99)
	Setting      ProcedureSetting `gorm:"size:10" json:"setting"`          // OR, NON_OR, ICU, etc.
	Source       string           `gorm:"size:20" json:"source"`           // "idrg" or "inacbg"
	IsIMCode     bool             `gorm:"default:false" json:"is_im_code"` // Indonesian Modification
	Sequence     int              `gorm:"default:0" json:"sequence"`       // Order/urutan

	// Warning for INACBG (if IM code not valid)
	HasWarning     bool   `gorm:"default:false" json:"has_warning"`
	WarningMessage string `gorm:"size:500" json:"warning_message,omitempty"`
	SuggestedCode  string `gorm:"size:20" json:"suggested_code,omitempty"`
}

// EKlaimLog represents activity log for E-Klaim
type EKlaimLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	EKlaimID uint  `gorm:"not null;index" json:"eklaim_id"`
	UserID   *uint `json:"user_id,omitempty"`
	User     *User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	Action       string `gorm:"size:50;not null" json:"action"` // CREATE, GROUPING_IDRG, FINAL_IDRG, etc.
	FromState    string `gorm:"size:30" json:"from_state"`
	ToState      string `gorm:"size:30" json:"to_state"`
	Description  string `gorm:"type:text" json:"description"`
	RequestData  string `gorm:"type:text" json:"request_data,omitempty"`
	ResponseData string `gorm:"type:text" json:"response_data,omitempty"`
	IsError      bool   `gorm:"default:false" json:"is_error"`
	ErrorMessage string `gorm:"type:text" json:"error_message,omitempty"`
	IPAddress    string `gorm:"size:50" json:"ip_address,omitempty"`
}

// TableName returns the table name
func (EKlaim) TableName() string {
	return "eklaims"
}

func (EKlaimDiagnosis) TableName() string {
	return "eklaim_diagnoses"
}

func (EKlaimProcedure) TableName() string {
	return "eklaim_procedures"
}

func (EKlaimLog) TableName() string {
	return "eklaim_logs"
}

// CanGroupIDRG checks if iDRG grouping can be performed
func (e *EKlaim) CanGroupIDRG() bool {
	return e.State == ClaimStateDraft || e.State == ClaimStateIDRGGrouped
}

// CanFinalIDRG checks if iDRG can be finalized
func (e *EKlaim) CanFinalIDRG() bool {
	return e.State == ClaimStateIDRGGrouped && e.IDRGValid
}

// CanEditIDRG checks if iDRG can be edited (unfinal)
func (e *EKlaim) CanEditIDRG() bool {
	return e.State == ClaimStateIDRGFinal ||
		e.State == ClaimStateINACBGGrouped ||
		e.State == ClaimStateINACBGFinal
}

// CanGroupINACBG checks if INACBG grouping can be performed
func (e *EKlaim) CanGroupINACBG() bool {
	return e.State == ClaimStateIDRGFinal || e.State == ClaimStateINACBGGrouped
}

// CanFinalINACBG checks if INACBG can be finalized
func (e *EKlaim) CanFinalINACBG() bool {
	return e.State == ClaimStateINACBGGrouped && e.INACBGValid
}

// CanEditINACBG checks if INACBG can be edited (unfinal)
func (e *EKlaim) CanEditINACBG() bool {
	return e.State == ClaimStateINACBGFinal
}

// CanFinalClaim checks if claim can be finalized
func (e *EKlaim) CanFinalClaim() bool {
	return e.State == ClaimStateINACBGFinal
}

// CanSendClaim checks if claim can be sent
func (e *EKlaim) CanSendClaim() bool {
	return e.State == ClaimStateClaimFinal
}

// CanPrintClaim checks if claim can be printed
func (e *EKlaim) CanPrintClaim() bool {
	return e.State == ClaimStateClaimFinal ||
		e.State == ClaimStateSent ||
		e.State == ClaimStateVerified
}

// IsFormDisabled checks if form should be disabled
func (e *EKlaim) IsFormDisabled() bool {
	return e.State != ClaimStateDraft && e.State != ClaimStateIDRGGrouped
}

// IsINACBGSectionVisible checks if INACBG section should be visible
func (e *EKlaim) IsINACBGSectionVisible() bool {
	return e.State == ClaimStateIDRGFinal ||
		e.State == ClaimStateINACBGGrouped ||
		e.State == ClaimStateINACBGFinal ||
		e.State == ClaimStateClaimFinal ||
		e.State == ClaimStateSent ||
		e.State == ClaimStateVerified
}

// GetButtonVisibility returns visibility state for all buttons
func (e *EKlaim) GetButtonVisibility() map[string]bool {
	return map[string]bool{
		"grouping_idrg":   e.CanGroupIDRG(),
		"final_idrg":      e.CanFinalIDRG(),
		"edit_idrg":       e.CanEditIDRG(),
		"grouping_inacbg": e.CanGroupINACBG(),
		"final_inacbg":    e.CanFinalINACBG(),
		"edit_inacbg":     e.CanEditINACBG(),
		"final_claim":     e.CanFinalClaim(),
		"send_claim":      e.CanSendClaim(),
		"print_claim":     e.CanPrintClaim(),
		"form_disabled":   e.IsFormDisabled(),
		"inacbg_visible":  e.IsINACBGSectionVisible(),
	}
}
