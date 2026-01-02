package handlers

import (
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ==============================
// SCHEDULE HANDLERS (Room Schedule)
// ==============================

// GetSchedulesRequest represents query params for schedules
type GetSchedulesRequest struct {
	RoomID    uint  `form:"room_id"`
	DayOfWeek *int  `form:"day_of_week"`
	IsActive  *bool `form:"is_active"`
}

// GetSchedules gets all schedules with optional filters
func GetSchedules(c *gin.Context) {
	var req GetSchedulesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := database.DB.Preload("Room")

	if req.RoomID > 0 {
		query = query.Where("room_id = ?", req.RoomID)
	}
	if req.DayOfWeek != nil {
		query = query.Where("day_of_week = ?", *req.DayOfWeek)
	}
	if req.IsActive != nil {
		query = query.Where("is_active = ?", *req.IsActive)
	}

	var schedules []models.Schedule
	if err := query.Order("room_id, day_of_week, start_time").Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

// GetRoomSchedules gets schedules for a specific room
func GetRoomSchedules(c *gin.Context) {
	roomID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ruangan tidak valid"})
		return
	}

	// Check room exists and has schedule
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var schedules []models.Schedule
	if err := database.DB.Where("room_id = ?", roomID).Order("day_of_week, start_time").Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jadwal"})
		return
	}

	// Group by day of week
	dayNames := []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
	groupedSchedules := make(map[string][]models.Schedule)
	for _, day := range dayNames {
		groupedSchedules[day] = []models.Schedule{}
	}
	for _, schedule := range schedules {
		dayName := dayNames[schedule.DayOfWeek]
		groupedSchedules[dayName] = append(groupedSchedules[dayName], schedule)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    schedules,
		"grouped": groupedSchedules,
	})
}

// CreateScheduleRequest represents the request to create a schedule
type CreateScheduleRequest struct {
	RoomID      uint   `json:"room_id" binding:"required"`
	DayOfWeek   int    `json:"day_of_week" binding:"min=0,max=6"`
	StartTime   string `json:"start_time" binding:"required"`
	EndTime     string `json:"end_time" binding:"required"`
	MaxPatients int    `json:"max_patients"`
	IsActive    bool   `json:"is_active"`
	Notes       string `json:"notes"`
}

// CreateSchedule creates a new schedule for a room
func CreateSchedule(c *gin.Context) {
	var req CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate room exists
	var room models.Room
	if err := database.DB.First(&room, req.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Validate time format
	if !isValidTimeFormat(req.StartTime) || !isValidTimeFormat(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid (gunakan HH:MM)"})
		return
	}

	// Validate start time < end time
	if req.StartTime >= req.EndTime {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai harus lebih awal dari waktu selesai"})
		return
	}

	// Check for overlapping schedules
	var existing []models.Schedule
	database.DB.Where("room_id = ? AND day_of_week = ?", req.RoomID, req.DayOfWeek).Find(&existing)
	for _, sch := range existing {
		if isTimeOverlap(req.StartTime, req.EndTime, sch.StartTime, sch.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal bertabrakan dengan jadwal yang sudah ada"})
			return
		}
	}

	schedule := models.Schedule{
		RoomID:      req.RoomID,
		DayOfWeek:   req.DayOfWeek,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		MaxPatients: req.MaxPatients,
		IsActive:    req.IsActive,
		Notes:       req.Notes,
	}

	if err := database.DB.Create(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat jadwal"})
		return
	}

	database.DB.Preload("Room").First(&schedule, schedule.ID)
	c.JSON(http.StatusCreated, gin.H{"data": schedule, "message": "Jadwal berhasil dibuat"})
}

// UpdateScheduleRequest represents the request to update a schedule
type UpdateScheduleRequest struct {
	DayOfWeek   int    `json:"day_of_week" binding:"min=0,max=6"`
	StartTime   string `json:"start_time" binding:"required"`
	EndTime     string `json:"end_time" binding:"required"`
	MaxPatients int    `json:"max_patients"`
	IsActive    bool   `json:"is_active"`
	Notes       string `json:"notes"`
}

// UpdateSchedule updates an existing schedule
func UpdateSchedule(c *gin.Context) {
	scheduleID, err := strconv.ParseUint(c.Param("schedule_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID jadwal tidak valid"})
		return
	}

	var schedule models.Schedule
	if err := database.DB.First(&schedule, scheduleID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal tidak ditemukan"})
		return
	}

	var req UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate time format
	if !isValidTimeFormat(req.StartTime) || !isValidTimeFormat(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid (gunakan HH:MM)"})
		return
	}

	// Validate start time < end time
	if req.StartTime >= req.EndTime {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai harus lebih awal dari waktu selesai"})
		return
	}

	// Check for overlapping schedules (excluding current)
	var existing []models.Schedule
	database.DB.Where("room_id = ? AND day_of_week = ? AND id != ?", schedule.RoomID, req.DayOfWeek, scheduleID).Find(&existing)
	for _, sch := range existing {
		if isTimeOverlap(req.StartTime, req.EndTime, sch.StartTime, sch.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal bertabrakan dengan jadwal yang sudah ada"})
			return
		}
	}

	schedule.DayOfWeek = req.DayOfWeek
	schedule.StartTime = req.StartTime
	schedule.EndTime = req.EndTime
	schedule.MaxPatients = req.MaxPatients
	schedule.IsActive = req.IsActive
	schedule.Notes = req.Notes

	if err := database.DB.Save(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui jadwal"})
		return
	}

	database.DB.Preload("Room").First(&schedule, schedule.ID)
	c.JSON(http.StatusOK, gin.H{"data": schedule, "message": "Jadwal berhasil diperbarui"})
}

// DeleteSchedule deletes a schedule
func DeleteSchedule(c *gin.Context) {
	scheduleID, err := strconv.ParseUint(c.Param("schedule_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID jadwal tidak valid"})
		return
	}

	var schedule models.Schedule
	if err := database.DB.First(&schedule, scheduleID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Jadwal berhasil dihapus"})
}

// BulkCreateScheduleRequest for creating multiple schedules at once
type BulkCreateScheduleRequest struct {
	RoomID    uint `json:"room_id" binding:"required"`
	Schedules []struct {
		DayOfWeek   int    `json:"day_of_week" binding:"min=0,max=6"`
		StartTime   string `json:"start_time" binding:"required"`
		EndTime     string `json:"end_time" binding:"required"`
		MaxPatients int    `json:"max_patients"`
		IsActive    bool   `json:"is_active"`
		Notes       string `json:"notes"`
	} `json:"schedules" binding:"required,min=1"`
}

// BulkCreateSchedules creates multiple schedules at once
func BulkCreateSchedules(c *gin.Context) {
	var req BulkCreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate room exists
	var room models.Room
	if err := database.DB.First(&room, req.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Get existing schedules for validation
	var existing []models.Schedule
	database.DB.Where("room_id = ?", req.RoomID).Find(&existing)

	// Validate all schedules first
	var schedulesToCreate []models.Schedule
	for i, sch := range req.Schedules {
		if !isValidTimeFormat(sch.StartTime) || !isValidTimeFormat(sch.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid pada jadwal ke-" + strconv.Itoa(i+1)})
			return
		}
		if sch.StartTime >= sch.EndTime {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai harus lebih awal dari waktu selesai pada jadwal ke-" + strconv.Itoa(i+1)})
			return
		}

		// Check overlap with existing
		for _, ex := range existing {
			if ex.DayOfWeek == sch.DayOfWeek && isTimeOverlap(sch.StartTime, sch.EndTime, ex.StartTime, ex.EndTime) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal ke-" + strconv.Itoa(i+1) + " bertabrakan dengan jadwal yang sudah ada"})
				return
			}
		}

		// Check overlap within request
		for j := 0; j < i; j++ {
			if req.Schedules[j].DayOfWeek == sch.DayOfWeek && isTimeOverlap(sch.StartTime, sch.EndTime, req.Schedules[j].StartTime, req.Schedules[j].EndTime) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Jadwal ke-" + strconv.Itoa(i+1) + " bertabrakan dengan jadwal ke-" + strconv.Itoa(j+1)})
				return
			}
		}

		schedulesToCreate = append(schedulesToCreate, models.Schedule{
			RoomID:      req.RoomID,
			DayOfWeek:   sch.DayOfWeek,
			StartTime:   sch.StartTime,
			EndTime:     sch.EndTime,
			MaxPatients: sch.MaxPatients,
			IsActive:    sch.IsActive,
			Notes:       sch.Notes,
		})
	}

	// Create all schedules
	if err := database.DB.Create(&schedulesToCreate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat jadwal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": schedulesToCreate, "message": "Jadwal berhasil dibuat"})
}

// ==============================
// DOCTOR SCHEDULE HANDLERS
// ==============================

// GetDoctorSchedulesRequest represents query params for doctor schedules
type GetDoctorSchedulesRequest struct {
	RoomID     uint  `form:"room_id"`
	EmployeeID uint  `form:"employee_id"`
	DayOfWeek  *int  `form:"day_of_week"`
	IsActive   *bool `form:"is_active"`
}

// GetDoctorSchedules gets all doctor schedules with optional filters
func GetDoctorSchedules(c *gin.Context) {
	var req GetDoctorSchedulesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := database.DB.Preload("Room").Preload("Employee")

	if req.RoomID > 0 {
		query = query.Where("room_id = ?", req.RoomID)
	}
	if req.EmployeeID > 0 {
		query = query.Where("employee_id = ?", req.EmployeeID)
	}
	if req.DayOfWeek != nil {
		query = query.Where("day_of_week = ?", *req.DayOfWeek)
	}
	if req.IsActive != nil {
		query = query.Where("is_active = ?", *req.IsActive)
	}

	var schedules []models.DoctorSchedule
	if err := query.Order("room_id, employee_id, day_of_week, start_time").Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jadwal dokter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

// GetRoomDoctorSchedules gets doctor schedules for a specific room
func GetRoomDoctorSchedules(c *gin.Context) {
	roomID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ruangan tidak valid"})
		return
	}

	// Check room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	var schedules []models.DoctorSchedule
	if err := database.DB.Where("room_id = ?", roomID).
		Preload("Employee").
		Order("day_of_week, start_time, employee_id").
		Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data jadwal dokter"})
		return
	}

	// Group by day of week
	dayNames := []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
	groupedSchedules := make(map[string][]models.DoctorSchedule)
	for _, day := range dayNames {
		groupedSchedules[day] = []models.DoctorSchedule{}
	}
	for _, schedule := range schedules {
		dayName := dayNames[schedule.DayOfWeek]
		groupedSchedules[dayName] = append(groupedSchedules[dayName], schedule)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    schedules,
		"grouped": groupedSchedules,
	})
}

// CreateDoctorScheduleRequest represents the request to create a doctor schedule
type CreateDoctorScheduleRequest struct {
	RoomID        uint       `json:"room_id" binding:"required"`
	EmployeeID    uint       `json:"employee_id" binding:"required"`
	DayOfWeek     int        `json:"day_of_week" binding:"min=0,max=6"`
	StartTime     string     `json:"start_time" binding:"required"`
	EndTime       string     `json:"end_time" binding:"required"`
	MaxPatients   int        `json:"max_patients"`
	ConsultFee    float64    `json:"consult_fee"`
	IsActive      bool       `json:"is_active"`
	EffectiveFrom *time.Time `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	Notes         string     `json:"notes"`
}

// CreateDoctorSchedule creates a new doctor schedule
func CreateDoctorSchedule(c *gin.Context) {
	var req CreateDoctorScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate room exists
	var room models.Room
	if err := database.DB.First(&room, req.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Validate employee exists and is a doctor
	var employee models.Employee
	if err := database.DB.First(&employee, req.EmployeeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}

	// Validate time format
	if !isValidTimeFormat(req.StartTime) || !isValidTimeFormat(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid (gunakan HH:MM)"})
		return
	}

	// Validate start time < end time
	if req.StartTime >= req.EndTime {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai harus lebih awal dari waktu selesai"})
		return
	}

	// Check for overlapping doctor schedules (same doctor, same day)
	var existing []models.DoctorSchedule
	database.DB.Where("employee_id = ? AND day_of_week = ?", req.EmployeeID, req.DayOfWeek).Find(&existing)
	for _, sch := range existing {
		if isTimeOverlap(req.StartTime, req.EndTime, sch.StartTime, sch.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter sudah memiliki jadwal di waktu yang sama"})
			return
		}
	}

	schedule := models.DoctorSchedule{
		RoomID:        req.RoomID,
		EmployeeID:    req.EmployeeID,
		DayOfWeek:     req.DayOfWeek,
		StartTime:     req.StartTime,
		EndTime:       req.EndTime,
		MaxPatients:   req.MaxPatients,
		ConsultFee:    req.ConsultFee,
		IsActive:      req.IsActive,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		Notes:         req.Notes,
	}

	if err := database.DB.Create(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat jadwal dokter"})
		return
	}

	database.DB.Preload("Room").Preload("Employee").First(&schedule, schedule.ID)
	c.JSON(http.StatusCreated, gin.H{"data": schedule, "message": "Jadwal dokter berhasil dibuat"})
}

// UpdateDoctorScheduleRequest represents the request to update a doctor schedule
type UpdateDoctorScheduleRequest struct {
	EmployeeID    uint       `json:"employee_id" binding:"required"`
	DayOfWeek     int        `json:"day_of_week" binding:"min=0,max=6"`
	StartTime     string     `json:"start_time" binding:"required"`
	EndTime       string     `json:"end_time" binding:"required"`
	MaxPatients   int        `json:"max_patients"`
	ConsultFee    float64    `json:"consult_fee"`
	IsActive      bool       `json:"is_active"`
	EffectiveFrom *time.Time `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	Notes         string     `json:"notes"`
}

// UpdateDoctorSchedule updates an existing doctor schedule
func UpdateDoctorSchedule(c *gin.Context) {
	scheduleID, err := strconv.ParseUint(c.Param("schedule_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID jadwal tidak valid"})
		return
	}

	var schedule models.DoctorSchedule
	if err := database.DB.First(&schedule, scheduleID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal dokter tidak ditemukan"})
		return
	}

	var req UpdateDoctorScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate employee exists
	var employee models.Employee
	if err := database.DB.First(&employee, req.EmployeeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan tidak ditemukan"})
		return
	}

	// Validate time format
	if !isValidTimeFormat(req.StartTime) || !isValidTimeFormat(req.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid (gunakan HH:MM)"})
		return
	}

	// Validate start time < end time
	if req.StartTime >= req.EndTime {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai harus lebih awal dari waktu selesai"})
		return
	}

	// Check for overlapping doctor schedules (excluding current)
	var existing []models.DoctorSchedule
	database.DB.Where("employee_id = ? AND day_of_week = ? AND id != ?", req.EmployeeID, req.DayOfWeek, scheduleID).Find(&existing)
	for _, sch := range existing {
		if isTimeOverlap(req.StartTime, req.EndTime, sch.StartTime, sch.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter sudah memiliki jadwal di waktu yang sama"})
			return
		}
	}

	schedule.EmployeeID = req.EmployeeID
	schedule.DayOfWeek = req.DayOfWeek
	schedule.StartTime = req.StartTime
	schedule.EndTime = req.EndTime
	schedule.MaxPatients = req.MaxPatients
	schedule.ConsultFee = req.ConsultFee
	schedule.IsActive = req.IsActive
	schedule.EffectiveFrom = req.EffectiveFrom
	schedule.EffectiveTo = req.EffectiveTo
	schedule.Notes = req.Notes

	if err := database.DB.Save(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui jadwal dokter"})
		return
	}

	database.DB.Preload("Room").Preload("Employee").First(&schedule, schedule.ID)
	c.JSON(http.StatusOK, gin.H{"data": schedule, "message": "Jadwal dokter berhasil diperbarui"})
}

// DeleteDoctorSchedule deletes a doctor schedule
func DeleteDoctorSchedule(c *gin.Context) {
	scheduleID, err := strconv.ParseUint(c.Param("schedule_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID jadwal tidak valid"})
		return
	}

	var schedule models.DoctorSchedule
	if err := database.DB.First(&schedule, scheduleID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Jadwal dokter tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus jadwal dokter"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Jadwal dokter berhasil dihapus"})
}

// ==============================
// SCHEDULE EXCEPTION HANDLERS
// ==============================

// CreateScheduleExceptionRequest represents the request to create an exception
type CreateScheduleExceptionRequest struct {
	RoomID        *uint   `json:"room_id"`
	EmployeeID    *uint   `json:"employee_id"`
	ExceptionDate string  `json:"exception_date" binding:"required"` // Format: YYYY-MM-DD
	ExceptionType string  `json:"exception_type" binding:"required"` // closed, modified, holiday
	StartTime     *string `json:"start_time"`
	EndTime       *string `json:"end_time"`
	Reason        string  `json:"reason"`
	IsActive      bool    `json:"is_active"`
}

// CreateScheduleException creates a schedule exception
func CreateScheduleException(c *gin.Context) {
	var req CreateScheduleExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse date
	exceptionDate, err := time.Parse("2006-01-02", req.ExceptionDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid (gunakan YYYY-MM-DD)"})
		return
	}

	// Validate exception type
	validTypes := map[string]bool{"closed": true, "modified": true, "holiday": true}
	if !validTypes[req.ExceptionType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipe pengecualian tidak valid"})
		return
	}

	// If modified, require start and end time
	if req.ExceptionType == "modified" {
		if req.StartTime == nil || req.EndTime == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai dan selesai diperlukan untuk jadwal modifikasi"})
			return
		}
		if !isValidTimeFormat(*req.StartTime) || !isValidTimeFormat(*req.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format waktu tidak valid (gunakan HH:MM)"})
			return
		}
	}

	exception := models.ScheduleException{
		RoomID:        req.RoomID,
		EmployeeID:    req.EmployeeID,
		ExceptionDate: exceptionDate,
		ExceptionType: req.ExceptionType,
		StartTime:     req.StartTime,
		EndTime:       req.EndTime,
		Reason:        req.Reason,
		IsActive:      req.IsActive,
	}

	if err := database.DB.Create(&exception).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat pengecualian jadwal"})
		return
	}

	database.DB.Preload("Room").Preload("Employee").First(&exception, exception.ID)
	c.JSON(http.StatusCreated, gin.H{"data": exception, "message": "Pengecualian jadwal berhasil dibuat"})
}

// GetScheduleExceptions gets schedule exceptions
func GetScheduleExceptions(c *gin.Context) {
	roomID := c.Query("room_id")
	employeeID := c.Query("employee_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	query := database.DB.Preload("Room").Preload("Employee")

	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}
	if employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if startDate != "" {
		query = query.Where("exception_date >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("exception_date <= ?", endDate)
	}

	var exceptions []models.ScheduleException
	if err := query.Order("exception_date DESC").Find(&exceptions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data pengecualian jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": exceptions})
}

// DeleteScheduleException deletes a schedule exception
func DeleteScheduleException(c *gin.Context) {
	exceptionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var exception models.ScheduleException
	if err := database.DB.First(&exception, exceptionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pengecualian jadwal tidak ditemukan"})
		return
	}

	if err := database.DB.Delete(&exception).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pengecualian jadwal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pengecualian jadwal berhasil dihapus"})
}

// GetAvailableDoctorsByDate godoc
// @Summary Get available doctors for a room on a specific date
// @Description Get list of doctors who have schedule at the specified room on the given date
// @Tags Schedule
// @Accept json
// @Produce json
// @Param room_id query int true "Room ID"
// @Param date query string true "Date in YYYY-MM-DD format"
// @Success 200 {object} map[string]interface{}
// @Router /schedules/available-doctors [get]
func GetAvailableDoctorsByDate(c *gin.Context) {
	roomIDStr := c.Query("room_id")
	dateStr := c.Query("date")

	if roomIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id wajib diisi"})
		return
	}

	if dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date wajib diisi"})
		return
	}

	roomID, err := strconv.ParseUint(roomIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room_id tidak valid"})
		return
	}

	// Parse the date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid (gunakan YYYY-MM-DD)"})
		return
	}

	// Get day of week for the date
	dayOfWeek := int(date.Weekday())

	// Debug logging
	log.Printf("[DEBUG] GetAvailableDoctorsByDate: room_id=%d, date=%s, dayOfWeek=%d", roomID, dateStr, dayOfWeek)

	// Check if room exists
	var room models.Room
	if err := database.DB.First(&room, roomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Get doctor schedules for this room on the day of week
	var schedules []models.DoctorSchedule
	query := database.DB.Where("room_id = ? AND day_of_week = ? AND is_active = ?", roomID, dayOfWeek, true).
		Preload("Employee")

	// Check effective date range - use date string for comparison to avoid timezone issues
	query = query.Where("(effective_from IS NULL OR DATE(effective_from) <= ?) AND (effective_to IS NULL OR DATE(effective_to) >= ?)", dateStr, dateStr)

	if err := query.Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil jadwal dokter"})
		return
	}

	// Debug logging
	log.Printf("[DEBUG] Found %d doctor schedules for room %d on day %d", len(schedules), roomID, dayOfWeek)

	// Check for schedule exceptions (holidays, doctor leave, etc.)
	var exceptions []models.ScheduleException
	database.DB.Where("exception_date = ? AND is_active = ?", date, true).
		Where("(room_id IS NULL OR room_id = ?) AND exception_type = 'closed'", roomID).
		Find(&exceptions)

	// Filter out doctors with exceptions
	exceptedEmployeeIDs := make(map[uint]bool)
	roomClosed := false
	for _, exc := range exceptions {
		if exc.EmployeeID != nil {
			exceptedEmployeeIDs[*exc.EmployeeID] = true
		}
		if exc.RoomID != nil && exc.EmployeeID == nil {
			roomClosed = true
		}
	}

	// Build response
	type DoctorAvailability struct {
		EmployeeID   uint    `json:"employee_id"`
		EmployeeName string  `json:"employee_name"`
		StartTime    string  `json:"start_time"`
		EndTime      string  `json:"end_time"`
		MaxPatients  int     `json:"max_patients"`
		ConsultFee   float64 `json:"consult_fee"`
	}

	var availableDoctors []DoctorAvailability

	if !roomClosed {
		for _, schedule := range schedules {
			if exceptedEmployeeIDs[schedule.EmployeeID] {
				continue // Skip doctors with exception on this date
			}

			employeeName := ""
			if schedule.Employee != nil {
				employeeName = schedule.Employee.NamaLengkap
			}

			availableDoctors = append(availableDoctors, DoctorAvailability{
				EmployeeID:   schedule.EmployeeID,
				EmployeeName: employeeName,
				StartTime:    schedule.StartTime,
				EndTime:      schedule.EndTime,
				MaxPatients:  schedule.MaxPatients,
				ConsultFee:   schedule.ConsultFee,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": availableDoctors,
		"room": gin.H{
			"id":   room.ID,
			"name": room.Name,
			"code": room.Code,
		},
		"date":        dateStr,
		"day_of_week": dayOfWeek,
		"room_closed": roomClosed,
	})
}

// ==============================
// HELPER FUNCTIONS
// ==============================

// isValidTimeFormat checks if time string is in HH:MM format
func isValidTimeFormat(timeStr string) bool {
	if len(timeStr) != 5 {
		return false
	}
	_, err := time.Parse("15:04", timeStr)
	return err == nil
}

// isTimeOverlap checks if two time ranges overlap
func isTimeOverlap(start1, end1, start2, end2 string) bool {
	// If start1 < end2 AND start2 < end1, they overlap
	return start1 < end2 && start2 < end1
}
