package handlers

import (
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetAllRoomInventories returns all inventories assigned to rooms with pagination
func GetAllRoomInventories(c *gin.Context) {
	var roomInventories []models.RoomInventory
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	roomID := c.Query("room_id")
	inventoryID := c.Query("inventory_id")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.RoomInventory{}).
		Preload("Room").
		Preload("Inventory")

	// Filter by room
	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by inventory
	if inventoryID != "" {
		query = query.Where("inventory_id = ?", inventoryID)
	}

	// Search in inventory name or room name
	if search != "" {
		query = query.Joins("LEFT JOIN rooms ON rooms.id = room_inventories.room_id").
			Joins("LEFT JOIN inventories ON inventories.id = room_inventories.inventory_id").
			Where("rooms.name ILIKE ? OR inventories.name ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Count total
	query.Count(&total)

	// Sorting
	orderClause := sortBy + " " + sortOrder
	if sortBy == "room_name" {
		query = query.Joins("LEFT JOIN rooms r ON r.id = room_inventories.room_id").Order("r.name " + sortOrder)
	} else if sortBy == "inventory_name" {
		query = query.Joins("LEFT JOIN inventories inv ON inv.id = room_inventories.inventory_id").Order("inv.name " + sortOrder)
	} else {
		query = query.Order(orderClause)
	}

	// Get data with pagination
	if err := query.Offset(offset).Limit(limit).Find(&roomInventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": roomInventories,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRoomInventory returns a single room inventory by ID
func GetRoomInventory(c *gin.Context) {
	id := c.Param("id")
	var roomInventory models.RoomInventory

	if err := database.DB.Preload("Room").Preload("Inventory").First(&roomInventory, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventory"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomInventory})
}

// GetInventoriesByRoom returns all inventories assigned to a specific room
func GetInventoriesByRoom(c *gin.Context) {
	roomID := c.Param("id")
	var roomInventories []models.RoomInventory

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	var total int64

	offset := (page - 1) * limit

	query := database.DB.Model(&models.RoomInventory{}).
		Preload("Inventory").
		Where("room_id = ?", roomID)

	if search != "" {
		query = query.Joins("LEFT JOIN inventories ON inventories.id = room_inventories.inventory_id").
			Where("inventories.name ILIKE ? OR inventories.code ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	query.Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&roomInventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": roomInventories,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRoomsByInventory returns all rooms that have a specific inventory
func GetRoomsByInventory(c *gin.Context) {
	inventoryID := c.Param("id")
	var roomInventories []models.RoomInventory

	if err := database.DB.Preload("Room").Where("inventory_id = ?", inventoryID).Find(&roomInventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomInventories})
}

// GetTotalInventoryStock returns total stock of an inventory across all rooms
func GetTotalInventoryStock(c *gin.Context) {
	inventoryID := c.Param("id")
	var total int64

	if err := database.DB.Model(&models.RoomInventory{}).
		Where("inventory_id = ?", inventoryID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate total stock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"total_stock": total})
}

// CreateRoomInventory creates a new room inventory assignment
func CreateRoomInventory(c *gin.Context) {
	var input struct {
		RoomID      uint   `json:"room_id" binding:"required"`
		InventoryID uint   `json:"inventory_id" binding:"required"`
		Quantity    int    `json:"quantity"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room not found"})
		return
	}

	// Check if inventory exists
	var inventory models.Inventory
	if err := database.DB.First(&inventory, input.InventoryID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Inventory not found"})
		return
	}

	// Check if assignment already exists
	var existing models.RoomInventory
	if err := database.DB.Where("room_id = ? AND inventory_id = ?", input.RoomID, input.InventoryID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Inventory already assigned to this room"})
		return
	}

	roomInventory := models.RoomInventory{
		RoomID:      input.RoomID,
		InventoryID: input.InventoryID,
		Quantity:    input.Quantity,
		MinQuantity: input.MinQuantity,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&roomInventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room inventory"})
		return
	}

	// Preload relations
	database.DB.Preload("Room").Preload("Inventory").First(&roomInventory, roomInventory.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomInventory, "message": "Room inventory created successfully"})
}

// UpdateRoomInventoryStock updates a room inventory assignment
func UpdateRoomInventoryStock(c *gin.Context) {
	id := c.Param("id")
	var roomInventory models.RoomInventory

	if err := database.DB.First(&roomInventory, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventory"})
		return
	}

	var input struct {
		Quantity    int    `json:"quantity"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roomInventory.Quantity = input.Quantity
	roomInventory.MinQuantity = input.MinQuantity
	roomInventory.Notes = input.Notes

	if err := database.DB.Save(&roomInventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room inventory"})
		return
	}

	database.DB.Preload("Room").Preload("Inventory").First(&roomInventory, roomInventory.ID)

	c.JSON(http.StatusOK, gin.H{"data": roomInventory, "message": "Room inventory updated successfully"})
}

// DeleteRoomInventory deletes a room inventory assignment
func DeleteRoomInventory(c *gin.Context) {
	id := c.Param("id")
	var roomInventory models.RoomInventory

	if err := database.DB.First(&roomInventory, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventory"})
		return
	}

	if err := database.DB.Delete(&roomInventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room inventory"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room inventory deleted successfully"})
}

// AdjustRoomInventoryStock adjusts the stock of a room inventory
func AdjustRoomInventoryStock(c *gin.Context) {
	id := c.Param("id")
	var roomInventory models.RoomInventory

	if err := database.DB.First(&roomInventory, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventory"})
		return
	}

	var input struct {
		AdjustmentType string `json:"adjustment_type" binding:"required"` // add, subtract, set
		Quantity       int    `json:"quantity" binding:"required"`
		Reason         string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	previousStock := roomInventory.Quantity
	var newStock int

	switch input.AdjustmentType {
	case "add":
		newStock = previousStock + input.Quantity
	case "subtract":
		newStock = previousStock - input.Quantity
		if newStock < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock"})
			return
		}
	case "set":
		newStock = input.Quantity
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid adjustment type"})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Update room inventory stock
	roomInventory.Quantity = newStock
	if err := tx.Save(&roomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock"})
		return
	}

	// Create transaction record
	transaction := models.InventoryTransaction{
		TransactionType: "adjustment",
		InventoryID:     roomInventory.InventoryID,
		Quantity:        input.Quantity,
		PreviousStock:   previousStock,
		CurrentStock:    newStock,
		ToRoomID:        &roomInventory.RoomID,
		TransactionDate: time.Now(),
		Reason:          input.Reason,
		UserID:          userID.(uint),
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction record"})
		return
	}

	tx.Commit()

	database.DB.Preload("Room").Preload("Inventory").First(&roomInventory, roomInventory.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":    roomInventory,
		"message": "Stock adjusted successfully",
	})
}

// TransferInventoryStock transfers inventory stock between rooms
func TransferInventoryStock(c *gin.Context) {
	var input struct {
		FromRoomID  uint   `json:"from_room_id" binding:"required"`
		ToRoomID    uint   `json:"to_room_id" binding:"required"`
		InventoryID uint   `json:"inventory_id" binding:"required"`
		Quantity    int    `json:"quantity" binding:"required"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.FromRoomID == input.ToRoomID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Source and destination rooms must be different"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Get source room inventory
	var sourceRoomInventory models.RoomInventory
	if err := tx.Where("room_id = ? AND inventory_id = ?", input.FromRoomID, input.InventoryID).First(&sourceRoomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found in source room"})
		return
	}

	if sourceRoomInventory.Quantity < input.Quantity {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock in source room"})
		return
	}

	// Get or create destination room inventory
	var destRoomInventory models.RoomInventory
	if err := tx.Where("room_id = ? AND inventory_id = ?", input.ToRoomID, input.InventoryID).First(&destRoomInventory).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			destRoomInventory = models.RoomInventory{
				RoomID:      input.ToRoomID,
				InventoryID: input.InventoryID,
				Quantity:    0,
			}
			if err := tx.Create(&destRoomInventory).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create destination room inventory"})
				return
			}
		} else {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch destination room inventory"})
			return
		}
	}

	// Update quantities
	sourcePrevious := sourceRoomInventory.Quantity
	destPrevious := destRoomInventory.Quantity

	sourceRoomInventory.Quantity -= input.Quantity
	destRoomInventory.Quantity += input.Quantity

	if err := tx.Save(&sourceRoomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update source stock"})
		return
	}

	if err := tx.Save(&destRoomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update destination stock"})
		return
	}

	// Create transaction record
	transaction := models.InventoryTransaction{
		TransactionType: "transfer",
		InventoryID:     input.InventoryID,
		Quantity:        input.Quantity,
		PreviousStock:   sourcePrevious,
		CurrentStock:    sourceRoomInventory.Quantity,
		FromRoomID:      &input.FromRoomID,
		ToRoomID:        &input.ToRoomID,
		TransactionDate: time.Now(),
		Notes:           input.Notes,
		UserID:          userID.(uint),
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction record"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Stock transferred successfully",
		"from": gin.H{
			"room_id":        input.FromRoomID,
			"previous_stock": sourcePrevious,
			"current_stock":  sourceRoomInventory.Quantity,
		},
		"to": gin.H{
			"room_id":        input.ToRoomID,
			"previous_stock": destPrevious,
			"current_stock":  destRoomInventory.Quantity,
		},
	})
}

// GetLowStockInventories returns inventories in rooms with stock below minimum
func GetLowStockInventories(c *gin.Context) {
	roomID := c.Query("room_id")
	var lowStockInventories []models.RoomInventory

	query := database.DB.Preload("Room").Preload("Inventory").
		Where("quantity < min_quantity AND min_quantity > 0")

	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	if err := query.Find(&lowStockInventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch low stock inventories"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": lowStockInventories})
}
