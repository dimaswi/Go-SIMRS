package models

import (
	"time"

	"gorm.io/gorm"
)

// SignatureLog tracks all document signing activities
// This provides non-repudiation evidence that user acknowledged signing the document
type SignatureLog struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Who signed
	UserID uint  `gorm:"not null;index" json:"user_id"`
	User   *User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// What was signed
	DocumentType string `gorm:"size:50;not null;index" json:"document_type"` // visit_resume, prescription, lab_result, sick_letter, death_certificate, referral, consent, cppt, etc.
	DocumentID   uint   `gorm:"not null;index" json:"document_id"`           // ID of the document being signed
	VisitID      *uint  `gorm:"index" json:"visit_id,omitempty"`             // Optional visit reference
	Visit        *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Signature details
	SignedAt      time.Time `gorm:"not null;index" json:"signed_at"`         // When signed
	SignatureHash string    `gorm:"size:128;not null" json:"signature_hash"` // SHA256 hash of document content + user + timestamp
	Action        string    `gorm:"size:20;not null" json:"action"`          // sign, revoke, countersign

	// Signer information at time of signing (snapshot for legal purposes)
	SignerName       string `gorm:"size:150" json:"signer_name"`               // Full name
	SignerNIP        string `gorm:"size:50" json:"signer_nip,omitempty"`       // NIP
	SignerSTR        string `gorm:"size:50" json:"signer_str,omitempty"`       // STR number
	SignerSIP        string `gorm:"size:50" json:"signer_sip,omitempty"`       // SIP number
	SignerRole       string `gorm:"size:100" json:"signer_role,omitempty"`     // Role/Position
	SignerEmployeeID *uint  `gorm:"index" json:"signer_employee_id,omitempty"` // Employee ID if applicable

	// Security/Audit
	IPAddress string `gorm:"size:50" json:"ip_address,omitempty"`
	UserAgent string `gorm:"type:text" json:"user_agent,omitempty"`

	// Notes
	Notes string `gorm:"type:text" json:"notes,omitempty"` // Optional notes
}

func (SignatureLog) TableName() string {
	return "signature_logs"
}

// DocumentSignature stores signature status for documents
// This is a quick lookup table to check if a document is signed
type DocumentSignature struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	DocumentType string `gorm:"size:50;not null;uniqueIndex:idx_doc_signature" json:"document_type"`
	DocumentID   uint   `gorm:"not null;uniqueIndex:idx_doc_signature" json:"document_id"`

	// Primary signature
	SignedAt      *time.Time `json:"signed_at,omitempty"`
	SignedByID    *uint      `gorm:"index" json:"signed_by_id,omitempty"`
	SignedBy      *User      `gorm:"foreignKey:SignedByID" json:"signed_by,omitempty"`
	SignatureHash string     `gorm:"size:128" json:"signature_hash,omitempty"`

	// Is document locked from further edits?
	IsLocked bool `gorm:"default:false" json:"is_locked"`
}

func (DocumentSignature) TableName() string {
	return "document_signatures"
}

// Document type constants for signature
const (
	DocTypeVisitResume        = "visit_resume"        // Resume Rawat Jalan/Inap
	DocTypePrescription       = "prescription"        // Resep Obat
	DocTypeLabResult          = "lab_result"          // Hasil Laboratorium
	DocTypeRadiologyResult    = "radiology_result"    // Hasil Radiologi
	DocTypeSickLetter         = "sick_letter"         // Surat Keterangan Sakit
	DocTypeHealthCertificate  = "health_certificate"  // Surat Keterangan Sehat
	DocTypeBirthCertificate   = "birth_certificate"   // Surat Keterangan Kelahiran
	DocTypeLeaveCertificate   = "leave_certificate"   // Surat Keterangan Cuti
	DocTypeMCUCertificate     = "mcu_certificate"     // Surat Keterangan MCU
	DocTypeDeathCertificate   = "death_certificate"   // Surat Kematian
	DocTypeReferralLetter     = "referral_letter"     // Surat Rujukan
	DocTypeGeneralConsent     = "general_consent"     // General Consent
	DocTypeInformedConsent    = "informed_consent"    // Informed Consent
	DocTypeCPPT               = "cppt"                // CPPT
	DocTypeNursingCare        = "nursing_care"        // Asuhan Keperawatan
	DocTypeTriage             = "triage"              // Form Triage
	DocTypeEmergencySummary   = "emergency_summary"   // Ringkasan UGD
	DocTypeOperativeReport    = "operative_report"    // Laporan Operasi
	DocTypeConsultationResult = "consultation_result" // Hasil Konsultasi
	DocTypeInpatientCert      = "inpatient_cert"      // Surat Keterangan Rawat Inap
	DocTypePharmacyHandover   = "pharmacy_handover"   // Serah Terima Obat
	DocTypeRegistration       = "registration"        // Bukti Registrasi
	DocTypeSPRI               = "spri"                // SPRI (Surat Perintah Rawat Inap)
	DocTypeSuratKontrol       = "surat_kontrol"       // Surat Kontrol / SKDP

	// RM Duplicate (E-Klaim) document types
	DocTypeRMDupLabResult       = "rm_dup_lab_result"       // Hasil Lab RM Duplikat
	DocTypeRMDupRadResult       = "rm_dup_radiology_result" // Hasil Radiologi RM Duplikat
	DocTypeRMDupSurgeryReport   = "rm_dup_surgery_report"   // Laporan Operasi RM Duplikat
	DocTypeRMDupConsultation    = "rm_dup_consultation"     // Hasil Konsultasi RM Duplikat
	DocTypeRMDupResume          = "rm_dup_resume"           // Resume Medis RM Duplikat
	DocTypeRMDupInpatientResume = "rm_dup_inpatient_resume" // Resume Rawat Inap RM Duplikat
	DocTypeRMDupReferral        = "rm_dup_referral"         // Surat Rujukan RM Duplikat
	DocTypeRMDupTriage          = "rm_dup_triage"           // Triage UGD RM Duplikat
	DocTypeRMDupEmergency       = "rm_dup_emergency"        // Ringkasan UGD RM Duplikat
	DocTypeRMDupCPPT            = "rm_dup_cppt"             // CPPT RM Duplikat
	DocTypeRMDupFluidBalance    = "rm_dup_fluid_balance"    // Balance Cairan RM Duplikat
	DocTypeRMDupPrescription    = "rm_dup_prescription"     // Resep Obat RM Duplikat
	DocTypeRMDupSEP             = "rm_dup_sep"              // SEP RM Duplikat
	DocTypeRMDupAdmission       = "rm_dup_admission"        // Ringkasan Masuk Keluar RM Duplikat
	DocTypeRMDupRegistration    = "rm_dup_registration"     // Bukti Registrasi RM Duplikat
	DocTypeRMDupConsent         = "rm_dup_consent"          // Informed Consent RM Duplikat
	DocTypeRMDupNursingCare     = "rm_dup_nursing_care"     // Asuhan Keperawatan RM Duplikat
	DocTypeRMDupBedTransfer     = "rm_dup_bed_transfer"     // Mutasi Pasien RM Duplikat
	DocTypeRMDupVitalSign       = "rm_dup_vital_sign"       // Grafik Tanda Vital RM Duplikat
	DocTypeRMDupInpatientCert   = "rm_dup_inpatient_cert"   // Surat Rawat Inap RM Duplikat
)

// Signature action constants
const (
	SignActionSign        = "sign"        // Sign document
	SignActionRevoke      = "revoke"      // Revoke signature
	SignActionCountersign = "countersign" // Counter-signature (additional signer)
)
