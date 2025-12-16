package models

import (
	"time"

	"gorm.io/gorm"
)

// CodeSystemType represents the type of medical coding system
type CodeSystemType string

const (
	CodeSystemICD10     CodeSystemType = "ICD10_2010_IM"
	CodeSystemICD9CM    CodeSystemType = "ICD9CM_2010_IM"
	CodeSystemICDOMorph CodeSystemType = "ICDO_MORFOLOGY"
)

// ICD10 represents ICD-10 diagnosis codes (Indonesia Modified)
type ICD10 struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code      string `gorm:"size:20;not null;uniqueIndex" json:"code"` // A00.1
	Code2     string `gorm:"size:20;index" json:"code2"`               // A001 (tanpa titik)
	Display   string `gorm:"size:500;not null" json:"display"`         // Nama diagnosis
	ValidCode bool   `gorm:"default:true" json:"valid_code"`           // 1=valid, 0=header
	AccPdx    bool   `gorm:"default:true" json:"acc_pdx"`              // Acceptable as Primary Dx
	Asterisk  bool   `gorm:"default:false" json:"asterisk"`            // Asterisk code (manifestasi)
	IM        bool   `gorm:"default:false" json:"im"`                  // Indonesia Modified
	IsActive  bool   `gorm:"default:true;index" json:"is_active"`      // Aktif/tidak

	// Hierarchy (untuk chapter/block grouping)
	Chapter     string `gorm:"size:10;index" json:"chapter,omitempty"` // Chapter code (A00-B99)
	ChapterName string `gorm:"size:200" json:"chapter_name,omitempty"` // Chapter name
	BlockStart  string `gorm:"size:10" json:"block_start,omitempty"`   // Block range start
	BlockEnd    string `gorm:"size:10" json:"block_end,omitempty"`     // Block range end
}

func (ICD10) TableName() string {
	return "icd10"
}

// ICD9CM represents ICD-9-CM procedure codes (Indonesia Modified)
type ICD9CM struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code      string `gorm:"size:20;not null;uniqueIndex" json:"code"` // 00.01
	Code2     string `gorm:"size:20;index" json:"code2"`               // 0001 (tanpa titik)
	Display   string `gorm:"size:500;not null" json:"display"`         // Nama prosedur
	ValidCode bool   `gorm:"default:true" json:"valid_code"`           // 1=valid, 0=header
	AccPdx    bool   `gorm:"default:true" json:"acc_pdx"`              // Acceptable
	Asterisk  bool   `gorm:"default:false" json:"asterisk"`            // Flag
	IM        bool   `gorm:"default:false" json:"im"`                  // Indonesia Modified
	IsActive  bool   `gorm:"default:true;index" json:"is_active"`      // Aktif/tidak

	// Hierarchy
	Chapter     string `gorm:"size:10;index" json:"chapter,omitempty"` // Chapter code
	ChapterName string `gorm:"size:200" json:"chapter_name,omitempty"` // Chapter name
}

func (ICD9CM) TableName() string {
	return "icd9cm"
}

// ICDOMorphology represents ICD-O Morphology codes (for tumors)
type ICDOMorphology struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code      string `gorm:"size:20;not null;uniqueIndex" json:"code"`
	Code2     string `gorm:"size:20;index" json:"code2"`
	Display   string `gorm:"size:500;not null" json:"display"`
	ValidCode bool   `gorm:"default:true" json:"valid_code"`
	IsActive  bool   `gorm:"default:true;index" json:"is_active"`
}

func (ICDOMorphology) TableName() string {
	return "icdo_morphology"
}
