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
)

type clinicalPackageProcedureItemInput struct {
	ProcedureID uint   `json:"procedure_id" binding:"required"`
	SortOrder   int    `json:"sort_order"`
	Notes       string `json:"notes"`
}

type clinicalPackageMedicineItemInput struct {
	MedicineID   uint   `json:"medicine_id" binding:"required"`
	Quantity     int    `json:"quantity"`
	Unit         string `json:"unit"`
	Dosage       string `json:"dosage"`
	Frequency    string `json:"frequency"`
	Route        string `json:"route"`
	Duration     string `json:"duration"`
	Instructions string `json:"instructions"`
	SortOrder    int    `json:"sort_order"`
	Notes        string `json:"notes"`
}

type createClinicalPackageInput struct {
	Code           string                              `json:"code"`
	Name           string                              `json:"name" binding:"required"`
	Description    string                              `json:"description"`
	IsActive       *bool                               `json:"is_active"`
	Notes          string                              `json:"notes"`
	ProcedureItems []clinicalPackageProcedureItemInput `json:"procedure_items"`
	MedicineItems  []clinicalPackageMedicineItemInput  `json:"medicine_items"`
}

type createRoomClinicalPackageInput struct {
	ClinicalPackageID uint   `json:"clinical_package_id" binding:"required"`
	IsActive          *bool  `json:"is_active"`
	Notes             string `json:"notes"`
}

func clinicalPackagePreloads(db *gorm.DB) *gorm.DB {
	return db.
		Preload("ProcedureItems", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		Preload("ProcedureItems.Procedure").
		Preload("ProcedureItems.Procedure.Tariffs").
		Preload("MedicineItems", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		Preload("MedicineItems.Medicine")
}

func roomClinicalPackagePreloads(db *gorm.DB) *gorm.DB {
	return db.
		Preload("ClinicalPackage").
		Preload("ClinicalPackage.ProcedureItems", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		Preload("ClinicalPackage.ProcedureItems.Procedure").
		Preload("ClinicalPackage.ProcedureItems.Procedure.Tariffs").
		Preload("ClinicalPackage.MedicineItems", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("sort_order ASC, id ASC")
		}).
		Preload("ClinicalPackage.MedicineItems.Medicine")
}

func GetClinicalPackages(c *gin.Context) {
	var packages []models.ClinicalPackage

	query := database.DB.Model(&models.ClinicalPackage{})

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		query = query.Where("clinical_packages.code ILIKE ? OR clinical_packages.name ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if isActive := c.Query("is_active"); isActive != "" {
		if value, err := strconv.ParseBool(isActive); err == nil {
			query = query.Where("clinical_packages.is_active = ?", value)
		}
	}

	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Joins("JOIN room_clinical_packages ON room_clinical_packages.clinical_package_id = clinical_packages.id").
			Where("room_clinical_packages.room_id = ?", roomID)
		if assignedOnly := c.Query("assigned_active_only"); assignedOnly != "" {
			if value, err := strconv.ParseBool(assignedOnly); err == nil && value {
				query = query.Where("room_clinical_packages.is_active = ?", true)
			}
		}
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	query.Count(&total)

	if err := clinicalPackagePreloads(query.Order("clinical_packages.created_at DESC")).Offset(offset).Limit(limit).Find(&packages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": packages,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

func GetClinicalPackage(c *gin.Context) {
	id := c.Param("id")
	var pkg models.ClinicalPackage

	if err := clinicalPackagePreloads(database.DB).First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket klinis tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pkg})
}

func CreateClinicalPackage(c *gin.Context) {
	var input createClinicalPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code := strings.TrimSpace(input.Code)
	if code == "" {
		var lastPkg models.ClinicalPackage
		prefix := "CP" + time.Now().Format("060102")
		if err := database.DB.Where("code LIKE ?", prefix+"%").Order("code DESC").First(&lastPkg).Error; err != nil {
			code = prefix + "001"
		} else {
			var lastNum int
			fmt.Sscanf(lastPkg.Code, prefix+"%d", &lastNum)
			code = fmt.Sprintf("%s%03d", prefix, lastNum+1)
		}
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	tx := database.DB.Begin()
	pkg := models.ClinicalPackage{
		Code:        code,
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		IsActive:    isActive,
		Notes:       strings.TrimSpace(input.Notes),
	}

	if err := tx.Create(&pkg).Error; err != nil {
		tx.Rollback()
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode paket sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan paket klinis"})
		return
	}

	if err := saveClinicalPackageItems(tx, pkg.ID, input.ProcedureItems, input.MedicineItems); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()
	database.DB.Preload("RoomAssignments").First(&pkg, pkg.ID)
	clinicalPackagePreloads(database.DB).First(&pkg, pkg.ID)
	c.JSON(http.StatusCreated, gin.H{"data": pkg, "message": "Paket klinis berhasil ditambahkan"})
}

func UpdateClinicalPackage(c *gin.Context) {
	id := c.Param("id")
	var pkg models.ClinicalPackage
	if err := database.DB.First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket klinis tidak ditemukan"})
		return
	}

	var input createClinicalPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"name":        strings.TrimSpace(input.Name),
		"description": strings.TrimSpace(input.Description),
		"notes":       strings.TrimSpace(input.Notes),
	}
	if input.Code != "" {
		updates["code"] = strings.TrimSpace(input.Code)
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}

	tx := database.DB.Begin()
	if err := tx.Model(&pkg).Updates(updates).Error; err != nil {
		tx.Rollback()
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Kode paket sudah digunakan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate paket klinis"})
		return
	}

	if err := tx.Where("package_id = ?", pkg.ID).Delete(&models.ClinicalPackageProcedureItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item tindakan paket"})
		return
	}
	if err := tx.Where("package_id = ?", pkg.ID).Delete(&models.ClinicalPackageMedicineItem{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus item obat paket"})
		return
	}

	if err := saveClinicalPackageItems(tx, pkg.ID, input.ProcedureItems, input.MedicineItems); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()
	clinicalPackagePreloads(database.DB).First(&pkg, pkg.ID)
	c.JSON(http.StatusOK, gin.H{"data": pkg, "message": "Paket klinis berhasil diupdate"})
}

func DeleteClinicalPackage(c *gin.Context) {
	id := c.Param("id")
	var pkg models.ClinicalPackage
	if err := database.DB.First(&pkg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket klinis tidak ditemukan"})
		return
	}

	var assignmentCount int64
	database.DB.Model(&models.RoomClinicalPackage{}).Where("clinical_package_id = ?", pkg.ID).Count(&assignmentCount)
	if assignmentCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paket masih di-assign ke ruangan. Lepaskan assignment terlebih dahulu."})
		return
	}

	tx := database.DB.Begin()
	tx.Where("package_id = ?", pkg.ID).Delete(&models.ClinicalPackageProcedureItem{})
	tx.Where("package_id = ?", pkg.ID).Delete(&models.ClinicalPackageMedicineItem{})
	if err := tx.Delete(&pkg).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus paket klinis"})
		return
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Paket klinis berhasil dihapus"})
}

func GetRoomClinicalPackages(c *gin.Context) {
	roomID := c.Param("id")
	var assignments []models.RoomClinicalPackage

	query := database.DB.Model(&models.RoomClinicalPackage{}).
		Where("room_clinical_packages.room_id = ?", roomID)
	if isActive := c.Query("is_active"); isActive != "" {
		if value, err := strconv.ParseBool(isActive); err == nil {
			query = query.Where("room_clinical_packages.is_active = ?", value)
		}
	}
	if packageActiveOnly := c.Query("package_active_only"); packageActiveOnly != "" {
		if value, err := strconv.ParseBool(packageActiveOnly); err == nil && value {
			query = query.Joins("JOIN clinical_packages ON clinical_packages.id = room_clinical_packages.clinical_package_id").
				Where("clinical_packages.is_active = ?", true)
		}
	}

	if err := roomClinicalPackagePreloads(query.Order("room_clinical_packages.created_at DESC")).Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assignments})
}

func AssignClinicalPackageToRoom(c *gin.Context) {
	roomID := c.Param("id")
	roomIDUint, _ := strconv.ParseUint(roomID, 10, 64)

	var input createRoomClinicalPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var pkg models.ClinicalPackage
	if err := database.DB.First(&pkg, input.ClinicalPackageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Paket klinis tidak ditemukan"})
		return
	}

	var existing models.RoomClinicalPackage
	if err := database.DB.Where("room_id = ? AND clinical_package_id = ?", roomID, input.ClinicalPackageID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paket klinis sudah ditambahkan ke ruangan ini"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	assignment := models.RoomClinicalPackage{
		RoomID:            uint(roomIDUint),
		ClinicalPackageID: input.ClinicalPackageID,
		IsActive:          isActive,
		Notes:             strings.TrimSpace(input.Notes),
	}

	if err := database.DB.Create(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal meng-assign paket klinis ke ruangan"})
		return
	}

	roomClinicalPackagePreloads(database.DB).First(&assignment, assignment.ID)
	c.JSON(http.StatusCreated, gin.H{"data": assignment, "message": "Paket klinis berhasil ditambahkan ke ruangan"})
}

func UpdateRoomClinicalPackage(c *gin.Context) {
	roomID := c.Param("id")
	assignmentID := c.Param("assignmentId")

	var assignment models.RoomClinicalPackage
	if err := database.DB.Where("id = ? AND room_id = ?", assignmentID, roomID).First(&assignment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment paket klinis tidak ditemukan"})
		return
	}

	var input createRoomClinicalPackageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"notes": strings.TrimSpace(input.Notes),
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}

	if err := database.DB.Model(&assignment).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate assignment paket klinis"})
		return
	}

	roomClinicalPackagePreloads(database.DB).First(&assignment, assignment.ID)
	c.JSON(http.StatusOK, gin.H{"data": assignment, "message": "Assignment paket klinis berhasil diupdate"})
}

func DeleteRoomClinicalPackage(c *gin.Context) {
	roomID := c.Param("id")
	assignmentID := c.Param("assignmentId")

	var assignment models.RoomClinicalPackage
	if err := database.DB.Where("id = ? AND room_id = ?", assignmentID, roomID).First(&assignment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment paket klinis tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus assignment paket klinis"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assignment paket klinis berhasil dihapus"})
}

func saveClinicalPackageItems(tx *gorm.DB, packageID uint, procedureItems []clinicalPackageProcedureItemInput, medicineItems []clinicalPackageMedicineItemInput) error {
	for index, item := range procedureItems {
		var procedure models.Procedure
		if err := tx.Where("id = ? AND is_active = ?", item.ProcedureID, true).First(&procedure).Error; err != nil {
			return fmt.Errorf("tindakan ID %d tidak ditemukan", item.ProcedureID)
		}

		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = index + 1
		}

		pkgItem := models.ClinicalPackageProcedureItem{
			PackageID:   packageID,
			ProcedureID: item.ProcedureID,
			SortOrder:   sortOrder,
			Notes:       strings.TrimSpace(item.Notes),
		}
		if err := tx.Create(&pkgItem).Error; err != nil {
			return fmt.Errorf("gagal menyimpan tindakan paket")
		}
	}

	for index, item := range medicineItems {
		var medicine models.Medicine
		if err := tx.Where("id = ? AND is_active = ?", item.MedicineID, true).First(&medicine).Error; err != nil {
			return fmt.Errorf("obat ID %d tidak ditemukan", item.MedicineID)
		}

		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		unit := strings.TrimSpace(item.Unit)
		if unit == "" {
			unit = medicine.Unit
		}
		dosage := strings.TrimSpace(item.Dosage)
		if dosage == "" {
			dosage = strings.TrimSpace(medicine.Dosage)
		}
		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = index + 1
		}

		pkgItem := models.ClinicalPackageMedicineItem{
			PackageID:    packageID,
			MedicineID:   item.MedicineID,
			Quantity:     quantity,
			Unit:         unit,
			Dosage:       dosage,
			Frequency:    strings.TrimSpace(item.Frequency),
			Route:        strings.TrimSpace(item.Route),
			Duration:     strings.TrimSpace(item.Duration),
			Instructions: strings.TrimSpace(item.Instructions),
			SortOrder:    sortOrder,
			Notes:        strings.TrimSpace(item.Notes),
		}
		if err := tx.Create(&pkgItem).Error; err != nil {
			return fmt.Errorf("gagal menyimpan obat paket")
		}
	}

	return nil
}
