package handlers

import (
	"starter/backend/database"

	"gorm.io/gorm"
)

func originalRMVisitQuery(visitID interface{}) *gorm.DB {
	return database.DB.Where("visit_id = ? AND is_casemix = ?", visitID, false)
}

func originalRMSourceVisitQuery(visitID interface{}) *gorm.DB {
	return database.DB.Where("source_visit_id = ? AND is_casemix = ?", visitID, false)
}
