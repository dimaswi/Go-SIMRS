package models

import (
	"time"

	"gorm.io/gorm"
)

// DoctorMedicineTemplate stores reusable medicine order templates owned by a doctor account.
type DoctorMedicineTemplate struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name  string `gorm:"size:150;not null" json:"name"`
	Notes string `gorm:"type:text" json:"notes"`

	OwnerEmployeeID uint      `gorm:"not null;index" json:"owner_employee_id"`
	OwnerEmployee   *Employee `gorm:"foreignKey:OwnerEmployeeID" json:"owner_employee,omitempty"`

	// Optional: template can be scoped for a specific DPJP context.
	DpjpEmployeeID *uint     `gorm:"index" json:"dpjp_employee_id,omitempty"`
	DpjpEmployee   *Employee `gorm:"foreignKey:DpjpEmployeeID" json:"dpjp_employee,omitempty"`

	IsActive bool `gorm:"default:true" json:"is_active"`

	Items []DoctorMedicineTemplateItem `gorm:"foreignKey:TemplateID" json:"items,omitempty"`
}

func (DoctorMedicineTemplate) TableName() string {
	return "doctor_medicine_templates"
}

// DoctorMedicineTemplateItem stores medicine lines in a doctor's template.
type DoctorMedicineTemplateItem struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TemplateID uint                    `gorm:"not null;index" json:"template_id"`
	Template   *DoctorMedicineTemplate `gorm:"foreignKey:TemplateID" json:"template,omitempty"`

	MedicineID uint      `gorm:"not null;index" json:"medicine_id"`
	Medicine   *Medicine `gorm:"foreignKey:MedicineID" json:"medicine,omitempty"`

	Quantity int    `gorm:"not null;default:1" json:"quantity"`
	Unit     string `gorm:"size:50" json:"unit"`

	Dosage       string `gorm:"size:100" json:"dosage"`
	Frequency    string `gorm:"size:100" json:"frequency"`
	Route        string `gorm:"size:50" json:"route"`
	Duration     string `gorm:"size:50" json:"duration"`
	Instructions string `gorm:"type:text" json:"instructions"`
	Notes        string `gorm:"type:text" json:"notes"`
	SortOrder    int    `gorm:"default:0" json:"sort_order"`
}

func (DoctorMedicineTemplateItem) TableName() string {
	return "doctor_medicine_template_items"
}
