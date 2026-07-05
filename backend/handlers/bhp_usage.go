package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type bhpUsageInput struct {
	InventoryID uint    `json:"inventory_id" binding:"required"`
	Quantity    int     `json:"quantity" binding:"required,min=1"`
	UnitPrice   float64 `json:"unit_price"`
	UsedAt      string  `json:"used_at"`
	Notes       string  `json:"notes"`
}

// GetVisitBHPUsages returns all BHP usage rows for a visit.
func GetVisitBHPUsages(c *gin.Context) {
	visitID := c.Param("id")

	var usages []models.VisitBHPUsage
	if err := database.DB.
		Where("visit_id = ?", visitID).
		Preload("Inventory").
		Preload("CreatedBy").
		Preload("UpdatedBy").
		Order("used_at DESC, id DESC").
		Find(&usages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data penggunaan BHP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usages})
}

// GetVisitBHPUsage returns one BHP usage row.
func GetVisitBHPUsage(c *gin.Context) {
	visitID := c.Param("id")
	usageID := c.Param("usageId")

	var usage models.VisitBHPUsage
	if err := database.DB.
		Where("visit_id = ? AND id = ?", visitID, usageID).
		Preload("Inventory").
		Preload("CreatedBy").
		Preload("UpdatedBy").
		First(&usage).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan BHP tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// GetVisitBHPAvailableItems returns BHP stock available for the current visit room.
func GetVisitBHPAvailableItems(c *gin.Context) {
	visitID := c.Param("id")

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	type itemRow struct {
		RoomInventoryID uint    `json:"room_inventory_id"`
		InventoryID     uint    `json:"inventory_id"`
		Code            string  `json:"code"`
		Name            string  `json:"name"`
		Unit            string  `json:"unit"`
		Price           float64 `json:"price"`
		CurrentStock    int     `json:"current_stock"`
	}

	var rows []itemRow
	if err := database.DB.
		Table("room_inventories").
		Select(`
			room_inventories.id AS room_inventory_id,
			room_inventories.inventory_id AS inventory_id,
			inventories.code AS code,
			inventories.name AS name,
			inventories.unit AS unit,
			inventories.price AS price,
			room_inventories.quantity AS current_stock
		`).
		Joins("JOIN inventories ON inventories.id = room_inventories.inventory_id").
		Where("room_inventories.room_id = ?", visit.RoomID).
		Where("room_inventories.quantity > 0").
		Where("inventories.is_active = ?", true).
		Where("inventories.item_group = ?", models.InventoryItemGroupBHP).
		Where("inventories.item_scope IN ?", []models.InventoryItemScope{models.InventoryItemScopeUnit, models.InventoryItemScopeBoth}).
		Order("inventories.name ASC").
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil stok BHP ruangan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// CreateVisitBHPUsage creates usage and decreases room stock.
func CreateVisitBHPUsage(c *gin.Context) {
	visitID := c.Param("id")

	var input bhpUsageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userID := userIDVal.(uint)

	var visit models.Visit
	if err := database.DB.First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	usedAt, ok := TryParseLocalDatetime(input.UsedAt)
	if !ok {
		usedAt = time.Now()
	}

	tx := database.DB.Begin()

	var inventory models.Inventory
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&inventory, input.InventoryID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item inventory tidak ditemukan"})
		return
	}

	if inventory.ItemGroup != models.InventoryItemGroupBHP {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item bukan kategori BHP"})
		return
	}
	if inventory.ItemScope == models.InventoryItemScopePharmacy {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item BHP khusus farmasi tidak bisa dipakai di unit"})
		return
	}

	var roomInventory models.RoomInventory
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("room_id = ? AND inventory_id = ?", visit.RoomID, input.InventoryID).
		First(&roomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item BHP belum tersedia di stok ruangan ini"})
		return
	}

	if roomInventory.Quantity < input.Quantity {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stok BHP tidak mencukupi"})
		return
	}

	unitPrice := input.UnitPrice
	if unitPrice <= 0 {
		unitPrice = inventory.Price
	}
	subtotal := unitPrice * float64(input.Quantity)

	prevStock := roomInventory.Quantity
	roomInventory.Quantity -= input.Quantity
	if err := tx.Save(&roomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurangi stok ruangan"})
		return
	}

	if NotifService != nil {
		NotifService.CheckAndNotifyLowStock(
			visit.RoomID,
			inventory.Name,
			prevStock,
			roomInventory.Quantity,
			roomInventory.MinQuantity,
		)
	}

	usage := models.VisitBHPUsage{
		VisitID:     visit.ID,
		RoomID:      visit.RoomID,
		InventoryID: inventory.ID,
		Quantity:    input.Quantity,
		Unit:        inventory.Unit,
		UnitPrice:   unitPrice,
		Subtotal:    subtotal,
		UsedAt:      usedAt,
		Notes:       strings.TrimSpace(input.Notes),
		CreatedByID: &userID,
		UpdatedByID: &userID,
	}
	if err := tx.Create(&usage).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan penggunaan BHP"})
		return
	}

	fromRoomID := visit.RoomID
	transaction := models.InventoryTransaction{
		TransactionType: "usage",
		InventoryID:     inventory.ID,
		Quantity:        input.Quantity,
		PreviousStock:   prevStock,
		CurrentStock:    roomInventory.Quantity,
		FromRoomID:      &fromRoomID,
		TransactionDate: time.Now(),
		ReferenceNumber: visit.VisitNumber,
		Reason:          fmt.Sprintf("Penggunaan BHP untuk visit %s", visit.VisitNumber),
		Notes:           fmt.Sprintf("Pemakaian BHP pasien (visit_id=%d)", visit.ID),
		UserID:          userID,
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat transaksi stok"})
		return
	}

	tx.Commit()

	database.DB.
		Preload("Inventory").
		Preload("CreatedBy").
		Preload("UpdatedBy").
		First(&usage, usage.ID)

	c.JSON(http.StatusCreated, gin.H{"data": usage})
}

// UpdateVisitBHPUsage updates usage and adjusts room stock delta.
func UpdateVisitBHPUsage(c *gin.Context) {
	visitID := c.Param("id")
	usageID := c.Param("usageId")

	var input bhpUsageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userID := userIDVal.(uint)

	visitIDUint, err := strconv.ParseUint(visitID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visit_id tidak valid"})
		return
	}

	tx := database.DB.Begin()

	var usage models.VisitBHPUsage
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("visit_id = ? AND id = ?", uint(visitIDUint), usageID).
		First(&usage).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan BHP tidak ditemukan"})
		return
	}

	var visit models.Visit
	if err := tx.First(&visit, visitID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	usedAt, ok := TryParseLocalDatetime(input.UsedAt)
	if !ok {
		usedAt = usage.UsedAt
	}

	var oldRoomInventory models.RoomInventory
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("room_id = ? AND inventory_id = ?", visit.RoomID, usage.InventoryID).
		First(&oldRoomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stok ruangan untuk item lama tidak ditemukan"})
		return
	}

	newInventoryID := input.InventoryID
	if newInventoryID == 0 {
		newInventoryID = usage.InventoryID
	}

	var newInventory models.Inventory
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&newInventory, newInventoryID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item inventory tujuan tidak ditemukan"})
		return
	}
	if newInventory.ItemGroup != models.InventoryItemGroupBHP {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item tujuan bukan kategori BHP"})
		return
	}
	if newInventory.ItemScope == models.InventoryItemScopePharmacy {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item BHP khusus farmasi tidak bisa dipakai di unit"})
		return
	}

	if usage.InventoryID == newInventoryID {
		delta := input.Quantity - usage.Quantity
		if delta > 0 {
			if oldRoomInventory.Quantity < delta {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "Stok BHP tidak mencukupi untuk update kuantitas"})
				return
			}
			prev := oldRoomInventory.Quantity
			oldRoomInventory.Quantity -= delta
			if err := tx.Save(&oldRoomInventory).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update stok ruangan"})
				return
			}
			fromRoomID := visit.RoomID
			stockTx := models.InventoryTransaction{
				TransactionType: "usage_adjustment",
				InventoryID:     newInventoryID,
				Quantity:        delta,
				PreviousStock:   prev,
				CurrentStock:    oldRoomInventory.Quantity,
				FromRoomID:      &fromRoomID,
				TransactionDate: time.Now(),
				ReferenceNumber: visit.VisitNumber,
				Reason:          fmt.Sprintf("Penyesuaian penggunaan BHP visit %s", visit.VisitNumber),
				Notes:           "Perubahan kuantitas penggunaan BHP (naik)",
				UserID:          userID,
			}
			if err := tx.Create(&stockTx).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat mutasi stok"})
				return
			}
		} else if delta < 0 {
			rollbackQty := -delta
			prev := oldRoomInventory.Quantity
			oldRoomInventory.Quantity += rollbackQty
			if err := tx.Save(&oldRoomInventory).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update stok ruangan"})
				return
			}
			toRoomID := visit.RoomID
			stockTx := models.InventoryTransaction{
				TransactionType: "usage_adjustment",
				InventoryID:     newInventoryID,
				Quantity:        rollbackQty,
				PreviousStock:   prev,
				CurrentStock:    oldRoomInventory.Quantity,
				ToRoomID:        &toRoomID,
				TransactionDate: time.Now(),
				ReferenceNumber: visit.VisitNumber,
				Reason:          fmt.Sprintf("Penyesuaian penggunaan BHP visit %s", visit.VisitNumber),
				Notes:           "Perubahan kuantitas penggunaan BHP (turun)",
				UserID:          userID,
			}
			if err := tx.Create(&stockTx).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat mutasi stok"})
				return
			}
		}
	} else {
		// Return old quantity to old stock first.
		oldPrev := oldRoomInventory.Quantity
		oldRoomInventory.Quantity += usage.Quantity
		if err := tx.Save(&oldRoomInventory).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengembalikan stok item lama"})
			return
		}

		// Deduct new quantity from new stock.
		var newRoomInventory models.RoomInventory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("room_id = ? AND inventory_id = ?", visit.RoomID, newInventoryID).
			First(&newRoomInventory).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Item BHP tujuan belum tersedia di ruangan"})
			return
		}
		if newRoomInventory.Quantity < input.Quantity {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "Stok item BHP tujuan tidak mencukupi"})
			return
		}
		newPrev := newRoomInventory.Quantity
		newRoomInventory.Quantity -= input.Quantity
		if err := tx.Save(&newRoomInventory).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengurangi stok item tujuan"})
			return
		}

		toRoomID := visit.RoomID
		fromRoomID := visit.RoomID
		restoreTx := models.InventoryTransaction{
			TransactionType: "usage_revert",
			InventoryID:     usage.InventoryID,
			Quantity:        usage.Quantity,
			PreviousStock:   oldPrev,
			CurrentStock:    oldRoomInventory.Quantity,
			ToRoomID:        &toRoomID,
			TransactionDate: time.Now(),
			ReferenceNumber: visit.VisitNumber,
			Reason:          fmt.Sprintf("Koreksi penggunaan BHP visit %s", visit.VisitNumber),
			Notes:           "Kembalikan stok karena ganti item BHP",
			UserID:          userID,
		}
		if err := tx.Create(&restoreTx).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat pengembalian stok item lama"})
			return
		}
		deductTx := models.InventoryTransaction{
			TransactionType: "usage_adjustment",
			InventoryID:     newInventoryID,
			Quantity:        input.Quantity,
			PreviousStock:   newPrev,
			CurrentStock:    newRoomInventory.Quantity,
			FromRoomID:      &fromRoomID,
			TransactionDate: time.Now(),
			ReferenceNumber: visit.VisitNumber,
			Reason:          fmt.Sprintf("Koreksi penggunaan BHP visit %s", visit.VisitNumber),
			Notes:           "Kurangi stok item baru karena ganti item BHP",
			UserID:          userID,
		}
		if err := tx.Create(&deductTx).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat pengurangan stok item tujuan"})
			return
		}
	}

	unitPrice := input.UnitPrice
	if unitPrice <= 0 {
		unitPrice = newInventory.Price
	}
	updates := map[string]interface{}{
		"inventory_id":  newInventoryID,
		"quantity":      input.Quantity,
		"unit":          newInventory.Unit,
		"unit_price":    unitPrice,
		"subtotal":      unitPrice * float64(input.Quantity),
		"used_at":       usedAt,
		"notes":         strings.TrimSpace(input.Notes),
		"updated_by_id": userID,
	}

	if err := tx.Model(&usage).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui penggunaan BHP"})
		return
	}

	tx.Commit()

	database.DB.
		Preload("Inventory").
		Preload("CreatedBy").
		Preload("UpdatedBy").
		First(&usage, usage.ID)

	c.JSON(http.StatusOK, gin.H{"data": usage})
}

// DeleteVisitBHPUsage deletes usage and restores room stock.
func DeleteVisitBHPUsage(c *gin.Context) {
	visitID := c.Param("id")
	usageID := c.Param("usageId")

	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userID := userIDVal.(uint)

	tx := database.DB.Begin()

	var usage models.VisitBHPUsage
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("visit_id = ? AND id = ?", visitID, usageID).
		First(&usage).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penggunaan BHP tidak ditemukan"})
		return
	}

	var visit models.Visit
	if err := tx.First(&visit, visitID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	var roomInventory models.RoomInventory
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("room_id = ? AND inventory_id = ?", visit.RoomID, usage.InventoryID).
		First(&roomInventory).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			roomInventory = models.RoomInventory{
				RoomID:      visit.RoomID,
				InventoryID: usage.InventoryID,
				Quantity:    0,
			}
			if err := tx.Create(&roomInventory).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat stok ruangan untuk rollback"})
				return
			}
		} else {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat stok ruangan"})
			return
		}
	}

	prev := roomInventory.Quantity
	roomInventory.Quantity += usage.Quantity
	if err := tx.Save(&roomInventory).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengembalikan stok ruangan"})
		return
	}

	toRoomID := visit.RoomID
	transaction := models.InventoryTransaction{
		TransactionType: "usage_revert",
		InventoryID:     usage.InventoryID,
		Quantity:        usage.Quantity,
		PreviousStock:   prev,
		CurrentStock:    roomInventory.Quantity,
		ToRoomID:        &toRoomID,
		TransactionDate: time.Now(),
		ReferenceNumber: visit.VisitNumber,
		Reason:          fmt.Sprintf("Hapus penggunaan BHP visit %s", visit.VisitNumber),
		Notes:           "Rollback stok karena data penggunaan BHP dihapus",
		UserID:          userID,
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat rollback transaksi stok"})
		return
	}

	if err := tx.Delete(&usage).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus penggunaan BHP"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Penggunaan BHP berhasil dihapus"})
}
