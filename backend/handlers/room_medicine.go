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

// GetAllRoomMedicines returns all medicines assigned to rooms with pagination
func GetAllRoomMedicines(c *gin.Context) {
	var roomMedicines []models.RoomMedicine
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	roomID := c.Query("room_id")
	medicineID := c.Query("medicine_id")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.RoomMedicine{}).
		Preload("Room").
		Preload("Medicine")

	// Filter by room
	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by medicine
	if medicineID != "" {
		query = query.Where("medicine_id = ?", medicineID)
	}

	// Search in medicine name or room name
	if search != "" {
		query = query.Joins("LEFT JOIN rooms ON rooms.id = room_medicines.room_id").
			Joins("LEFT JOIN medicines ON medicines.id = room_medicines.medicine_id").
			Where("rooms.name ILIKE ? OR medicines.name ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Count total
	query.Count(&total)

	// Sorting
	orderClause := sortBy + " " + sortOrder
	if sortBy == "room_name" {
		query = query.Joins("LEFT JOIN rooms r ON r.id = room_medicines.room_id").Order("r.name " + sortOrder)
	} else if sortBy == "medicine_name" {
		query = query.Joins("LEFT JOIN medicines m ON m.id = room_medicines.medicine_id").Order("m.name " + sortOrder)
	} else {
		query = query.Order(orderClause)
	}

	// Get data with pagination
	if err := query.Offset(offset).Limit(limit).Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": roomMedicines,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRoomMedicine returns a single room medicine by ID
func GetRoomMedicine(c *gin.Context) {
	id := c.Param("id")
	var roomMedicine models.RoomMedicine

	if err := database.DB.Preload("Room").Preload("Medicine").First(&roomMedicine, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicine"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomMedicine})
}

// GetMedicinesByRoom returns all medicines assigned to a specific room
func GetMedicinesByRoom(c *gin.Context) {
	roomID := c.Param("room_id")
	var roomMedicines []models.RoomMedicine

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	var total int64

	offset := (page - 1) * limit

	query := database.DB.Model(&models.RoomMedicine{}).
		Preload("Medicine").
		Joins("JOIN medicines ON medicines.id = room_medicines.medicine_id").
		Where("room_medicines.room_id = ? AND medicines.is_active = ?", roomID, true)

	if search != "" {
		query = query.Where("(medicines.name ILIKE ? OR medicines.code ILIKE ?)", "%"+search+"%", "%"+search+"%")
	}

	query.Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": roomMedicines,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRoomsByMedicine returns all rooms that have a specific medicine
func GetRoomsByMedicine(c *gin.Context) {
	medicineID := c.Param("id")
	var roomMedicines []models.RoomMedicine

	if err := database.DB.Preload("Room").Where("medicine_id = ?", medicineID).Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomMedicines})
}

// GetTotalMedicineStock returns total stock of a medicine across all rooms
func GetTotalMedicineStock(c *gin.Context) {
	medicineID := c.Param("id")
	var total int64

	if err := database.DB.Model(&models.RoomMedicine{}).
		Where("medicine_id = ?", medicineID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate total stock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"total_stock": total})
}

// CreateRoomMedicine creates a new room medicine assignment
func CreateRoomMedicine(c *gin.Context) {
	var input struct {
		RoomID      uint   `json:"room_id" binding:"required"`
		MedicineID  uint   `json:"medicine_id" binding:"required"`
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

	// Check if medicine exists
	var medicine models.Medicine
	if err := database.DB.First(&medicine, input.MedicineID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Medicine not found"})
		return
	}

	// Check if assignment already exists
	var existing models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", input.RoomID, input.MedicineID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Medicine already assigned to this room"})
		return
	}

	roomMedicine := models.RoomMedicine{
		RoomID:      input.RoomID,
		MedicineID:  input.MedicineID,
		Quantity:    input.Quantity,
		MinQuantity: input.MinQuantity,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room medicine"})
		return
	}

	// Preload relations
	database.DB.Preload("Room").Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomMedicine, "message": "Room medicine created successfully"})
}

// UpdateRoomMedicineStock updates a room medicine assignment
func UpdateRoomMedicineStock(c *gin.Context) {
	id := c.Param("id")
	var roomMedicine models.RoomMedicine

	if err := database.DB.First(&roomMedicine, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicine"})
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

	roomMedicine.Quantity = input.Quantity
	roomMedicine.MinQuantity = input.MinQuantity
	roomMedicine.Notes = input.Notes

	if err := database.DB.Save(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room medicine"})
		return
	}

	database.DB.Preload("Room").Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusOK, gin.H{"data": roomMedicine, "message": "Room medicine updated successfully"})
}

// DeleteRoomMedicine deletes a room medicine assignment
func DeleteRoomMedicine(c *gin.Context) {
	id := c.Param("id")
	var roomMedicine models.RoomMedicine

	if err := database.DB.First(&roomMedicine, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicine"})
		return
	}

	if err := database.DB.Delete(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room medicine"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room medicine deleted successfully"})
}

// AdjustRoomMedicineStock adjusts the stock of a room medicine
func AdjustRoomMedicineStock(c *gin.Context) {
	id := c.Param("id")
	var roomMedicine models.RoomMedicine

	if err := database.DB.First(&roomMedicine, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicine"})
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

	previousStock := roomMedicine.Quantity
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

	// Update room medicine stock
	roomMedicine.Quantity = newStock
	if err := tx.Save(&roomMedicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock"})
		return
	}

	// Create transaction record
	transaction := models.MedicineTransaction{
		TransactionType: "adjustment",
		MedicineID:      roomMedicine.MedicineID,
		Quantity:        input.Quantity,
		PreviousStock:   previousStock,
		CurrentStock:    newStock,
		ToRoomID:        &roomMedicine.RoomID,
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

	database.DB.Preload("Room").Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":    roomMedicine,
		"message": "Stock adjusted successfully",
	})
}

// TransferMedicineStock transfers medicine stock between rooms
func TransferMedicineStock(c *gin.Context) {
	var input struct {
		FromRoomID uint   `json:"from_room_id" binding:"required"`
		ToRoomID   uint   `json:"to_room_id" binding:"required"`
		MedicineID uint   `json:"medicine_id" binding:"required"`
		Quantity   int    `json:"quantity" binding:"required"`
		Notes      string `json:"notes"`
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

	// Get source room medicine
	var sourceRoomMedicine models.RoomMedicine
	if err := tx.Where("room_id = ? AND medicine_id = ?", input.FromRoomID, input.MedicineID).First(&sourceRoomMedicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found in source room"})
		return
	}

	if sourceRoomMedicine.Quantity < input.Quantity {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock in source room"})
		return
	}

	// Get or create destination room medicine
	var destRoomMedicine models.RoomMedicine
	if err := tx.Where("room_id = ? AND medicine_id = ?", input.ToRoomID, input.MedicineID).First(&destRoomMedicine).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			destRoomMedicine = models.RoomMedicine{
				RoomID:     input.ToRoomID,
				MedicineID: input.MedicineID,
				Quantity:   0,
			}
			if err := tx.Create(&destRoomMedicine).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create destination room medicine"})
				return
			}
		} else {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch destination room medicine"})
			return
		}
	}

	// Update quantities
	sourcePrevious := sourceRoomMedicine.Quantity
	destPrevious := destRoomMedicine.Quantity

	sourceRoomMedicine.Quantity -= input.Quantity
	destRoomMedicine.Quantity += input.Quantity

	if err := tx.Save(&sourceRoomMedicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update source stock"})
		return
	}

	if err := tx.Save(&destRoomMedicine).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update destination stock"})
		return
	}

	// Create transaction record
	transaction := models.MedicineTransaction{
		TransactionType: "transfer",
		MedicineID:      input.MedicineID,
		Quantity:        input.Quantity,
		PreviousStock:   sourcePrevious,
		CurrentStock:    sourceRoomMedicine.Quantity,
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
			"current_stock":  sourceRoomMedicine.Quantity,
		},
		"to": gin.H{
			"room_id":        input.ToRoomID,
			"previous_stock": destPrevious,
			"current_stock":  destRoomMedicine.Quantity,
		},
	})
}

// GetLowStockMedicines returns medicines in rooms with stock below minimum
func GetLowStockMedicines(c *gin.Context) {
	roomID := c.Query("room_id")
	var lowStockMedicines []models.RoomMedicine

	query := database.DB.Preload("Room").Preload("Medicine").
		Where("quantity < min_quantity AND min_quantity > 0")

	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	if err := query.Find(&lowStockMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch low stock medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": lowStockMedicines})
}
