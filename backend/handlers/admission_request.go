package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================================================================
// ADMISSION REQUEST HANDLERS
// Permintaan Rawat Inap dari UGD/Poli ke Bagian Pendaftaran
// ===========================================================================

// GetAdmissionRequests returns all admission requests with filters
func GetAdmissionRequests(c *gin.Context) {
	var requests []models.AdmissionRequest

	query := database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Room").
		Preload("SourceVisit.Doctor").
		Preload("SourceVisit.Registration").
		Preload("SourceVisit.Registration.Patient").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("RequestedBy").
		Preload("ApprovedRoom").
		Preload("ApprovedBed").
		Preload("Doctor").
		Preload("ProcessedBy").
		Preload("InpatientVisit")

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by priority
	if priority := c.Query("priority"); priority != "" {
		query = query.Where("priority = ?", priority)
	}

	// Filter by date range
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("DATE(requested_at) >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("DATE(requested_at) <= ?", endDate)
	}

	// Filter by patient_id
	if patientID := c.Query("patient_id"); patientID != "" {
		query = query.Joins("LEFT JOIN registrations reg ON reg.id = admission_requests.registration_id").
			Where("reg.patient_id = ?", patientID)
	}

	// Filter by source_visit_id
	if sourceVisitID := c.Query("source_visit_id"); sourceVisitID != "" {
		query = query.Where("admission_requests.source_visit_id = ?", sourceVisitID)
	}

	// Search by patient name or request number
	if search := c.Query("search"); search != "" {
		query = query.Joins("LEFT JOIN registrations ON registrations.id = admission_requests.registration_id").
			Joins("LEFT JOIN patients ON patients.id = registrations.patient_id").
			Where("admission_requests.request_number LIKE ? OR patients.nama_lengkap LIKE ? OR patients.no_rm LIKE ?",
				"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Order by requested_at descending (newest first)
	query = query.Order("admission_requests.requested_at DESC")

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.AdmissionRequest{}).Count(&total)

	if err := query.Offset(offset).Limit(limit).Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": requests,
		"meta": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetAdmissionRequest returns a single admission request by ID
func GetAdmissionRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.AdmissionRequest

	if err := database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Room").
		Preload("SourceVisit.Doctor").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("RequestedBy").
		Preload("ApprovedRoom").
		Preload("ApprovedRoom.Units").
		Preload("ApprovedRoom.Units.Beds").
		Preload("ApprovedBed").
		Preload("Doctor").
		Preload("ProcessedBy").
		Preload("InpatientVisit").
		First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan rawat inap tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": request})
}

// GetPendingAdmissionRequestsCount returns count of pending requests
func GetPendingAdmissionRequestsCount(c *gin.Context) {
	var count int64
	database.DB.Model(&models.AdmissionRequest{}).
		Where("status = ?", models.AdmissionRequestStatusPending).
		Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// CreateAdmissionRequest creates a new admission request (called from disposition)
func CreateAdmissionRequest(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		SourceVisitID   uint   `json:"source_visit_id" binding:"required"`
		AdmissionType   string `json:"admission_type" binding:"required"` // elektif, emergency
		AdmissionReason string `json:"admission_reason"`
		Diagnosis       string `json:"diagnosis"`
		Priority        string `json:"priority"`        // normal, urgent, emergency
		PreferredClass  string `json:"preferred_class"` // kelas yang diminta
		SpecialNotes    string `json:"special_notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate source visit
	var sourceVisit models.Visit
	if err := database.DB.Preload("Registration").First(&sourceVisit, input.SourceVisitID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kunjungan tidak ditemukan"})
		return
	}

	// Check if there's already a pending request for this visit
	var existingRequest models.AdmissionRequest
	if err := database.DB.Where("source_visit_id = ? AND status = ?", input.SourceVisitID, models.AdmissionRequestStatusPending).First(&existingRequest).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Sudah ada permintaan rawat inap yang pending untuk kunjungan ini",
			"request_number": existingRequest.RequestNumber,
		})
		return
	}

	// Generate request number
	requestNumber := generateAdmissionRequestNumber()

	// Set default priority
	if input.Priority == "" {
		input.Priority = "normal"
	}

	now := time.Now()
	request := models.AdmissionRequest{
		RequestNumber:   requestNumber,
		SourceVisitID:   input.SourceVisitID,
		RegistrationID:  sourceVisit.RegistrationID,
		AdmissionType:   input.AdmissionType,
		AdmissionReason: input.AdmissionReason,
		Diagnosis:       input.Diagnosis,
		Priority:        input.Priority,
		PreferredClass:  input.PreferredClass,
		SpecialNotes:    input.SpecialNotes,
		Status:          models.AdmissionRequestStatusPending,
		RequestedByID:   userID,
		RequestedAt:     now,
	}

	if err := database.DB.Create(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat permintaan rawat inap"})
		return
	}

	// Reload with relations
	database.DB.
		Preload("SourceVisit").
		Preload("SourceVisit.Room").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("RequestedBy").
		First(&request, request.ID)

	// Send notification to Pendaftaran/Admisi roles
	if NotifService != nil {
		patientName := ""
		if request.Registration != nil && request.Registration.Patient != nil {
			patientName = request.Registration.Patient.NamaLengkap
		}
		roomName := "N/A"
		if request.SourceVisit != nil && request.SourceVisit.Room != nil {
			roomName = request.SourceVisit.Room.Name
		}

		go NotifService.NotifyByRoles(
			[]string{"Pendaftaran", "Admisi", "pendaftaran", "admisi"},
			models.NotificationTypeAdmissionRequest,
			"Permintaan Rawat Inap Baru",
			fmt.Sprintf("Pasien %s dari %s membutuhkan rawat inap (%s)", patientName, roomName, input.Priority),
			map[string]interface{}{
				"request_id":     request.ID,
				"request_number": request.RequestNumber,
				"patient_name":   patientName,
				"priority":       input.Priority,
				"admission_type": input.AdmissionType,
			},
		)
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    request,
		"message": "Permintaan rawat inap berhasil dibuat. Menunggu proses dari bagian pendaftaran.",
	})
}

// ProcessAdmissionRequest processes (approves) an admission request
func ProcessAdmissionRequest(c *gin.Context) {
	id := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RoomID        uint   `json:"room_id" binding:"required"`
		BedID         uint   `json:"bed_id" binding:"required"`
		DoctorID      uint   `json:"doctor_id" binding:"required"` // DPJP
		AdminNotes    string `json:"admin_notes"`
		PaymentMethod string `json:"payment_method"` // cash, bpjs, insurance — override metode bayar
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the request
	var request models.AdmissionRequest
	if err := database.DB.
		Preload("SourceVisit").
		Preload("Registration").
		First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan rawat inap tidak ditemukan"})
		return
	}

	// Check status
	if request.Status != models.AdmissionRequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan sudah diproses sebelumnya"})
		return
	}

	// Validate room
	var room models.Room
	if err := database.DB.First(&room, input.RoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ruangan tidak ditemukan"})
		return
	}

	// Validate bed is available
	var bed models.Bed
	if err := database.DB.First(&bed, input.BedID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tempat tidur tidak ditemukan"})
		return
	}
	if bed.Status != "available" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tempat tidur tidak tersedia"})
		return
	}

	// Validate doctor
	var doctor models.Employee
	if err := database.DB.First(&doctor, input.DoctorID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dokter tidak ditemukan"})
		return
	}

	tx := database.DB.Begin()

	// Create inpatient visit (same logic as before)
	// Determine payment method
	paymentMethod := input.PaymentMethod

	inpatientVisit, err := createInpatientVisitFromRequest(tx, &request, input.RoomID, input.BedID, input.DoctorID, room.RoomClass)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kunjungan rawat inap: " + err.Error()})
		return
	}

	// Update bed status
	if err := tx.Model(&models.Bed{}).Where("id = ?", input.BedID).Update("status", "occupied").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate status tempat tidur"})
		return
	}

	// Update registration payment_method jika dikirim dari frontend
	if paymentMethod != "" {
		tx.Model(&models.Registration{}).Where("id = ?", request.RegistrationID).Update("payment_method", paymentMethod)
	}

	// Update request
	now := time.Now()
	request.Status = models.AdmissionRequestStatusApproved
	request.ApprovedRoomID = &input.RoomID
	request.ApprovedBedID = &input.BedID
	request.DoctorID = &input.DoctorID
	request.InpatientClass = room.RoomClass
	request.InpatientVisitID = &inpatientVisit.ID
	request.ProcessedByID = &userID
	request.ProcessedAt = &now
	request.AdminNotes = input.AdminNotes

	if err := tx.Save(&request).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate permintaan"})
		return
	}

	// Complete the source visit
	tx.Model(&models.Visit{}).Where("id = ?", request.SourceVisitID).Updates(map[string]interface{}{
		"status":   models.VisitStatusCompleted,
		"end_time": now,
	})

	// Complete source visit's room queue
	tx.Model(&models.RoomQueue{}).Where("visit_id = ?", request.SourceVisitID).Updates(map[string]interface{}{
		"status":       models.RoomQueueStatusCompleted,
		"completed_at": now,
	})

	// Auto-update SEP: Find active rawat inap SEP linked to source visit or patient, and update to inpatient visit
	// This ensures SEP is correctly linked to the inpatient visit instead of the source (UGD) visit
	var sep models.SEP
	if err := tx.Where("visit_id = ? AND jns_pelayanan = ? AND status = ?", request.SourceVisitID, "1", "active").
		First(&sep).Error; err == nil {
		// Found SEP linked to source visit, update to inpatient visit
		tx.Model(&sep).Update("visit_id", inpatientVisit.ID)
	} else {
		// Try to find by patient_id and source registration
		if request.Registration != nil {
			patientID := request.Registration.PatientID
			if err := tx.Where("patient_id = ? AND jns_pelayanan = ? AND status = ? AND visit_id IS NULL", patientID, "1", "active").
				First(&sep).Error; err == nil {
				// Found SEP without visit_id, update to inpatient visit
				tx.Model(&sep).Update("visit_id", inpatientVisit.ID)
			}
		}
	}

	tx.Commit()

	// Reload with relations
	database.DB.
		Preload("SourceVisit").
		Preload("Registration").
		Preload("Registration.Patient").
		Preload("ApprovedRoom").
		Preload("ApprovedBed").
		Preload("Doctor").
		Preload("ProcessedBy").
		Preload("InpatientVisit").
		First(&request, request.ID)

	// Notify the source room that admission is approved
	if NotifService != nil && request.SourceVisit != nil {
		patientName := ""
		if request.Registration != nil && request.Registration.Patient != nil {
			patientName = request.Registration.Patient.NamaLengkap
		}

		go NotifService.NotifyRoomUsers(
			request.SourceVisit.RoomID,
			models.NotificationTypeAdmissionApproved,
			"Admisi Disetujui",
			fmt.Sprintf("Pasien %s telah diterima rawat inap di %s", patientName, room.Name),
			map[string]interface{}{
				"request_id":         request.ID,
				"inpatient_visit_id": inpatientVisit.ID,
				"room_name":          room.Name,
			},
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    request,
		"message": "Pasien berhasil diadmisi ke rawat inap",
	})
}

// RejectAdmissionRequest rejects an admission request
func RejectAdmissionRequest(c *gin.Context) {
	id := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var input struct {
		RejectionReason string `json:"rejection_reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan penolakan wajib diisi"})
		return
	}

	var request models.AdmissionRequest
	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan rawat inap tidak ditemukan"})
		return
	}

	if request.Status != models.AdmissionRequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan sudah diproses sebelumnya"})
		return
	}

	now := time.Now()
	request.Status = models.AdmissionRequestStatusRejected
	request.RejectionReason = input.RejectionReason
	request.ProcessedByID = &userID
	request.ProcessedAt = &now

	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menolak permintaan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    request,
		"message": "Permintaan rawat inap ditolak",
	})
}

// CancelAdmissionRequest cancels an admission request (by requester)
func CancelAdmissionRequest(c *gin.Context) {
	id := c.Param("id")
	userIDVal, _ := c.Get("userID")
	userID, _ := userIDVal.(uint)

	var request models.AdmissionRequest
	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Permintaan rawat inap tidak ditemukan"})
		return
	}

	if request.Status != models.AdmissionRequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya permintaan pending yang dapat dibatalkan"})
		return
	}

	now := time.Now()
	request.Status = models.AdmissionRequestStatusCancelled
	request.ProcessedByID = &userID
	request.ProcessedAt = &now

	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan permintaan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    request,
		"message": "Permintaan rawat inap dibatalkan",
	})
}

// Helper: Generate admission request number
func generateAdmissionRequestNumber() string {
	var lastRequest models.AdmissionRequest
	today := time.Now().Format("20060102")
	prefix := "ADM" + today

	if err := database.DB.Where("request_number LIKE ?", prefix+"%").
		Order("request_number DESC").First(&lastRequest).Error; err != nil {
		return prefix + "0001"
	}

	// Extract number from last request
	var lastNum int
	fmt.Sscanf(lastRequest.RequestNumber, prefix+"%d", &lastNum)
	return fmt.Sprintf("%s%04d", prefix, lastNum+1)
}

// Helper: Create inpatient visit from admission request
func createInpatientVisitFromRequest(tx *gorm.DB, request *models.AdmissionRequest, roomID uint, bedID uint, doctorID uint, roomClass string) (*models.Visit, error) {
	// Get source visit
	var sourceVisit models.Visit
	if err := tx.First(&sourceVisit, request.SourceVisitID).Error; err != nil {
		return nil, err
	}

	// Generate visit number
	var lastVisit models.Visit
	todayStr := time.Now().Format("20060102")
	visitNumber := fmt.Sprintf("VIS%s0001", todayStr)
	// Use Unscoped to include soft-deleted records when checking for last visit number
	if err := tx.Unscoped().Where("visit_number LIKE ?", "VIS"+todayStr+"%").
		Order("visit_number DESC").First(&lastVisit).Error; err == nil {
		var num int
		fmt.Sscanf(lastVisit.VisitNumber, "VIS"+todayStr+"%d", &num)
		visitNumber = fmt.Sprintf("VIS%s%04d", todayStr, num+1)
	}

	now := time.Now()
	inpatientVisit := models.Visit{
		VisitNumber:    visitNumber,
		RegistrationID: request.RegistrationID, // Use same registration
		RoomID:         roomID,
		DoctorID:       &doctorID,
		VisitType:      "inpatient",
		VisitPurpose:   "Rawat Inap",
		ReferralFrom:   &request.SourceVisitID,
		Status:         models.VisitStatusWaiting,
		CheckInTime:    &now,
		Complaint:      sourceVisit.Complaint,
		BedID:          &bedID,
		AdmissionTime:  &now,
		InpatientClass: roomClass,
	}

	if err := tx.Create(&inpatientVisit).Error; err != nil {
		return nil, err
	}

	// Update registration type to inpatient and reset status to in_progress
	// (registration might have been set to 'completed' when source visit was discharged)
	tx.Model(&models.Registration{}).Where("id = ?", request.RegistrationID).Updates(map[string]interface{}{
		"registration_type": "inpatient",
		"status":            models.RegistrationStatusInProgress,
	})

	return &inpatientVisit, nil
}
