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
	TglMasuk        string  `gorm:"size:10" json:"tgl_masuk"`        // yyyy-mm-dd
	TglPulang       string  `gorm:"size:10" json:"tgl_pulang"`       // yyyy-mm-dd
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
	Allergies               string `gorm:"type:text" json:"allergies"`
	CurrentMedications      string `gorm:"type:text" json:"current_medications"`

	// ===== PEMERIKSAAN FISIK / VITAL SIGNS (Editable copy) =====
	GeneralCondition string  `gorm:"type:text" json:"general_condition"`
	Consciousness    string  `gorm:"size:50" json:"consciousness"`
	BloodPressure    string  `gorm:"size:20" json:"blood_pressure"`
	Systolic         int     `json:"systolic"`
	Diastolic        int     `json:"diastolic"`
	HeartRate        string  `gorm:"size:20" json:"heart_rate"`
	RespiratoryRate  string  `gorm:"size:20" json:"respiratory_rate"`
	Temperature      string  `gorm:"size:20" json:"temperature"`
	OxygenSaturation string  `gorm:"size:20" json:"oxygen_saturation"`
	Weight           string  `gorm:"size:20" json:"weight"`
	Height           string  `gorm:"size:20" json:"height"`
	BMI              float64 `json:"bmi"`

	// Body System Examinations
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

	// ===== ASSESSMENT & PLAN (Editable copy) =====
	ClinicalAssessment string `gorm:"type:text" json:"clinical_assessment"`
	Prognosis          string `gorm:"type:text" json:"prognosis"`
	TreatmentPlan      string `gorm:"type:text" json:"treatment_plan"`
	MedicationPlan     string `gorm:"type:text" json:"medication_plan"`

	// ===== DISPOSITION (Editable copy) =====
	DispositionType      string `gorm:"size:50" json:"disposition_type"`
	DischargeStatus      string `gorm:"size:50" json:"rm_discharge_status"`
	DischargeCondition   string `gorm:"size:50" json:"discharge_condition"`
	DischargeInstruction string `gorm:"type:text" json:"discharge_instruction"`
	FollowUpInstruction  string `gorm:"type:text" json:"follow_up_instruction"`

	// Editable Diagnoses (E-Klaim version)
	Diagnoses []EKlaimRMDiagnosis `gorm:"foreignKey:RMDuplicateID" json:"diagnoses,omitempty"`

	// Editable Procedures (E-Klaim version)
	Procedures []EKlaimRMProcedure `gorm:"foreignKey:RMDuplicateID" json:"procedures,omitempty"`

	// Editable Lab Results (E-Klaim version)
	LabResults []EKlaimRMLabResult `gorm:"foreignKey:RMDuplicateID" json:"lab_results,omitempty"`

	// Editable Radiology Results (E-Klaim version)
	RadiologyResults []EKlaimRMRadiologyResult `gorm:"foreignKey:RMDuplicateID" json:"radiology_results,omitempty"`

	// Editable Surgery Notes (E-Klaim version)
	SurgeryNotes []EKlaimRMSurgeryNote `gorm:"foreignKey:RMDuplicateID" json:"surgery_notes,omitempty"`

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

	RMDuplicateID uint `gorm:"not null;index" json:"rm_duplicate_id"`

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

	RMDuplicateID uint `gorm:"not null;index" json:"rm_duplicate_id"`

	ICD9Code     string `gorm:"size:20;not null" json:"icd9_code"`
	Name         string `gorm:"size:500" json:"name"`
	Multiplicity int    `gorm:"default:1" json:"multiplicity"`
	Setting      string `gorm:"size:20;default:'NON_OR'" json:"setting"` // OR, NON_OR, ICU, etc
	Sequence     int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMProcedure) TableName() string {
	return "eklaim_rm_procedures"
}

// EKlaimRMLabResult stores editable lab results for E-Klaim RM duplicate
type EKlaimRMLabResult struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"not null;index" json:"rm_duplicate_id"`

	// Source Reference
	OrderNumber   string `gorm:"size:50" json:"order_number"`     // from ProcedureOrder
	OrderItemName string `gorm:"size:200" json:"order_item_name"` // Nama pemeriksaan (e.g. "Hematologi Lengkap")

	// Result Details
	ParameterName  string `gorm:"size:200;not null" json:"parameter_name"` // e.g. "Hemoglobin", "WBC"
	Value          string `gorm:"size:100" json:"value"`                   // Result value
	Unit           string `gorm:"size:50" json:"unit"`                     // e.g. "g/dL", "10^3/uL"
	ReferenceRange string `gorm:"size:100" json:"reference_range"`         // e.g. "12.0 - 16.0"
	IsAbnormal     bool   `gorm:"default:false" json:"is_abnormal"`
	IsCritical     bool   `gorm:"default:false" json:"is_critical"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMLabResult) TableName() string {
	return "eklaim_rm_lab_results"
}

// EKlaimRMRadiologyResult stores editable radiology results for E-Klaim RM duplicate
type EKlaimRMRadiologyResult struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"not null;index" json:"rm_duplicate_id"`

	// Source Reference
	OrderNumber   string `gorm:"size:50" json:"order_number"`
	ProcedureName string `gorm:"size:200" json:"procedure_name"` // e.g. "Rontgen Thorax AP"

	// Results
	ResultSummary string `gorm:"type:text" json:"result_summary"` // Ringkasan / Deskripsi
	Conclusion    string `gorm:"type:text" json:"conclusion"`     // Kesan / Kesimpulan
	Suggestion    string `gorm:"type:text" json:"suggestion"`     // Saran
	IsCritical    bool   `gorm:"default:false" json:"is_critical"`

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMRadiologyResult) TableName() string {
	return "eklaim_rm_radiology_results"
}

// EKlaimRMSurgeryNote stores editable surgery/operation notes for E-Klaim RM duplicate
type EKlaimRMSurgeryNote struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RMDuplicateID uint `gorm:"not null;index" json:"rm_duplicate_id"`

	// Source Reference
	OrderNumber   string `gorm:"size:50" json:"order_number"`
	ProcedureName string `gorm:"size:200" json:"procedure_name"` // e.g. "Appendectomy"

	// Surgery Details
	SurgeonName       string `gorm:"size:200" json:"surgeon_name"`
	AnesthesiaType    string `gorm:"size:100" json:"anesthesia_type"` // GA, RA, Local, Sedation
	PreOpDiagnosis    string `gorm:"type:text" json:"pre_op_diagnosis"`
	PostOpDiagnosis   string `gorm:"type:text" json:"post_op_diagnosis"`
	OperativeFindings string `gorm:"type:text" json:"operative_findings"`
	ProcedureDesc     string `gorm:"type:text" json:"procedure_desc"` // Laporan operasi detail
	Complications     string `gorm:"type:text" json:"complications"`
	BloodLoss         string `gorm:"size:50" json:"blood_loss"` // e.g. "200 ml"
	Duration          string `gorm:"size:50" json:"duration"`   // e.g. "2 jam 30 menit"
	Implants          string `gorm:"type:text" json:"implants"` // Implant yang digunakan

	Notes    string `gorm:"type:text" json:"notes"`
	Sequence int    `gorm:"default:0" json:"sequence"`
}

func (EKlaimRMSurgeryNote) TableName() string {
	return "eklaim_rm_surgery_notes"
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
