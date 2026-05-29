package models

import (
	"time"

	"gorm.io/gorm"
)

// VisitBHPUsage stores consumable (BHP) usage during a visit.
type VisitBHPUsage struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	VisitID uint   `gorm:"not null;index" json:"visit_id"`
	Visit   *Visit `gorm:"foreignKey:VisitID" json:"visit,omitempty"`

	RoomID uint  `gorm:"not null;index" json:"room_id"`
	Room   *Room `gorm:"foreignKey:RoomID" json:"room,omitempty"`

	InventoryID uint       `gorm:"not null;index" json:"inventory_id"`
	Inventory   *Inventory `gorm:"foreignKey:InventoryID" json:"inventory,omitempty"`

	Quantity int    `gorm:"not null;default:1" json:"quantity"`
	Unit     string `gorm:"size:50" json:"unit"`

	UnitPrice float64 `gorm:"type:decimal(15,2);default:0" json:"unit_price"`
	Subtotal  float64 `gorm:"type:decimal(15,2);default:0" json:"subtotal"`

	UsedAt time.Time `gorm:"not null;index" json:"used_at"`
	Notes  string    `gorm:"type:text" json:"notes,omitempty"`

	CreatedByID *uint `gorm:"index" json:"created_by_id,omitempty"`
	CreatedBy   *User `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	UpdatedByID *uint `gorm:"index" json:"updated_by_id,omitempty"`
	UpdatedBy   *User `gorm:"foreignKey:UpdatedByID" json:"updated_by,omitempty"`
}

func (VisitBHPUsage) TableName() string {
	return "visit_bhp_usages"
}
