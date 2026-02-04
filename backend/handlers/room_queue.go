package handlers

import (
	"fmt"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	bpjsService "starter/backend/services/bpjs"
	"time"

	"github.com/gin-gonic/gin"
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

	// Order by queue_number
	query = query.Order("queue_number ASC")

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
	queueCode := visit.Room.QueueCode
	if queueCode == "" {
		queueCode = "Q" // Default queue code
	}

	// Get last queue number for this room today
	today := time.Now().Format("2006-01-02")
	todayDate, _ := time.Parse("2006-01-02", today)
	var lastQueue models.RoomQueue
	var queueNum int

	err := database.DB.Where("room_id = ? AND queue_date = ?", visit.RoomID, todayDate).
		Order("queue_number DESC").First(&lastQueue).Error

	if err != nil {
		// No queue yet today, start from 1
		queueNum = 1
	} else {
		// Parse last queue number and increment
		var lastNum int
		fmt.Sscanf(lastQueue.QueueNumber, queueCode+"%d", &lastNum)
		queueNum = lastNum + 1
	}

	// Format queue number (e.g., A001, L005)
	queueNumber := fmt.Sprintf("%s%03d", queueCode, queueNum)

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
	// 3. Normal by queue number
	var queue models.RoomQueue
	err := database.DB.Where("room_id = ? AND queue_date = ? AND status = ?",
		roomID, today, models.RoomQueueStatusWaiting).
		Order("CASE WHEN priority = 'emergency' THEN 1 WHEN priority = 'urgent' THEN 2 ELSE 3 END, queue_number ASC").
		First(&queue).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No waiting queue found"})
		return
	}

	// Update queue status
	now := time.Now()
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
	now := time.Now()
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
