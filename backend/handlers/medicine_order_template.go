package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func getCurrentEmployeeID(c *gin.Context) (uint, error) {
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == nil {
		return 0, errors.New("user not authenticated")
	}

	userID := userIDVal.(uint)
	var user models.User
	if err := database.DB.Preload("Employee").First(&user, userID).Error; err != nil {
		return 0, errors.New("user not found")
	}
	if user.EmployeeID == nil || *user.EmployeeID == 0 {
		return 0, errors.New("user is not linked to an employee")
	}

	return *user.EmployeeID, nil
}

// GetDoctorMedicineTemplates returns templates owned by current doctor account.
// If source_visit_id is provided, templates scoped to that visit's DPJP are included.
func GetDoctorMedicineTemplates(c *gin.Context) {
	employeeID, err := getCurrentEmployeeID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	query := database.DB.Model(&models.DoctorMedicineTemplate{}).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		Preload("Items.Medicine").
		Where("owner_employee_id = ?", employeeID)

	includeInactive := strings.EqualFold(c.DefaultQuery("include_inactive", "false"), "true")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	if visitIDRaw := c.Query("source_visit_id"); visitIDRaw != "" {
		visitID, convErr := strconv.Atoi(visitIDRaw)
		if convErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "source_visit_id tidak valid"})
			return
		}

		var visit models.Visit
		if err := database.DB.Select("id", "doctor_id").First(&visit, uint(visitID)).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "visit tidak ditemukan"})
			return
		}

		if visit.DoctorID != nil && *visit.DoctorID > 0 {
			query = query.Where("dpjp_employee_id IS NULL OR dpjp_employee_id = ?", *visit.DoctorID)
		} else {
			query = query.Where("dpjp_employee_id IS NULL")
		}
	}

	var templates []models.DoctorMedicineTemplate
	if err := query.Order("updated_at DESC, id DESC").Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": templates})
}

func CreateDoctorMedicineTemplate(c *gin.Context) {
	employeeID, err := getCurrentEmployeeID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var input struct {
		Name          string `json:"name" binding:"required"`
		Notes         string `json:"notes"`
		SourceVisitID *uint  `json:"source_visit_id"`
		BindToDPJP    bool   `json:"bind_to_dpjp"`
		Items         []struct {
			MedicineID   uint   `json:"medicine_id" binding:"required"`
			Quantity     int    `json:"quantity"`
			Unit         string `json:"unit"`
			Dosage       string `json:"dosage"`
			Frequency    string `json:"frequency"`
			Route        string `json:"route"`
			Duration     string `json:"duration"`
			Instructions string `json:"instructions"`
			Notes        string `json:"notes"`
			SortOrder    int    `json:"sort_order"`
		} `json:"items" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	templateName := strings.TrimSpace(input.Name)
	if templateName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nama template wajib diisi"})
		return
	}

	var dpjpEmployeeID *uint
	if input.BindToDPJP {
		if input.SourceVisitID == nil || *input.SourceVisitID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "source_visit_id wajib diisi saat bind_to_dpjp aktif"})
			return
		}

		var visit models.Visit
		if err := database.DB.Select("id", "doctor_id").First(&visit, *input.SourceVisitID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "visit tidak ditemukan"})
			return
		}
		if visit.DoctorID == nil || *visit.DoctorID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "DPJP pada visit belum tersedia"})
			return
		}
		dpjpEmployeeID = visit.DoctorID
	}

	tx := database.DB.Begin()

	template := models.DoctorMedicineTemplate{
		Name:            templateName,
		Notes:           strings.TrimSpace(input.Notes),
		OwnerEmployeeID: employeeID,
		DpjpEmployeeID:  dpjpEmployeeID,
		IsActive:        true,
	}
	if err := tx.Create(&template).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for idx, item := range input.Items {
		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}

		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = idx + 1
		}

		templateItem := models.DoctorMedicineTemplateItem{
			TemplateID:   template.ID,
			MedicineID:   item.MedicineID,
			Quantity:     qty,
			Unit:         strings.TrimSpace(item.Unit),
			Dosage:       strings.TrimSpace(item.Dosage),
			Frequency:    strings.TrimSpace(item.Frequency),
			Route:        strings.TrimSpace(item.Route),
			Duration:     strings.TrimSpace(item.Duration),
			Instructions: strings.TrimSpace(item.Instructions),
			Notes:        strings.TrimSpace(item.Notes),
			SortOrder:    sortOrder,
		}

		if err := tx.Create(&templateItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }).
		Preload("Items.Medicine").
		First(&template, template.ID)

	c.JSON(http.StatusCreated, gin.H{"data": template})
}

func UpdateDoctorMedicineTemplate(c *gin.Context) {
	employeeID, err := getCurrentEmployeeID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	templateID := c.Param("id")
	var template models.DoctorMedicineTemplate
	if err := database.DB.Where("id = ? AND owner_employee_id = ?", templateID, employeeID).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template tidak ditemukan"})
		return
	}

	var input struct {
		Name     string `json:"name"`
		Notes    string `json:"notes"`
		IsActive *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if strings.TrimSpace(input.Name) != "" {
		updates["name"] = strings.TrimSpace(input.Name)
	}
	if input.Notes != "" {
		updates["notes"] = strings.TrimSpace(input.Notes)
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tidak ada perubahan"})
		return
	}

	if err := database.DB.Model(&template).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }).
		Preload("Items.Medicine").
		First(&template, template.ID)

	c.JSON(http.StatusOK, gin.H{"data": template})
}

func DeleteDoctorMedicineTemplate(c *gin.Context) {
	employeeID, err := getCurrentEmployeeID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	templateID := c.Param("id")
	if err := database.DB.Where("id = ? AND owner_employee_id = ?", templateID, employeeID).Delete(&models.DoctorMedicineTemplate{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "template berhasil dihapus"})
}
