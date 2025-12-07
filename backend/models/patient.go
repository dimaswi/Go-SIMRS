package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// DateOnly is a custom type for handling date-only JSON values (yyyy-MM-dd)
type DateOnly struct {
	time.Time
}

// UnmarshalJSON implements json.Unmarshaler for DateOnly
func (d *DateOnly) UnmarshalJSON(data []byte) error {
	var dateStr string
	if err := json.Unmarshal(data, &dateStr); err != nil {
		return err
	}

	if dateStr == "" || dateStr == "null" {
		d.Time = time.Time{}
		return nil
	}

	// Try parsing with different formats
	formats := []string{"2006-01-02", "02-01-2006", "2006/01/02"}
	var parseErr error
	for _, format := range formats {
		t, err := time.Parse(format, dateStr)
		if err == nil {
			d.Time = t
			return nil
		}
		parseErr = err
	}

	return parseErr
}

// MarshalJSON implements json.Marshaler for DateOnly
func (d DateOnly) MarshalJSON() ([]byte, error) {
	if d.Time.IsZero() {
		return json.Marshal(nil)
	}
	return json.Marshal(d.Time.Format("2006-01-02"))
}

// Value implements driver.Valuer for DateOnly (for GORM)
func (d DateOnly) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

// Scan implements sql.Scanner for DateOnly (for GORM)
func (d *DateOnly) Scan(value interface{}) error {
	if value == nil {
		d.Time = time.Time{}
		return nil
	}

	switch v := value.(type) {
	case time.Time:
		d.Time = v
		return nil
	case string:
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into DateOnly", value)
	}
}

// IsZero returns true if the DateOnly is zero value
func (d DateOnly) IsZero() bool {
	return d.Time.IsZero()
}

// ToTimePtr converts DateOnly to *time.Time
func (d DateOnly) ToTimePtr() *time.Time {
	if d.Time.IsZero() {
		return nil
	}
	return &d.Time
}

// PatientStatus represents the status of a patient
type PatientStatus string

const (
	PatientStatusActive   PatientStatus = "Aktif"
	PatientStatusInactive PatientStatus = "Tidak Aktif"
	PatientStatusDeceased PatientStatus = "Meninggal"
)

// BloodType represents blood type
type BloodType string

const (
	BloodTypeA       BloodType = "A"
	BloodTypeB       BloodType = "B"
	BloodTypeAB      BloodType = "AB"
	BloodTypeO       BloodType = "O"
	BloodTypeUnknown BloodType = "Tidak Diketahui"
)

// RhesusType represents rhesus factor
type RhesusType string

const (
	RhesusPositive RhesusType = "Positif"
	RhesusNegative RhesusType = "Negatif"
	RhesusUnknown  RhesusType = "Tidak Diketahui"
)

// InsuranceType represents type of insurance/payment
type InsuranceType string

const (
	InsuranceTypeUmum    InsuranceType = "Umum"
	InsuranceTypeBPJS    InsuranceType = "BPJS"
	InsuranceTypeSwasta  InsuranceType = "Asuransi Swasta"
	InsuranceTypeJKN     InsuranceType = "JKN"
	InsuranceTypeLainnya InsuranceType = "Lainnya"
)

// Patient represents patient data according to Kemenkes RI standards
// Reference: PMK No. 24 Tahun 2022 tentang Rekam Medis
type Patient struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// ==========================================
	// IDENTITAS PASIEN (Patient Identity)
	// ==========================================

	// Nomor Rekam Medis (Medical Record Number) - Auto generated
	NoRM string `gorm:"size:20;not null" json:"no_rm"`

	// NIK (Nomor Induk Kependudukan) - 16 digits
	NIK string `gorm:"size:16" json:"nik"`

	// Nama Lengkap sesuai KTP/Akta
	NamaLengkap string `gorm:"size:150;not null" json:"nama_lengkap"`

	// Nama Panggilan
	NamaPanggilan string `gorm:"size:50" json:"nama_panggilan,omitempty"`

	// Tempat Lahir
	TempatLahir string `gorm:"size:100" json:"tempat_lahir"`

	// Tanggal Lahir
	TanggalLahir *DateOnly `gorm:"type:date" json:"tanggal_lahir"`

	// Jenis Kelamin (L/P)
	JenisKelamin Gender `gorm:"size:1" json:"jenis_kelamin"`

	// Golongan Darah
	GolonganDarah BloodType `gorm:"size:20" json:"golongan_darah"`

	// Rhesus
	Rhesus RhesusType `gorm:"size:20" json:"rhesus"`

	// Agama
	Agama string `gorm:"size:20" json:"agama"`

	// Status Perkawinan
	StatusPerkawinan string `gorm:"size:20" json:"status_perkawinan"`

	// Pendidikan Terakhir
	PendidikanTerakhir string `gorm:"size:50" json:"pendidikan_terakhir"`

	// Pekerjaan
	Pekerjaan string `gorm:"size:100" json:"pekerjaan"`

	// Kewarganegaraan
	Kewarganegaraan string `gorm:"size:50;default:'WNI'" json:"kewarganegaraan"`

	// Suku/Etnis
	Suku string `gorm:"size:50" json:"suku,omitempty"`

	// Bahasa yang dikuasai
	Bahasa string `gorm:"size:100" json:"bahasa,omitempty"`

	// ==========================================
	// ALAMAT (Address Information)
	// ==========================================

	// Alamat Lengkap (sesuai KTP)
	AlamatKTP string `gorm:"type:text" json:"alamat_ktp"`

	// RT
	RTKTP string `gorm:"size:5" json:"rt_ktp"`

	// RW
	RWKTP string `gorm:"size:5" json:"rw_ktp"`

	// Kelurahan/Desa
	KelurahanKTP string `gorm:"size:100" json:"kelurahan_ktp"`

	// Kecamatan
	KecamatanKTP string `gorm:"size:100" json:"kecamatan_ktp"`

	// Kota/Kabupaten
	KotaKTP string `gorm:"size:100" json:"kota_ktp"`

	// Provinsi
	ProvinsiKTP string `gorm:"size:100" json:"provinsi_ktp"`

	// Kode Pos
	KodePosKTP string `gorm:"size:10" json:"kode_pos_ktp"`

	// Alamat Domisili (jika berbeda dengan KTP)
	AlamatDomisili string `gorm:"type:text" json:"alamat_domisili,omitempty"`

	RTDomisili        string `gorm:"size:5" json:"rt_domisili,omitempty"`
	RWDomisili        string `gorm:"size:5" json:"rw_domisili,omitempty"`
	KelurahanDomisili string `gorm:"size:100" json:"kelurahan_domisili,omitempty"`
	KecamatanDomisili string `gorm:"size:100" json:"kecamatan_domisili,omitempty"`
	KotaDomisili      string `gorm:"size:100" json:"kota_domisili,omitempty"`
	ProvinsiDomisili  string `gorm:"size:100" json:"provinsi_domisili,omitempty"`
	KodePosDomisili   string `gorm:"size:10" json:"kode_pos_domisili,omitempty"`

	// ==========================================
	// KONTAK (Contact Information)
	// ==========================================

	// Nomor Telepon Rumah
	NoTelepon string `gorm:"size:15" json:"no_telepon,omitempty"`

	// Nomor HP
	NoHP string `gorm:"size:15" json:"no_hp"`

	// Nomor HP Alternatif
	NoHPAlternatif string `gorm:"size:15" json:"no_hp_alternatif,omitempty"`

	// Email
	Email string `gorm:"size:150" json:"email,omitempty"`

	// ==========================================
	// PENANGGUNG JAWAB / KELUARGA TERDEKAT
	// (Emergency Contact / Next of Kin)
	// ==========================================

	// Nama Penanggung Jawab
	NamaPenanggungJawab string `gorm:"size:150" json:"nama_penanggung_jawab"`

	// Hubungan dengan Pasien
	HubunganPenanggungJawab string `gorm:"size:50" json:"hubungan_penanggung_jawab"`

	// NIK Penanggung Jawab
	NIKPenanggungJawab string `gorm:"size:16" json:"nik_penanggung_jawab,omitempty"`

	// Alamat Penanggung Jawab
	AlamatPenanggungJawab string `gorm:"type:text" json:"alamat_penanggung_jawab,omitempty"`

	// Telepon Penanggung Jawab
	TeleponPenanggungJawab string `gorm:"size:15" json:"telepon_penanggung_jawab"`

	// ==========================================
	// DATA ORANG TUA (untuk pasien anak)
	// (Parent Information - for pediatric patients)
	// ==========================================

	// Nama Ayah
	NamaAyah string `gorm:"size:150" json:"nama_ayah,omitempty"`

	// NIK Ayah
	NIKAyah string `gorm:"size:16" json:"nik_ayah,omitempty"`

	// Pekerjaan Ayah
	PekerjaanAyah string `gorm:"size:100" json:"pekerjaan_ayah,omitempty"`

	// Nama Ibu
	NamaIbu string `gorm:"size:150" json:"nama_ibu,omitempty"`

	// NIK Ibu
	NIKIbu string `gorm:"size:16" json:"nik_ibu,omitempty"`

	// Pekerjaan Ibu
	PekerjaanIbu string `gorm:"size:100" json:"pekerjaan_ibu,omitempty"`

	// ==========================================
	// JAMINAN KESEHATAN (Health Insurance)
	// ==========================================

	// Jenis Jaminan/Pembayaran
	JenisJaminan InsuranceType `gorm:"size:30;default:'Umum'" json:"jenis_jaminan"`

	// Nomor BPJS/Kartu Jaminan
	NoBPJS string `gorm:"size:20" json:"no_bpjs,omitempty"`

	// Kelas BPJS
	KelasBPJS string `gorm:"size:10" json:"kelas_bpjs,omitempty"`

	// Faskes Tingkat 1 (Puskesmas/Klinik)
	FaskesTingkat1 string `gorm:"size:150" json:"faskes_tingkat_1,omitempty"`

	// Nama Asuransi (jika swasta)
	NamaAsuransi string `gorm:"size:100" json:"nama_asuransi,omitempty"`

	// Nomor Polis Asuransi
	NoPolisAsuransi string `gorm:"size:50" json:"no_polis_asuransi,omitempty"`

	// Masa Berlaku Asuransi
	MasaBerlakuAsuransi *DateOnly `gorm:"type:date" json:"masa_berlaku_asuransi,omitempty"`

	// ==========================================
	// RIWAYAT MEDIS PENTING
	// (Important Medical History)
	// ==========================================

	// Alergi Obat
	AlergiObat string `gorm:"type:text" json:"alergi_obat,omitempty"`

	// Alergi Makanan
	AlergiMakanan string `gorm:"type:text" json:"alergi_makanan,omitempty"`

	// Alergi Lainnya
	AlergiLainnya string `gorm:"type:text" json:"alergi_lainnya,omitempty"`

	// Penyakit Kronis
	PenyakitKronis string `gorm:"type:text" json:"penyakit_kronis,omitempty"`

	// Riwayat Operasi
	RiwayatOperasi string `gorm:"type:text" json:"riwayat_operasi,omitempty"`

	// Obat yang Sedang Dikonsumsi
	ObatRutin string `gorm:"type:text" json:"obat_rutin,omitempty"`

	// Disability/Disabilitas
	Disabilitas string `gorm:"size:100" json:"disabilitas,omitempty"`

	// ==========================================
	// DATA TAMBAHAN
	// (Additional Information)
	// ==========================================

	// Foto Pasien
	Foto string `gorm:"size:255" json:"foto,omitempty"`

	// Status Pasien
	Status PatientStatus `gorm:"size:20;default:'Aktif'" json:"status"`

	// Tanggal Registrasi Pertama
	TanggalRegistrasi *time.Time `json:"tanggal_registrasi"`

	// Tanggal Kunjungan Terakhir
	TanggalKunjunganTerakhir *time.Time `json:"tanggal_kunjungan_terakhir,omitempty"`

	// Catatan Khusus
	CatatanKhusus string `gorm:"type:text" json:"catatan_khusus,omitempty"`

	// User ID yang membuat data
	CreatedBy *uint `json:"created_by,omitempty"`

	// User ID yang terakhir mengupdate
	UpdatedBy *uint `json:"updated_by,omitempty"`
}

// TableName specifies the table name for Patient
func (Patient) TableName() string {
	return "patients"
}

// BeforeCreate hook to generate NoRM
func (p *Patient) BeforeCreate(tx *gorm.DB) error {
	if p.NoRM == "" {
		// Generate NoRM format: 0000001 (7 digit sequential)
		var count int64

		// Count total patients to determine next number
		tx.Unscoped().Model(&Patient{}).Count(&count)

		// Generate 7 digit NoRM (next number = count + 1)
		p.NoRM = padLeft(int(count+1), 7)
	}

	// Set registration date if not set
	if p.TanggalRegistrasi == nil {
		now := time.Now()
		p.TanggalRegistrasi = &now
	}

	return nil
}

// padLeft pads a number with leading zeros
func padLeft(num int, length int) string {
	return fmt.Sprintf("%0*d", length, num)
}
