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
	OrderID      uint   `json:"order_id"`
	OrderNumber  string `json:"order_number"`
	OrderItemID  uint   `json:"order_item_id"`
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
	ID                  uint       `json:"id"`
	MedicineOrderItemID uint       `json:"medicine_order_item_id"`
	ScheduledAt         time.Time  `json:"scheduled_at"`
	Status              string     `json:"status"`
	AdministeredAt      *time.Time `json:"administered_at,omitempty"`
	AdministeredBy      *uint      `json:"administered_by,omitempty"`
	Notes               string     `json:"notes"`
}

func normalizeTimesheetStatus(value string) (string, bool) {
	status := strings.TrimSpace(strings.ToLower(value))
	switch status {
	case "", "none":
		return "", true
	case models.TimesheetStatusScheduled, models.TimesheetStatusGiven, models.TimesheetStatusHeld, models.TimesheetStatusSkipped:
		return status, true
	default:
		return "", false
	}
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

// GetMedicationTimesheet returns in-room medicine rows and hourly logs for a visit/day.
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

	var visit models.Visit
	if err := database.DB.Select("id", "registration_id").First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
		return
	}

	var orders []models.MedicineOrder
	if err := database.DB.
		Where("source_visit_id = ? AND fulfillment_type = ? AND status <> ?", visitID, models.FulfillmentTypeInRoom, models.OrderStatusCancelled).
		Preload("Items", "status <> ?", models.ItemStatusCancelled).
		Preload("Items.Medicine").
		Order("created_at ASC").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]timesheetMedicineItem, 0)
	for _, order := range orders {
		for _, item := range order.Items {
			medicineName := ""
			medicineCode := ""
			if item.Medicine != nil {
				medicineName = item.Medicine.Name
				medicineCode = item.Medicine.Code
			}
			items = append(items, timesheetMedicineItem{
				OrderID:      order.ID,
				OrderNumber:  order.OrderNumber,
				OrderItemID:  item.ID,
				MedicineID:   item.MedicineID,
				MedicineName: medicineName,
				MedicineCode: medicineCode,
				Quantity:     item.Quantity,
				Unit:         item.Unit,
				Dosage:       item.Dosage,
				Frequency:    item.Frequency,
				Route:        item.Route,
				Duration:     item.Duration,
				Instructions: item.Instructions,
			})
		}
	}

	var entries []models.MedicineAdministrationTimesheet
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
			ID:                  entry.ID,
			MedicineOrderItemID: entry.MedicineOrderItemID,
			ScheduledAt:         entry.ScheduledAt,
			Status:              entry.Status,
			AdministeredAt:      entry.AdministeredAt,
			AdministeredBy:      entry.AdministeredBy,
			Notes:               entry.Notes,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"visit_id": visitID,
		"date":     start.Format("2006-01-02"),
		"items":    items,
		"entries":  entryResponses,
	})
}

// UpsertMedicationTimesheetEntry creates, updates, or clears a slot in the medication timesheet.
func UpsertMedicationTimesheetEntry(c *gin.Context) {
	var input struct {
		VisitID             uint   `json:"visit_id" binding:"required"`
		MedicineOrderItemID uint   `json:"medicine_order_item_id" binding:"required"`
		Date                string `json:"date" binding:"required"`
		Hour                *int   `json:"hour" binding:"required"`
		Status              string `json:"status"`
		Notes               string `json:"notes"`
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

	var item models.MedicineOrderItem
	if err := database.DB.
		Joins("JOIN medicine_orders ON medicine_orders.id = medicine_order_items.medicine_order_id").
		Where("medicine_order_items.id = ?", input.MedicineOrderItemID).
		Where("medicine_orders.source_visit_id = ?", input.VisitID).
		Where("medicine_orders.fulfillment_type = ?", models.FulfillmentTypeInRoom).
		Where("medicine_orders.status <> ?", models.OrderStatusCancelled).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "medicine order item is not eligible for in-room timesheet"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.Select("id", "registration_id").First(&visit, input.VisitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
		return
	}

	tx := database.DB.Begin()

	if status == "" {
		if err := tx.Unscoped().Where("medicine_order_item_id = ? AND scheduled_at = ?", input.MedicineOrderItemID, slotTime).
			Delete(&models.MedicineAdministrationTimesheet{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		tx.Commit()
		c.JSON(http.StatusOK, gin.H{"message": "timesheet slot cleared"})
		return
	}

	var entry models.MedicineAdministrationTimesheet
	findErr := tx.Unscoped().Where("medicine_order_item_id = ? AND scheduled_at = ?", input.MedicineOrderItemID, slotTime).
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
	entry.MedicineOrderID = item.MedicineOrderID
	entry.MedicineOrderItemID = input.MedicineOrderItemID
	entry.ScheduledAt = slotTime
	entry.Status = status
	entry.DeletedAt = gorm.DeletedAt{}
	entry.Notes = strings.TrimSpace(input.Notes)
	if status == models.TimesheetStatusGiven {
		now := time.Now()
		entry.AdministeredAt = &now
		entry.AdministeredBy = administeredBy
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
		ID:                  entry.ID,
		MedicineOrderItemID: entry.MedicineOrderItemID,
		ScheduledAt:         entry.ScheduledAt,
		Status:              entry.Status,
		AdministeredAt:      entry.AdministeredAt,
		AdministeredBy:      entry.AdministeredBy,
		Notes:               entry.Notes,
	})
}
