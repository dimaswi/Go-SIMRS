package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
)

// ===========================================================================
// PROCEDURE ORDER HANDLERS (Radiology & Laboratory)
// ===========================================================================

// GetProcedureOrders gets all procedure orders with filters
func GetProcedureOrders(c *gin.Context) {
	var orders []models.ProcedureOrder
	query := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("TargetVisit.Doctor").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		Preload("Consultation.Consultant")

	// Filter by order type (radiology/laboratory)
	if orderType := c.Query("order_type"); orderType != "" {
		query = query.Where("order_type = ?", orderType)
	}

	// Filter by source visit
	if sourceVisitID := c.Query("source_visit_id"); sourceVisitID != "" {
		query = query.Where("source_visit_id = ?", sourceVisitID)
	}

	// Filter by target visit (for radiology/lab room view)
	if targetVisitID := c.Query("target_visit_id"); targetVisitID != "" {
		query = query.Where("target_visit_id = ?", targetVisitID)
	}

	// Filter by target room
	if targetRoomID := c.Query("target_room_id"); targetRoomID != "" {
		query = query.Where("target_room_id = ?", targetRoomID)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by registration
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(created_at) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(created_at) <= ?", endDate)
	}

	// Order by latest first
	query = query.Order("created_at DESC")

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// For consultation orders without direct consultation relation, try to load by target_visit_id or procedure_order_id
	for i := range orders {
		if orders[i].OrderType == "consultation" && orders[i].Consultation == nil {
			var consultation models.Consultation
			// Try by procedure_order_id first
			if err := database.DB.Preload("Consultant").
				Where("procedure_order_id = ?", orders[i].ID).
				First(&consultation).Error; err == nil {
				orders[i].Consultation = &consultation
			} else if orders[i].TargetVisitID != nil {
				// Fallback to target_visit_id
				if err := database.DB.Preload("Consultant").
					Where("visit_id = ?", *orders[i].TargetVisitID).
					First(&consultation).Error; err == nil {
					orders[i].Consultation = &consultation
				}
			}
		}
	}

	c.JSON(http.StatusOK, orders)
}

// GetProcedureOrder gets a single procedure order by ID
func GetProcedureOrder(c *gin.Context) {
	id := c.Param("id")

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		Preload("Items.PerformedBy").
		Preload("Consultation.Consultant").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

// CreateProcedureOrder creates a new procedure order (radiology or laboratory)
func CreateProcedureOrder(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var input struct {
		OrderType       string `json:"order_type" binding:"required"` // radiology, laboratory, consultation, surgery
		SourceVisitID   uint   `json:"source_visit_id" binding:"required"`
		TargetRoomID    uint   `json:"target_room_id" binding:"required"`
		Priority        string `json:"priority"`
		ClinicalNotes   string `json:"clinical_notes"`
		Diagnosis       string `json:"diagnosis"`
		Notes           string `json:"notes"`
		SurgeonDoctorID *uint  `json:"surgeon_doctor_id"` // Dokter bedah (for surgery orders)
		ScheduledDate   string `json:"scheduled_date"`    // Tanggal jadwal operasi (for surgery orders)
		Items           []struct {
			ProcedureID uint   `json:"procedure_id" binding:"required"`
			Notes       string `json:"notes"`
		} `json:"items" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate order type
	if input.OrderType != models.ProcedureOrderTypeRadiology &&
		input.OrderType != models.ProcedureOrderTypeLaboratory &&
		input.OrderType != models.ProcedureOrderTypeConsultation &&
		input.OrderType != models.ProcedureOrderTypeSurgery {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order type. Must be 'radiology', 'laboratory', 'consultation', or 'surgery'"})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	// Get source visit
	var sourceVisit models.Visit
	if err := database.DB.Preload("Registration").First(&sourceVisit, input.SourceVisitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source visit not found"})
		return
	}

	// Get target room
	var targetRoom models.Room
	if err := database.DB.First(&targetRoom, input.TargetRoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Target room not found"})
		return
	}

	tx := database.DB.Begin()

	// Generate order number
	today := time.Now().Format("20060102")
	var prefix string
	switch input.OrderType {
	case models.ProcedureOrderTypeRadiology:
		prefix = "RAD"
	case models.ProcedureOrderTypeLaboratory:
		prefix = "LAB"
	case models.ProcedureOrderTypeConsultation:
		prefix = "CONS"
	case models.ProcedureOrderTypeSurgery:
		prefix = "SRG"
	default:
		prefix = "ORD"
	}

	var lastOrder models.ProcedureOrder
	var orderNum int
	err := tx.Where("order_number LIKE ?", prefix+today+"%").
		Order("order_number DESC").First(&lastOrder).Error
	if err != nil {
		orderNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastOrder.OrderNumber, prefix+today+"%d", &lastNum)
		orderNum = lastNum + 1
	}
	orderNumber := fmt.Sprintf("%s%s%04d", prefix, today, orderNum)

	// Create target visit
	visitNumber := fmt.Sprintf("VIS%s%06d", time.Now().Format("20060102"), time.Now().UnixNano()%1000000)
	var visitType string
	var visitPurpose string
	switch input.OrderType {
	case models.ProcedureOrderTypeRadiology:
		visitType = models.VisitTypeRadiology
		visitPurpose = "Pemeriksaan Radiologi"
	case models.ProcedureOrderTypeLaboratory:
		visitType = models.VisitTypeLab
		visitPurpose = "Pemeriksaan Laboratorium"
	case models.ProcedureOrderTypeConsultation:
		visitType = models.VisitTypeConsultation
		visitPurpose = "Konsultasi ke " + targetRoom.Name
	case models.ProcedureOrderTypeSurgery:
		visitType = models.VisitTypeSurgery
		visitPurpose = "Operasi/Bedah di " + targetRoom.Name
	default:
		visitType = "other"
		visitPurpose = "Pemeriksaan"
	}

	targetVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: sourceVisit.RegistrationID,
		RoomID:         input.TargetRoomID,
		VisitType:      visitType,
		VisitPurpose:   visitPurpose,
		ReferralFrom:   &sourceVisit.ID,
		Status:         models.VisitStatusWaiting,
	}

	if err := tx.Create(&targetVisit).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create target visit: " + err.Error()})
		return
	}

	// Create room queue untuk radiology, laboratory, dan surgery (TIDAK untuk consultation)
	if input.OrderType == models.ProcedureOrderTypeRadiology || input.OrderType == models.ProcedureOrderTypeLaboratory || input.OrderType == models.ProcedureOrderTypeSurgery {
		queueNumber := generateProcedureQueueNumber(tx, input.TargetRoomID)

		// Get room for queue code
		var targetRoomData models.Room
		if err := tx.First(&targetRoomData, input.TargetRoomID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get target room: " + err.Error()})
			return
		}

		queueCode := targetRoomData.QueueCode
		if queueCode == "" {
			queueCode = "Q"
		}

		// Parse priority for queue
		queuePriority := input.Priority
		if queuePriority == "" {
			queuePriority = "normal"
		}

		roomQueue := models.RoomQueue{
			VisitID:     targetVisit.ID,
			RoomID:      input.TargetRoomID,
			QueueNumber: queueNumber,
			QueueCode:   queueCode,
			QueueDate:   time.Now(),
			Priority:    queuePriority,
			Status:      models.RoomQueueStatusWaiting,
		}

		if err := tx.Create(&roomQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room queue: " + err.Error()})
			return
		}
	}

	// Set priority
	priority := input.Priority
	if priority == "" {
		priority = "normal"
	}

	// Parse scheduled date if provided (for surgery orders)
	var scheduledDate *time.Time
	if input.ScheduledDate != "" {
		// Try parsing with time
		if parsed, ok := TryParseLocalDatetime(input.ScheduledDate); ok {
			scheduledDate = &parsed
		} else if parsed, err := ParseLocalDate(input.ScheduledDate); err == nil {
			scheduledDate = &parsed
		} else {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scheduled_date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM"})
			return
		}
	}

	// Validate surgery schedule: check doctor's schedule matches the selected date/time
	if input.OrderType == models.ProcedureOrderTypeSurgery && scheduledDate != nil && input.SurgeonDoctorID != nil {
		dayOfWeek := int(scheduledDate.Weekday())
		dateStr := scheduledDate.Format("2006-01-02")
		scheduledTime := scheduledDate.Format("15:04")

		// Find doctor schedule for this room, day, and within effective dates
		var schedule models.DoctorSchedule
		err := tx.Where("room_id = ? AND employee_id = ? AND day_of_week = ?",
			input.TargetRoomID, *input.SurgeonDoctorID, dayOfWeek).
			Where("(effective_from IS NULL OR DATE(effective_from) <= ?) AND (effective_to IS NULL OR DATE(effective_to) >= ?)", dateStr, dateStr).
			First(&schedule).Error

		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter bedah tidak memiliki jadwal di hari tersebut"})
			return
		}

		// Validate time is within doctor's schedule
		if scheduledTime < schedule.StartTime || scheduledTime > schedule.EndTime {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Jam operasi (%s) di luar jadwal dokter (%s - %s)", scheduledTime, schedule.StartTime, schedule.EndTime)})
			return
		}
	}

	// Create procedure order
	order := models.ProcedureOrder{
		OrderNumber:     orderNumber,
		OrderType:       input.OrderType,
		SourceVisitID:   input.SourceVisitID,
		TargetVisitID:   &targetVisit.ID,
		SourceRoomID:    sourceVisit.RoomID,
		TargetRoomID:    input.TargetRoomID,
		RegistrationID:  sourceVisit.RegistrationID,
		OrderedByID:     *user.EmployeeID,
		SurgeonDoctorID: input.SurgeonDoctorID,
		ScheduledDate:   scheduledDate,
		Priority:        priority,
		ClinicalNotes:   input.ClinicalNotes,
		Diagnosis:       input.Diagnosis,
		Notes:           input.Notes,
		Status:          models.ProcedureOrderStatusPending,
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create procedure order: " + err.Error()})
		return
	}

	// Create order items
	for _, itemInput := range input.Items {
		// Validate procedure exists
		var procedure models.Procedure
		if err := tx.First(&procedure, itemInput.ProcedureID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Procedure ID %d not found", itemInput.ProcedureID)})
			return
		}

		if input.OrderType == models.ProcedureOrderTypeSurgery {
			// For surgery: validate that procedure is assigned to the target OR room
			var roomProcedure models.RoomProcedure
			if err := tx.Where("room_id = ? AND procedure_id = ? AND is_available = ?",
				input.TargetRoomID, itemInput.ProcedureID, true).
				First(&roomProcedure).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Tindakan '%s' tidak tersedia di kamar operasi yang dipilih", procedure.Name)})
				return
			}
		} else {
			// For radiology/laboratory/consultation: validate procedure_type matches
			if procedure.ProcedureType != input.OrderType {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Procedure '%s' is not a %s procedure", procedure.Name, input.OrderType)})
				return
			}
		}

		item := models.ProcedureOrderItem{
			ProcedureOrderID: order.ID,
			ProcedureID:      itemInput.ProcedureID,
			Status:           models.ProcedureOrderStatusPending,
			Notes:            itemInput.Notes,
		}

		if err := tx.Create(&item).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order item: " + err.Error()})
			return
		}
	}

	tx.Commit()

	// Reload order with all relations
	database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("Items.Procedure").
		First(&order, order.ID)

	// Send notification to target room users
	if NotifService != nil {
		var notifTitle string
		var notifType models.NotificationType
		patientName := ""
		if order.Registration.Patient.NamaLengkap != "" {
			patientName = order.Registration.Patient.NamaLengkap
		}

		switch input.OrderType {
		case models.ProcedureOrderTypeRadiology:
			notifTitle = "Order Radiologi Baru"
			notifType = models.NotificationTypeProcedureOrder
		case models.ProcedureOrderTypeLaboratory:
			notifTitle = "Order Laboratorium Baru"
			notifType = models.NotificationTypeProcedureOrder
		case models.ProcedureOrderTypeConsultation:
			notifTitle = "Konsultasi Baru"
			notifType = models.NotificationTypeProcedureOrder
		default:
			notifTitle = "Order Baru"
			notifType = models.NotificationTypeProcedureOrder
		}

		notifMessage := fmt.Sprintf("Order %s untuk pasien %s dari %s",
			order.OrderNumber, patientName, order.SourceRoom.Name)

		NotifService.NotifyRoomUsers(
			input.TargetRoomID,
			notifType,
			notifTitle,
			notifMessage,
			map[string]interface{}{
				"order_id":        order.ID,
				"order_number":    order.OrderNumber,
				"order_type":      input.OrderType,
				"patient_name":    patientName,
				"source_room":     order.SourceRoom.Name,
				"target_room":     order.TargetRoom.Name,
				"target_visit_id": targetVisit.ID,
			},
		)
	}

	c.JSON(http.StatusCreated, order)
}

// Helper function to generate procedure queue number
func generateProcedureQueueNumber(tx *gorm.DB, roomID uint) string {
	var room models.Room
	tx.First(&room, roomID)

	prefix := room.QueueCode
	if prefix == "" {
		prefix = "Q"
	}

	today := time.Now().Format("2006-01-02")
	var lastQueue models.RoomQueue
	var queueNum int

	err := tx.Where("room_id = ? AND DATE(created_at) = ?", roomID, today).
		Order("queue_number DESC").First(&lastQueue).Error

	if err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, prefix+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	return fmt.Sprintf("%s%03d", prefix, queueNum)
}

// StartProcedureOrder starts working on a procedure order
func StartProcedureOrder(c *gin.Context) {
	id := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.ProcedureOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status != models.ProcedureOrderStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order is not in pending status"})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	now := time.Now()
	order.Status = models.ProcedureOrderStatusInProgress
	order.PerformedByID = user.EmployeeID
	order.StartedAt = &now

	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update target visit status
	if order.TargetVisitID != nil {
		database.DB.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
			Update("status", models.VisitStatusInProgress)
		database.DB.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":    models.RoomQueueStatusServing,
				"served_at": now,
			})
	}

	// Reload
	database.DB.
		Preload("PerformedBy").
		Preload("Items.Procedure").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// SubmitProcedureResults submits results for a procedure order
func SubmitProcedureResults(c *gin.Context) {
	id := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.ProcedureOrder
	if err := database.DB.Preload("Items").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status != models.ProcedureOrderStatusInProgress && order.Status != models.ProcedureOrderStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order cannot be modified"})
		return
	}

	var input struct {
		ResultSummary string `json:"result_summary"`
		Conclusion    string `json:"conclusion"`
		Suggestion    string `json:"suggestion"`
		IsCritical    bool   `json:"is_critical"`
		CriticalNotes string `json:"critical_notes"`
		Items         []struct {
			ItemID  uint   `json:"item_id" binding:"required"`
			Notes   string `json:"notes"`
			Results []struct {
				ParameterID  uint    `json:"parameter_id" binding:"required"`
				Value        string  `json:"value"`
				NumericValue float64 `json:"numeric_value"`
				Notes        string  `json:"notes"`
			} `json:"results"`
		} `json:"items"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	tx := database.DB.Begin()

	now := time.Now()

	// Update order
	order.ResultSummary = input.ResultSummary
	order.Conclusion = input.Conclusion
	order.Suggestion = input.Suggestion
	order.IsCritical = input.IsCritical
	order.CriticalNotes = input.CriticalNotes
	order.Status = models.ProcedureOrderStatusCompleted
	order.CompletedAt = &now

	if order.PerformedByID == nil {
		order.PerformedByID = user.EmployeeID
		order.StartedAt = &now
	}

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Process items and results
	for _, itemInput := range input.Items {
		// Ensure item belongs to this order
		var item models.ProcedureOrderItem
		if err := tx.Where("id = ? AND procedure_order_id = ?", itemInput.ItemID, order.ID).First(&item).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order item for this procedure order"})
			return
		}

		// Update item
		if err := tx.Model(&models.ProcedureOrderItem{}).Where("id = ?", itemInput.ItemID).
			Updates(map[string]interface{}{
				"status":          models.ProcedureOrderStatusCompleted,
				"completed_at":    now,
				"performed_by_id": user.EmployeeID,
				"notes":           itemInput.Notes,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order item: " + err.Error()})
			return
		}

		// Delete existing results for this item
		if err := tx.Where("procedure_order_item_id = ?", itemInput.ItemID).Delete(&models.ProcedureOrderResult{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset item results: " + err.Error()})
			return
		}

		// Create new results
		for _, resultInput := range itemInput.Results {
			// Get parameter for validation
			var param models.ProcedureParameter
			if err := tx.First(&param, resultInput.ParameterID).Error; err != nil {
				continue // Skip if parameter not found
			}

			result := models.ProcedureOrderResult{
				ProcedureOrderItemID: itemInput.ItemID,
				ProcedureParameterID: resultInput.ParameterID,
				Value:                resultInput.Value,
				NumericValue:         resultInput.NumericValue,
				Notes:                resultInput.Notes,
				IsNormal:             true,
			}

			// Check if numeric value is within normal/critical range
			if param.InputType == "number" && resultInput.NumericValue != 0 {
				result.NumericValue = resultInput.NumericValue

				// Check normal range
				if param.NormalMin != 0 || param.NormalMax != 0 {
					if resultInput.NumericValue < param.NormalMin {
						result.IsNormal = false
						result.IsLow = true
					} else if resultInput.NumericValue > param.NormalMax {
						result.IsNormal = false
						result.IsHigh = true
					}
				}

				// Check critical range
				if param.CriticalMin != 0 && resultInput.NumericValue < param.CriticalMin {
					result.IsCritical = true
				}
				if param.CriticalMax != 0 && resultInput.NumericValue > param.CriticalMax {
					result.IsCritical = true
				}
			}

			if err := tx.Create(&result).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save parameter result: " + err.Error()})
				return
			}
		}
	}

	// Update target visit and queue
	if order.TargetVisitID != nil {
		if err := tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":   models.VisitStatusCompleted,
				"end_time": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update target visit status: " + err.Error()})
			return
		}
		if err := tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":       models.RoomQueueStatusCompleted,
				"completed_at": now,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update target queue status: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// Reload order
	database.DB.
		Preload("PerformedBy").
		Preload("Items.Procedure").
		Preload("Items.Results.ProcedureParameter").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// SaveItemResults saves results for items without completing the order
func SaveItemResults(c *gin.Context) {
	id := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.ProcedureOrder
	if err := database.DB.Preload("Items").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status != models.ProcedureOrderStatusInProgress && order.Status != models.ProcedureOrderStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order cannot be modified"})
		return
	}

	var input struct {
		ResultSummary string `json:"result_summary"`
		Conclusion    string `json:"conclusion"`
		Suggestion    string `json:"suggestion"`
		IsCritical    bool   `json:"is_critical"`
		CriticalNotes string `json:"critical_notes"`
		Items         []struct {
			ItemID  uint   `json:"item_id" binding:"required"`
			Notes   string `json:"notes"`
			Results []struct {
				ParameterID  uint    `json:"parameter_id" binding:"required"`
				Value        string  `json:"value"`
				NumericValue float64 `json:"numeric_value"`
				Notes        string  `json:"notes"`
			} `json:"results"`
		} `json:"items"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	tx := database.DB.Begin()

	now := time.Now()

	// Update order with summary fields (but keep status as in_progress)
	order.ResultSummary = input.ResultSummary
	order.Conclusion = input.Conclusion
	order.Suggestion = input.Suggestion
	order.IsCritical = input.IsCritical
	order.CriticalNotes = input.CriticalNotes

	// Auto-start order if pending
	if order.Status == models.ProcedureOrderStatusPending {
		order.Status = models.ProcedureOrderStatusInProgress
		order.PerformedByID = user.EmployeeID
		order.StartedAt = &now

		// Update target visit status
		if order.TargetVisitID != nil {
			if err := tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
				Update("status", models.VisitStatusInProgress).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update target visit status: " + err.Error()})
				return
			}
			if err := tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
				Updates(map[string]interface{}{
					"status":    models.RoomQueueStatusServing,
					"served_at": now,
				}).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update target queue status: " + err.Error()})
				return
			}
		}
	}

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Process items and results
	for _, itemInput := range input.Items {
		// Ensure item belongs to this order
		var item models.ProcedureOrderItem
		if err := tx.Where("id = ? AND procedure_order_id = ?", itemInput.ItemID, order.ID).First(&item).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order item for this procedure order"})
			return
		}

		// Update item status to completed but don't mark order as complete
		if err := tx.Model(&models.ProcedureOrderItem{}).Where("id = ?", itemInput.ItemID).
			Updates(map[string]interface{}{
				"status":          models.ProcedureOrderStatusCompleted,
				"completed_at":    now,
				"performed_by_id": user.EmployeeID,
				"notes":           itemInput.Notes,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order item: " + err.Error()})
			return
		}

		// Delete existing results for this item
		if err := tx.Where("procedure_order_item_id = ?", itemInput.ItemID).Delete(&models.ProcedureOrderResult{}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset item results: " + err.Error()})
			return
		}

		// Create new results
		for _, resultInput := range itemInput.Results {
			// Get parameter for validation
			var param models.ProcedureParameter
			if err := tx.First(&param, resultInput.ParameterID).Error; err != nil {
				continue // Skip if parameter not found
			}

			result := models.ProcedureOrderResult{
				ProcedureOrderItemID: itemInput.ItemID,
				ProcedureParameterID: resultInput.ParameterID,
				Value:                resultInput.Value,
				NumericValue:         resultInput.NumericValue,
				Notes:                resultInput.Notes,
				IsNormal:             true,
			}

			// Check if numeric value is within normal/critical range
			if param.InputType == "number" && resultInput.NumericValue != 0 {
				result.NumericValue = resultInput.NumericValue

				// Check normal range
				if param.NormalMin != 0 || param.NormalMax != 0 {
					if resultInput.NumericValue < param.NormalMin {
						result.IsNormal = false
						result.IsLow = true
					} else if resultInput.NumericValue > param.NormalMax {
						result.IsNormal = false
						result.IsHigh = true
					}
				}

				// Check critical range
				if param.CriticalMin != 0 && resultInput.NumericValue < param.CriticalMin {
					result.IsCritical = true
				}
				if param.CriticalMax != 0 && resultInput.NumericValue > param.CriticalMax {
					result.IsCritical = true
				}
			}

			if err := tx.Create(&result).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save parameter result: " + err.Error()})
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// Reload order
	database.DB.
		Preload("PerformedBy").
		Preload("Items.Procedure").
		Preload("Items.Results.ProcedureParameter").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// CompleteProcedureOrder marks a procedure order as completed
func CompleteProcedureOrder(c *gin.Context) {
	id := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.ProcedureOrder
	if err := database.DB.Preload("Items").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status != models.ProcedureOrderStatusInProgress && order.Status != models.ProcedureOrderStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order is not in progress"})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	tx := database.DB.Begin()

	now := time.Now()

	// Mark order as completed
	order.Status = models.ProcedureOrderStatusCompleted
	order.CompletedAt = &now
	if order.PerformedByID == nil {
		order.PerformedByID = user.EmployeeID
	}
	if order.StartedAt == nil {
		order.StartedAt = &now
	}

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Mark all items as completed if not already
	for _, item := range order.Items {
		if item.Status != models.ProcedureOrderStatusCompleted {
			tx.Model(&models.ProcedureOrderItem{}).Where("id = ?", item.ID).
				Updates(map[string]interface{}{
					"status":          models.ProcedureOrderStatusCompleted,
					"completed_at":    now,
					"performed_by_id": user.EmployeeID,
				})
		}
	}

	// NOTE: Visit finalization is handled separately via the "Selesai Kunjungan" tab
	// Do not auto-finalize target visit when procedure order is completed

	tx.Commit()

	// Reload order
	database.DB.
		Preload("PerformedBy").
		Preload("Items.Procedure").
		Preload("Items.Results.ProcedureParameter").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// CancelProcedureOrder cancels a procedure order
func CancelProcedureOrder(c *gin.Context) {
	id := c.Param("id")

	var order models.ProcedureOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status == models.ProcedureOrderStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel completed order"})
		return
	}

	var input struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&input)

	tx := database.DB.Begin()

	order.Status = models.ProcedureOrderStatusCancelled
	order.Notes = input.Reason

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cancel target visit and queue
	if order.TargetVisitID != nil {
		tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
			Update("status", models.VisitStatusCancelled)
		tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
			Update("status", models.RoomQueueStatusCancelled)
	}

	// Cancel all items
	tx.Model(&models.ProcedureOrderItem{}).Where("procedure_order_id = ?", order.ID).
		Update("status", models.ProcedureOrderStatusCancelled)

	tx.Commit()

	c.JSON(http.StatusOK, order)
}

// RecalculateProcedureOrderStatus recalculates and fixes order status based on item statuses
func RecalculateProcedureOrderStatus(c *gin.Context) {
	id := c.Param("id")
	var order models.ProcedureOrder

	if err := database.DB.Preload("Items").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	// Count item statuses
	var completedCount, cancelledCount, inProgressCount, totalCount int
	for _, item := range order.Items {
		totalCount++
		if item.Status == models.ProcedureOrderStatusCompleted {
			completedCount++
		} else if item.Status == models.ProcedureOrderStatusCancelled {
			cancelledCount++
		} else if item.Status == models.ProcedureOrderStatusInProgress {
			inProgressCount++
		}
	}

	// Determine correct order status
	var newStatus string
	activeItems := totalCount - cancelledCount

	if activeItems == 0 {
		// All items cancelled
		newStatus = models.ProcedureOrderStatusCancelled
	} else if completedCount == activeItems {
		// All active items completed
		newStatus = models.ProcedureOrderStatusCompleted
	} else if completedCount > 0 || inProgressCount > 0 {
		// Some items in progress or completed
		newStatus = models.ProcedureOrderStatusInProgress
	} else {
		// Keep current status if nothing started yet
		newStatus = order.Status
	}

	// Update if different
	if order.Status != newStatus {
		if err := database.DB.Model(&order).Update("status", newStatus).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Order status recalculated",
		"previous_status":  order.Status,
		"new_status":       newStatus,
		"total_items":      totalCount,
		"completed_items":  completedCount,
		"cancelled_items":  cancelledCount,
		"inprogress_items": inProgressCount,
	})
}

// GetProceduresByRoom gets procedures available in a specific room
func GetProceduresByRoom(c *gin.Context) {
	roomID := c.Param("room_id")
	procedureType := c.Query("type") // radiology or laboratory

	var procedures []models.Procedure

	query := database.DB.
		Joins("JOIN room_procedures ON room_procedures.procedure_id = procedures.id").
		Where("room_procedures.room_id = ? AND room_procedures.is_available = ?", roomID, true).
		Where("procedures.is_active = ?", true).
		Preload("Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		})

	if procedureType != "" {
		query = query.Where("procedures.procedure_type = ?", procedureType)
	}

	if err := query.Find(&procedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, procedures)
}

// GetRadiologyRooms gets all radiology rooms
func GetRadiologyRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Where("room_type = ? AND is_active = ?", "radiologi", true).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// GetLaboratoryRooms gets all laboratory rooms
func GetLaboratoryRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Where("room_type = ? AND is_active = ?", "laboratorium", true).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// GetConsultationRooms gets all rooms that can receive consultation (poliklinik, rawat inap, etc)
func GetConsultationRooms(c *gin.Context) {
	excludeRoomID := c.Query("exclude_room_id")

	var rooms []models.Room
	query := database.DB.Where("is_active = ?", true).
		Where("service_type IN ?", []string{"rawat_jalan", "rawat_inap", "gawat_darurat"})

	if excludeRoomID != "" {
		query = query.Where("id != ?", excludeRoomID)
	}

	if err := query.Order("name ASC").Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rooms})
}

// GetDoctorsByRoom gets all doctors assigned to a room via room_staff
func GetDoctorsByRoom(c *gin.Context) {
	roomID := c.Param("room_id")

	var doctors []models.Employee

	// Get all employee IDs that are assigned to this room via room_staff
	var employeeIDs []uint
	err := database.DB.Table("room_staff").
		Select("employee_id").
		Where("room_id = ?", roomID).
		Where("deleted_at IS NULL").
		Pluck("employee_id", &employeeIDs).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// If no staff assigned to this room, return empty array
	if len(employeeIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []models.Employee{}})
		return
	}

	// Get employees (doctors) with those employee IDs
	err = database.DB.
		Where("id IN ?", employeeIDs).
		Where("is_active = ?", true).
		Where("tipe_karyawan = ?", models.EmployeeTypeDokter).
		Order("nama_lengkap ASC").
		Find(&doctors).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": doctors})
}

// GetConsultationProcedures gets all procedures with type consultation for a room
func GetConsultationProcedures(c *gin.Context) {
	roomID := c.Param("room_id")

	var procedures []models.Procedure
	query := database.DB.
		Joins("JOIN room_procedures ON room_procedures.procedure_id = procedures.id").
		Where("room_procedures.room_id = ?", roomID).
		Where("procedures.procedure_type = ?", "consultation").
		Where("procedures.is_active = ?", true).
		Preload("Tariffs").
		Order("procedures.name ASC")

	if err := query.Find(&procedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": procedures})
}

// GetOrdersBySourceVisit gets all procedure orders for a source visit
func GetOrdersBySourceVisit(c *gin.Context) {
	visitID := c.Param("visit_id")
	orderType := c.Query("order_type")

	var orders []models.ProcedureOrder
	query := database.DB.
		Where("source_visit_id = ?", visitID).
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		Order("created_at DESC")

	if orderType != "" {
		query = query.Where("order_type = ?", orderType)
	}

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// PrintProcedureOrderResult prints the result of a procedure order
func PrintProcedureOrderResult(c *gin.Context) {
	id := c.Param("id")

	var order models.ProcedureOrder
	if err := database.DB.
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("SurgeonDoctor").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Consultation.Consultant").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.OrderType != models.ProcedureOrderTypeSurgery && order.OrderType != models.ProcedureOrderTypeConsultation {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order type tidak didukung untuk cetak hasil prosedur"})
		return
	}

	var patient *models.Patient
	if order.Registration != nil && order.Registration.Patient != nil {
		patient = order.Registration.Patient
	}
	if patient == nil && order.SourceVisit != nil && order.SourceVisit.Registration != nil {
		patient = order.SourceVisit.Registration.Patient
	}
	if patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	hospitalInfo := getHospitalInfo()

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, 10, marginRight)
	pdf.SetAutoPageBreak(false, 15)
	pdf.AddPage()

	title := "HASIL KONSULTASI"
	if order.OrderType == models.ProcedureOrderTypeSurgery {
		title = "CATATAN OPERASI"
	}
	addHeader(pdf, hospitalInfo, title, order.OrderNumber)

	// Identitas pasien dan order
	addTableHeader(pdf, "INFORMASI PASIEN")
	addTableRow(pdf, "No. RM", safeString(patient.NoRM), 40)
	addTableRow(pdf, "Nama Pasien", safeString(patient.NamaLengkap), 40)
	birthDate := "-"
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate = formatDateIndonesian(patient.TanggalLahir.Time)
	}
	addTableRow(pdf, "Tanggal Lahir", birthDate, 40)
	if order.SourceVisit != nil {
		addTableRow(pdf, "No. Kunjungan", safeString(order.SourceVisit.VisitNumber), 40)
	}
	addTableRow(pdf, "No. Order", safeString(order.OrderNumber), 40)
	addTableRow(pdf, "Tanggal Order", formatDateTimeIndonesian(order.CreatedAt), 40)
	if order.CompletedAt != nil {
		addTableRow(pdf, "Tanggal Selesai", formatDateTimeIndonesian(*order.CompletedAt), 40)
	}
	addTableEnd(pdf)

	if order.OrderType == models.ProcedureOrderTypeConsultation {
		hasNarrativeResults := false
		if order.Consultation != nil {
			hasNarrativeResults = strings.TrimSpace(order.Consultation.Subjective) != "" ||
				strings.TrimSpace(order.Consultation.Objective) != "" ||
				strings.TrimSpace(order.Consultation.Assessment) != "" ||
				strings.TrimSpace(order.Consultation.Plan) != "" ||
				strings.TrimSpace(order.Consultation.Recommendation) != "" ||
				strings.TrimSpace(order.Consultation.Notes) != ""
		} else {
			hasNarrativeResults = strings.TrimSpace(order.ResultSummary) != "" ||
				strings.TrimSpace(order.Conclusion) != "" ||
				strings.TrimSpace(order.Suggestion) != ""
		}

		if hasNarrativeResults {
			addTableHeader(pdf, "HASIL KONSULTASI")
		}
		if order.Consultation != nil {
			if order.Consultation.Consultant != nil {
				addTableMultiRow(pdf, "Dokter Konsultan", order.Consultation.Consultant.NamaLengkap, 40)
			}
			if order.Consultation.Subjective != "" {
				addTableMultiRow(pdf, "Subjective (S)", order.Consultation.Subjective, 40)
			}
			if order.Consultation.Objective != "" {
				addTableMultiRow(pdf, "Objective (O)", order.Consultation.Objective, 40)
			}
			if order.Consultation.Assessment != "" {
				addTableMultiRow(pdf, "Assessment (A)", order.Consultation.Assessment, 40)
			}
			if order.Consultation.Plan != "" {
				addTableMultiRow(pdf, "Plan (P)", order.Consultation.Plan, 40)
			}
			if order.Consultation.Recommendation != "" {
				addTableMultiRow(pdf, "Rekomendasi", order.Consultation.Recommendation, 40)
			}
			if order.Consultation.Notes != "" {
				addTableMultiRow(pdf, "Catatan", order.Consultation.Notes, 40)
			}
		} else {
			if order.ResultSummary != "" {
				addTableMultiRow(pdf, "Ringkasan", order.ResultSummary, 40)
			}
			if order.Conclusion != "" {
				addTableMultiRow(pdf, "Kesimpulan", order.Conclusion, 40)
			}
			if order.Suggestion != "" {
				addTableMultiRow(pdf, "Saran", order.Suggestion, 40)
			}
		}
		if hasNarrativeResults {
			addTableEnd(pdf)
		}

		// Consultation now supports parameter-based results via procedure_order_items/results.
		// Render them so printed output matches what user filled in consultation form.
		hasParameterResults := false
		for _, item := range order.Items {
			if item.Status == "cancelled" {
				continue
			}

			resultByParamID := map[uint]models.ProcedureOrderResult{}
			for _, result := range item.Results {
				resultByParamID[result.ProcedureParameterID] = result
			}

			procedureName := ""
			if item.Procedure != nil {
				procedureName = item.Procedure.Name
			}

			itemRows := 0
			for _, param := range item.Procedure.Parameters {
				res, ok := resultByParamID[param.ID]
				if !ok {
					continue
				}

				value := strings.TrimSpace(res.Value)
				if value == "" {
					if param.InputType == models.InputTypeNumber || res.NumericValue != 0 {
						value = strconv.FormatFloat(res.NumericValue, 'f', -1, 64)
					}
				}
				if value == "" {
					continue
				}

				if param.Unit != "" {
					value = fmt.Sprintf("%s %s", value, param.Unit)
				}

				if !hasParameterResults {
					addTableHeader(pdf, "HASIL PARAMETER KONSULTASI")
					hasParameterResults = true
				}

				if itemRows == 0 && procedureName != "" {
					addTableMultiRow(pdf, "Tindakan", procedureName, 40)
				}

				addTableMultiRow(pdf, param.Name, value, 40)
				if strings.TrimSpace(res.Notes) != "" {
					addTableMultiRow(pdf, param.Name+" (Catatan)", strings.TrimSpace(res.Notes), 40)
				}

				itemRows++
			}
		}
		if hasParameterResults {
			addTableEnd(pdf)
		}
	} else {
		addTableHeader(pdf, "LAPORAN OPERASI")
		if order.SurgeonDoctor != nil {
			addTableMultiRow(pdf, "Dokter Operator", order.SurgeonDoctor.NamaLengkap, 40)
		}
		if order.ScheduledDate != nil {
			addTableMultiRow(pdf, "Jadwal Operasi", formatDateTimeIndonesian(*order.ScheduledDate), 40)
		}
		if order.ResultSummary != "" {
			addTableMultiRow(pdf, "Deskripsi", order.ResultSummary, 40)
		}
		if order.Conclusion != "" {
			addTableMultiRow(pdf, "Kesimpulan", order.Conclusion, 40)
		}
		if order.Suggestion != "" {
			addTableMultiRow(pdf, "Saran", order.Suggestion, 40)
		}
		for idx, item := range order.Items {
			name := ""
			if item.Procedure != nil {
				name = item.Procedure.Name
			}
			if name == "" {
				continue
			}
			addTableMultiRow(pdf, fmt.Sprintf("Tindakan %d", idx+1), name, 40)
			if item.Notes != "" {
				addTableMultiRow(pdf, "Catatan", item.Notes, 40)
			}
		}
		addTableEnd(pdf)
	}

	if order.ClinicalNotes != "" {
		addTableHeader(pdf, "CATATAN KLINIS")
		addTableFullRow(pdf, order.ClinicalNotes, false)
		addTableEnd(pdf)
	}

	docType := models.DocTypeOperativeReport
	sigLabel := "Dokter Operator"
	doctorName := "-"
	if order.SurgeonDoctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.SurgeonDoctor, doctorName)
	}
	if order.OrderType == models.ProcedureOrderTypeConsultation {
		docType = models.DocTypeConsultationResult
		sigLabel = "Dokter Konsultan"
		if order.Consultation != nil && order.Consultation.Consultant != nil {
			doctorName = resolveAssignedUserNameFromEmployee(order.Consultation.Consultant, doctorName)
		}
		if doctorName == "-" && order.TargetVisit != nil && order.TargetVisit.Doctor != nil {
			doctorName = resolveAssignedUserNameFromEmployee(order.TargetVisit.Doctor, doctorName)
		}
	}
	if doctorName == "-" && order.ValidatedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.ValidatedBy, doctorName)
	}
	if doctorName == "-" && order.PerformedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.PerformedBy, doctorName)
	}
	if doctorName == "-" && order.OrderedBy != nil {
		doctorName = resolveAssignedUserNameFromEmployee(order.OrderedBy, doctorName)
	}
	if order.OrderType == models.ProcedureOrderTypeConsultation {
		// Keep backward compatibility with older signatures that might have used operative_report.
		addSignature(pdf, hospitalInfo.City, doctorName, sigLabel, docType, order.ID,
			signatureLookup{DocType: models.DocTypeOperativeReport, DocID: order.ID})
	} else {
		addSignature(pdf, hospitalInfo.City, doctorName, sigLabel, docType, order.ID)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filePrefix := "Hasil_Konsultasi"
	if order.OrderType == models.ProcedureOrderTypeSurgery {
		filePrefix = "Laporan_Operasi"
	}
	filename := fmt.Sprintf("%s_%s.pdf", filePrefix, order.OrderNumber)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ValidateProcedureResult validates the result by a doctor
func ValidateProcedureResult(c *gin.Context) {
	id := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.ProcedureOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	if order.Status != models.ProcedureOrderStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order must be completed before validation"})
		return
	}

	// Get user's employee
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}
	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	now := time.Now()
	order.ValidatedByID = user.EmployeeID
	order.ValidatedAt = &now

	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload
	database.DB.Preload("ValidatedBy").First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// GetProcedureOrderHistory gets order history for a patient
func GetProcedureOrderHistory(c *gin.Context) {
	patientID := c.Query("patient_id")
	orderType := c.Query("order_type")
	limitStr := c.Query("limit")

	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	var orders []models.ProcedureOrder
	query := database.DB.
		Joins("JOIN registrations ON registrations.id = procedure_orders.registration_id").
		Where("registrations.patient_id = ?", patientID).
		Preload("SourceVisit.Registration.Patient").
		Preload("TargetVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("TargetRoom").
		Preload("Registration.Patient").
		Preload("OrderedBy").
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		Order("procedure_orders.created_at DESC").
		Limit(limit)

	if orderType != "" {
		query = query.Where("procedure_orders.order_type = ?", orderType)
	}

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// GetSurgeryRooms gets all surgery/operating rooms
func GetSurgeryRooms(c *gin.Context) {
	var rooms []models.Room
	if err := database.DB.Where("room_type IN ? AND is_active = ?", []string{"ok", "kamar_operasi"}, true).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// GetSurgicalProcedures gets all surgical procedures (is_surgical = true)
func GetSurgicalProcedures(c *gin.Context) {
	roomID := c.Query("room_id")

	var procedures []models.Procedure

	if roomID != "" {
		// When room_id is provided, get all procedures assigned to that room
		// (the room is already an OR room, so all its procedures are surgical)
		query := database.DB.
			Joins("JOIN room_procedures ON room_procedures.procedure_id = procedures.id").
			Where("room_procedures.room_id = ? AND room_procedures.is_available = ?", roomID, true).
			Where("procedures.is_active = ?", true).
			Preload("Tariffs")

		if err := query.Order("procedures.name ASC").Find(&procedures).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		// Without room_id, return all active surgical procedures
		query := database.DB.Where("is_active = ? AND is_surgical = ?", true, true).
			Preload("Tariffs")

		if err := query.Order("name ASC").Find(&procedures).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, procedures)
}

// ===========================================================================
// PROCEDURE ORDER ITEM CRUD HANDLERS (Edit/Add/Delete Items)
// ===========================================================================

// AddProcedureOrderItem adds a new procedure item to an existing order
func AddProcedureOrderItem(c *gin.Context) {
	orderID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var input struct {
		ProcedureID uint   `json:"procedure_id" binding:"required"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get procedure order
	var order models.ProcedureOrder
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	// Only allow adding items if order is pending or in_progress
	if order.Status != "pending" && order.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menambah item karena order sudah " + order.Status})
		return
	}

	// Validate procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, input.ProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure not found"})
		return
	}

	// Check if procedure is assigned to target room (if target room is set)
	if order.TargetRoomID != 0 {
		var roomProcedure models.RoomProcedure
		if err := database.DB.Where("room_id = ? AND procedure_id = ? AND is_available = ?",
			order.TargetRoomID, input.ProcedureID, true).First(&roomProcedure).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur tidak tersedia di ruangan tujuan"})
			return
		}
	}

	// Check if item already exists in order
	var existingItem models.ProcedureOrderItem
	if err := database.DB.Where("procedure_order_id = ? AND procedure_id = ?", orderID, input.ProcedureID).
		First(&existingItem).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prosedur sudah ada dalam order"})
		return
	}

	// Create new item
	item := models.ProcedureOrderItem{
		ProcedureOrderID: uint(orderID),
		ProcedureID:      input.ProcedureID,
		Notes:            input.Notes,
		Status:           "pending",
	}

	if err := database.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.Preload("Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
		return db.Where("is_active = ?", true).Order("sort_order ASC")
	}).Preload("Procedure.Tariffs").First(&item, item.ID)

	c.JSON(http.StatusCreated, item)
}

// UpdateProcedureOrderItem updates notes for an existing procedure order item
func UpdateProcedureOrderItem(c *gin.Context) {
	orderID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	itemID, err := strconv.ParseUint(c.Param("itemId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	var input struct {
		Notes string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get procedure order
	var order models.ProcedureOrder
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	// Only allow updating items if order is pending or in_progress
	if order.Status != "pending" && order.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat mengubah item karena order sudah " + order.Status})
		return
	}

	// Get item
	var item models.ProcedureOrderItem
	if err := database.DB.Where("id = ? AND procedure_order_id = ?", itemID, orderID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order item not found"})
		return
	}

	// Only allow updating if item is pending
	if item.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat mengubah item yang sudah diproses"})
		return
	}

	// Update notes
	item.Notes = input.Notes
	if err := database.DB.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.Preload("Procedure.Parameters").Preload("Procedure.Tariffs").First(&item, item.ID)

	c.JSON(http.StatusOK, item)
}

// DeleteProcedureOrderItem removes an item from a procedure order
func DeleteProcedureOrderItem(c *gin.Context) {
	orderID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	itemID, err := strconv.ParseUint(c.Param("itemId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	// Get procedure order
	var order models.ProcedureOrder
	if err := database.DB.Preload("Items").First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	// Only allow deleting items if order is pending or in_progress
	if order.Status != "pending" && order.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus item karena order sudah " + order.Status})
		return
	}

	// Get item
	var item models.ProcedureOrderItem
	if err := database.DB.Where("id = ? AND procedure_order_id = ?", itemID, orderID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order item not found"})
		return
	}

	// Only allow deleting if item is pending
	if item.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus item yang sudah diproses"})
		return
	}

	// Check if this is the last item
	if len(order.Items) <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus item terakhir. Gunakan batal order jika ingin membatalkan seluruh order."})
		return
	}

	// Delete item results first
	if err := database.DB.Where("procedure_order_item_id = ?", itemID).Delete(&models.ProcedureOrderResult{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete item
	if err := database.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item berhasil dihapus"})
}
