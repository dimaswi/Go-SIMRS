package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ==========================================
// NUTRITION MENU HANDLERS (Master Menu Makanan)
// ==========================================

// GetNutritionMenuCategories returns available menu categories
func GetNutritionMenuCategories(c *gin.Context) {
	var result []map[string]string
	for value, label := range models.NutritionCategoryLabels {
		result = append(result, map[string]string{"value": value, "label": label})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetNutritionDietTypes returns available diet types
func GetNutritionDietTypes(c *gin.Context) {
	var result []map[string]string
	for value, label := range models.NutritionDietTypeLabels {
		result = append(result, map[string]string{"value": value, "label": label})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetNutritionMealTimes returns available meal times
func GetNutritionMealTimes(c *gin.Context) {
	var result []map[string]string
	for value, label := range models.NutritionMealTimeLabels {
		result = append(result, map[string]string{"value": value, "label": label})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetNutritionMenus returns all nutrition menus with pagination and search
func GetNutritionMenus(c *gin.Context) {
	var menus []models.NutritionMenu
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	category := c.Query("category")
	dietType := c.Query("diet_type")
	isActive := c.Query("is_active")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.NutritionMenu{})

	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(code) LIKE ? OR LOWER(name) LIKE ?", searchPattern, searchPattern)
	}

	if category != "" {
		query = query.Where("category = ?", category)
	}

	if dietType != "" {
		// Search in JSON array diet_types
		query = query.Where("diet_types LIKE ?", "%\""+dietType+"\"%")
	}

	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	query.Count(&total)

	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&menus).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data menu gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  menus,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNutritionMenu returns a single nutrition menu
func GetNutritionMenu(c *gin.Context) {
	id := c.Param("id")

	var menu models.NutritionMenu
	if err := database.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu gizi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": menu})
}

// CreateNutritionMenu creates a new nutrition menu
func CreateNutritionMenu(c *gin.Context) {
	var input models.NutritionMenu
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Auto-generate code if not provided
	if input.Code == "" {
		var lastMenu models.NutritionMenu
		today := time.Now().Format("0601")
		prefix := "MNU" + today
		if err := database.DB.Where("code LIKE ?", prefix+"%").Order("code DESC").First(&lastMenu).Error; err != nil {
			input.Code = prefix + "001"
		} else {
			var lastNum int
			fmt.Sscanf(lastMenu.Code, prefix+"%d", &lastNum)
			input.Code = fmt.Sprintf("%s%03d", prefix, lastNum+1)
		}
	}

	// Validate category
	if _, ok := models.NutritionCategoryLabels[input.Category]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori menu tidak valid"})
		return
	}

	// Validate diet_types JSON
	if input.DietTypes != "" {
		var dietTypes []string
		if err := json.Unmarshal([]byte(input.DietTypes), &dietTypes); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format diet types tidak valid (harus JSON array)"})
			return
		}
	}

	if err := database.DB.Create(&input).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode menu sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan menu gizi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": input, "message": "Menu gizi berhasil ditambahkan"})
}

// UpdateNutritionMenu updates an existing nutrition menu
func UpdateNutritionMenu(c *gin.Context) {
	id := c.Param("id")

	var menu models.NutritionMenu
	if err := database.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu gizi tidak ditemukan"})
		return
	}

	var input models.NutritionMenu
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate category
	if input.Category != "" {
		if _, ok := models.NutritionCategoryLabels[input.Category]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori menu tidak valid"})
			return
		}
	}

	// Validate diet_types JSON
	if input.DietTypes != "" {
		var dietTypes []string
		if err := json.Unmarshal([]byte(input.DietTypes), &dietTypes); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format diet types tidak valid (harus JSON array)"})
			return
		}
	}

	// Update fields
	updates := map[string]interface{}{
		"name":         input.Name,
		"description":  input.Description,
		"category":     input.Category,
		"diet_types":   input.DietTypes,
		"calories":     input.Calories,
		"protein":      input.Protein,
		"fat":          input.Fat,
		"carbohydrate": input.Carbohydrate,
		"fiber":        input.Fiber,
		"sodium":       input.Sodium,
		"serving_size": input.ServingSize,
		"unit_price":   input.UnitPrice,
		"is_active":    input.IsActive,
		"notes":        input.Notes,
	}

	// Only update code if provided and different
	if input.Code != "" && input.Code != menu.Code {
		updates["code"] = input.Code
	}

	if err := database.DB.Model(&menu).Updates(updates).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode menu sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate menu gizi"})
		return
	}

	database.DB.First(&menu, id)
	c.JSON(http.StatusOK, gin.H{"data": menu, "message": "Menu gizi berhasil diupdate"})
}

// DeleteNutritionMenu soft-deletes a nutrition menu
func DeleteNutritionMenu(c *gin.Context) {
	id := c.Param("id")

	var menu models.NutritionMenu
	if err := database.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu gizi tidak ditemukan"})
		return
	}

	// Check if menu is used in any package
	var packageItemCount int64
	database.DB.Model(&models.NutritionPackageItem{}).Where("menu_id = ?", menu.ID).Count(&packageItemCount)
	if packageItemCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Menu ini masih digunakan dalam paket makanan. Hapus dari paket terlebih dahulu."})
		return
	}

	// Check if menu is used in any active order
	var orderItemCount int64
	database.DB.Model(&models.NutritionOrderItem{}).
		Joins("JOIN nutrition_orders ON nutrition_orders.id = nutrition_order_items.order_id").
		Where("nutrition_order_items.menu_id = ? AND nutrition_orders.status NOT IN ?", menu.ID, []string{"cancelled", "delivered"}).
		Count(&orderItemCount)
	if orderItemCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Menu ini masih digunakan dalam order aktif."})
		return
	}

	if err := database.DB.Delete(&menu).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus menu gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Menu gizi berhasil dihapus"})
}

// ==========================================
// NUTRITION PACKAGE HANDLERS (Master Paket Makanan)
// ==========================================

// GetNutritionPackages returns all packages with pagination
func GetNutritionPackages(c *gin.Context) {
	var packages []models.NutritionPackage
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	dietType := c.Query("diet_type")
	mealTime := c.Query("meal_time")
	isActive := c.Query("is_active")

	offset := (page - 1) * limit

	query := database.DB.Model(&models.NutritionPackage{})

	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(code) LIKE ? OR LOWER(name) LIKE ?", searchPattern, searchPattern)
	}

	if dietType != "" {
		query = query.Where("diet_type = ?", dietType)
	}

	if mealTime != "" {
		query = query.Where("meal_time = ?", mealTime)
	}

	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	query.Count(&total)

	if err := query.
		Preload("Items.Menu").
		Order("name ASC").
		Offset(offset).Limit(limit).
		Find(&packages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data paket makanan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  packages,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNutritionPackage returns a single package with items
func GetNutritionPackage(c *gin.Context) {
	id := c.Param("id")

	var pkg models.NutritionPackage
	if err := database.DB.Preload("Items.Menu").First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket makanan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pkg})
}

// CreateNutritionPackageInput is the input for creating/updating a package
type CreateNutritionPackageInput struct {
	Code        string  `json:"code"`
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	DietType    string  `json:"diet_type" binding:"required"`
	MealTime    string  `json:"meal_time" binding:"required"`
	Price       float64 `json:"price"`
	IsActive    bool    `json:"is_active"`
	Notes       string  `json:"notes"`
	Items       []struct {
		MenuID   uint    `json:"menu_id" binding:"required"`
		Quantity float64 `json:"quantity"`
		Notes    string  `json:"notes"`
	} `json:"items"`
}

// CreateNutritionPackage creates a new package with items
func CreateNutritionPackage(c *gin.Context) {
	var input CreateNutritionPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate diet type
	if _, ok := models.NutritionDietTypeLabels[input.DietType]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis diet tidak valid"})
		return
	}

	// Validate meal time
	if _, ok := models.NutritionMealTimeLabels[input.MealTime]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu makan tidak valid"})
		return
	}

	// Auto-generate code if not provided
	code := input.Code
	if code == "" {
		var lastPkg models.NutritionPackage
		today := time.Now().Format("0601")
		prefix := "PKT" + today
		if err := database.DB.Where("code LIKE ?", prefix+"%").Order("code DESC").First(&lastPkg).Error; err != nil {
			code = prefix + "001"
		} else {
			var lastNum int
			fmt.Sscanf(lastPkg.Code, prefix+"%d", &lastNum)
			code = fmt.Sprintf("%s%03d", prefix, lastNum+1)
		}
	}

	tx := database.DB.Begin()

	// Create package
	pkg := models.NutritionPackage{
		Code:        code,
		Name:        input.Name,
		Description: input.Description,
		DietType:    input.DietType,
		MealTime:    input.MealTime,
		Price:       input.Price,
		IsActive:    input.IsActive,
		Notes:       input.Notes,
	}

	if err := tx.Create(&pkg).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode paket sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan paket makanan"})
		return
	}

	// Create package items and calculate totals
	var totalCalories, totalProtein, totalFat, totalCarb float64

	for _, item := range input.Items {
		// Verify menu exists
		var menu models.NutritionMenu
		if err := tx.First(&menu, item.MenuID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Menu ID %d tidak ditemukan", item.MenuID)})
			return
		}

		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}

		pkgItem := models.NutritionPackageItem{
			PackageID: pkg.ID,
			MenuID:    item.MenuID,
			Quantity:  qty,
			Notes:     item.Notes,
		}

		if err := tx.Create(&pkgItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item paket"})
			return
		}

		// Accumulate nutrition totals
		totalCalories += menu.Calories * qty
		totalProtein += menu.Protein * qty
		totalFat += menu.Fat * qty
		totalCarb += menu.Carbohydrate * qty
	}

	// Update totals
	tx.Model(&pkg).Updates(map[string]interface{}{
		"total_calories":     totalCalories,
		"total_protein":      totalProtein,
		"total_fat":          totalFat,
		"total_carbohydrate": totalCarb,
	})

	tx.Commit()

	// Reload with items
	database.DB.Preload("Items.Menu").First(&pkg, pkg.ID)

	c.JSON(http.StatusCreated, gin.H{"data": pkg, "message": "Paket makanan berhasil ditambahkan"})
}

// UpdateNutritionPackage updates a package and its items
func UpdateNutritionPackage(c *gin.Context) {
	id := c.Param("id")

	var pkg models.NutritionPackage
	if err := database.DB.First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket makanan tidak ditemukan"})
		return
	}

	var input CreateNutritionPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate diet type
	if _, ok := models.NutritionDietTypeLabels[input.DietType]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis diet tidak valid"})
		return
	}

	// Validate meal time
	if _, ok := models.NutritionMealTimeLabels[input.MealTime]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu makan tidak valid"})
		return
	}

	tx := database.DB.Begin()

	// Update package fields
	updates := map[string]interface{}{
		"name":        input.Name,
		"description": input.Description,
		"diet_type":   input.DietType,
		"meal_time":   input.MealTime,
		"price":       input.Price,
		"is_active":   input.IsActive,
		"notes":       input.Notes,
	}

	if input.Code != "" && input.Code != pkg.Code {
		updates["code"] = input.Code
	}

	if err := tx.Model(&pkg).Updates(updates).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode paket sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate paket makanan"})
		return
	}

	// Replace items: delete old, insert new
	if err := tx.Where("package_id = ?", pkg.ID).Delete(&models.NutritionPackageItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate item paket"})
		return
	}

	var totalCalories, totalProtein, totalFat, totalCarb float64

	for _, item := range input.Items {
		var menu models.NutritionMenu
		if err := tx.First(&menu, item.MenuID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Menu ID %d tidak ditemukan", item.MenuID)})
			return
		}

		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}

		pkgItem := models.NutritionPackageItem{
			PackageID: pkg.ID,
			MenuID:    item.MenuID,
			Quantity:  qty,
			Notes:     item.Notes,
		}

		if err := tx.Create(&pkgItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item paket"})
			return
		}

		totalCalories += menu.Calories * qty
		totalProtein += menu.Protein * qty
		totalFat += menu.Fat * qty
		totalCarb += menu.Carbohydrate * qty
	}

	// Update totals
	tx.Model(&pkg).Updates(map[string]interface{}{
		"total_calories":     totalCalories,
		"total_protein":      totalProtein,
		"total_fat":          totalFat,
		"total_carbohydrate": totalCarb,
	})

	tx.Commit()

	database.DB.Preload("Items.Menu").First(&pkg, pkg.ID)
	c.JSON(http.StatusOK, gin.H{"data": pkg, "message": "Paket makanan berhasil diupdate"})
}

// DeleteNutritionPackage soft-deletes a package
func DeleteNutritionPackage(c *gin.Context) {
	id := c.Param("id")

	var pkg models.NutritionPackage
	if err := database.DB.First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket makanan tidak ditemukan"})
		return
	}

	// Check if package is used in any active order
	var orderCount int64
	database.DB.Model(&models.NutritionOrder{}).
		Where("package_id = ? AND status NOT IN ?", pkg.ID, []string{"cancelled", "delivered"}).
		Count(&orderCount)
	if orderCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paket ini masih digunakan dalam order aktif."})
		return
	}

	tx := database.DB.Begin()

	// Delete package items first
	tx.Where("package_id = ?", pkg.ID).Delete(&models.NutritionPackageItem{})

	// Delete package
	if err := tx.Delete(&pkg).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus paket makanan"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Paket makanan berhasil dihapus"})
}

// ==========================================
// NUTRITION ORDER HANDLERS (Order Gizi Rawat Inap)
// ==========================================

// CreateNutritionOrderInput represents the input for creating a nutrition order
type CreateNutritionOrderInput struct {
	VisitID      uint   `json:"visit_id" binding:"required"`
	MealTime     string `json:"meal_time" binding:"required"`
	DietType     string `json:"diet_type" binding:"required"`
	OrderDate    string `json:"order_date" binding:"required"` // YYYY-MM-DD
	PackageID    *uint  `json:"package_id"`
	AllergyNotes string `json:"allergy_notes"`
	SpecialNotes string `json:"special_notes"`
	Items        []struct {
		MenuID   uint    `json:"menu_id" binding:"required"`
		Quantity float64 `json:"quantity"`
		Notes    string  `json:"notes"`
	} `json:"items"`
}

// GetNutritionOrders returns nutrition orders with filters
func GetNutritionOrders(c *gin.Context) {
	query := database.DB.Model(&models.NutritionOrder{}).
		Preload("Visit.Room").
		Preload("Visit.Registration").
		Preload("Patient").
		Preload("Package").
		Preload("Items.Menu").
		Preload("OrderedBy")

	// Filter by visit
	if visitID := c.Query("visit_id"); visitID != "" {
		query = query.Where("visit_id = ?", visitID)
	}

	// Filter by patient
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}

	// Filter by date
	if date := c.Query("date"); date != "" {
		query = query.Where("DATE(order_date) = ?", date)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by meal_time
	if mealTime := c.Query("meal_time"); mealTime != "" {
		query = query.Where("meal_time = ?", mealTime)
	}

	// Filter by room (for kitchen view)
	if roomName := c.Query("room_name"); roomName != "" {
		query = query.Where("room_name ILIKE ?", "%"+roomName+"%")
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)

	var orders []models.NutritionOrder
	if err := query.Order("order_date DESC, meal_time ASC").
		Offset(offset).Limit(limit).
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat order gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  orders,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNutritionOrder returns a single nutrition order
func GetNutritionOrder(c *gin.Context) {
	id := c.Param("id")

	var order models.NutritionOrder
	if err := database.DB.
		Preload("Visit.Room").
		Preload("Visit.Registration").
		Preload("Patient").
		Preload("Package").
		Preload("Items.Menu").
		Preload("OrderedBy").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order gizi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": order})
}

// CreateNutritionOrder creates a new nutrition order for inpatient
func CreateNutritionOrder(c *gin.Context) {
	var input CreateNutritionOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate meal time
	if _, ok := models.NutritionMealTimeLabels[input.MealTime]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu makan tidak valid"})
		return
	}

	// Validate diet type
	if _, ok := models.NutritionDietTypeLabels[input.DietType]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis diet tidak valid"})
		return
	}

	// Validate visit exists and is inpatient
	var visit models.Visit
	if err := database.DB.Preload("Room").Preload("Registration").Preload("Bed.RoomUnit").First(&visit, input.VisitID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Room == nil || visit.Room.ServiceType != "rawat_inap" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order gizi hanya untuk pasien rawat inap"})
		return
	}

	if visit.Status == "completed" || visit.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sudah pulang/visit sudah selesai"})
		return
	}

	// Parse order date
	orderDate, err := time.Parse("2006-01-02", input.OrderDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid (YYYY-MM-DD)"})
		return
	}

	// Check for duplicate order (same visit, date, meal_time)
	var existingCount int64
	database.DB.Model(&models.NutritionOrder{}).
		Where("visit_id = ? AND DATE(order_date) = ? AND meal_time = ? AND status != 'cancelled'",
			input.VisitID, input.OrderDate, input.MealTime).
		Count(&existingCount)
	if existingCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Order untuk waktu makan ini sudah ada pada tanggal tersebut"})
		return
	}

	// Get patient ID from registration
	var patientID uint
	if visit.Registration != nil {
		patientID = visit.Registration.PatientID
	}

	// Get room & bed name
	// Room = Ruangan (BIR ALI), RoomUnit = Kamar (Bir Ali 1A), Bed = Tempat Tidur (A)
	roomName := ""
	bedName := ""
	if visit.Room != nil {
		roomName = visit.Room.Name
	}
	if visit.Bed != nil {
		// Include kamar name + bed number
		if visit.Bed.RoomUnit != nil {
			bedName = visit.Bed.RoomUnit.Name + " / " + visit.Bed.BedNumber
		} else {
			bedName = visit.Bed.BedNumber
		}
	}

	// Get ordered_by from auth context
	var orderedByID *uint
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uint); ok {
			var emp models.Employee
			if err := database.DB.Where("user_id = ?", uid).First(&emp).Error; err == nil {
				orderedByID = &emp.ID
			}
		}
	}

	tx := database.DB.Begin()

	order := models.NutritionOrder{
		VisitID:      input.VisitID,
		PatientID:    patientID,
		OrderDate:    orderDate,
		MealTime:     input.MealTime,
		DietType:     input.DietType,
		Status:       "confirmed",
		PackageID:    input.PackageID,
		RoomName:     roomName,
		BedName:      bedName,
		OrderedByID:  orderedByID,
		AllergyNotes: input.AllergyNotes,
		SpecialNotes: input.SpecialNotes,
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order gizi"})
		return
	}

	// If using package, copy items from package
	if input.PackageID != nil && *input.PackageID > 0 {
		var pkgItems []models.NutritionPackageItem
		database.DB.Where("package_id = ?", *input.PackageID).Find(&pkgItems)
		for _, pi := range pkgItems {
			orderItem := models.NutritionOrderItem{
				OrderID:  order.ID,
				MenuID:   pi.MenuID,
				Quantity: pi.Quantity,
				Notes:    pi.Notes,
			}
			if err := tx.Create(&orderItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item order"})
				return
			}
		}
	} else if len(input.Items) > 0 {
		// Manual items
		for _, item := range input.Items {
			var menu models.NutritionMenu
			if err := database.DB.First(&menu, item.MenuID).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Menu ID %d tidak ditemukan", item.MenuID)})
				return
			}

			qty := item.Quantity
			if qty <= 0 {
				qty = 1
			}

			orderItem := models.NutritionOrderItem{
				OrderID:  order.ID,
				MenuID:   item.MenuID,
				Quantity: qty,
				Notes:    item.Notes,
			}
			if err := tx.Create(&orderItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan item order"})
				return
			}
		}
	}

	tx.Commit()

	// Reload with full relations
	database.DB.Preload("Patient").Preload("Items.Menu").Preload("Package").Preload("OrderedBy").
		First(&order, order.ID)

	c.JSON(http.StatusCreated, gin.H{"data": order, "message": "Order gizi berhasil dibuat"})
}

// UpdateNutritionOrderStatus updates the status of a nutrition order (for kitchen workflow)
func UpdateNutritionOrderStatus(c *gin.Context) {
	id := c.Param("id")

	var order models.NutritionOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order gizi tidak ditemukan"})
		return
	}

	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate status transitions
	validTransitions := map[string][]string{
		"confirmed": {"preparing", "cancelled"},
		"preparing": {"delivered", "cancelled"},
		"delivered": {},
		"cancelled": {},
		"draft":     {"confirmed", "cancelled"},
	}

	allowed, ok := validTransitions[order.Status]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status order tidak valid"})
		return
	}

	isAllowed := false
	for _, s := range allowed {
		if s == input.Status {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Tidak bisa mengubah status dari '%s' ke '%s'", order.Status, input.Status)})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status": input.Status,
	}

	if input.Status == "preparing" {
		updates["prepared_at"] = &now
	} else if input.Status == "delivered" {
		updates["delivered_at"] = &now
		// Get delivered_by from auth context
		if userID, exists := c.Get("userID"); exists {
			if uid, ok := userID.(uint); ok {
				var emp models.Employee
				if err := database.DB.Where("user_id = ?", uid).First(&emp).Error; err == nil {
					updates["delivered_by_id"] = emp.ID
				}
			}
		}
	}

	if err := database.DB.Model(&order).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate status order"})
		return
	}

	database.DB.Preload("Patient").Preload("Items.Menu").Preload("Package").Preload("OrderedBy").
		First(&order, order.ID)

	c.JSON(http.StatusOK, gin.H{"data": order, "message": "Status order berhasil diupdate"})
}

// DeleteNutritionOrder cancels/deletes a nutrition order
func DeleteNutritionOrder(c *gin.Context) {
	id := c.Param("id")

	var order models.NutritionOrder
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order gizi tidak ditemukan"})
		return
	}

	if order.Status == "delivered" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order yang sudah diantar tidak bisa dihapus"})
		return
	}

	if order.Status == "preparing" {
		// If already preparing, cancel instead of delete
		database.DB.Model(&order).Update("status", "cancelled")
		c.JSON(http.StatusOK, gin.H{"message": "Order gizi berhasil dibatalkan"})
		return
	}

	tx := database.DB.Begin()
	tx.Where("order_id = ?", order.ID).Delete(&models.NutritionOrderItem{})
	if err := tx.Delete(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus order gizi"})
		return
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Order gizi berhasil dihapus"})
}

// GetKitchenDashboard returns orders grouped for kitchen dashboard
func GetKitchenDashboard(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	var orders []models.NutritionOrder
	if err := database.DB.
		Preload("Patient").
		Preload("Items.Menu").
		Preload("Package.Items.Menu").
		Preload("OrderedBy").
		Preload("Visit.Room").
		Preload("Visit.Bed.RoomUnit").
		Where("DATE(order_date) = ? AND status != 'cancelled'", date).
		Order("meal_time ASC, room_name ASC, bed_name ASC").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data dapur"})
		return
	}

	// Count by status
	var stats struct {
		Confirmed int64
		Preparing int64
		Delivered int64
		Total     int64
	}
	database.DB.Model(&models.NutritionOrder{}).Where("DATE(order_date) = ? AND status = 'confirmed'", date).Count(&stats.Confirmed)
	database.DB.Model(&models.NutritionOrder{}).Where("DATE(order_date) = ? AND status = 'preparing'", date).Count(&stats.Preparing)
	database.DB.Model(&models.NutritionOrder{}).Where("DATE(order_date) = ? AND status = 'delivered'", date).Count(&stats.Delivered)
	stats.Total = stats.Confirmed + stats.Preparing + stats.Delivered

	c.JSON(http.StatusOK, gin.H{
		"data":  orders,
		"stats": stats,
		"date":  date,
	})
}
