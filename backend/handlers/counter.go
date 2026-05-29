package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"starter/backend/database"
	"starter/backend/models"
)

// GetCounters godoc
// @Summary Get all counters
// @Description Get list of counters with optional filters
// @Tags Counter
// @Accept json
// @Produce json
// @Param is_active query bool false "Filter by active status"
// @Success 200 {object} map[string]interface{}
// @Router /counters [get]
func GetCounters(c *gin.Context) {
	var counters []models.Counter
	query := database.DB

	// Filter by active status
	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		if isActive, err := strconv.ParseBool(isActiveStr); err == nil {
			query = query.Where("is_active = ?", isActive)
		}
	}

	query.Order("display_order ASC, name ASC").Find(&counters)

	c.JSON(http.StatusOK, gin.H{"data": counters})
}

// GetCounter godoc
// @Summary Get a counter by ID
// @Description Get counter details by ID
// @Tags Counter
// @Accept json
// @Produce json
// @Param id path int true "Counter ID"
// @Success 200 {object} map[string]interface{}
// @Router /counters/{id} [get]
func GetCounter(c *gin.Context) {
	id := c.Param("id")
	var counter models.Counter

	if err := database.DB.First(&counter, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Counter not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": counter})
}

// CreateCounterInput represents input for creating a counter
type CreateCounterInput struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	IsActive     *bool  `json:"is_active"`
	DisplayOrder *int   `json:"display_order"`
	Location     string `json:"location"`
}

// CreateCounter godoc
// @Summary Create a new counter
// @Description Create a new registration counter
// @Tags Counter
// @Accept json
// @Produce json
// @Param input body CreateCounterInput true "Counter data"
// @Success 201 {object} map[string]interface{}
// @Router /counters [post]
func CreateCounter(c *gin.Context) {
	var input CreateCounterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code, err := generateDateCode(&models.Counter{}, "CNT")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kode loket otomatis"})
		return
	}

	counter := models.Counter{
		Name:        input.Name,
		Code:        code,
		Description: input.Description,
		Location:    input.Location,
	}

	if input.IsActive != nil {
		counter.IsActive = *input.IsActive
	} else {
		counter.IsActive = true
	}

	if input.DisplayOrder != nil {
		counter.DisplayOrder = *input.DisplayOrder
	}

	if err := database.DB.Create(&counter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat loket"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": counter})
}

// UpdateCounterInput represents input for updating a counter
type UpdateCounterInput struct {
	Name         *string `json:"name"`
	Description  *string `json:"description"`
	IsActive     *bool   `json:"is_active"`
	DisplayOrder *int    `json:"display_order"`
	Location     *string `json:"location"`
}

// UpdateCounter godoc
// @Summary Update a counter
// @Description Update counter details
// @Tags Counter
// @Accept json
// @Produce json
// @Param id path int true "Counter ID"
// @Param input body UpdateCounterInput true "Update data"
// @Success 200 {object} map[string]interface{}
// @Router /counters/{id} [put]
func UpdateCounter(c *gin.Context) {
	id := c.Param("id")
	var counter models.Counter

	if err := database.DB.First(&counter, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Counter not found"})
		return
	}

	var input UpdateCounterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})

	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}
	if input.DisplayOrder != nil {
		updates["display_order"] = *input.DisplayOrder
	}
	if input.Location != nil {
		updates["location"] = *input.Location
	}

	database.DB.Model(&counter).Updates(updates)

	c.JSON(http.StatusOK, gin.H{"data": counter})
}

// DeleteCounter godoc
// @Summary Delete a counter
// @Description Delete a counter
// @Tags Counter
// @Accept json
// @Produce json
// @Param id path int true "Counter ID"
// @Success 200 {object} map[string]interface{}
// @Router /counters/{id} [delete]
func DeleteCounter(c *gin.Context) {
	id := c.Param("id")
	var counter models.Counter

	if err := database.DB.First(&counter, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Counter not found"})
		return
	}

	// Check if counter is being used in queues
	var queueCount int64
	database.DB.Model(&models.Queue{}).Where("counter = ?", counter.ID).Count(&queueCount)
	if queueCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Loket masih digunakan dalam antrean, tidak dapat dihapus"})
		return
	}

	database.DB.Delete(&counter)

	c.JSON(http.StatusOK, gin.H{"message": "Counter deleted successfully"})
}

// GetActiveCounters godoc
// @Summary Get active counters
// @Description Get list of active counters only
// @Tags Counter
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /counters/active [get]
func GetActiveCounters(c *gin.Context) {
	var counters []models.Counter
	database.DB.Where("is_active = ?", true).Order("display_order ASC, name ASC").Find(&counters)

	c.JSON(http.StatusOK, gin.H{"data": counters})
}

// GetOpenCounters godoc
// @Summary Get open counters
// @Description Get list of counters that are both active and open for service
// @Tags Counter
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /counters/open [get]
func GetOpenCounters(c *gin.Context) {
	var counters []models.Counter
	database.DB.Where("is_active = ? AND is_open = ?", true, true).Order("display_order ASC, name ASC").Find(&counters)

	c.JSON(http.StatusOK, gin.H{"data": counters})
}

// ToggleCounterOpen godoc
// @Summary Toggle counter open/close status
// @Description Toggle whether a counter is open or closed for daily operation
// @Tags Counter
// @Accept json
// @Produce json
// @Param id path int true "Counter ID"
// @Success 200 {object} map[string]interface{}
// @Router /counters/{id}/toggle-open [post]
func ToggleCounterOpen(c *gin.Context) {
	id := c.Param("id")
	var counter models.Counter

	if err := database.DB.First(&counter, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loket tidak ditemukan"})
		return
	}

	counter.IsOpen = !counter.IsOpen
	database.DB.Model(&counter).Update("is_open", counter.IsOpen)

	status := "ditutup"
	if counter.IsOpen {
		status = "dibuka"
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    counter,
		"message": "Loket " + counter.Name + " berhasil " + status,
	})
}

// BulkToggleCounterOpen godoc
// @Summary Open or close multiple counters at once
// @Description Set open status for multiple counters
// @Tags Counter
// @Accept json
// @Produce json
// @Param input body object true "Counter IDs and open status"
// @Success 200 {object} map[string]interface{}
// @Router /counters/bulk-toggle-open [post]
func BulkToggleCounterOpen(c *gin.Context) {
	var input struct {
		CounterIDs []uint `json:"counter_ids" binding:"required"`
		IsOpen     bool   `json:"is_open"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.Counter{}).Where("id IN ?", input.CounterIDs).Update("is_open", input.IsOpen)

	status := "ditutup"
	if input.IsOpen {
		status = "dibuka"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": strconv.Itoa(len(input.CounterIDs)) + " loket berhasil " + status,
	})
}
