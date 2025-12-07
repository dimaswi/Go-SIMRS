package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ==================== Purchase Handlers ====================

type CreatePurchaseInput struct {
	SupplierID      *uint                     `json:"supplier_id"`
	SupplierName    string                    `json:"supplier_name"`
	SupplierContact string                    `json:"supplier_contact"`
	ToRoomID        uint                      `json:"to_room_id" binding:"required"`
	Notes           string                    `json:"notes"`
	Items           []CreatePurchaseItemInput `json:"items" binding:"required,min=1"`
}

type CreatePurchaseItemInput struct {
	InventoryID     *uint   `json:"inventory_id"`
	MedicineID      *uint   `json:"medicine_id"`
	QuantityOrdered int     `json:"quantity_ordered" binding:"required,min=1"`
	UnitPrice       float64 `json:"unit_price"`
	Unit            string  `json:"unit"`
	Notes           string  `json:"notes"`
}

type UpdatePurchaseInput struct {
	SupplierID      *uint  `json:"supplier_id"`
	SupplierName    string `json:"supplier_name"`
	SupplierContact string `json:"supplier_contact"`
	Notes           string `json:"notes"`
}

type ReceivePurchaseInput struct {
	Items []ReceivePurchaseItemInput `json:"items" binding:"required,min=1"`
	Notes string                     `json:"notes"`
}

type ReceivePurchaseItemInput struct {
	ID               uint   `json:"id" binding:"required"`
	QuantityReceived int    `json:"quantity_received" binding:"required,min=0"`
	BatchNumber      string `json:"batch_number"`
	ExpiryDate       string `json:"expiry_date"`
}

// GetPurchases godoc
// @Summary Get all purchases
// @Description Get all purchases with pagination and filters
// @Tags Purchases
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param status query string false "Filter by status"
// @Param to_room_id query int false "Filter by destination room"
// @Success 200 {object} map[string]interface{}
// @Router /purchases [get]
func GetPurchases(c *gin.Context) {
	var purchases []models.Purchase
	query := database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if toRoomID := c.Query("to_room_id"); toRoomID != "" {
		query = query.Where("to_room_id = ?", toRoomID)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Purchase{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&purchases)

	c.JSON(http.StatusOK, gin.H{
		"data": purchases,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetPurchase godoc
// @Summary Get a purchase by ID
// @Description Get purchase details by ID
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [get]
func GetPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("ApprovedBy").Preload("ReceivedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").
		First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}

// CreatePurchase godoc
// @Summary Create a new purchase
// @Description Create a new purchase order
// @Tags Purchases
// @Accept json
// @Produce json
// @Param input body CreatePurchaseInput true "Purchase data"
// @Success 201 {object} map[string]interface{}
// @Router /purchases [post]
func CreatePurchase(c *gin.Context) {
	var input CreatePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Generate purchase number
	var count int64
	database.DB.Model(&models.Purchase{}).Count(&count)
	purchaseNumber := fmt.Sprintf("PO-%s-%04d", time.Now().Format("2006"), count+1)

	// Determine purchase type
	purchaseType := "inventory"
	if len(input.Items) > 0 && input.Items[0].MedicineID != nil {
		purchaseType = "medicine"
	}

	// Calculate total
	var totalAmount float64
	for _, item := range input.Items {
		totalAmount += float64(item.QuantityOrdered) * item.UnitPrice
	}

	purchase := models.Purchase{
		PurchaseNumber:  purchaseNumber,
		PurchaseType:    purchaseType,
		SupplierID:      input.SupplierID,
		SupplierName:    input.SupplierName,
		SupplierContact: input.SupplierContact,
		ToRoomID:        input.ToRoomID,
		Status:          "draft",
		TotalAmount:     totalAmount,
		CreatedByID:     userID.(uint),
		Notes:           input.Notes,
	}

	tx := database.DB.Begin()

	if err := tx.Create(&purchase).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase"})
		return
	}

	// Create items
	for _, itemInput := range input.Items {
		item := models.PurchaseItem{
			PurchaseID:      purchase.ID,
			InventoryID:     itemInput.InventoryID,
			MedicineID:      itemInput.MedicineID,
			QuantityOrdered: itemInput.QuantityOrdered,
			Unit:            itemInput.Unit,
			UnitPrice:       itemInput.UnitPrice,
			TotalPrice:      float64(itemInput.QuantityOrdered) * itemInput.UnitPrice,
			Notes:           itemInput.Notes,
		}
		if err := tx.Create(&item).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase item"})
			return
		}
	}

	tx.Commit()

	// Reload with associations
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusCreated, gin.H{"data": purchase})
}

// UpdatePurchase godoc
// @Summary Update a purchase
// @Description Update purchase details (only pending status)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Param input body UpdatePurchaseInput true "Update data"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [put]
func UpdatePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "pending" && purchase.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update purchase that is not pending"})
		return
	}

	var input UpdatePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.SupplierID != nil {
		updates["supplier_id"] = input.SupplierID
	}
	if input.SupplierName != "" {
		updates["supplier_name"] = input.SupplierName
	}
	if input.SupplierContact != "" {
		updates["supplier_contact"] = input.SupplierContact
	}
	if input.Notes != "" {
		updates["notes"] = input.Notes
	}

	database.DB.Model(&purchase).Updates(updates)

	// Reload
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("Items").
		Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}

// DeletePurchase godoc
// @Summary Delete a purchase
// @Description Delete a purchase (only draft/pending status)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id} [delete]
func DeletePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "pending" && purchase.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete purchase that is not pending/draft"})
		return
	}

	// Delete items first
	database.DB.Where("purchase_id = ?", purchase.ID).Delete(&models.PurchaseItem{})
	database.DB.Delete(&purchase)

	c.JSON(http.StatusOK, gin.H{"message": "Purchase deleted successfully"})
}

// SubmitPurchase godoc
// @Summary Submit a purchase for approval
// @Description Submit a draft purchase for approval (draft → pending)
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/submit [post]
func SubmitPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "draft" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya pembelian draft yang bisa diajukan"})
		return
	}

	purchase.Status = "pending"
	database.DB.Save(&purchase)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Purchase submitted for approval"})
}

// ApprovePurchase godoc
// @Summary Approve a purchase order
// @Description Approve a purchase order and change status to ordered
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/approve [post]
func ApprovePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status != "draft" && purchase.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya pembelian dengan status draft/pending yang bisa disetujui"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDUint := userID.(uint)
	now := time.Now()

	purchase.Status = "ordered"
	purchase.OrderDate = &now
	purchase.ApprovedByID = &userIDUint

	if err := database.DB.Save(&purchase).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyetujui pembelian"})
		return
	}

	// Reload with associations
	database.DB.Preload("ToRoom").Preload("Supplier").Preload("CreatedBy").Preload("ApprovedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Pembelian berhasil disetujui"})
}

// ReceivePurchase godoc
// @Summary Receive purchase items
// @Description Record receipt of purchase items
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Param input body ReceivePurchaseInput true "Receive data"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/receive [post]
func ReceivePurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "received" || purchase.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purchase already completed or cancelled"})
		return
	}

	if purchase.Status == "draft" || purchase.Status == "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purchase harus disetujui terlebih dahulu sebelum menerima barang"})
		return
	}

	var input ReceivePurchaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	tx := database.DB.Begin()

	allReceived := true
	for _, itemInput := range input.Items {
		var item models.PurchaseItem
		if err := tx.Preload("Inventory").Preload("Medicine").First(&item, itemInput.ID).Error; err != nil {
			continue
		}

		// Parse expiry date if provided
		var expiryDate *time.Time
		if itemInput.ExpiryDate != "" {
			parsed, err := time.Parse("2006-01-02", itemInput.ExpiryDate)
			if err == nil {
				expiryDate = &parsed
			}
		}

		// Calculate quantity being received this time
		qtyReceiving := itemInput.QuantityReceived

		item.QuantityReceived += qtyReceiving
		if itemInput.BatchNumber != "" {
			item.BatchNumber = itemInput.BatchNumber
		}
		if expiryDate != nil {
			item.ExpiryDate = expiryDate
		}

		tx.Save(&item)

		if item.QuantityReceived < item.QuantityOrdered {
			allReceived = false
		}

		// Add stock to room - only if quantity being received > 0
		if qtyReceiving > 0 {
			now := time.Now()
			if item.InventoryID != nil && *item.InventoryID > 0 {
				// Add to RoomInventory
				var roomInventory models.RoomInventory
				result := tx.Where("room_id = ? AND inventory_id = ?", purchase.ToRoomID, *item.InventoryID).First(&roomInventory)

				prevStock := 0
				if result.Error != nil {
					// Create new room inventory record
					roomInventory = models.RoomInventory{
						RoomID:      purchase.ToRoomID,
						InventoryID: *item.InventoryID,
						Quantity:    qtyReceiving,
						Notes:       fmt.Sprintf("Dari pembelian %s", purchase.PurchaseNumber),
					}
					tx.Create(&roomInventory)
				} else {
					// Update existing
					prevStock = roomInventory.Quantity
					roomInventory.Quantity += qtyReceiving
					tx.Save(&roomInventory)
				}

				// Create transaction log
				invTransaction := models.InventoryTransaction{
					TransactionType: "in",
					InventoryID:     *item.InventoryID,
					Quantity:        qtyReceiving,
					PreviousStock:   prevStock,
					CurrentStock:    roomInventory.Quantity,
					ToRoomID:        &purchase.ToRoomID,
					TransactionDate: now,
					ReferenceNumber: purchase.PurchaseNumber,
					Notes:           fmt.Sprintf("Penerimaan pembelian %s", purchase.PurchaseNumber),
					UserID:          userID.(uint),
				}
				tx.Create(&invTransaction)

			} else if item.MedicineID != nil && *item.MedicineID > 0 {
				// Add to RoomMedicine
				var roomMedicine models.RoomMedicine
				result := tx.Where("room_id = ? AND medicine_id = ?", purchase.ToRoomID, *item.MedicineID).First(&roomMedicine)

				prevStock := 0
				if result.Error != nil {
					// Create new room medicine record
					roomMedicine = models.RoomMedicine{
						RoomID:     purchase.ToRoomID,
						MedicineID: *item.MedicineID,
						Quantity:   qtyReceiving,
						Notes:      fmt.Sprintf("Dari pembelian %s", purchase.PurchaseNumber),
					}
					tx.Create(&roomMedicine)
				} else {
					// Update existing
					prevStock = roomMedicine.Quantity
					roomMedicine.Quantity += qtyReceiving
					tx.Save(&roomMedicine)
				}

				// Create batch if expiry date provided
				if expiryDate != nil {
					batch := models.MedicineBatch{
						MedicineID:   *item.MedicineID,
						BatchNumber:  itemInput.BatchNumber,
						ExpiryDate:   *expiryDate,
						Quantity:     qtyReceiving,
						RemainingQty: qtyReceiving,
						Location:     fmt.Sprintf("Ruangan ID: %d", purchase.ToRoomID),
					}
					tx.Create(&batch)
				}

				// Create transaction log
				medTransaction := models.MedicineTransaction{
					TransactionType: "in",
					MedicineID:      *item.MedicineID,
					Quantity:        qtyReceiving,
					PreviousStock:   prevStock,
					CurrentStock:    roomMedicine.Quantity,
					ToRoomID:        &purchase.ToRoomID,
					TransactionDate: now,
					ReferenceNumber: purchase.PurchaseNumber,
					Notes:           fmt.Sprintf("Penerimaan pembelian %s", purchase.PurchaseNumber),
					UserID:          userID.(uint),
				}
				tx.Create(&medTransaction)
			}
		}
	}

	// Update purchase status
	now2 := time.Now()
	userIDUint := userID.(uint)
	if allReceived {
		purchase.Status = "received"
	} else {
		purchase.Status = "partial"
	}
	purchase.ReceivedDate = &now2
	purchase.ReceivedByID = &userIDUint
	if input.Notes != "" {
		purchase.Notes = purchase.Notes + "\n" + input.Notes
	}

	tx.Save(&purchase)
	tx.Commit()

	// Reload
	database.DB.Preload("ToRoom").Preload("CreatedBy").Preload("ReceivedBy").
		Preload("Items").Preload("Items.Inventory").Preload("Items.Medicine").First(&purchase, purchase.ID)

	c.JSON(http.StatusOK, gin.H{"data": purchase, "message": "Barang berhasil diterima dan stok ditambahkan"})
}

// CancelPurchase godoc
// @Summary Cancel a purchase
// @Description Cancel a purchase order
// @Tags Purchases
// @Accept json
// @Produce json
// @Param id path int true "Purchase ID"
// @Success 200 {object} map[string]interface{}
// @Router /purchases/{id}/cancel [post]
func CancelPurchase(c *gin.Context) {
	id := c.Param("id")
	var purchase models.Purchase

	if err := database.DB.First(&purchase, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase not found"})
		return
	}

	if purchase.Status == "received" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel received purchase"})
		return
	}

	purchase.Status = "cancelled"
	database.DB.Save(&purchase)

	c.JSON(http.StatusOK, gin.H{"data": purchase})
}
