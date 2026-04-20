package models

import (
	"time"

	"gorm.io/gorm"
)

// PPKMaster stores local master data for BPJS referral facilities (PPK).
type PPKMaster struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	KodeBPJS     string `gorm:"size:20;not null;uniqueIndex" json:"kode_bpjs"`
	KodeKemenkes string `gorm:"size:30" json:"kode_kemenkes,omitempty"`
	Nama         string `gorm:"size:200;not null;index" json:"nama"`
	Jenis        string `gorm:"size:30" json:"jenis,omitempty"`
	Kelas        string `gorm:"size:10" json:"kelas,omitempty"`
	Alamat       string `gorm:"type:text" json:"alamat,omitempty"`
	Telepon      string `gorm:"size:50" json:"telepon,omitempty"`
	Wilayah      string `gorm:"size:20" json:"wilayah,omitempty"`
	DesWilayah   string `gorm:"size:200" json:"des_wilayah,omitempty"`
	IsActive     bool   `gorm:"default:true;index" json:"is_active"`
}

func (PPKMaster) TableName() string {
	return "ppk_master"
}
