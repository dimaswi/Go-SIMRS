package models

import (
	"time"

	"gorm.io/gorm"
)

// Building represents a hospital building (Gedung)
// Buildings contain rooms organized by floors
type Building struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Code        string `gorm:"not null;size:20;uniqueIndex" json:"code"`         // e.g., "GD-01"
	Name        string `gorm:"not null;size:100" json:"name"`                    // e.g., "Gedung Utama"
	TotalFloors int    `gorm:"default:1" json:"total_floors"`                    // Jumlah lantai
	Description string `gorm:"type:text" json:"description,omitempty"`           // Deskripsi gedung
	Color       string `gorm:"size:20;default:'#e3f2fd'" json:"color,omitempty"` // Warna di floor plan
	IsActive    bool   `gorm:"default:true" json:"is_active"`

	// Floor plan layout position & size (in canvas units)
	PositionX int `gorm:"default:0" json:"position_x"`
	PositionY int `gorm:"default:0" json:"position_y"`
	Width     int `gorm:"default:400" json:"width"`
	Height    int `gorm:"default:300" json:"height"`

	// Relations
	Rooms []Room `gorm:"foreignKey:BuildingID" json:"rooms,omitempty"`
}

func (Building) TableName() string {
	return "buildings"
}
