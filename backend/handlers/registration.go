package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
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
		Preload("Visit").Preload("Visit.RoomQueue").
		Preload("Visits").Preload("Visits.Room")

	// Filter by exact registration number
	if regNum := c.Query("registration_number"); regNum != "" {
		query = query.Where("registrations.registration_number = ?", regNum)
	}

	// Filter by date
	if dateStr := c.Query("date"); dateStr != "" {
		parsed, err := ParseLocalDate(dateStr)
		if err == nil {
			startOfDay := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, parsed.Location())
			endOfDay := startOfDay.Add(24 * time.Hour)
			query = query.Where("registrations.registration_date >= ? AND registrations.registration_date < ?", startOfDay, endOfDay)
		}
	}

	if regType := c.Query("registration_type"); regType != "" {
		query = query.Where("registrations.registration_type = ?", regType)
	}
	// Filter by destination room's service_type (joins rooms table)
	if svcType := c.Query("service_type"); svcType != "" {
		query = query.Joins("JOIN rooms ON rooms.id = registrations.destination_room_id").
			Where("rooms.service_type = ?", svcType)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("registrations.status = ?", status)
	}
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Where("registrations.patient_id = ?", patientID)
	}
	if roomID := c.Query("destination_room_id"); roomID != "" {
		query = query.Where("registrations.destination_room_id = ?", roomID)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.Registration{}).Count(&total)

	query.Order("registrations.created_at DESC").Limit(limit).Offset(offset).Find(&registrations)

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
		Preload("Visits").Preload("Visits.Room").
		First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": registration})
}

// ProcedureItemInput represents a procedure item for direct registration to supporting services
type ProcedureItemInput struct {
	ProcedureID uint   `json:"procedure_id" binding:"required"`
	Notes       string `json:"notes"`
}

// MedicineItemInput represents a medicine item for direct registration to pharmacy
type MedicineItemInput struct {
	MedicineID   uint   `json:"medicine_id" binding:"required"`
	Quantity     int    `json:"quantity" binding:"required"`
	Unit         string `json:"unit"`
	Dosage       string `json:"dosage"`
	Frequency    string `json:"frequency"`
	Route        string `json:"route"`
	Duration     string `json:"duration"`
	Instructions string `json:"instructions"`
	Notes        string `json:"notes"`
}

// CreateRegistrationInput represents input for creating a registration
type CreateRegistrationInput struct {
	QueueID           *uint  `json:"queue_id"`                               // Link to queue
	PatientID         uint   `json:"patient_id" binding:"required"`          // Patient is required
	RegistrationType  string `json:"registration_type"`                      // outpatient, inpatient, emergency
	DestinationRoomID uint   `json:"destination_room_id" binding:"required"` // Destination room
	DoctorID          uint   `json:"doctor_id" binding:"required"`           // Doctor - REQUIRED for SatuSehat
	PaymentMethod     string `json:"payment_method" binding:"required"`      // cash, bpjs, insurance
	BPJSNumber        string `json:"bpjs_number"`                            // BPJS number if applicable
	SEPNumber         string `json:"sep_number"`                             // SEP number if BPJS
	InsuranceName     string `json:"insurance_name"`                         // Insurance name
	InsuranceNumber   string `json:"insurance_number"`                       // Insurance policy number
	Complaint         string `json:"complaint"`                              // Chief complaint
	Notes             string `json:"notes"`                                  // Additional notes
	CreateVisit       bool   `json:"create_visit"`                           // Auto-create visit
	CreateRoomQueue   bool   `json:"create_room_queue"`                      // Auto-create room queue
	QueuePriority     string `json:"queue_priority"`                         // Queue priority (normal, urgent, emergency)

	// For direct registration to supporting services (penunjang) - radiology/laboratory
	ProcedureItems []ProcedureItemInput `json:"procedure_items"` // Procedures to order (for lab/radiology)

	// For direct registration to pharmacy
	MedicineItems []MedicineItemInput `json:"medicine_items"` // Medicines to order (for pharmacy)
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

	// Validate doctor (now required)
	var doctor models.Employee
	if err := database.DB.First(&doctor, input.DoctorID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak ditemukan"})
		return
	}

	// Check if doctor is assigned to the selected room
	var roomStaff models.RoomStaff
	err := database.DB.Where("room_id = ? AND employee_id = ?", input.DestinationRoomID, input.DoctorID).
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

	// Check for duplicate registration (same patient, same day, same room, not finished)
	// Allow re-registration if previous registration is completed, discharged, or cancelled
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var existingRegistration models.Registration
	// Only block if there's an active registration (not completed, discharged, or cancelled)
	finishedStatuses := []string{
		models.RegistrationStatusCompleted,
		models.RegistrationStatusDischarged,
		models.RegistrationStatusCancelled,
	}
	err = database.DB.Where(
		"patient_id = ? AND destination_room_id = ? AND registration_date >= ? AND registration_date < ? AND status NOT IN ?",
		input.PatientID, input.DestinationRoomID, startOfDay, endOfDay, finishedStatuses,
	).First(&existingRegistration).Error

	if err == nil {
		// Found existing active registration
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Pasien dengan No. RM %s masih memiliki pendaftaran aktif di ruangan ini hari ini (No. Pendaftaran: %s, Status: %s)",
				patient.NoRM, existingRegistration.RegistrationNumber, existingRegistration.Status),
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
		DoctorID:           &input.DoctorID,
		PaymentMethod:      input.PaymentMethod,
		BPJSNumber:         input.BPJSNumber,
		SEPNumber:          input.SEPNumber,
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
		fmt.Printf("ERROR CreateRegistration: Failed to create registration: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat pendaftaran: " + err.Error()})
		return
	}

	// Update SEP registration_id if SEP number is provided
	if input.SEPNumber != "" {
		tx.Model(&models.SEP{}).Where("no_sep = ?", input.SEPNumber).Update("registration_id", registration.ID)
	}

	// Create visit and room queue if requested
	var visit *models.Visit
	var roomQueue *models.RoomQueue

	if input.CreateVisit {
		// Generate visit number
		todayStr := time.Now().Format("20060102")
		var lastVisit models.Visit
		var visitNum int

		// Use Unscoped to include soft-deleted records when checking for last visit number
		err := tx.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
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

		// Determine visit type based on room service type
		// DEBUG: Log room service type
		fmt.Printf("DEBUG CreateRegistration: Room ID=%d, Name=%s, ServiceType='%s', RoomType='%s'\n",
			room.ID, room.Name, room.ServiceType, room.RoomType)

		visitType := "outpatient" // default untuk kunjungan biasa
		switch room.ServiceType {
		case "rawat_jalan":
			visitType = "outpatient"
		case "rawat_inap":
			visitType = "inpatient"
		case "gawat_darurat":
			visitType = "emergency"
		case "penunjang", "penunjang_medis":
			// Untuk penunjang, tentukan berdasarkan room_type
			switch room.RoomType {
			case "laboratorium", "laboratorium_pk", "laboratorium_pa":
				visitType = "lab"
			case "radiologi":
				visitType = "radiology"
			case "farmasi", "depo_farmasi", "gudang_farmasi":
				visitType = "pharmacy"
			default:
				visitType = "procedure" // tindakan medis lainnya
			}
		case "farmasi":
			visitType = "pharmacy"
		default:
			visitType = "outpatient"
		}

		fmt.Printf("DEBUG CreateRegistration: Determined visitType='%s'\n", visitType)

		visit = &models.Visit{
			VisitNumber:    visitNumber,
			RegistrationID: registration.ID,
			RoomID:         input.DestinationRoomID,
			DoctorID:       &input.DoctorID,
			VisitType:      visitType,
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
			parsedDate, _ := ParseLocalDate(todayDate)
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

		// Create procedure order for direct registration to supporting services (lab/radiology)
		if len(input.ProcedureItems) > 0 && (room.RoomType == "laboratorium" || room.RoomType == "radiologi") {
			// Get user's employee for ordering
			var user models.User
			if err := tx.Preload("Employee").First(&user, userID).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan data user"})
				return
			}

			// Determine order type based on room type
			orderType := models.ProcedureOrderTypeLaboratory
			prefix := "LAB"
			if room.RoomType == "radiologi" {
				orderType = models.ProcedureOrderTypeRadiology
				prefix = "RAD"
			}

			// Generate order number
			todayStr := time.Now().Format("20060102")
			var lastOrder models.ProcedureOrder
			var orderNum int
			if err := tx.Where("order_number LIKE ?", prefix+todayStr+"%").
				Order("order_number DESC").First(&lastOrder).Error; err != nil {
				orderNum = 1
			} else {
				var lastNum int
				fmt.Sscanf(lastOrder.OrderNumber, prefix+todayStr+"%d", &lastNum)
				orderNum = lastNum + 1
			}
			orderNumber := fmt.Sprintf("%s%s%04d", prefix, todayStr, orderNum)

			// Get employee ID for ordering (use user's employee or default)
			var orderedByID uint
			if user.EmployeeID != nil {
				orderedByID = *user.EmployeeID
			} else {
				// Use doctor if provided, or create without specific orderer
				orderedByID = input.DoctorID
			}

			priority := input.QueuePriority
			if priority == "" {
				priority = "normal"
			}

			// Create procedure order - source visit is the same as target visit (direct registration)
			procedureOrder := models.ProcedureOrder{
				OrderNumber:    orderNumber,
				OrderType:      orderType,
				SourceVisitID:  visit.ID, // Self-referencing for direct registration
				TargetVisitID:  &visit.ID,
				SourceRoomID:   input.DestinationRoomID,
				TargetRoomID:   input.DestinationRoomID,
				RegistrationID: registration.ID,
				OrderedByID:    orderedByID,
				Priority:       priority,
				ClinicalNotes:  input.Complaint,
				Notes:          input.Notes,
				Status:         models.ProcedureOrderStatusPending,
			}

			if err := tx.Create(&procedureOrder).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order tindakan: " + err.Error()})
				return
			}

			// Create order items
			for _, item := range input.ProcedureItems {
				// Validate procedure exists
				var procedure models.Procedure
				if err := tx.First(&procedure, item.ProcedureID).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Tindakan ID %d tidak ditemukan", item.ProcedureID)})
					return
				}

				orderItem := models.ProcedureOrderItem{
					ProcedureOrderID: procedureOrder.ID,
					ProcedureID:      item.ProcedureID,
					Status:           models.ProcedureOrderStatusPending,
					Notes:            item.Notes,
				}

				if err := tx.Create(&orderItem).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat item order tindakan"})
					return
				}
			}
		}

		// Create medicine order for direct registration to pharmacy
		if len(input.MedicineItems) > 0 && room.ServiceType == "farmasi" {
			// Get user's employee for prescribing
			var user models.User
			if err := tx.Preload("Employee").First(&user, userID).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan data user"})
				return
			}

			// Generate order number
			todayStr := time.Now().Format("20060102")
			var lastOrder models.MedicineOrder
			var orderNum int
			if err := tx.Where("order_number LIKE ?", "RX"+todayStr+"%").
				Order("order_number DESC").First(&lastOrder).Error; err != nil {
				orderNum = 1
			} else {
				var lastNum int
				fmt.Sscanf(lastOrder.OrderNumber, "RX"+todayStr+"%d", &lastNum)
				orderNum = lastNum + 1
			}
			orderNumber := fmt.Sprintf("RX%s%04d", todayStr, orderNum)

			// Get employee ID for prescribing
			var prescriberID uint
			if user.EmployeeID != nil {
				prescriberID = *user.EmployeeID
			} else {
				prescriberID = input.DoctorID
			}

			priority := input.QueuePriority
			if priority == "" {
				priority = "normal"
			}

			// Create medicine order - source visit is the same as pharmacy visit (direct registration)
			medicineOrder := models.MedicineOrder{
				OrderNumber:      orderNumber,
				SourceVisitID:    visit.ID, // Self-referencing for direct registration
				PharmacyVisitID:  &visit.ID,
				SourceRoomID:     input.DestinationRoomID,
				PharmacyRoomID:   input.DestinationRoomID,
				RegistrationID:   registration.ID,
				PrescriberID:     prescriberID,
				PrescriptionType: "regular",
				Priority:         priority,
				Notes:            input.Notes,
				Status:           models.OrderStatusPending,
			}

			if err := tx.Create(&medicineOrder).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat resep obat: " + err.Error()})
				return
			}

			// Create order items
			for _, item := range input.MedicineItems {
				// Validate medicine exists
				var medicine models.Medicine
				if err := tx.First(&medicine, item.MedicineID).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Obat ID %d tidak ditemukan", item.MedicineID)})
					return
				}

				orderItem := models.MedicineOrderItem{
					MedicineOrderID: medicineOrder.ID,
					MedicineID:      item.MedicineID,
					Quantity:        item.Quantity,
					Unit:            item.Unit,
					Dosage:          item.Dosage,
					Frequency:       item.Frequency,
					Route:           item.Route,
					Duration:        item.Duration,
					Instructions:    item.Instructions,
					Notes:           item.Notes,
					Status:          models.ItemStatusOrdered,
				}

				if err := tx.Create(&orderItem).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat item resep obat"})
					return
				}
			}
		}
	}

	// Update queue status if queue_id is provided
	if input.QueueID != nil {
		var queue models.Queue
		if err := tx.First(&queue, *input.QueueID).Error; err == nil {
			// Update queue to completed status (registration done)
			queue.Status = "completed"
			now := time.Now()
			if queue.ServicedAt == nil {
				queue.ServicedAt = &now
			}
			queue.CompletedAt = &now
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

	// ========================================
	// BPJS Antrian Online Integration (On-Site)
	// ========================================
	// Untuk pasien BPJS on-site RAWAT JALAN saja, buat BPJSQueue dan kirim ke BPJS Antrian Online
	// Tidak berlaku untuk: IGD, Rawat Inap, Penunjang Medis (Lab/Radiologi), Farmasi
	if input.PaymentMethod == "bpjs" && input.BPJSNumber != "" && visit != nil && roomQueue != nil && room.ServiceType == "rawat_jalan" {
		go func() {
			bpjsResult := registerBPJSAntreanOnSite(
				&patient,
				&registration,
				visit,
				roomQueue,
				&room,
				&doctor,
				input.BPJSNumber,
				input.SEPNumber,
			)
			if bpjsResult != nil {
				fmt.Printf("[BPJS On-Site] Registration %s: %s\n", registration.RegistrationNumber, bpjsResult.Message)
			}
		}()
	}

	// Send notification to destination room
	if NotifService != nil && visit != nil {
		patientName := ""
		if registration.Patient != nil {
			patientName = registration.Patient.NamaLengkap
		}
		roomName := ""
		if registration.DestinationRoom != nil {
			roomName = registration.DestinationRoom.Name
		}

		go NotifService.NotifyRoomUsers(
			input.DestinationRoomID,
			models.NotificationTypeVisitCreated,
			"Pasien Baru",
			fmt.Sprintf("Pasien %s telah terdaftar ke %s", patientName, roomName),
			map[string]interface{}{
				"visit_id":        visit.ID,
				"registration_id": registration.ID,
				"patient_id":      registration.PatientID,
				"room_id":         input.DestinationRoomID,
			},
		)
	}

	c.JSON(http.StatusCreated, response)
}

// generateRegistrationNumber generates a unique registration number
func generateRegistrationNumber() string {
	today := time.Now()
	dateStr := today.Format("20060102")

	var lastReg models.Registration
	var nextNumber int64 = 1

	// Find the last registration number for today
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	if err := database.DB.Unscoped().
		Where("registration_date >= ? AND registration_date < ?", startOfDay, endOfDay).
		Where("registration_number LIKE ?", "REG-"+dateStr+"-%").
		Order("registration_number DESC").
		First(&lastReg).Error; err == nil {
		// Extract the number from the last registration_number (format: REG-YYYYMMDD-XXXX)
		var lastNum int64
		fmt.Sscanf(lastReg.RegistrationNumber, "REG-"+dateStr+"-%d", &lastNum)
		nextNumber = lastNum + 1
	}

	return fmt.Sprintf("REG-%s-%04d", dateStr, nextNumber)
}

// BPJSAntreanResult represents the result of BPJS Antrian Online registration
type BPJSAntreanResult struct {
	Success      bool   `json:"success"`
	KodeBooking  string `json:"kode_booking"`
	Message      string `json:"message"`
	AddAntreanOK bool   `json:"add_antrean_ok"`
}

// registerBPJSAntreanOnSite registers patient to BPJS Antrian Online for on-site registration
// This function handles:
// 1. Find poli mapping and doctor mapping
// 2. Generate kode booking
// 3. Create BPJSQueue record
// 4. Call AddAntrean to BPJS
// 5. Send Task 3 (tunggu di poli) - karena on-site langsung ke poli
func registerBPJSAntreanOnSite(
	patient *models.Patient,
	registration *models.Registration,
	visit *models.Visit,
	roomQueue *models.RoomQueue,
	room *models.Room,
	doctor *models.Employee,
	bpjsNumber string,
	sepNumber string,
) *BPJSAntreanResult {
	result := &BPJSAntreanResult{
		Success: false,
		Message: "",
	}

	// 1. Find poli mapping for this room
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.Where("room_id = ? AND is_active = ?", room.ID, true).
		First(&poliMapping).Error; err != nil {
		result.Message = fmt.Sprintf("Poli mapping tidak ditemukan untuk ruangan %s", room.Name)
		fmt.Printf("[BPJS On-Site] %s\n", result.Message)
		return result
	}

	// 2. Find doctor mapping for this doctor in this poli
	var dokterMapping models.BPJSDoctorMapping
	if err := database.DB.Where("poli_mapping_id = ? AND employee_id = ? AND is_active = ?",
		poliMapping.ID, doctor.ID, true).First(&dokterMapping).Error; err != nil {
		result.Message = fmt.Sprintf("Dokter mapping tidak ditemukan untuk dr. %s di poli %s", doctor.NamaLengkap, poliMapping.NamaPoliBPJS)
		fmt.Printf("[BPJS On-Site] %s\n", result.Message)
		return result
	}

	// 3. Generate kode booking untuk on-site
	tanggal := time.Now()
	kodeBooking := generateKodeBookingOnSite(tanggal, poliMapping.KodePoliBPJS)

	// 4. Extract angka antrean from queue number (e.g., "A001" -> 1)
	angkaAntrean := extractAngkaAntrean(roomQueue.QueueNumber)

	// 5. Calculate estimasi dilayani (15 menit per pasien)
	jamPraktek := dokterMapping.JamPraktek
	if jamPraktek == "" {
		jamPraktek = "08:00-17:00" // default
	}
	jamPraktekParts := strings.Split(jamPraktek, "-")
	jamMulai := "08:00"
	if len(jamPraktekParts) > 0 {
		jamMulai = jamPraktekParts[0]
	}
	startTime, _ := time.Parse("15:04", jamMulai)
	estimasiTime := time.Date(tanggal.Year(), tanggal.Month(), tanggal.Day(),
		startTime.Hour(), startTime.Minute(), 0, 0, time.Local)
	estimasiTime = estimasiTime.Add(time.Duration((angkaAntrean-1)*15) * time.Minute)
	estimasiDilayani := estimasiTime.UnixMilli()

	// 6. Determine jenis kunjungan based on SEP or default
	// 1=Rujukan FKTP, 2=Rujukan Internal, 3=Kontrol, 4=Rujukan Antar RS
	jenisKunjungan := 1 // Default: Rujukan FKTP untuk pasien baru on-site

	// 7. Get nomor referensi from SEP if available
	nomorReferensi := ""
	if sepNumber != "" {
		// Try to get rujukan number from SEP
		var sep models.SEP
		if err := database.DB.Where("no_sep = ?", sepNumber).First(&sep).Error; err == nil {
			nomorReferensi = sep.NoRujukan
			// Determine jenis kunjungan based on asal rujukan
			// 1=Rujukan FKTP, 2=Rujukan Internal, 3=Kontrol, 4=Rujukan Antar RS
			if sep.AsalRujukan == "1" {
				jenisKunjungan = 1 // Rujukan FKTP (Faskes 1)
			} else if sep.AsalRujukan == "2" {
				jenisKunjungan = 4 // Rujukan Antar RS (Faskes 2)
			}
		}
	}

	// 8. Create BPJSQueue record
	now := time.Now()
	bpjsQueue := models.BPJSQueue{
		KodeBooking:      kodeBooking,
		NomorAntrean:     roomQueue.QueueNumber,
		AngkaAntrean:     angkaAntrean,
		TanggalPeriksa:   tanggal,
		JamPraktek:       jamPraktek,
		KodePoli:         poliMapping.KodePoliBPJS,
		NamaPoli:         poliMapping.NamaPoliBPJS,
		KodeDokter:       dokterMapping.KodeDokterBPJS,
		NamaDokter:       dokterMapping.NamaDokterBPJS,
		JenisPasien:      "JKN",
		NoKartu:          bpjsNumber,
		NIK:              patient.NIK,
		NoHP:             patient.NoHP,
		NoRM:             patient.NoRM,
		NamaPasien:       patient.NamaLengkap,
		JenisKunjungan:   jenisKunjungan,
		NomorReferensi:   nomorReferensi,
		EstimasiDilayani: estimasiDilayani,
		Status:           "checkin", // On-site langsung checkin
		WaktuCheckin:     &now,
		Task3At:          &now, // Langsung set Task 3 karena sudah di poli
		PatientID:        &patient.ID,
		RegistrationID:   &registration.ID,
		VisitID:          &visit.ID,
		RoomQueueID:      &roomQueue.ID,
		RoomID:           &room.ID,
		PoliMappingID:    &poliMapping.ID,
		DoctorMappingID:  &dokterMapping.ID,
		SyncStatus:       "pending",
	}

	if err := database.DB.Create(&bpjsQueue).Error; err != nil {
		result.Message = fmt.Sprintf("Gagal menyimpan BPJSQueue: %s", err.Error())
		fmt.Printf("[BPJS On-Site] %s\n", result.Message)
		return result
	}

	result.KodeBooking = kodeBooking

	// 9. Call AddAntrean to BPJS
	addSuccess, addCode, addMsg := bpjsService.AddAntrean(&bpjsQueue)

	// Update BPJSQueue with result
	bpjsQueue.AddAntreanSent = true
	bpjsQueue.AddAntreanCode = addCode
	bpjsQueue.AddAntreanMsg = addMsg
	bpjsQueue.LastSyncAt = &now

	if addSuccess {
		bpjsQueue.SyncStatus = "synced"
		result.AddAntreanOK = true
		fmt.Printf("[BPJS On-Site] AddAntrean berhasil untuk kode_booking: %s\n", kodeBooking)
	} else {
		bpjsQueue.SyncStatus = "failed"
		bpjsQueue.SyncError = addMsg
		result.AddAntreanOK = false
		fmt.Printf("[BPJS On-Site] AddAntrean gagal untuk kode_booking: %s - [%d] %s\n", kodeBooking, addCode, addMsg)
	}

	// Save updated BPJSQueue
	database.DB.Save(&bpjsQueue)

	// 10. Send Task 3 (tunggu di poli) - async
	// Untuk on-site, langsung kirim Task 3 karena pasien sudah di poli
	if addSuccess {
		go func() {
			bpjsService.UpdateTaskAsync(kodeBooking, 3, now, nil)
		}()
	}

	result.Success = addSuccess
	if addSuccess {
		result.Message = fmt.Sprintf("Berhasil mendaftarkan ke BPJS Antrian Online dengan kode booking: %s", kodeBooking)
	} else {
		result.Message = fmt.Sprintf("AddAntrean gagal: [%d] %s", addCode, addMsg)
	}

	return result
}

// generateKodeBookingOnSite generates unique booking code for on-site registration
// Format: DDMMYYYYPPP + HHmmss (e.g., 03022026ANA143027)
// Uses current timestamp to ensure uniqueness even on retry (avoids 208 duplicate)
func generateKodeBookingOnSite(tanggal time.Time, kodePoli string) string {
	dateStr := tanggal.Format("02012006")     // DDMMYYYY
	timeSuffix := time.Now().Format("150405") // HHmmss - unique per second
	return fmt.Sprintf("%s%s%s", dateStr, kodePoli, timeSuffix)
}

// extractAngkaAntrean extracts the numeric part from queue number
// e.g., "A001" -> 1, "INT-0015" -> 15
func extractAngkaAntrean(queueNumber string) int {
	// Try to find numeric part at the end
	angka := 0
	for i := len(queueNumber) - 1; i >= 0; i-- {
		if queueNumber[i] >= '0' && queueNumber[i] <= '9' {
			continue
		} else {
			// Found non-numeric character
			numStr := queueNumber[i+1:]
			fmt.Sscanf(numStr, "%d", &angka)
			break
		}
	}
	// If all numeric
	if angka == 0 {
		fmt.Sscanf(queueNumber, "%d", &angka)
	}
	if angka == 0 {
		angka = 1 // Default to 1 if parsing fails
	}
	return angka
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

	var input UpdateRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Only allow updates for certain statuses
	// Exception: payment-related fields can always be updated (for billing corrections)
	isPaymentOnlyUpdate := (input.PaymentMethod != nil || input.BPJSNumber != nil || input.InsuranceName != nil || input.InsuranceNumber != nil) &&
		input.DoctorID == nil &&
		input.DestinationRoomID == nil &&
		input.Complaint == nil &&
		input.Notes == nil &&
		input.Status == nil

	if (registration.Status == "completed" || registration.Status == "cancelled") && !isPaymentOnlyUpdate {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran yang sudah selesai atau dibatalkan tidak bisa diubah"})
		return
	}

	// Validate doctor if provided
	if input.DoctorID != nil {
		var doctor models.Employee
		if err := database.DB.First(&doctor, *input.DoctorID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak ditemukan"})
			return
		}

		// Verify doctor is actually a doctor
		if doctor.TipeKaryawan != "dokter" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Karyawan yang dipilih bukan dokter"})
			return
		}

		// Check if doctor is assigned to the destination room (if room is also being updated)
		roomID := registration.DestinationRoomID
		if input.DestinationRoomID != nil {
			roomID = *input.DestinationRoomID
		}

		var roomStaff models.RoomStaff
		err := database.DB.Where("room_id = ? AND employee_id = ?", roomID, *input.DoctorID).
			Where("end_date IS NULL OR end_date >= ?", time.Now()).
			First(&roomStaff).Error
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak terdaftar di ruangan yang dipilih"})
			return
		}
	}

	updates := make(map[string]interface{})

	if input.DestinationRoomID != nil {
		updates["destination_room_id"] = *input.DestinationRoomID
	}
	if input.DoctorID != nil {
		updates["doctor_id"] = input.DoctorID
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
// @Description Cancel a registration and all related visits
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

	tx := database.DB.Begin()

	// Cancel all visits related to this registration
	var visits []models.Visit
	tx.Where("registration_id = ?", registration.ID).Find(&visits)

	for _, visit := range visits {
		if visit.Status != "completed" && visit.Status != "discharged" {
			// Cancel room queue if exists
			tx.Model(&models.RoomQueue{}).
				Where("visit_id = ?", visit.ID).
				Update("status", "cancelled")

			// Cancel visit
			visit.Status = "cancelled"
			tx.Save(&visit)
		}
	}

	// Cancel registration
	registration.Status = "cancelled"
	tx.Save(&registration)

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan pendaftaran"})
		return
	}

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").Preload("Visits").
		First(&registration, registration.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":    registration,
		"message": fmt.Sprintf("Pendaftaran dan %d kunjungan berhasil dibatalkan", len(visits)),
	})
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

	// Check for duplicate registration (same patient, same day, same room, not finished)
	// Allow re-registration if previous registration is completed, discharged, or cancelled
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var existingRegistration models.Registration
	// Only block if there's an active registration (not completed, discharged, or cancelled)
	finishedStatuses := []string{
		models.RegistrationStatusCompleted,
		models.RegistrationStatusDischarged,
		models.RegistrationStatusCancelled,
	}
	err := database.DB.Where(
		"patient_id = ? AND destination_room_id = ? AND registration_date >= ? AND registration_date < ? AND status NOT IN ?",
		input.PatientID, input.DestinationRoomID, startOfDay, endOfDay, finishedStatuses,
	).First(&existingRegistration).Error

	if err == nil {
		// Found existing active registration
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Pasien dengan No. RM %s masih memiliki pendaftaran aktif di ruangan ini hari ini (No. Pendaftaran: %s, Status: %s)",
				patient.NoRM, existingRegistration.RegistrationNumber, existingRegistration.Status),
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
		DoctorID:           &input.DoctorID,
		PaymentMethod:      input.PaymentMethod,
		BPJSNumber:         input.BPJSNumber,
		SEPNumber:          input.SEPNumber,
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

// ===========================================================================
// SCHEDULED REGISTRATIONS (Follow-up/Kontrol)
// ===========================================================================

// GetScheduledRegistrations godoc
// @Summary Get scheduled registrations (kontrol)
// @Description Get list of scheduled follow-up registrations with optional filters
// @Tags Registration
// @Accept json
// @Produce json
// @Param date query string false "Filter by scheduled date (YYYY-MM-DD), defaults to today"
// @Param room_id query int false "Filter by destination room"
// @Param status query string false "Filter by status (scheduled, no_show)"
// @Param include_past query bool false "Include past scheduled dates"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/scheduled [get]
func GetScheduledRegistrations(c *gin.Context) {
	// Auto-cancel old scheduled registrations (30 days)
	autoMarkNoShow()

	query := database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("Visit").Preload("Visit.RoomQueue").
		Preload("SourceVisit").Preload("CheckedInBy").
		Where("is_follow_up = ?", true)

	// Filter by date
	if dateStr := c.Query("date"); dateStr != "" {
		parsed, err := ParseLocalDate(dateStr)
		if err == nil {
			query = query.Where("scheduled_date = ?", parsed)
		}
	} else if c.Query("include_past") != "true" {
		// Default: only today and future
		today := time.Now().Truncate(24 * time.Hour)
		query = query.Where("scheduled_date >= ?", today)
	}

	// Filter by room
	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Where("destination_room_id = ?", roomID)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	} else {
		// Default: only scheduled (not yet checked in or no_show)
		query = query.Where("status IN ?", []string{models.RegistrationStatusScheduled, models.RegistrationStatusNoShow})
	}

	var registrations []models.Registration
	query.Order("scheduled_date ASC, created_at ASC").Find(&registrations)

	// Summary counts
	today := time.Now().Truncate(24 * time.Hour)
	var todayCount, upcomingCount, noShowCount int64

	database.DB.Model(&models.Registration{}).
		Where("is_follow_up = ? AND scheduled_date = ? AND status = ?", true, today, models.RegistrationStatusScheduled).
		Count(&todayCount)

	database.DB.Model(&models.Registration{}).
		Where("is_follow_up = ? AND scheduled_date > ? AND status = ?", true, today, models.RegistrationStatusScheduled).
		Count(&upcomingCount)

	database.DB.Model(&models.Registration{}).
		Where("is_follow_up = ? AND status = ?", true, models.RegistrationStatusNoShow).
		Count(&noShowCount)

	c.JSON(http.StatusOK, gin.H{
		"data": registrations,
		"summary": gin.H{
			"today":    todayCount,
			"upcoming": upcomingCount,
			"no_show":  noShowCount,
		},
	})
}

// generateRoomQueueNumber generates the next queue number for a room on a given date
func generateRoomQueueNumber(tx *gorm.DB, roomID uint, queueDate time.Time) (string, error) {
	// Get room for queue code
	var room models.Room
	if err := tx.First(&room, roomID).Error; err != nil {
		return "", err
	}

	queueCode := room.QueueCode
	if queueCode == "" {
		queueCode = "Q"
	}

	// Get last queue number for this room on this date
	var lastQueue models.RoomQueue
	var queueNum int

	dateOnly := time.Date(queueDate.Year(), queueDate.Month(), queueDate.Day(), 0, 0, 0, 0, queueDate.Location())

	err := tx.Where("room_id = ? AND queue_date >= ? AND queue_date < ?", roomID, dateOnly, dateOnly.AddDate(0, 0, 1)).
		Order("created_at DESC").First(&lastQueue).Error

	if err != nil {
		queueNum = 1
	} else {
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	return fmt.Sprintf("%s%03d", queueCode, queueNum), nil
}

// CheckInScheduledRegistration godoc
// @Summary Check-in a scheduled registration
// @Description Validate that patient has arrived for scheduled follow-up and activate the reserved queue
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/checkin [post]
func CheckInScheduledRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.Preload("Visit").Preload("Visit.RoomQueue").First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate status - allow check-in for 'scheduled' (kontrol) or 'registered' (walk-in)
	validStatuses := []string{models.RegistrationStatusScheduled, models.RegistrationStatusRegistered}
	isValidStatus := false
	for _, s := range validStatuses {
		if registration.Status == s {
			isValidStatus = true
			break
		}
	}
	if !isValidStatus {
		statusMsg := "terjadwal atau terdaftar"
		if registration.Status == models.RegistrationStatusInQueue {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sudah dalam antrian"})
			return
		}
		if registration.Status == models.RegistrationStatusInProgress {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pasien sedang dilayani"})
			return
		}
		if registration.Status == models.RegistrationStatusCompleted {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan sudah selesai"})
			return
		}
		if registration.Status == models.RegistrationStatusCancelled {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran sudah dibatalkan"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Pendaftaran tidak dalam status %s", statusMsg)})
		return
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userIDUint := userID.(uint)

	// Start transaction
	tx := database.DB.Begin()

	// Update registration
	now := time.Now()
	registration.Status = models.RegistrationStatusInQueue
	registration.CheckedInAt = &now
	registration.CheckedInByID = &userIDUint

	if err := tx.Save(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melakukan check-in"})
		return
	}

	// Handle Visit - create if not exists, update if exists
	if registration.Visit != nil {
		// Update existing visit
		registration.Visit.CheckInTime = &now
		registration.Visit.Status = models.VisitStatusInQueue // Activate the visit
		if err := tx.Save(&registration.Visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui kunjungan"})
			return
		}

		// Activate the reserved room queue if exists
		if registration.Visit.RoomQueue != nil {
			registration.Visit.RoomQueue.Status = models.RoomQueueStatusWaiting // Activate from reserved to waiting
			registration.Visit.RoomQueue.Notes = "Check-in berhasil"
			if err := tx.Save(&registration.Visit.RoomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengaktifkan antrian"})
				return
			}
		} else {
			// Create room queue for visit without queue
			queueNumber, err := generateRoomQueueNumber(tx, registration.DestinationRoomID, now)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian"})
				return
			}
			roomQueue := models.RoomQueue{
				RoomID:      registration.DestinationRoomID,
				QueueNumber: queueNumber,
				QueueDate:   now,
				VisitID:     registration.Visit.ID,
				Status:      models.RoomQueueStatusWaiting,
				Notes:       "Check-in manual",
			}
			if err := tx.Create(&roomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli"})
				return
			}
			registration.Visit.RoomQueue = &roomQueue
		}
	} else {
		// Create Visit and RoomQueue for walk-in registration
		// Generate visit number
		todayStr := now.Format("20060102")
		var lastVisit models.Visit
		var visitNum int

		// Use Unscoped to include soft-deleted records when checking for last visit number
		err := tx.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
			Order("visit_number DESC").First(&lastVisit).Error
		if err != nil {
			visitNum = 1
		} else {
			var lastNum int
			fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &lastNum)
			visitNum = lastNum + 1
		}
		visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)

		visit := models.Visit{
			VisitNumber:    visitNumber,
			RegistrationID: registration.ID,
			RoomID:         registration.DestinationRoomID,
			DoctorID:       registration.DoctorID,
			VisitType:      "outpatient",
			VisitPurpose:   "Check-in manual",
			Status:         models.VisitStatusInQueue,
			CheckInTime:    &now,
		}
		if err := tx.Create(&visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan"})
			return
		}

		// Generate room queue number
		queueNumber, err := generateRoomQueueNumber(tx, registration.DestinationRoomID, now)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian"})
			return
		}

		roomQueue := models.RoomQueue{
			RoomID:      registration.DestinationRoomID,
			QueueNumber: queueNumber,
			QueueDate:   now,
			VisitID:     visit.ID,
			Status:      models.RoomQueueStatusWaiting,
			Notes:       "Check-in manual",
		}
		if err := tx.Create(&roomQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli"})
			return
		}

		visit.RoomQueue = &roomQueue
		registration.Visit = &visit
	}

	// Update SEP dengan visit_id jika ada SEP untuk registration ini
	if registration.SEPNumber != "" && registration.Visit != nil {
		tx.Model(&models.SEP{}).
			Where("registration_id = ? OR no_sep = ?", registration.ID, registration.SEPNumber).
			Update("visit_id", registration.Visit.ID)
	}

	tx.Commit()

	// Untuk BPJS: Update BPJSQueue status dan kirim Task 3
	if strings.EqualFold(registration.PaymentMethod, "bpjs") {
		go func() {
			var bpjsQueue models.BPJSQueue
			if err := database.DB.Where("registration_id = ?", registration.ID).First(&bpjsQueue).Error; err == nil {
				bpjsQueue.Status = "checkin"
				bpjsQueue.WaktuCheckin = &now
				bpjsQueue.Task3At = &now
				if registration.Visit != nil {
					bpjsQueue.VisitID = &registration.Visit.ID
					if registration.Visit.RoomQueue != nil {
						bpjsQueue.RoomQueueID = &registration.Visit.RoomQueue.ID
					}
				}
				database.DB.Save(&bpjsQueue)

				if bpjsQueue.AddAntreanCode == 200 {
					bpjsService.UpdateTaskAsync(bpjsQueue.KodeBooking, 3, now, nil)
					fmt.Printf("[BPJS Check-in] Task 3 dikirim untuk kode_booking: %s\n", bpjsQueue.KodeBooking)
				} else if bpjsQueue.AddAntreanCode == 0 || bpjsQueue.SyncStatus == "failed" {
					// AddAntrean belum pernah dikirim atau gagal, retry
					addSuccess, addCode, addMsg := bpjsService.AddAntrean(&bpjsQueue)
					syncNow := time.Now()
					bpjsQueue.AddAntreanSent = true
					bpjsQueue.AddAntreanCode = addCode
					bpjsQueue.AddAntreanMsg = addMsg
					bpjsQueue.LastSyncAt = &syncNow
					if addSuccess {
						bpjsQueue.SyncStatus = "synced"
						bpjsQueue.SyncError = ""
						database.DB.Save(&bpjsQueue)
						bpjsService.UpdateTaskAsync(bpjsQueue.KodeBooking, 3, now, nil)
					} else {
						bpjsQueue.SyncStatus = "failed"
						bpjsQueue.SyncError = addMsg
						database.DB.Save(&bpjsQueue)
					}
					fmt.Printf("[BPJS Check-in] AddAntrean retry: success=%v, code=%d, msg=%s\n", addSuccess, addCode, addMsg)
				}
			}
		}()
	}

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("Visit").Preload("Visit.RoomQueue").
		Preload("CheckedInBy").
		First(&registration, registration.ID)

	queueNumber := ""
	if registration.Visit != nil && registration.Visit.RoomQueue != nil {
		queueNumber = registration.Visit.RoomQueue.QueueNumber
	}

	c.JSON(http.StatusOK, gin.H{
		"data":         registration,
		"queue_number": queueNumber,
		"message":      fmt.Sprintf("Check-in berhasil. Nomor antrian: %s", queueNumber),
	})
}

// BPJSCheckinWithSEPInput menerima data SEP untuk proses: AddAntrean → Create SEP → Activate Visit
type BPJSCheckinWithSEPInput struct {
	// SEP fields (sama seperti SEPInput di vclaim.go)
	NoKartu         string `json:"no_kartu" binding:"required"`
	NoMR            string `json:"no_mr" binding:"required"`
	NoTelp          string `json:"no_telp"`
	PatientID       uint   `json:"patient_id" binding:"required"`
	TglSEP          string `json:"tgl_sep" binding:"required"`
	JnsPelayanan    string `json:"jns_pelayanan" binding:"required"`
	KlsRawatHak     string `json:"kls_rawat_hak" binding:"required"`
	KlsRawatNaik    string `json:"kls_rawat_naik"`
	Pembiayaan      string `json:"pembiayaan"`
	PenanggungJawab string `json:"penanggung_jawab"`
	AsalRujukan     string `json:"asal_rujukan"`
	NoRujukan       string `json:"no_rujukan"`
	TglRujukan      string `json:"tgl_rujukan"`
	PPKRujukan      string `json:"ppk_rujukan"`
	KodePoli        string `json:"kode_poli"`
	NamaPoli        string `json:"nama_poli"`
	PoliEks         string `json:"poli_eks"`
	KodeDPJP        string `json:"kode_dpjp"`
	NamaDPJP        string `json:"nama_dpjp"`
	DiagAwal        string `json:"diag_awal" binding:"required"`
	NamaDiagnosa    string `json:"nama_diagnosa"`
	LakaLantas      string `json:"laka_lantas"`
	NoLP            string `json:"no_lp"`
	COB             string `json:"cob"`
	Katarak         string `json:"katarak"`
	TujuanKunj      string `json:"tujuan_kunj"`
	FlagProcedure   string `json:"flag_procedure"`
	KdPenunjang     string `json:"kd_penunjang"`
	AssesmentPel    string `json:"assesment_pel"`
	NoSuratKontrol  string `json:"no_surat_kontrol"`
	Catatan         string `json:"catatan"`
}

// BPJSCheckinWithSEP melakukan alur: AddAntrean → Create SEP → Activate Visit (check-in)
// Endpoint ini menyelesaikan race condition dimana AddAntrean harus sukses (code 200) sebelum SEP dibuat
// POST /api/registrations/:id/bpjs-checkin
func BPJSCheckinWithSEP(c *gin.Context) {
	id := c.Param("id")
	var input BPJSCheckinWithSEPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Load registration
	var registration models.Registration
	if err := database.DB.Preload("Patient").Preload("Visit").Preload("Visit.RoomQueue").
		First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate BPJS
	if !strings.EqualFold(registration.PaymentMethod, "bpjs") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Endpoint ini hanya untuk pasien BPJS"})
		return
	}

	// Validate status
	validStatuses := []string{models.RegistrationStatusScheduled, models.RegistrationStatusRegistered}
	isValidStatus := false
	for _, s := range validStatuses {
		if registration.Status == s {
			isValidStatus = true
			break
		}
	}
	if !isValidStatus {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status pendaftaran tidak valid untuk check-in"})
		return
	}

	// Get current user
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terautentikasi"})
		return
	}
	userIDUint := userID.(uint)

	var user models.User
	if err := database.DB.First(&user, userIDUint).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	}

	now := time.Now()

	// ===================================================
	// STEP 1: Check if AddAntrean already sent successfully
	// Jika belum, kirim AddAntrean (harus sukses code 200)
	// ===================================================

	// Check apakah AddAntrean sudah berhasil sebelumnya (dari SendAntrean endpoint)
	var existingBPJSQueue models.BPJSQueue
	addAntreanDone := false
	if err := database.DB.Where("registration_id = ?", registration.ID).First(&existingBPJSQueue).Error; err == nil {
		if existingBPJSQueue.AddAntreanCode == 200 {
			addAntreanDone = true
			fmt.Printf("[BPJSCheckinWithSEP] AddAntrean sudah berhasil sebelumnya (kode_booking: %s), skip\n", existingBPJSQueue.KodeBooking)
		}
	}

	if !addAntreanDone {
		// Kita perlu queueNumber, jadi generate dulu (tanpa commit ke DB)
		tempTx := database.DB.Begin()
		var queueNumber string
		if registration.Visit != nil && registration.Visit.RoomQueue != nil {
			queueNumber = registration.Visit.RoomQueue.QueueNumber
		} else {
			var err error
			queueNumber, err = generateRoomQueueNumber(tempTx, registration.DestinationRoomID, now)
			if err != nil {
				tempTx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate nomor antrian"})
				return
			}
		}
		tempTx.Rollback() // Rollback karena belum mau commit, hanya untuk generate nomor

		// Panggil AddAntrean secara synchronous
		addSuccess, addErr := sendBPJSAntreanOnCheckInSync(&registration, queueNumber, now)
		if !addSuccess {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":              fmt.Sprintf("Gagal mendaftarkan antrean ke BPJS: %s", addErr),
				"step":               "add_antrean",
				"add_antrean_failed": true,
			})
			return
		}
	} // end if !addAntreanDone

	// ===================================================
	// STEP 2: Create SEP via VClaim API
	// ===================================================

	client, err := bpjsService.NewVClaimClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat VClaim client: " + err.Error()})
		return
	}
	if client.KodePPK == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode PPK belum dikonfigurasi"})
		return
	}

	// Set defaults
	if input.LakaLantas == "" {
		input.LakaLantas = "0"
	}
	if input.COB == "" {
		input.COB = "0"
	}
	if input.Katarak == "" {
		input.Katarak = "0"
	}
	if input.TujuanKunj == "" {
		input.TujuanKunj = "0"
	}
	if input.PoliEks == "" {
		input.PoliEks = "0"
	}

	// Jika ada noSuratKontrol, ppkRujukan = RS sendiri
	ppkRujukan := input.PPKRujukan
	if input.NoSuratKontrol != "" {
		ppkRujukan = client.KodePPK
	}

	// Untuk rawat inap, poliTujuan dikosongkan
	poliTujuan := input.KodePoli
	if input.JnsPelayanan == "1" {
		poliTujuan = ""
	}

	sepData := &bpjsService.SEPData{
		NoKartu:      input.NoKartu,
		TglSep:       input.TglSEP,
		JnsPelayanan: input.JnsPelayanan,
		KlsRawat: bpjsService.SEPKelasRawat{
			KlsRawatHak:     input.KlsRawatHak,
			KlsRawatNaik:    input.KlsRawatNaik,
			Pembiayaan:      input.Pembiayaan,
			PenanggungJawab: input.PenanggungJawab,
		},
		NoMR: input.NoMR,
		Rujukan: bpjsService.SEPRujukan{
			AsalRujukan: input.AsalRujukan,
			TglRujukan:  input.TglRujukan,
			NoRujukan:   input.NoRujukan,
			PPKRujukan:  ppkRujukan,
		},
		Catatan:  input.Catatan,
		DiagAwal: input.DiagAwal,
		Poli: bpjsService.SEPPoli{
			Tujuan:    poliTujuan,
			Eksekutif: input.PoliEks,
		},
		Cob: bpjsService.SEPCob{
			Cob: input.COB,
		},
		Katarak: bpjsService.SEPKatarak{
			Katarak: input.Katarak,
		},
		Jaminan: bpjsService.SEPJaminan{
			LakaLantas: input.LakaLantas,
			NoLP:       input.NoLP,
			Penjamin: &bpjsService.SEPPenjamin{
				Penjamin:    "0",
				TglKejadian: "",
				Keterangan:  "",
				Suplesi: &bpjsService.SEPSuplesi{
					Suplesi:      "0",
					NoSepSuplesi: "",
					LokasiLaka: &bpjsService.SEPLokasiLaka{
						KdPropinsi:  "",
						KdKabupaten: "",
						KdKecamatan: "",
					},
				},
			},
		},
		TujuanKunj:    input.TujuanKunj,
		FlagProcedure: input.FlagProcedure,
		KdPenunjang:   input.KdPenunjang,
		AssesmentPel:  input.AssesmentPel,
		SKDP: bpjsService.SEPSKDP{
			NoSurat:  input.NoSuratKontrol,
			KodeDPJP: input.KodeDPJP,
		},
		DPJPLayan: func() string {
			if input.JnsPelayanan == "1" {
				return ""
			}
			return input.KodeDPJP
		}(),
		NoTelp: input.NoTelp,
		User:   user.Username,
	}

	sepResponse, err := client.InsertSEP(sepData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Gagal membuat SEP: " + err.Error(),
			"step":  "create_sep",
		})
		return
	}

	// Get nama diagnosa
	var patient models.Patient
	database.DB.First(&patient, input.PatientID)
	namaDiagnosa := input.NamaDiagnosa
	if namaDiagnosa == "" {
		var icd10 models.ICD10
		if err := database.DB.Where("code = ? OR code2 = ?", input.DiagAwal, input.DiagAwal).First(&icd10).Error; err == nil {
			namaDiagnosa = icd10.Display
		}
	}

	// Get nama poli
	namaPoli := input.NamaPoli
	if namaPoli == "" {
		var pm models.BPJSPoliMapping
		if err := database.DB.Where("kode_poli_bpjs = ?", input.KodePoli).First(&pm).Error; err == nil {
			namaPoli = pm.NamaPoliBPJS
		}
	}

	// Get nama dokter
	namaDokter := input.NamaDPJP
	if namaDokter == "" {
		var dm models.BPJSDoctorMapping
		if err := database.DB.Where("kode_dokter_bpjs = ?", input.KodeDPJP).First(&dm).Error; err == nil {
			namaDokter = dm.NamaDokterBPJS
		}
	}

	// Save SEP to database
	tglLahir := ""
	if patient.TanggalLahir != nil && !patient.TanggalLahir.IsZero() {
		tglLahir = patient.TanggalLahir.Format("2006-01-02")
	}

	regID := registration.ID
	sep := models.SEP{
		NoSEP:          sepResponse.Sep.NoSep,
		RegistrationID: &regID,
		PatientID:      input.PatientID,
		NoKartu:        input.NoKartu,
		NamaPasien:     patient.NamaLengkap,
		NIK:            patient.NIK,
		TglLahir:       tglLahir,
		JenisKelamin:   string(patient.JenisKelamin),
		TglSEP:         input.TglSEP,
		JnsPelayanan:   input.JnsPelayanan,
		KlsRawatHak:    input.KlsRawatHak,
		KlsRawatNaik:   input.KlsRawatNaik,
		Pembiayaan:     input.Pembiayaan,
		NoMR:           input.NoMR,
		AsalRujukan:    input.AsalRujukan,
		NoRujukan:      input.NoRujukan,
		TglRujukan:     input.TglRujukan,
		PPKRujukan:     ppkRujukan,
		KodePoli:       input.KodePoli,
		NamaPoli:       namaPoli,
		PoliEks:        input.PoliEks,
		KodeDPJP:       input.KodeDPJP,
		NamaDPJP:       namaDokter,
		PPKPelayanan:   client.KodePPK,
		DiagAwal:       input.DiagAwal,
		NamaDiagnosa:   namaDiagnosa,
		LakaLantas:     input.LakaLantas,
		NoLPLaka:       input.NoLP,
		Suplesi:        "0",
		COB:            input.COB,
		Katarak:        input.Katarak,
		TujuanKunj:     input.TujuanKunj,
		FlagProcedure:  input.FlagProcedure,
		KdPenunjang:    input.KdPenunjang,
		AssesmentPel:   input.AssesmentPel,
		NoSuratKontrol: input.NoSuratKontrol,
		Catatan:        input.Catatan,
		NoTelp:         input.NoTelp,
		UserBuat:       user.Username,
		Status:         "active",
	}

	if err := database.DB.Create(&sep).Error; err != nil {
		// SEP sudah dibuat di BPJS tapi gagal save lokal
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "SEP berhasil di BPJS tapi gagal disimpan lokal: " + err.Error(),
			"no_sep": sepResponse.Sep.NoSep,
			"step":   "save_sep",
		})
		return
	}

	// Update registration dengan SEP number
	registration.SEPNumber = sepResponse.Sep.NoSep
	database.DB.Save(&registration)

	// ===================================================
	// STEP 3: Activate Visit (Check-in)
	// ===================================================

	tx := database.DB.Begin()

	registration.Status = models.RegistrationStatusInQueue
	registration.CheckedInAt = &now
	registration.CheckedInByID = &userIDUint
	if err := tx.Save(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal melakukan check-in: " + err.Error(),
			"no_sep": sepResponse.Sep.NoSep,
			"step":   "checkin",
		})
		return
	}

	// Handle Visit
	if registration.Visit != nil {
		registration.Visit.CheckInTime = &now
		registration.Visit.Status = models.VisitStatusInQueue
		if err := tx.Save(&registration.Visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui kunjungan", "step": "checkin"})
			return
		}

		if registration.Visit.RoomQueue != nil {
			registration.Visit.RoomQueue.Status = models.RoomQueueStatusWaiting
			registration.Visit.RoomQueue.Notes = "Check-in BPJS berhasil"
			if err := tx.Save(&registration.Visit.RoomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengaktifkan antrian", "step": "checkin"})
				return
			}
		} else {
			qn, err := generateRoomQueueNumber(tx, registration.DestinationRoomID, now)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian", "step": "checkin"})
				return
			}
			roomQueue := models.RoomQueue{
				RoomID:      registration.DestinationRoomID,
				QueueNumber: qn,
				QueueDate:   now,
				VisitID:     registration.Visit.ID,
				Status:      models.RoomQueueStatusWaiting,
				Notes:       "Check-in BPJS",
			}
			if err := tx.Create(&roomQueue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli", "step": "checkin"})
				return
			}
			registration.Visit.RoomQueue = &roomQueue
		}

		// Link SEP to visit
		tx.Model(&models.SEP{}).Where("id = ?", sep.ID).Update("visit_id", registration.Visit.ID)
	} else {
		// Create Visit for walk-in
		todayStr := now.Format("20060102")
		var lastVisit models.Visit
		var visitNum int
		err := tx.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
			Order("visit_number DESC").First(&lastVisit).Error
		if err != nil {
			visitNum = 1
		} else {
			var lastNum int
			fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &lastNum)
			visitNum = lastNum + 1
		}
		visitNumber := fmt.Sprintf("VIS%s%04d", todayStr, visitNum)

		visit := models.Visit{
			VisitNumber:    visitNumber,
			RegistrationID: registration.ID,
			RoomID:         registration.DestinationRoomID,
			DoctorID:       registration.DoctorID,
			VisitType:      "outpatient",
			VisitPurpose:   "Check-in BPJS",
			Status:         models.VisitStatusInQueue,
			CheckInTime:    &now,
		}
		if err := tx.Create(&visit).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan", "step": "checkin"})
			return
		}

		qn, err := generateRoomQueueNumber(tx, registration.DestinationRoomID, now)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nomor antrian", "step": "checkin"})
			return
		}
		roomQueue := models.RoomQueue{
			RoomID:      registration.DestinationRoomID,
			QueueNumber: qn,
			QueueDate:   now,
			VisitID:     visit.ID,
			Status:      models.RoomQueueStatusWaiting,
			Notes:       "Check-in BPJS",
		}
		if err := tx.Create(&roomQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat antrian poli", "step": "checkin"})
			return
		}
		visit.RoomQueue = &roomQueue
		registration.Visit = &visit

		// Link SEP to visit
		tx.Model(&models.SEP{}).Where("id = ?", sep.ID).Update("visit_id", visit.ID)
	}

	tx.Commit()

	// Update BPJSQueue: link visit_id, room_queue_id, dan kirim Task 3
	go func() {
		var bpjsQueue models.BPJSQueue
		if err := database.DB.Where("registration_id = ?", registration.ID).First(&bpjsQueue).Error; err != nil {
			return
		}

		bpjsQueue.Status = "checkin"
		bpjsQueue.WaktuCheckin = &now
		bpjsQueue.Task3At = &now
		if registration.Visit != nil {
			bpjsQueue.VisitID = &registration.Visit.ID
			if registration.Visit.RoomQueue != nil {
				bpjsQueue.RoomQueueID = &registration.Visit.RoomQueue.ID
			}
		}
		database.DB.Save(&bpjsQueue)

		// Kirim Task 3 ke BPJS
		if bpjsQueue.AddAntreanCode == 200 {
			bpjsService.UpdateTaskAsync(bpjsQueue.KodeBooking, 3, now, nil)
			fmt.Printf("[BPJSCheckinWithSEP] Task 3 dikirim untuk kode_booking: %s\n", bpjsQueue.KodeBooking)
		}
	}()

	// Reload
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("Visit").Preload("Visit.RoomQueue").
		Preload("CheckedInBy").
		First(&registration, registration.ID)

	finalQueueNumber := ""
	if registration.Visit != nil && registration.Visit.RoomQueue != nil {
		finalQueueNumber = registration.Visit.RoomQueue.QueueNumber
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("AddAntrean, SEP, dan check-in berhasil. Nomor antrian: %s", finalQueueNumber),
		"data":         registration,
		"no_sep":       sepResponse.Sep.NoSep,
		"queue_number": finalQueueNumber,
	})
}

// RescheduleRegistrationInput represents input for rescheduling
type RescheduleRegistrationInput struct {
	NewDate string `json:"new_date" binding:"required"` // YYYY-MM-DD
	NewRoom *uint  `json:"new_room_id"`                 // Optional: change room
	Reason  string `json:"reason"`                      // Optional: reason for reschedule
}

// sendBPJSAntreanOnCheckInSync sends BPJSQueue data to BPJS Antrian Online when check-in (synchronous).
// Returns (success bool, errorMessage string). If AddAntrean fails, check-in should be rolled back.
func sendBPJSAntreanOnCheckInSync(registration *models.Registration, queueNumber string, checkInTime time.Time) (bool, string) {
	// Load patient if not preloaded
	var patient models.Patient
	if registration.Patient != nil {
		patient = *registration.Patient
	} else {
		if err := database.DB.First(&patient, registration.PatientID).Error; err != nil {
			fmt.Printf("[BPJS Check-in] Gagal load patient: %v\n", err)
			return false, "Gagal load data pasien"
		}
	}

	// Get BPJS number from patient or SEP
	bpjsNumber := patient.NoBPJS
	if bpjsNumber == "" && registration.SEPNumber != "" {
		var sep models.SEP
		if err := database.DB.Where("no_sep = ?", registration.SEPNumber).First(&sep).Error; err == nil {
			bpjsNumber = sep.NoKartu
		}
	}
	if bpjsNumber == "" {
		fmt.Printf("[BPJS Check-in] Pasien tidak memiliki nomor BPJS\n")
		return false, "Pasien tidak memiliki nomor BPJS"
	}

	// Get poli mapping
	var poliMapping models.BPJSPoliMapping
	if err := database.DB.Where("room_id = ?", registration.DestinationRoomID).First(&poliMapping).Error; err != nil {
		fmt.Printf("[BPJS Check-in] Tidak ada mapping poli untuk room_id %d\n", registration.DestinationRoomID)
		return false, fmt.Sprintf("Tidak ada mapping poli BPJS untuk room_id %d", registration.DestinationRoomID)
	}

	// Get doctor mapping
	var dokterMapping models.BPJSDoctorMapping
	if registration.DoctorID != nil {
		if err := database.DB.Where("employee_id = ?", *registration.DoctorID).First(&dokterMapping).Error; err != nil {
			fmt.Printf("[BPJS Check-in] Tidak ada mapping dokter untuk employee_id %d\n", *registration.DoctorID)
			// Continue without doctor mapping, not critical
		}
	}

	// Get jam praktek from doctor schedule if available
	jamPraktek := "08:00-12:00" // Default jam praktek
	scheduleDate := checkInTime
	if registration.Visit != nil && registration.Visit.CreatedAt.Unix() > 0 {
		scheduleDate = registration.Visit.CreatedAt
	}
	dayOfWeek := int(scheduleDate.Weekday())
	if dayOfWeek == 0 {
		dayOfWeek = 7 // Minggu = 7
	}
	var doctorSchedule models.DoctorSchedule
	if registration.DoctorID != nil {
		if err := database.DB.Where("employee_id = ? AND room_id = ? AND day_of_week = ?",
			*registration.DoctorID, registration.DestinationRoomID, dayOfWeek).
			First(&doctorSchedule).Error; err == nil {
			jamPraktek = fmt.Sprintf("%s-%s", doctorSchedule.StartTime, doctorSchedule.EndTime)
		}
	}

	// Check existing BPJSQueue for this registration
	var existingQueue models.BPJSQueue
	if err := database.DB.Where("registration_id = ?", registration.ID).First(&existingQueue).Error; err == nil {
		// Already has BPJSQueue, update it instead of creating new one
		existingQueue.Status = "checkin"
		existingQueue.WaktuCheckin = &checkInTime
		// NOTE: Task3At is set ONLY after successful AddAntrean + UpdateTask below
		if registration.Visit != nil {
			existingQueue.VisitID = &registration.Visit.ID
			if registration.Visit.RoomQueue != nil {
				existingQueue.RoomQueueID = &registration.Visit.RoomQueue.ID
			}
		}
		database.DB.Save(&existingQueue)

		// If AddAntrean was successful before, just send Task 3
		if existingQueue.AddAntreanCode == 200 {
			existingQueue.Task3At = &checkInTime
			database.DB.Save(&existingQueue)
			bpjsService.UpdateTaskAsync(existingQueue.KodeBooking, 3, checkInTime, nil)
			return true, ""
		}

		// AddAntrean failed before, retry with NEW kode booking to avoid 208 duplicate
		oldKodeBooking := existingQueue.KodeBooking
		newKodeBooking := generateKodeBookingOnSite(checkInTime, existingQueue.KodePoli)
		existingQueue.KodeBooking = newKodeBooking
		fmt.Printf("[BPJS Check-in] Re-trying AddAntrean dengan kode_booking baru: %s (sebelumnya: %s, gagal: %s)\n", newKodeBooking, oldKodeBooking, existingQueue.AddAntreanMsg)
		addSuccess, addCode, addMsg := bpjsService.AddAntrean(&existingQueue)
		now := time.Now()
		existingQueue.AddAntreanSent = true
		existingQueue.AddAntreanCode = addCode
		existingQueue.AddAntreanMsg = addMsg
		existingQueue.LastSyncAt = &now
		if addSuccess {
			existingQueue.SyncStatus = "synced"
			existingQueue.SyncError = ""
			existingQueue.Task3At = &checkInTime
			fmt.Printf("[BPJS Check-in] AddAntrean retry berhasil untuk kode_booking: %s\n", existingQueue.KodeBooking)
			database.DB.Save(&existingQueue)
			// Send Task 3 after successful retry
			bpjsService.UpdateTaskAsync(existingQueue.KodeBooking, 3, checkInTime, nil)
			return true, ""
		}

		existingQueue.SyncStatus = "failed"
		existingQueue.SyncError = addMsg
		fmt.Printf("[BPJS Check-in] AddAntrean retry gagal untuk kode_booking: %s - [%d] %s\n", existingQueue.KodeBooking, addCode, addMsg)
		database.DB.Save(&existingQueue)
		return false, fmt.Sprintf("BPJS AddAntrean gagal: [%d] %s", addCode, addMsg)
	}

	// Determine jenis kunjungan and nomor referensi from SEP
	jenisKunjungan := 3 // Default: Kontrol untuk jadwal kontrol
	nomorReferensi := ""
	if registration.SEPNumber != "" {
		var sep models.SEP
		if err := database.DB.Where("no_sep = ?", registration.SEPNumber).First(&sep).Error; err == nil {
			if sep.NoSuratKontrol != "" {
				nomorReferensi = sep.NoSuratKontrol
				jenisKunjungan = 3 // Kontrol
			} else if sep.NoRujukan != "" {
				nomorReferensi = sep.NoRujukan
				if sep.AsalRujukan == "1" {
					jenisKunjungan = 1 // Rujukan FKTP
				} else if sep.AsalRujukan == "2" {
					jenisKunjungan = 4 // Rujukan Antar RS
				}
			}
		}
	}

	// Fallback: jika nomorReferensi kosong (SEP belum dibuat), cari dari SuratKontrol
	if nomorReferensi == "" && registration.SourceVisitID != nil {
		var sk models.SuratKontrol
		if err := database.DB.Where("visit_id = ?", *registration.SourceVisitID).First(&sk).Error; err == nil {
			nomorReferensi = sk.NoSuratKontrol
			jenisKunjungan = 3 // Kontrol
			fmt.Printf("[BPJS Check-in] Menggunakan nomorReferensi dari SuratKontrol: %s\n", nomorReferensi)
		}
	}

	// Fallback: jika masih kosong, cari dari NoRujukan di Registration
	if nomorReferensi == "" && registration.NoRujukan != "" {
		nomorReferensi = registration.NoRujukan
		if registration.AsalRujukan == "1" {
			jenisKunjungan = 1 // Rujukan FKTP
		} else if registration.AsalRujukan == "2" {
			jenisKunjungan = 4 // Rujukan Antar RS
		}
		fmt.Printf("[BPJS Check-in] Menggunakan nomorReferensi dari Registration.NoRujukan: %s\n", nomorReferensi)
	}

	// Generate kode booking
	kodeBooking := generateKodeBookingOnSite(checkInTime, poliMapping.KodePoliBPJS)

	// Extract angka antrean from queue number
	angkaAntrean := extractAngkaAntrean(queueNumber)

	// Estimate dilayani time (30 minutes from now as default)
	estimasiDilayani := checkInTime.Add(30 * time.Minute).UnixMilli()

	// PRIORITAS: Ambil dokter dari Surat Kontrol (bukan dari mapping)
	kodeDokter := ""
	namaDokterBPJS := ""
	var noSKForLookup string
	if registration.SourceVisitID != nil {
		var sk models.SuratKontrol
		if err := database.DB.Where("visit_id = ? AND status = ?", *registration.SourceVisitID, "active").First(&sk).Error; err == nil {
			kodeDokter = sk.KodeDokter
			namaDokterBPJS = sk.NamaDokter
			noSKForLookup = sk.NoSuratKontrol
			fmt.Printf("[BPJS Check-in Sync] Dokter dari Surat Kontrol: %s - %s\n", kodeDokter, namaDokterBPJS)

			// Jika namaDokter kosong di DB, resolve dari VClaim Detail
			if namaDokterBPJS == "" && kodeDokter != "" && sk.NoSuratKontrol != "" {
				fmt.Printf("[BPJS Check-in Sync] NamaDokter kosong, fetch VClaim Detail SK: %s\n", sk.NoSuratKontrol)
				vclaimClient, vErr := bpjsService.NewVClaimClient()
				if vErr == nil {
					detail, dErr := vclaimClient.GetSuratKontrolDetail(sk.NoSuratKontrol)
					if dErr == nil && detail != nil && detail.NamaDokter != "" {
						namaDokterBPJS = detail.NamaDokter
						fmt.Printf("[BPJS Check-in Sync] NamaDokter resolved dari VClaim: %s\n", namaDokterBPJS)
						// Update DB supaya tidak kosong lagi
						database.DB.Model(&sk).Update("nama_dokter", namaDokterBPJS)
					}
				}
			}
		}
	}
	// Fallback ke mapping jika tidak ada Surat Kontrol
	if kodeDokter == "" && dokterMapping.ID > 0 {
		kodeDokter = dokterMapping.KodeDokterBPJS
		namaDokterBPJS = dokterMapping.NamaDokterBPJS
		fmt.Printf("[BPJS Check-in Sync] Fallback ke mapping dokter: %s - %s\n", kodeDokter, namaDokterBPJS)
	}
	// Fallback terakhir: jika namaDokter masih kosong & ada noSK, coba VClaim
	if namaDokterBPJS == "" && kodeDokter != "" && noSKForLookup != "" {
		fmt.Printf("[BPJS Check-in Sync] Final fallback: VClaim Detail SK %s\n", noSKForLookup)
		vclaimClient, vErr := bpjsService.NewVClaimClient()
		if vErr == nil {
			detail, dErr := vclaimClient.GetSuratKontrolDetail(noSKForLookup)
			if dErr == nil && detail != nil && detail.NamaDokter != "" {
				namaDokterBPJS = detail.NamaDokter
			}
		}
	}

	// Get patient phone number with fallback
	noHP := patient.NoHP
	if noHP == "" {
		noHP = patient.NoTelepon
	}
	if noHP == "" {
		noHP = patient.NoHPAlternatif
	}
	if noHP == "" {
		noHP = patient.TeleponPenanggungJawab
	}
	if noHP == "" {
		noHP = "000000000000" // Default jika tidak ada nomor HP sama sekali
		fmt.Printf("[BPJS Check-in] Pasien tidak memiliki nomor HP, menggunakan default\n")
	}

	// Create BPJSQueue
	now := time.Now()
	bpjsQueue := models.BPJSQueue{
		KodeBooking:      kodeBooking,
		NomorAntrean:     queueNumber,
		AngkaAntrean:     angkaAntrean,
		TanggalPeriksa:   checkInTime,
		JamPraktek:       jamPraktek,
		KodePoli:         poliMapping.KodePoliBPJS,
		NamaPoli:         poliMapping.NamaPoliBPJS,
		KodeDokter:       kodeDokter,
		NamaDokter:       namaDokterBPJS,
		JenisPasien:      "JKN",
		NoKartu:          bpjsNumber,
		NIK:              patient.NIK,
		NoHP:             noHP,
		NoRM:             patient.NoRM,
		NamaPasien:       patient.NamaLengkap,
		JenisKunjungan:   jenisKunjungan,
		NomorReferensi:   nomorReferensi,
		EstimasiDilayani: estimasiDilayani,
		Status:           "checkin",
		WaktuCheckin:     &checkInTime,
		// Task3At is set ONLY after successful AddAntrean + UpdateTask
		PatientID:      &patient.ID,
		RegistrationID: &registration.ID,
		RoomID:         &registration.DestinationRoomID,
		PoliMappingID:  &poliMapping.ID,
		SyncStatus:     "pending",
	}

	if registration.Visit != nil {
		bpjsQueue.VisitID = &registration.Visit.ID
		if registration.Visit.RoomQueue != nil {
			bpjsQueue.RoomQueueID = &registration.Visit.RoomQueue.ID
		}
	}

	if dokterMapping.ID > 0 {
		bpjsQueue.DoctorMappingID = &dokterMapping.ID
	}

	if err := database.DB.Create(&bpjsQueue).Error; err != nil {
		fmt.Printf("[BPJS Check-in] Gagal menyimpan BPJSQueue: %s\n", err.Error())
		return false, "Gagal menyimpan data antrian BPJS: " + err.Error()
	}

	// Call AddAntrean to BPJS
	addSuccess, addCode, addMsg := bpjsService.AddAntrean(&bpjsQueue)

	// Update BPJSQueue with result
	bpjsQueue.AddAntreanSent = true
	bpjsQueue.AddAntreanCode = addCode
	bpjsQueue.AddAntreanMsg = addMsg
	bpjsQueue.LastSyncAt = &now

	if addSuccess {
		bpjsQueue.SyncStatus = "synced"
		bpjsQueue.Task3At = &checkInTime
		fmt.Printf("[BPJS Check-in] AddAntrean berhasil untuk kode_booking: %s\n", kodeBooking)

		// Save updated BPJSQueue
		database.DB.Save(&bpjsQueue)

		// Send Task 3 (tunggu di poli) secara async
		go func() {
			bpjsService.UpdateTaskAsync(kodeBooking, 3, checkInTime, nil)
		}()

		return true, ""
	}

	bpjsQueue.SyncStatus = "failed"
	bpjsQueue.SyncError = addMsg
	fmt.Printf("[BPJS Check-in] AddAntrean gagal untuk kode_booking: %s - [%d] %s\n", kodeBooking, addCode, addMsg)

	// Save updated BPJSQueue
	database.DB.Save(&bpjsQueue)

	return false, fmt.Sprintf("BPJS AddAntrean gagal: [%d] %s", addCode, addMsg)
}

// SendAntrean mengirim AddAntrean ke BPJS untuk jadwal kontrol
// POST /api/registrations/:id/send-antrean
func SendAntrean(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.Preload("Patient").Preload("Visit").Preload("Visit.RoomQueue").
		First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate BPJS
	if !strings.EqualFold(registration.PaymentMethod, "bpjs") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Endpoint ini hanya untuk pasien BPJS"})
		return
	}

	now := time.Now()

	// Generate queue number
	queueNumber := ""
	if registration.Visit != nil && registration.Visit.RoomQueue != nil {
		queueNumber = registration.Visit.RoomQueue.QueueNumber
	} else {
		tempTx := database.DB.Begin()
		var err error
		queueNumber, err = generateRoomQueueNumber(tempTx, registration.DestinationRoomID, now)
		tempTx.Rollback()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate nomor antrian"})
			return
		}
	}

	// Call AddAntrean synchronously
	success, errMsg := sendBPJSAntreanOnCheckInSync(&registration, queueNumber, now)

	// Reload BPJSQueue untuk response
	var bpjsQueue models.BPJSQueue
	database.DB.Where("registration_id = ?", registration.ID).First(&bpjsQueue)

	if !success {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   fmt.Sprintf("Gagal mengirim antrean: %s", errMsg),
			"success": false,
			"antreanStatus": gin.H{
				"id":             bpjsQueue.ID,
				"kodeBooking":    bpjsQueue.KodeBooking,
				"addAntreanSent": bpjsQueue.AddAntreanSent,
				"addAntreanCode": bpjsQueue.AddAntreanCode,
				"addAntreanMsg":  bpjsQueue.AddAntreanMsg,
				"syncStatus":     bpjsQueue.SyncStatus,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Antrean berhasil dikirim ke BPJS",
		"success": true,
		"antreanStatus": gin.H{
			"id":             bpjsQueue.ID,
			"kodeBooking":    bpjsQueue.KodeBooking,
			"addAntreanSent": bpjsQueue.AddAntreanSent,
			"addAntreanCode": bpjsQueue.AddAntreanCode,
			"addAntreanMsg":  bpjsQueue.AddAntreanMsg,
			"syncStatus":     bpjsQueue.SyncStatus,
			"nomorAntrean":   bpjsQueue.NomorAntrean,
			"kodeDokter":     bpjsQueue.KodeDokter,
			"namaDokter":     bpjsQueue.NamaDokter,
		},
	})
}

// RescheduleRegistration godoc
// @Summary Reschedule a scheduled registration
// @Description Change the scheduled date for a follow-up registration
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Param input body RescheduleRegistrationInput true "Reschedule data"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/reschedule [put]
func RescheduleRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.Preload("Visit").Preload("Visit.RoomQueue").First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate it's a scheduled follow-up
	if !registration.IsFollowUp {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya jadwal kontrol yang bisa di-reschedule"})
		return
	}

	// Validate status
	if registration.Status != models.RegistrationStatusScheduled && registration.Status != models.RegistrationStatusNoShow {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran tidak dalam status yang bisa di-reschedule"})
		return
	}

	var input RescheduleRegistrationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse new date
	newDate, err := ParseLocalDate(input.NewDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid (gunakan YYYY-MM-DD)"})
		return
	}

	// Validate new date is not in the past
	today := time.Now().Truncate(24 * time.Hour)
	if newDate.Before(today) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tanggal tidak boleh di masa lalu"})
		return
	}

	tx := database.DB.Begin()

	// Update registration
	oldDate := registration.ScheduledDate
	registration.ScheduledDate = &newDate
	registration.RegistrationDate = newDate
	registration.Status = models.RegistrationStatusScheduled // Reset status if was no_show

	if input.NewRoom != nil {
		registration.DestinationRoomID = *input.NewRoom
	}

	if input.Reason != "" {
		registration.Notes = fmt.Sprintf("%s\n[Reschedule dari %s: %s]",
			registration.Notes, oldDate.Format("2006-01-02"), input.Reason)
	}

	if err := tx.Save(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan"})
		return
	}

	// Update RoomQueue date and regenerate queue number if exists
	if registration.Visit != nil && registration.Visit.RoomQueue != nil {
		roomQueue := registration.Visit.RoomQueue
		roomID := registration.DestinationRoomID

		// Get room for queue code
		var room models.Room
		tx.First(&room, roomID)

		queueCode := room.QueueCode
		if queueCode == "" {
			queueCode = "Q"
		}

		// Generate new queue number for new date
		var lastQueue models.RoomQueue
		var queueNum int

		err := tx.Where("room_id = ? AND queue_date = ? AND id != ?", roomID, newDate, roomQueue.ID).
			Order("queue_number DESC").First(&lastQueue).Error

		if err != nil {
			queueNum = 1
		} else {
			var lastNum int
			fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
			queueNum = lastNum + 1
		}

		roomQueue.QueueNumber = fmt.Sprintf("%s%03d", queueCode, queueNum)
		roomQueue.QueueDate = newDate
		roomQueue.RoomID = roomID

		if err := tx.Save(roomQueue).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update antrian"})
			return
		}

		// Update visit room if changed
		if input.NewRoom != nil {
			registration.Visit.RoomID = *input.NewRoom
			tx.Save(&registration.Visit)
		}
	}

	tx.Commit()

	// Reload with associations
	database.DB.Preload("Patient").Preload("DestinationRoom").
		Preload("Doctor").Preload("Visit").Preload("Visit.RoomQueue").
		First(&registration, registration.ID)

	c.JSON(http.StatusOK, gin.H{
		"data":    registration,
		"message": fmt.Sprintf("Jadwal kontrol berhasil diubah ke tanggal %s", newDate.Format("2006-01-02")),
	})
}

// autoMarkNoShow marks scheduled registrations as no_show after 30 days
func autoMarkNoShow() {
	cutoffDate := time.Now().AddDate(0, 0, -30) // 30 days ago

	database.DB.Model(&models.Registration{}).
		Where("is_follow_up = ? AND status = ? AND scheduled_date < ?",
			true, models.RegistrationStatusScheduled, cutoffDate).
		Update("status", models.RegistrationStatusNoShow)
}

// CancelScheduledRegistration godoc
// @Summary Cancel a scheduled registration
// @Description Cancel a scheduled follow-up registration
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/cancel-scheduled [post]
func CancelScheduledRegistration(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	if err := database.DB.Preload("Visit").Preload("Visit.RoomQueue").First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate it's a scheduled follow-up
	if !registration.IsFollowUp {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran ini bukan jadwal kontrol"})
		return
	}

	// Validate status
	if registration.Status != models.RegistrationStatusScheduled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya jadwal kontrol aktif yang bisa dibatalkan"})
		return
	}

	tx := database.DB.Begin()

	// Cancel registration
	registration.Status = models.RegistrationStatusCancelled
	if err := tx.Save(&registration).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan"})
		return
	}

	// Cancel visit
	if registration.Visit != nil {
		registration.Visit.Status = models.VisitStatusCancelled
		tx.Save(&registration.Visit)

		// Cancel room queue
		if registration.Visit.RoomQueue != nil {
			registration.Visit.RoomQueue.Status = models.RoomQueueStatusCancelled
			tx.Save(&registration.Visit.RoomQueue)
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"data":    registration,
		"message": "Jadwal kontrol berhasil dibatalkan",
	})
}

// GetKontrolInfo godoc
// @Summary Get kontrol info for check-in drawer
// @Description Get all information needed for check-in kontrol drawer
// @Tags Registration
// @Accept json
// @Produce json
// @Param id path int true "Registration ID (jadwal kontrol)"
// @Success 200 {object} map[string]interface{}
// @Router /registrations/{id}/kontrol-info [get]
func GetKontrolInfo(c *gin.Context) {
	id := c.Param("id")
	var registration models.Registration

	// Load registration with all needed relations
	if err := database.DB.Preload("Patient").
		Preload("DestinationRoom").
		Preload("Doctor").
		Preload("SourceVisit").
		Preload("SourceVisit.SEP").
		First(&registration, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pendaftaran tidak ditemukan"})
		return
	}

	// Validate it's a scheduled follow-up
	if !registration.IsFollowUp {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pendaftaran ini bukan jadwal kontrol"})
		return
	}

	// Get source registration for more context
	var sourceRegistration *models.Registration
	if registration.SourceVisitID != nil {
		var srcReg models.Registration
		database.DB.Where("visit_id = ?", *registration.SourceVisitID).
			Preload("Doctor").
			Preload("DestinationRoom").
			First(&srcReg)
		if srcReg.ID > 0 {
			sourceRegistration = &srcReg
		}
	}

	// Get Surat Kontrol related to this registration
	var suratKontrol *models.SuratKontrol
	if registration.SourceVisitID != nil {
		var sk models.SuratKontrol
		if err := database.DB.Where("visit_id = ?", *registration.SourceVisitID).First(&sk).Error; err == nil {
			suratKontrol = &sk
		}
	}

	// For BPJS patients, try to get peserta info
	var pesertaInfo map[string]interface{}
	if registration.PaymentMethod == "bpjs" && registration.Patient != nil && registration.Patient.NoBPJS != "" {
		// Use vclaim to get peserta info
		vclient, err := bpjsService.NewVClaimClient()
		if err == nil && vclient != nil {
			resp, err := vclient.GetPesertaByNoKartu(registration.Patient.NoBPJS, time.Now().Format("2006-01-02"))
			if err == nil && resp != nil {
				pesertaInfo = map[string]interface{}{
					"noKartu":      resp.Peserta.NoKartu,
					"nama":         resp.Peserta.Nama,
					"nik":          resp.Peserta.Nik,
					"jenisKelamin": resp.Peserta.Sex,
					"tglLahir":     resp.Peserta.TglLahir,
					"statusPeserta": map[string]interface{}{
						"kode":       resp.Peserta.StatusPeserta.Kode,
						"keterangan": resp.Peserta.StatusPeserta.Keterangan,
					},
					"hakKelas": map[string]interface{}{
						"kode":       resp.Peserta.HakKelas.Kode,
						"keterangan": resp.Peserta.HakKelas.Keterangan,
					},
					"jenisPeserta": map[string]interface{}{
						"kode":       resp.Peserta.JenisPeserta.Kode,
						"keterangan": resp.Peserta.JenisPeserta.Keterangan,
					},
				}
			}
		}
	}

	// Build response
	response := gin.H{
		"registration":       registration,
		"patient":            registration.Patient,
		"destinationRoom":    registration.DestinationRoom,
		"doctor":             registration.Doctor,
		"sourceRegistration": sourceRegistration,
		"sourceVisit":        registration.SourceVisit,
		"suratKontrol":       suratKontrol,
		"isBPJS":             registration.PaymentMethod == "bpjs",
		"pesertaInfo":        pesertaInfo,
	}

	// Check BPJSQueue status (apakah AddAntrean sudah dikirim)
	var bpjsQueue models.BPJSQueue
	if err := database.DB.Where("registration_id = ?", registration.ID).First(&bpjsQueue).Error; err == nil {
		response["antreanStatus"] = gin.H{
			"id":             bpjsQueue.ID,
			"kodeBooking":    bpjsQueue.KodeBooking,
			"addAntreanSent": bpjsQueue.AddAntreanSent,
			"addAntreanCode": bpjsQueue.AddAntreanCode,
			"addAntreanMsg":  bpjsQueue.AddAntreanMsg,
			"syncStatus":     bpjsQueue.SyncStatus,
			"status":         bpjsQueue.Status,
			"kodeDokter":     bpjsQueue.KodeDokter,
			"namaDokter":     bpjsQueue.NamaDokter,
			"kodePoli":       bpjsQueue.KodePoli,
			"namaPoli":       bpjsQueue.NamaPoli,
			"nomorAntrean":   bpjsQueue.NomorAntrean,
			"nomorReferensi": bpjsQueue.NomorReferensi,
			"jenisKunjungan": bpjsQueue.JenisKunjungan,
		}
	}

	// Check if this registration already has an existing SEP (sudah buat SEP sebelumnya)
	// Filter: hanya ambil yang statusnya bukan "deleted"
	var existingSEP models.SEP
	if err := database.DB.Where("registration_id = ? AND status != ?", registration.ID, "deleted").First(&existingSEP).Error; err == nil {
		response["existingSEP"] = gin.H{
			"noSEP":          existingSEP.NoSEP,
			"tglSEP":         existingSEP.TglSEP,
			"jnsPelayanan":   existingSEP.JnsPelayanan,
			"diagAwal":       existingSEP.DiagAwal,
			"namaDiagnosa":   existingSEP.NamaDiagnosa,
			"klsRawat":       existingSEP.KlsRawatHak,
			"noKartu":        existingSEP.NoKartu,
			"noSuratKontrol": existingSEP.NoSuratKontrol,
			"poliTujuan":     existingSEP.KodePoli,
			"namaPoliTujuan": existingSEP.NamaPoli,
			"kodeDPJP":       existingSEP.KodeDPJP,
			"namaDPJP":       existingSEP.NamaDPJP,
		}
	}

	// If surat kontrol exists, add SEP asal info
	if suratKontrol != nil {
		response["sepAsal"] = gin.H{
			"noSEP": suratKontrol.NoSEP,
		}
	} else if registration.SourceVisit != nil && registration.SourceVisit.SEP != nil {
		response["sepAsal"] = gin.H{
			"noSEP":    registration.SourceVisit.SEP.NoSEP,
			"tglSEP":   registration.SourceVisit.SEP.TglSEP,
			"diagAwal": registration.SourceVisit.SEP.DiagAwal,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": response,
	})
}
