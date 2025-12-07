package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ==========================================
// MEDICINE HANDLERS
// ==========================================

// GetMedicines returns all medicines with pagination and search
func GetMedicines(c *gin.Context) {
	var medicines []models.Medicine
	var total int64

	// Get pagination params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	category := c.Query("category")
	medicineType := c.Query("type")
	form := c.Query("form")
	isActive := c.Query("is_active")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.Medicine{})

	// Apply search filter
	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(generic_name) LIKE ? OR LOWER(manufacturer) LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	// Apply category filter
	if category != "" {
		query = query.Where("category = ?", category)
	}

	// Apply type filter
	if medicineType != "" {
		query = query.Where("type = ?", medicineType)
	}

	// Apply form filter
	if form != "" {
		query = query.Where("form = ?", form)
	}

	// Apply is_active filter
	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	// Count total
	query.Count(&total)

	// Get paginated data
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&medicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": medicines,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetMedicine returns a single medicine by ID
func GetMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": medicine})
}

// CreateMedicine creates a new medicine
func CreateMedicine(c *gin.Context) {
	var input models.Medicine
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if input.Code == "" || input.Name == "" || input.Category == "" || input.Form == "" || input.Unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code, Name, Category, Form, and Unit are required"})
		return
	}

	// Check for duplicate code
	var existing models.Medicine
	if err := database.DB.Where("code = ?", input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Medicine with this code already exists"})
		return
	}

	// Set default values
	if input.Type == "" {
		input.Type = models.MedicineTypeOTC
	}
	input.IsActive = true

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medicine"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": input, "message": "Medicine created successfully"})
}

// UpdateMedicine updates an existing medicine
func UpdateMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	var input models.Medicine
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code (if code is being changed)
	if input.Code != medicine.Code {
		var existing models.Medicine
		if err := database.DB.Where("code = ? AND id != ?", input.Code, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Medicine with this code already exists"})
			return
		}
	}

	// Update fields
	updates := map[string]interface{}{
		"code":             input.Code,
		"name":             input.Name,
		"generic_name":     input.GenericName,
		"description":      input.Description,
		"category":         input.Category,
		"type":             input.Type,
		"form":             input.Form,
		"strength":         input.Strength,
		"unit":             input.Unit,
		"manufacturer":     input.Manufacturer,
		"min_stock":        input.MinStock,
		"max_stock":        input.MaxStock,
		"purchase_price":   input.PurchasePrice,
		"selling_price":    input.SellingPrice,
		"indication":       input.Indication,
		"contraindication": input.Contraindication,
		"side_effects":     input.SideEffects,
		"dosage":           input.Dosage,
		"interaction":      input.Interaction,
		"storage_info":     input.StorageInfo,
		"is_active":        input.IsActive,
		"require_recipe":   input.RequireRecipe,
		"notes":            input.Notes,
		"image_url":        input.ImageURL,
	}

	if err := database.DB.Model(&medicine).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update medicine"})
		return
	}

	// Reload data
	database.DB.First(&medicine, id)

	c.JSON(http.StatusOK, gin.H{"data": medicine, "message": "Medicine updated successfully"})
}

// DeleteMedicine deletes a medicine (soft delete)
func DeleteMedicine(c *gin.Context) {
	id := c.Param("id")

	var medicine models.Medicine
	if err := database.DB.First(&medicine, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// Check if medicine is assigned to any room
	var roomMedicineCount int64
	database.DB.Model(&models.RoomMedicine{}).Where("medicine_id = ?", id).Count(&roomMedicineCount)
	if roomMedicineCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete medicine that is assigned to rooms. Remove from rooms first."})
		return
	}

	if err := database.DB.Delete(&medicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete medicine"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Medicine deleted successfully"})
}

// GetMedicineCategories returns all medicine categories from master data
func GetMedicineCategories(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineCategory, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine categories"})
		return
	}

	categories := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		categories[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// GetMedicineTypes returns all medicine types from master data
func GetMedicineTypes(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineType, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine types"})
		return
	}

	types := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		types[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": types})
}

// GetMedicineForms returns all medicine forms from master data
func GetMedicineForms(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineForm, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine forms"})
		return
	}

	forms := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		forms[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": forms})
}

// GetMedicineUnits returns all medicine units from master data
func GetMedicineUnits(c *gin.Context) {
	var masterData []models.MasterData
	if err := database.DB.Where("category = ? AND is_active = ?", models.CategoryMedicineUnit, true).
		Order("sort_order ASC").Find(&masterData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medicine units"})
		return
	}

	units := make([]map[string]string, len(masterData))
	for i, data := range masterData {
		units[i] = map[string]string{"value": data.Code, "label": data.Name}
	}
	c.JSON(http.StatusOK, gin.H{"data": units})
}

// ==========================================
// ROOM MEDICINE HANDLERS
// ==========================================

// GetRoomMedicines returns all medicines assigned to a room
func GetRoomMedicines(c *gin.Context) {
	roomID := c.Param("id")

	var roomMedicines []models.RoomMedicine
	if err := database.DB.
		Preload("Medicine").
		Where("room_id = ?", roomID).
		Find(&roomMedicines).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room medicines"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomMedicines})
}

// AssignMedicineToRoom assigns a medicine to a room
func AssignMedicineToRoom(c *gin.Context) {
	roomID := c.Param("id")

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var input struct {
		MedicineID  uint   `json:"medicine_id" binding:"required"`
		Quantity    int    `json:"quantity"`
		MinQuantity int    `json:"min_quantity"`
		Notes       string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if medicine exists
	var medicine models.Medicine
	if err := database.DB.First(&medicine, input.MedicineID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medicine not found"})
		return
	}

	// Check if already assigned
	var existing models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, input.MedicineID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Medicine already assigned to this room"})
		return
	}

	// Create assignment
	roomIDUint, _ := strconv.ParseUint(roomID, 10, 32)
	roomMedicine := models.RoomMedicine{
		RoomID:      uint(roomIDUint),
		MedicineID:  input.MedicineID,
		Quantity:    input.Quantity,
		MinQuantity: input.MinQuantity,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign medicine to room"})
		return
	}

	// Load medicine data
	database.DB.Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomMedicine, "message": "Medicine assigned to room successfully"})
}

// UpdateRoomMedicine updates a medicine assignment in a room
func UpdateRoomMedicine(c *gin.Context) {
	roomID := c.Param("id")
	medicineID := c.Param("medicineId")

	var roomMedicine models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine assignment not found"})
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

	updates := map[string]interface{}{
		"quantity":     input.Quantity,
		"min_quantity": input.MinQuantity,
		"notes":        input.Notes,
	}

	if err := database.DB.Model(&roomMedicine).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room medicine"})
		return
	}

	// Reload data with medicine info
	database.DB.Preload("Medicine").First(&roomMedicine, roomMedicine.ID)

	c.JSON(http.StatusOK, gin.H{"data": roomMedicine, "message": "Room medicine updated successfully"})
}

// RemoveMedicineFromRoom removes a medicine assignment from a room
func RemoveMedicineFromRoom(c *gin.Context) {
	roomID := c.Param("id")
	medicineID := c.Param("medicineId")

	var roomMedicine models.RoomMedicine
	if err := database.DB.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room medicine assignment not found"})
		return
	}

	if err := database.DB.Delete(&roomMedicine).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove medicine from room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Medicine removed from room successfully"})
}
