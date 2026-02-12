package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Stock Distribution Handlers ====================

type CreateDistributionInput struct {
	StockRequestID *uint                         `json:"stock_request_id"`
	FromRoomID     uint                          `json:"from_room_id" binding:"required"`
	ToRoomID       uint                          `json:"to_room_id" binding:"required"`
	Notes          string                        `json:"notes"`
	Items          []CreateDistributionItemInput `json:"items" binding:"required,min=1"`
}

type CreateDistributionItemInput struct {
	StockRequestItemID *uint  `json:"stock_request_item_id"`
	InventoryID        *uint  `json:"inventory_id"`
	MedicineID         *uint  `json:"medicine_id"`
	BatchNumber        string `json:"batch_number"`
	ExpiryDate         string `json:"expiry_date"`
	Quantity           int    `json:"quantity" binding:"required,min=1"`
	Unit               string `json:"unit"`
	Notes              string `json:"notes"`
}

type ReceiveDistributionInput struct {
	Notes string `json:"notes"`
}

// GetDistributions godoc
// @Summary Get all distributions
// @Description Get all stock distributions with pagination and filters
// @Tags Stock Distributions
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param status query string false "Filter by status"
// @Param from_room_id query int false "Filter by from room"
// @Param to_room_id query int false "Filter by to room"
// @Success 200 {object} map[string]interface{}
// @Router /distributions [get]
func GetDistributions(c *gin.Context) {
	var distributions []models.StockDistribution
	query := database.DB.Preload("FromRoom").Preload("ToRoom").Preload("DistributedBy").Preload("ReceivedBy").Preload("StockRequest").Preload("Items")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if fromRoomID := c.Query("from_room_id"); fromRoomID != "" {
		query = query.Where("from_room_id = ?", fromRoomID)
	}
	if toRoomID := c.Query("to_room_id"); toRoomID != "" {
		query = query.Where("to_room_id = ?", toRoomID)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.StockDistribution{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&distributions)

	c.JSON(http.StatusOK, gin.H{
		"data": distributions,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetDistribution godoc
// @Summary Get a distribution by ID
// @Description Get distribution details by ID
// @Tags Stock Distributions
// @Accept json
// @Produce json
// @Param id path int true "Distribution ID"
// @Success 200 {object} map[string]interface{}
// @Router /distributions/{id} [get]
func GetDistribution(c *gin.Context) {
	id := c.Param("id")
	var distribution models.StockDistribution

	if err := database.DB.Preload("FromRoom").Preload("ToRoom").
		Preload("DistributedBy").Preload("ReceivedBy").Preload("StockRequest").
		Preload("Items.Inventory").Preload("Items.Medicine").
		First(&distribution, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Distribution not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": distribution})
}

// CreateDistribution godoc
// @Summary Create a new distribution
// @Description Create a new stock distribution (from depo to room)
// @Tags Stock Distributions
// @Accept json
// @Produce json
// @Param input body CreateDistributionInput true "Distribution data"
// @Success 201 {object} map[string]interface{}
// @Router /distributions [post]
func CreateDistribution(c *gin.Context) {
	var input CreateDistributionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Validate rooms
	var fromRoom, toRoom models.Room
	if err := database.DB.First(&fromRoom, input.FromRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "From room not found"})
		return
	}
	if err := database.DB.First(&toRoom, input.ToRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "To room not found"})
		return
	}

	// Generate distribution number
	distNumber := generateDistributionNumber()

	distribution := models.StockDistribution{
		DistributionNumber: distNumber,
		StockRequestID:     input.StockRequestID,
		FromRoomID:         input.FromRoomID,
		ToRoomID:           input.ToRoomID,
		DistributionDate:   time.Now(),
		DistributedByID:    userID.(uint),
		Status:             "pending",
		Notes:              input.Notes,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&distribution).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create distribution"})
		return
	}

	// Create items and update stock
	for _, item := range input.Items {
		// Parse expiry date
		var expiryDate *time.Time
		if item.ExpiryDate != "" {
			parsedDate, err := ParseLocalDate(item.ExpiryDate)
			if err != nil {
				parsedDate, _ = time.Parse(time.RFC3339, item.ExpiryDate)
			}
			if !parsedDate.IsZero() {
				expiryDate = &parsedDate
			}
		}

		distItem := models.StockDistributionItem{
			StockDistributionID: distribution.ID,
			StockRequestItemID:  item.StockRequestItemID,
			InventoryID:         item.InventoryID,
			MedicineID:          item.MedicineID,
			BatchNumber:         item.BatchNumber,
			ExpiryDate:          expiryDate,
			Quantity:            item.Quantity,
			Unit:                item.Unit,
			Notes:               item.Notes,
		}
		if err := tx.Create(&distItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create distribution item"})
			return
		}

		// Update stock request item fulfilled quantity if linked
		if item.StockRequestItemID != nil {
			tx.Model(&models.StockRequestItem{}).
				Where("id = ?", *item.StockRequestItemID).
				UpdateColumn("quantity_fulfilled", tx.Raw("quantity_fulfilled + ?", item.Quantity))
		}

		// Create transaction records for stock movement
		if item.InventoryID != nil {
			// Decrease stock at source room
			if err := decreaseRoomInventory(tx, input.FromRoomID, *item.InventoryID, item.Quantity); err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Stok tidak mencukupi: %s", err.Error())})
				return
			}
			createInventoryTransaction(tx, *item.InventoryID, "distribution", -item.Quantity,
				fmt.Sprintf("Distribusi ke %s", toRoom.Name), distNumber, userID.(uint), &input.FromRoomID, &input.ToRoomID)
		}
		if item.MedicineID != nil {
			// Decrease stock at source room
			if err := decreaseRoomMedicine(tx, input.FromRoomID, *item.MedicineID, item.Quantity); err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Stok tidak mencukupi: %s", err.Error())})
				return
			}
			createMedicineTransaction(tx, *item.MedicineID, "distribution", -item.Quantity,
				fmt.Sprintf("Distribusi ke %s", toRoom.Name), distNumber, userID.(uint), &input.FromRoomID, &input.ToRoomID)
		}
	}

	// Update stock request status if linked
	if input.StockRequestID != nil {
		updateRequestCompletionStatus(tx, *input.StockRequestID)
	}

	tx.Commit()

	database.DB.Preload("FromRoom").Preload("ToRoom").Preload("Items").First(&distribution, distribution.ID)

	c.JSON(http.StatusCreated, gin.H{"data": distribution, "message": "Distribution created successfully"})
}

// ReceiveDistribution godoc
// @Summary Receive a distribution
// @Description Mark a distribution as received
// @Tags Stock Distributions
// @Accept json
// @Produce json
// @Param id path int true "Distribution ID"
// @Param input body ReceiveDistributionInput true "Receive data"
// @Success 200 {object} map[string]interface{}
// @Router /distributions/{id}/receive [post]
func ReceiveDistribution(c *gin.Context) {
	id := c.Param("id")
	var distribution models.StockDistribution

	if err := database.DB.Preload("Items").First(&distribution, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Distribution not found"})
		return
	}

	if distribution.Status != "pending" && distribution.Status != "delivered" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Distribution already received or invalid status"})
		return
	}

	var input ReceiveDistributionInput
	c.ShouldBindJSON(&input)

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	now := time.Now()
	receivedByID := userID.(uint)

	tx := database.DB.Begin()

	distribution.Status = "received"
	distribution.ReceivedByID = &receivedByID
	distribution.ReceivedDate = &now
	if input.Notes != "" {
		distribution.Notes = distribution.Notes + "\n[Received Notes]: " + input.Notes
	}

	tx.Save(&distribution)

	// Add stock to destination room
	var toRoom models.Room
	database.DB.First(&toRoom, distribution.ToRoomID)

	for _, item := range distribution.Items {
		if item.InventoryID != nil {
			// Increase stock at destination
			createInventoryTransaction(tx, *item.InventoryID, "in", item.Quantity,
				fmt.Sprintf("Diterima dari distribusi %s", distribution.DistributionNumber),
				distribution.DistributionNumber, userID.(uint), &distribution.FromRoomID, &distribution.ToRoomID)

			// Update or create room inventory
			updateRoomInventory(tx, distribution.ToRoomID, *item.InventoryID, item.Quantity)
		}
		if item.MedicineID != nil {
			// Increase stock at destination
			createMedicineTransaction(tx, *item.MedicineID, "in", item.Quantity,
				fmt.Sprintf("Diterima dari distribusi %s", distribution.DistributionNumber),
				distribution.DistributionNumber, userID.(uint), &distribution.FromRoomID, &distribution.ToRoomID)

			// Update or create room medicine
			updateRoomMedicine(tx, distribution.ToRoomID, *item.MedicineID, item.Quantity)
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"data": distribution, "message": "Distribution received successfully"})
}

// Helper functions

func generateDistributionNumber() string {
	year := time.Now().Year()
	var count int64
	database.DB.Model(&models.StockDistribution{}).
		Where("EXTRACT(YEAR FROM created_at) = ?", year).
		Count(&count)
	return fmt.Sprintf("DIST-%d-%04d", year, count+1)
}

func createInventoryTransaction(tx interface{}, inventoryID uint, transType string, quantity int, reason, refNumber string, userID uint, fromRoomID, toRoomID *uint) {
	// Calculate total stock from all rooms
	var totalStock int64
	database.DB.Model(&models.RoomInventory{}).
		Where("inventory_id = ?", inventoryID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&totalStock)

	previousStock := int(totalStock)
	newStock := previousStock + quantity

	transaction := models.InventoryTransaction{
		InventoryID:     inventoryID,
		TransactionType: transType,
		Quantity:        absInt(quantity),
		PreviousStock:   previousStock,
		CurrentStock:    newStock,
		TransactionDate: time.Now(),
		FromRoomID:      fromRoomID,
		ToRoomID:        toRoomID,
		ReferenceNumber: refNumber,
		Reason:          reason,
		UserID:          userID,
	}

	database.DB.Create(&transaction)
	// Note: Actual stock update is done via RoomInventory, not master Inventory
}

func createMedicineTransaction(tx interface{}, medicineID uint, transType string, quantity int, reason, refNumber string, userID uint, fromRoomID, toRoomID *uint) {
	// Calculate total stock from all rooms
	var totalStock int64
	database.DB.Model(&models.RoomMedicine{}).
		Where("medicine_id = ?", medicineID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&totalStock)

	previousStock := int(totalStock)
	newStock := previousStock + quantity

	transaction := models.MedicineTransaction{
		MedicineID:      medicineID,
		TransactionType: transType,
		Quantity:        absInt(quantity),
		PreviousStock:   previousStock,
		CurrentStock:    newStock,
		TransactionDate: time.Now(),
		FromRoomID:      fromRoomID,
		ToRoomID:        toRoomID,
		ReferenceNumber: refNumber,
		Reason:          reason,
		UserID:          userID,
	}

	database.DB.Create(&transaction)
	// Note: Actual stock update is done via RoomMedicine, not master Medicine
}

func updateRoomInventory(tx interface{}, roomID, inventoryID uint, quantity int) {
	var roomInv models.RoomInventory
	result := database.DB.Where("room_id = ? AND inventory_id = ?", roomID, inventoryID).First(&roomInv)

	if result.Error != nil {
		// Create new
		roomInv = models.RoomInventory{
			RoomID:      roomID,
			InventoryID: inventoryID,
			Quantity:    quantity,
		}
		database.DB.Create(&roomInv)
	} else {
		// Update
		database.DB.Model(&roomInv).Update("quantity", roomInv.Quantity+quantity)
	}
}

func updateRoomMedicine(tx interface{}, roomID, medicineID uint, quantity int) {
	var roomMed models.RoomMedicine
	result := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMed)

	if result.Error != nil {
		// Create new
		roomMed = models.RoomMedicine{
			RoomID:     roomID,
			MedicineID: medicineID,
			Quantity:   quantity,
		}
		database.DB.Create(&roomMed)
	} else {
		// Update
		database.DB.Model(&roomMed).Update("quantity", roomMed.Quantity+quantity)
	}
}

func decreaseRoomInventory(tx *gorm.DB, roomID, inventoryID uint, quantity int) error {
	var roomInv models.RoomInventory
	result := tx.Where("room_id = ? AND inventory_id = ?", roomID, inventoryID).First(&roomInv)

	if result.Error != nil {
		return fmt.Errorf("item tidak ditemukan di ruangan ini")
	}

	if roomInv.Quantity < quantity {
		return fmt.Errorf("stok tersedia: %d, diminta: %d", roomInv.Quantity, quantity)
	}

	newQty := roomInv.Quantity - quantity
	if newQty == 0 {
		// Delete record if quantity becomes 0
		return tx.Delete(&roomInv).Error
	}
	return tx.Model(&roomInv).Update("quantity", newQty).Error
}

func decreaseRoomMedicine(tx *gorm.DB, roomID, medicineID uint, quantity int) error {
	var roomMed models.RoomMedicine
	result := tx.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMed)

	if result.Error != nil {
		return fmt.Errorf("item tidak ditemukan di ruangan ini")
	}

	if roomMed.Quantity < quantity {
		return fmt.Errorf("stok tersedia: %d, diminta: %d", roomMed.Quantity, quantity)
	}

	newQty := roomMed.Quantity - quantity
	if newQty == 0 {
		// Delete record if quantity becomes 0
		return tx.Delete(&roomMed).Error
	}
	return tx.Model(&roomMed).Update("quantity", newQty).Error
}

func updateRequestCompletionStatus(tx interface{}, requestID uint) {
	var request models.StockRequest
	database.DB.Preload("Items").First(&request, requestID)

	allFulfilled := true
	for _, item := range request.Items {
		if item.QuantityFulfilled < item.QuantityApproved {
			allFulfilled = false
			break
		}
	}

	if allFulfilled {
		now := time.Now()
		database.DB.Model(&request).Updates(map[string]interface{}{
			"status":         models.RequestStatusCompleted,
			"completed_date": now,
		})
	}
}

func absInt(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
