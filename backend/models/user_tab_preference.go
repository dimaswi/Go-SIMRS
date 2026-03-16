package models

import "time"

// UserTabPreference stores per-user tab order preferences for medical record tabs.
type UserTabPreference struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	UserID   uint   `gorm:"not null;index;uniqueIndex:idx_user_tab_preferences_user_mode" json:"user_id"`
	Mode     string `gorm:"size:120;not null;uniqueIndex:idx_user_tab_preferences_user_mode" json:"mode"`
	TabOrder string `gorm:"type:text;not null;default:'[]'" json:"tab_order"`
}
