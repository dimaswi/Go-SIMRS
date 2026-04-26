package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CategoryResponse represents a category with count
type CategoryResponse struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Count       int64  `json:"count"`
}

// GetMasterDataCategories returns all available categories with counts
func GetMasterDataCategories(c *gin.Context) {
	categories := models.GetAllCategoriesInfo()

	result := make([]CategoryResponse, len(categories))
	for i, cat := range categories {
		var count int64
		database.DB.Model(&models.MasterData{}).
			Where("category = ? AND is_active = ?", cat["code"], true).
			Count(&count)

		result[i] = CategoryResponse{
			Code:        cat["code"],
			Name:        cat["name"],
			Description: cat["description"],
			Count:       count,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetMasterDataByCategory returns master data by category
func GetMasterDataByCategory(c *gin.Context) {
	category := c.Param("category")
	activeOnly := c.Query("active") != "false" // Default to active only

	var data []models.MasterData
	query := database.DB.Where("category = ?", category).Order("sort_order ASC, name ASC")

	if activeOnly {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Find(&data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetMasterData returns a single master data by ID
func GetMasterData(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var data models.MasterData
	if err := database.DB.First(&data, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// CreateMasterData creates a new master data entry
func CreateMasterData(c *gin.Context) {
	var input struct {
		Category    string `json:"category" binding:"required"`
		Code        string `json:"code" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		SortOrder   int    `json:"sort_order"`
		IsActive    *bool  `json:"is_active"`
		IsDefault   bool   `json:"is_default"`
		ParentID    *uint  `json:"parent_id"`
		Metadata    string `json:"metadata"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code in same category
	var existing models.MasterData
	if err := database.DB.Where("category = ? AND code = ?", input.Category, input.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah digunakan dalam kategori ini"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	data := models.MasterData{
		Category:    models.MasterDataCategory(input.Category),
		Code:        input.Code,
		Name:        input.Name,
		Description: input.Description,
		SortOrder:   input.SortOrder,
		IsActive:    isActive,
		IsDefault:   input.IsDefault,
		ParentID:    input.ParentID,
		Metadata:    input.Metadata,
	}

	if err := database.DB.Create(&data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Data berhasil ditambahkan",
		"data":    data,
	})
}

// UpdateMasterData updates an existing master data entry
func UpdateMasterData(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var data models.MasterData
	if err := database.DB.First(&data, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	var input struct {
		Code        string `json:"code"`
		Name        string `json:"name"`
		Description string `json:"description"`
		SortOrder   int    `json:"sort_order"`
		IsActive    *bool  `json:"is_active"`
		IsDefault   bool   `json:"is_default"`
		ParentID    *uint  `json:"parent_id"`
		Metadata    string `json:"metadata"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate code if code is being changed
	if input.Code != "" && input.Code != data.Code {
		var existing models.MasterData
		if err := database.DB.Where("category = ? AND code = ? AND id != ?", data.Category, input.Code, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode sudah digunakan dalam kategori ini"})
			return
		}
		data.Code = input.Code
	}

	if input.Name != "" {
		data.Name = input.Name
	}
	data.Description = input.Description
	data.SortOrder = input.SortOrder
	if input.IsActive != nil {
		data.IsActive = *input.IsActive
	}
	data.IsDefault = input.IsDefault
	data.ParentID = input.ParentID
	data.Metadata = input.Metadata

	if err := database.DB.Save(&data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data berhasil diperbarui",
		"data":    data,
	})
}

// DeleteMasterData soft deletes a master data entry
func DeleteMasterData(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var data models.MasterData
	if err := database.DB.First(&data, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data berhasil dihapus"})
}

// UploadMasterDataImage uploads an image used by master data entries (for example body marker images)
func UploadMasterDataImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".webp": true,
		".svg":  true,
	}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Allowed: png, jpg, jpeg, webp, svg"})
		return
	}

	uploadDir := "./uploads/master-data"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	filename := fmt.Sprintf("master_data_%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"url":     "/uploads/master-data/" + filename,
	})
}

// GetMasterDataMultiple returns multiple categories at once
func GetMasterDataMultiple(c *gin.Context) {
	var input struct {
		Categories []string `json:"categories" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := make(map[string][]models.MasterData)

	for _, category := range input.Categories {
		var data []models.MasterData
		database.DB.Where("category = ? AND is_active = ?", category, true).
			Order("sort_order ASC, name ASC").
			Find(&data)
		result[category] = data
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
