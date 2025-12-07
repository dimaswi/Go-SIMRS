package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"starter/backend/database"
	"starter/backend/models"
)

// GetRegistrations godoc
// @Summary Get all registrations
// @Description Get list of registrations with optional filters
// @Tags Registration
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param date query string false "Filter by date (YYYY-MM-DD)"
// @Param status query string false "Filter by status"
// @Param patient_id query int false "Filter by patient"
// @Param destination_room_id query int false "Filter by destination room"
// @Success 200 {object} map[string]interface{}
// @Router /registrations [get]
func GetRegistrations(c *gin.Context) {
	var registrations []models.Registration
	query := database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		Preload("Visit").Preload("Visit.RoomQueue")

	// Filter by date
	if dateStr := c.Query("date"); dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			startOfDay := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, parsed.Location())
			endOfDay := startOfDay.Add(24 * time.Hour)
			query = query.Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay)
		}
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("patient_id = ?", patientID)
	}
	if roomID := c.Query("destination_room_id"); roomID != "" {
		query = query.Where("destination_room_id = ?", roomID)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Registration{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&registrations)

	c.JSON(http.StatusOK, gin.H{
		"data": registrations,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetRegistration godoc
// @Summary Get a registration by ID
// @Description Get registration details by ID
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id} [get]
func GetRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		Preload("Visit").Preload("Visit.RoomQueue").
		First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": registration})
}

// CreateRegistrationInput represents input for creating a registration
type CreateRegistrationInput struct {
	QueueID           *uint  `json:"queue_id"`                               // Link to queue
	PatientID         uint   `json:"patient_id" binding:"required"`          // Patient is required
	RegistrationType  string `json:"registration_type"`                      // outpatient, inpatient, emergency
	DestinationRoomID uint   `json:"destination_room_id" binding:"required"` // Destination room
	DoctorID          *uint  `json:"doctor_id"`                              // Doctor
	PaymentMethod     string `json:"payment_method" binding:"required"`      // cash, bpjs, insurance
	BPJSNumber        string `json:"bpjs_number"`                            // BPJS number if applicable
	InsuranceName     string `json:"insurance_name"`                         // Insurance name
	InsuranceNumber   string `json:"insurance_number"`                       // Insurance policy number
	Complaint         string `json:"complaint"`                              // Chief complaint
	Notes             string `json:"notes"`                                  // Additional notes
	CreateVisit       bool   `json:"create_visit"`                           // Auto-create visit
	CreateRoomQueue   bool   `json:"create_room_queue"`                      // Auto-create room queue
	QueuePriority     string `json:"queue_priority"`                         // Queue priority (normal, urgent, emergency)
}

// CreateRegistration godoc
// @Summary Create a new registration
// @Description Create a new patient registration
// @Tags Registration
// @Accept json
// @Produce json
// @Param input body CreateRegistrationInput true "Registration data"
// @Success 201 {object} map[string]interface{}
// @Router /registrations [post]
func CreateRegistration(c *gin.Context) {
	var input CreateRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Validate patient exists
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Validate destination room exists
	var room models.Room
	if err := database.DB.First(&room, input.DestinationRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tujuan tidak ditemukan"})
		return
	}

	// Validate doctor if provided
	if input.DoctorID != nil {
		var doctor models.Employee
		if err := database.DB.First(&doctor, *input.DoctorID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak ditemukan"})
			return
		}

		// Check if doctor is assigned to the selected room
		var roomStaff models.RoomStaff
		err := database.DB.Where("room_id = ? AND employee_id = ?", input.DestinationRoomID, *input.DoctorID).
			Where("end_date IS NULL OR end_date >= ?", time.Now()).
			First(&roomStaff).Error
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak terdaftar di ruangan yang dipilih"})
			return
		}

		// Verify doctor is actually a doctor
		if doctor.TipeKaryawan != "dokter" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan yang dipilih bukan dokter"})
			return
		}
	}

	// Validate BPJS number if payment method is BPJS
	if input.PaymentMethod == "bpjs" && input.BPJSNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor BPJS wajib diisi untuk metode pembayaran BPJS"})
		return
	}

	// Validate insurance if payment method is insurance
	if input.PaymentMethod == "insurance" && (input.InsuranceName == "" || input.InsuranceNumber == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama dan nomor asuransi wajib diisi untuk metode pembayaran asuransi"})
		return
	}

	// Check for duplicate registration (same patient, same day, same room, not cancelled)
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var existingRegistration models.Registration
	err := database.DB.Where(
		"patient_id = ? AND destination_room_id = ? AND registration_date >= ? AND registration_date < ? AND status != ?",
		input.PatientID, input.DestinationRoomID, startOfDay, endOfDay, "cancelled",
	).First(&existingRegistration).Error

	if err == nil {
		// Found existing registration
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Pasien dengan No. RM %s sudah terdaftar di ruangan ini hari ini (No. Pendaftaran: %s)",
				patient.NoRM, existingRegistration.RegistrationNumber),
		})
		return
	}

	// Set default registration type
	if input.RegistrationType == "" {
		input.RegistrationType = "outpatient"
	}

	// Generate registration number
	regNumber := generateRegistrationNumber()

	// Count visit number for this patient
	var visitCount int64
	database.DB.Model(&models.Registration{}).Where("patient_id = ?", input.PatientID).Count(&visitCount)

	registration := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   startOfDay,
		RegistrationType:   input.RegistrationType,
		PatientID:          input.PatientID,
		QueueID:            input.QueueID,
		DestinationRoomID:  input.DestinationRoomID,
		DoctorID:           input.DoctorID,
		PaymentMethod:      input.PaymentMethod,
		BPJSNumber:         input.BPJSNumber,
		InsuranceName:      input.InsuranceName,
		InsuranceNumber:    input.InsuranceNumber,
		Complaint:          input.Complaint,
		Status:             "registered",
		RegisteredByID:     userID.(uint),
		Notes:              input.Notes,
		VisitNumber:        int(visitCount + 1),
	}

	tx := database.DB.Begin()

	if err := tx.Create(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat pendaftaran"})
		return
	}

	// Create visit and room queue if requested
	var visit *models.Visit
	var roomQueue *models.RoomQueue

	if input.CreateVisit {
		// Generate visit number
		todayStr := time.Now().Format("20060102")
		var lastVisit models.Visit
		var visitNum int

		err := tx.Where("visit_number LIKE ?", "VIS"+todayStr+"%").
			Order("visit_number DESC").First(&lastVisit).Error

		if err != nil {
			visitNum = 1
		} else {
			var lastNum int
			fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &lastNum)
			visitNum = lastNum + 1
		}

		visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)
		now := time.Now()

		visit = &models.Visit{
			VisitNumber:    visitNumber,
			RegistrationID: registration.ID,
			RoomID:         input.DestinationRoomID,
			DoctorID:       input.DoctorID,
			VisitType:      "consultation", // Default to consultation
			VisitPurpose:   "Pemeriksaan",
			Status:         models.VisitStatusWaiting,
			CheckInTime:    &now,
			Complaint:      input.Complaint,
			Notes:          input.Notes,
		}

		if err := tx.Create(visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan"})
			return
		}

		// Create room queue if requested
		if input.CreateRoomQueue {
			queueCode := room.QueueCode
			if queueCode == "" {
				queueCode = "Q"
			}

			todayDate := time.Now().Format("2006-01-02")
			parsedDate, _ := time.Parse("2006-01-02", todayDate)
			var lastQueue models.RoomQueue
			var queueNum int

			err := tx.Where("room_id = ? AND queue_date = ?", input.DestinationRoomID, parsedDate).
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

			roomQueue = &models.RoomQueue{
				QueueNumber: queueNumber,
				QueueCode:   queueCode,
				QueueDate:   parsedDate,
				VisitID:     visit.ID,
				RoomID:      input.DestinationRoomID,
				Priority:    priority,
				Status:      models.RoomQueueStatusWaiting,
			}

			if err := tx.Create(roomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian ruangan"})
				return
			}

			// Update visit status to in_queue
			visit.Status = models.VisitStatusInQueue
			tx.Save(visit)
		}
	}

	// Update queue status if queue_id is provided
	if input.QueueID != nil {
		var queue models.Queue
		if err := tx.First(&queue, *input.QueueID).Error; err == nil {
			// Update queue to serving status
			queue.Status = "serving"
			now := time.Now()
			queue.ServicedAt = &now
			tx.Save(&queue)
		}
	}

	tx.Commit()

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		Preload("Visits").Preload("Visits.RoomQueue").
		First(&registration, registration.ID)

	response := gin.H{
		"data": registration,
	}

	if visit != nil {
		// Reload visit with associations
		database.DB.Preload("Registration").Preload("Registration.Patient").
			Preload("Room").Preload("Doctor").Preload("RoomQueue").
			First(visit, visit.ID)
		response["visit"] = visit
	}

	if roomQueue != nil {
		// Reload room queue with associations
		database.DB.Preload("Visit").Preload("Visit.Patient").Preload("Room").
			First(roomQueue, roomQueue.ID)
		response["room_queue"] = roomQueue
	}

	c.JSON(http.StatusCreated, response)
}

// generateRegistrationNumber generates a unique registration number
func generateRegistrationNumber() string {
	today := time.Now()
	year := today.Format("2006")
	month := today.Format("01")
	day := today.Format("02")

	var lastReg models.Registration
	var nextNumber int64 = 1

	// Find the last registration number for today
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	if err := database.DB.Unscoped().
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Order("registration_number DESC").
		First(&lastReg).Error; err == nil {
		// Extract the number from the last registration_number
		var lastNum int64
		fmt.Sscanf(lastReg.RegistrationNumber, "REG-"+year+month+day+"-%04d", &lastNum)
		nextNumber = lastNum + 1
	}

	return fmt.Sprintf("REG-%s%s%s-%04d", year, month, day, nextNumber)
}

// UpdateRegistrationInput represents input for updating a registration
type UpdateRegistrationInput struct {
	DestinationRoomID *uint   `json:"destination_room_id"`
	DoctorID          *uint   `json:"doctor_id"`
	PaymentMethod     *string `json:"payment_method"`
	BPJSNumber        *string `json:"bpjs_number"`
	InsuranceName     *string `json:"insurance_name"`
	InsuranceNumber   *string `json:"insurance_number"`
	Complaint         *string `json:"complaint"`
	Status            *string `json:"status"`
	Notes             *string `json:"notes"`
}

// UpdateRegistration godoc
// @Summary Update a registration
// @Description Update registration details
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Param input body UpdateRegistrationInput true "Update data"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id} [put]
func UpdateRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	// Only allow updates for certain statuses
	if registration.Status == "completed" || registration.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran yang sudah selesai atau dibatalkan tidak bisa diubah"})
		return
	}

	var input UpdateRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})

	if input.DestinationRoomID != nil {
		updates["destination_room_id"] = *input.DestinationRoomID
	}
	if input.DoctorID != nil {
		updates["doctor_id"] = *input.DoctorID
	}
	if input.PaymentMethod != nil {
		updates["payment_method"] = *input.PaymentMethod
	}
	if input.BPJSNumber != nil {
		updates["bpjs_number"] = *input.BPJSNumber
	}
	if input.InsuranceName != nil {
		updates["insurance_name"] = *input.InsuranceName
	}
	if input.InsuranceNumber != nil {
		updates["insurance_number"] = *input.InsuranceNumber
	}
	if input.Complaint != nil {
		updates["complaint"] = *input.Complaint
	}
	if input.Status != nil {
		updates["status"] = *input.Status
	}
	if input.Notes != nil {
		updates["notes"] = *input.Notes
	}

	database.DB.Model(&registration).Updates(updates)

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		First(&registration, registration.ID)

	c.JSON(http.StatusOK, gin.H{"data": registration})
}

// CancelRegistration godoc
// @Summary Cancel a registration
// @Description Cancel a registration
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/cancel [post]
func CancelRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	if registration.Status == "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran yang sudah selesai tidak bisa dibatalkan"})
		return
	}

	registration.Status = "cancelled"
	database.DB.Save(&registration)

	c.JSON(http.StatusOK, gin.H{"data": registration})
}

// CompleteRegistration godoc
// @Summary Complete a registration
// @Description Mark a registration as completed
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/complete [post]
func CompleteRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	if registration.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran yang dibatalkan tidak bisa diselesaikan"})
		return
	}

	registration.Status = "completed"
	database.DB.Save(&registration)

	c.JSON(http.StatusOK, gin.H{"data": registration})
}

// GetPatientRegistrations godoc
// @Summary Get registrations for a patient
// @Description Get all registrations for a specific patient
// @Tags Registration
// @Accept json
// @Produce json
// @Param patientId path int true "Patient ID"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} map[string]interface{}
// @Router /patients/{patientId}/registrations [get]
func GetPatientRegistrations(c *gin.Context) {
	patientID := c.Param("patientId")

	var registrations []models.Registration
	query := database.DB.Preload("DestinationRoom").Preload("Doctor").Preload("RegisteredBy").
		Where("patient_id = ?", patientID)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Registration{}).Count(&total)

	query.Order("registration_date DESC").Limit(limit).Offset(offset).Find(&registrations)

	c.JSON(http.StatusOK, gin.H{
		"data": registrations,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetTodayRegistrations godoc
// @Summary Get today's registrations
// @Description Get all registrations for today
// @Tags Registration
// @Accept json
// @Produce json
// @Param destination_room_id query int false "Filter by destination room"
// @Param status query string false "Filter by status"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/today [get]
func GetTodayRegistrations(c *gin.Context) {
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var registrations []models.Registration
	query := database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		Preload("Visit").Preload("Visit.RoomQueue").
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay)

	if roomID := c.Query("destination_room_id"); roomID != "" {
		query = query.Where("destination_room_id = ?", roomID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	query.Order("created_at ASC").Find(&registrations)

	// Get summary counts
	var registered, inProgress, completed, cancelled int64
	database.DB.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Where("status = ?", "registered").Count(&registered)
	database.DB.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Where("status = ?", "in_progress").Count(&inProgress)
	database.DB.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Where("status = ?", "completed").Count(&completed)
	database.DB.Model(&models.Registration{}).
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Where("status = ?", "cancelled").Count(&cancelled)

	c.JSON(http.StatusOK, gin.H{
		"data": registrations,
		"summary": gin.H{
			"registered":  registered,
			"in_progress": inProgress,
			"completed":   completed,
			"cancelled":   cancelled,
			"total":       registered + inProgress + completed + cancelled,
		},
	})
}

// CreateRegistrationFromQueue godoc
// @Summary Create registration from queue
// @Description Create a registration from a called queue (for quick registration)
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Queue ID"
// @Param input body CreateRegistrationInput true "Registration data"
// @Success 201 {object} map[string]interface{}
// @Router /queues/{id}/register [post]
func CreateRegistrationFromQueue(c *gin.Context) {
	queueID := c.Param("id")

	// Find the queue
	var queue models.Queue
	if err := database.DB.First(&queue, queueID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Antrean tidak ditemukan"})
		return
	}

	if queue.Status != "called" && queue.Status != "serving" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Antrean harus dalam status dipanggil atau dilayani untuk didaftarkan"})
		return
	}

	var input CreateRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set queue ID
	queueIDUint := queue.ID
	input.QueueID = &queueIDUint

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Validate patient exists
	var patient models.Patient
	if err := database.DB.First(&patient, input.PatientID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien tidak ditemukan"})
		return
	}

	// Check for duplicate registration (same patient, same day, same room, not cancelled)
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var existingRegistration models.Registration
	err := database.DB.Where(
		"patient_id = ? AND destination_room_id = ? AND registration_date >= ? AND registration_date < ? AND status != ?",
		input.PatientID, input.DestinationRoomID, startOfDay, endOfDay, "cancelled",
	).First(&existingRegistration).Error

	if err == nil {
		// Found existing registration
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Pasien dengan No. RM %s sudah terdaftar di ruangan ini hari ini (No. Pendaftaran: %s)",
				patient.NoRM, existingRegistration.RegistrationNumber),
		})
		return
	}

	// Set default registration type
	if input.RegistrationType == "" {
		input.RegistrationType = "outpatient"
	}

	// Generate registration number
	regNumber := generateRegistrationNumber()

	// Count visit number for this patient
	var visitCount int64
	database.DB.Model(&models.Registration{}).Where("patient_id = ?", input.PatientID).Count(&visitCount)

	registration := models.Registration{
		RegistrationNumber: regNumber,
		RegistrationDate:   startOfDay,
		RegistrationType:   input.RegistrationType,
		PatientID:          input.PatientID,
		QueueID:            input.QueueID,
		DestinationRoomID:  input.DestinationRoomID,
		DoctorID:           input.DoctorID,
		PaymentMethod:      input.PaymentMethod,
		BPJSNumber:         input.BPJSNumber,
		InsuranceName:      input.InsuranceName,
		InsuranceNumber:    input.InsuranceNumber,
		Complaint:          input.Complaint,
		Status:             "registered",
		RegisteredByID:     userID.(uint),
		Notes:              input.Notes,
		VisitNumber:        int(visitCount + 1),
	}

	tx := database.DB.Begin()

	if err := tx.Create(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat pendaftaran"})
		return
	}

	// Update queue status to completed
	queue.Status = "completed"
	now := time.Now()
	queue.CompletedAt = &now
	if queue.ServicedAt == nil {
		queue.ServicedAt = &now
	}
	tx.Save(&queue)

	tx.Commit()

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("RegisteredBy").Preload("Queue").
		First(&registration, registration.ID)

	c.JSON(http.StatusCreated, gin.H{"data": registration})
}

// SearchPatientForQueue godoc
// @Summary Search patient for queue registration
// @Description Search patient by name, medical record number, or NIK for quick queue registration
// @Tags Registration
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/search-patient [get]
func SearchPatientForQueue(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query is required"})
		return
	}

	var patients []models.Patient
	searchQuery := "%" + query + "%"
	database.DB.Where("nama_lengkap ILIKE ? OR no_rm ILIKE ? OR nik ILIKE ?",
		searchQuery, searchQuery, searchQuery).
		Limit(10).
		Find(&patients)

	// Transform to match frontend expectations
	type PatientSearchResult struct {
		ID                  uint   `json:"id"`
		Name                string `json:"name"`
		MedicalRecordNumber string `json:"medical_record_number"`
		NIK                 string `json:"nik,omitempty"`
		Gender              string `json:"gender,omitempty"`
		DateOfBirth         string `json:"date_of_birth,omitempty"`
		Phone               string `json:"phone,omitempty"`
		BPJSNumber          string `json:"bpjs_number,omitempty"`
		InsuranceName       string `json:"insurance_name,omitempty"`
		InsuranceNumber     string `json:"insurance_number,omitempty"`
	}

	results := make([]PatientSearchResult, len(patients))
	for i, p := range patients {
		gender := ""
		if p.JenisKelamin == "L" {
			gender = "male"
		} else if p.JenisKelamin == "P" {
			gender = "female"
		}

		dob := ""
		if p.TanggalLahir != nil && !p.TanggalLahir.IsZero() {
			dob = p.TanggalLahir.Time.Format("2006-01-02")
		}

		results[i] = PatientSearchResult{
			ID:                  p.ID,
			Name:                p.NamaLengkap,
			MedicalRecordNumber: p.NoRM,
			NIK:                 p.NIK,
			Gender:              gender,
			DateOfBirth:         dob,
			Phone:               p.NoHP,
			BPJSNumber:          p.NoBPJS,
			InsuranceName:       p.NamaAsuransi,
			InsuranceNumber:     p.NoPolisAsuransi,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}
