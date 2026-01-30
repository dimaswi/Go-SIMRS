package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// MEDICINE ORDER HANDLERS
// ===========================================================================

// GetMedicineOrders returns medicine orders with filters
func GetMedicineOrders(c *gin.Context) {
	var orders []models.MedicineOrder

	query := database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("PharmacyVisit").
		Preload("PharmacyVisit.Room").
		Preload("PharmacyVisit.RoomQueue").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("SourceRoom").
		Preload("PharmacyRoom").
		Preload("Prescriber").
		Preload("ReviewedBy").
		Preload("DeliveredBy").
		Preload("Items").
		Preload("Items.Medicine")

	// Filter by source visit
	if sourceVisitID := c.Query("source_visit_id"); sourceVisitID != "" {
		query = query.Where("source_visit_id = ?", sourceVisitID)
	}

	// Filter by pharmacy visit
	if pharmacyVisitID := c.Query("pharmacy_visit_id"); pharmacyVisitID != "" {
		query = query.Where("pharmacy_visit_id = ?", pharmacyVisitID)
	}

	// Filter by pharmacy room
	if pharmacyRoomID := c.Query("pharmacy_room_id"); pharmacyRoomID != "" {
		query = query.Where("pharmacy_room_id = ?", pharmacyRoomID)
	}

	// Filter by registration
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(created_at) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(created_at) <= ?", endDate)
	}

	// Order by creation time descending
	query = query.Order("created_at DESC")

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// GetMedicineOrder returns a single medicine order by ID
func GetMedicineOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.MedicineOrder

	if err := database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("PharmacyVisit").
		Preload("PharmacyVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("PharmacyRoom").
		Preload("Prescriber").
		Preload("ReviewedBy").
		Preload("DeliveredBy").
		Preload("Items").
		Preload("Items.Medicine").
		Preload("Items.MedicineBatch").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

// CreateMedicineOrder creates a new medicine order from doctor
// This also creates a pharmacy visit with queue
func CreateMedicineOrder(c *gin.Context) {
	var input struct {
		SourceVisitID    uint   `json:"source_visit_id" binding:"required"`
		PharmacyRoomID   uint   `json:"pharmacy_room_id" binding:"required"`
		PrescriptionType string `json:"prescription_type"`
		Priority         string `json:"priority"`
		Diagnosis        string `json:"diagnosis"`
		Notes            string `json:"notes"`
		Items            []struct {
			MedicineID   uint   `json:"medicine_id" binding:"required"`
			Quantity     int    `json:"quantity" binding:"required"`
			Unit         string `json:"unit"`
			Dosage       string `json:"dosage"`
			Frequency    string `json:"frequency"`
			Route        string `json:"route"`
			Duration     string `json:"duration"`
			Instructions string `json:"instructions"`
			Notes        string `json:"notes"`
		} `json:"items" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get source visit
	var sourceVisit models.Visit
	if err := database.DB.Preload("Registration").Preload("Room").First(&sourceVisit, input.SourceVisitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source visit not found"})
		return
	}

	// Validate pharmacy room
	var pharmacyRoom models.Room
	if err := database.DB.First(&pharmacyRoom, input.PharmacyRoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pharmacy room not found"})
		return
	}

	// Validate pharmacy room: must be service_type 'farmasi' and NOT depo_farmasi
	if pharmacyRoom.ServiceType != "farmasi" || pharmacyRoom.RoomType == "depo_farmasi" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruang farmasi tujuan tidak valid. Pilih ruang farmasi (bukan depo farmasi)"})
		return
	}

	// Get prescriber (current user's employee)
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Generate order number
	today := time.Now().Format("20060102")
	var lastOrder models.MedicineOrder
	var orderNum int

	err := tx.Where("order_number LIKE ?", "RX"+today+"%").
		Order("order_number DESC").First(&lastOrder).Error

	if err != nil {
		orderNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastOrder.OrderNumber, "RX"+today+"%d", &lastNum)
		orderNum = lastNum + 1
	}

	orderNumber := fmt.Sprintf("RX%s%04d", today, orderNum)

	// Create the medicine order
	prescriptionType := input.PrescriptionType
	if prescriptionType == "" {
		prescriptionType = "regular"
	}

	priority := input.Priority
	if priority == "" {
		priority = "normal"
	}

	order := models.MedicineOrder{
		OrderNumber:      orderNumber,
		SourceVisitID:    input.SourceVisitID,
		SourceRoomID:     sourceVisit.RoomID,
		PharmacyRoomID:   input.PharmacyRoomID,
		RegistrationID:   sourceVisit.RegistrationID,
		PrescriberID:     *user.EmployeeID,
		PrescriptionType: prescriptionType,
		Priority:         priority,
		Diagnosis:        input.Diagnosis,
		Notes:            input.Notes,
		Status:           models.OrderStatusPending,
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create order items
	for _, item := range input.Items {
		// Validate medicine exists
		var medicine models.Medicine
		if err := tx.First(&medicine, item.MedicineID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Medicine ID %d not found", item.MedicineID)})
			return
		}

		unit := item.Unit
		if unit == "" {
			unit = medicine.Unit
		}

		orderItem := models.MedicineOrderItem{
			MedicineOrderID: order.ID,
			MedicineID:      item.MedicineID,
			Quantity:        item.Quantity,
			Unit:            unit,
			Dosage:          item.Dosage,
			Frequency:       item.Frequency,
			Route:           item.Route,
			Duration:        item.Duration,
			Instructions:    item.Instructions,
			Notes:           item.Notes,
			Status:          models.ItemStatusOrdered,
		}

		if err := tx.Create(&orderItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Create pharmacy visit
	// Generate unique visit number based on existing visits count
	var lastVisit models.Visit
	var visitNum int
	errVis := tx.Where("visit_number LIKE ?", "PH"+today+"%").
		Order("visit_number DESC").First(&lastVisit).Error

	if errVis != nil {
		visitNum = 1
	} else {
		var lastVisNum int
		fmt.Sscanf(lastVisit.VisitNumber, "PH"+today+"%d", &lastVisNum)
		visitNum = lastVisNum + 1
	}

	visitNumber := fmt.Sprintf("PH%s%04d", today, visitNum)

	now := time.Now()
	pharmacyVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: sourceVisit.RegistrationID,
		RoomID:         input.PharmacyRoomID,
		VisitType:      models.VisitTypePharmacy,
		VisitPurpose:   "Pengambilan Obat - " + orderNumber,
		ReferralFrom:   &sourceVisit.ID,
		Notes:          input.Notes,
		Status:         models.VisitStatusWaiting,
		CheckInTime:    &now,
	}

	if err := tx.Create(&pharmacyVisit).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pharmacy visit: " + err.Error()})
		return
	}

	// Create room queue for pharmacy visit
	queuePriority := "normal"
	if priority == "urgent" {
		queuePriority = "urgent"
	}

	// Get next queue number for pharmacy room
	var lastQueue models.RoomQueue
	var queueSeq int

	todayStart := time.Now().Truncate(24 * time.Hour)
	err = tx.Where("room_id = ? AND queue_date = ?", input.PharmacyRoomID, todayStart).
		Order("created_at DESC").First(&lastQueue).Error

	if err != nil {
		queueSeq = 1
	} else {
		// Parse last queue number to get sequence
		var lastNum int
		if lastQueue.QueueNumber != "" {
			fmt.Sscanf(lastQueue.QueueNumber, "%*[A-Z]%d", &lastNum)
		}
		queueSeq = lastNum + 1
	}

	// Generate queue number
	queueCode := pharmacyRoom.QueueCode
	if queueCode == "" {
		queueCode = "F" // Default for Farmasi
	}
	queueNumber := fmt.Sprintf("%s%03d", queueCode, queueSeq)

	roomQueue := models.RoomQueue{
		RoomID:      input.PharmacyRoomID,
		VisitID:     pharmacyVisit.ID,
		QueueNumber: queueNumber,
		QueueCode:   queueCode,
		QueueDate:   todayStart,
		Priority:    queuePriority,
		Status:      models.RoomQueueStatusWaiting,
	}

	if err := tx.Create(&roomQueue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room queue: " + err.Error()})
		return
	}

	// Update order with pharmacy visit ID
	if err := tx.Model(&order).Update("pharmacy_visit_id", pharmacyVisit.ID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Commit transaction
	tx.Commit()

	// Reload order with relations
	database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("PharmacyVisit").
		Preload("PharmacyVisit.RoomQueue").
		Preload("SourceRoom").
		Preload("PharmacyRoom").
		Preload("Prescriber").
		Preload("Items").
		Preload("Items.Medicine").
		First(&order, order.ID)

	// Send notification to pharmacy room users
	if NotifService != nil {
		patientName := ""
		if order.SourceVisit.Registration.Patient.NamaLengkap != "" {
			patientName = order.SourceVisit.Registration.Patient.NamaLengkap
		}
		sourceRoomName := ""
		if order.SourceRoom != nil {
			sourceRoomName = order.SourceRoom.Name
		}
		pharmacyRoomName := ""
		if order.PharmacyRoom != nil {
			pharmacyRoomName = order.PharmacyRoom.Name
		}

		go NotifService.NotifyRoomUsers(
			input.PharmacyRoomID,
			models.NotificationTypeMedicineOrder,
			"Order Obat Baru",
			fmt.Sprintf("Order obat %s untuk pasien %s dari %s", order.OrderNumber, patientName, sourceRoomName),
			map[string]interface{}{
				"order_id":          order.ID,
				"order_number":      order.OrderNumber,
				"patient_name":      patientName,
				"source_room":       sourceRoomName,
				"pharmacy_room":     pharmacyRoomName,
				"pharmacy_visit_id": pharmacyVisit.ID,
			},
		)
	}

	c.JSON(http.StatusCreated, order)
}

// UpdateMedicineOrder updates an existing medicine order
func UpdateMedicineOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.MedicineOrder

	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	// Only allow update if status is pending
	if order.Status != models.OrderStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update order that is already processed"})
		return
	}

	var input struct {
		Priority  string `json:"priority"`
		Diagnosis string `json:"diagnosis"`
		Notes     string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Priority != "" {
		updates["priority"] = input.Priority
	}
	if input.Diagnosis != "" {
		updates["diagnosis"] = input.Diagnosis
	}
	updates["notes"] = input.Notes

	if err := database.DB.Model(&order).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with relations
	database.DB.
		Preload("SourceVisit").
		Preload("Items").
		Preload("Items.Medicine").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// CancelMedicineOrder cancels a medicine order
func CancelMedicineOrder(c *gin.Context) {
	id := c.Param("id")
	var order models.MedicineOrder

	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	// Only allow cancel if not delivered
	if order.Status == models.OrderStatusDelivered {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel delivered order"})
		return
	}

	tx := database.DB.Begin()

	// Update order status
	if err := tx.Model(&order).Updates(map[string]interface{}{
		"status": models.OrderStatusCancelled,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update all items status
	if err := tx.Model(&models.MedicineOrderItem{}).
		Where("medicine_order_id = ?", order.ID).
		Update("status", models.ItemStatusCancelled).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cancel pharmacy visit and queue if exists
	if order.PharmacyVisitID != nil {
		if err := tx.Model(&models.Visit{}).
			Where("id = ?", *order.PharmacyVisitID).
			Update("status", models.VisitStatusCancelled).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := tx.Model(&models.RoomQueue{}).
			Where("visit_id = ?", *order.PharmacyVisitID).
			Update("status", models.RoomQueueStatusCancelled).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Order cancelled successfully"})
}

// ===========================================================================
// PRESCRIPTION REVIEW HANDLERS
// ===========================================================================

// ReviewPrescription creates or updates prescription review by pharmacist
func ReviewPrescription(c *gin.Context) {
	orderID := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.MedicineOrder
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	var input struct {
		DrugInteractionCheck       bool   `json:"drug_interaction_check"`
		DoseCheck                  bool   `json:"dose_check"`
		DuplicationCheck           bool   `json:"duplication_check"`
		AllergyCheck               bool   `json:"allergy_check"`
		ContraindicationCheck      bool   `json:"contraindication_check"`
		IndicationCheck            bool   `json:"indication_check"`
		IsApproved                 bool   `json:"is_approved"`
		Notes                      string `json:"notes"`
		Warnings                   string `json:"warnings"`
		Suggestion                 string `json:"suggestion"`
		RequiresDoctorConfirmation bool   `json:"requires_doctor_confirmation"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get reviewer employee
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	tx := database.DB.Begin()

	// Find or create review
	var review models.PrescriptionReview
	err := tx.Where("medicine_order_id = ?", orderID).First(&review).Error

	if err != nil {
		// Create new review
		review = models.PrescriptionReview{
			MedicineOrderID: order.ID,
			ReviewerID:      *user.EmployeeID,
		}
	}

	// Update review fields
	review.DrugInteractionCheck = input.DrugInteractionCheck
	review.DoseCheck = input.DoseCheck
	review.DuplicationCheck = input.DuplicationCheck
	review.AllergyCheck = input.AllergyCheck
	review.ContraindicationCheck = input.ContraindicationCheck
	review.IndicationCheck = input.IndicationCheck
	review.IsApproved = input.IsApproved
	review.Notes = input.Notes
	review.Warnings = input.Warnings
	review.Suggestion = input.Suggestion
	review.RequiresDoctorConfirmation = input.RequiresDoctorConfirmation

	if err := tx.Save(&review).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update order status
	now := time.Now()
	updates := map[string]interface{}{
		"status":         models.OrderStatusReviewed,
		"reviewed_by_id": *user.EmployeeID,
		"reviewed_at":    now,
		"review_notes":   input.Notes,
	}

	if err := tx.Model(&order).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update items status to available
	if err := tx.Model(&models.MedicineOrderItem{}).
		Where("medicine_order_id = ? AND status = ?", order.ID, models.ItemStatusOrdered).
		Update("status", models.ItemStatusAvailable).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	// Reload review
	database.DB.Preload("Reviewer").First(&review, review.ID)

	c.JSON(http.StatusOK, review)
}

// GetPrescriptionReview gets prescription review for an order
func GetPrescriptionReview(c *gin.Context) {
	orderID := c.Param("id")

	var review models.PrescriptionReview
	err := database.DB.Where("medicine_order_id = ?", orderID).
		Preload("Reviewer").
		First(&review).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return empty object if not found (not an error, just no review yet)
			c.JSON(http.StatusOK, gin.H{"medicine_order_id": orderID})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, review)
}

// ===========================================================================
// MEDICINE DISPENSING HANDLERS
// ===========================================================================

// DispenseMedicine dispenses medicine items to patient
func DispenseMedicine(c *gin.Context) {
	orderID := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.MedicineOrder
	if err := database.DB.Preload("Items").First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	// Validate order status
	if order.Status != models.OrderStatusReviewed && order.Status != models.OrderStatusPreparing && order.Status != models.OrderStatusPartial {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order must be reviewed before dispensing"})
		return
	}

	var input struct {
		Items []struct {
			ItemID          uint  `json:"item_id" binding:"required"`
			DispensedQty    int   `json:"dispensed_qty" binding:"required"`
			MedicineBatchID *uint `json:"medicine_batch_id"`
		} `json:"items" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get dispenser employee
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	tx := database.DB.Begin()

	now := time.Now()
	allDelivered := true
	hasPartial := false

	for _, itemInput := range input.Items {
		var item models.MedicineOrderItem
		if err := tx.First(&item, itemInput.ItemID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Item ID %d not found", itemInput.ItemID)})
			return
		}

		// Validate item belongs to this order
		if item.MedicineOrderID != order.ID {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Item does not belong to this order"})
			return
		}

		// Update item
		newDispensedQty := item.DispensedQty + itemInput.DispensedQty
		updates := map[string]interface{}{
			"dispensed_qty":     newDispensedQty,
			"dispensed_at":      now,
			"medicine_batch_id": itemInput.MedicineBatchID,
		}

		// Set dispensed by (petugas farmasi yang menyerahkan)
		if user.EmployeeID != nil {
			updates["dispensed_by_id"] = *user.EmployeeID
		}

		if newDispensedQty >= item.Quantity {
			updates["status"] = models.ItemStatusDelivered
		} else {
			updates["status"] = models.ItemStatusReady
			hasPartial = true
			allDelivered = false
		}

		if err := tx.Model(&item).Updates(updates).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Decrease room medicine stock
		var roomMedicine models.RoomMedicine
		if err := tx.Where("room_id = ? AND medicine_id = ?", order.PharmacyRoomID, item.MedicineID).
			First(&roomMedicine).Error; err == nil {
			newQty := roomMedicine.Quantity - itemInput.DispensedQty
			if newQty < 0 {
				newQty = 0
			}
			tx.Model(&roomMedicine).Update("quantity", newQty)

			// Create medicine transaction record
			transaction := models.MedicineTransaction{
				TransactionType: "dispensing",
				MedicineID:      item.MedicineID,
				MedicineBatchID: itemInput.MedicineBatchID,
				Quantity:        itemInput.DispensedQty,
				PreviousStock:   roomMedicine.Quantity,
				CurrentStock:    newQty,
				FromRoomID:      &order.PharmacyRoomID,
				TransactionDate: now,
				ReferenceNumber: order.OrderNumber,
				Reason:          "Pengeluaran obat untuk pasien",
				UserID:          userID,
			}
			tx.Create(&transaction)
		}
	}

	// Check if all items are delivered
	for _, item := range order.Items {
		found := false
		for _, inputItem := range input.Items {
			if inputItem.ItemID == item.ID {
				found = true
				break
			}
		}
		if !found && item.Status != models.ItemStatusDelivered {
			allDelivered = false
		}
	}

	// Update order status
	orderStatus := models.OrderStatusPreparing
	if allDelivered {
		orderStatus = models.OrderStatusDelivered
	} else if hasPartial {
		orderStatus = models.OrderStatusPartial
	}

	orderUpdates := map[string]interface{}{
		"status": orderStatus,
	}

	if allDelivered && user.EmployeeID != nil {
		orderUpdates["delivered_by_id"] = *user.EmployeeID
		orderUpdates["delivered_at"] = now
	}

	if err := tx.Model(&order).Updates(orderUpdates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update pharmacy visit status if all delivered
	if allDelivered && order.PharmacyVisitID != nil {
		completedNow := time.Now()
		tx.Model(&models.Visit{}).
			Where("id = ?", *order.PharmacyVisitID).
			Updates(map[string]interface{}{
				"status":   models.VisitStatusCompleted,
				"end_time": completedNow,
			})

		tx.Model(&models.RoomQueue{}).
			Where("visit_id = ?", *order.PharmacyVisitID).
			Updates(map[string]interface{}{
				"status":       models.RoomQueueStatusCompleted,
				"completed_at": completedNow,
			})
	}

	tx.Commit()

	// Reload order
	database.DB.
		Preload("Items").
		Preload("Items.Medicine").
		Preload("DeliveredBy").
		First(&order, order.ID)

	c.JSON(http.StatusOK, order)
}

// ===========================================================================
// MEDICINE RETURN HANDLERS
// ===========================================================================

// CreateMedicineReturn creates a medicine return record
func CreateMedicineReturn(c *gin.Context) {
	orderID := c.Param("id")
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID := userIDVal.(uint)

	var order models.MedicineOrder
	if err := database.DB.First(&order, orderID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine order not found"})
		return
	}

	// Only allow return if order is delivered or partial
	if order.Status != models.OrderStatusDelivered && order.Status != models.OrderStatusPartial {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot return medicine for non-delivered order"})
		return
	}

	var input struct {
		ItemID       *uint  `json:"item_id"`
		MedicineID   uint   `json:"medicine_id" binding:"required"`
		Quantity     int    `json:"quantity" binding:"required,min=1"`
		ReturnReason string `json:"return_reason" binding:"required"`
		Condition    string `json:"condition"`
		IsRestocked  bool   `json:"is_restocked"`
		Notes        string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get receiver employee
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if user.EmployeeID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is not linked to an employee"})
		return
	}

	tx := database.DB.Begin()

	// Generate return number
	today := time.Now().Format("20060102")
	var lastReturn models.MedicineReturn
	var returnNum int

	err := tx.Where("return_number LIKE ?", "RET"+today+"%").
		Order("return_number DESC").First(&lastReturn).Error

	if err != nil {
		returnNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastReturn.ReturnNumber, "RET"+today+"%d", &lastNum)
		returnNum = lastNum + 1
	}

	returnNumber := fmt.Sprintf("RET%s%04d", today, returnNum)

	condition := input.Condition
	if condition == "" {
		condition = "baik"
	}

	medicineReturn := models.MedicineReturn{
		ReturnNumber:        returnNumber,
		MedicineOrderID:     order.ID,
		MedicineOrderItemID: input.ItemID,
		MedicineID:          input.MedicineID,
		Quantity:            input.Quantity,
		ReturnReason:        input.ReturnReason,
		Condition:           condition,
		ReceivedByID:        *user.EmployeeID,
		IsRestocked:         input.IsRestocked,
		Notes:               input.Notes,
	}

	// If restocked, update room medicine stock
	if input.IsRestocked {
		medicineReturn.RestockRoomID = &order.PharmacyRoomID

		var roomMedicine models.RoomMedicine
		err := tx.Where("room_id = ? AND medicine_id = ?", order.PharmacyRoomID, input.MedicineID).
			First(&roomMedicine).Error

		if err == nil {
			newQty := roomMedicine.Quantity + input.Quantity
			tx.Model(&roomMedicine).Update("quantity", newQty)

			// Create transaction record
			transaction := models.MedicineTransaction{
				TransactionType: "return",
				MedicineID:      input.MedicineID,
				Quantity:        input.Quantity,
				PreviousStock:   roomMedicine.Quantity,
				CurrentStock:    newQty,
				ToRoomID:        &order.PharmacyRoomID,
				TransactionDate: time.Now(),
				ReferenceNumber: returnNumber,
				Reason:          input.ReturnReason,
				UserID:          userID,
			}
			tx.Create(&transaction)
		} else if err == gorm.ErrRecordNotFound {
			// Create new room medicine entry
			newRoomMedicine := models.RoomMedicine{
				RoomID:     order.PharmacyRoomID,
				MedicineID: input.MedicineID,
				Quantity:   input.Quantity,
			}
			tx.Create(&newRoomMedicine)
		}
	}

	if err := tx.Create(&medicineReturn).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update order item if specified
	if input.ItemID != nil {
		now := time.Now()
		tx.Model(&models.MedicineOrderItem{}).
			Where("id = ?", *input.ItemID).
			Updates(map[string]interface{}{
				"returned_qty": gorm.Expr("returned_qty + ?", input.Quantity),
				"returned_at":  now,
				"return_notes": input.ReturnReason,
				"status":       models.ItemStatusReturned,
			})
	}

	// Update order status
	tx.Model(&order).Update("status", models.OrderStatusReturned)

	tx.Commit()

	// Reload return
	database.DB.
		Preload("Medicine").
		Preload("ReceivedBy").
		First(&medicineReturn, medicineReturn.ID)

	c.JSON(http.StatusCreated, medicineReturn)
}

// GetMedicineReturns gets all returns for an order
func GetMedicineReturns(c *gin.Context) {
	orderID := c.Param("id")

	var returns []models.MedicineReturn
	if err := database.DB.Where("medicine_order_id = ?", orderID).
		Preload("Medicine").
		Preload("ReceivedBy").
		Preload("RestockRoom").
		Find(&returns).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, returns)
}

// ===========================================================================
// PHARMACY ROOM MEDICINES HELPER
// ===========================================================================

// GetPharmacyRoomMedicines gets available medicines in a pharmacy room
func GetPharmacyRoomMedicines(c *gin.Context) {
	roomID := c.Param("room_id")

	var roomMedicines []models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND quantity > 0", roomID).
		Preload("Medicine").
		Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, roomMedicines)
}
