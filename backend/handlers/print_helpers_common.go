package handlers

import (
	"fmt"
	"strings"
	"strconv"
	"starter/backend/database"
	"starter/backend/models"

	"gorm.io/gorm"
)

// formatFloatNoExponent converts a float to a string without trailing zeros and without scientific notation
func formatFloatNoExponent(val float64) string {
	return strconv.FormatFloat(val, 'f', -1, 64)
}

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

// formatNumericString adds thousand separators (dot) to a string containing numbers, 
// leaving decimals and non-numeric characters intact.
func formatNumericString(s string) string {
	// Simple approach: split by space, format each part if it looks like a number
	// More complex: use regex to find numbers and format them
	var result strings.Builder
	var currentNum string

	formatIntPart := func(numStr string) string {
		n := len(numStr)
		if n <= 3 {
			return numStr
		}
		var res []byte
		for i, c := range numStr {
			if i > 0 && (n-i)%3 == 0 {
				res = append(res, '.')
			}
			res = append(res, byte(c))
		}
		return string(res)
	}

	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= '0' && c <= '9' {
			currentNum += string(c)
		} else {
			if currentNum != "" {
				result.WriteString(formatIntPart(currentNum))
				currentNum = ""
			}
			// If it's a decimal dot between two digits, convert to Indonesian decimal comma
			if c == '.' && i > 0 && i < len(s)-1 && s[i-1] >= '0' && s[i-1] <= '9' && s[i+1] >= '0' && s[i+1] <= '9' {
				result.WriteByte(',')
			} else {
				result.WriteByte(c)
			}
		}
	}
	if currentNum != "" {
		result.WriteString(formatIntPart(currentNum))
	}

	return result.String()
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
