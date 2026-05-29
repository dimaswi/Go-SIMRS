package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"

	"gorm.io/gorm"
)

type codeScope func(*gorm.DB) *gorm.DB

func generateDateCode(model interface{}, prefix string) (string, error) {
	datePrefix := strings.ToUpper(strings.TrimSpace(prefix)) + time.Now().Format("20060102")
	return generateSequentialCode(model, datePrefix, 3)
}

func generateSequentialCode(model interface{}, prefix string, width int, scopes ...codeScope) (string, error) {
	var last struct {
		Code string `gorm:"column:code"`
	}

	query := database.DB.Model(model).Select("code").Where("code LIKE ?", prefix+"%")
	for _, scope := range scopes {
		query = scope(query)
	}

	err := query.Order("code DESC").Limit(1).Take(&last).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return "", err
	}

	nextNumber := 1
	if err == nil {
		suffix := strings.TrimPrefix(last.Code, prefix)
		if parsed, parseErr := strconv.Atoi(suffix); parseErr == nil {
			nextNumber = parsed + 1
		}
	}

	return fmt.Sprintf("%s%0*d", prefix, width, nextNumber), nil
}
