package migrations

import (
	"starter/backend/models"

	"gorm.io/gorm"
)

// AddGeneralConditionData adds general_condition master data if not exists
func AddGeneralConditionData(db *gorm.DB) error {
	generalConditions := []models.MasterData{
		{Category: models.CategoryGeneralCondition, Code: "baik", Name: "Baik", Description: "Keadaan umum baik", SortOrder: 1, IsActive: true, IsDefault: true},
		{Category: models.CategoryGeneralCondition, Code: "sedang", Name: "Sedang", Description: "Keadaan umum sedang", SortOrder: 2, IsActive: true},
		{Category: models.CategoryGeneralCondition, Code: "lemah", Name: "Lemah", Description: "Keadaan umum lemah", SortOrder: 3, IsActive: true},
		{Category: models.CategoryGeneralCondition, Code: "buruk", Name: "Buruk", Description: "Keadaan umum buruk/kritis", SortOrder: 4, IsActive: true},
	}

	for _, data := range generalConditions {
		var existing models.MasterData
		result := db.Where("category = ? AND code = ?", data.Category, data.Code).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&data).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
