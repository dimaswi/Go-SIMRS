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
	"gorm.io/gorm"
)

const nutritionDietTypeMasterCategory = "nutrition_diet_type"

type NutritionDietTypeInput struct {
	Name        string `json:"name" binding:"required"`
	Code        string `json:"code"`
	Description string `json:"description"`
}

func normalizeDietTypeCode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	replacer := strings.NewReplacer(
		" ", "_",
		"-", "_",
		"/", "_",
		"\\", "_",
		".", "_",
		",", "_",
	)
	value = replacer.Replace(value)
	for strings.Contains(value, "__") {
		value = strings.ReplaceAll(value, "__", "_")
	}
	return strings.Trim(value, "_")
}

func fetchNutritionDietTypeOptions() ([]map[string]string, error) {
	var entries []models.MasterData
	if err := database.DB.
		Where("category = ? AND is_active = ?", nutritionDietTypeMasterCategory, true).
		Order("sort_order ASC, name ASC").
		Find(&entries).Error; err != nil {
		return nil, err
	}

	options := make([]map[string]string, 0)
	for _, entry := range entries {
		code := strings.TrimSpace(entry.Code)
		name := strings.TrimSpace(entry.Name)
		if code == "" || name == "" {
			continue
		}
		options = append(options, map[string]string{"value": code, "label": name})
	}

	if len(options) > 0 {
		return options, nil
	}

	for value, label := range models.NutritionDietTypeLabels {
		options = append(options, map[string]string{"value": value, "label": label})
	}
	return options, nil
}

func isValidNutritionDietType(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	if _, ok := models.NutritionDietTypeLabels[value]; ok {
		return true
	}

	var count int64
	database.DB.Model(&models.MasterData{}).
		Where("category = ? AND is_active = ? AND code = ?", nutritionDietTypeMasterCategory, true, value).
		Count(&count)

	return count > 0
}

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
	result, err := fetchNutritionDietTypeOptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat master jenis diet"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CreateNutritionDietType creates one diet type entry in master data.
func CreateNutritionDietType(c *gin.Context) {
	var input NutritionDietTypeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama jenis diet wajib diisi"})
		return
	}

	code := normalizeDietTypeCode(input.Code)
	if code == "" {
		code = normalizeDietTypeCode(name)
	}
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode jenis diet tidak valid"})
		return
	}

	var exists int64
	database.DB.Model(&models.MasterData{}).
		Where("category = ? AND code = ?", nutritionDietTypeMasterCategory, code).
		Count(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Kode jenis diet sudah digunakan"})
		return
	}

	var maxSort int
	database.DB.Model(&models.MasterData{}).
		Where("category = ?", nutritionDietTypeMasterCategory).
		Select("COALESCE(MAX(sort_order), 0)").
		Scan(&maxSort)

	record := models.MasterData{
		Category:    models.MasterDataCategory(nutritionDietTypeMasterCategory),
		Code:        code,
		Name:        name,
		Description: strings.TrimSpace(input.Description),
		SortOrder:   maxSort + 10,
		IsActive:    true,
		IsDefault:   false,
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambahkan jenis diet"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": map[string]string{
			"value": record.Code,
			"label": record.Name,
		},
		"message": "Jenis diet berhasil ditambahkan",
	})
}

// GetNutritionMealTimes returns available meal times
func GetNutritionMealTimes(c *gin.Context) {
	var result []map[string]string
	for value, label := range models.NutritionMealTimeLabels {
		result = append(result, map[string]string{"value": value, "label": label})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetNutritionIngredientUnits returns available ingredient units
func GetNutritionIngredientUnits(c *gin.Context) {
	var result []map[string]string
	for value, label := range models.NutritionIngredientUnitLabels {
		result = append(result, map[string]string{"value": value, "label": label})
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

type NutritionMenuIngredientInput struct {
	IngredientID     uint    `json:"ingredient_id" binding:"required"`
	WeightPerPortion float64 `json:"weight_per_portion"`
	Unit             string  `json:"unit"`
	Notes            string  `json:"notes"`
}

type NutritionMenuInput struct {
	Code         string                         `json:"code"`
	Name         string                         `json:"name" binding:"required"`
	Description  string                         `json:"description"`
	Category     string                         `json:"category" binding:"required"`
	DietTypes    string                         `json:"diet_types"`
	Calories     float64                        `json:"calories"`
	Protein      float64                        `json:"protein"`
	Fat          float64                        `json:"fat"`
	Carbohydrate float64                        `json:"carbohydrate"`
	Fiber        float64                        `json:"fiber"`
	Sodium       float64                        `json:"sodium"`
	ServingSize  string                         `json:"serving_size"`
	UnitPrice    float64                        `json:"unit_price"`
	IsActive     bool                           `json:"is_active"`
	Notes        string                         `json:"notes"`
	Ingredients  []NutritionMenuIngredientInput `json:"ingredients"`
}

type NutritionIngredientInput struct {
	Code          string  `json:"code"`
	Name          string  `json:"name" binding:"required"`
	Category      string  `json:"category"`
	DefaultUnit   string  `json:"default_unit"`
	DefaultWeight float64 `json:"default_weight"`
	IsActive      bool    `json:"is_active"`
	Notes         string  `json:"notes"`
}

type NutritionIngredientInvoiceItemInput struct {
	IngredientID uint    `json:"ingredient_id" binding:"required"`
	Quantity     float64 `json:"quantity"`
	Unit         string  `json:"unit"`
	UnitPrice    float64 `json:"unit_price"`
	Notes        string  `json:"notes"`
}

type NutritionIngredientInvoiceInput struct {
	InvoiceNumber string                                `json:"invoice_number" binding:"required"`
	InvoiceDate   string                                `json:"invoice_date" binding:"required"` // YYYY-MM-DD
	SupplierName  string                                `json:"supplier_name"`
	Notes         string                                `json:"notes"`
	Items         []NutritionIngredientInvoiceItemInput `json:"items"`
}

func normalizeNutritionIngredientUnit(unit string, fallback string) string {
	unit = strings.TrimSpace(unit)
	if unit == "" {
		unit = strings.TrimSpace(fallback)
	}
	if unit == "" {
		unit = models.NutritionIngredientUnitGram
	}
	return unit
}

func validateNutritionDietTypesJSON(value string) error {
	if value == "" {
		return nil
	}
	var dietTypes []string
	if err := json.Unmarshal([]byte(value), &dietTypes); err != nil {
		return fmt.Errorf("format diet types tidak valid (harus JSON array)")
	}
	return nil
}

func replaceNutritionMenuIngredients(tx *gorm.DB, menuID uint, ingredients []NutritionMenuIngredientInput) error {
	if err := tx.Where("menu_id = ?", menuID).Delete(&models.NutritionMenuIngredient{}).Error; err != nil {
		return fmt.Errorf("gagal menghapus komposisi bahan lama")
	}

	if len(ingredients) == 0 {
		return nil
	}

	usedIngredient := map[uint]bool{}
	for _, input := range ingredients {
		if input.IngredientID == 0 {
			return fmt.Errorf("ingredient_id wajib diisi")
		}
		if usedIngredient[input.IngredientID] {
			return fmt.Errorf("bahan tidak boleh duplikat dalam satu menu")
		}
		usedIngredient[input.IngredientID] = true

		if input.WeightPerPortion < 0 {
			return fmt.Errorf("berat bahan per porsi tidak boleh negatif")
		}

		var ingredient models.NutritionIngredient
		if err := tx.First(&ingredient, input.IngredientID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("bahan ID %d tidak ditemukan", input.IngredientID)
			}
			return fmt.Errorf("gagal memvalidasi bahan")
		}

		unit := normalizeNutritionIngredientUnit(input.Unit, ingredient.DefaultUnit)
		if _, ok := models.NutritionIngredientUnitLabels[unit]; !ok {
			return fmt.Errorf("satuan bahan tidak valid: %s", unit)
		}

		record := models.NutritionMenuIngredient{
			MenuID:           menuID,
			IngredientID:     input.IngredientID,
			WeightPerPortion: input.WeightPerPortion,
			Unit:             unit,
			Notes:            input.Notes,
		}
		if err := tx.Create(&record).Error; err != nil {
			return fmt.Errorf("gagal menyimpan komposisi bahan")
		}
	}

	return nil
}

// ==========================================
// NUTRITION INGREDIENT HANDLERS (Master Bahan)
// ==========================================

// GetNutritionIngredients returns all ingredients with pagination and filters
func GetNutritionIngredients(c *gin.Context) {
	var ingredients []models.NutritionIngredient
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	category := c.Query("category")
	isActive := c.Query("is_active")

	offset := (page - 1) * limit
	query := database.DB.Model(&models.NutritionIngredient{})

	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(code) LIKE ? OR LOWER(name) LIKE ?", searchPattern, searchPattern)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if isActive != "" {
		query = query.Where("is_active = ?", isActive == "true")
	}

	query.Count(&total)
	if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&ingredients).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data bahan gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  ingredients,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNutritionIngredient returns a single ingredient
func GetNutritionIngredient(c *gin.Context) {
	id := c.Param("id")

	var ingredient models.NutritionIngredient
	if err := database.DB.First(&ingredient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bahan gizi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ingredient})
}

// CreateNutritionIngredient creates a new ingredient
func CreateNutritionIngredient(c *gin.Context) {
	var input NutritionIngredientInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := generateDateCode(&models.NutritionIngredient{}, "BAH")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode bahan otomatis"})
		return
	}

	defaultUnit := normalizeNutritionIngredientUnit(input.DefaultUnit, models.NutritionIngredientUnitGram)
	if _, ok := models.NutritionIngredientUnitLabels[defaultUnit]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Satuan bahan tidak valid"})
		return
	}
	if input.DefaultWeight < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Berat default tidak boleh negatif"})
		return
	}

	record := models.NutritionIngredient{
		Code:          code,
		Name:          strings.TrimSpace(input.Name),
		Category:      strings.TrimSpace(input.Category),
		DefaultUnit:   defaultUnit,
		DefaultWeight: input.DefaultWeight,
		IsActive:      input.IsActive,
		Notes:         input.Notes,
	}

	if err := database.DB.Create(&record).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode bahan sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan bahan gizi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": record, "message": "Bahan gizi berhasil ditambahkan"})
}

// UpdateNutritionIngredient updates ingredient data
func UpdateNutritionIngredient(c *gin.Context) {
	id := c.Param("id")

	var ingredient models.NutritionIngredient
	if err := database.DB.First(&ingredient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bahan gizi tidak ditemukan"})
		return
	}

	var input NutritionIngredientInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	defaultUnit := normalizeNutritionIngredientUnit(input.DefaultUnit, ingredient.DefaultUnit)
	if _, ok := models.NutritionIngredientUnitLabels[defaultUnit]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Satuan bahan tidak valid"})
		return
	}
	if input.DefaultWeight < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Berat default tidak boleh negatif"})
		return
	}

	updates := map[string]interface{}{
		"name":           strings.TrimSpace(input.Name),
		"category":       strings.TrimSpace(input.Category),
		"default_unit":   defaultUnit,
		"default_weight": input.DefaultWeight,
		"is_active":      input.IsActive,
		"notes":          input.Notes,
	}
	if err := database.DB.Model(&ingredient).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate bahan gizi"})
		return
	}

	database.DB.First(&ingredient, id)
	c.JSON(http.StatusOK, gin.H{"data": ingredient, "message": "Bahan gizi berhasil diupdate"})
}

// DeleteNutritionIngredient soft-deletes ingredient
func DeleteNutritionIngredient(c *gin.Context) {
	id := c.Param("id")

	var ingredient models.NutritionIngredient
	if err := database.DB.First(&ingredient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bahan gizi tidak ditemukan"})
		return
	}

	var usageCount int64
	database.DB.Model(&models.NutritionMenuIngredient{}).Where("ingredient_id = ?", ingredient.ID).Count(&usageCount)
	if usageCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bahan ini masih dipakai pada komposisi menu."})
		return
	}

	if err := database.DB.Delete(&ingredient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus bahan gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Bahan gizi berhasil dihapus"})
}

func replaceNutritionIngredientInvoiceItems(tx *gorm.DB, invoiceID uint, items []NutritionIngredientInvoiceItemInput) (float64, error) {
	if err := tx.Where("invoice_id = ?", invoiceID).Delete(&models.NutritionIngredientInvoiceItem{}).Error; err != nil {
		return 0, fmt.Errorf("gagal menghapus item faktur lama")
	}

	if len(items) == 0 {
		return 0, fmt.Errorf("minimal 1 item bahan wajib diisi")
	}

	usedIngredient := map[uint]bool{}
	totalAmount := 0.0

	for _, input := range items {
		if input.IngredientID == 0 {
			return 0, fmt.Errorf("ingredient_id wajib diisi")
		}
		if usedIngredient[input.IngredientID] {
			return 0, fmt.Errorf("bahan tidak boleh duplikat dalam satu faktur")
		}
		usedIngredient[input.IngredientID] = true

		if input.Quantity <= 0 {
			return 0, fmt.Errorf("jumlah bahan harus lebih dari 0")
		}
		if input.UnitPrice < 0 {
			return 0, fmt.Errorf("harga satuan tidak boleh negatif")
		}

		var ingredient models.NutritionIngredient
		if err := tx.First(&ingredient, input.IngredientID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return 0, fmt.Errorf("bahan ID %d tidak ditemukan", input.IngredientID)
			}
			return 0, fmt.Errorf("gagal memvalidasi bahan")
		}

		unit := strings.TrimSpace(input.Unit)
		if unit == "" {
			unit = "kemasan"
		}
		unitWeight := ingredient.DefaultWeight
		weightUnit := normalizeNutritionIngredientUnit(ingredient.DefaultUnit, models.NutritionIngredientUnitGram)
		if _, ok := models.NutritionIngredientUnitLabels[unit]; !ok {
			if unit != "kemasan" && unit != "pcs" && unit != "bungkus" && unit != "pack" && unit != "box" {
				return 0, fmt.Errorf("satuan kemasan tidak valid: %s", unit)
			}
		}

		lineTotal := input.Quantity * input.UnitPrice
		totalWeight := input.Quantity * unitWeight
		record := models.NutritionIngredientInvoiceItem{
			InvoiceID:    invoiceID,
			IngredientID: input.IngredientID,
			Quantity:     input.Quantity,
			Unit:         unit,
			UnitWeight:   unitWeight,
			WeightUnit:   weightUnit,
			TotalWeight:  totalWeight,
			UnitPrice:    input.UnitPrice,
			LineTotal:    lineTotal,
			Notes:        strings.TrimSpace(input.Notes),
		}
		if err := tx.Create(&record).Error; err != nil {
			return 0, fmt.Errorf("gagal menyimpan item faktur")
		}
		totalAmount += lineTotal
	}

	return totalAmount, nil
}

// ==========================================
// NUTRITION INGREDIENT INVOICE HANDLERS (Input Faktur Bahan)
// ==========================================

// GetNutritionIngredientInvoices returns all ingredient invoices with pagination and search.
func GetNutritionIngredientInvoices(c *gin.Context) {
	var invoices []models.NutritionIngredientInvoice
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	startDate := strings.TrimSpace(c.Query("start_date"))
	endDate := strings.TrimSpace(c.Query("end_date"))

	offset := (page - 1) * limit
	query := database.DB.Model(&models.NutritionIngredientInvoice{})

	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(code) LIKE ? OR LOWER(invoice_number) LIKE ? OR LOWER(supplier_name) LIKE ?",
			searchPattern, searchPattern, searchPattern,
		)
	}
	if startDate != "" {
		if _, err := time.Parse("2006-01-02", startDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format start_date tidak valid (YYYY-MM-DD)"})
			return
		}
		query = query.Where("DATE(invoice_date) >= ?", startDate)
	}
	if endDate != "" {
		if _, err := time.Parse("2006-01-02", endDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format end_date tidak valid (YYYY-MM-DD)"})
			return
		}
		query = query.Where("DATE(invoice_date) <= ?", endDate)
	}

	query.Count(&total)
	if err := query.
		Preload("ReceivedBy").
		Preload("Items").
		Order("invoice_date DESC, created_at DESC").
		Offset(offset).Limit(limit).
		Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data faktur bahan gizi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  invoices,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetNutritionIngredientInvoice returns a single ingredient invoice.
func GetNutritionIngredientInvoice(c *gin.Context) {
	id := c.Param("id")

	var invoice models.NutritionIngredientInvoice
	if err := database.DB.
		Preload("ReceivedBy").
		Preload("Items.Ingredient").
		First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faktur bahan gizi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": invoice})
}

// CreateNutritionIngredientInvoice creates a new ingredient invoice entry.
func CreateNutritionIngredientInvoice(c *gin.Context) {
	var input NutritionIngredientInvoiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invoiceNumber := strings.TrimSpace(input.InvoiceNumber)
	if invoiceNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor faktur wajib diisi"})
		return
	}

	invoiceDate, err := time.Parse("2006-01-02", input.InvoiceDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal faktur tidak valid (YYYY-MM-DD)"})
		return
	}

	code, err := generateDateCode(&models.NutritionIngredientInvoice{}, "NFI")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode faktur otomatis"})
		return
	}

	var receivedByID *uint
	if userID, exists := c.Get("userID"); exists {
		if uid, ok := userID.(uint); ok {
			var emp models.Employee
			if err := database.DB.Where("user_id = ?", uid).First(&emp).Error; err == nil {
				receivedByID = &emp.ID
			}
		}
	}

	tx := database.DB.Begin()
	invoice := models.NutritionIngredientInvoice{
		Code:          code,
		InvoiceNumber: invoiceNumber,
		InvoiceDate:   invoiceDate,
		SupplierName:  strings.TrimSpace(input.SupplierName),
		ReceivedByID:  receivedByID,
		Notes:         strings.TrimSpace(input.Notes),
		TotalAmount:   0,
	}

	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode faktur internal sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan faktur bahan gizi"})
		return
	}

	totalAmount, err := replaceNutritionIngredientInvoiceItems(tx, invoice.ID, input.Items)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Model(&invoice).Update("total_amount", totalAmount).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung total faktur"})
		return
	}

	tx.Commit()

	database.DB.Preload("ReceivedBy").Preload("Items.Ingredient").First(&invoice, invoice.ID)
	c.JSON(http.StatusCreated, gin.H{"data": invoice, "message": "Faktur bahan gizi berhasil ditambahkan"})
}

// UpdateNutritionIngredientInvoice updates ingredient invoice and items.
func UpdateNutritionIngredientInvoice(c *gin.Context) {
	id := c.Param("id")

	var invoice models.NutritionIngredientInvoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faktur bahan gizi tidak ditemukan"})
		return
	}

	var input NutritionIngredientInvoiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invoiceNumber := strings.TrimSpace(input.InvoiceNumber)
	if invoiceNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor faktur wajib diisi"})
		return
	}

	invoiceDate, err := time.Parse("2006-01-02", input.InvoiceDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal faktur tidak valid (YYYY-MM-DD)"})
		return
	}

	tx := database.DB.Begin()
	updates := map[string]interface{}{
		"invoice_number": invoiceNumber,
		"invoice_date":   invoiceDate,
		"supplier_name":  strings.TrimSpace(input.SupplierName),
		"notes":          strings.TrimSpace(input.Notes),
	}
	if err := tx.Model(&invoice).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate data faktur bahan"})
		return
	}

	totalAmount, err := replaceNutritionIngredientInvoiceItems(tx, invoice.ID, input.Items)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Model(&invoice).Update("total_amount", totalAmount).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung total faktur"})
		return
	}

	tx.Commit()

	database.DB.Preload("ReceivedBy").Preload("Items.Ingredient").First(&invoice, invoice.ID)
	c.JSON(http.StatusOK, gin.H{"data": invoice, "message": "Faktur bahan gizi berhasil diupdate"})
}

// DeleteNutritionIngredientInvoice soft-deletes ingredient invoice and its items.
func DeleteNutritionIngredientInvoice(c *gin.Context) {
	id := c.Param("id")

	var invoice models.NutritionIngredientInvoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Faktur bahan gizi tidak ditemukan"})
		return
	}

	tx := database.DB.Begin()
	if err := tx.Where("invoice_id = ?", invoice.ID).Delete(&models.NutritionIngredientInvoiceItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item faktur"})
		return
	}
	if err := tx.Delete(&invoice).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus faktur bahan"})
		return
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Faktur bahan gizi berhasil dihapus"})
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

	if err := query.
		Preload("Ingredients.Ingredient").
		Order("name ASC").
		Offset(offset).Limit(limit).
		Find(&menus).Error; err != nil {
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
	if err := database.DB.
		Preload("Ingredients.Ingredient").
		First(&menu, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu gizi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": menu})
}

// CreateNutritionMenu creates a new nutrition menu
func CreateNutritionMenu(c *gin.Context) {
	var input NutritionMenuInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := generateDateCode(&models.NutritionMenu{}, "MNU")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode menu otomatis"})
		return
	}

	// Validate category
	if _, ok := models.NutritionCategoryLabels[input.Category]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kategori menu tidak valid"})
		return
	}

	// Validate diet_types JSON
	if err := validateNutritionDietTypesJSON(input.DietTypes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	menu := models.NutritionMenu{
		Code:         code,
		Name:         strings.TrimSpace(input.Name),
		Description:  input.Description,
		Category:     input.Category,
		DietTypes:    input.DietTypes,
		Calories:     input.Calories,
		Protein:      input.Protein,
		Fat:          input.Fat,
		Carbohydrate: input.Carbohydrate,
		Fiber:        input.Fiber,
		Sodium:       input.Sodium,
		ServingSize:  input.ServingSize,
		UnitPrice:    input.UnitPrice,
		IsActive:     input.IsActive,
		Notes:        input.Notes,
	}

	if err := tx.Create(&menu).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode menu sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan menu gizi"})
		return
	}

	if err := replaceNutritionMenuIngredients(tx, menu.ID, input.Ingredients); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	database.DB.Preload("Ingredients.Ingredient").First(&menu, menu.ID)
	c.JSON(http.StatusCreated, gin.H{"data": menu, "message": "Menu gizi berhasil ditambahkan"})
}

// UpdateNutritionMenu updates an existing nutrition menu
func UpdateNutritionMenu(c *gin.Context) {
	id := c.Param("id")

	var menu models.NutritionMenu
	if err := database.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Menu gizi tidak ditemukan"})
		return
	}

	var input NutritionMenuInput
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
	if err := validateNutritionDietTypesJSON(input.DietTypes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	// Update fields
	updates := map[string]interface{}{
		"name":         strings.TrimSpace(input.Name),
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

	if err := tx.Model(&menu).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate menu gizi"})
		return
	}

	if err := replaceNutritionMenuIngredients(tx, menu.ID, input.Ingredients); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	database.DB.Preload("Ingredients.Ingredient").First(&menu, id)
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

	database.DB.Where("menu_id = ?", menu.ID).Delete(&models.NutritionMenuIngredient{})

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
		Preload("Items.Menu.Ingredients.Ingredient").
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
	if err := database.DB.Preload("Items.Menu.Ingredients.Ingredient").First(&pkg, id).Error; err != nil {
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
	if !isValidNutritionDietType(input.DietType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Jenis diet tidak valid"})
		return
	}

	// Validate meal time
	if _, ok := models.NutritionMealTimeLabels[input.MealTime]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu makan tidak valid"})
		return
	}

	code, err := generateDateCode(&models.NutritionPackage{}, "PKT")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode paket otomatis"})
		return
	}

	tx := database.DB.Begin()

	// Create package
	pkg := models.NutritionPackage{
		Code:        code,
		Name:        input.Name,
		Description: input.Description,
		DietType:    input.DietType,
		MealTime:    input.MealTime,
		Price:       0,
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
	database.DB.Preload("Items.Menu.Ingredients.Ingredient").First(&pkg, pkg.ID)

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
	if !isValidNutritionDietType(input.DietType) {
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
		"price":       0,
		"is_active":   input.IsActive,
		"notes":       input.Notes,
	}

	if err := tx.Model(&pkg).Updates(updates).Error; err != nil {
		tx.Rollback()
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

	database.DB.Preload("Items.Menu.Ingredients.Ingredient").First(&pkg, pkg.ID)
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
		Preload("Items.Menu.Ingredients.Ingredient").
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
		Preload("Items.Menu.Ingredients.Ingredient").
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
	if !isValidNutritionDietType(input.DietType) {
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
	database.DB.Preload("Patient").Preload("Items.Menu.Ingredients.Ingredient").Preload("Package").Preload("OrderedBy").
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

	database.DB.Preload("Patient").Preload("Items.Menu.Ingredients.Ingredient").Preload("Package").Preload("OrderedBy").
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

// GetNutritionIngredientUsageReport returns aggregated ingredient usage from nutrition orders.
func GetNutritionIngredientUsageReport(c *gin.Context) {
	startDate := strings.TrimSpace(c.Query("start_date"))
	endDate := strings.TrimSpace(c.Query("end_date"))
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	if endDate == "" {
		endDate = startDate
	}

	if _, err := time.Parse("2006-01-02", startDate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format start_date tidak valid (YYYY-MM-DD)"})
		return
	}
	if _, err := time.Parse("2006-01-02", endDate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format end_date tidak valid (YYYY-MM-DD)"})
		return
	}

	statusParam := strings.TrimSpace(c.Query("status"))
	statuses := []string{"delivered"}
	if statusParam != "" {
		raw := strings.Split(statusParam, ",")
		statuses = make([]string, 0, len(raw))
		for _, item := range raw {
			item = strings.TrimSpace(item)
			if item != "" {
				statuses = append(statuses, item)
			}
		}
		if len(statuses) == 0 {
			statuses = []string{"delivered"}
		}
	}

	mealTime := strings.TrimSpace(c.Query("meal_time"))
	dietType := strings.TrimSpace(c.Query("diet_type"))
	roomName := strings.TrimSpace(c.Query("room_name"))

	query := database.DB.
		Table("nutrition_orders AS no").
		Select(`
			ni.id AS ingredient_id,
			ni.code AS ingredient_code,
			ni.name AS ingredient_name,
			ni.category AS ingredient_category,
			nmi.unit AS unit,
			COALESCE(SUM(noi.quantity * nmi.weight_per_portion), 0) AS total_usage
		`).
		Joins("JOIN nutrition_order_items AS noi ON noi.order_id = no.id").
		Joins("JOIN nutrition_menu_ingredients AS nmi ON nmi.menu_id = noi.menu_id").
		Joins("JOIN nutrition_ingredients AS ni ON ni.id = nmi.ingredient_id").
		Where("DATE(no.order_date) BETWEEN ? AND ?", startDate, endDate).
		Where("no.status IN ?", statuses).
		Where("no.deleted_at IS NULL").
		Where("noi.deleted_at IS NULL").
		Where("nmi.deleted_at IS NULL").
		Where("ni.deleted_at IS NULL")

	if mealTime != "" {
		query = query.Where("no.meal_time = ?", mealTime)
	}
	if dietType != "" {
		query = query.Where("no.diet_type = ?", dietType)
	}
	if roomName != "" {
		query = query.Where("LOWER(no.room_name) LIKE ?", "%"+strings.ToLower(roomName)+"%")
	}

	type ingredientUsageRow struct {
		IngredientID       uint    `json:"ingredient_id"`
		IngredientCode     string  `json:"ingredient_code"`
		IngredientName     string  `json:"ingredient_name"`
		IngredientCategory string  `json:"ingredient_category"`
		Unit               string  `json:"unit"`
		TotalUsage         float64 `json:"total_usage"`
	}

	var rows []ingredientUsageRow
	if err := query.
		Group("ni.id, ni.code, ni.name, ni.category, nmi.unit").
		Order("ni.name ASC, nmi.unit ASC").
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat laporan penggunaan bahan"})
		return
	}

	type reportSummary struct {
		Rows        int      `json:"rows"`
		Statuses    []string `json:"statuses"`
		StartDate   string   `json:"start_date"`
		EndDate     string   `json:"end_date"`
		MealTime    string   `json:"meal_time,omitempty"`
		DietType    string   `json:"diet_type,omitempty"`
		RoomName    string   `json:"room_name,omitempty"`
		GeneratedAt string   `json:"generated_at"`
	}

	summary := reportSummary{
		Rows:        len(rows),
		Statuses:    statuses,
		StartDate:   startDate,
		EndDate:     endDate,
		MealTime:    mealTime,
		DietType:    dietType,
		RoomName:    roomName,
		GeneratedAt: time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    rows,
		"summary": summary,
	})
}

// GetKitchenDashboard returns orders grouped for kitchen dashboard
func GetKitchenDashboard(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	var orders []models.NutritionOrder
	if err := database.DB.
		Preload("Patient").
		Preload("Items.Menu.Ingredients.Ingredient").
		Preload("Package.Items.Menu.Ingredients.Ingredient").
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
