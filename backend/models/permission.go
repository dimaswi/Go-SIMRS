package models

import (
	"time"

	"gorm.io/gorm"
)

type Permission struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Name        string         `gorm:"not null;size:100" json:"name" validate:"required,max=100"`
	Module      string         `gorm:"not null;size:50;index" json:"module" validate:"required,max=50"`
	Category    string         `gorm:"not null;size:50;index" json:"category" validate:"required,max=50"`
	Description string         `gorm:"size:255" json:"description" validate:"max=255"`
	Actions     string         `gorm:"type:json" json:"actions"` // JSON array of actions like ["create", "read", "update", "delete"]
	Roles       []Role         `gorm:"many2many:role_permissions;" json:"roles,omitempty"`
}

// RolePermission junction table with explicit definition for better control
type RolePermission struct {
	RoleID       uint       `gorm:"primaryKey;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"role_id"`
	PermissionID uint       `gorm:"primaryKey;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"permission_id"`
	CreatedAt    time.Time  `json:"created_at"`
	Role         Role       `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	Permission   Permission `gorm:"foreignKey:PermissionID" json:"permission,omitempty"`
}

// TableName specifies the table name for RolePermission
func (RolePermission) TableName() string {
	return "role_permissions"
}
