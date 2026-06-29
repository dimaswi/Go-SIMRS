package models

import (
	"time"

	"gorm.io/gorm"
)

// EmploymentStatus represents the employment status of an employee
type EmploymentStatus string

const (
	EmploymentStatusPNS     EmploymentStatus = "PNS"
	EmploymentStatusPPPK    EmploymentStatus = "PPPK"
	EmploymentStatusKontrak EmploymentStatus = "Kontrak"
	EmploymentStatusHonorer EmploymentStatus = "Honorer"
	EmploymentStatusMagang  EmploymentStatus = "Magang"
)

// Gender represents the gender of an employee
type Gender string

const (
	GenderMale   Gender = "L"
	GenderFemale Gender = "P"
)

// EmployeeType represents the type/category of employee
type EmployeeType string

const (
	EmployeeTypeDokter          EmployeeType = "Dokter"
	EmployeeTypePerawat         EmployeeType = "Perawat"
	EmployeeTypeBidan           EmployeeType = "Bidan"
	EmployeeTypeApoteker        EmployeeType = "Apoteker"
	EmployeeTypeAsistenApoteker EmployeeType = "Asisten Apoteker"
	EmployeeTypeRadiografer     EmployeeType = "Radiografer"
	EmployeeTypeAnalis          EmployeeType = "Analis Kesehatan"
	EmployeeTypeNutrisionis     EmployeeType = "Nutrisionis"
	EmployeeTypeAdministrasi    EmployeeType = "Administrasi"
	EmployeeTypeKeuangan        EmployeeType = "Keuangan"
	EmployeeTypeIT              EmployeeType = "IT"
	EmployeeTypeKeamanan        EmployeeType = "Keamanan"
	EmployeeTypeKebersihan      EmployeeType = "Kebersihan"
	EmployeeTypeLainnya         EmployeeType = "Lainnya"
)

// Employee represents hospital staff data
type Employee struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Personal Information
	NIK              string     `gorm:"size:16" json:"nik"`
	NIP              string     `gorm:"size:18" json:"nip,omitempty"`
	SatuSehatID      string     `gorm:"size:50;index" json:"satusehat_id,omitempty"` // IHS Number Practitioner dari SatuSehat
	NamaLengkap      string     `gorm:"not null;size:150" json:"nama_lengkap"`
	TempatLahir      string     `gorm:"size:100" json:"tempat_lahir"`
	TanggalLahir     *time.Time `json:"tanggal_lahir"`
	JenisKelamin     Gender     `gorm:"size:1" json:"jenis_kelamin"`
	Agama            string     `gorm:"size:20" json:"agama"`
	StatusPerkawinan string     `gorm:"size:20" json:"status_perkawinan"`
	Alamat           string     `gorm:"type:text" json:"alamat"`
	Kota             string     `gorm:"size:100" json:"kota"`
	Kecamatan        string     `gorm:"size:100" json:"kecamatan"`
	Kelurahan        string     `gorm:"size:100" json:"kelurahan"`
	Provinsi         string     `gorm:"size:100" json:"provinsi"`
	KodePos          string     `gorm:"size:10" json:"kode_pos"`
	NoTelepon        string     `gorm:"size:15" json:"no_telepon"`
	NoHP             string     `gorm:"size:15" json:"no_hp"`
	Email            string     `gorm:"size:150" json:"email"`
	Foto             string     `gorm:"size:255" json:"foto"`

	// Employment Information
	TipeKaryawan      EmployeeType     `gorm:"size:50;not null" json:"tipe_karyawan"`
	StatusKepegawaian EmploymentStatus `gorm:"size:20;not null" json:"status_kepegawaian"`
	TanggalMasuk      *time.Time       `json:"tanggal_masuk"`
	TanggalKeluar     *time.Time       `json:"tanggal_keluar"`
	Departemen        string           `gorm:"size:100" json:"departemen"`
	Jabatan           string           `gorm:"size:100" json:"jabatan"`

	// Medical Staff Information (for doctors, nurses, etc.)
	NoSTR          string     `gorm:"size:50" json:"no_str,omitempty"`
	TanggalSTR     *time.Time `json:"tanggal_str,omitempty"`
	MasaBerlakuSTR *time.Time `json:"masa_berlaku_str,omitempty"`
	NoSIP          string     `gorm:"size:50" json:"no_sip,omitempty"`
	TanggalSIP     *time.Time `json:"tanggal_sip,omitempty"`
	MasaBerlakuSIP *time.Time `json:"masa_berlaku_sip,omitempty"`
	Spesialisasi   string     `gorm:"size:100" json:"spesialisasi,omitempty"`

	// Education
	PendidikanTerakhir string `gorm:"size:50" json:"pendidikan_terakhir"`
	NamaInstitusi      string `gorm:"size:150" json:"nama_institusi"`
	TahunLulus         int    `json:"tahun_lulus"`

	// Bank Information (for salary)
	NamaBank         string `gorm:"size:50" json:"nama_bank"`
	NoRekening       string `gorm:"size:30" json:"no_rekening"`
	AtasNamaRekening string `gorm:"size:150" json:"atas_nama_rekening"`

	// Emergency Contact
	NamaKontakDarurat     string `gorm:"size:150" json:"nama_kontak_darurat"`
	HubunganKontakDarurat string `gorm:"size:50" json:"hubungan_kontak_darurat"`
	TeleponKontakDarurat  string `gorm:"size:15" json:"telepon_kontak_darurat"`

	// Status
	IsActive bool `gorm:"default:true" json:"is_active"`

	// Relation to User (optional - employee may or may not have system access)
	User *User `gorm:"foreignKey:EmployeeID" json:"user,omitempty"`
}

// TableName specifies the table name for Employee
func (Employee) TableName() string {
	return "employees"
}
