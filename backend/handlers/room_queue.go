package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RoomQueueResponse extends RoomQueue with MJKN info
type RoomQueueResponse struct {
	models.RoomQueue
	IsMJKN    bool              `json:"is_mjkn"`
	BPJSQueue *models.BPJSQueue `json:"bpjs_queue,omitempty"`
}

// GetRoomQueues returns all room queues with filters
func GetRoomQueues(c *gin.Context) {
	var queues []models.RoomQueue

	query := database.DB.Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").Preload("CalledBy").Preload("Room")

	// Filter by room_id
	if roomID := c.Query("room_id"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	// Filter by date
	if date := c.Query("date"); date != "" {
		query = query.Where("queue_date = ?", date)
	} else {
		// Default to today
		today := time.Now().Format("2006-01-02")
		query = query.Where("queue_date = ?", today)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Order chronologically so inherited queue prefixes (e.g. A, B, MJKN) stay in arrival order
	query = query.Order("created_at ASC, id ASC")

	if err := query.Find(&queues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get all queue IDs
	queueIDs := make([]uint, len(queues))
	for i, q := range queues {
		queueIDs[i] = q.ID
	}

	// Fetch BPJS queue info in one query
	var bpjsQueues []models.BPJSQueue
	if len(queueIDs) > 0 {
		database.DB.Where("room_queue_id IN ?", queueIDs).Find(&bpjsQueues)
	}

	// Create map for quick lookup
	bpjsQueueMap := make(map[uint]*models.BPJSQueue)
	for i := range bpjsQueues {
		if bpjsQueues[i].RoomQueueID != nil {
			bpjsQueueMap[*bpjsQueues[i].RoomQueueID] = &bpjsQueues[i]
		}
	}

	// Build response with MJKN info
	response := make([]RoomQueueResponse, len(queues))
	for i, q := range queues {
		response[i] = RoomQueueResponse{
			RoomQueue: q,
			IsMJKN:    false,
		}
		if bq, ok := bpjsQueueMap[q.ID]; ok {
			response[i].IsMJKN = true
			response[i].BPJSQueue = bq
		}
	}

	c.JSON(http.StatusOK, response)
}

// GetRoomQueue returns a single room queue by ID
func GetRoomQueue(c *gin.Context) {
	id := c.Param("id")
	var queue models.RoomQueue

	if err := database.DB.Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").Preload("CalledBy").Preload("Room").
		First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room queue not found"})
		return
	}

	c.JSON(http.StatusOK, queue)
}

// CreateRoomQueue creates a new room queue
func CreateRoomQueue(c *gin.Context) {
	var input struct {
		VisitID  uint   `json:"visit_id" binding:"required"`
		Priority string `json:"priority"`
		Notes    string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get visit to get room_id
	var visit models.Visit
	if err := database.DB.Preload("Room").First(&visit, input.VisitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	// Check if room queue already exists for this visit
	var existingQueue models.RoomQueue
	if err := database.DB.Where("visit_id = ?", input.VisitID).First(&existingQueue).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room queue already exists for this visit"})
		return
	}

	// Get room's queue code
	defaultCode := visit.Room.QueueCode
	if defaultCode == "" {
		defaultCode = "Q" // Default queue code
	}

	today := time.Now().Format("2006-01-02")
	todayDate, _ := ParseLocalDate(today)

	queueNumber := resolvePatientUnifiedQueueNumber(database.DB, visit.RegistrationID, &visit)
	if queueNumber == "" {
		var genErr error
		queueNumber, genErr = generateRoomQueueNumberByPrefix(database.DB, visit.RoomID, defaultCode, todayDate)
		if genErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate queue number"})
			return
		}
	}
	queueCode := resolveQueueCodePrefix(queueNumber, defaultCode)

	// Set default priority
	priority := input.Priority
	if priority == "" {
		priority = models.PriorityNormal
	}

	queue := models.RoomQueue{
		QueueNumber: queueNumber,
		QueueCode:   queueCode,
		QueueDate:   todayDate,
		VisitID:     input.VisitID,
		RoomID:      visit.RoomID,
		Priority:    priority,
		Status:      models.RoomQueueStatusWaiting,
		Notes:       input.Notes,
	}

	if err := database.DB.Create(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Load relationships
	database.DB.Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").First(&queue, queue.ID)

	c.JSON(http.StatusCreated, queue)
}

// CallNextRoomQueue calls the next waiting queue in a room
func CallNextRoomQueue(c *gin.Context) {
	roomID := c.Param("room_id")
	today := time.Now().Format("2006-01-02")

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Find next waiting queue with priority order:
	// 1. Emergency first
	// 2. Urgent
	// 3. Normal by arrival order
	var queue models.RoomQueue
	err := database.DB.Where("room_id = ? AND queue_date = ? AND status = ?",
		roomID, today, models.RoomQueueStatusWaiting).
		Order("CASE WHEN priority = 'emergency' THEN 1 WHEN priority = 'urgent' THEN 2 ELSE 3 END, created_at ASC, id ASC").
		First(&queue).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No waiting queue found"})
		return
	}

	// Update queue status
	now := time.Now().Truncate(time.Second)
	uid := userID.(uint)
	queue.Status = models.RoomQueueStatusCalled
	queue.CalledAt = &now
	queue.CalledByID = &uid

	if err := database.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trigger Task 4 ke BPJS jika pasien MJKN (async)
	go func() {
		bpjsService.UpdateBPJSQueueFromRoomQueueStatus(queue.ID, models.RoomQueueStatusCalled, &now)
	}()

	// Load relationships
	database.DB.Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").Preload("CalledBy").Preload("Room").
		First(&queue, queue.ID)

	c.JSON(http.StatusOK, queue)
}

// CallSpecificQueue calls a specific queue
func CallSpecificQueue(c *gin.Context) {
	id := c.Param("id")

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var queue models.RoomQueue
	if err := database.DB.First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room queue not found"})
		return
	}

	// Allow calling/recalling for waiting, called, or serving status
	// Skip completed, cancelled, or skipped queues
	if queue.Status == models.RoomQueueStatusCompleted ||
		queue.Status == models.RoomQueueStatusCancelled ||
		queue.Status == models.RoomQueueStatusSkipped {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot call completed, cancelled, or skipped queue"})
		return
	}

	// Update queue status to called
	now := time.Now().Truncate(time.Second)
	uid := userID.(uint)
	queue.Status = models.RoomQueueStatusCalled

	// Always update CalledAt to current time (for both initial call and recall)
	queue.CalledAt = &now
	queue.CalledByID = &uid

	if err := database.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trigger Task 4 ke BPJS jika pasien MJKN (async)
	go func() {
		bpjsService.UpdateBPJSQueueFromRoomQueueStatus(queue.ID, models.RoomQueueStatusCalled, &now)
	}()

	// Load relationships
	database.DB.Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").Preload("CalledBy").Preload("Room").
		First(&queue, queue.ID)

	c.JSON(http.StatusOK, queue)
}

// UpdateQueueStatus updates the status of a room queue
func UpdateQueueStatus(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		Status string `json:"status" binding:"required"`
		Notes  string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var queue models.RoomQueue
	if err := database.DB.Preload("Visit").Preload("Visit.Room").First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room queue not found"})
		return
	}

	// Validate status transition
	validStatuses := []string{
		models.RoomQueueStatusWaiting,
		models.RoomQueueStatusCalled,
		models.RoomQueueStatusServing,
		models.RoomQueueStatusCompleted,
		models.RoomQueueStatusSkipped,
		models.RoomQueueStatusCancelled,
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

	// For pharmacy rooms, validate pending orders before completing
	if input.Status == models.RoomQueueStatusCompleted && queue.Visit != nil && queue.Visit.Room != nil && queue.Visit.Room.ServiceType == "farmasi" {
		var pendingOrderCount int64
		database.DB.Model(&models.MedicineOrder{}).
			Where("pharmacy_visit_id = ? AND status NOT IN (?, ?)", queue.VisitID, models.OrderStatusDelivered, models.OrderStatusCancelled).
			Count(&pendingOrderCount)

		if pendingOrderCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":                "Tidak dapat menyelesaikan antrian. Masih ada resep yang belum diserahkan.",
				"pending_orders_count": pendingOrderCount,
			})
			return
		}
	}

	// Update status and timestamps
	now := time.Now()
	previousStatus := queue.Status
	queue.Status = input.Status
	if input.Notes != "" {
		queue.Notes = input.Notes
	}

	switch input.Status {
	case models.RoomQueueStatusServing:
		queue.ServedAt = &now
		// Also update visit status to in_progress
		if queue.VisitID != 0 {
			database.DB.Model(&models.Visit{}).
				Where("id = ?", queue.VisitID).
				Updates(map[string]interface{}{
					"status":     models.VisitStatusInProgress,
					"start_time": now,
				})
		}
	case models.RoomQueueStatusCompleted:
		if queue.ServedAt == nil {
			queue.ServedAt = &now
		}
		queue.CompletedAt = &now
		// Also update visit status to completed
		if queue.VisitID != 0 {
			database.DB.Model(&models.Visit{}).
				Where("id = ?", queue.VisitID).
				Updates(map[string]interface{}{
					"status":   models.VisitStatusCompleted,
					"end_time": now,
				})
		}
	}

	if err := database.DB.Save(&queue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trigger BPJS Task update jika status berubah (async)
	if input.Status != previousStatus {
		go func() {
			bpjsService.UpdateBPJSQueueFromRoomQueueStatus(queue.ID, input.Status, &now)
		}()
	}

	// Load relationships
	database.DB.Preload("Visit").Preload("Visit.Patient").Preload("Visit.Room").
		Preload("Visit.Doctor").Preload("Visit.Registration").Preload("CalledBy").
		First(&queue, queue.ID)

	c.JSON(http.StatusOK, queue)
}

// GetRoomQueueStats returns statistics for a room's queue
func GetRoomQueueStats(c *gin.Context) {
	roomID := c.Param("room_id")
	date := c.Query("date")

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var stats struct {
		TotalQueues     int64   `json:"total_queues"`
		WaitingQueues   int64   `json:"waiting_queues"`
		CalledQueues    int64   `json:"called_queues"`
		ServingQueues   int64   `json:"serving_queues"`
		CompletedQueues int64   `json:"completed_queues"`
		SkippedQueues   int64   `json:"skipped_queues"`
		CancelledQueues int64   `json:"cancelled_queues"`
		AverageWaitTime float64 `json:"average_wait_time_minutes"`
	}

	// Total queues
	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ?", roomID, date).
		Count(&stats.TotalQueues)

	// By status
	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusWaiting).
		Count(&stats.WaitingQueues)

	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusCalled).
		Count(&stats.CalledQueues)

	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusServing).
		Count(&stats.ServingQueues)

	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusCompleted).
		Count(&stats.CompletedQueues)

	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusSkipped).
		Count(&stats.SkippedQueues)

	database.DB.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date = ? AND status = ?", roomID, date, models.RoomQueueStatusCancelled).
		Count(&stats.CancelledQueues)

	// Average wait time (from created to served)
	var avgWait struct {
		AvgMinutes float64
	}
	database.DB.Raw(`
		SELECT AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) as avg_minutes
		FROM room_queues
		WHERE room_id = ? AND queue_date = ? AND served_at IS NOT NULL
	`, roomID, date).Scan(&avgWait)
	stats.AverageWaitTime = avgWait.AvgMinutes

	c.JSON(http.StatusOK, stats)
}

// GetCurrentRoomQueue returns the currently called/serving queue for a room
func GetCurrentRoomQueue(c *gin.Context) {
	roomID := c.Param("room_id")
	today := time.Now().Format("2006-01-02")

	var queue models.RoomQueue
	err := database.DB.Where("room_id = ? AND queue_date = ? AND status IN ?",
		roomID, today, []string{models.RoomQueueStatusCalled, models.RoomQueueStatusServing}).
		Order("called_at DESC").
		Preload("Visit").Preload("Visit.Registration").Preload("Visit.Registration.Patient").
		Preload("Visit.Room").Preload("Visit.Doctor").Preload("CalledBy").
		First(&queue).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active queue"})
		return
	}

	c.JSON(http.StatusOK, queue)
}

// resolvePatientUnifiedQueueNumber returns an existing queue number for the registration
// or source visit so a single ticket number can flow from registration -> poli -> lab/radiology/pharmacy.
func resolvePatientUnifiedQueueNumber(db *gorm.DB, registrationID uint, sourceVisit *models.Visit) string {
	if registrationID == 0 && sourceVisit != nil {
		registrationID = sourceVisit.RegistrationID
	}

	// 1. Prefer the registration counter ticket (kiosk Queue) when present.
	if registrationID > 0 {
		var reg models.Registration
		if err := db.Preload("Queue").Select("id", "queue_id").First(&reg, registrationID).Error; err == nil {
			if reg.Queue != nil && reg.Queue.QueueNumber != "" {
				return reg.Queue.QueueNumber
			}
		}
	}

	// 2. Next prefer the source visit's own room queue number (e.g., MJKN or walk-in poli queue).
	if sourceVisit != nil {
		if sourceVisit.RoomQueue != nil && sourceVisit.RoomQueue.QueueNumber != "" {
			return sourceVisit.RoomQueue.QueueNumber
		}
		if sourceVisit.ID > 0 {
			var srcQueue models.RoomQueue
			if err := db.Where("visit_id = ?", sourceVisit.ID).First(&srcQueue).Error; err == nil && srcQueue.QueueNumber != "" {
				return srcQueue.QueueNumber
			}
		}
	}

	// 3. Fallback to any active room queue under the same registration (ordered earliest first).
	if registrationID > 0 {
		var existingQueue models.RoomQueue
		err := db.Joins("JOIN visits ON visits.id = room_queues.visit_id").
			Where("visits.registration_id = ? AND room_queues.status != ?", registrationID, models.RoomQueueStatusCancelled).
			Order("room_queues.created_at ASC, room_queues.id ASC").
			First(&existingQueue).Error
		if err == nil && existingQueue.QueueNumber != "" {
			return existingQueue.QueueNumber
		}
	}

	return ""
}

// resolveQueueCodePrefix extracts the leading alphabetic prefix from a queue number (e.g., "B001" -> "B").
func resolveQueueCodePrefix(queueNumber string, defaultCode string) string {
	trimmed := strings.TrimSpace(queueNumber)
	var prefix strings.Builder
	for i := 0; i < len(trimmed); i++ {
		ch := trimmed[i]
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') {
			prefix.WriteByte(ch)
		} else {
			break
		}
	}
	if prefix.Len() > 0 {
		return strings.ToUpper(prefix.String())
	}
	if defaultCode != "" {
		return defaultCode
	}
	return "Q"
}

// generateRoomQueueNumberByPrefix generates the next <queueCode>%03d number for a room on a date,
// filtering strictly by the room's own prefix so inherited loket numbers (A/B/E) do not skew parsing.
func generateRoomQueueNumberByPrefix(db *gorm.DB, roomID uint, queueCode string, queueDate time.Time) (string, error) {
	if queueCode == "" {
		queueCode = "Q"
	}

	dateOnly := time.Date(queueDate.Year(), queueDate.Month(), queueDate.Day(), 0, 0, 0, 0, queueDate.Location())
	nextDate := dateOnly.AddDate(0, 0, 1)

	var lastQueue models.RoomQueue
	queueNum := 1
	err := db.Where("room_id = ? AND queue_date >= ? AND queue_date < ? AND queue_number LIKE ?", roomID, dateOnly, nextDate, queueCode+"%").
		Order("queue_number DESC").First(&lastQueue).Error
	if err == nil {
		var lastNum int
		if n, _ := fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum); n == 1 && lastNum > 0 {
			queueNum = lastNum + 1
		}
	}

	return fmt.Sprintf("%s%03d", queueCode, queueNum), nil
}

// computeDailyRoomAngkaAntrean returns a collision-free 1-based sequential number per room & date
// for BPJS Antrol AngkaAntrean/EstimasiDilayani, independent of inherited string prefixes.
func computeDailyRoomAngkaAntrean(db *gorm.DB, roomID uint, queueDate time.Time, roomQueueID uint) int {
	dateOnly := time.Date(queueDate.Year(), queueDate.Month(), queueDate.Day(), 0, 0, 0, 0, queueDate.Location())
	nextDate := dateOnly.AddDate(0, 0, 1)

	var count int64
	query := db.Model(&models.RoomQueue{}).
		Where("room_id = ? AND queue_date >= ? AND queue_date < ? AND status != ?",
			roomID, dateOnly, nextDate, models.RoomQueueStatusCancelled)

	if roomQueueID > 0 {
		query = query.Where("id <= ?", roomQueueID)
	}
	query.Count(&count)

	if roomQueueID == 0 {
		return int(count) + 1
	}
	if count < 1 {
		return 1
	}
	return int(count)
}
