package handlers

import (
	"fmt"
	"starter/backend/database"
	"starter/backend/models"

	"gorm.io/gorm"
)

func numberToWords(n int) string {
	words := []string{"", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"}
	if n >= 1 && n <= 10 {
		return words[n]
	}
	return fmt.Sprintf("%d", n)
}

func formatCurrency(amount float64) string {
	return fmt.Sprintf("Rp %s", formatNumber(amount))
}

func formatNumber(num float64) string {
	intNum := int64(num)
	if intNum < 0 {
		return "-" + formatNumber(-num)
	}

	str := fmt.Sprintf("%d", intNum)
	n := len(str)
	if n <= 3 {
		return str
	}

	var result []byte
	for i, c := range str {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, '.')
		}
		result = append(result, byte(c))
	}
	return string(result)
}

func loadRMOrderWithPatient(rmOrderID string) (*models.EKlaimRMOrder, *models.Patient, *models.Visit, error) {
	var rmOrder models.EKlaimRMOrder
	if err := database.DB.
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence ASC")
		}).
		Preload("Items.Procedure").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		First(&rmOrder, rmOrderID).Error; err != nil {
		return nil, nil, nil, fmt.Errorf("RM Order tidak ditemukan")
	}

	var rmDup models.EKlaimRMDuplicate
	if err := database.DB.
		Preload("Visit.Registration.Patient").
		Preload("Visit.Room").
		Preload("Visit.Doctor").
		First(&rmDup, rmOrder.RMDuplicateID).Error; err != nil {
		return nil, nil, nil, fmt.Errorf("RM Duplicate tidak ditemukan")
	}

	if rmDup.Visit == nil || rmDup.Visit.Registration == nil || rmDup.Visit.Registration.Patient == nil {
		return nil, nil, nil, fmt.Errorf("Data pasien tidak ditemukan")
	}

	return &rmOrder, rmDup.Visit.Registration.Patient, rmDup.Visit, nil
}
