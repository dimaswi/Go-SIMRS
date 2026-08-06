package models

import (
	"time"

	"gorm.io/gorm"
)

// InformedConsent represents the medical record informed consent form
type InformedConsent struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"index;not null" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	IsCasemix       bool   `gorm:"default:false;index" json:"is_casemix"`
	CasemixEklaimID *uint  `gorm:"index" json:"casemix_eklaim_id,omitempty"`

	Procedures []InformedConsentProcedure `gorm:"foreignKey:InformedConsentID" json:"procedures,omitempty"`

	// A. JUDUL
	JudulTindakan string `gorm:"size:255" json:"judul_tindakan"`

	// B. JENIS TINDAKAN
	JenisTindakan string `gorm:"size:255" json:"jenis_tindakan"`

	// C. DOKTER PEMBERI INFORMASI
	DokterPemberiInformasiID *uint     `json:"dokter_pemberi_informasi_id"`
	DokterPemberiInformasi   *Employee `gorm:"foreignKey:DokterPemberiInformasiID" json:"dokter_pemberi_informasi,omitempty"`

	// D. PENERIMA INFORMASI / PENANGGUNG JAWAB PASIEN
	PenerimaInformasiSource      string `gorm:"size:50" json:"penerima_informasi_source"` // penanggung_jawab, manual
	PenerimaInformasiNama        string `gorm:"size:255" json:"penerima_informasi_nama"`
	PenerimaInformasiUmur        int    `json:"penerima_informasi_umur"`
	PenerimaInformasiJk          string `gorm:"size:50" json:"penerima_informasi_jk"`
	PenerimaInformasiAlamat      string `gorm:"type:text" json:"penerima_informasi_alamat"`
	PenerimaInformasiNoIdentitas string `gorm:"size:50" json:"penerima_informasi_no_identitas"`
	PenerimaInformasiNoTelp      string `gorm:"size:20" json:"penerima_informasi_no_telp"`
	PenerimaInformasiHubungan    string `gorm:"size:100" json:"penerima_informasi_hubungan"`

	// E. INFORMASI YANG DIJELASKAN OLEH DOKTER
	InfoDiagnosisKerja   bool   `json:"info_diagnosis_kerja"`
	IsiDiagnosisKerja    string `gorm:"type:text" json:"isi_diagnosis_kerja"`
	InfoIndikasiTindakan bool   `json:"info_indikasi_tindakan"`
	IsiIndikasiTindakan  string `gorm:"type:text" json:"isi_indikasi_tindakan"`
	InfoTataCara         bool   `json:"info_tata_cara"`
	IsiTataCara          string `gorm:"type:text" json:"isi_tata_cara"`
	InfoTujuan           bool   `json:"info_tujuan"`
	IsiTujuan            string `gorm:"type:text" json:"isi_tujuan"`
	InfoRisiko           bool   `json:"info_risiko"`
	IsiRisiko            string `gorm:"type:text" json:"isi_risiko"`
	InfoKomplikasi       bool   `json:"info_komplikasi"`
	IsiKomplikasi        string `gorm:"type:text" json:"isi_komplikasi"`
	InfoPrognosis        bool   `json:"info_prognosis"`
	IsiPrognosis         string `gorm:"type:text" json:"isi_prognosis"`
	InfoAlternatif       bool   `json:"info_alternatif"`
	IsiAlternatif        string `gorm:"type:text" json:"isi_alternatif"`
	InfoLainLain         string `gorm:"type:text" json:"info_lain_lain"`
	IsiLainLain          string `gorm:"type:text" json:"isi_lain_lain"`

	// F. PERNYATAAN DOKTER
	PernyataanDokter bool `json:"pernyataan_dokter"`

	// G. PERNYATAAN PASIEN / PENANGGUNG JAWAB
	StmtMenerimaPenjelasan bool   `json:"stmt_menerima_penjelasan"`
	StmtMemahamiPenjelasan bool   `json:"stmt_memahami_penjelasan"`
	StmtKesempatanBertanya bool   `json:"stmt_kesempatan_bertanya"`
	StmtJawabanBaik        bool   `json:"stmt_jawaban_baik"`
	StatusKompetensiPasien string `gorm:"size:50" json:"status_kompetensi_pasien"` // kompeten, tidak_kompeten

	// H. PERNYATAAN PERSETUJUAN / PENOLAKAN
	PersetujuanTindakan    string `gorm:"size:50" json:"persetujuan_tindakan"` // menyetujui, menolak
	Tindakan1              string `gorm:"size:255" json:"tindakan_1"`
	Tindakan2              string `gorm:"size:255" json:"tindakan_2"`
	AlasanPenolakan        string `gorm:"type:text" json:"alasan_penolakan"`
	StmtMembacaMemahamiIsi bool   `json:"stmt_membaca_memahami_isi"`
	StmtDataBenar          bool   `json:"stmt_data_benar"`
	StmtSetujuSadar        bool   `json:"stmt_setuju_sadar"`

	// NAMA SAKSI & PERAWAT & DOKTER & PASIEN (Input manual sebelum TTD)
	SignerNamePasien  string `gorm:"size:255" json:"signer_name_pasien"`
	SignerNameDokter  string `gorm:"size:255" json:"signer_name_dokter"`
	SignerNamePerawat string `gorm:"size:255" json:"signer_name_perawat"`
	SignerNameSaksi1  string `gorm:"size:255" json:"signer_name_saksi1"`
	SignerNameSaksi2  string `gorm:"size:255" json:"signer_name_saksi2"`

	// Status Kelengkapan TTD
	IsFullySigned bool `gorm:"default:false" json:"is_fully_signed"`

	// Audit
	CreatedByID *uint `json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	UpdatedByID *uint `json:"updated_by_id,omitempty"`
	UpdatedBy   *User `gorm:"foreignKey:UpdatedByID" json:"updated_by,omitempty"`
}

func (InformedConsent) TableName() string {
	return "informed_consents"
}

// InformedConsentProcedure represents the multiple procedures selected in an informed consent
type InformedConsentProcedure struct {
	ID                uint             `gorm:"primarykey" json:"id"`
	InformedConsentID uint             `gorm:"index;not null" json:"informed_consent_id"`
	ProcedureID       uint             `gorm:"index;not null" json:"procedure_id"`
	Procedure         *Procedure       `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`
	Notes             string           `gorm:"type:text" json:"notes"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

func (InformedConsentProcedure) TableName() string {
	return "informed_consent_procedures"
}
