package models

import (
	"time"

	"gorm.io/gorm"
)

// ClinicalPackage represents a reusable package of procedures and medicines.
type ClinicalPackage struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code        string `gorm:"not null;uniqueIndex;size:30" json:"code"`
	Name        string `gorm:"not null;size:200" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	IsActive    bool   `gorm:"default:true" json:"is_active"`
	Notes       string `gorm:"type:text" json:"notes"`

	ProcedureItems  []ClinicalPackageProcedureItem `gorm:"foreignKey:PackageID" json:"procedure_items,omitempty"`
	MedicineItems   []ClinicalPackageMedicineItem  `gorm:"foreignKey:PackageID" json:"medicine_items,omitempty"`
	RoomAssignments []RoomClinicalPackage          `gorm:"foreignKey:ClinicalPackageID" json:"room_assignments,omitempty"`
}

func (ClinicalPackage) TableName() string {
	return "clinical_packages"
}

// ClinicalPackageProcedureItem represents a procedure within a clinical package.
type ClinicalPackageProcedureItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	PackageID   uint             `gorm:"not null;index" json:"package_id"`
	Package     *ClinicalPackage `gorm:"foreignKey:PackageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	ProcedureID uint             `gorm:"not null;index" json:"procedure_id"`
	Procedure   *Procedure       `gorm:"foreignKey:ProcedureID" json:"procedure,omitempty"`
	SortOrder   int              `gorm:"default:0" json:"sort_order"`
	Notes       string           `gorm:"type:text" json:"notes"`
}

func (ClinicalPackageProcedureItem) TableName() string {
	return "clinical_package_procedure_items"
}

// ClinicalPackageMedicineItem represents a medicine within a clinical package.
type ClinicalPackageMedicineItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	PackageID    uint             `gorm:"not null;index" json:"package_id"`
	Package      *ClinicalPackage `gorm:"foreignKey:PackageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	MedicineID   uint             `gorm:"not null;index" json:"medicine_id"`
	Medicine     *Medicine        `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`
	Quantity     int              `gorm:"not null;default:1" json:"quantity"`
	Unit         string           `gorm:"size:50" json:"unit"`
	Dosage       string           `gorm:"size:100" json:"dosage"`
	Frequency    string           `gorm:"size:100" json:"frequency"`
	Route        string           `gorm:"size:50" json:"route"`
	Duration     string           `gorm:"size:50" json:"duration"`
	Instructions string           `gorm:"type:text" json:"instructions"`
	SortOrder    int              `gorm:"default:0" json:"sort_order"`
	Notes        string           `gorm:"type:text" json:"notes"`
}

func (ClinicalPackageMedicineItem) TableName() string {
	return "clinical_package_medicine_items"
}

// RoomClinicalPackage represents assignment of a clinical package to a room.
type RoomClinicalPackage struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RoomID            uint             `gorm:"not null;index;uniqueIndex:idx_room_clinical_package" json:"room_id"`
	Room              *Room            `gorm:"foreignKey:RoomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"room,omitempty"`
	ClinicalPackageID uint             `gorm:"not null;index;uniqueIndex:idx_room_clinical_package" json:"clinical_package_id"`
	ClinicalPackage   *ClinicalPackage `gorm:"foreignKey:ClinicalPackageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"clinical_package,omitempty"`
	IsActive          bool             `gorm:"default:true" json:"is_active"`
	Notes             string           `gorm:"type:text" json:"notes"`
}

func (RoomClinicalPackage) TableName() string {
	return "room_clinical_packages"
}
