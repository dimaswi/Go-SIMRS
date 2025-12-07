package models

import (
	"time"

	"gorm.io/gorm"
)

// Province represents Indonesian province data
type Province struct {
	ID        string         `gorm:"primarykey;size:2" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Name      string         `gorm:"not null;size:100" json:"name"`
	Regencies []Regency      `gorm:"foreignKey:ProvinceID" json:"regencies,omitempty"`
}

// TableName specifies the table name for Province
func (Province) TableName() string {
	return "provinces"
}

// Regency represents Indonesian regency/city data (Kabupaten/Kota)
type Regency struct {
	ID         string         `gorm:"primarykey;size:4" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	ProvinceID string         `gorm:"not null;size:2;index" json:"province_id"`
	Name       string         `gorm:"not null;size:100" json:"name"`
	Province   Province       `gorm:"foreignKey:ProvinceID" json:"province,omitempty"`
	Districts  []District     `gorm:"foreignKey:RegencyID" json:"districts,omitempty"`
}

// TableName specifies the table name for Regency
func (Regency) TableName() string {
	return "regencies"
}

// District represents Indonesian district data (Kecamatan)
type District struct {
	ID        string         `gorm:"primarykey;size:7" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	RegencyID string         `gorm:"not null;size:4;index" json:"regency_id"`
	Name      string         `gorm:"not null;size:100" json:"name"`
	Regency   Regency        `gorm:"foreignKey:RegencyID" json:"regency,omitempty"`
	Villages  []Village      `gorm:"foreignKey:DistrictID" json:"villages,omitempty"`
}

// TableName specifies the table name for District
func (District) TableName() string {
	return "districts"
}

// Village represents Indonesian village data (Kelurahan/Desa)
type Village struct {
	ID         string         `gorm:"primarykey;size:10" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	DistrictID string         `gorm:"not null;size:7;index" json:"district_id"`
	Name       string         `gorm:"not null;size:100" json:"name"`
	District   District       `gorm:"foreignKey:DistrictID" json:"district,omitempty"`
}

// TableName specifies the table name for Village
func (Village) TableName() string {
	return "villages"
}
