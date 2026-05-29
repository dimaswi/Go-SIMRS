package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
)

// GetSuppliers returns a list of all suppliers with pagination
func GetSuppliers(c *gin.Context) {
	var suppliers []models.Supplier
	var total int64

	db := database.DB.Model(&models.Supplier{})

	// Search
	if search := c.Query("search"); search != "" {
		searchTerm := "%" + strings.ToLower(search) + "%"
		db = db.Where("LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ?",
			searchTerm, searchTerm, searchTerm, searchTerm)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		isActive := status == "active"
		db = db.Where("is_active = ?", isActive)
	}

	// Count total
	db.Count(&total)

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	// Get data with pagination
	if err := db.Order("name ASC").Offset(offset).Limit(limit).Find(&suppliers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": suppliers,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetSupplier returns a single supplier by ID
func GetSupplier(c *gin.Context) {
	id := c.Param("id")

	var supplier models.Supplier
	if err := database.DB.First(&supplier, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch supplier"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": supplier})
}

// GetAllSuppliers returns all active suppliers for dropdown
func GetAllSuppliers(c *gin.Context) {
	var suppliers []models.Supplier

	if err := database.DB.Where("is_active = ?", true).Order("name ASC").Find(&suppliers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": suppliers})
}

// CreateSupplier creates a new supplier
func CreateSupplier(c *gin.Context) {
	var input struct {
		Name            string `json:"name" binding:"required"`
		Address         string `json:"address"`
		Phone           string `json:"phone"`
		Email           string `json:"email"`
		NPWP            string `json:"npwp"`
		ContactPerson   string `json:"contact_person"`
		ContactPhone    string `json:"contact_phone"`
		BankName        string `json:"bank_name"`
		BankAccount     string `json:"bank_account"`
		BankAccountName string `json:"bank_account_name"`
		Notes           string `json:"notes"`
		IsActive        *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := generateDateCode(&models.Supplier{}, "SUP")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode supplier otomatis"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	supplier := models.Supplier{
		Code:            code,
		Name:            input.Name,
		Address:         input.Address,
		Phone:           input.Phone,
		Email:           input.Email,
		NPWP:            input.NPWP,
		ContactPerson:   input.ContactPerson,
		ContactPhone:    input.ContactPhone,
		BankName:        input.BankName,
		BankAccount:     input.BankAccount,
		BankAccountName: input.BankAccountName,
		Notes:           input.Notes,
		IsActive:        isActive,
	}

	if err := database.DB.Create(&supplier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create supplier"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": supplier, "message": "Supplier berhasil dibuat"})
}

// UpdateSupplier updates an existing supplier
func UpdateSupplier(c *gin.Context) {
	id := c.Param("id")

	var supplier models.Supplier
	if err := database.DB.First(&supplier, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch supplier"})
		return
	}

	var input struct {
		Name            string `json:"name" binding:"required"`
		Address         string `json:"address"`
		Phone           string `json:"phone"`
		Email           string `json:"email"`
		NPWP            string `json:"npwp"`
		ContactPerson   string `json:"contact_person"`
		ContactPhone    string `json:"contact_phone"`
		BankName        string `json:"bank_name"`
		BankAccount     string `json:"bank_account"`
		BankAccountName string `json:"bank_account_name"`
		Notes           string `json:"notes"`
		IsActive        *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	supplier.Name = input.Name
	supplier.Address = input.Address
	supplier.Phone = input.Phone
	supplier.Email = input.Email
	supplier.NPWP = input.NPWP
	supplier.ContactPerson = input.ContactPerson
	supplier.ContactPhone = input.ContactPhone
	supplier.BankName = input.BankName
	supplier.BankAccount = input.BankAccount
	supplier.BankAccountName = input.BankAccountName
	supplier.Notes = input.Notes

	if input.IsActive != nil {
		supplier.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&supplier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update supplier"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": supplier, "message": "Supplier berhasil diperbarui"})
}

// DeleteSupplier deletes a supplier
func DeleteSupplier(c *gin.Context) {
	id := c.Param("id")

	var supplier models.Supplier
	if err := database.DB.First(&supplier, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch supplier"})
		return
	}

	// Check if supplier is being used in purchases
	var purchaseCount int64
	if err := database.DB.Model(&models.Purchase{}).Where("supplier_id = ?", id).Count(&purchaseCount).Error; err == nil {
		if purchaseCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Supplier tidak dapat dihapus karena sudah digunakan dalam pembelian"})
			return
		}
	}

	// Soft delete
	if err := database.DB.Delete(&supplier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete supplier"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Supplier berhasil dihapus"})
}
