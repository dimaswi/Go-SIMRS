package handlers

import (
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Room Handlers ====================

// GetRooms returns all rooms with pagination and filtering
func GetRooms(c *gin.Context) {
	var rooms []models.Room
	var total int64

	db := database.DB.Model(&models.Room{})

	// Search filter
	if search := c.Query("search"); search != "" {
		db = db.Where("code ILIKE ? OR name ILIKE ?",
			"%"+search+"%", "%"+search+"%")
	}

	// Service type filter
	if serviceType := c.Query("service_type"); serviceType != "" {
		db = db.Where("service_type = ?", serviceType)
	}

	// Room type filter
	if roomType := c.Query("room_type"); roomType != "" {
		db = db.Where("room_type = ?", roomType)
	}

	// Room class filter
	if roomClass := c.Query("room_class"); roomClass != "" {
		db = db.Where("room_class = ?", roomClass)
	}

	// Status filter
	if isActive := c.Query("is_active"); isActive != "" {
		db = db.Where("is_active = ?", isActive == "true")
	}

	// Building filter
	if buildingID := c.Query("building_id"); buildingID != "" {
		if buildingID == "none" {
			db = db.Where("building_id IS NULL")
		} else {
			db = db.Where("building_id = ?", buildingID)
		}
	}

	// Count total
	db.Count(&total)

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	if err := db.Preload("PICEmployee").Preload("PICEmployee.User").
		Preload("Units").Preload("Units.Beds").
		Order("code ASC").Offset(offset).Limit(limit).Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	// Compute bed stats for each room
	for i := range rooms {
		rooms[i].ComputeBedStats(database.DB)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": rooms,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRoom returns a single room by ID with all relations
func GetRoom(c *gin.Context) {
	id := c.Param("id")
	var room models.Room

	if err := database.DB.
		Preload("PICEmployee").Preload("PICEmployee.User").
		Preload("Units", "deleted_at IS NULL").
		Preload("Units.Beds", "deleted_at IS NULL").
		First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	room.ComputeBedStats(database.DB)

	// Load current patient info for each occupied bed
	loadBedPatientInfo(database.DB, &room)

	c.JSON(http.StatusOK, gin.H{"data": room})
}

// loadBedPatientInfo loads patient information for occupied beds in a room
func loadBedPatientInfo(db *gorm.DB, room *models.Room) {
	for i := range room.Units {
		for j := range room.Units[i].Beds {
			bed := &room.Units[i].Beds[j]
			if bed.Status == "occupied" {
				// Find active visit for this bed (query by bed_id)
				var visit models.Visit
				err := db.
					Preload("Registration.Patient").
					Preload("Doctor").
					Preload("Room").
					Where("bed_id = ? AND status IN (?, ?)", bed.ID, "in_progress", "waiting").
					First(&visit).Error

				if err == nil && visit.Registration != nil && visit.Registration.Patient != nil {
					patient := visit.Registration.Patient
					bedPatient := buildBedPatientInfo(patient, &visit, room.Units[i].Name, room.Name)
					bed.CurrentPatient = bedPatient
				} else {
					// Fallback: If bed is occupied but no visit found with bed_id,
					// try to find visit by room_id for inpatient rooms (legacy data)
					var roomCheck models.Room
					db.First(&roomCheck, room.ID)
					if roomCheck.ServiceType == "rawat_inap" {
						// Get unit's room_id
						var unit models.RoomUnit
						if db.First(&unit, bed.RoomUnitID).Error == nil {
							// Find any active inpatient visit in this room without bed assignment
							var inpatientVisit models.Visit
							err := db.
								Preload("Registration.Patient").
								Preload("Doctor").
								Preload("Room").
								Where("room_id = ? AND status IN (?, ?) AND (bed_id IS NULL OR bed_id = 0)",
									unit.RoomID, "in_progress", "waiting").
								First(&inpatientVisit).Error

							if err == nil && inpatientVisit.Registration != nil && inpatientVisit.Registration.Patient != nil {
								patient := inpatientVisit.Registration.Patient
								bedPatient := buildBedPatientInfo(patient, &inpatientVisit, room.Units[i].Name, room.Name)
								bed.CurrentPatient = bedPatient
							}
						}
					}
				}
			}
		}
	}
}

// buildBedPatientInfo creates a BedPatient struct with full patient information
func buildBedPatientInfo(patient *models.Patient, visit *models.Visit, unitName, roomName string) *models.BedPatient {
	// Get address (prefer domisili, fallback to KTP)
	address := patient.AlamatDomisili
	if address == "" {
		address = patient.AlamatKTP
	}

	// Get insurance number (BPJS or private insurance policy)
	insuranceNumber := patient.NoBPJS
	if insuranceNumber == "" {
		insuranceNumber = patient.NoPolisAsuransi
	}

	bedPatient := &models.BedPatient{
		Name:                patient.NamaLengkap,
		MedicalRecordNumber: patient.NoRM,
		NIK:                 patient.NIK,
		Gender:              string(patient.JenisKelamin),
		Address:             address,
		Phone:               patient.NoTelepon,
		InsuranceType:       string(patient.JenisJaminan),
		InsuranceNumber:     insuranceNumber,
		UnitName:            unitName,
		RoomName:            roomName,
		VisitID:             visit.ID,
		PatientID:           patient.ID,
	}

	// Set birth date and calculate age
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		birthDate := patient.TanggalLahir.Time
		bedPatient.BirthDate = &birthDate
		bedPatient.Age = calculateAge(birthDate)
	}

	// Set admission date
	if visit.AdmissionTime != nil {
		bedPatient.AdmissionDate = visit.AdmissionTime
	}

	// Set diagnosis from visit
	if visit.Diagnosis != "" {
		bedPatient.Diagnosis = visit.Diagnosis
	}

	// Set doctor name
	if visit.Doctor != nil {
		bedPatient.DoctorName = visit.Doctor.NamaLengkap
	}

	return bedPatient
}

// calculateAge calculates age from birth date
func calculateAge(birthDate time.Time) int {
	now := time.Now()
	years := now.Year() - birthDate.Year()
	if now.YearDay() < birthDate.YearDay() {
		years--
	}
	return years
}

// CreateRoomRequest represents the request to create a room
type CreateRoomRequest struct {
	Code          string  `json:"code" binding:"required"`
	Name          string  `json:"name" binding:"required"`
	QueueCode     string  `json:"queue_code"`
	ServiceType   string  `json:"service_type" binding:"required"`
	RoomType      string  `json:"room_type" binding:"required"`
	RoomClass     string  `json:"room_class"`
	TotalFloors   int     `json:"total_floors"`
	TariffPerDay  float64 `json:"tariff_per_day"`
	Facilities    string  `json:"facilities"`
	Description   string  `json:"description"`
	HasBed        bool    `json:"has_bed"`
	HasSchedule   bool    `json:"has_schedule"`
	IsActive      bool    `json:"is_active"`
	PICEmployeeID *uint   `json:"pic_employee_id"`
}

// CreateRoom creates a new room
func CreateRoom(c *gin.Context) {
	var req CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if code already exists
	var existing models.Room
	if err := database.DB.Where("code = ?", req.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode ruangan sudah digunakan"})
		return
	}

	// Check if queue_code already exists (if provided)
	if req.QueueCode != "" {
		if err := database.DB.Where("queue_code = ?", req.QueueCode).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode antrean sudah digunakan oleh ruangan lain"})
			return
		}
	}

	// Validate PIC Employee if provided
	if req.PICEmployeeID != nil && *req.PICEmployeeID > 0 {
		var employee models.Employee
		if err := database.DB.First(&employee, *req.PICEmployeeID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan tidak ditemukan"})
			return
		}
	}

	totalFloors := req.TotalFloors
	if totalFloors < 1 {
		totalFloors = 1
	}

	room := models.Room{
		Code:          req.Code,
		Name:          req.Name,
		QueueCode:     req.QueueCode,
		ServiceType:   req.ServiceType,
		RoomType:      req.RoomType,
		RoomClass:     req.RoomClass,
		TotalFloors:   totalFloors,
		TariffPerDay:  req.TariffPerDay,
		Facilities:    req.Facilities,
		Description:   req.Description,
		HasBed:        req.HasBed,
		HasSchedule:   req.HasSchedule,
		IsActive:      req.IsActive,
		PICEmployeeID: req.PICEmployeeID,
	}

	if err := database.DB.Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat ruangan"})
		return
	}

	// Reload with PIC
	database.DB.Preload("PICEmployee").Preload("PICEmployee.User").First(&room, room.ID)

	c.JSON(http.StatusCreated, gin.H{"data": room, "message": "Ruangan berhasil dibuat"})
}

// UpdateRoomRequest represents the request to update a room
type UpdateRoomRequest struct {
	Code          string  `json:"code" binding:"required"`
	Name          string  `json:"name" binding:"required"`
	QueueCode     string  `json:"queue_code"`
	ServiceType   string  `json:"service_type" binding:"required"`
	RoomType      string  `json:"room_type" binding:"required"`
	RoomClass     string  `json:"room_class"`
	TotalFloors   int     `json:"total_floors"`
	TariffPerDay  float64 `json:"tariff_per_day"`
	Facilities    string  `json:"facilities"`
	Description   string  `json:"description"`
	HasBed        bool    `json:"has_bed"`
	HasSchedule   bool    `json:"has_schedule"`
	IsActive      bool    `json:"is_active"`
	PICEmployeeID *uint   `json:"pic_employee_id"`
}

// UpdateRoom updates an existing room
func UpdateRoom(c *gin.Context) {
	id := c.Param("id")
	var room models.Room

	if err := database.DB.First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var req UpdateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if code already exists (excluding current room)
	var existing models.Room
	if err := database.DB.Where("code = ? AND id != ?", req.Code, id).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode ruangan sudah digunakan"})
		return
	}

	// Check if queue_code already exists (excluding current room, if provided)
	if req.QueueCode != "" {
		if err := database.DB.Where("queue_code = ? AND id != ?", req.QueueCode, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kode antrean sudah digunakan oleh ruangan lain"})
			return
		}
	}

	// Validate PIC Employee if provided
	if req.PICEmployeeID != nil && *req.PICEmployeeID > 0 {
		var employee models.Employee
		if err := database.DB.First(&employee, *req.PICEmployeeID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan tidak ditemukan"})
			return
		}
	}

	totalFloors := req.TotalFloors
	if totalFloors < 1 {
		totalFloors = 1
	}

	room.Code = req.Code
	room.Name = req.Name
	room.QueueCode = req.QueueCode
	room.ServiceType = req.ServiceType
	room.RoomType = req.RoomType
	room.RoomClass = req.RoomClass
	room.TotalFloors = totalFloors
	room.TariffPerDay = req.TariffPerDay
	room.Facilities = req.Facilities
	room.Description = req.Description
	room.HasBed = req.HasBed
	room.HasSchedule = req.HasSchedule
	room.IsActive = req.IsActive
	room.PICEmployeeID = req.PICEmployeeID

	if err := database.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui ruangan"})
		return
	}

	// Reload with PIC
	database.DB.Preload("PICEmployee").Preload("PICEmployee.User").First(&room, room.ID)

	c.JSON(http.StatusOK, gin.H{"data": room, "message": "Ruangan berhasil diperbarui"})
}

// DeleteRoom deletes a room
func DeleteRoom(c *gin.Context) {
	id := c.Param("id")
	var room models.Room

	if err := database.DB.First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Check if room has units
	var unitCount int64
	database.DB.Model(&models.RoomUnit{}).Where("room_id = ?", id).Count(&unitCount)
	if unitCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus ruangan yang memiliki kamar. Hapus semua kamar terlebih dahulu."})
		return
	}

	// Delete room staff first
	database.DB.Where("room_id = ?", id).Delete(&models.RoomStaff{})

	if err := database.DB.Delete(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus ruangan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ruangan berhasil dihapus"})
}

// ==================== Room Unit Handlers ====================

// GetRoomUnits returns all units for a room
func GetRoomUnits(c *gin.Context) {
	roomID := c.Param("id")
	var units []models.RoomUnit

	db := database.DB.Where("room_id = ?", roomID)

	// Floor filter
	if floor := c.Query("floor"); floor != "" {
		db = db.Where("floor = ?", floor)
	}

	// Status filter
	if isActive := c.Query("is_active"); isActive != "" {
		db = db.Where("is_active = ?", isActive == "true")
	}

	if err := db.Preload("Beds").Order("floor ASC, code ASC").Find(&units).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar kamar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": units})
}

// GetRoomUnit returns a single room unit
func GetRoomUnit(c *gin.Context) {
	roomID := c.Param("id")
	unitID := c.Param("unit_id")
	var unit models.RoomUnit

	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).
		Preload("Room").Preload("Beds").First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": unit})
}

// CreateRoomUnitRequest represents the request to create a room unit
type CreateRoomUnitRequest struct {
	Code     string `json:"code" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Floor    int    `json:"floor"`
	Capacity int    `json:"capacity"`
	IsActive bool   `json:"is_active"`
	Notes    string `json:"notes"`
}

// CreateRoomUnit creates a new room unit
func CreateRoomUnit(c *gin.Context) {
	roomID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ruangan tidak valid"})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var req CreateRoomUnitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate floor
	floor := req.Floor
	if floor < 1 {
		floor = 1
	}
	if floor > room.TotalFloors {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lantai tidak boleh melebihi total lantai ruangan (" + strconv.Itoa(room.TotalFloors) + ")"})
		return
	}

	// Check if code already exists in this room
	var existing models.RoomUnit
	if err := database.DB.Where("room_id = ? AND code = ?", roomID, req.Code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kamar sudah digunakan di ruangan ini"})
		return
	}

	capacity := req.Capacity
	if capacity < 1 {
		capacity = 1
	}

	unit := models.RoomUnit{
		RoomID:   uint(roomID),
		Code:     req.Code,
		Name:     req.Name,
		Floor:    floor,
		Capacity: capacity,
		IsActive: req.IsActive,
		Notes:    req.Notes,
	}

	if err := database.DB.Create(&unit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kamar"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": unit, "message": "Kamar berhasil dibuat"})
}

// UpdateRoomUnitRequest represents the request to update a room unit
type UpdateRoomUnitRequest struct {
	Code     string `json:"code" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Floor    int    `json:"floor"`
	Capacity int    `json:"capacity"`
	IsActive bool   `json:"is_active"`
	Notes    string `json:"notes"`
}

// UpdateRoomUnit updates an existing room unit
func UpdateRoomUnit(c *gin.Context) {
	roomID := c.Param("id")
	unitID := c.Param("unit_id")
	var unit models.RoomUnit

	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	// Get room for floor validation
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var req UpdateRoomUnitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate floor
	floor := req.Floor
	if floor < 1 {
		floor = 1
	}
	if floor > room.TotalFloors {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lantai tidak boleh melebihi total lantai ruangan (" + strconv.Itoa(room.TotalFloors) + ")"})
		return
	}

	// Check if code already exists in this room (excluding current unit)
	var existing models.RoomUnit
	if err := database.DB.Where("room_id = ? AND code = ? AND id != ?", roomID, req.Code, unitID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode kamar sudah digunakan di ruangan ini"})
		return
	}

	// Check capacity - cannot be less than current bed count
	var bedCount int64
	database.DB.Model(&models.Bed{}).Where("room_unit_id = ?", unitID).Count(&bedCount)
	if req.Capacity < int(bedCount) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kapasitas tidak boleh kurang dari jumlah bed yang ada (" + strconv.FormatInt(bedCount, 10) + ")"})
		return
	}

	capacity := req.Capacity
	if capacity < 1 {
		capacity = 1
	}

	unit.Code = req.Code
	unit.Name = req.Name
	unit.Floor = floor
	unit.Capacity = capacity
	unit.IsActive = req.IsActive
	unit.Notes = req.Notes

	if err := database.DB.Save(&unit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui kamar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": unit, "message": "Kamar berhasil diperbarui"})
}

// DeleteRoomUnit deletes a room unit
func DeleteRoomUnit(c *gin.Context) {
	roomID := c.Param("id")
	unitID := c.Param("unit_id")
	var unit models.RoomUnit

	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	// Check if unit has beds
	var bedCount int64
	database.DB.Model(&models.Bed{}).Where("room_unit_id = ?", unitID).Count(&bedCount)
	if bedCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus kamar yang memiliki tempat tidur. Hapus semua tempat tidur terlebih dahulu."})
		return
	}

	if err := database.DB.Delete(&unit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus kamar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kamar berhasil dihapus"})
}

// ==================== Bed Handlers ====================

// GetBeds returns all beds for a room unit
func GetBeds(c *gin.Context) {
	unitID := c.Param("unit_id")
	var beds []models.Bed

	db := database.DB.Where("room_unit_id = ?", unitID)

	// Status filter
	if status := c.Query("status"); status != "" {
		db = db.Where("status = ?", status)
	}

	if err := db.Order("bed_number ASC").Find(&beds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar tempat tidur"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": beds})
}

// GetAllRoomBeds returns all beds for a room (across all units)
func GetAllRoomBeds(c *gin.Context) {
	roomID := c.Param("id")
	var beds []models.Bed

	if err := database.DB.
		Joins("JOIN room_units ON room_units.id = beds.room_unit_id").
		Where("room_units.room_id = ? AND room_units.deleted_at IS NULL", roomID).
		Preload("RoomUnit").
		Order("room_units.floor ASC, room_units.code ASC, beds.bed_number ASC").
		Find(&beds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar tempat tidur"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": beds})
}

// CreateBedRequest represents the request to create a bed
type CreateBedRequest struct {
	BedNumber string `json:"bed_number" binding:"required"`
	BedType   string `json:"bed_type"`
	Status    string `json:"status"`
	Notes     string `json:"notes"`
}

// CreateBed creates a new bed for a room unit
func CreateBed(c *gin.Context) {
	roomID := c.Param("id")
	unitID, err := strconv.ParseUint(c.Param("unit_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID kamar tidak valid"})
		return
	}

	// Check if unit exists and belongs to room
	var unit models.RoomUnit
	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	// Check if capacity is reached
	var bedCount int64
	database.DB.Model(&models.Bed{}).Where("room_unit_id = ?", unitID).Count(&bedCount)
	if int(bedCount) >= unit.Capacity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kapasitas kamar sudah penuh. Maksimal " + strconv.Itoa(unit.Capacity) + " tempat tidur."})
		return
	}

	var req CreateBedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if bed number already exists in this unit
	var existing models.Bed
	if err := database.DB.Where("room_unit_id = ? AND bed_number = ?", unitID, req.BedNumber).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor tempat tidur sudah digunakan di kamar ini"})
		return
	}

	status := req.Status
	if status == "" {
		status = "available"
	}

	bed := models.Bed{
		RoomUnitID: uint(unitID),
		BedNumber:  req.BedNumber,
		BedType:    req.BedType,
		Status:     status,
		Notes:      req.Notes,
	}

	if err := database.DB.Create(&bed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat tempat tidur"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": bed, "message": "Tempat tidur berhasil dibuat"})
}

// UpdateBedRequest represents the request to update a bed
type UpdateBedRequest struct {
	BedNumber string `json:"bed_number" binding:"required"`
	BedType   string `json:"bed_type"`
	Status    string `json:"status"`
	Notes     string `json:"notes"`
}

// UpdateBed updates an existing bed
func UpdateBed(c *gin.Context) {
	roomID := c.Param("id")
	unitID := c.Param("unit_id")
	bedID := c.Param("bed_id")
	var bed models.Bed

	// Verify the chain: room -> unit -> bed
	var unit models.RoomUnit
	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	if err := database.DB.Where("id = ? AND room_unit_id = ?", bedID, unitID).First(&bed).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tempat tidur tidak ditemukan"})
		return
	}

	var req UpdateBedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if bed number already exists in this unit (excluding current bed)
	var existing models.Bed
	if err := database.DB.Where("room_unit_id = ? AND bed_number = ? AND id != ?", unitID, req.BedNumber, bedID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor tempat tidur sudah digunakan di kamar ini"})
		return
	}

	bed.BedNumber = req.BedNumber
	bed.BedType = req.BedType
	bed.Status = req.Status
	bed.Notes = req.Notes

	if err := database.DB.Save(&bed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui tempat tidur"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": bed, "message": "Tempat tidur berhasil diperbarui"})
}

// DeleteBed deletes a bed
func DeleteBed(c *gin.Context) {
	roomID := c.Param("id")
	unitID := c.Param("unit_id")
	bedID := c.Param("bed_id")
	var bed models.Bed

	// Verify the chain: room -> unit -> bed
	var unit models.RoomUnit
	if err := database.DB.Where("id = ? AND room_id = ?", unitID, roomID).First(&unit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kamar tidak ditemukan"})
		return
	}

	if err := database.DB.Where("id = ? AND room_unit_id = ?", bedID, unitID).First(&bed).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tempat tidur tidak ditemukan"})
		return
	}

	// Check if bed is occupied
	if bed.Status == "occupied" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus tempat tidur yang sedang digunakan"})
		return
	}

	if err := database.DB.Delete(&bed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tempat tidur"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tempat tidur berhasil dihapus"})
}

// ==================== Room Staff Handlers ====================

// GetRoomStaff returns all staff assigned to a room
func GetRoomStaff(c *gin.Context) {
	roomID := c.Param("id")
	var staff []models.RoomStaff

	if err := database.DB.Where("room_id = ?", roomID).
		Preload("Employee").Preload("Employee.User").
		Order("is_primary DESC, role_type ASC").Find(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar staf ruangan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": staff})
}

// AssignRoomStaffRequest represents the request to assign staff to a room
type AssignRoomStaffRequest struct {
	EmployeeID uint   `json:"employee_id" binding:"required"`
	RoleType   string `json:"role_type" binding:"required"`
	IsPrimary  bool   `json:"is_primary"`
	Notes      string `json:"notes"`
}

// AssignRoomStaff assigns staff to a room
func AssignRoomStaff(c *gin.Context) {
	roomID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ruangan tidak valid"})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var req AssignRoomStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if employee exists
	var employee models.Employee
	if err := database.DB.First(&employee, req.EmployeeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}

	// Check if employee is already assigned to this room
	var existing models.RoomStaff
	if err := database.DB.Where("room_id = ? AND employee_id = ?", roomID, req.EmployeeID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan sudah ditugaskan di ruangan ini"})
		return
	}

	// If setting as primary, remove primary status from other staff with same role
	if req.IsPrimary {
		database.DB.Model(&models.RoomStaff{}).Where("room_id = ? AND role_type = ? AND is_primary = ?", roomID, req.RoleType, true).
			Update("is_primary", false)
	}

	roomStaff := models.RoomStaff{
		RoomID:     uint(roomID),
		EmployeeID: req.EmployeeID,
		RoleType:   req.RoleType,
		IsPrimary:  req.IsPrimary,
		Notes:      req.Notes,
	}

	if err := database.DB.Create(&roomStaff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menugaskan staf"})
		return
	}

	// Reload with employee data
	database.DB.Preload("Employee").Preload("Employee.User").First(&roomStaff, roomStaff.ID)

	c.JSON(http.StatusCreated, gin.H{"data": roomStaff, "message": "Staf berhasil ditugaskan"})
}

// UpdateRoomStaffRequest represents the request to update room staff
type UpdateRoomStaffRequest struct {
	RoleType  string `json:"role_type" binding:"required"`
	IsPrimary bool   `json:"is_primary"`
	Notes     string `json:"notes"`
}

// UpdateRoomStaff updates room staff assignment
func UpdateRoomStaff(c *gin.Context) {
	roomID := c.Param("id")
	staffID := c.Param("staff_id")
	var staff models.RoomStaff

	if err := database.DB.Where("id = ? AND room_id = ?", staffID, roomID).First(&staff).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Penugasan staf tidak ditemukan"})
		return
	}

	var req UpdateRoomStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If setting as primary, remove primary status from other staff with same role
	if req.IsPrimary && !staff.IsPrimary {
		database.DB.Model(&models.RoomStaff{}).
			Where("room_id = ? AND role_type = ? AND is_primary = ? AND id != ?", roomID, req.RoleType, true, staffID).
			Update("is_primary", false)
	}

	staff.RoleType = req.RoleType
	staff.IsPrimary = req.IsPrimary
	staff.Notes = req.Notes

	if err := database.DB.Save(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui penugasan staf"})
		return
	}

	// Reload with employee data
	database.DB.Preload("Employee").Preload("Employee.User").First(&staff, staff.ID)

	c.JSON(http.StatusOK, gin.H{"data": staff, "message": "Penugasan staf berhasil diperbarui"})
}

// RemoveRoomStaff removes staff from a room
func RemoveRoomStaff(c *gin.Context) {
	roomID := c.Param("id")
	staffID := c.Param("staff_id")
	var staff models.RoomStaff

	if err := database.DB.Where("id = ? AND room_id = ?", staffID, roomID).First(&staff).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Penugasan staf tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&staff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus penugasan staf"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Staf berhasil dihapus dari ruangan"})
}

// GetMyAssignedRooms returns rooms assigned to the current user via RoomStaff
func GetMyAssignedRooms(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Find user's employee ID
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// If user doesn't have employee ID, return empty array
	if user.EmployeeID == nil {
		c.JSON(http.StatusOK, gin.H{"data": []models.Room{}})
		return
	}

	// Find room IDs where this employee is assigned
	var roomStaffs []models.RoomStaff
	if err := database.DB.Where("employee_id = ?", *user.EmployeeID).Find(&roomStaffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room assignments"})
		return
	}

	// Extract room IDs
	roomIDs := make([]uint, 0)
	for _, rs := range roomStaffs {
		roomIDs = append(roomIDs, rs.RoomID)
	}

	// If no rooms assigned, return empty array
	if len(roomIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []models.Room{}})
		return
	}

	// Get the rooms
	var rooms []models.Room
	db := database.DB.Model(&models.Room{}).Where("id IN ? AND is_active = ?", roomIDs, true)

	// Apply service type filter if provided
	if serviceType := c.Query("service_type"); serviceType != "" {
		db = db.Where("service_type = ?", serviceType)
	}

	// Apply room type filter if provided
	if roomType := c.Query("room_type"); roomType != "" {
		db = db.Where("room_type = ?", roomType)
	}

	if err := db.Order("name ASC").Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rooms})
}

// ==================== Room Tariff Handlers ====================

// GetRoomTariffs returns all tariffs for a room
func GetRoomTariffs(c *gin.Context) {
	roomID := c.Param("id")

	var tariffs []models.RoomTariff
	if err := database.DB.Where("room_id = ?", roomID).
		Order("CASE patient_class " +
			"WHEN 'non_kelas' THEN 1 " +
			"WHEN 'kelas_3' THEN 2 " +
			"WHEN 'kelas_2' THEN 3 " +
			"WHEN 'kelas_1' THEN 4 " +
			"WHEN 'vip' THEN 5 " +
			"WHEN 'vvip' THEN 6 " +
			"ELSE 99 END").
		Find(&tariffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room tariffs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tariffs})
}

// CreateRoomTariffRequest represents the request to create/update room tariff
type CreateRoomTariffRequest struct {
	PatientClass string  `json:"patient_class" binding:"required"`
	Akomodasi    float64 `json:"akomodasi"`
	Makan        float64 `json:"makan"`
	Perawatan    float64 `json:"perawatan"`
	Administrasi float64 `json:"administrasi"`
	Lainnya      float64 `json:"lainnya"`
	IsActive     *bool   `json:"is_active"`
}

// CreateRoomTariff creates a new tariff for a room
func CreateRoomTariff(c *gin.Context) {
	roomID := c.Param("id")
	roomIDUint, err := strconv.ParseUint(roomID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var req CreateRoomTariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if tariff already exists for this room and patient class (including soft-deleted)
	var existing models.RoomTariff
	err = database.DB.Unscoped().Where("room_id = ? AND patient_class = ?", roomID, req.PatientClass).
		First(&existing).Error

	if err == nil {
		// Record exists
		if existing.DeletedAt.Valid {
			// Soft-deleted record exists, restore and update it
			existing.DeletedAt = gorm.DeletedAt{}
			existing.Akomodasi = req.Akomodasi
			existing.Makan = req.Makan
			existing.Perawatan = req.Perawatan
			existing.Administrasi = req.Administrasi
			existing.Lainnya = req.Lainnya
			existing.IsActive = true
			if req.IsActive != nil {
				existing.IsActive = *req.IsActive
			}

			if err := database.DB.Unscoped().Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore room tariff"})
				return
			}
			c.JSON(http.StatusCreated, gin.H{"data": existing, "message": "Room tariff restored successfully"})
			return
		}
		// Active record exists
		c.JSON(http.StatusConflict, gin.H{"error": "Tariff for this patient class already exists"})
		return
	}

	tariff := models.RoomTariff{
		RoomID:       uint(roomIDUint),
		PatientClass: req.PatientClass,
		Akomodasi:    req.Akomodasi,
		Makan:        req.Makan,
		Perawatan:    req.Perawatan,
		Administrasi: req.Administrasi,
		Lainnya:      req.Lainnya,
		IsActive:     true,
	}

	if req.IsActive != nil {
		tariff.IsActive = *req.IsActive
	}

	if err := database.DB.Create(&tariff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room tariff"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": tariff, "message": "Room tariff created successfully"})
}

// UpdateRoomTariff updates a room tariff
func UpdateRoomTariff(c *gin.Context) {
	roomID := c.Param("id")
	tariffID := c.Param("tariffId")

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Find tariff
	var tariff models.RoomTariff
	if err := database.DB.Where("id = ? AND room_id = ?", tariffID, roomID).
		First(&tariff).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room tariff not found"})
		return
	}

	var req CreateRoomTariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if changing to existing patient class
	if req.PatientClass != tariff.PatientClass {
		var existing models.RoomTariff
		if err := database.DB.Where("room_id = ? AND patient_class = ? AND id != ?",
			roomID, req.PatientClass, tariffID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Tariff for this patient class already exists"})
			return
		}
	}

	// Update fields
	tariff.PatientClass = req.PatientClass
	tariff.Akomodasi = req.Akomodasi
	tariff.Makan = req.Makan
	tariff.Perawatan = req.Perawatan
	tariff.Administrasi = req.Administrasi
	tariff.Lainnya = req.Lainnya

	if req.IsActive != nil {
		tariff.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&tariff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room tariff"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tariff, "message": "Room tariff updated successfully"})
}

// DeleteRoomTariff deletes a room tariff
func DeleteRoomTariff(c *gin.Context) {
	roomID := c.Param("id")
	tariffID := c.Param("tariffId")

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Find and delete tariff
	var tariff models.RoomTariff
	if err := database.DB.Where("id = ? AND room_id = ?", tariffID, roomID).
		First(&tariff).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room tariff not found"})
		return
	}

	if err := database.DB.Delete(&tariff).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room tariff"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room tariff deleted successfully"})
}

// BulkUpdateRoomTariffs updates multiple tariffs at once for a room
type BulkRoomTariffRequest struct {
	Tariffs []CreateRoomTariffRequest `json:"tariffs" binding:"required"`
}

func BulkUpdateRoomTariffs(c *gin.Context) {
	roomID := c.Param("id")
	roomIDUint, err := strconv.ParseUint(roomID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var req BulkRoomTariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	for _, tariffReq := range req.Tariffs {
		// Check if tariff exists (including soft-deleted)
		var existingTariff models.RoomTariff
		err := tx.Unscoped().Where("room_id = ? AND patient_class = ?", roomID, tariffReq.PatientClass).
			First(&existingTariff).Error

		if err == nil {
			// Record exists, update it
			existingTariff.DeletedAt = gorm.DeletedAt{} // Restore if soft-deleted
			existingTariff.Akomodasi = tariffReq.Akomodasi
			existingTariff.Makan = tariffReq.Makan
			existingTariff.Perawatan = tariffReq.Perawatan
			existingTariff.Administrasi = tariffReq.Administrasi
			existingTariff.Lainnya = tariffReq.Lainnya
			if tariffReq.IsActive != nil {
				existingTariff.IsActive = *tariffReq.IsActive
			}

			if err := tx.Unscoped().Save(&existingTariff).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tariff"})
				return
			}
		} else {
			// Create new
			newTariff := models.RoomTariff{
				RoomID:       uint(roomIDUint),
				PatientClass: tariffReq.PatientClass,
				Akomodasi:    tariffReq.Akomodasi,
				Makan:        tariffReq.Makan,
				Perawatan:    tariffReq.Perawatan,
				Administrasi: tariffReq.Administrasi,
				Lainnya:      tariffReq.Lainnya,
				IsActive:     true,
			}
			if tariffReq.IsActive != nil {
				newTariff.IsActive = *tariffReq.IsActive
			}

			if err := tx.Create(&newTariff).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tariff"})
				return
			}
		}
	}

	tx.Commit()

	// Return updated tariffs
	var tariffs []models.RoomTariff
	database.DB.Where("room_id = ?", roomID).Find(&tariffs)

	c.JSON(http.StatusOK, gin.H{"data": tariffs, "message": "Room tariffs updated successfully"})
}
