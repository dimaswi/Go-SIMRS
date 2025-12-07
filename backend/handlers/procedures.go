package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ========================================
// PROCEDURE HANDLERS
// ========================================

// GetProcedures returns all procedures
func GetProcedures(c *gin.Context) {
	var procedures []models.Procedure

	// Query parameters
	search := c.Query("search")
	procedureGroup := c.Query("procedure_group")
	procedureType := c.Query("procedure_type")
	specialty := c.Query("specialty")
	serviceType := c.Query("service_type")
	isActive := c.Query("is_active")
	isSurgical := c.Query("is_surgical")

	query := database.DB.Model(&models.Procedure{}).Preload("Tariffs")

	// Apply filters
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("code ILIKE ? OR name ILIKE ? OR inacbg_code ILIKE ? OR icd9cm_code ILIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern)
	}

	if procedureGroup != "" {
		query = query.Where("procedure_group = ?", procedureGroup)
	}

	if procedureType != "" {
		query = query.Where("procedure_type = ?", procedureType)
	}

	if specialty != "" {
		query = query.Where("specialty = ?", specialty)
	}

	if serviceType != "" {
		query = query.Where("service_type = ? OR service_type = 'all'", serviceType)
	}

	if isActive != "" {
		active, _ := strconv.ParseBool(isActive)
		query = query.Where("is_active = ?", active)
	}

	if isSurgical != "" {
		surgical, _ := strconv.ParseBool(isSurgical)
		query = query.Where("is_surgical = ?", surgical)
	}

	if err := query.Order("code ASC").Find(&procedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": procedures})
}

// GetProcedure returns a single procedure by ID with tariffs and parameters
func GetProcedure(c *gin.Context) {
	id := c.Param("id")

	var procedure models.Procedure
	query := database.DB.Preload("Tariffs")

	// Include parameters if requested
	if c.Query("include_parameters") == "true" {
		query = query.Preload("Parameters", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		})
	}

	if err := query.First(&procedure, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": procedure})
}

// TariffRequest represents tariff data for a patient class
type TariffRequest struct {
	PatientClass   string  `json:"patient_class"`
	Administrasi   float64 `json:"administrasi"`
	Sarana         float64 `json:"sarana"`
	BHP            float64 `json:"bhp"`
	DokterOperator float64 `json:"dokter_operator"`
	DokterAnastesi float64 `json:"dokter_anastesi"`
	DokterLainnya  float64 `json:"dokter_lainnya"`
	PenataAnastesi float64 `json:"penata_anastesi"`
	Paramedis      float64 `json:"paramedis"`
	NonMedis       float64 `json:"non_medis"`
}

// CreateProcedureRequest represents the request body for creating a procedure
type CreateProcedureRequest struct {
	Code               string          `json:"code" binding:"required"`
	Name               string          `json:"name" binding:"required"`
	Description        string          `json:"description"`
	ProcedureType      string          `json:"procedure_type"` // medical, radiology, laboratory
	INACBGCode         string          `json:"inacbg_code"`
	INACBGName         string          `json:"inacbg_name"`
	ProcedureGroup     string          `json:"procedure_group"`
	Specialty          string          `json:"specialty"`
	BodySystem         string          `json:"body_system"`
	ICD9CMCode         string          `json:"icd9cm_code"`
	ICD10PCSCode       string          `json:"icd10pcs_code"`
	Duration           int             `json:"duration"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	AnesthesiaType     string          `json:"anesthesia_type"`
	IsEmergency        bool            `json:"is_emergency"`
	IsSurgical         bool            `json:"is_surgical"`
	ServiceType        string          `json:"service_type"`
	IsActive           bool            `json:"is_active"`
	Tariffs            []TariffRequest `json:"tariffs"`
}

// CreateProcedure creates a new procedure with tariffs
func CreateProcedure(c *gin.Context) {
	var req CreateProcedureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check duplicate code
	var existing models.Procedure
	if err := database.DB.Where("code = ?", req.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode tindakan sudah digunakan"})
		return
	}

	// Default procedure type
	procedureType := req.ProcedureType
	if procedureType == "" {
		procedureType = models.ProcedureTypeMedical
	}

	// Start transaction
	tx := database.DB.Begin()

	procedure := models.Procedure{
		Code:               req.Code,
		Name:               req.Name,
		Description:        req.Description,
		ProcedureType:      procedureType,
		INACBGCode:         req.INACBGCode,
		INACBGName:         req.INACBGName,
		ProcedureGroup:     req.ProcedureGroup,
		Specialty:          req.Specialty,
		BodySystem:         req.BodySystem,
		ICD9CMCode:         req.ICD9CMCode,
		ICD10PCSCode:       req.ICD10PCSCode,
		Duration:           req.Duration,
		RequiresAnesthesia: req.RequiresAnesthesia,
		AnesthesiaType:     req.AnesthesiaType,
		IsEmergency:        req.IsEmergency,
		IsSurgical:         req.IsSurgical,
		ServiceType:        req.ServiceType,
		IsActive:           req.IsActive,
	}

	if err := tx.Create(&procedure).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create tariffs for each patient class
	for _, t := range req.Tariffs {
		tariff := models.ProcedureTariff{
			ProcedureID:    procedure.ID,
			PatientClass:   t.PatientClass,
			Administrasi:   t.Administrasi,
			Sarana:         t.Sarana,
			BHP:            t.BHP,
			DokterOperator: t.DokterOperator,
			DokterAnastesi: t.DokterAnastesi,
			DokterLainnya:  t.DokterLainnya,
			PenataAnastesi: t.PenataAnastesi,
			Paramedis:      t.Paramedis,
			NonMedis:       t.NonMedis,
		}
		if err := tx.Create(&tariff).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()

	// Reload with tariffs
	database.DB.Preload("Tariffs").First(&procedure, procedure.ID)

	c.JSON(http.StatusCreated, gin.H{"data": procedure})
}

// UpdateProcedure updates an existing procedure with tariffs
func UpdateProcedure(c *gin.Context) {
	id := c.Param("id")

	var procedure models.Procedure
	if err := database.DB.First(&procedure, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	var req CreateProcedureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check duplicate code (exclude current)
	var existing models.Procedure
	if err := database.DB.Where("code = ? AND id != ?", req.Code, id).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode tindakan sudah digunakan"})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Update procedure fields
	procedure.Code = req.Code
	procedure.Name = req.Name
	procedure.Description = req.Description
	if req.ProcedureType != "" {
		procedure.ProcedureType = req.ProcedureType
	}
	procedure.INACBGCode = req.INACBGCode
	procedure.INACBGName = req.INACBGName
	procedure.ProcedureGroup = req.ProcedureGroup
	procedure.Specialty = req.Specialty
	procedure.BodySystem = req.BodySystem
	procedure.ICD9CMCode = req.ICD9CMCode
	procedure.ICD10PCSCode = req.ICD10PCSCode
	procedure.Duration = req.Duration
	procedure.RequiresAnesthesia = req.RequiresAnesthesia
	procedure.AnesthesiaType = req.AnesthesiaType
	procedure.IsEmergency = req.IsEmergency
	procedure.IsSurgical = req.IsSurgical
	procedure.ServiceType = req.ServiceType
	procedure.IsActive = req.IsActive

	if err := tx.Save(&procedure).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete existing tariffs and recreate
	if err := tx.Where("procedure_id = ?", procedure.ID).Delete(&models.ProcedureTariff{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create new tariffs
	for _, t := range req.Tariffs {
		tariff := models.ProcedureTariff{
			ProcedureID:    procedure.ID,
			PatientClass:   t.PatientClass,
			Administrasi:   t.Administrasi,
			Sarana:         t.Sarana,
			BHP:            t.BHP,
			DokterOperator: t.DokterOperator,
			DokterAnastesi: t.DokterAnastesi,
			DokterLainnya:  t.DokterLainnya,
			PenataAnastesi: t.PenataAnastesi,
			Paramedis:      t.Paramedis,
			NonMedis:       t.NonMedis,
		}
		if err := tx.Create(&tariff).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()

	// Reload with tariffs
	database.DB.Preload("Tariffs").First(&procedure, procedure.ID)

	c.JSON(http.StatusOK, gin.H{"data": procedure})
}

// DeleteProcedure deletes a procedure
func DeleteProcedure(c *gin.Context) {
	id := c.Param("id")

	var procedure models.Procedure
	if err := database.DB.First(&procedure, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	// Check if procedure is assigned to any room
	var count int64
	database.DB.Model(&models.RoomProcedure{}).Where("procedure_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tindakan tidak dapat dihapus karena masih terhubung dengan ruangan"})
		return
	}

	// Delete tariffs first
	database.DB.Where("procedure_id = ?", id).Delete(&models.ProcedureTariff{})

	if err := database.DB.Delete(&procedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus"})
}

// GetProcedureCategories returns all procedure categories
func GetProcedureCategories(c *gin.Context) {
	var categories []models.ProcedureCategory

	if err := database.DB.Order("sort_order ASC, name ASC").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

// GetPatientClasses returns all available patient classes
func GetPatientClasses(c *gin.Context) {
	classes := models.GetAllPatientClasses()
	result := make([]map[string]string, len(classes))
	for i, class := range classes {
		result[i] = map[string]string{
			"code":  class,
			"label": models.GetPatientClassLabel(class),
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ========================================
// ROOM PROCEDURE HANDLERS
// ========================================

// GetRoomProcedures returns all procedures assigned to a room
func GetRoomProcedures(c *gin.Context) {
	roomID := c.Param("id")

	var roomProcedures []models.RoomProcedure
	if err := database.DB.Where("room_id = ?", roomID).
		Preload("Procedure").
		Preload("Procedure.Tariffs").
		Find(&roomProcedures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roomProcedures})
}

// CreateRoomProcedureRequest represents the request body
type CreateRoomProcedureRequest struct {
	ProcedureID     uint   `json:"procedure_id" binding:"required"`
	IsAvailable     bool   `json:"is_available"`
	MaxPerDay       int    `json:"max_per_day"`
	RequiresBooking bool   `json:"requires_booking"`
	Notes           string `json:"notes"`
}

// CreateRoomProcedure assigns a procedure to a room
func CreateRoomProcedure(c *gin.Context) {
	roomID := c.Param("id")
	roomIDInt, _ := strconv.Atoi(roomID)

	var req CreateRoomProcedureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Check if procedure exists
	var procedure models.Procedure
	if err := database.DB.First(&procedure, req.ProcedureID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tindakan tidak ditemukan"})
		return
	}

	// Check if already assigned
	var existing models.RoomProcedure
	if err := database.DB.Where("room_id = ? AND procedure_id = ?", roomID, req.ProcedureID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tindakan sudah ditambahkan ke ruangan ini"})
		return
	}

	roomProcedure := models.RoomProcedure{
		RoomID:          uint(roomIDInt),
		ProcedureID:     req.ProcedureID,
		IsAvailable:     req.IsAvailable,
		MaxPerDay:       req.MaxPerDay,
		RequiresBooking: req.RequiresBooking,
		Notes:           req.Notes,
	}

	if err := database.DB.Create(&roomProcedure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Load procedure details
	database.DB.Preload("Procedure").Preload("Procedure.Tariffs").First(&roomProcedure, roomProcedure.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomProcedure})
}

// BulkAssignProcedures assigns multiple procedures to a room
func BulkAssignProcedures(c *gin.Context) {
	roomID := c.Param("id")
	roomIDInt, _ := strconv.Atoi(roomID)

	var req struct {
		ProcedureIDs []uint `json:"procedure_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var created []models.RoomProcedure
	var skipped []uint

	for _, procID := range req.ProcedureIDs {
		// Check if already assigned
		var existing models.RoomProcedure
		if err := database.DB.Where("room_id = ? AND procedure_id = ?", roomID, procID).First(&existing).Error; err == nil {
			skipped = append(skipped, procID)
			continue
		}

		rp := models.RoomProcedure{
			RoomID:      uint(roomIDInt),
			ProcedureID: procID,
			IsAvailable: true,
		}
		if err := database.DB.Create(&rp).Error; err == nil {
			database.DB.Preload("Procedure").Preload("Procedure.Tariffs").First(&rp, rp.ID)
			created = append(created, rp)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"skipped": skipped,
		"message": "Berhasil menambahkan tindakan ke ruangan",
	})
}

// UpdateRoomProcedure updates a room procedure assignment
func UpdateRoomProcedure(c *gin.Context) {
	roomID := c.Param("id")
	rpID := c.Param("rpId")

	var rp models.RoomProcedure
	if err := database.DB.Where("id = ? AND room_id = ?", rpID, roomID).First(&rp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	var req CreateRoomProcedureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rp.IsAvailable = req.IsAvailable
	rp.MaxPerDay = req.MaxPerDay
	rp.RequiresBooking = req.RequiresBooking
	rp.Notes = req.Notes

	if err := database.DB.Save(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Procedure").Preload("Procedure.Tariffs").First(&rp, rp.ID)

	c.JSON(http.StatusOK, gin.H{"data": rp})
}

// DeleteRoomProcedure removes a procedure from a room
func DeleteRoomProcedure(c *gin.Context) {
	roomID := c.Param("id")
	rpID := c.Param("rpId")

	var rp models.RoomProcedure
	if err := database.DB.Where("id = ? AND room_id = ?", rpID, roomID).First(&rp).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tindakan berhasil dihapus dari ruangan"})
}
