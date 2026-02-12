package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"starter/backend/database"
	"starter/backend/models"
)

// GetQueues godoc
// @Summary Get all queues for today
// @Description Get list of queues with optional filters
// @Tags Queue
// @Accept json
// @Produce json
// @Param date query string false "Filter by date (YYYY-MM-DD)"
// @Param status query string false "Filter by status"
// @Param queue_type query string false "Filter by queue type"
// @Param destination_room_id query int false "Filter by destination room"
// @Success 200 {object} map[string]interface{}
// @Router /queues [get]
func GetQueues(c *gin.Context) {
	var queues []models.Queue
	query := database.DB.Preload("CalledBy").Preload("Counter")

	// Default to today if no date specified
	dateStr := c.Query("date")
	var queueDate time.Time
	if dateStr != "" {
		parsed, err := ParseLocalDate(dateStr)
		if err == nil {
			queueDate = parsed
		} else {
			queueDate = time.Now()
		}
	} else {
		queueDate = time.Now()
	}

	startOfDay := time.Date(queueDate.Year(), queueDate.Month(), queueDate.Day(), 0, 0, 0, 0, queueDate.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)
	query = query.Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if queueType := c.Query("queue_type"); queueType != "" {
		query = query.Where("queue_type = ?", queueType)
	}
	if counter := c.Query("counter_id"); counter != "" {
		query = query.Where("counter_id = ?", counter)
	}

	// Sort by created_at DESC (newest first)
	query.Order("created_at ASC").Find(&queues)

	// Get summary counts
	var waiting, called, serving, completed, skipped int64
	database.DB.Model(&models.Queue{}).
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status = ?", "waiting").Count(&waiting)
	database.DB.Model(&models.Queue{}).
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status = ?", "called").Count(&called)
	database.DB.Model(&models.Queue{}).
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status = ?", "serving").Count(&serving)
	database.DB.Model(&models.Queue{}).
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status = ?", "completed").Count(&completed)
	database.DB.Model(&models.Queue{}).
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status = ?", "skipped").Count(&skipped)

	c.JSON(http.StatusOK, gin.H{
		"data": queues,
		"summary": gin.H{
			"waiting":   waiting,
			"called":    called,
			"serving":   serving,
			"completed": completed,
			"skipped":   skipped,
			"total":     waiting + called + serving + completed + skipped,
		},
	})
}

// GetQueue godoc
// @Summary Get a queue by ID
// @Description Get queue details by ID
// @Tags Queue
// @Accept json
// @Produce json
// @Param id path int true "Queue ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/{id} [get]
func GetQueue(c *gin.Context) {
	id := c.Param("id")
	var queue models.Queue

	if err := database.DB.Preload("CalledBy").
		First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": queue})
}

// CreateQueueInput represents input for creating a queue (from kiosk)
type CreateQueueInput struct {
	QueueType string `json:"queue_type" binding:"required,oneof=general bpjs emergency"` // general, bpjs, emergency
	CounterID uint   `json:"counter_id" binding:"required,min=1"`                        // Counter ID
	Notes     string `json:"notes"`                                                      // Optional notes
}

// CreateQueue godoc
// @Summary Take a queue number (Kiosk)
// @Description Create a new queue entry from kiosk - only select queue type and counter
// @Tags Queue
// @Accept json
// @Produce json
// @Param input body CreateQueueInput true "Queue data"
// @Success 201 {object} map[string]interface{}
// @Router /queues [post]
func CreateQueue(c *gin.Context) {
	var input CreateQueueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate counter exists and is active
	var counter models.Counter
	if err := database.DB.Where("id = ? AND is_active = ?", input.CounterID, true).First(&counter).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Loket tidak tersedia atau tidak aktif"})
		return
	}

	today := time.Now()
	queueDate := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())

	// Generate queue number within transaction to avoid race condition
	tx := database.DB.Begin()

	queueNumber := generateQueueNumberTx(tx, input.QueueType, queueDate)

	queue := models.Queue{
		QueueNumber: queueNumber,
		QueueDate:   queueDate,
		QueueType:   input.QueueType,
		CounterID:   input.CounterID,
		Status:      "waiting",
		Notes:       input.Notes,
	}

	if err := tx.Create(&queue).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil nomor antrean"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal commit transaksi"})
		return
	}

	// Reload with associations
	database.DB.Preload("CalledBy").Preload("Counter").First(&queue, queue.ID)

	c.JSON(http.StatusCreated, gin.H{"data": queue})
}

// generateQueueNumberTx generates the next queue number within a transaction (race-safe)
func generateQueueNumberTx(tx *gorm.DB, queueType string, queueDate time.Time) string {
	prefix := "A" // general
	switch queueType {
	case "bpjs":
		prefix = "B"
	case "emergency":
		prefix = "E"
	}

	var counter models.QueueCounter
	// Use Set("gorm:query_option", "FOR UPDATE") for row-level lock
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("queue_date = ? AND queue_type = ?", queueDate, queueType).First(&counter).Error

	if err == gorm.ErrRecordNotFound {
		// Create new counter
		counter = models.QueueCounter{
			QueueDate:  queueDate,
			QueueType:  queueType,
			LastNumber: 1,
		}
		tx.Create(&counter)
	} else {
		// Increment counter
		counter.LastNumber++
		tx.Save(&counter)
	}

	return fmt.Sprintf("%s%03d", prefix, counter.LastNumber)
}

// CallNextQueue godoc
// @Summary Call next queue
// @Description Call the next waiting queue for specific counter
// @Tags Queue
// @Accept json
// @Produce json
// @Param counter_id query int true "Counter ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/call-next [post]
func CallNextQueue(c *gin.Context) {
	userID, _ := c.Get("userID")
	counterID, err := strconv.Atoi(c.DefaultQuery("counter_id", "0"))
	if err != nil || counterID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Counter ID tidak valid"})
		return
	}

	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := database.DB.Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("counter_id = ?", counterID).
		Where("status = ?", "waiting")

	var queue models.Queue
	if err := query.Order("queue_number ASC").First(&queue).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tidak ada antrean yang menunggu untuk loket ini"})
		return
	}

	now := time.Now()
	userIDUint := userID.(uint)

	queue.Status = "called"
	queue.CalledAt = &now
	queue.CalledByID = &userIDUint

	database.DB.Save(&queue)

	// Reload with associations
	database.DB.Preload("CalledBy").Preload("Counter").First(&queue, queue.ID)

	c.JSON(http.StatusOK, gin.H{"data": queue})
}

// CallQueue godoc
// @Summary Call a specific queue
// @Description Call a specific queue by ID
// @Tags Queue
// @Accept json
// @Produce json
// @Param id path int true "Queue ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/{id}/call [post]
func CallQueue(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var queue models.Queue
	if err := database.DB.First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Antrean tidak ditemukan"})
		return
	}

	// Allow calling for: waiting, skipped, called (recall), serving (recall)
	if queue.Status != "waiting" && queue.Status != "skipped" && queue.Status != "called" && queue.Status != "serving" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Antrean tidak dapat dipanggil (status: " + queue.Status + ")"})
		return
	}

	now := time.Now()
	userIDUint := userID.(uint)

	// Set status to called and update timestamps
	queue.Status = "called"
	queue.CalledAt = &now
	queue.CalledByID = &userIDUint

	database.DB.Save(&queue)

	// Reload with associations
	database.DB.Preload("CalledBy").Preload("Counter").First(&queue, queue.ID)

	c.JSON(http.StatusOK, gin.H{"data": queue})
}

// SkipQueue godoc
// @Summary Skip a queue
// @Description Mark a queue as skipped (patient didn't show up)
// @Tags Queue
// @Accept json
// @Produce json
// @Param id path int true "Queue ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/{id}/skip [post]
func SkipQueue(c *gin.Context) {
	id := c.Param("id")

	var queue models.Queue
	if err := database.DB.First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Antrean tidak ditemukan"})
		return
	}

	if queue.Status != "called" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hanya antrean yang sudah dipanggil yang bisa di-skip"})
		return
	}

	queue.Status = "skipped"
	database.DB.Save(&queue)

	// Reload with associations
	database.DB.Preload("CalledBy").First(&queue, queue.ID)

	c.JSON(http.StatusOK, gin.H{"data": queue})
}

// CancelQueue godoc
// @Summary Cancel a queue
// @Description Cancel a queue
// @Tags Queue
// @Accept json
// @Produce json
// @Param id path int true "Queue ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/{id}/cancel [post]
func CancelQueue(c *gin.Context) {
	id := c.Param("id")

	var queue models.Queue
	if err := database.DB.First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Antrean tidak ditemukan"})
		return
	}

	if queue.Status == "serving" || queue.Status == "completed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Antrean yang sudah diproses tidak bisa dibatalkan"})
		return
	}

	queue.Status = "cancelled"
	database.DB.Save(&queue)

	c.JSON(http.StatusOK, gin.H{"data": queue})
}

// GetCurrentQueue godoc
// @Summary Get current called queue
// @Description Get the currently called queue (for display)
// @Tags Queue
// GetCurrentQueue godoc
// @Summary Get currently called queues
// @Description Get list of currently called queues for display (public endpoint)
// @Tags Queue
// @Accept json
// @Produce json
// @Param counter query int false "Filter by counter/loket"
// @Success 200 {object} map[string]interface{}
// @Router /queues/current [get]
func GetCurrentQueue(c *gin.Context) {
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := database.DB.Preload("CalledBy").
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay).
		Where("status IN ?", []string{"called", "serving"})

	if counter := c.Query("counter"); counter != "" {
		query = query.Where("counter = ?", counter)
	}

	var queues []models.Queue
	query.Order("called_at DESC").Limit(10).Find(&queues)

	c.JSON(http.StatusOK, gin.H{"data": queues})
}

// GetQueueStats godoc
// @Summary Get queue statistics
// @Description Get queue statistics for today by counter
// @Tags Queue
// @Accept json
// @Produce json
// @Param counter_id query int false "Filter by counter ID"
// @Success 200 {object} map[string]interface{}
// @Router /queues/stats [get]
func GetQueueStats(c *gin.Context) {
	today := time.Now()
	startOfDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var waiting, called, serving, completed, skipped, cancelled int64
	var tempQuery *gorm.DB

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "waiting").Count(&waiting)

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "called").Count(&called)

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "serving").Count(&serving)

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "completed").Count(&completed)

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "skipped").Count(&skipped)

	tempQuery = database.DB.Model(&models.Queue{}).Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		tempQuery = tempQuery.Where("counter_id = ?", counterID)
	}
	tempQuery.Where("status = ?", "cancelled").Count(&cancelled)

	// Get stats per queue type
	type TypeStat struct {
		QueueType string `json:"queue_type"`
		Count     int64  `json:"count"`
	}
	var typeStats []TypeStat
	typeQuery := database.DB.Model(&models.Queue{}).
		Select("queue_type, count(*) as count").
		Where("queue_date >= ? AND queue_date < ?", startOfDay, endOfDay)
	if counterID := c.Query("counter_id"); counterID != "" {
		typeQuery = typeQuery.Where("counter_id = ?", counterID)
	}
	typeQuery.Group("queue_type").Scan(&typeStats)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"waiting":   waiting,
			"called":    called,
			"serving":   serving,
			"completed": completed,
			"skipped":   skipped,
			"cancelled": cancelled,
			"total":     waiting + called + serving + completed + skipped + cancelled,
			"by_type":   typeStats,
		},
	})
}
