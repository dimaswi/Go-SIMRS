package models

import (
	"time"

	"gorm.io/gorm"
)

// EKlaimLocal represents a local E-Klaim record created after successful new_claim to eklaim server.
// This stores the response from eklaim local server and tracks the claim lifecycle.
type EKlaimLocal struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Reference to SEP & Visit
	SEPID   uint   `gorm:"not null;index" json:"sep_id"`
	SEP     *SEP   `gorm:"foreignKey:SEPID" json:"sep,omitempty"`
	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// SEP Info (denormalized for quick access)
	NoSEP      string `gorm:"size:50;not null;uniqueIndex" json:"no_sep"`
	NoKartu    string `gorm:"size:20" json:"no_kartu"`
	NamaPasien string `gorm:"size:200" json:"nama_pasien"`

	// Status tracking
	Status string `gorm:"size:30;default:'new_claim';index" json:"status"` // new_claim, set_claim_data, grouped, finalized, sent

	// new_claim response
	NewClaimSentAt   *time.Time `json:"new_claim_sent_at"`
	NewClaimResponse string     `gorm:"type:text" json:"new_claim_response,omitempty"`
	NewClaimSuccess  bool       `gorm:"default:false" json:"new_claim_success"`

	// set_claim_data
	SetClaimDataSentAt   *time.Time `json:"set_claim_data_sent_at"`
	SetClaimDataResponse string     `gorm:"type:text" json:"set_claim_data_response,omitempty"`
	SetClaimDataSuccess  bool       `gorm:"default:false" json:"set_claim_data_success"`

	// Grouper result
	GrouperSentAt   *time.Time `json:"grouper_sent_at"`
	GrouperResponse string     `gorm:"type:text" json:"grouper_response,omitempty"`
	GrouperSuccess  bool       `gorm:"default:false" json:"grouper_success"`
	CBGCode         string     `gorm:"size:30" json:"cbg_code"`
	CBGDescription  string     `gorm:"size:500" json:"cbg_description"`
	CBGTariff       float64    `json:"cbg_tariff"`
	HospitalTariff  float64    `json:"hospital_tariff"`
	TariffDiff      float64    `json:"tariff_diff"`

	// Finalization (legacy — kept for DB compat, replaced by ClaimFinal* below)
	FinalSentAt   *time.Time `json:"final_sent_at"`
	FinalResponse string     `gorm:"type:text" json:"final_response,omitempty"`
	FinalSuccess  bool       `gorm:"default:false" json:"final_success"`

	// ==================== iDRG Tracking ====================
	IDRGDiagnosa          string `gorm:"column:idrg_diagnosa;type:text" json:"idrg_diagnosa"`                               // "#"-separated codes sent to E-Klaim
	IDRGProcedure         string `gorm:"column:idrg_procedure;type:text" json:"idrg_procedure"`                             // "#"-separated codes+multiplicity
	IDRGDiagnosaResponse  string `gorm:"column:idrg_diagnosa_response;type:text" json:"idrg_diagnosa_response,omitempty"`   // JSON response from idrg_diagnosa_set
	IDRGProcedureResponse string `gorm:"column:idrg_procedure_response;type:text" json:"idrg_procedure_response,omitempty"` // JSON response from idrg_procedure_set

	IDRGGrouperSentAt   *time.Time `gorm:"column:idrg_grouper_sent_at" json:"idrg_grouper_sent_at"`
	IDRGGrouperResponse string     `gorm:"column:idrg_grouper_response;type:text" json:"idrg_grouper_response,omitempty"`
	IDRGGrouperSuccess  bool       `gorm:"column:idrg_grouper_success;default:false" json:"idrg_grouper_success"`
	IDRGCode            string     `gorm:"column:idrg_code;size:30" json:"idrg_code"`
	IDRGDescription     string     `gorm:"column:idrg_description;size:500" json:"idrg_description"`
	IDRGCostWeight      string     `gorm:"column:idrg_cost_weight;size:30" json:"idrg_cost_weight"`
	IDRGStatusCd        string     `gorm:"column:idrg_status_cd;size:30" json:"idrg_status_cd"` // "normal" or error

	IDRGFinalSentAt  *time.Time `gorm:"column:idrg_final_sent_at" json:"idrg_final_sent_at"`
	IDRGFinalSuccess bool       `gorm:"column:idrg_final_success;default:false" json:"idrg_final_success"`

	// ==================== INACBG Tracking ====================
	INACBGDiagnosa          string `gorm:"type:text" json:"inacbg_diagnosa"`                    // "#"-separated codes
	INACBGProcedure         string `gorm:"type:text" json:"inacbg_procedure"`                   // "#"-separated codes (no multiplicity)
	INACBGDiagnosaResponse  string `gorm:"type:text" json:"inacbg_diagnosa_response,omitempty"` // JSON response
	INACBGProcedureResponse string `gorm:"type:text" json:"inacbg_procedure_response,omitempty"`
	INACBGImportResponse    string `gorm:"type:text" json:"inacbg_import_response,omitempty"` // JSON response from idrg_to_inacbg_import

	INACBGGrouperStage1SentAt   *time.Time `json:"inacbg_grouper_stage1_sent_at"`
	INACBGGrouperStage1Response string     `gorm:"type:text" json:"inacbg_grouper_stage1_response,omitempty"`
	INACBGGrouperStage1Success  bool       `gorm:"default:false" json:"inacbg_grouper_stage1_success"`

	SpecialCMGOptions  string `gorm:"type:text" json:"special_cmg_options,omitempty"`  // JSON array of SpecialCMGOption from stage 1
	SelectedSpecialCMG string `gorm:"type:text" json:"selected_special_cmg,omitempty"` // "#"-separated codes selected by user

	INACBGGrouperStage2SentAt   *time.Time `json:"inacbg_grouper_stage2_sent_at"`
	INACBGGrouperStage2Response string     `gorm:"type:text" json:"inacbg_grouper_stage2_response,omitempty"`
	INACBGGrouperStage2Success  bool       `gorm:"default:false" json:"inacbg_grouper_stage2_success"`

	INACBGCBGCode        string `gorm:"column:inacbg_cbg_code;size:30" json:"inacbg_cbg_code"`
	INACBGCBGDescription string `gorm:"column:inacbg_cbg_description;size:500" json:"inacbg_cbg_description"`
	INACBGBaseTariff     string `gorm:"size:30" json:"inacbg_base_tariff"`
	INACBGTariff         string `gorm:"size:30" json:"inacbg_tariff"`
	INACBGStatusCd       string `gorm:"size:30" json:"inacbg_status_cd"` // "normal" or error

	INACBGFinalSentAt  *time.Time `json:"inacbg_final_sent_at"`
	INACBGFinalSuccess bool       `gorm:"default:false" json:"inacbg_final_success"`

	// ==================== Claim Final & Send ====================
	ClaimFinalSentAt   *time.Time `json:"claim_final_sent_at"`
	ClaimFinalResponse string     `gorm:"type:text" json:"claim_final_response,omitempty"`
	ClaimFinalSuccess  bool       `gorm:"default:false" json:"claim_final_success"`

	ClaimSendSentAt   *time.Time `json:"claim_send_sent_at"`
	ClaimSendResponse string     `gorm:"type:text" json:"claim_send_response,omitempty"`
	ClaimSendSuccess  bool       `gorm:"default:false" json:"claim_send_success"`

	ClaimReeditSentAt   *time.Time `json:"claim_reedit_sent_at"`
	ClaimReeditResponse string     `gorm:"type:text" json:"claim_reedit_response,omitempty"`

	// Form data saved flag — true once user has saved form data via SendSetClaimData
	FormDataSaved bool `gorm:"default:false" json:"form_data_saved"`

	// E-Klaim data for set_claim_data (editable form fields)
	TglMasuk        string  `gorm:"size:30" json:"tgl_masuk"`        // yyyy-mm-dd HH:mm:ss
	TglPulang       string  `gorm:"size:30" json:"tgl_pulang"`       // yyyy-mm-dd HH:mm:ss
	CaraMasuk       string  `gorm:"size:20" json:"cara_masuk"`       // gp, hosp-trans, mp, outp, inp, emd, born, nursing, psych, rehab, other
	JenisRawat      string  `gorm:"size:5" json:"jenis_rawat"`       // 1=RI, 2=RJ
	KelasRawat      string  `gorm:"size:5" json:"kelas_rawat"`       // 1, 2, 3
	DischargeStatus string  `gorm:"size:10" json:"discharge_status"` // 1-5
	TarifRS         float64 `json:"tarif_rs"`

	// Diagnoses & Procedures (comma-separated ICD codes for eklaim)
	Diagnosa            string `gorm:"type:text" json:"diagnosa"`                                         // ICD-10 comma-separated
	Procedure           string `gorm:"type:text" json:"procedure"`                                        // ICD-9-CM comma-separated
	DiagnosaINAGrouper  string `gorm:"column:diagnosa_inagrouper;type:text" json:"diagnosa_inagrouper"`   // for INACBG
	ProcedureINAGrouper string `gorm:"column:procedure_inagrouper;type:text" json:"procedure_inagrouper"` // for INACBG

	// ICU fields
	ICUIndikator   string `gorm:"column:icu_indikator;size:5;default:'0'" json:"icu_indikator"`
	ICULOS         string `gorm:"column:icu_los;size:10;default:'0'" json:"icu_los"`
	VentilatorHour string `gorm:"size:10;default:'0'" json:"ventilator_hour"`

	// Neonatus
	BirthWeight string `gorm:"size:10;default:'0'" json:"birth_weight"`

	// Sub-acute / Chronic
	ADLSubAcute string `gorm:"size:10;default:'0'" json:"adl_sub_acute"`
	ADLChronic  string `gorm:"size:10;default:'0'" json:"adl_chronic"`

	// Coder
	CoderNIK string `gorm:"size:20" json:"coder_nik"`

	// Upgrade kelas
	UpgradeClassInd   string `gorm:"size:5;default:'0'" json:"upgrade_class_ind"`
	UpgradeClassClass string `gorm:"size:10" json:"upgrade_class_class"` // kelas_1, kelas_2, vip, vvip
	UpgradeClassLOS   string `gorm:"size:10;default:'0'" json:"upgrade_class_los"`
	UpgradeClassPayor string `gorm:"size:30" json:"upgrade_class_payor"` // peserta, pemberi_kerja, asuransi_tambahan
	AddPaymentPct     string `gorm:"size:10;default:'0'" json:"add_payment_pct"`

	// Ventilator detail
	VentilatorUseInd string `gorm:"size:5;default:'0'" json:"ventilator_use_ind"`
	VentilatorStart  string `gorm:"size:30" json:"ventilator_start"` // yyyy-mm-dd hh:mm:ss
	VentilatorStop   string `gorm:"size:30" json:"ventilator_stop"`  // yyyy-mm-dd hh:mm:ss

	// Vital signs
	Sistole  int `gorm:"default:0" json:"sistole"`
	Diastole int `gorm:"default:0" json:"diastole"`

	// Tarif & Payor
	KodeTarif    string `gorm:"size:10" json:"kode_tarif"` // AP, AS, BP, BS, CP, CS, DP, DS, RSCM, dll
	PayorID      string `gorm:"size:10" json:"payor_id"`
	PayorCd      string `gorm:"size:20" json:"payor_cd"`
	CobCd        string `gorm:"size:20" json:"cob_cd"`
	NamaDokter   string `gorm:"size:200" json:"nama_dokter"`
	TarifPoliEks string `gorm:"size:20" json:"tarif_poli_eks"`

	// Khusus COVID / BBL / Hemodialisa / Stroke
	NomorKartuT       string `gorm:"size:20" json:"nomor_kartu_t"`
	BayiLahirStatusCd int    `gorm:"default:0" json:"bayi_lahir_status_cd"` // 1=tanpa kelainan, 2=dengan kelainan
	DializerSingleUse int    `gorm:"default:0" json:"dializer_single_use"`
	KantongDarah      int    `gorm:"default:0" json:"kantong_darah"`
	AlteplaseInd      int    `gorm:"default:0" json:"alteplase_ind"`

	// APGAR menit 1
	ApgarMenit1Appearance  int `gorm:"default:0" json:"apgar_menit1_appearance"`
	ApgarMenit1Pulse       int `gorm:"default:0" json:"apgar_menit1_pulse"`
	ApgarMenit1Grimace     int `gorm:"default:0" json:"apgar_menit1_grimace"`
	ApgarMenit1Activity    int `gorm:"default:0" json:"apgar_menit1_activity"`
	ApgarMenit1Respiration int `gorm:"default:0" json:"apgar_menit1_respiration"`
	// APGAR menit 5
	ApgarMenit5Appearance  int `gorm:"default:0" json:"apgar_menit5_appearance"`
	ApgarMenit5Pulse       int `gorm:"default:0" json:"apgar_menit5_pulse"`
	ApgarMenit5Grimace     int `gorm:"default:0" json:"apgar_menit5_grimace"`
	ApgarMenit5Activity    int `gorm:"default:0" json:"apgar_menit5_activity"`
	ApgarMenit5Respiration int `gorm:"default:0" json:"apgar_menit5_respiration"`

	// Persalinan
	PersalinanUsiaKehamilan  string `gorm:"size:10" json:"persalinan_usia_kehamilan"`
	PersalinanGravida        string `gorm:"size:10" json:"persalinan_gravida"`
	PersalinanPartus         string `gorm:"size:10" json:"persalinan_partus"`
	PersalinanAbortus        string `gorm:"size:10" json:"persalinan_abortus"`
	PersalinanOnsetKontraksi string `gorm:"size:50" json:"persalinan_onset_kontraksi"` // spontan, induksi, non_spontan_non_induksi
	PersalinanDeliveryJSON   string `gorm:"type:text" json:"persalinan_delivery_json"` // JSON array of delivery entries

	// Last error
	LastError   string     `gorm:"type:text" json:"last_error,omitempty"`
	LastErrorAt *time.Time `json:"last_error_at,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`

	// Relations
	RMDuplicate *EKlaimRMDuplicate `gorm:"foreignKey:EKlaimLocalID" json:"rm_duplicate,omitempty"`
	Logs        []EKlaimLocalLog   `gorm:"foreignKey:EKlaimLocalID" json:"logs,omitempty"`
}

func (EKlaimLocal) TableName() string {
	return "eklaim_locals"
}

// ==================== Workflow Helper Methods ====================

// CanDoIDRGCoding checks if iDRG diagnosa/procedure coding can be performed
func (e *EKlaimLocal) CanDoIDRGCoding() bool {
	return e.SetClaimDataSuccess && !e.IDRGFinalSuccess
}

// CanGroupIDRG checks if iDRG grouping can be performed
func (e *EKlaimLocal) CanGroupIDRG() bool {
	return e.SetClaimDataSuccess && !e.IDRGFinalSuccess
}

// CanFinalIDRG checks if iDRG can be finalized
func (e *EKlaimLocal) CanFinalIDRG() bool {
	return e.IDRGGrouperSuccess && e.IDRGStatusCd == "normal" && !e.IDRGFinalSuccess
}

// CanReeditIDRG checks if iDRG can be re-edited (unfinalized)
func (e *EKlaimLocal) CanReeditIDRG() bool {
	return e.IDRGFinalSuccess && !e.ClaimFinalSuccess
}

// IsINACBGVisible checks if INACBG section should be visible
func (e *EKlaimLocal) IsINACBGVisible() bool {
	return e.IDRGFinalSuccess
}

// CanDoINACBGCoding checks if INACBG diagnosa/procedure coding can be performed
func (e *EKlaimLocal) CanDoINACBGCoding() bool {
	return e.IDRGFinalSuccess && !e.INACBGFinalSuccess
}

// CanGroupINACBG checks if INACBG grouping can be performed
func (e *EKlaimLocal) CanGroupINACBG() bool {
	return e.IDRGFinalSuccess && !e.INACBGFinalSuccess
}

// CanFinalINACBG checks if INACBG can be finalized
func (e *EKlaimLocal) CanFinalINACBG() bool {
	grouped := e.INACBGGrouperStage1Success || e.INACBGGrouperStage2Success
	return grouped && e.INACBGStatusCd == "normal" && !e.INACBGFinalSuccess
}

// CanReeditINACBG checks if INACBG can be re-edited (unfinalized)
func (e *EKlaimLocal) CanReeditINACBG() bool {
	return e.INACBGFinalSuccess && !e.ClaimFinalSuccess
}

// CanClaimFinal checks if claim can be finalized
func (e *EKlaimLocal) CanClaimFinal() bool {
	return e.INACBGFinalSuccess && !e.ClaimFinalSuccess
}

// CanClaimSend checks if claim can be sent to BPJS
func (e *EKlaimLocal) CanClaimSend() bool {
	return e.ClaimFinalSuccess && !e.ClaimSendSuccess
}

// CanReeditClaim checks if finalized claim can be re-edited
func (e *EKlaimLocal) CanReeditClaim() bool {
	return e.ClaimFinalSuccess && !e.ClaimSendSuccess
}

// CanPrintClaim checks if claim can be printed
func (e *EKlaimLocal) CanPrintClaim() bool {
	return e.ClaimFinalSuccess
}

// IsFormDisabled checks if claim data form should be disabled (after iDRG final)
func (e *EKlaimLocal) IsFormDisabled() bool {
	return e.IDRGFinalSuccess
}

// GetButtonVisibility returns visibility/enabled state for all workflow buttons
func (e *EKlaimLocal) GetButtonVisibility() map[string]bool {
	return map[string]bool{
		"idrg_coding":     e.CanDoIDRGCoding(),
		"grouping_idrg":   e.CanGroupIDRG(),
		"final_idrg":      e.CanFinalIDRG(),
		"reedit_idrg":     e.CanReeditIDRG(),
		"inacbg_visible":  e.IsINACBGVisible(),
		"inacbg_coding":   e.CanDoINACBGCoding(),
		"grouping_inacbg": e.CanGroupINACBG(),
		"final_inacbg":    e.CanFinalINACBG(),
		"reedit_inacbg":   e.CanReeditINACBG(),
		"final_claim":     e.CanClaimFinal(),
		"send_claim":      e.CanClaimSend(),
		"reedit_claim":    e.CanReeditClaim(),
		"print_claim":     e.CanPrintClaim(),
		"form_disabled":   e.IsFormDisabled(),
	}
}

// ResetIDRGState resets all iDRG final state (used when re-editing iDRG)
func (e *EKlaimLocal) ResetIDRGState() {
	e.IDRGFinalSentAt = nil
	e.IDRGFinalSuccess = false
	// Also reset all INACBG state since iDRG changed
	e.ResetINACBGState()
}

// ResetINACBGState resets all INACBG state (used when re-editing INACBG or cascaded from iDRG reedit)
func (e *EKlaimLocal) ResetINACBGState() {
	e.INACBGDiagnosa = ""
	e.INACBGProcedure = ""
	e.INACBGDiagnosaResponse = ""
	e.INACBGProcedureResponse = ""
	e.INACBGImportResponse = ""
	e.INACBGGrouperStage1SentAt = nil
	e.INACBGGrouperStage1Response = ""
	e.INACBGGrouperStage1Success = false
	e.SpecialCMGOptions = ""
	e.SelectedSpecialCMG = ""
	e.INACBGGrouperStage2SentAt = nil
	e.INACBGGrouperStage2Response = ""
	e.INACBGGrouperStage2Success = false
	e.INACBGCBGCode = ""
	e.INACBGCBGDescription = ""
	e.INACBGBaseTariff = ""
	e.INACBGTariff = ""
	e.INACBGStatusCd = ""
	e.INACBGFinalSentAt = nil
	e.INACBGFinalSuccess = false
	// Also reset claim final/send
	e.ResetClaimFinalState()
}

// ResetClaimFinalState resets claim final and send state
func (e *EKlaimLocal) ResetClaimFinalState() {
	e.ClaimFinalSentAt = nil
	e.ClaimFinalResponse = ""
	e.ClaimFinalSuccess = false
	e.ClaimSendSentAt = nil
	e.ClaimSendResponse = ""
	e.ClaimSendSuccess = false
}

// EKlaimRMDuplicate stores the duplicated medical record data for E-Klaim
// This is an editable copy - original RM is NOT affected
type EKlaimRMDuplicate struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimLocalID uint         `gorm:"not null;uniqueIndex" json:"eklaim_local_id"`
	EKlaimLocal   *EKlaimLocal `gorm:"foreignKey:EKlaimLocalID" json:"eklaim_local,omitempty"`
	VisitID       uint         `gorm:"not null;index" json:"visit_id"`
	Visit         *Visit       `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Snapshot of original RM (JSON, immutable after creation)
	OriginalDiagnosesJSON  string `gorm:"type:text" json:"original_diagnoses_json,omitempty"`
	OriginalProceduresJSON string `gorm:"type:text" json:"original_procedures_json,omitempty"`
	OriginalTarifJSON      string `gorm:"type:text" json:"original_tarif_json,omitempty"`
	OriginalRMJSON         string `gorm:"type:text" json:"original_rm_json,omitempty"` // Full snapshot of anamnesis+exam+assessment+disposition

	// ===== ANAMNESIS (Editable copy) =====
	ChiefComplaint          string `gorm:"type:text" json:"chief_complaint"`
	HistoryOfPresentIllness string `gorm:"type:text" json:"history_of_present_illness"`
	PastMedicalHistory      string `gorm:"type:text" json:"past_medical_history"`
	FamilyHistory           string `gorm:"type:text" json:"family_history"`
	SocialHistory           string `gorm:"type:text" json:"social_history"`
	Allergies               string `gorm:"type:text" json:"allergies"`
	CurrentMedications      string `gorm:"type:text" json:"current_medications"`
	ReviewOfSystems         string `gorm:"type:text" json:"review_of_systems"`

	// ===== PEMERIKSAAN FISIK / VITAL SIGNS (Editable copy) =====
	GeneralCondition string  `gorm:"type:text" json:"general_condition"`
	Consciousness    string  `gorm:"size:100" json:"consciousness"`
	BloodPressure    string  `gorm:"size:100" json:"blood_pressure"`
	Systolic         int     `json:"systolic"`
	Diastolic        int     `json:"diastolic"`
	HeartRate        string  `gorm:"size:100" json:"heart_rate"`
	RespiratoryRate  string  `gorm:"size:100" json:"respiratory_rate"`
	Temperature      string  `gorm:"size:100" json:"temperature"`
	OxygenSaturation string  `gorm:"size:100" json:"oxygen_saturation"`
	Weight           string  `gorm:"size:100" json:"weight"`
	Height           string  `gorm:"size:100" json:"height"`
	BMI              float64 `json:"bmi"`
	Waist            string  `gorm:"size:100" json:"waist"`
	HeadCircum       string  `gorm:"size:100" json:"head_circum"`

	// Body System Examinations (legacy composite fields)
	HeadNeck     string `gorm:"type:text" json:"head_neck"`
	Eyes         string `gorm:"type:text" json:"eyes"`
	ENT          string `gorm:"type:text" json:"ent"`
	Thorax       string `gorm:"type:text" json:"thorax"`
	Cardiac      string `gorm:"type:text" json:"cardiac"`
	Pulmonary    string `gorm:"type:text" json:"pulmonary"`
	Abdomen      string `gorm:"type:text" json:"abdomen"`
	Extremities  string `gorm:"type:text" json:"extremities"`
	Neurological string `gorm:"type:text" json:"neurological"`
	Skin         string `gorm:"type:text" json:"skin"`

	// Body System Examinations (new individual fields)
	Head          string `gorm:"type:text" json:"head"`
	Ears          string `gorm:"type:text" json:"ears"`
	Nose          string `gorm:"type:text" json:"nose"`
	Throat        string `gorm:"type:text" json:"throat"`
	Neck          string `gorm:"type:text" json:"neck"`
	Chest         string `gorm:"type:text" json:"chest"`
	Heart         string `gorm:"type:text" json:"heart"`
	Lungs         string `gorm:"type:text" json:"lungs"`
	Musculoskel   string `gorm:"type:text" json:"musculoskel"`
	Genitourinary string `gorm:"type:text" json:"genitourinary"`
	OtherFindings string `gorm:"type:text" json:"other_findings"`

	// Supporting Examinations - ECG
	ECGPerformed      bool   `gorm:"default:false" json:"ecg_performed"`
	ECGResult         string `gorm:"type:text" json:"ecg_result"`
	ECGInterpretation string `gorm:"size:100" json:"ecg_interpretation"`
	ECGNotes          string `gorm:"type:text" json:"ecg_notes"`

	// ===== ASSESSMENT & PLAN (Editable copy) =====
	ClinicalAssessment string `gorm:"type:text" json:"clinical_assessment"`
	Prognosis          string `gorm:"type:text" json:"prognosis"`
	TreatmentPlan      string `gorm:"type:text" json:"treatment_plan"`
	MedicationPlan     string `gorm:"type:text" json:"medication_plan"`
	DietPlan           string `gorm:"type:text" json:"diet_plan"`
	ActivityPlan       string `gorm:"type:text" json:"activity_plan"`
	EducationPlan      string `gorm:"type:text" json:"education_plan"`
	MonitoringPlan     string `gorm:"type:text" json:"monitoring_plan"`
	ProcedurePlan      string `gorm:"type:text" json:"procedure_plan"`
	ConsultationPlan   string `gorm:"type:text" json:"consultation_plan"`

	// ===== DISPOSITION (Editable copy) =====
	DispositionType      string `gorm:"size:50" json:"disposition_type"`
	DispositionNote      string `gorm:"type:text" json:"disposition_note"`
	DischargeStatus      string `gorm:"size:50" json:"rm_discharge_status"`
	DischargeCondition   string `gorm:"size:50" json:"discharge_condition"`
	DischargeInstruction string `gorm:"type:text" json:"discharge_instruction"`
	DischargeMedication  string `gorm:"type:text" json:"discharge_medication"`
	FollowUpInstruction  string `gorm:"type:text" json:"follow_up_instruction"`
	FollowUpDate         string `gorm:"size:100" json:"follow_up_date"`
	ReferralFacility     string `gorm:"size:200" json:"referral_facility"`
	ReferralReason       string `gorm:"type:text" json:"referral_reason"`
	ReferralDiagnosis    string `gorm:"type:text" json:"referral_diagnosis"`
	ReferralTherapy      string `gorm:"type:text" json:"referral_therapy"`
	ReferralNotes        string `gorm:"type:text" json:"referral_notes"`
	DeathTime            string `gorm:"size:100" json:"death_time"`
	DeathCause           string `gorm:"type:text" json:"death_cause"`

	// ===== TRIAGE UGD (Editable copy — hanya untuk kunjungan UGD/IGD) =====
	TriageArrivalMode     string `gorm:"size:50" json:"triage_arrival_mode"`
	TriageComplaint       string `gorm:"type:text" json:"triage_complaint"`
	TriageLevel           string `gorm:"size:20" json:"triage_level"`
	TriageAirway          string `gorm:"size:100" json:"triage_airway"`
	TriageAirwayNote      string `gorm:"type:text" json:"triage_airway_note"`
	TriageBreathing       string `gorm:"size:100" json:"triage_breathing"`
	TriageBreathingNote   string `gorm:"type:text" json:"triage_breathing_note"`
	TriageCirculation     string `gorm:"size:100" json:"triage_circulation"`
	TriageCirculationNote string `gorm:"type:text" json:"triage_circulation_note"`
	TriageBloodPressure   string `gorm:"size:100" json:"triage_blood_pressure"`
	TriageHeartRate       string `gorm:"size:100" json:"triage_heart_rate"`
	TriageRespiratoryRate string `gorm:"size:100" json:"triage_respiratory_rate"`
	TriageTemperature     string `gorm:"size:100" json:"triage_temperature"`
	TriageOxygenSat       string `gorm:"size:100" json:"triage_oxygen_saturation"`
	TriagePainScale       int    `gorm:"default:0" json:"triage_pain_scale"`
	TriageGCSE            int    `gorm:"default:4" json:"triage_gcs_e"`
	TriageGCSV            int    `gorm:"default:5" json:"triage_gcs_v"`
	TriageGCSM            int    `gorm:"default:6" json:"triage_gcs_m"`
	TriageAssessment      string `gorm:"type:text" json:"triage_assessment"`
	TriageImmediateAction string `gorm:"type:text" json:"triage_immediate_actions"`
	HasTriage             bool   `gorm:"default:false" json:"has_triage"` // true bila kunjungan UGD dan ada triage

	// Editable Diagnoses (E-Klaim version)
	Diagnoses []EKlaimRMDiagnosis `gorm:"foreignKey:RMDuplicateID" json:"diagnoses,omitempty"`

	// Editable Procedures (E-Klaim version)
	Procedures []EKlaimRMProcedure `gorm:"foreignKey:RMDuplicateID" json:"procedures,omitempty"`

	// Editable Orders (unified: laboratory, radiology, surgery, consultation)
	// Mirrors ProcedureOrder → ProcedureOrderItem → ProcedureOrderResult hierarchy
	Orders []EKlaimRMOrder `gorm:"foreignKey:RMDuplicateID" json:"orders,omitempty"`

	// Editable Medicine Items (E-Klaim version — obat, separate from ProcedureOrder system)
	MedicineItems []EKlaimRMMedicineItem `gorm:"foreignKey:RMDuplicateID" json:"medicine_items,omitempty"`

	// Editable CPPT (E-Klaim version — rawat inap)
	CPPTNotes []EKlaimRMCPPT `gorm:"foreignKey:RMDuplicateID" json:"cppt_notes,omitempty"`

	// Editable Fluid Balance (E-Klaim version — balance cairan rawat inap)
	FluidBalances []EKlaimRMFluidBalance `gorm:"foreignKey:RMDuplicateID" json:"fluid_balances,omitempty"`

	// Duplicate Billing (E-Klaim version — for display only, separate from real billing)
	Billing *EKlaimRMBilling `gorm:"foreignKey:RMDuplicateID" json:"billing,omitempty"`

	// Editable Tarif — sesuai breakdown E-Klaim set_claim_data tarif_rs
	TarifProsedurNonBedah float64 `json:"tarif_prosedur_non_bedah"`
	TarifProsedurBedah    float64 `json:"tarif_prosedur_bedah"`
	TarifKonsultasi       float64 `json:"tarif_konsultasi"`
	TarifTenagaAhli       float64 `json:"tarif_tenaga_ahli"`
	TarifKeperawatan      float64 `json:"tarif_keperawatan"`
	TarifPenunjang        float64 `json:"tarif_penunjang"`
	TarifRadiologi        float64 `json:"tarif_radiologi"`
	TarifLaboratorium     float64 `json:"tarif_laboratorium"`
	TarifPelayananDarah   float64 `json:"tarif_pelayanan_darah"`
	TarifRehabilitasi     float64 `json:"tarif_rehabilitasi"`
	TarifKamar            float64 `json:"tarif_kamar"`
	TarifRawatIntensif    float64 `json:"tarif_rawat_intensif"`
	TarifObat             float64 `json:"tarif_obat"`
	TarifObatKronis       float64 `json:"tarif_obat_kronis"`
	TarifObatKemoterapi   float64 `json:"tarif_obat_kemoterapi"`
	TarifAlkes            float64 `json:"tarif_alkes"`
	TarifBMHP             float64 `json:"tarif_bmhp"`
	TarifSewaAlat         float64 `json:"tarif_sewa_alat"`
	TotalTarif            float64 `json:"total_tarif"`

	// Inpatient-specific fields
	AdmissionDate             string  `gorm:"size:100" json:"admission_date"`                          // Tanggal masuk rawat inap (yyyy-mm-dd HH:mm:ss)
	DischargeDate             string  `gorm:"size:100" json:"discharge_date"`                          // Tanggal keluar rawat inap (yyyy-mm-dd HH:mm:ss)
	LengthOfStay              int     `gorm:"default:0" json:"length_of_stay"`                        // Jumlah hari rawat (override manual, 0 = auto-calculate)
	AccommodationTariffPerDay float64 `gorm:"type:decimal(15,2)" json:"accommodation_tariff_per_day"` // Tarif akomodasi per hari (override manual, 0 = auto dari room tariff)

	// Audit
	DuplicatedByID *uint      `gorm:"index" json:"duplicated_by_id"`
	DuplicatedBy   *User      `gorm:"foreignKey:DuplicatedByID" json:"duplicated_by,omitempty"`
	DuplicatedAt   *time.Time `json:"duplicated_at"`
}

func (EKlaimRMDuplicate) TableName() string {
	return "eklaim_rm_duplicates"
}

// EKlaimRMDiagnosis is an editable diagnosis in the E-Klaim RM duplicate
type EKlaimRMDiagnosis struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	ICD10Code string `gorm:"size:20;not null" json:"icd10_code"`
	ICD10Name string `gorm:"size:500" json:"icd10_name"`
	Type      string `gorm:"size:20;not null" json:"type"` // primary, secondary
	Sequence  int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMDiagnosis) TableName() string {
	return "eklaim_rm_diagnoses"
}

// EKlaimRMProcedure is an editable procedure in the E-Klaim RM duplicate
type EKlaimRMProcedure struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	ICD9Code     string `gorm:"size:20;not null" json:"icd9_code"`
	Name         string `gorm:"size:500" json:"name"`
	Multiplicity int    `gorm:"default:1" json:"multiplicity"`
	Setting      string `gorm:"size:20;default:'NON_OR'" json:"setting"` // OR, NON_OR, ICU, etc
	Sequence     int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMProcedure) TableName() string {
	return "eklaim_rm_procedures"
}

// EKlaimRMOrder mirrors ProcedureOrder — a unified order for lab/radiology/surgery/consultation.
// Each order contains items (EKlaimRMOrderItem) which reference real Procedures,
// and each item has parameter-based results (EKlaimRMOrderResult).
type EKlaimRMOrder struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	// Order Type: laboratory, radiology, surgery, consultation
	OrderType string `gorm:"size:20;not null;index" json:"order_type"`

	// Source Reference (null for fake orders)
	SourceOrderID *uint `gorm:"index" json:"source_order_id"` // FK to ProcedureOrder

	// Order Info
	OrderNumber   string `gorm:"size:50" json:"order_number"`
	Priority      string `gorm:"size:20" json:"priority"`         // urgent, cito, normal
	ClinicalNotes string `gorm:"type:text" json:"clinical_notes"` // Catatan klinis / indikasi
	Diagnosis     string `gorm:"type:text" json:"diagnosis"`
	Notes         string `gorm:"type:text" json:"notes"`

	// Order-level Results (radiology/surgery — kesan, saran, etc.)
	ResultSummary string `gorm:"type:text" json:"result_summary"` // Ringkasan / Deskripsi
	Conclusion    string `gorm:"type:text" json:"conclusion"`     // Kesan / Kesimpulan
	Suggestion    string `gorm:"type:text" json:"suggestion"`     // Saran
	IsCritical    bool   `gorm:"default:false" json:"is_critical"`
	CriticalNotes string `gorm:"type:text" json:"critical_notes"`

	// Consultation-specific (SOAP — from Consultation model)
	ConsultantName  string  `gorm:"size:200" json:"consultant_name"`
	Specialty       string  `gorm:"size:100" json:"specialty"`
	Subjective      string  `gorm:"type:text" json:"subjective"`
	Objective       string  `gorm:"type:text" json:"objective"`
	Assessment      string  `gorm:"type:text" json:"assessment"`
	Plan            string  `gorm:"type:text" json:"plan"`
	Recommendation  string  `gorm:"type:text" json:"recommendation"`
	ConsultationFee float64 `gorm:"type:decimal(15,2);default:0" json:"consultation_fee"`

	// Surgery-specific
	SurgeonName    string     `gorm:"size:200" json:"surgeon_name"`
	AnesthesiaType string     `gorm:"size:100" json:"anesthesia_type"` // GA, RA, Local, Sedation
	ScheduledDate  *time.Time `json:"scheduled_date,omitempty"`

	// Fake Order Support
	IsFake   bool       `gorm:"default:false" json:"is_fake"`
	FakeDate *time.Time `json:"fake_date,omitempty"`

	// Relations — items within this order
	Items []EKlaimRMOrderItem `gorm:"foreignKey:EKlaimRMOrderID" json:"items,omitempty"`

	Sequence int `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMOrder) TableName() string {
	return "eklaim_rm_orders"
}

// EKlaimRMOrderItem mirrors ProcedureOrderItem — an individual procedure within an order.
// References the REAL Procedure from the master table so we can load its ProcedureParameters dynamically.
type EKlaimRMOrderItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimRMOrderID uint `gorm:"column:eklaim_rm_order_id;not null;index" json:"eklaim_rm_order_id"`

	// Procedure Reference (to REAL procedure from master table)
	ProcedureID   uint       `gorm:"not null;index" json:"procedure_id"`
	Procedure     *Procedure `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`
	ProcedureName string     `gorm:"size:300" json:"procedure_name"` // Cached name for display

	// Source Reference (null for fake orders)
	SourceItemID *uint `gorm:"index" json:"source_item_id"` // FK to ProcedureOrderItem

	Notes string `gorm:"type:text" json:"notes"`

	// Results per parameter
	Results []EKlaimRMOrderResult `gorm:"foreignKey:EKlaimRMOrderItemID" json:"results,omitempty"`

	Sequence int `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMOrderItem) TableName() string {
	return "eklaim_rm_order_items"
}

// EKlaimRMOrderResult mirrors ProcedureOrderResult — a single parameter result for an order item.
// References the REAL ProcedureParameter from the master table for dynamic rendering (unit, normal range, input type, etc.).
type EKlaimRMOrderResult struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimRMOrderItemID uint `gorm:"column:eklaim_rm_order_item_id;not null;index" json:"eklaim_rm_order_item_id"`

	// Parameter Reference (to REAL parameter from master table)
	ProcedureParameterID uint                `gorm:"not null;index" json:"procedure_parameter_id"`
	ProcedureParameter   *ProcedureParameter `gorm:"foreignKey:ProcedureParameterID" json:"procedure_parameter,omitempty"`
	ParameterName        string              `gorm:"size:200" json:"parameter_name"` // Cached name for display

	// Source Reference (null for fake orders)
	SourceResultID *uint `gorm:"index" json:"source_result_id"` // FK to ProcedureOrderResult

	// Value (same as ProcedureOrderResult)
	Value        string  `gorm:"type:text" json:"value"`
	NumericValue float64 `gorm:"type:decimal(15,4);default:0" json:"numeric_value"`

	// Status flags (for lab results — computed from ProcedureParameter normal/critical ranges)
	IsNormal   bool `gorm:"default:true" json:"is_normal"`
	IsLow      bool `gorm:"default:false" json:"is_low"`
	IsHigh     bool `gorm:"default:false" json:"is_high"`
	IsCritical bool `gorm:"default:false" json:"is_critical"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMOrderResult) TableName() string {
	return "eklaim_rm_order_results"
}

// EKlaimRMMedicineItem stores editable medicine/obat items for E-Klaim RM duplicate
type EKlaimRMMedicineItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	// Medicine Reference (to REAL medicine from master table, null for manually typed)
	MedicineID *uint     `gorm:"index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	// Source Reference (null for fake orders)
	SourceOrderID *uint  `gorm:"index" json:"source_order_id"` // FK to MedicineOrder
	SourceItemID  *uint  `gorm:"index" json:"source_item_id"`  // FK to MedicineOrderItem
	OrderNumber   string `gorm:"size:50" json:"order_number"`

	// Medicine Info
	MedicineName string `gorm:"size:300;not null" json:"medicine_name"` // Nama obat
	Dosage       string `gorm:"size:100" json:"dosage"`                 // Dosis (3x1, 2x2, dll)
	Frequency    string `gorm:"size:100" json:"frequency"`              // Frekuensi
	Route        string `gorm:"size:50" json:"route"`                   // Cara pakai (oral, IV, IM, dll)
	Quantity     int    `gorm:"default:0" json:"quantity"`              // Jumlah
	Unit         string `gorm:"size:50" json:"unit"`                    // Satuan (tablet, kapsul, botol, dll)
	Duration     string `gorm:"size:50" json:"duration"`                // Durasi (7 hari, 1 minggu)
	Instructions string `gorm:"type:text" json:"instructions"`          // Instruksi tambahan

	// Pricing for billing
	UnitPrice float64 `gorm:"type:decimal(15,2);default:0" json:"unit_price"` // Harga satuan
	SubTotal  float64 `gorm:"type:decimal(15,2);default:0" json:"sub_total"`  // Quantity * UnitPrice

	// Fake Order Support
	IsFake   bool       `gorm:"default:false" json:"is_fake"`
	FakeDate *time.Time `json:"fake_date,omitempty"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMMedicineItem) TableName() string {
	return "eklaim_rm_medicine_items"
}

// EKlaimRMMedicineItem remains as a flat model since Medicine uses a different system
// (MedicineOrder → MedicineOrderItem) that doesn't use ProcedureParameter.

// EKlaimRMCPPT stores editable CPPT entries for E-Klaim RM duplicate (inpatient)
type EKlaimRMCPPT struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	// Record Info
	RecordDate string `gorm:"size:100" json:"record_date"` // yyyy-mm-dd HH:mm:ss
	Profession string `gorm:"size:50" json:"profession"`  // dokter, perawat, bidan, gizi, farmasi, dll
	StaffName  string `gorm:"size:200" json:"staff_name"` // Nama petugas

	// SOAP Format
	Subjective  string `gorm:"type:text" json:"subjective"`
	Objective   string `gorm:"type:text" json:"objective"`
	Assessment  string `gorm:"type:text" json:"assessment"`
	Plan        string `gorm:"type:text" json:"plan"`
	Instruction string `gorm:"type:text" json:"instruction"`

	// Vital Signs (Optional)
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`
	HeartRate        int    `gorm:"default:0" json:"heart_rate,omitempty"`
	RespiratoryRate  int    `gorm:"default:0" json:"respiratory_rate,omitempty"`
	Temperature      string `gorm:"size:20" json:"temperature,omitempty"`
	OxygenSaturation int    `gorm:"default:0" json:"oxygen_saturation,omitempty"`
	PainScale        int    `gorm:"default:0" json:"pain_scale,omitempty"`

	// Fake Order Support
	IsFake bool `gorm:"default:false" json:"is_fake"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMCPPT) TableName() string {
	return "eklaim_rm_cppts"
}

// EKlaimRMFluidBalance stores editable fluid balance for E-Klaim RM duplicate (inpatient)
type EKlaimRMFluidBalance struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;index" json:"rm_duplicate_id"`

	// Record Period
	RecordDate string `gorm:"size:100" json:"record_date"` // yyyy-mm-dd
	ShiftType  string `gorm:"size:20" json:"shift_type"`  // pagi, siang, malam
	StaffName  string `gorm:"size:200" json:"staff_name"` // Nama petugas

	// Intake (ml)
	OralDrink    float64 `gorm:"type:decimal(10,2);default:0" json:"oral_drink"`
	OralFood     float64 `gorm:"type:decimal(10,2);default:0" json:"oral_food"`
	OralMedicine float64 `gorm:"type:decimal(10,2);default:0" json:"oral_medicine"`
	IVFluid      float64 `gorm:"type:decimal(10,2);default:0" json:"iv_fluid"`
	IVMedicine   float64 `gorm:"type:decimal(10,2);default:0" json:"iv_medicine"`
	BloodProduct float64 `gorm:"type:decimal(10,2);default:0" json:"blood_product"`
	EnteralFeed  float64 `gorm:"type:decimal(10,2);default:0" json:"enteral_feed"`
	OtherIntake  float64 `gorm:"type:decimal(10,2);default:0" json:"other_intake"`

	// Output (ml)
	UrineAmount float64 `gorm:"type:decimal(10,2);default:0" json:"urine_amount"`
	FecesAmount float64 `gorm:"type:decimal(10,2);default:0" json:"feces_amount"`
	VomitAmount float64 `gorm:"type:decimal(10,2);default:0" json:"vomit_amount"`
	DrainAmount float64 `gorm:"type:decimal(10,2);default:0" json:"drain_amount"`
	BloodLoss   float64 `gorm:"type:decimal(10,2);default:0" json:"blood_loss"`
	IWL         float64 `gorm:"type:decimal(10,2);default:0" json:"iwl"`
	OtherOutput float64 `gorm:"type:decimal(10,2);default:0" json:"other_output"`

	// Calculated
	TotalIntake float64 `gorm:"type:decimal(10,2);default:0" json:"total_intake"`
	TotalOutput float64 `gorm:"type:decimal(10,2);default:0" json:"total_output"`
	Balance     float64 `gorm:"type:decimal(10,2);default:0" json:"balance"`

	// Fake Order Support
	IsFake bool `gorm:"default:false" json:"is_fake"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMFluidBalance) TableName() string {
	return "eklaim_rm_fluid_balances"
}

// EKlaimRMBilling stores the duplicate billing for E-Klaim RM
// This is separate from the real Billing and used only for E-Klaim display/calculation
type EKlaimRMBilling struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"column:rm_duplicate_id;not null;uniqueIndex" json:"rm_duplicate_id"`

	// Billing amounts
	TotalAmount     float64 `gorm:"type:decimal(15,2);default:0" json:"total_amount"`     // Total dari semua item
	DiscountAmount  float64 `gorm:"type:decimal(15,2);default:0" json:"discount_amount"`  // Diskon
	DiscountReason  string  `gorm:"type:text" json:"discount_reason"`                     // Alasan diskon
	AdjustAmount    float64 `gorm:"type:decimal(15,2);default:0" json:"adjust_amount"`    // Penyesuaian (+ atau -)
	AdjustReason    string  `gorm:"type:text" json:"adjust_reason"`                       // Alasan penyesuaian
	FinalAmount     float64 `gorm:"type:decimal(15,2);default:0" json:"final_amount"`     // Final = Total - Discount + Adjust
	RemainingAmount float64 `gorm:"type:decimal(15,2);default:0" json:"remaining_amount"` // Remaining (untuk display saja)
	PaidAmount      float64 `gorm:"type:decimal(15,2);default:0" json:"paid_amount"`      // Paid (untuk display saja)

	// Notes
	Notes string `gorm:"type:text" json:"notes"`

	// Relations
	Items []EKlaimRMBillingItem `gorm:"foreignKey:EKlaimRMBillingID" json:"items,omitempty"`
}

func (EKlaimRMBilling) TableName() string {
	return "eklaim_rm_billings"
}

// CalculateTotals recalculates billing totals based on items
func (b *EKlaimRMBilling) CalculateTotals() {
	var total float64
	for _, item := range b.Items {
		total += item.Subtotal
	}
	b.TotalAmount = total
	b.FinalAmount = total - b.DiscountAmount + b.AdjustAmount
	b.RemainingAmount = b.FinalAmount - b.PaidAmount
}

// EKlaimRMBillingItem stores individual billing line items for E-Klaim RM
type EKlaimRMBillingItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	EKlaimRMBillingID uint `gorm:"column:eklaim_rm_billing_id;not null;index" json:"eklaim_rm_billing_id"`

	// Item Type: procedure, medicine
	ItemType string `gorm:"size:20;not null" json:"item_type"`

	// Reference to source (order item or medicine item)
	ReferenceID   uint   `gorm:"not null" json:"reference_id"`           // ID of EKlaimRMOrderItem or EKlaimRMMedicineItem
	ReferenceType string `gorm:"size:20;not null" json:"reference_type"` // order_item, medicine_item
	ReferenceCode string `gorm:"size:50" json:"reference_code"`          // Procedure code or medicine code

	// Item Details
	Description string  `gorm:"type:text;not null" json:"description"`          // Deskripsi item
	Quantity    int     `gorm:"default:1" json:"quantity"`                      // Jumlah
	Unit        string  `gorm:"size:50" json:"unit"`                            // Satuan
	UnitPrice   float64 `gorm:"type:decimal(15,2);default:0" json:"unit_price"` // Harga satuan
	Subtotal    float64 `gorm:"type:decimal(15,2);default:0" json:"subtotal"`   // Subtotal (Quantity * UnitPrice)

	// Performer info (optional)
	PerformedByID   *uint  `json:"performed_by_id"`
	PerformedByName string `gorm:"size:100" json:"performed_by_name"`
	PerformedByRole string `gorm:"size:50" json:"performed_by_role"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMBillingItem) TableName() string {
	return "eklaim_rm_billing_items"
}

// EKlaimLocalLog tracks all E-Klaim local server communication
type EKlaimLocalLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	EKlaimLocalID uint `gorm:"column:e_klaim_local_id;not null;index" json:"eklaim_local_id"`

	// Request
	Method      string `gorm:"size:50;not null" json:"method"` // new_claim, set_claim_data, grouper, etc.
	RequestBody string `gorm:"type:text" json:"request_body,omitempty"`

	// Response
	ResponseCode string `gorm:"size:10" json:"response_code"`
	ResponseBody string `gorm:"type:text" json:"response_body,omitempty"`
	ResponseTime int    `gorm:"column:response_time" json:"response_time_ms"` // ms

	// Status
	IsSuccess    bool   `gorm:"default:false" json:"is_success"`
	ErrorMessage string `gorm:"type:text" json:"error_message,omitempty"`

	// User
	UserID *uint `json:"user_id,omitempty"`
	User   *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (EKlaimLocalLog) TableName() string {
	return "eklaim_local_logs"
}
