package models

import (
	"time"

	"gorm.io/gorm"
)

// BPJSReferral stores local copies of VClaim referral transactions (v1/v2/khusus).
type BPJSReferral struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	NoRujukan            string `gorm:"size:60;not null;uniqueIndex" json:"no_rujukan"`
	NoSEP                string `gorm:"size:50;index" json:"no_sep,omitempty"`
	Version              string `gorm:"size:10;index" json:"version,omitempty"` // v1, v2
	TglRujukan           string `gorm:"size:10" json:"tgl_rujukan,omitempty"`
	TglRencanaKunjungan  string `gorm:"size:10" json:"tgl_rencana_kunjungan,omitempty"`
	PPKDirujuk           string `gorm:"size:20;index" json:"ppk_dirujuk,omitempty"`
	NamaPPKDirujuk       string `gorm:"size:200" json:"nama_ppk_dirujuk,omitempty"`
	JnsPelayanan         string `gorm:"size:5" json:"jns_pelayanan,omitempty"`
	Catatan              string `gorm:"type:text" json:"catatan,omitempty"`
	DiagRujukan          string `gorm:"size:20" json:"diag_rujukan,omitempty"`
	DiagRujukanNama      string `gorm:"size:255" json:"diag_rujukan_nama,omitempty"`
	TipeRujukan          string `gorm:"size:5" json:"tipe_rujukan,omitempty"`
	PoliRujukan          string `gorm:"size:50" json:"poli_rujukan,omitempty"`
	PoliRujukanNama      string `gorm:"size:200" json:"poli_rujukan_nama,omitempty"`
	NoKartu              string `gorm:"size:20;index" json:"no_kartu,omitempty"`
	NamaPeserta          string `gorm:"size:200" json:"nama_peserta,omitempty"`
	Status               string `gorm:"size:20;default:'active';index" json:"status"`
	UserBuat             string `gorm:"size:50" json:"user_buat,omitempty"`
	IsKhusus             bool   `gorm:"default:false" json:"is_khusus"`
	KhususIDRujukan      string `gorm:"size:60" json:"khusus_id_rujukan,omitempty"`
	KhususDiagnosaCodes  string `gorm:"type:text" json:"khusus_diagnosa_codes,omitempty"`
	KhususProcedureCodes string `gorm:"type:text" json:"khusus_procedure_codes,omitempty"`

	VisitID        *uint         `gorm:"index" json:"visit_id,omitempty"`
	Visit          *Visit        `gorm:"foreignKey:VisitID" json:"visit,omitempty"`
	RegistrationID *uint         `gorm:"index" json:"registration_id,omitempty"`
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`
	PatientID      *uint         `gorm:"index" json:"patient_id,omitempty"`
	Patient        *Patient      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	SEPID          *uint         `gorm:"index" json:"sep_id,omitempty"`
	SEP            *SEP          `gorm:"foreignKey:SEPID" json:"sep,omitempty"`
}

func (BPJSReferral) TableName() string {
	return "bpjs_referrals"
}
