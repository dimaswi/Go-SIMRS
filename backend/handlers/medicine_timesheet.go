package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type timesheetMedicineItem struct {
	ItemID       uint   `json:"item_id"`
	MedicineID   uint   `json:"medicine_id"`
	MedicineName string `json:"medicine_name"`
	MedicineCode string `json:"medicine_code"`
	Quantity     int    `json:"quantity"`
	Unit         string `json:"unit"`
	Dosage       string `json:"dosage"`
	Frequency    string `json:"frequency"`
	Route        string `json:"route"`
	Duration     string `json:"duration"`
	Instructions string `json:"instructions"`
}

type timesheetEntryResponse struct {
	ID              uint       `json:"id"`
	TimesheetItemID uint       `json:"timesheet_item_id"`
	ScheduledAt     time.Time  `json:"scheduled_at"`
	Status          string     `json:"status"`
	ReasonCode      string     `json:"reason_code"`
	ReasonDetail    string     `json:"reason_detail"`
	AdministeredAt  *time.Time `json:"administered_at,omitempty"`
	AdministeredBy  *uint      `json:"administered_by,omitempty"`
	Notes           string     `json:"notes"`
}

func normalizeTimesheetStatus(value string) (string, bool) {
	status := strings.TrimSpace(strings.ToLower(value))
	switch status {
	case "", "none":
		return "", true
	case models.TimesheetStatusScheduled,
		models.TimesheetStatusGiven,
		models.TimesheetStatusHeld,
		models.TimesheetStatusSkipped,
		models.TimesheetStatusRefused,
		models.TimesheetStatusUnavailable,
		models.TimesheetStatusContraindicated,
		models.TimesheetStatusPatientAbsent:
		return status, true
	default:
		return "", false
	}
}

func normalizeTimesheetReasonCode(value string) (string, bool) {
	reason := strings.TrimSpace(strings.ToLower(value))
	switch reason {
	case "", "none":
		return "", true
	case models.TimesheetReasonClinicalHold,
		models.TimesheetReasonContraindication,
		models.TimesheetReasonPatientRefused,
		models.TimesheetReasonDrugUnavailable,
		models.TimesheetReasonPatientUnavailable,
		models.TimesheetReasonOther:
		return reason, true
	default:
		return "", false
	}
}

func isTimesheetReasonAllowed(status string, reason string) bool {
	if reason == "" {
		return true
	}

	switch status {
	case models.TimesheetStatusHeld, models.TimesheetStatusSkipped:
		return true
	case models.TimesheetStatusRefused:
		return reason == models.TimesheetReasonPatientRefused || reason == models.TimesheetReasonOther
	case models.TimesheetStatusUnavailable:
		return reason == models.TimesheetReasonDrugUnavailable || reason == models.TimesheetReasonOther
	case models.TimesheetStatusContraindicated:
		return reason == models.TimesheetReasonContraindication || reason == models.TimesheetReasonClinicalHold || reason == models.TimesheetReasonOther
	case models.TimesheetStatusPatientAbsent:
		return reason == models.TimesheetReasonPatientUnavailable || reason == models.TimesheetReasonOther
	default:
		return false
	}
}

func requiresReason(status string) bool {
	return status != "" && status != models.TimesheetStatusScheduled && status != models.TimesheetStatusGiven
}

func validateTimesheetClinicalInput(status string, reasonCode string, reasonDetail string, notes string) error {
	trimmedReasonDetail := strings.TrimSpace(reasonDetail)
	trimmedNotes := strings.TrimSpace(notes)

	if !requiresReason(status) {
		return nil
	}

	if reasonCode == "" {
		return errors.New("reason_code is required for this status")
	}

	if !isTimesheetReasonAllowed(status, reasonCode) {
		return errors.New("reason_code is not compatible with selected status")
	}

	if reasonCode == models.TimesheetReasonOther && trimmedReasonDetail == "" {
		return errors.New("reason_detail is required when reason_code is other")
	}

	if trimmedNotes == "" {
		return errors.New("notes is required for non-given status")
	}

	return nil
}

func parseTimesheetDateAndHour(dateText string, hour int) (time.Time, error) {
	if hour < 0 || hour > 23 {
		return time.Time{}, errors.New("hour must be between 0 and 23")
	}
	day, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(dateText), time.Local)
	if err != nil {
		return time.Time{}, errors.New("invalid date format, expected YYYY-MM-DD")
	}
	return time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, time.Local), nil
}

func loadTimesheetVisit(c *gin.Context, visitID uint) (*models.Visit, error) {
	var visit models.Visit
	if err := database.DB.Select("id", "registration_id").First(&visit, visitID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
			return nil, err
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return nil, err
	}
	return &visit, nil
}

// GetMedicationTimesheet returns manually selected medicine rows and hourly logs for a visit/day.
func GetMedicationTimesheet(c *gin.Context) {
	visitIDValue := c.Query("visit_id")
	if visitIDValue == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visit_id is required"})
		return
	}

	visitID64, err := strconv.ParseUint(visitIDValue, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visit_id"})
		return
	}
	visitID := uint(visitID64)

	dateValue := c.Query("date")
	if dateValue == "" {
		dateValue = time.Now().Format("2006-01-02")
	}
	day, err := time.ParseInLocation("2006-01-02", dateValue, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, expected YYYY-MM-DD"})
		return
	}
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	end := start.Add(24 * time.Hour)

	if _, err := loadTimesheetVisit(c, visitID); err != nil {
		return
	}

	var itemRows []models.MedicineAdministrationTimesheetItem
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Order("created_at ASC, id ASC").
		Find(&itemRows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]timesheetMedicineItem, 0)
	for _, item := range itemRows {
		items = append(items, timesheetMedicineItem{
			ItemID:       item.ID,
			MedicineID:   item.MedicineID,
			MedicineName: item.MedicineName,
			MedicineCode: item.MedicineCode,
			Quantity:     item.Quantity,
			Unit:         item.Unit,
			Dosage:       item.Dosage,
			Frequency:    item.Frequency,
			Route:        item.Route,
			Duration:     item.Duration,
			Instructions: item.Instructions,
		})
	}

	var entries []models.MedicineAdministrationTimesheetEntry
	if err := database.DB.
		Where("visit_id = ? AND scheduled_at >= ? AND scheduled_at < ?", visitID, start, end).
		Order("scheduled_at ASC").
		Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	entryResponses := make([]timesheetEntryResponse, 0, len(entries))
	for _, entry := range entries {
		entryResponses = append(entryResponses, timesheetEntryResponse{
			ID:              entry.ID,
			TimesheetItemID: entry.TimesheetItemID,
			ScheduledAt:     entry.ScheduledAt,
			Status:          entry.Status,
			ReasonCode:      entry.ReasonCode,
			ReasonDetail:    entry.ReasonDetail,
			AdministeredAt:  entry.AdministeredAt,
			AdministeredBy:  entry.AdministeredBy,
			Notes:           entry.Notes,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"visit_id": visitID,
		"date":     start.Format("2006-01-02"),
		"items":    items,
		"entries":  entryResponses,
	})
}

// CreateMedicationTimesheetItem creates a manual timesheet item from master medicine.
func CreateMedicationTimesheetItem(c *gin.Context) {
	var input struct {
		VisitID      uint   `json:"visit_id" binding:"required"`
		MedicineID   uint   `json:"medicine_id" binding:"required"`
		Quantity     int    `json:"quantity"`
		Unit         string `json:"unit"`
		Dosage       string `json:"dosage"`
		Frequency    string `json:"frequency"`
		Route        string `json:"route"`
		Duration     string `json:"duration"`
		Instructions string `json:"instructions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visit, err := loadTimesheetVisit(c, input.VisitID)
	if err != nil {
		return
	}

	var medicine models.Medicine
	if err := database.DB.Select("id", "name", "code", "unit", "is_active").First(&medicine, input.MedicineID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "medicine not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if input.Quantity <= 0 {
		input.Quantity = 1
	}

	item := models.MedicineAdministrationTimesheetItem{
		VisitID:        input.VisitID,
		RegistrationID: visit.RegistrationID,
		MedicineID:     medicine.ID,
		MedicineName:   strings.TrimSpace(medicine.Name),
		MedicineCode:   strings.TrimSpace(medicine.Code),
		Quantity:       input.Quantity,
		Unit:           strings.TrimSpace(input.Unit),
		Dosage:         strings.TrimSpace(input.Dosage),
		Frequency:      strings.TrimSpace(input.Frequency),
		Route:          strings.TrimSpace(input.Route),
		Duration:       strings.TrimSpace(input.Duration),
		Instructions:   strings.TrimSpace(input.Instructions),
	}
	if item.Unit == "" {
		item.Unit = strings.TrimSpace(medicine.Unit)
	}

	if err := database.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, timesheetMedicineItem{
		ItemID:       item.ID,
		MedicineID:   item.MedicineID,
		MedicineName: item.MedicineName,
		MedicineCode: item.MedicineCode,
		Quantity:     item.Quantity,
		Unit:         item.Unit,
		Dosage:       item.Dosage,
		Frequency:    item.Frequency,
		Route:        item.Route,
		Duration:     item.Duration,
		Instructions: item.Instructions,
	})
}

// DeleteMedicationTimesheetItem removes a manual timesheet item and its slots.
func DeleteMedicationTimesheetItem(c *gin.Context) {
	itemID64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}
	visitID64, err := strconv.ParseUint(c.Query("visit_id"), 10, 32)
	if err != nil || visitID64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visit_id is required"})
		return
	}

	if _, err := loadTimesheetVisit(c, uint(visitID64)); err != nil {
		return
	}

	tx := database.DB.Begin()
	if err := tx.Where("timesheet_item_id = ? AND visit_id = ?", uint(itemID64), uint(visitID64)).
		Delete(&models.MedicineAdministrationTimesheetEntry{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := tx.Where("id = ? AND visit_id = ?", uint(itemID64), uint(visitID64)).
		Delete(&models.MedicineAdministrationTimesheetItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "timesheet item deleted"})
}

// UpsertMedicationTimesheetEntry creates, updates, or clears a slot in the medication timesheet.
func UpsertMedicationTimesheetEntry(c *gin.Context) {
	var input struct {
		VisitID         uint   `json:"visit_id" binding:"required"`
		TimesheetItemID uint   `json:"timesheet_item_id" binding:"required"`
		Date            string `json:"date" binding:"required"`
		Hour            *int   `json:"hour" binding:"required"`
		Status          string `json:"status"`
		ReasonCode      string `json:"reason_code"`
		ReasonDetail    string `json:"reason_detail"`
		Notes           string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slotTime, err := parseTimesheetDateAndHour(input.Date, *input.Hour)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, ok := normalizeTimesheetStatus(input.Status)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	reasonCode, ok := normalizeTimesheetReasonCode(input.ReasonCode)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid reason_code"})
		return
	}

	if err := validateTimesheetClinicalInput(status, reasonCode, input.ReasonDetail, input.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var item models.MedicineAdministrationTimesheetItem
	if err := database.DB.
		Where("id = ? AND visit_id = ?", input.TimesheetItemID, input.VisitID).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "timesheet item not found for visit"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	visit, err := loadTimesheetVisit(c, input.VisitID)
	if err != nil {
		return
	}

	tx := database.DB.Begin()

	if status == "" {
		if err := tx.Unscoped().Where("timesheet_item_id = ? AND scheduled_at = ?", input.TimesheetItemID, slotTime).
			Delete(&models.MedicineAdministrationTimesheetEntry{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		tx.Commit()
		c.JSON(http.StatusOK, gin.H{"message": "timesheet slot cleared"})
		return
	}

	var entry models.MedicineAdministrationTimesheetEntry
	findErr := tx.Unscoped().Where("timesheet_item_id = ? AND scheduled_at = ?", input.TimesheetItemID, slotTime).
		First(&entry).Error
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": findErr.Error()})
		return
	}

	var administeredBy *uint
	if userIDValue, exists := c.Get("userID"); exists && userIDValue != nil {
		if userID, ok := userIDValue.(uint); ok {
			administeredBy = &userID
		}
	}

	entry.VisitID = input.VisitID
	entry.RegistrationID = visit.RegistrationID
	entry.TimesheetItemID = input.TimesheetItemID
	entry.ScheduledAt = slotTime
	entry.Status = status
	entry.DeletedAt = gorm.DeletedAt{}
	entry.Notes = strings.TrimSpace(input.Notes)
	entry.ReasonCode = reasonCode
	entry.ReasonDetail = strings.TrimSpace(input.ReasonDetail)
	if status == models.TimesheetStatusGiven {
		now := time.Now()
		entry.AdministeredAt = &now
		entry.AdministeredBy = administeredBy
		entry.ReasonCode = ""
		entry.ReasonDetail = ""
	} else if status == models.TimesheetStatusScheduled {
		entry.AdministeredAt = nil
		entry.AdministeredBy = nil
		entry.ReasonCode = ""
		entry.ReasonDetail = ""
	} else {
		entry.AdministeredAt = nil
		entry.AdministeredBy = nil
	}

	if errors.Is(findErr, gorm.ErrRecordNotFound) {
		if err := tx.Create(&entry).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		if err := tx.Save(&entry).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, timesheetEntryResponse{
		ID:              entry.ID,
		TimesheetItemID: entry.TimesheetItemID,
		ScheduledAt:     entry.ScheduledAt,
		Status:          entry.Status,
		ReasonCode:      entry.ReasonCode,
		ReasonDetail:    entry.ReasonDetail,
		AdministeredAt:  entry.AdministeredAt,
		AdministeredBy:  entry.AdministeredBy,
		Notes:           entry.Notes,
	})
}
