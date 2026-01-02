package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// GetVisits returns all visits with filters
func GetVisits(c *gin.Context) {
	var visits []models.Visit

	query := database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").Preload("Bed")

	// Filter by registration_id
	if registrationID := c.Query("registration_id"); registrationID != "" {
		query = query.Where("registration_id = ?", registrationID)
	}

	// Filter by room_id
	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by patient_id (through registration)
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Joins("JOIN registrations ON registrations.id = visits.registration_id").
			Where("registrations.patient_id = ?", patientID)
	}

	// Filter by visit_type
	if visitType := c.Query("visit_type"); visitType != "" {
		query = query.Where("visit_type = ?", visitType)
	}

	// Filter by status (support comma-separated values for multiple statuses)
	if status := c.Query("status"); status != "" {
		// Check if status contains comma (multiple statuses)
		if strings.Contains(status, ",") {
			statuses := strings.Split(status, ",")
			query = query.Where("status IN ?", statuses)
		} else {
			query = query.Where("status = ?", status)
		}
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(check_in_time) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(check_in_time) <= ?", endDate)
	}

	// Order by check-in time descending (newest first)
	query = query.Order("check_in_time DESC")

	if err := query.Find(&visits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, visits)
}

// GetVisit returns a single visit by ID
func GetVisit(c *gin.Context) {
	id := c.Param("id")
	var visit models.Visit

	if err := database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").Preload("Bed").
		First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	c.JSON(http.StatusOK, visit)
}

// CreateVisit creates a new visit and optionally a room queue
func CreateVisit(c *gin.Context) {
	var input struct {
		RegistrationID uint   `json:"registration_id" binding:"required"`
		RoomID         uint   `json:"room_id" binding:"required"`
		DoctorID       *uint  `json:"doctor_id"`
		VisitType      string `json:"visit_type" binding:"required"`
		VisitPurpose   string `json:"visit_purpose"`
		ReferralFrom   *uint  `json:"referral_from"`
		Complaint      string `json:"complaint"`
		Notes          string `json:"notes"`
		CreateQueue    bool   `json:"create_queue"` // Auto-create room queue
		QueuePriority  string `json:"queue_priority"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate registration exists
	var registration models.Registration
	if err := database.DB.First(&registration, input.RegistrationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	// Validate room exists
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Validate doctor if provided
	if input.DoctorID != nil {
		var doctor models.Employee
		if err := database.DB.First(&doctor, *input.DoctorID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Doctor not found"})
			return
		}
	}

	// Generate visit number
	today := time.Now().Format("20060102")
	var lastVisit models.Visit
	var visitNum int

	err := database.DB.Where("visit_number LIKE ?", "VIS"+today+"%").
		Order("visit_number DESC").First(&lastVisit).Error

	if err != nil {
		visitNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastVisit.VisitNumber, "VIS"+today+"%d", &lastNum)
		visitNum = lastNum + 1
	}

	visitNumber := fmt.Sprintf("VIS%s%04d", today, visitNum)

	// Create visit
	now := time.Now()
	visit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: input.RegistrationID,
		RoomID:         input.RoomID,
		DoctorID:       input.DoctorID,
		VisitType:      input.VisitType,
		VisitPurpose:   input.VisitPurpose,
		ReferralFrom:   input.ReferralFrom,
		Status:         models.VisitStatusWaiting,
		CheckInTime:    &now,
		Complaint:      input.Complaint,
		Notes:          input.Notes,
	}

	// Start transaction
	tx := database.DB.Begin()

	if err := tx.Create(&visit).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create room queue if requested
	var queue *models.RoomQueue
	if input.CreateQueue {
		queueCode := room.QueueCode
		if queueCode == "" {
			queueCode = "Q"
		}

		// Get last queue number for this room today
		todayDate := time.Now().Format("2006-01-02")
		parsedDate, _ := time.Parse("2006-01-02", todayDate)
		var lastQueue models.RoomQueue
		var queueNum int

		err := tx.Where("room_id = ? AND queue_date = ?", input.RoomID, parsedDate).
			Order("queue_number DESC").First(&lastQueue).Error

		if err != nil {
			queueNum = 1
		} else {
			var lastNum int
			fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
			queueNum = lastNum + 1
		}

		queueNumber := fmt.Sprintf("%s%03d", queueCode, queueNum)

		priority := input.QueuePriority
		if priority == "" {
			priority = models.PriorityNormal
		}

		queue = &models.RoomQueue{
			QueueNumber: queueNumber,
			QueueCode:   queueCode,
			QueueDate:   parsedDate,
			VisitID:     visit.ID,
			RoomID:      input.RoomID,
			Priority:    priority,
			Status:      models.RoomQueueStatusWaiting,
		}

		if err := tx.Create(queue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room queue"})
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Load relationships
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	// Send real-time notification to room users
	if NotifService != nil {
		patientName := ""
		if visit.Registration != nil && visit.Registration.Patient != nil {
			patientName = visit.Registration.Patient.NamaLengkap
		}
		roomName := ""
		if visit.Room != nil {
			roomName = visit.Room.Name
		}

		go NotifService.NotifyRoomUsers(
			input.RoomID,
			models.NotificationTypeVisitCreated,
			"Pasien Baru",
			fmt.Sprintf("Pasien %s telah terdaftar ke %s", patientName, roomName),
			map[string]interface{}{
				"visit_id":   visit.ID,
				"patient_id": visit.Registration.PatientID,
				"room_id":    visit.RoomID,
				"visit_type": visit.VisitType,
			},
		)
	}

	response := gin.H{
		"visit": visit,
	}

	if queue != nil {
		database.DB.Preload("Visit").Preload("Visit.Patient").Preload("Room").
			First(queue, queue.ID)
		response["room_queue"] = queue
	}

	c.JSON(http.StatusCreated, response)
}

// UpdateVisit updates a visit
func UpdateVisit(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		DoctorID     *uint  `json:"doctor_id"`
		Status       string `json:"status"`
		VisitPurpose string `json:"visit_purpose"`
		Complaint    string `json:"complaint"`
		Diagnosis    string `json:"diagnosis"`
		Treatment    string `json:"treatment"`
		Notes        string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Validate status if provided
	if input.Status != "" {
		validStatuses := []string{
			models.VisitStatusWaiting,
			models.VisitStatusInQueue,
			models.VisitStatusInProgress,
			models.VisitStatusCompleted,
			models.VisitStatusCancelled,
		}

		valid := false
		for _, s := range validStatuses {
			if input.Status == s {
				valid = true
				break
			}
		}

		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}

		// Prevent completing pharmacy visit if there are pending medicine orders
		if input.Status == models.VisitStatusCompleted && visit.Room != nil && visit.Room.ServiceType == "farmasi" {
			var pendingOrderCount int64
			database.DB.Model(&models.MedicineOrder{}).
				Where("pharmacy_visit_id = ? AND status NOT IN (?, ?)", visit.ID, models.OrderStatusDelivered, models.OrderStatusCancelled).
				Count(&pendingOrderCount)

			if pendingOrderCount > 0 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":                "Tidak dapat menyelesaikan kunjungan. Masih ada resep yang belum diserahkan.",
					"pending_orders_count": pendingOrderCount,
				})
				return
			}
		}

		visit.Status = input.Status

		// Update timestamps based on status
		now := time.Now()
		switch input.Status {
		case models.VisitStatusInProgress:
			if visit.StartTime == nil {
				visit.StartTime = &now
			}
		case models.VisitStatusCompleted:
			if visit.StartTime == nil {
				visit.StartTime = &now
			}
			visit.EndTime = &now
		}
	}

	// Update other fields
	if input.DoctorID != nil {
		visit.DoctorID = input.DoctorID
	}
	if input.VisitPurpose != "" {
		visit.VisitPurpose = input.VisitPurpose
	}
	if input.Complaint != "" {
		visit.Complaint = input.Complaint
	}
	if input.Diagnosis != "" {
		visit.Diagnosis = input.Diagnosis
	}
	if input.Treatment != "" {
		visit.Treatment = input.Treatment
	}
	if input.Notes != "" {
		visit.Notes = input.Notes
	}

	if err := database.DB.Save(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Load relationships
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	c.JSON(http.StatusOK, visit)
}

// AcceptVisit accepts a patient for visit (transitions status to in_progress)
func AcceptVisit(c *gin.Context) {
	id := c.Param("id")

	var visit models.Visit
	if err := database.DB.Preload("RoomQueue").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Validate current status
	// Can accept if status is in_queue (called) or waiting (for UGD without queue)
	if visit.Status != models.VisitStatusInQueue && visit.Status != models.VisitStatusWaiting {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Visit cannot be accepted in current status"})
		return
	}

	// Update visit status to in_progress
	visit.Status = models.VisitStatusInProgress

	// Set start time if not already set
	now := time.Now()
	if visit.StartTime == nil {
		visit.StartTime = &now
	}

	// Start transaction
	tx := database.DB.Begin()

	if err := tx.Save(&visit).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update room queue status to serving if exists
	if visit.RoomQueue != nil {
		visit.RoomQueue.Status = models.RoomQueueStatusServing
		if err := tx.Save(&visit.RoomQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()

	// Load relationships
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	c.JSON(http.StatusOK, visit)
}

// CompleteVisit marks a visit as completed
func CompleteVisit(c *gin.Context) {
	id := c.Param("id")
	var visit models.Visit

	if err := database.DB.Preload("Registration").Preload("RoomQueue").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Check if visit is already completed
	if visit.Status == models.VisitStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan sudah selesai"})
		return
	}

	// Update status to completed
	now := time.Now()
	visit.Status = models.VisitStatusCompleted
	visit.EndTime = &now

	if err := database.DB.Save(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan kunjungan"})
		return
	}

	// Update room queue if exists
	if visit.RoomQueue != nil {
		visit.RoomQueue.Status = "completed"
		visit.RoomQueue.CompletedAt = &now
		database.DB.Save(visit.RoomQueue)
	}

	// Load relationships for response
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	c.JSON(http.StatusOK, visit)
}

// CancelVisit cancels a visit and its related queues
// @Summary Cancel a visit
// @Description Cancel a visit and its room queue
// @Tags Visits
// @Accept json
// @Produce json
// @Param id path int true "Visit ID"
// @Success 200 {object} map[string]interface{}
// @Router /visits/{id}/cancel [post]
func CancelVisit(c *gin.Context) {
	id := c.Param("id")
	var visit models.Visit

	if err := database.DB.Preload("Registration").Preload("Room").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	if visit.Status == "completed" || visit.Status == "discharged" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan yang sudah selesai tidak bisa dibatalkan"})
		return
	}

	if visit.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan sudah dibatalkan"})
		return
	}

	tx := database.DB.Begin()

	// Cancel room queue if exists
	tx.Model(&models.RoomQueue{}).
		Where("visit_id = ?", visit.ID).
		Update("status", "cancelled")

	// Release bed if this is an inpatient visit with a bed assigned
	if visit.BedID != nil && *visit.BedID > 0 {
		tx.Model(&models.Bed{}).Where("id = ?", *visit.BedID).Update("status", "available")
	}

	// Cancel any pending medicine orders from this visit
	tx.Model(&models.MedicineOrder{}).
		Where("source_visit_id = ? AND status = ?", visit.ID, models.OrderStatusPending).
		Update("status", models.OrderStatusCancelled)

	// Cancel any pending procedure orders from this visit
	tx.Model(&models.ProcedureOrder{}).
		Where("source_visit_id = ? AND status = ?", visit.ID, models.OrderStatusPending).
		Update("status", models.OrderStatusCancelled)

	// Cancel the visit
	visit.Status = "cancelled"
	tx.Save(&visit)

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan kunjungan"})
		return
	}

	// Reload with associations
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":    visit,
		"message": "Kunjungan berhasil dibatalkan",
	})
}

// CancelCompleteVisit reverts a completed visit back to in_progress
func CancelCompleteVisit(c *gin.Context) {
	id := c.Param("id")
	var visit models.Visit

	if err := database.DB.Preload("Registration").Preload("RoomQueue").First(&visit, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Check if visit is completed
	if visit.Status != models.VisitStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan belum diselesaikan"})
		return
	}

	// Check if registration is already completed/discharged
	if visit.Registration != nil &&
		(visit.Registration.Status == "completed" || visit.Registration.Status == "discharged") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat membatalkan final karena pasien sudah pulang"})
		return
	}

	// Revert status to in_progress
	visit.Status = models.VisitStatusInProgress
	visit.EndTime = nil

	if err := database.DB.Save(&visit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan final kunjungan"})
		return
	}

	// Update room queue if exists
	if visit.RoomQueue != nil {
		visit.RoomQueue.Status = "serving"
		visit.RoomQueue.CompletedAt = nil
		database.DB.Save(visit.RoomQueue)
	}

	// Load relationships for response
	database.DB.Preload("Registration").Preload("Registration.Patient").
		Preload("Room").Preload("Doctor").Preload("RoomQueue").
		First(&visit, visit.ID)

	c.JSON(http.StatusOK, visit)
}

// GetVisitStats returns statistics for visits
func GetVisitStats(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	roomID := c.Query("room_id")

	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	if endDate == "" {
		endDate = startDate
	}

	query := database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ?", startDate, endDate)

	if roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	var stats struct {
		TotalVisits      int64 `json:"total_visits"`
		WaitingVisits    int64 `json:"waiting_visits"`
		InQueueVisits    int64 `json:"in_queue_visits"`
		InProgressVisits int64 `json:"in_progress_visits"`
		CompletedVisits  int64 `json:"completed_visits"`
		CancelledVisits  int64 `json:"cancelled_visits"`
	}

	// Total visits
	query.Count(&stats.TotalVisits)

	// By status
	database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ? AND status = ?", startDate, endDate, models.VisitStatusWaiting).
		Count(&stats.WaitingVisits)

	database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ? AND status = ?", startDate, endDate, models.VisitStatusInQueue).
		Count(&stats.InQueueVisits)

	database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ? AND status = ?", startDate, endDate, models.VisitStatusInProgress).
		Count(&stats.InProgressVisits)

	database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ? AND status = ?", startDate, endDate, models.VisitStatusCompleted).
		Count(&stats.CompletedVisits)

	database.DB.Model(&models.Visit{}).
		Where("DATE(check_in_time) BETWEEN ? AND ? AND status = ?", startDate, endDate, models.VisitStatusCancelled).
		Count(&stats.CancelledVisits)

	// Visit type breakdown
	var typeStats []struct {
		VisitType string `json:"visit_type"`
		Count     int64  `json:"count"`
	}
	database.DB.Model(&models.Visit{}).
		Select("visit_type, COUNT(*) as count").
		Where("DATE(check_in_time) BETWEEN ? AND ?", startDate, endDate).
		Group("visit_type").
		Scan(&typeStats)

	c.JSON(http.StatusOK, gin.H{
		"summary": stats,
		"by_type": typeStats,
		"date_range": gin.H{
			"start_date": startDate,
			"end_date":   endDate,
		},
	})
}
