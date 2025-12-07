package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ==================== Stock Opname Handlers ====================

type CreateStockOpnameInput struct {
	RoomID uint                         `json:"room_id" binding:"required"`
	Notes  string                       `json:"notes"`
	Items  []CreateStockOpnameItemInput `json:"items" binding:"required,min=1"`
}

type CreateStockOpnameItemInput struct {
	InventoryID   *uint  `json:"inventory_id"`
	MedicineID    *uint  `json:"medicine_id"`
	SystemStock   int    `json:"system_stock"`
	PhysicalStock int    `json:"physical_stock" binding:"required,min=0"`
	Unit          string `json:"unit"`
	Notes         string `json:"notes"`
}

type UpdateStockOpnameInput struct {
	Notes string                       `json:"notes"`
	Items []UpdateStockOpnameItemInput `json:"items"`
}

type UpdateStockOpnameItemInput struct {
	ID            uint   `json:"id"`
	InventoryID   *uint  `json:"inventory_id"`
	MedicineID    *uint  `json:"medicine_id"`
	PhysicalStock int    `json:"physical_stock"`
	Notes         string `json:"notes"`
}

// GetStockOpnames godoc
// @Summary Get all stock opnames
// @Description Get all stock opnames with pagination and filters
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param status query string false "Filter by status"
// @Param room_id query int false "Filter by room"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname [get]
func GetStockOpnames(c *gin.Context) {
	var opnames []models.StockOpname
	query := database.DB.Preload("Room").Preload("ConductedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.StockOpname{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&opnames)

	c.JSON(http.StatusOK, gin.H{
		"data": opnames,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetStockOpname godoc
// @Summary Get a stock opname by ID
// @Description Get stock opname details by ID
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param id path int true "Stock Opname ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/{id} [get]
func GetStockOpname(c *gin.Context) {
	id := c.Param("id")
	var opname models.StockOpname

	if err := database.DB.Preload("Room").Preload("ConductedBy").Preload("ApprovedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").
		First(&opname, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock opname not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": opname})
}

// CreateStockOpname godoc
// @Summary Create a new stock opname
// @Description Create a new stock opname record
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param input body CreateStockOpnameInput true "Stock opname data"
// @Success 201 {object} map[string]interface{}
// @Router /stock-opname [post]
func CreateStockOpname(c *gin.Context) {
	var input CreateStockOpnameInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Debug: Log received items count
	log.Printf("CreateStockOpname: Received %d items", len(input.Items))
	for i, item := range input.Items {
		invID := uint(0)
		medID := uint(0)
		if item.InventoryID != nil {
			invID = *item.InventoryID
		}
		if item.MedicineID != nil {
			medID = *item.MedicineID
		}
		log.Printf("  Item %d: InventoryID=%d, MedicineID=%d, PhysicalStock=%d",
			i, invID, medID, item.PhysicalStock)
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if there's already a stock opname for this room in the current month
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

	var existingCount int64
	database.DB.Model(&models.StockOpname{}).
		Where("room_id = ?", input.RoomID).
		Where("opname_date >= ? AND opname_date <= ?", startOfMonth, endOfMonth).
		Where("status != ?", "cancelled").
		Count(&existingCount)

	if existingCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan ini sudah memiliki stock opname pada bulan ini. Maksimal 1 stock opname per ruangan per bulan."})
		return
	}

	// Generate opname number
	year := time.Now().Format("2006")
	var lastOpname models.StockOpname
	var nextNumber int64 = 1

	// Find the last opname number for this year (including deleted records)
	if err := database.DB.Unscoped().
		Where("opname_number LIKE ?", fmt.Sprintf("OPN-%s-%%", year)).
		Order("opname_number DESC").
		First(&lastOpname).Error; err == nil {
		// Extract the number from the last opname_number
		var lastNum int64
		fmt.Sscanf(lastOpname.OpnameNumber, "OPN-"+year+"-%04d", &lastNum)
		nextNumber = lastNum + 1
	}
	opnameNumber := fmt.Sprintf("OPN-%s-%04d", year, nextNumber)

	// Determine opname type
	opnameType := "inventory"
	if len(input.Items) > 0 && input.Items[0].MedicineID != nil {
		opnameType = "medicine"
	}

	opname := models.StockOpname{
		OpnameNumber:  opnameNumber,
		OpnameType:    opnameType,
		RoomID:        input.RoomID,
		OpnameDate:    time.Now(),
		Status:        "draft",
		ConductedByID: userID.(uint),
		Notes:         input.Notes,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&opname).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stock opname"})
		return
	}

	// Create items - prevent duplicates by tracking seen inventory/medicine IDs
	seenInventories := make(map[uint]bool)
	seenMedicines := make(map[uint]bool)
	createdCount := 0

	for i, itemInput := range input.Items {
		// Skip duplicate inventory items
		if itemInput.InventoryID != nil {
			if seenInventories[*itemInput.InventoryID] {
				log.Printf("  Skipping item %d: duplicate inventory ID %d", i, *itemInput.InventoryID)
				continue
			}
			seenInventories[*itemInput.InventoryID] = true
		}

		// Skip duplicate medicine items
		if itemInput.MedicineID != nil {
			if seenMedicines[*itemInput.MedicineID] {
				log.Printf("  Skipping item %d: duplicate medicine ID %d", i, *itemInput.MedicineID)
				continue
			}
			seenMedicines[*itemInput.MedicineID] = true
		}

		difference := itemInput.PhysicalStock - itemInput.SystemStock
		item := models.StockOpnameItem{
			StockOpnameID: opname.ID,
			InventoryID:   itemInput.InventoryID,
			MedicineID:    itemInput.MedicineID,
			SystemStock:   itemInput.SystemStock,
			PhysicalStock: itemInput.PhysicalStock,
			Difference:    difference,
			Unit:          itemInput.Unit,
			Notes:         itemInput.Notes,
		}
		if err := tx.Create(&item).Error; err != nil {
			log.Printf("  Error creating item %d: %v", i, err)
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stock opname item"})
			return
		}
		createdCount++
		log.Printf("  Created item %d successfully", i)
	}
	log.Printf("Total items created: %d", createdCount)

	tx.Commit()

	// Reload with associations
	database.DB.Preload("Room").Preload("ConductedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&opname, opname.ID)

	c.JSON(http.StatusCreated, gin.H{"data": opname})
}

// UpdateStockOpname godoc
// @Summary Update a stock opname
// @Description Update stock opname details (only draft/in_progress status)
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param id path int true "Stock Opname ID"
// @Param input body UpdateStockOpnameInput true "Update data"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/{id} [put]
func UpdateStockOpname(c *gin.Context) {
	id := c.Param("id")
	var opname models.StockOpname

	if err := database.DB.First(&opname, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock opname not found"})
		return
	}

	if opname.Status != "draft" && opname.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update completed stock opname"})
		return
	}

	var input UpdateStockOpnameInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Update notes
	if input.Notes != "" {
		opname.Notes = input.Notes
		tx.Save(&opname)
	}

	// Update items
	for _, itemInput := range input.Items {
		if itemInput.ID > 0 {
			var item models.StockOpnameItem
			if err := tx.First(&item, itemInput.ID).Error; err == nil {
				item.PhysicalStock = itemInput.PhysicalStock
				item.Difference = itemInput.PhysicalStock - item.SystemStock
				if itemInput.Notes != "" {
					item.Notes = itemInput.Notes
				}
				tx.Save(&item)
			}
		}
	}

	tx.Commit()

	// Reload
	database.DB.Preload("Room").Preload("ConductedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&opname, opname.ID)

	c.JSON(http.StatusOK, gin.H{"data": opname})
}

// DeleteStockOpname godoc
// @Summary Delete a stock opname
// @Description Delete a stock opname (only draft status)
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param id path int true "Stock Opname ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/{id} [delete]
func DeleteStockOpname(c *gin.Context) {
	id := c.Param("id")
	var opname models.StockOpname

	if err := database.DB.First(&opname, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock opname not found"})
		return
	}

	if opname.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete non-draft stock opname"})
		return
	}

	// Delete items first
	database.DB.Where("stock_opname_id = ?", opname.ID).Delete(&models.StockOpnameItem{})
	database.DB.Delete(&opname)

	c.JSON(http.StatusOK, gin.H{"message": "Stock opname deleted successfully"})
}

// CompleteStockOpname godoc
// @Summary Complete a stock opname
// @Description Mark stock opname as completed
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param id path int true "Stock Opname ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/{id}/complete [post]
func CompleteStockOpname(c *gin.Context) {
	id := c.Param("id")
	var opname models.StockOpname

	if err := database.DB.First(&opname, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock opname not found"})
		return
	}

	if opname.Status == "completed" || opname.Status == "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock opname already completed"})
		return
	}

	opname.Status = "completed"
	database.DB.Save(&opname)

	// Reload
	database.DB.Preload("Room").Preload("ConductedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&opname, opname.ID)

	c.JSON(http.StatusOK, gin.H{"data": opname})
}

// ApproveStockOpname godoc
// @Summary Approve a stock opname
// @Description Approve stock opname and adjust stock levels
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param id path int true "Stock Opname ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/{id}/approve [post]
func ApproveStockOpname(c *gin.Context) {
	id := c.Param("id")
	var opname models.StockOpname

	if err := database.DB.Preload("Items").First(&opname, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock opname not found"})
		return
	}

	if opname.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock opname must be completed first"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userIDUint := userID.(uint)
	now := time.Now()

	opname.Status = "approved"
	opname.ApprovedByID = &userIDUint
	opname.ApprovedDate = &now

	tx := database.DB.Begin()

	// Adjust stock levels based on difference
	for _, item := range opname.Items {
		difference := item.PhysicalStock - item.SystemStock
		if difference == 0 {
			continue // No adjustment needed
		}

		if item.InventoryID != nil {
			// Adjust room inventory
			var roomInv models.RoomInventory
			if err := tx.Where("room_id = ? AND inventory_id = ?", opname.RoomID, *item.InventoryID).First(&roomInv).Error; err == nil {
				newQty := roomInv.Quantity + difference
				if newQty < 0 {
					newQty = 0
				}
				tx.Model(&roomInv).Update("quantity", newQty)

				// Create transaction record
				transType := "adjustment_in"
				if difference < 0 {
					transType = "adjustment_out"
				}
				absQty := difference
				if absQty < 0 {
					absQty = -absQty
				}

				transaction := models.InventoryTransaction{
					InventoryID:     *item.InventoryID,
					TransactionType: transType,
					Quantity:        absQty,
					PreviousStock:   item.SystemStock,
					CurrentStock:    item.PhysicalStock,
					TransactionDate: now,
					ReferenceNumber: opname.OpnameNumber,
					Reason:          fmt.Sprintf("Penyesuaian stock opname: %s", opname.OpnameNumber),
					UserID:          userIDUint,
				}
				tx.Create(&transaction)
			}
		}

		if item.MedicineID != nil {
			// Adjust room medicine
			var roomMed models.RoomMedicine
			if err := tx.Where("room_id = ? AND medicine_id = ?", opname.RoomID, *item.MedicineID).First(&roomMed).Error; err == nil {
				newQty := roomMed.Quantity + difference
				if newQty < 0 {
					newQty = 0
				}
				tx.Model(&roomMed).Update("quantity", newQty)

				// Create transaction record
				transType := "adjustment_in"
				if difference < 0 {
					transType = "adjustment_out"
				}
				absQty := difference
				if absQty < 0 {
					absQty = -absQty
				}

				transaction := models.MedicineTransaction{
					MedicineID:      *item.MedicineID,
					TransactionType: transType,
					Quantity:        absQty,
					PreviousStock:   item.SystemStock,
					CurrentStock:    item.PhysicalStock,
					TransactionDate: now,
					ReferenceNumber: opname.OpnameNumber,
					Reason:          fmt.Sprintf("Penyesuaian stock opname: %s", opname.OpnameNumber),
					UserID:          userIDUint,
				}
				tx.Create(&transaction)
			}
		}
	}

	tx.Save(&opname)
	tx.Commit()

	// Reload
	database.DB.Preload("Room").Preload("ConductedBy").Preload("ApprovedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").First(&opname, opname.ID)

	c.JSON(http.StatusOK, gin.H{"data": opname})
}

// GetRoomStock godoc
// @Summary Get room stock for opname
// @Description Get all inventory and medicine stock in a specific room
// @Tags Stock Opname
// @Accept json
// @Produce json
// @Param roomId path int true "Room ID"
// @Param type query string false "Filter by type (inventory or medicine)"
// @Success 200 {object} map[string]interface{}
// @Router /stock-opname/room-stock/{roomId} [get]
func GetRoomStock(c *gin.Context) {
	roomID := c.Param("roomId")
	stockType := c.Query("type")

	type RoomStockItem struct {
		ID          uint   `json:"id"`
		ItemType    string `json:"item_type"` // "inventory" or "medicine"
		InventoryID *uint  `json:"inventory_id,omitempty"`
		MedicineID  *uint  `json:"medicine_id,omitempty"`
		Code        string `json:"code"`
		Name        string `json:"name"`
		Unit        string `json:"unit"`
		SystemStock int    `json:"system_stock"`
		Category    string `json:"category,omitempty"`
	}

	var items []RoomStockItem

	// Maps to aggregate quantities for duplicate items
	inventoryMap := make(map[uint]*RoomStockItem)
	medicineMap := make(map[uint]*RoomStockItem)

	// Get Room Inventories
	if stockType == "" || stockType == "inventory" {
		var roomInventories []models.RoomInventory
		database.DB.Preload("Inventory").Where("room_id = ?", roomID).Find(&roomInventories)

		for _, ri := range roomInventories {
			if ri.Inventory != nil {
				// Copy to local variable to avoid loop variable reference issue
				invID := ri.InventoryID
				// Aggregate quantity if duplicate
				if existing, ok := inventoryMap[invID]; ok {
					existing.SystemStock += ri.Quantity
				} else {
					inventoryMap[invID] = &RoomStockItem{
						ID:          ri.ID,
						ItemType:    "inventory",
						InventoryID: &invID,
						Code:        ri.Inventory.Code,
						Name:        ri.Inventory.Name,
						Unit:        ri.Inventory.Unit,
						SystemStock: ri.Quantity,
						Category:    string(ri.Inventory.Category),
					}
				}
			}
		}
	}

	// Get Room Medicines
	if stockType == "" || stockType == "medicine" {
		var roomMedicines []models.RoomMedicine
		database.DB.Preload("Medicine").Where("room_id = ?", roomID).Find(&roomMedicines)

		for _, rm := range roomMedicines {
			if rm.Medicine != nil {
				// Copy to local variable to avoid loop variable reference issue
				medID := rm.MedicineID
				// Aggregate quantity if duplicate
				if existing, ok := medicineMap[medID]; ok {
					existing.SystemStock += rm.Quantity
				} else {
					medicineMap[medID] = &RoomStockItem{
						ID:          rm.ID,
						ItemType:    "medicine",
						MedicineID:  &medID,
						Code:        rm.Medicine.Code,
						Name:        rm.Medicine.Name,
						Unit:        rm.Medicine.Unit,
						SystemStock: rm.Quantity,
						Category:    string(rm.Medicine.Category),
					}
				}
			}
		}
	}

	// Convert maps to slice
	for _, item := range inventoryMap {
		items = append(items, *item)
	}
	for _, item := range medicineMap {
		items = append(items, *item)
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}
