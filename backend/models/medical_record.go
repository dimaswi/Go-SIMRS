package models

import (
	"time"

	"gorm.io/gorm"
)

// ===========================================================================
// TRIAGE - Khusus UGD/IGD
// ===========================================================================

// Triage represents emergency triage assessment
type Triage struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"` // One triage per visit
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Arrival Information
	ArrivalMode     string `gorm:"size:50" json:"arrival_mode,omitempty"`       // ambulans, pribadi, polisi, dll
	TriageComplaint string `gorm:"type:text" json:"triage_complaint,omitempty"` // Chief complaint saat triase
	TriageLevel     string `gorm:"size:20" json:"triage_level,omitempty"`       // 0-5 (ESI/ATS) - 0=DOA

	// Primary Survey (ABC)
	Airway          string `gorm:"size:100" json:"airway,omitempty"`            // Airway (clear/obstructed)
	AirwayNote      string `gorm:"type:text" json:"airway_note,omitempty"`      // Catatan airway
	Breathing       string `gorm:"size:100" json:"breathing,omitempty"`         // Breathing (spontaneous/assisted)
	BreathingNote   string `gorm:"type:text" json:"breathing_note,omitempty"`   // Catatan breathing
	BreathingRate   string `gorm:"size:20" json:"breathing_rate,omitempty"`     // x/menit - LOINC: 9279-1
	Circulation     string `gorm:"size:100" json:"circulation,omitempty"`       // Circulation (normal/shock)
	CirculationNote string `gorm:"type:text" json:"circulation_note,omitempty"` // Catatan circulation
	Akral           string `gorm:"size:50" json:"akral,omitempty"`              // Akral (hangat/dingin)
	CRT             string `gorm:"size:20" json:"crt,omitempty"`                // Capillary Refill Time

	// Neurological
	PupilLeft  string `gorm:"size:50" json:"pupil_left,omitempty"`  // Pupil kiri
	PupilRight string `gorm:"size:50" json:"pupil_right,omitempty"` // Pupil kanan
	GCSE       int    `gorm:"default:4" json:"gcs_e,omitempty"`     // Eye (1-4) - LOINC: 9267-6
	GCSV       int    `gorm:"default:5" json:"gcs_v,omitempty"`     // Verbal (1-5) - LOINC: 9270-0
	GCSM       int    `gorm:"default:6" json:"gcs_m,omitempty"`     // Motor (1-6) - LOINC: 9268-4

	// Vital Signs at Triage
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`    // mmHg
	HeartRate        string `gorm:"size:20" json:"heart_rate,omitempty"`        // x/menit
	Temperature      string `gorm:"size:20" json:"temperature,omitempty"`       // °C
	OxygenSaturation string `gorm:"size:20" json:"oxygen_saturation,omitempty"` // %
	PainScale        int    `gorm:"default:0" json:"pain_scale,omitempty"`      // 0-10

	// Assessment
	Consciousness    string `gorm:"size:50" json:"consciousness,omitempty"`       // composmentis/apatis/somnolen/sopor/koma
	TriageAssessment string `gorm:"type:text" json:"triage_assessment,omitempty"` // Penilaian awal
	ImmediateActions string `gorm:"type:text" json:"immediate_actions,omitempty"` // Tindakan segera

	// Audit
	TriagedByID *uint `gorm:"index" json:"triaged_by_id,omitempty"`
	TriagedBy   *User `gorm:"foreignKey:TriagedByID" json:"triaged_by,omitempty"`

	// SatuSehat Integration
	SatusehatVitalSignsSent bool       `gorm:"default:false" json:"satusehat_vital_signs_sent"` // Flag jika vital signs sudah dikirim
	SatusehatSentAt         *time.Time `json:"satusehat_sent_at,omitempty"`                     // Waktu kirim

	// SatuSehat ClinicalImpression - Asesmen Triage (khusus IGD)
	SatusehatClinicalImpressionTriageID string     `gorm:"size:100" json:"satusehat_ci_triage_id,omitempty"`
	SatusehatClinicalImpressionTriageAt *time.Time `json:"satusehat_ci_triage_at,omitempty"`
}

func (Triage) TableName() string {
	return "triages"
}

func (t *Triage) GCSTotal() int {
	return t.GCSE + t.GCSV + t.GCSM
}

// ===========================================================================
// ANAMNESIS
// ===========================================================================

// Anamnesis represents patient history taking
type Anamnesis struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Chief Complaint
	ChiefComplaint string `gorm:"type:text" json:"chief_complaint,omitempty"` // Keluhan utama

	// History
	HistoryOfPresentIllness string `gorm:"type:text" json:"history_of_present_illness,omitempty"` // Riwayat penyakit sekarang
	PastMedicalHistory      string `gorm:"type:text" json:"past_medical_history,omitempty"`       // Riwayat penyakit dahulu
	FamilyHistory           string `gorm:"type:text" json:"family_history,omitempty"`             // Riwayat penyakit keluarga
	SocialHistory           string `gorm:"type:text" json:"social_history,omitempty"`             // Riwayat sosial

	// Medications & Allergies
	Allergies          string `gorm:"type:text" json:"allergies,omitempty"`           // Alergi
	CurrentMedications string `gorm:"type:text" json:"current_medications,omitempty"` // Obat yang sedang dikonsumsi

	// Review of Systems
	ReviewOfSystems string `gorm:"type:text" json:"review_of_systems,omitempty"` // ROS

	// Audit
	RecordedByID *uint `gorm:"index" json:"recorded_by_id,omitempty"`
	RecordedBy   *User `gorm:"foreignKey:RecordedByID" json:"recorded_by,omitempty"`

	// SatuSehat Integration - MedicationStatement (riwayat obat yang sedang dikonsumsi)
	SatusehatMedicationStatementID string     `gorm:"size:100" json:"satusehat_medication_statement_id,omitempty"`
	SatusehatMedicationStatementAt *time.Time `json:"satusehat_medication_statement_at,omitempty"`
}

func (Anamnesis) TableName() string {
	return "anamneses"
}

// ===========================================================================
// PHYSICAL EXAMINATION
// ===========================================================================

// PhysicalExamination represents physical exam findings
type PhysicalExamination struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// General
	GeneralCondition string `gorm:"type:text" json:"general_condition,omitempty"` // Keadaan umum
	Consciousness    string `gorm:"size:50" json:"consciousness,omitempty"`       // Kesadaran

	// Vital Signs (LOINC Codes)
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`    // LOINC: 85354-9
	Systolic         int    `gorm:"default:0" json:"systolic,omitempty"`        // LOINC: 8480-6
	Diastolic        int    `gorm:"default:0" json:"diastolic,omitempty"`       // LOINC: 8462-4
	HeartRate        string `gorm:"size:20" json:"heart_rate,omitempty"`        // LOINC: 8867-4
	RespiratoryRate  string `gorm:"size:20" json:"respiratory_rate,omitempty"`  // LOINC: 9279-1
	Temperature      string `gorm:"size:20" json:"temperature,omitempty"`       // LOINC: 8310-5
	OxygenSaturation string `gorm:"size:20" json:"oxygen_saturation,omitempty"` // LOINC: 2708-6

	// Anthropometry
	Weight     string  `gorm:"size:20" json:"weight,omitempty"`      // LOINC: 29463-7
	Height     string  `gorm:"size:20" json:"height,omitempty"`      // LOINC: 8302-2
	BMI        float64 `gorm:"default:0" json:"bmi,omitempty"`       // LOINC: 39156-5
	Waist      string  `gorm:"size:20" json:"waist,omitempty"`       // LOINC: 8280-0
	HeadCircum string  `gorm:"size:20" json:"head_circum,omitempty"` // Lingkar kepala (pediatrik)

	// Physical Examination by System (legacy fields)
	HeadNeck      string `gorm:"type:text" json:"head_neck,omitempty"`
	Eyes          string `gorm:"type:text" json:"eyes,omitempty"`
	ENT           string `gorm:"type:text" json:"ent,omitempty"`
	Thorax        string `gorm:"type:text" json:"thorax,omitempty"`
	Cardiac       string `gorm:"type:text" json:"cardiac,omitempty"`
	Pulmonary     string `gorm:"type:text" json:"pulmonary,omitempty"`
	Abdomen       string `gorm:"type:text" json:"abdomen,omitempty"`
	Extremities   string `gorm:"type:text" json:"extremities,omitempty"`
	Skin          string `gorm:"type:text" json:"skin,omitempty"`
	Neurological  string `gorm:"type:text" json:"neurological,omitempty"`
	Musculoskel   string `gorm:"type:text" json:"musculoskel,omitempty"`
	Genitourinary string `gorm:"type:text" json:"genitourinary,omitempty"`
	OtherFindings string `gorm:"type:text" json:"other_findings,omitempty"`

	// Physical Examination by System (new fields matching frontend)
	Head   string `gorm:"type:text" json:"head,omitempty"`   // Kepala
	Ears   string `gorm:"type:text" json:"ears,omitempty"`   // Telinga
	Nose   string `gorm:"type:text" json:"nose,omitempty"`   // Hidung
	Throat string `gorm:"type:text" json:"throat,omitempty"` // Tenggorokan
	Neck   string `gorm:"type:text" json:"neck,omitempty"`   // Leher
	Chest  string `gorm:"type:text" json:"chest,omitempty"`  // Dada
	Heart  string `gorm:"type:text" json:"heart,omitempty"`  // Jantung
	Lungs  string `gorm:"type:text" json:"lungs,omitempty"`  // Paru

	// Supporting Examinations - ECG
	ECGPerformed      bool   `gorm:"default:false" json:"ecg_performed"`           // EKG dilakukan
	ECGResult         string `gorm:"type:text" json:"ecg_result,omitempty"`        // Hasil EKG
	ECGInterpretation string `gorm:"size:100" json:"ecg_interpretation,omitempty"` // Interpretasi (Normal/Abnormal)
	ECGNotes          string `gorm:"type:text" json:"ecg_notes,omitempty"`         // Catatan detail EKG

	// SatuSehat Integration
	SatusehatVitalSignsSent bool       `gorm:"default:false" json:"satusehat_vital_signs_sent"`
	SatusehatSentAt         *time.Time `gorm:"index" json:"satusehat_sent_at,omitempty"`

	// Audit
	ExaminedByID *uint `gorm:"index" json:"examined_by_id,omitempty"`
	ExaminedBy   *User `gorm:"foreignKey:ExaminedByID" json:"examined_by,omitempty"`
}

func (PhysicalExamination) TableName() string {
	return "physical_examinations"
}

// ===========================================================================
// DIAGNOSIS
// ===========================================================================

// Diagnosis represents a diagnosis entry (FHIR Condition compliant)
type Diagnosis struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"` // Multiple diagnoses per visit
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// ICD-10 Code
	ICD10Code string `gorm:"size:20;not null" json:"icd10_code"`
	ICD10Name string `gorm:"size:500;not null" json:"icd10_name"`

	// Classification
	Type string `gorm:"size:20;not null" json:"type"` // primary, secondary, complication

	// FHIR Condition Fields
	ClinicalStatus     string `gorm:"size:30;default:'active'" json:"clinical_status,omitempty"`        // active, recurrence, relapse, inactive, remission, resolved
	VerificationStatus string `gorm:"size:30;default:'confirmed'" json:"verification_status,omitempty"` // unconfirmed, provisional, differential, confirmed, refuted
	Severity           string `gorm:"size:20" json:"severity,omitempty"`                                // mild, moderate, severe

	// Additional Info
	BodySite  string     `gorm:"size:200" json:"body_site,omitempty"`
	OnsetDate *time.Time `gorm:"type:date" json:"onset_date,omitempty"`
	OnsetNote string     `gorm:"size:200" json:"onset_note,omitempty"`
	Note      string     `gorm:"type:text" json:"note,omitempty"`

	// SatuSehat Integration
	SatuSehatConditionID string     `gorm:"size:100" json:"satusehat_condition_id,omitempty"` // Condition ID dari SatuSehat
	SatuSehatSentAt      *time.Time `json:"satusehat_sent_at,omitempty"`                      // Waktu berhasil dikirim ke SatuSehat

	// Audit
	DiagnosedByID *uint `gorm:"index" json:"diagnosed_by_id,omitempty"`
	DiagnosedBy   *User `gorm:"foreignKey:DiagnosedByID" json:"diagnosed_by,omitempty"`
}

func (Diagnosis) TableName() string {
	return "diagnoses"
}

// DiagnosisSummary stores clinical impression and differential diagnosis per visit
type DiagnosisSummary struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	ClinicalImpression    string `gorm:"type:text" json:"clinical_impression,omitempty"`
	DifferentialDiagnosis string `gorm:"type:text" json:"differential_diagnosis,omitempty"`

	// SatuSehat Integration - Riwayat Perjalanan Penyakit
	SatusehatClinicalImpressionHistoryID string     `gorm:"size:100" json:"satusehat_ci_history_id,omitempty"`
	SatusehatClinicalImpressionHistoryAt *time.Time `json:"satusehat_ci_history_at,omitempty"`

	// Audit
	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

func (DiagnosisSummary) TableName() string {
	return "diagnosis_summaries"
}

// ===========================================================================
// CLINICAL ASSESSMENT & PLAN
// ===========================================================================

// AssessmentPlan represents clinical assessment and treatment plan
type AssessmentPlan struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Assessment
	ClinicalAssessment string `gorm:"type:text" json:"clinical_assessment,omitempty"` // Kesan klinis
	Prognosis          string `gorm:"type:text" json:"prognosis,omitempty"`           // Prognosis

	// Plan
	TreatmentPlan    string `gorm:"type:text" json:"treatment_plan,omitempty"`    // Rencana terapi
	MedicationPlan   string `gorm:"type:text" json:"medication_plan,omitempty"`   // Rencana obat
	DietPlan         string `gorm:"type:text" json:"diet_plan,omitempty"`         // Rencana diet
	ActivityPlan     string `gorm:"type:text" json:"activity_plan,omitempty"`     // Rencana aktivitas
	EducationPlan    string `gorm:"type:text" json:"education_plan,omitempty"`    // Edukasi
	MonitoringPlan   string `gorm:"type:text" json:"monitoring_plan,omitempty"`   // Rencana monitoring
	ProcedurePlan    string `gorm:"type:text" json:"procedure_plan,omitempty"`    // Rencana tindakan
	ConsultationPlan string `gorm:"type:text" json:"consultation_plan,omitempty"` // Rencana konsultasi

	// SatuSehat Integration - Rasional Klinis & Prognosis
	SatusehatClinicalImpressionRationaleID string     `gorm:"size:100" json:"satusehat_ci_rationale_id,omitempty"`
	SatusehatClinicalImpressionRationaleAt *time.Time `json:"satusehat_ci_rationale_at,omitempty"`
	SatusehatClinicalImpressionPrognosisID string     `gorm:"size:100" json:"satusehat_ci_prognosis_id,omitempty"`
	SatusehatClinicalImpressionPrognosisAt *time.Time `json:"satusehat_ci_prognosis_at,omitempty"`

	// SatuSehat Integration - CarePlan (Rencana Pengobatan)
	SatusehatCarePlanID string     `gorm:"size:100" json:"satusehat_careplan_id,omitempty"`
	SatusehatCarePlanAt *time.Time `json:"satusehat_careplan_at,omitempty"`

	// Audit
	AssessedByID *uint `gorm:"index" json:"assessed_by_id,omitempty"`
	AssessedBy   *User `gorm:"foreignKey:AssessedByID" json:"assessed_by,omitempty"`
}

func (AssessmentPlan) TableName() string {
	return "assessment_plans"
}

// ===========================================================================
// DISPOSITION / DISCHARGE
// ===========================================================================

// Disposition represents patient discharge/disposition
type Disposition struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;uniqueIndex" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Disposition Type
	DispositionType    string `gorm:"size:50;not null" json:"disposition_type"` // pulang, rawat_inap, rawat_jalan, rujuk, meninggal, aps, dod
	DispositionNote    string `gorm:"type:text" json:"disposition_note,omitempty"`
	DischargeStatus    string `gorm:"size:50" json:"discharge_status,omitempty"`    // sembuh, membaik, belum_sembuh, dll
	DischargeCondition string `gorm:"size:50" json:"discharge_condition,omitempty"` // pulang_sehat, pindah_rs, meninggal, dll

	// Discharge Instructions
	DischargeInstruction string `gorm:"type:text" json:"discharge_instruction,omitempty"`
	DischargeMedication  string `gorm:"type:text" json:"discharge_medication,omitempty"`

	// Follow Up / Kontrol
	FollowUpDate        *time.Time `gorm:"type:date" json:"follow_up_date,omitempty"`
	FollowUpInstruction string     `gorm:"type:text" json:"follow_up_instruction,omitempty"`
	FollowUpRoomID      *uint      `gorm:"index" json:"follow_up_room_id,omitempty"` // Poli tujuan kontrol
	FollowUpRoom        *Room      `gorm:"foreignKey:FollowUpRoomID" json:"follow_up_room,omitempty"`

	// Referral (if disposition is rujuk)
	ReferralFacility   string `gorm:"size:200" json:"referral_facility,omitempty"`
	ReferralAddress    string `gorm:"type:text" json:"referral_address,omitempty"`    // Alamat fasilitas rujukan
	ReferralPhone      string `gorm:"size:50" json:"referral_phone,omitempty"`        // Telepon fasilitas rujukan
	ReferralSpecialist string `gorm:"size:100" json:"referral_specialist,omitempty"`  // Spesialis tujuan (Sp.PD, Sp.JP, dll)
	ReferralReason     string `gorm:"type:text" json:"referral_reason,omitempty"`     // Alasan rujukan
	ReferralUrgency    string `gorm:"size:50" json:"referral_urgency,omitempty"`      // cito, urgent, elektif
	ReferralDiagnosis  string `gorm:"type:text" json:"referral_diagnosis,omitempty"`  // Diagnosis untuk surat rujukan
	ReferralTherapy    string `gorm:"type:text" json:"referral_therapy,omitempty"`    // Terapi yang sudah diberikan
	ReferralLabResult  string `gorm:"type:text" json:"referral_lab_result,omitempty"` // Hasil lab penting untuk rujukan
	ReferralNotes      string `gorm:"type:text" json:"referral_notes,omitempty"`      // Catatan tambahan untuk RS tujuan

	// Admission / Rawat Inap (if disposition is rawat_inap)
	AdmissionType   string `gorm:"size:50" json:"admission_type,omitempty"`  // elektif, emergency
	AdmissionWard   string `gorm:"size:100" json:"admission_ward,omitempty"` // Nama ruangan (untuk catatan)
	AdmissionReason string `gorm:"type:text" json:"admission_reason,omitempty"`
	AdmissionRoomID *uint  `gorm:"index" json:"admission_room_id,omitempty"` // Room ID rawat inap
	AdmissionRoom   *Room  `gorm:"foreignKey:AdmissionRoomID" json:"admission_room,omitempty"`
	AdmissionBedID  *uint  `gorm:"index" json:"admission_bed_id,omitempty"` // Bed ID yang dipilih
	AdmissionBed    *Bed   `gorm:"foreignKey:AdmissionBedID" json:"admission_bed,omitempty"`

	// Death Info (if disposition is meninggal or dod)
	DeathTime  *time.Time `json:"death_time,omitempty"`
	DeathCause string     `gorm:"type:text" json:"death_cause,omitempty"`

	// Created inpatient visit (for tracking)
	InpatientVisitID *uint  `gorm:"index" json:"inpatient_visit_id,omitempty"`
	InpatientVisit   *Visit `gorm:"foreignKey:InpatientVisitID" json:"inpatient_visit,omitempty"`

	// Created outpatient visit (for UGD → Rawat Jalan transfer)
	OutpatientVisitID *uint  `gorm:"index" json:"outpatient_visit_id,omitempty"`
	OutpatientVisit   *Visit `gorm:"foreignKey:OutpatientVisitID" json:"outpatient_visit,omitempty"`
	OutpatientRoomID  *uint  `gorm:"index" json:"outpatient_room_id,omitempty"`
	OutpatientRoom    *Room  `gorm:"foreignKey:OutpatientRoomID" json:"outpatient_room,omitempty"`
	TransferReason    string `gorm:"type:text" json:"transfer_reason,omitempty"`

	// Created follow-up registration (for tracking)
	FollowUpRegistrationID *uint         `gorm:"index" json:"follow_up_registration_id,omitempty"`
	FollowUpRegistration   *Registration `gorm:"foreignKey:FollowUpRegistrationID" json:"follow_up_registration,omitempty"`

	// Audit
	DischargedByID *uint `gorm:"index" json:"discharged_by_id,omitempty"`
	DischargedBy   *User `gorm:"foreignKey:DischargedByID" json:"discharged_by,omitempty"`

	// SatuSehat Integration - CarePlan (Rencana Tindak Lanjut / Discharge)
	SatusehatCarePlanID string     `gorm:"size:100" json:"satusehat_careplan_id,omitempty"`
	SatusehatCarePlanAt *time.Time `json:"satusehat_careplan_at,omitempty"`
}

func (Disposition) TableName() string {
	return "dispositions"
}

// ===========================================================================
// VITAL SIGNS HISTORY (Optional - untuk tracking vital signs berkala)
// ===========================================================================

// VitalSign represents a single vital sign measurement
type VitalSign struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"` // Multiple readings per visit
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Vital Signs
	BloodPressure    string `gorm:"size:20" json:"blood_pressure,omitempty"`
	Systolic         int    `gorm:"default:0" json:"systolic,omitempty"`
	Diastolic        int    `gorm:"default:0" json:"diastolic,omitempty"`
	HeartRate        int    `gorm:"default:0" json:"heart_rate,omitempty"`
	RespiratoryRate  int    `gorm:"default:0" json:"respiratory_rate,omitempty"`
	Temperature      string `gorm:"size:10" json:"temperature,omitempty"`
	OxygenSaturation int    `gorm:"default:0" json:"oxygen_saturation,omitempty"`
	PainScale        int    `gorm:"default:0" json:"pain_scale,omitempty"`

	// Timing
	MeasuredAt time.Time `json:"measured_at"`

	// Audit
	MeasuredByID *uint `gorm:"index" json:"measured_by_id,omitempty"`
	MeasuredBy   *User `gorm:"foreignKey:MeasuredByID" json:"measured_by,omitempty"`

	// Notes
	Note string `gorm:"type:text" json:"note,omitempty"`
}

func (VitalSign) TableName() string {
	return "vital_signs"
}

// ===========================================================================
// SURAT KETERANGAN SAKIT
// ===========================================================================

// SickLetter represents a sick leave certificate
type SickLetter struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Letter Details
	LetterNumber string    `gorm:"size:50" json:"letter_number,omitempty"` // Nomor surat
	StartDate    time.Time `json:"start_date"`                             // Tanggal mulai sakit
	EndDate      time.Time `json:"end_date"`                               // Tanggal selesai sakit
	Days         int       `gorm:"not null" json:"days"`                   // Jumlah hari sakit
	Reason       string    `gorm:"type:text" json:"reason,omitempty"`      // Alasan/keterangan tambahan
	Purpose      string    `gorm:"size:100" json:"purpose,omitempty"`      // Keperluan (sekolah, kerja, dll)
	Institution  string    `gorm:"size:200" json:"institution,omitempty"`  // Nama institusi tujuan
	Notes        string    `gorm:"type:text" json:"notes,omitempty"`       // Catatan tambahan

	// Status
	Status string `gorm:"size:20;default:'active'" json:"status"` // active, revoked

	// Audit
	IssuedByID *uint     `gorm:"index" json:"issued_by_id,omitempty"`
	IssuedBy   *Employee `gorm:"foreignKey:IssuedByID" json:"issued_by,omitempty"`
	IssuedAt   time.Time `json:"issued_at"`
}

func (SickLetter) TableName() string {
	return "sick_letters"
}

// DeathCertificate represents a death certificate (Surat Kematian)
// Used for: DOA (Dead on Arrival), DOD (Death on Departure at ED), and death during hospitalization
type DeathCertificate struct {
	ID      uint  `gorm:"primaryKey" json:"id"`
	VisitID uint  `gorm:"not null;index" json:"visit_id"`
	Visit   Visit `gorm:"foreignKey:VisitID" json:"-"`

	// Certificate number (auto-generated)
	CertificateNumber string `gorm:"size:50;uniqueIndex" json:"certificate_number"`

	// Death type: doa (Dead on Arrival), dod (Death on Departure at ED), inpatient_death (Meninggal saat rawat inap)
	DeathType string `gorm:"size:30;not null" json:"death_type"`

	// Time of death
	DeathDateTime time.Time `gorm:"not null" json:"death_datetime"`

	// Location of death
	DeathLocation string `gorm:"size:200" json:"death_location,omitempty"` // e.g., "IGD", "Ruang ICU", "Ruang Rawat Inap Kelas 1"

	// Primary cause of death (ICD-10)
	PrimaryCauseCode string `gorm:"size:20" json:"primary_cause_code,omitempty"`  // ICD-10 code
	PrimaryCauseName string `gorm:"size:500" json:"primary_cause_name,omitempty"` // ICD-10 name/description

	// Secondary/contributing causes
	SecondaryCauseCode string `gorm:"size:20" json:"secondary_cause_code,omitempty"`
	SecondaryCauseName string `gorm:"size:500" json:"secondary_cause_name,omitempty"`

	// Underlying cause (for chain of events)
	UnderlyingCauseCode string `gorm:"size:20" json:"underlying_cause_code,omitempty"`
	UnderlyingCauseName string `gorm:"size:500" json:"underlying_cause_name,omitempty"`

	// Manner of death: natural, accident, suicide, homicide, undetermined, pending
	MannerOfDeath string `gorm:"size:30" json:"manner_of_death,omitempty"`

	// Duration of illness (how long patient was sick before death)
	DurationOfIllness string `gorm:"size:100" json:"duration_of_illness,omitempty"`

	// Autopsy information
	AutopsyPerformed bool   `gorm:"default:false" json:"autopsy_performed"`
	AutopsyFindings  string `gorm:"type:text" json:"autopsy_findings,omitempty"`

	// Attending physician who declared death
	DeclaringDoctorID   *uint     `gorm:"index" json:"declaring_doctor_id,omitempty"`
	DeclaringDoctor     *Employee `gorm:"foreignKey:DeclaringDoctorID" json:"declaring_doctor,omitempty"`
	DeclaringDoctorName string    `gorm:"size:200" json:"declaring_doctor_name,omitempty"` // Backup name if doctor not in system

	// Witness information (optional)
	WitnessName     string `gorm:"size:200" json:"witness_name,omitempty"`
	WitnessRelation string `gorm:"size:100" json:"witness_relation,omitempty"` // e.g., "Anak", "Suami", "Perawat"

	// Additional notes
	Notes string `gorm:"type:text" json:"notes,omitempty"`

	// Status
	Status string `gorm:"size:20;default:'active'" json:"status"` // active, revoked

	// Audit
	IssuedByID *uint      `gorm:"index" json:"issued_by_id,omitempty"`
	IssuedBy   *Employee  `gorm:"foreignKey:IssuedByID" json:"issued_by,omitempty"`
	IssuedAt   time.Time  `json:"issued_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	DeletedAt  *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

func (DeathCertificate) TableName() string {
	return "death_certificates"
}

// ===========================================================================
// MEDICAL RECORD EDIT LOG - Track edits after visit completed
// ===========================================================================

// MedicalRecordEditLog tracks when medical records are edited after patient discharge
type MedicalRecordEditLog struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Reference
	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// What was edited
	RecordType string `gorm:"size:50;not null" json:"record_type"` // triage, anamnesis, physical_exam, diagnosis, assessment_plan, cppt, etc.
	RecordID   uint   `gorm:"not null" json:"record_id"`           // ID of the record being edited

	// Edit details
	Action     string `gorm:"size:20;not null" json:"action"`    // edit, create, delete
	FieldsJSON string `gorm:"type:text" json:"fields_json"`      // JSON of changed fields (optional, for detail tracking)
	Reason     string `gorm:"type:text" json:"reason,omitempty"` // Reason for editing after discharge
	Notes      string `gorm:"type:text" json:"notes,omitempty"`  // Additional notes

	// Who edited
	EditedByID uint      `gorm:"not null;index" json:"edited_by_id"`
	EditedBy   *User     `gorm:"foreignKey:EditedByID" json:"edited_by,omitempty"`
	EditedAt   time.Time `gorm:"not null" json:"edited_at"`

	// IP Address for audit
	IPAddress string `gorm:"size:50" json:"ip_address,omitempty"`
}

func (MedicalRecordEditLog) TableName() string {
	return "medical_record_edit_logs"
}
