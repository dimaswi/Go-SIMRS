package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
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
		OrderType     string `json:"order_type" binding:"required"` // radiology or laboratory
		SourceVisitID uint   `json:"source_visit_id" binding:"required"`
		TargetRoomID  uint   `json:"target_room_id" binding:"required"`
		Priority      string `json:"priority"`
		ClinicalNotes string `json:"clinical_notes"`
		Diagnosis     string `json:"diagnosis"`
		Notes         string `json:"notes"`
		Items         []struct {
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
		input.OrderType != models.ProcedureOrderTypeConsultation {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order type. Must be 'radiology', 'laboratory', or 'consultation'"})
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

	// Create room queue HANYA untuk radiology dan laboratory (TIDAK untuk consultation)
	if input.OrderType == models.ProcedureOrderTypeRadiology || input.OrderType == models.ProcedureOrderTypeLaboratory {
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

	// Create procedure order
	order := models.ProcedureOrder{
		OrderNumber:    orderNumber,
		OrderType:      input.OrderType,
		SourceVisitID:  input.SourceVisitID,
		TargetVisitID:  &targetVisit.ID,
		SourceRoomID:   sourceVisit.RoomID,
		TargetRoomID:   input.TargetRoomID,
		RegistrationID: sourceVisit.RegistrationID,
		OrderedByID:    *user.EmployeeID,
		Priority:       priority,
		ClinicalNotes:  input.ClinicalNotes,
		Diagnosis:      input.Diagnosis,
		Notes:          input.Notes,
		Status:         models.ProcedureOrderStatusPending,
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create procedure order: " + err.Error()})
		return
	}

	// Create order items
	for _, itemInput := range input.Items {
		// Validate procedure exists and matches order type
		var procedure models.Procedure
		if err := tx.First(&procedure, itemInput.ProcedureID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Procedure ID %d not found", itemInput.ProcedureID)})
			return
		}

		if procedure.ProcedureType != input.OrderType {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Procedure '%s' is not a %s procedure", procedure.Name, input.OrderType)})
			return
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
				"status":     models.RoomQueueStatusServing,
				"started_at": now,
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
		// Update item
		tx.Model(&models.ProcedureOrderItem{}).Where("id = ?", itemInput.ItemID).
			Updates(map[string]interface{}{
				"status":          models.ProcedureOrderStatusCompleted,
				"completed_at":    now,
				"performed_by_id": user.EmployeeID,
				"notes":           itemInput.Notes,
			})

		// Delete existing results for this item
		tx.Where("procedure_order_item_id = ?", itemInput.ItemID).Delete(&models.ProcedureOrderResult{})

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

			tx.Create(&result)
		}
	}

	// Update target visit and queue
	if order.TargetVisitID != nil {
		tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":   models.VisitStatusCompleted,
				"end_time": now,
			})
		tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":       models.RoomQueueStatusCompleted,
				"completed_at": now,
			})
	}

	tx.Commit()

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
			tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
				Update("status", models.VisitStatusInProgress)
			tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
				Updates(map[string]interface{}{
					"status":     models.RoomQueueStatusServing,
					"started_at": now,
				})
		}
	}

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Process items and results
	for _, itemInput := range input.Items {
		// Update item status to completed but don't mark order as complete
		tx.Model(&models.ProcedureOrderItem{}).Where("id = ?", itemInput.ItemID).
			Updates(map[string]interface{}{
				"status":          models.ProcedureOrderStatusCompleted,
				"completed_at":    now,
				"performed_by_id": user.EmployeeID,
				"notes":           itemInput.Notes,
			})

		// Delete existing results for this item
		tx.Where("procedure_order_item_id = ?", itemInput.ItemID).Delete(&models.ProcedureOrderResult{})

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

			tx.Create(&result)
		}
	}

	tx.Commit()

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

	// Update target visit and queue
	if order.TargetVisitID != nil {
		tx.Model(&models.Visit{}).Where("id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":   models.VisitStatusCompleted,
				"end_time": now,
			})
		tx.Model(&models.RoomQueue{}).Where("visit_id = ?", *order.TargetVisitID).
			Updates(map[string]interface{}{
				"status":       models.RoomQueueStatusCompleted,
				"completed_at": now,
			})
	}

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
		Preload("PerformedBy").
		Preload("ValidatedBy").
		Preload("Items.Procedure.Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("sort_order ASC")
		}).
		Preload("Items.Results.ProcedureParameter").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Procedure order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
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
