package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==========================================
// INVENTORY HANDLERS
// ==========================================

func resolveInventoryCurrentStock(inventoryID uint, fallback int) int {
	var total int64
	database.DB.Model(&models.RoomInventory{}).
		Where("inventory_id = ?", inventoryID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&total)

	if total > 0 {
		return int(total)
	}

	return fallback
}

// resolveInventoryStockBatch resolves current stock for multiple inventory IDs
// in a single query, returning a map of inventoryID → stock.
// This eliminates N+1 queries when listing inventories.
func resolveInventoryStockBatch(inventoryIDs []uint) map[uint]int {
	if len(inventoryIDs) == 0 {
		return make(map[uint]int)
	}
	type stockRow struct {
		InventoryID uint
		Total       int
	}
	var rows []stockRow
	database.DB.Model(&models.RoomInventory{}).
		Select("inventory_id, COALESCE(SUM(quantity), 0) as total").
		Where("inventory_id IN ?", inventoryIDs).
		Group("inventory_id").
		Find(&rows)

	m := make(map[uint]int, len(rows))
	for _, r := range rows {
		m[r.InventoryID] = r.Total
	}
	return m
}

// GetInventories returns all inventories with pagination and search
func GetInventories(c *gin.Context) {
	var inventories []models.Inventory
	var total int64

	// Get pagination params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	category := c.Query("category")
	isActive := c.Query("is_active")
	itemScope := strings.TrimSpace(c.Query("item_scope"))
	itemGroup := strings.TrimSpace(c.Query("item_group"))

	offset := (page - 1) * limit

	query := database.DB.Model(&models.Inventory{})

	// Apply search filter
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"(LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(brand) LIKE ?)",
			searchPattern, searchPattern, searchPattern,
		)
	}

	// Apply category filter
	if category != "" {
		query = query.Where("category = ?", category)
	}

	// Apply item_scope filter (supports comma-separated values)
	if itemScope != "" {
		scopes := make([]string, 0)
		for _, scope := range strings.Split(itemScope, ",") {
			scope = strings.TrimSpace(scope)
			if scope != "" {
				scopes = append(scopes, scope)
			}
		}
		if len(scopes) == 1 {
			query = query.Where("item_scope = ?", scopes[0])
		} else if len(scopes) > 1 {
			query = query.Where("item_scope IN ?", scopes)
		}
	}

	// Apply item_group filter
	if itemGroup != "" {
		query = query.Where("item_group = ?", itemGroup)
	}

	// Apply is_active filter
	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	// Count total
	query.Count(&total)

	// Get paginated data
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&inventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventories"})
		return
	}
	// Batch resolve stock in a single query (eliminates N+1)
	ids := make([]uint, len(inventories))
	for i, inv := range inventories {
		ids[i] = inv.ID
	}
	stockMap := resolveInventoryStockBatch(ids)
	for i := range inventories {
		inventories[i].CurrentStock = stockMap[inventories[i].ID]
		inventories[i].TotalValue = float64(inventories[i].CurrentStock) * inventories[i].Price
	}

	c.JSON(http.StatusOK, gin.H{
		"data": inventories,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetInventory returns a single inventory by ID
func GetInventory(c *gin.Context) {
	id := c.Param("id")

	var inventory models.Inventory
	if err := database.DB.Preload("Items").Preload("Items.Room").Preload("Items.RoomUnit").First(&inventory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}
	inventory.CurrentStock = resolveInventoryCurrentStock(inventory.ID, inventory.CurrentStock)
	inventory.TotalValue = float64(inventory.CurrentStock) * inventory.Price

	c.JSON(http.StatusOK, gin.H{"data": inventory})
}

// CreateInventory creates a new inventory
func CreateInventory(c *gin.Context) {
	var input models.Inventory
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if input.Name == "" || input.Category == "" || input.Unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name, Category, and Unit are required"})
		return
	}
	if input.ItemGroup != "" && input.ItemGroup != models.InventoryItemGroupBHP && input.ItemGroup != models.InventoryItemGroupOther {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_group must be bhp or other"})
		return
	}
	if input.ItemScope != "" && input.ItemScope != models.InventoryItemScopeUnit && input.ItemScope != models.InventoryItemScopePharmacy && input.ItemScope != models.InventoryItemScopeBoth {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_scope must be unit, pharmacy, or both"})
		return
	}

	code, err := generateDateCode(&models.Inventory{}, "INV")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate inventory code"})
		return
	}
	input.Code = code

	// TotalValue will be calculated based on room stocks when needed
	input.TotalValue = 0
	if strings.TrimSpace(string(input.ItemScope)) == "" {
		input.ItemScope = models.InventoryItemScopeBoth
	}
	if strings.TrimSpace(string(input.ItemGroup)) == "" {
		input.ItemGroup = models.InventoryItemGroupOther
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Inventory created successfully",
		"data":    input,
	})
}

// UpdateInventory updates an existing inventory
func UpdateInventory(c *gin.Context) {
	id := c.Param("id")

	var inventory models.Inventory
	if err := database.DB.First(&inventory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	var input models.Inventory
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.ItemGroup != "" && input.ItemGroup != models.InventoryItemGroupBHP && input.ItemGroup != models.InventoryItemGroupOther {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_group must be bhp or other"})
		return
	}
	if input.ItemScope != "" && input.ItemScope != models.InventoryItemScopeUnit && input.ItemScope != models.InventoryItemScopePharmacy && input.ItemScope != models.InventoryItemScopeBoth {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_scope must be unit, pharmacy, or both"})
		return
	}

	// Update fields (stock is managed per room, not here)
	updates := map[string]interface{}{
		"name":           input.Name,
		"description":    input.Description,
		"category":       input.Category,
		"item_group":     input.ItemGroup,
		"item_scope":     input.ItemScope,
		"unit":           input.Unit,
		"brand":          input.Brand,
		"model":          input.Model,
		"min_stock":      input.MinStock,
		"max_stock":      input.MaxStock,
		"price":          input.Price,
		"is_consumable":  input.IsConsumable,
		"is_reusable":    input.IsReusable,
		"require_serial": input.RequireSerial,
		"is_active":      input.IsActive,
		"specifications": input.Specifications,
		"notes":          input.Notes,
		"image_url":      input.ImageURL,
	}

	if err := database.DB.Model(&inventory).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update inventory: " + err.Error()})
		return
	}

	// Fetch updated inventory
	database.DB.First(&inventory, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Inventory updated successfully",
		"data":    inventory,
	})
}

// DeleteInventory deletes an inventory
func DeleteInventory(c *gin.Context) {
	id := c.Param("id")

	var inventory models.Inventory
	if err := database.DB.First(&inventory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	// Check if inventory has items assigned
	var itemCount int64
	database.DB.Model(&models.InventoryItem{}).Where("inventory_id = ?", id).Count(&itemCount)
	if itemCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot delete inventory with assigned items"})
		return
	}

	// Check if inventory is assigned to rooms
	var roomInventoryCount int64
	database.DB.Model(&models.RoomInventory{}).Where("inventory_id = ?", id).Count(&roomInventoryCount)
	if roomInventoryCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot delete inventory assigned to rooms"})
		return
	}

	if err := database.DB.Delete(&inventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete inventory: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Inventory deleted successfully"})
}

// ==========================================
// INVENTORY ITEM HANDLERS
// ==========================================

// GetInventoryItems returns items for a specific inventory
func GetInventoryItems(c *gin.Context) {
	inventoryID := c.Param("id")

	var items []models.InventoryItem
	if err := database.DB.Preload("Room").Preload("RoomUnit").
		Where("inventory_id = ?", inventoryID).
		Order("created_at DESC").
		Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory items"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// CreateInventoryItem creates a new inventory item
func CreateInventoryItem(c *gin.Context) {
	inventoryID := c.Param("id")

	var inventory models.Inventory
	if err := database.DB.First(&inventory, inventoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	var input models.InventoryItem
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set inventory ID
	id, _ := strconv.ParseUint(inventoryID, 10, 32)
	input.InventoryID = uint(id)

	// Set default condition and status if not provided
	if input.Condition == "" {
		input.Condition = models.InventoryConditionGood
	}
	if input.Status == "" {
		input.Status = models.InventoryStatusAvailable
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory item: " + err.Error()})
		return
	}

	// Stock is now managed per room via RoomInventory, not at master level

	// Load relations
	database.DB.Preload("Room").Preload("RoomUnit").First(&input, input.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Inventory item created successfully",
		"data":    input,
	})
}

// UpdateInventoryItem updates an existing inventory item
func UpdateInventoryItem(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.InventoryItem
	if err := database.DB.First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory item not found"})
		return
	}

	var input models.InventoryItem
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	updates := map[string]interface{}{
		"serial_number":         input.SerialNumber,
		"asset_number":          input.AssetNumber,
		"barcode":               input.Barcode,
		"condition":             input.Condition,
		"status":                input.Status,
		"purchase_date":         input.PurchaseDate,
		"purchase_price":        input.PurchasePrice,
		"supplier":              input.Supplier,
		"warranty_end":          input.WarrantyEnd,
		"room_id":               input.RoomID,
		"room_unit_id":          input.RoomUnitID,
		"location":              input.Location,
		"last_maintenance_date": input.LastMaintenanceDate,
		"next_maintenance_date": input.NextMaintenanceDate,
		"notes":                 input.Notes,
	}

	if err := database.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update inventory item: " + err.Error()})
		return
	}

	// Load updated item with relations
	database.DB.Preload("Room").Preload("RoomUnit").First(&item, itemID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Inventory item updated successfully",
		"data":    item,
	})
}

// DeleteInventoryItem deletes an inventory item
func DeleteInventoryItem(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.InventoryItem
	if err := database.DB.First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory item not found"})
		return
	}

	inventoryID := item.InventoryID
	_ = inventoryID // Keep for potential future use

	if err := database.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete inventory item: " + err.Error()})
		return
	}

	// Stock is now managed per room via RoomInventory, not at master level

	c.JSON(http.StatusOK, gin.H{"message": "Inventory item deleted successfully"})
}

// AssignItemToRoom assigns an inventory item to a room
func AssignItemToRoom(c *gin.Context) {
	itemID := c.Param("itemId")

	var item models.InventoryItem
	if err := database.DB.First(&item, itemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory item not found"})
		return
	}

	var input struct {
		RoomID     *uint  `json:"room_id"`
		RoomUnitID *uint  `json:"room_unit_id"`
		Location   string `json:"location"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate room exists if provided
	if input.RoomID != nil {
		var room models.Room
		if err := database.DB.First(&room, *input.RoomID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
	}

	// Update item location
	updates := map[string]interface{}{
		"room_id":      input.RoomID,
		"room_unit_id": input.RoomUnitID,
		"location":     input.Location,
		"status":       models.InventoryStatusInUse,
	}

	if err := database.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign item to room: " + err.Error()})
		return
	}

	// Load updated item with relations
	database.DB.Preload("Room").Preload("RoomUnit").First(&item, itemID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Item assigned to room successfully",
		"data":    item,
	})
}

// ==========================================
// ROOM INVENTORY HANDLERS (for bulk/consumable items)
// ==========================================

// GetRoomInventories returns all inventories assigned to a room
func GetRoomInventories(c *gin.Context) {
	roomID := c.Param("id")

	var roomInventories []models.RoomInventory
	if err := database.DB.Preload("Inventory").
		Where("room_id = ?", roomID).
		Order("created_at DESC").
		Find(&roomInventories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room inventories"})
		return
	}

	// Also get individual items assigned to this room
	var items []models.InventoryItem
	database.DB.Preload("Inventory").Where("room_id = ?", roomID).Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"data":  roomInventories,
		"items": items,
	})
}

// AssignInventoryToRoom assigns bulk/consumable inventory to a room
func AssignInventoryToRoom(c *gin.Context) {
	roomID := c.Param("id")

	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var input struct {
		InventoryID uint   `json:"inventory_id" binding:"required"`
		Quantity    int    `json:"quantity" binding:"required,min=1"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate inventory exists
	var inventory models.Inventory
	if err := database.DB.First(&inventory, input.InventoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	// Check if inventory is already assigned to this room
	var existingRoomInventory models.RoomInventory
	roomIDUint, _ := strconv.ParseUint(roomID, 10, 32)
	if err := database.DB.Where("room_id = ? AND inventory_id = ?", roomIDUint, input.InventoryID).First(&existingRoomInventory).Error; err == nil {
		// Update existing assignment
		existingRoomInventory.Quantity += input.Quantity
		if input.MinQuantity > 0 {
			existingRoomInventory.MinQuantity = input.MinQuantity
		}
		existingRoomInventory.Notes = input.Notes
		database.DB.Save(&existingRoomInventory)

		database.DB.Preload("Inventory").First(&existingRoomInventory, existingRoomInventory.ID)

		c.JSON(http.StatusOK, gin.H{
			"message": "Room inventory updated successfully",
			"data":    existingRoomInventory,
		})
		return
	}

	// Create new assignment
	roomInventory := models.RoomInventory{
		RoomID:      uint(roomIDUint),
		InventoryID: input.InventoryID,
		Quantity:    input.Quantity,
		MinQuantity: input.MinQuantity,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&roomInventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign inventory to room: " + err.Error()})
		return
	}

	database.DB.Preload("Inventory").First(&roomInventory, roomInventory.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Inventory assigned to room successfully",
		"data":    roomInventory,
	})
}

// UpdateRoomInventory updates room inventory assignment
func UpdateRoomInventory(c *gin.Context) {
	id := c.Param("invId")

	var roomInventory models.RoomInventory
	if err := database.DB.First(&roomInventory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
		return
	}

	var input struct {
		Quantity    int    `json:"quantity" binding:"required,min=0"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room inventory: " + err.Error()})
		return
	}

	database.DB.Preload("Inventory").First(&roomInventory, roomInventory.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Room inventory updated successfully",
		"data":    roomInventory,
	})
}

// RemoveRoomInventory removes inventory from a room
func RemoveRoomInventory(c *gin.Context) {
	id := c.Param("invId")

	var roomInventory models.RoomInventory
	if err := database.DB.First(&roomInventory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room inventory not found"})
		return
	}

	if err := database.DB.Delete(&roomInventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove room inventory: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room inventory removed successfully"})
}

// ==========================================
// INVENTORY TRANSACTION HANDLERS
// ==========================================

// GetInventoryTransactions returns transactions for an inventory
func GetInventoryTransactions(c *gin.Context) {
	inventoryID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var transactions []models.InventoryTransaction
	var total int64

	query := database.DB.Model(&models.InventoryTransaction{}).Where("inventory_id = ?", inventoryID)
	query.Count(&total)

	if err := query.Preload("User").Preload("FromRoom").Preload("ToRoom").
		Order("transaction_date DESC").
		Offset(offset).Limit(limit).
		Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": transactions,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// CreateInventoryTransaction creates a new transaction (stock in/out/adjustment)
// Note: This is a legacy function. Stock is now managed per room via RoomInventory.
// This function records transactions but does not update master-level stock.
func CreateInventoryTransaction(c *gin.Context) {
	inventoryID := c.Param("id")

	var inventory models.Inventory
	if err := database.DB.First(&inventory, inventoryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	var input struct {
		TransactionType string `json:"transaction_type" binding:"required"` // in, out, adjustment
		Quantity        int    `json:"quantity" binding:"required"`
		RoomID          *uint  `json:"room_id"`
		ReferenceNumber string `json:"reference_number"`
		Reason          string `json:"reason"`
		Notes           string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate transaction type
	validTypes := []string{"in", "out", "adjustment", "disposal"}
	isValid := false
	for _, t := range validTypes {
		if t == input.TransactionType {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction type"})
		return
	}

	// Calculate total stock from all rooms
	var totalStock int64
	database.DB.Model(&models.RoomInventory{}).
		Where("inventory_id = ?", inventoryID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&totalStock)

	previousStock := int(totalStock)
	newStock := previousStock

	switch input.TransactionType {
	case "in":
		newStock = previousStock + input.Quantity
	case "out", "disposal":
		newStock = previousStock - input.Quantity
		if newStock < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock"})
			return
		}
	case "adjustment":
		newStock = input.Quantity // For adjustment, quantity is the new stock value
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Create transaction record
	invID, _ := strconv.ParseUint(inventoryID, 10, 32)
	transaction := models.InventoryTransaction{
		TransactionType: input.TransactionType,
		InventoryID:     uint(invID),
		Quantity:        input.Quantity,
		PreviousStock:   previousStock,
		CurrentStock:    newStock,
		TransactionDate: time.Now(),
		ToRoomID:        input.RoomID,
		ReferenceNumber: input.ReferenceNumber,
		Reason:          input.Reason,
		UserID:          userID.(uint),
		Notes:           input.Notes,
	}

	if err := database.DB.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction: " + err.Error()})
		return
	}

	// Note: Actual stock update should be done via RoomInventory endpoints
	// This just records the transaction for historical purposes

	database.DB.Preload("User").First(&transaction, transaction.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Transaction created successfully",
		"data":    transaction,
	})
}

// GetInventoryCategories returns available inventory categories from master data
func GetInventoryCategories(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryInventoryCategory, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory categories"})
		return
	}

	categories := make([]gin.H, len(masterData))
	for i, data := range masterData {
		categories[i] = gin.H{"code": data.Code, "name": data.Name, "description": data.Description}
	}
	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// GetInventoryConditions returns available inventory conditions from master data
func GetInventoryConditions(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryInventoryCondition, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory conditions"})
		return
	}

	conditions := make([]gin.H, len(masterData))
	for i, data := range masterData {
		conditions[i] = gin.H{"code": data.Code, "name": data.Name, "description": data.Description}
	}
	c.JSON(http.StatusOK, gin.H{"data": conditions})
}

// GetInventoryStatuses returns available inventory statuses from master data
func GetInventoryStatuses(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryInventoryStatus, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory statuses"})
		return
	}

	statuses := make([]gin.H, len(masterData))
	for i, data := range masterData {
		statuses[i] = gin.H{"code": data.Code, "name": data.Name, "description": data.Description}
	}
	c.JSON(http.StatusOK, gin.H{"data": statuses})
}

// GetInventoryUnits returns available inventory units from master data
func GetInventoryUnits(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryInventoryUnit, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory units"})
		return
	}

	units := make([]gin.H, len(masterData))
	for i, data := range masterData {
		units[i] = gin.H{"code": data.Code, "name": data.Name, "description": data.Description}
	}
	c.JSON(http.StatusOK, gin.H{"data": units})
}
