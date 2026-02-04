package models

import (
	"time"

	"gorm.io/gorm"
)

// SEP adalah model untuk menyimpan data SEP (Surat Eligibilitas Peserta)
type SEP struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Nomor SEP dari BPJS
	NoSEP string `gorm:"uniqueIndex;size:50;not null" json:"no_sep"`

	// Link ke SIMRS
	RegistrationID *uint         `gorm:"index" json:"registration_id"` // Nullable - bisa buat SEP tanpa registration
	Registration   *Registration `gorm:"foreignKey:RegistrationID" json:"registration,omitempty"`
	PatientID      uint          `gorm:"not null;index" json:"patient_id"`
	Patient        *Patient      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	VisitID        *uint         `gorm:"index" json:"visit_id"`
	Visit          *Visit        `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	// Data Pasien BPJS
	NoKartu      string `gorm:"size:20;not null;index" json:"no_kartu"`
	NamaPasien   string `gorm:"size:150" json:"nama_pasien"`
	NIK          string `gorm:"size:20" json:"nik"`
	TglLahir     string `gorm:"size:10" json:"tgl_lahir"`
	JenisKelamin string `gorm:"size:10" json:"jenis_kelamin"` // L/P

	// Data SEP
	TglSEP       string `gorm:"size:10;not null;index" json:"tgl_sep"` // yyyy-mm-dd
	JnsPelayanan string `gorm:"size:50" json:"jns_pelayanan"`          // 1=Ranap, 2=Rajal atau text
	KlsRawatHak  string `gorm:"size:20" json:"kls_rawat_hak"`          // 1, 2, 3 atau "Kelas 3"
	KlsRawatNaik string `gorm:"size:20" json:"kls_rawat_naik"`         // Jika naik kelas
	Pembiayaan   string `gorm:"size:50" json:"pembiayaan"`             // 1=Pribadi, 2=Pemberi Kerja, 3=Asuransi
	NoMR         string `gorm:"size:20" json:"no_mr"`

	// Data Rujukan
	AsalRujukan string `gorm:"size:20" json:"asal_rujukan"` // 1=Faskes 1, 2=Faskes 2
	NoRujukan   string `gorm:"size:50;index" json:"no_rujukan"`
	TglRujukan  string `gorm:"size:10" json:"tgl_rujukan"`
	PPKRujukan  string `gorm:"size:20" json:"ppk_rujukan"`   // Kode faskes perujuk
	NamaRujukan string `gorm:"size:200" json:"nama_rujukan"` // Nama faskes perujuk

	// Data Poli & Dokter
	KodePoli     string `gorm:"size:50;index" json:"kode_poli"`
	NamaPoli     string `gorm:"size:200" json:"nama_poli"`
	PoliEks      string `gorm:"size:5" json:"poli_eks"` // 0=Tidak, 1=Ya (Poli Eksekutif)
	KodeDPJP     string `gorm:"size:20;index" json:"kode_dpjp"`
	NamaDPJP     string `gorm:"size:200" json:"nama_dpjp"`
	PPKPelayanan string `gorm:"size:20" json:"ppk_pelayanan"` // Kode RS pelayanan

	// Diagnosa
	DiagAwal     string `gorm:"size:50" json:"diag_awal"`      // Kode ICD-10
	NamaDiagnosa string `gorm:"size:500" json:"nama_diagnosa"` // Nama diagnosa

	// Jaminan & Kecelakaan
	LakaLantas   string `gorm:"size:5" json:"laka_lantas"` // 0=BKLL, 1=KLL&BKK, 2=KLL&KK, 3=KK
	NoLPLaka     string `gorm:"size:50" json:"no_lp_laka"`
	TglKejadian  string `gorm:"size:10" json:"tgl_kejadian"`
	Keterangan   string `gorm:"type:text" json:"keterangan_laka"`
	Suplesi      string `gorm:"size:5" json:"suplesi"` // 0=Tidak, 1=Ya
	NoSEPSuplesi string `gorm:"size:50" json:"no_sep_suplesi"`

	// Lokasi Kecelakaan
	KdPropinsi  string `gorm:"size:10" json:"kd_propinsi"`
	KdKabupaten string `gorm:"size:10" json:"kd_kabupaten"`
	KdKecamatan string `gorm:"size:10" json:"kd_kecamatan"`

	// COB & Katarak
	COB     string `gorm:"size:5" json:"cob"`     // 0=Tidak, 1=Ya
	Katarak string `gorm:"size:5" json:"katarak"` // 0=Tidak, 1=Ya

	// Tujuan Kunjungan
	TujuanKunj    string `gorm:"size:5" json:"tujuan_kunj"`    // 0=Normal, 1=Prosedur, 2=Konsul
	FlagProcedure string `gorm:"size:5" json:"flag_procedure"` // 0=Tidak Berkelanjutan, 1=Berkelanjutan
	KdPenunjang   string `gorm:"size:5" json:"kd_penunjang"`   // 1-12
	AssesmentPel  string `gorm:"size:5" json:"assesment_pel"`  // 1-5

	// Surat Kontrol
	NoSuratKontrol string `gorm:"size:50" json:"no_surat_kontrol"`

	// Catatan & Info
	Catatan  string `gorm:"type:text" json:"catatan"`
	NoTelp   string `gorm:"size:20" json:"no_telp"`
	UserBuat string `gorm:"size:50" json:"user_buat"` // User yang membuat SEP

	// Status
	Status string `gorm:"size:20;default:'aktif'" json:"status"` // aktif, batal, pulang
}

// TableName returns table name for SEP
func (SEP) TableName() string {
	return "sep"
}

// ==================== CONSTANTS untuk field-field pilihan ====================

// JenisPelayanan adalah pilihan jenis pelayanan
var JenisPelayanan = []map[string]string{
	{"kode": "1", "nama": "Rawat Inap"},
	{"kode": "2", "nama": "Rawat Jalan"},
}

// KelasRawat adalah pilihan kelas rawat
var KelasRawat = []map[string]string{
	{"kode": "1", "nama": "Kelas 1"},
	{"kode": "2", "nama": "Kelas 2"},
	{"kode": "3", "nama": "Kelas 3"},
}

// KelasRawatNaik adalah pilihan kelas rawat naik
var KelasRawatNaik = []map[string]string{
	{"kode": "", "nama": "- Tidak Naik Kelas -"},
	{"kode": "1", "nama": "VVIP"},
	{"kode": "2", "nama": "VIP"},
	{"kode": "3", "nama": "Kelas 1"},
	{"kode": "4", "nama": "Kelas 2"},
	{"kode": "5", "nama": "Kelas 3"},
	{"kode": "6", "nama": "ICCU"},
	{"kode": "7", "nama": "ICU"},
	{"kode": "8", "nama": "Diatas Kelas 1"},
}

// PembiayaanNaikKelas adalah pilihan pembiayaan naik kelas
var PembiayaanNaikKelas = []map[string]string{
	{"kode": "", "nama": "- Tidak Ada -"},
	{"kode": "1", "nama": "Pribadi"},
	{"kode": "2", "nama": "Pemberi Kerja"},
	{"kode": "3", "nama": "Asuransi Kesehatan Tambahan"},
}

// AsalRujukan adalah pilihan asal rujukan
var AsalRujukan = []map[string]string{
	{"kode": "1", "nama": "Faskes 1 (Puskesmas/Klinik)"},
	{"kode": "2", "nama": "Faskes 2 (Rumah Sakit)"},
}

// LakaLantas adalah pilihan jenis kecelakaan
var LakaLantas = []map[string]string{
	{"kode": "0", "nama": "Bukan Kecelakaan Lalu Lintas (BKLL)"},
	{"kode": "1", "nama": "KLL dan Bukan Kecelakaan Kerja (BKK)"},
	{"kode": "2", "nama": "KLL dan Kecelakaan Kerja (KK)"},
	{"kode": "3", "nama": "Kecelakaan Kerja (KK)"},
}

// TujuanKunjungan adalah pilihan tujuan kunjungan
var TujuanKunjungan = []map[string]string{
	{"kode": "0", "nama": "Normal"},
	{"kode": "1", "nama": "Prosedur"},
	{"kode": "2", "nama": "Konsul Dokter"},
}

// FlagProcedure adalah pilihan flag prosedur
var FlagProcedure = []map[string]string{
	{"kode": "", "nama": "- Tidak Ada -"},
	{"kode": "0", "nama": "Prosedur Tidak Berkelanjutan"},
	{"kode": "1", "nama": "Prosedur dan Terapi Berkelanjutan"},
}

// KdPenunjang adalah pilihan kode penunjang
var KdPenunjang = []map[string]string{
	{"kode": "", "nama": "- Tidak Ada -"},
	{"kode": "1", "nama": "Radioterapi"},
	{"kode": "2", "nama": "Kemoterapi"},
	{"kode": "3", "nama": "Rehabilitasi Medik"},
	{"kode": "4", "nama": "Rehabilitasi Psikososial"},
	{"kode": "5", "nama": "Transfusi Darah"},
	{"kode": "6", "nama": "Pelayanan Gigi"},
	{"kode": "7", "nama": "Laboratorium"},
	{"kode": "8", "nama": "USG"},
	{"kode": "9", "nama": "Farmasi"},
	{"kode": "10", "nama": "Lain-Lain"},
	{"kode": "11", "nama": "MRI"},
	{"kode": "12", "nama": "Hemodialisa"},
}

// AssesmentPelayanan adalah pilihan assesment pelayanan
var AssesmentPelayanan = []map[string]string{
	{"kode": "", "nama": "- Tidak Ada -"},
	{"kode": "1", "nama": "Poli spesialis tidak tersedia pada hari sebelumnya"},
	{"kode": "2", "nama": "Jam Poli telah berakhir pada hari sebelumnya"},
	{"kode": "3", "nama": "Dokter Spesialis yang dimaksud tidak praktek pada hari sebelumnya"},
	{"kode": "4", "nama": "Atas Instruksi RS"},
	{"kode": "5", "nama": "Tujuan Kontrol"},
}

// YaTidak adalah pilihan Ya/Tidak
var YaTidak = []map[string]string{
	{"kode": "0", "nama": "Tidak"},
	{"kode": "1", "nama": "Ya"},
}
