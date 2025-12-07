package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"starter/backend/database"
	"starter/backend/models"

	"github.com/gin-gonic/gin"
)

// ==================== Stock Request Handlers ====================

type CreateStockRequestInput struct {
	RequestType  string                        `json:"request_type" binding:"required,oneof=inventory medicine"`
	FromRoomID   uint                          `json:"from_room_id" binding:"required"`
	ToRoomID     uint                          `json:"to_room_id" binding:"required"`
	Priority     string                        `json:"priority"`
	RequiredDate string                        `json:"required_date"`
	Reason       string                        `json:"reason"`
	Notes        string                        `json:"notes"`
	Items        []CreateStockRequestItemInput `json:"items" binding:"required,min=1"`
}

type CreateStockRequestItemInput struct {
	InventoryID       *uint  `json:"inventory_id"`
	MedicineID        *uint  `json:"medicine_id"`
	QuantityRequested int    `json:"quantity_requested" binding:"required,min=1"`
	Unit              string `json:"unit"`
	Notes             string `json:"notes"`
}

type UpdateStockRequestInput struct {
	Priority     string `json:"priority"`
	RequiredDate string `json:"required_date"`
	Reason       string `json:"reason"`
	Notes        string `json:"notes"`
}

type ApproveStockRequestInput struct {
	Items []ApproveStockRequestItemInput `json:"items"`
	Notes string                         `json:"notes"`
}

type ApproveStockRequestItemInput struct {
	ID               uint `json:"id" binding:"required"`
	QuantityApproved int  `json:"quantity_approved" binding:"required,min=0"`
}

type RejectStockRequestInput struct {
	RejectionReason string `json:"rejection_reason" binding:"required"`
}

// GetStockRequests godoc
// @Summary Get all stock requests
// @Description Get all stock requests with pagination and filters
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param request_type query string false "Filter by request type (inventory, medicine)"
// @Param status query string false "Filter by status"
// @Param from_room_id query int false "Filter by from room"
// @Param to_room_id query int false "Filter by to room"
// @Param my_requests query bool false "Filter only my requests"
// @Param pending_approval query bool false "Filter requests pending approval"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests [get]
func GetStockRequests(c *gin.Context) {
	var requests []models.StockRequest
	query := database.DB.Preload("FromRoom").Preload("ToRoom").Preload("RequestedBy").Preload("ApprovedBy").
		Preload("Items.Inventory").Preload("Items.Medicine")

	// Get current user ID
	userID, _ := c.Get("userID")

	// Filters
	if requestType := c.Query("request_type"); requestType != "" {
		query = query.Where("request_type = ?", requestType)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if fromRoomID := c.Query("from_room_id"); fromRoomID != "" {
		query = query.Where("from_room_id = ?", fromRoomID)
	}
	if toRoomID := c.Query("to_room_id"); toRoomID != "" {
		query = query.Where("to_room_id = ?", toRoomID)
	}

	// Filter: My Requests - only show requests created by current user
	if myRequests := c.Query("my_requests"); myRequests == "true" {
		query = query.Where("requested_by_id = ?", userID)
	}

	// Filter: Pending Approval - show only pending requests
	if pendingApproval := c.Query("pending_approval"); pendingApproval == "true" {
		query = query.Where("status = ?", models.RequestStatusPending)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	var total int64
	query.Model(&models.StockRequest{}).Count(&total)

	query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&requests)

	c.JSON(http.StatusOK, gin.H{
		"data": requests,
		"meta": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"total_page": (total + int64(limit) - 1) / int64(limit),
		},
	})
}

// GetStockRequest godoc
// @Summary Get a stock request by ID
// @Description Get stock request details by ID
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id} [get]
func GetStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.Preload("FromRoom").Preload("ToRoom").
		Preload("RequestedBy").Preload("ApprovedBy").Preload("CompletedBy").
		Preload("Items.Inventory").Preload("Items.Medicine").
		First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": request})
}

// CreateStockRequest godoc
// @Summary Create a new stock request
// @Description Create a new stock request
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param input body CreateStockRequestInput true "Stock Request data"
// @Success 201 {object} map[string]interface{}
// @Router /stock-requests [post]
func CreateStockRequest(c *gin.Context) {
	var input CreateStockRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("CreateStockRequest bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("CreateStockRequest input: %+v", input)

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Validate rooms exist
	var fromRoom, toRoom models.Room
	if err := database.DB.First(&fromRoom, input.FromRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "From room not found"})
		return
	}
	if err := database.DB.First(&toRoom, input.ToRoomID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "To room not found"})
		return
	}

	// Generate request number
	requestNumber := generateRequestNumber(input.RequestType)

	priority := input.Priority
	if priority == "" {
		priority = "normal"
	}

	// Parse required_date
	var requiredDate *time.Time
	if input.RequiredDate != "" {
		parsedDate, err := time.Parse("2006-01-02", input.RequiredDate)
		if err != nil {
			// Try other formats
			parsedDate, err = time.Parse(time.RFC3339, input.RequiredDate)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid required_date format"})
				return
			}
		}
		requiredDate = &parsedDate
	}

	request := models.StockRequest{
		RequestNumber: requestNumber,
		RequestType:   input.RequestType,
		FromRoomID:    input.FromRoomID,
		ToRoomID:      input.ToRoomID,
		Status:        models.RequestStatusDraft,
		Priority:      priority,
		RequestDate:   time.Now(),
		RequiredDate:  requiredDate,
		RequestedByID: userID.(uint),
		Reason:        input.Reason,
		Notes:         input.Notes,
	}

	// Start transaction
	tx := database.DB.Begin()

	if err := tx.Create(&request).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stock request"})
		return
	}

	// Create items
	for _, item := range input.Items {
		requestItem := models.StockRequestItem{
			StockRequestID:    request.ID,
			InventoryID:       item.InventoryID,
			MedicineID:        item.MedicineID,
			QuantityRequested: item.QuantityRequested,
			Unit:              item.Unit,
			Notes:             item.Notes,
		}
		if err := tx.Create(&requestItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stock request item"})
			return
		}
	}

	tx.Commit()

	// Reload with associations
	database.DB.Preload("FromRoom").Preload("ToRoom").Preload("RequestedBy").Preload("Items").First(&request, request.ID)

	c.JSON(http.StatusCreated, gin.H{"data": request, "message": "Stock request created successfully"})
}

// UpdateStockRequest godoc
// @Summary Update a stock request
// @Description Update stock request (only if status is pending)
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Param input body UpdateStockRequestInput true "Stock Request data"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id} [put]
func UpdateStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusDraft && request.Status != models.RequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only update draft or pending requests"})
		return
	}

	var input UpdateStockRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Priority != "" {
		updates["priority"] = input.Priority
	}
	if input.RequiredDate != "" {
		parsedDate, err := time.Parse("2006-01-02", input.RequiredDate)
		if err != nil {
			parsedDate, _ = time.Parse(time.RFC3339, input.RequiredDate)
		}
		updates["required_date"] = parsedDate
	}
	if input.Reason != "" {
		updates["reason"] = input.Reason
	}
	if input.Notes != "" {
		updates["notes"] = input.Notes
	}

	database.DB.Model(&request).Updates(updates)

	c.JSON(http.StatusOK, gin.H{"data": request, "message": "Stock request updated successfully"})
}

// SubmitStockRequest godoc
// @Summary Submit a stock request for approval
// @Description Submit a draft stock request for approval (draft → pending)
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id}/submit [post]
func SubmitStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusDraft {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only submit draft requests"})
		return
	}

	request.Status = models.RequestStatusPending
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"data": request, "message": "Stock request submitted for approval"})
}

// ApproveStockRequest godoc
// @Summary Approve a stock request
// @Description Approve a pending stock request
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Param input body ApproveStockRequestInput true "Approval data"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id}/approve [post]
func ApproveStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.Preload("Items").First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only approve pending requests"})
		return
	}

	var input ApproveStockRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	now := time.Now()

	tx := database.DB.Begin()

	// Update approved quantities
	allApproved := true
	anyApproved := false
	for _, approveItem := range input.Items {
		for i := range request.Items {
			if request.Items[i].ID == approveItem.ID {
				request.Items[i].QuantityApproved = approveItem.QuantityApproved
				tx.Save(&request.Items[i])
				if approveItem.QuantityApproved > 0 {
					anyApproved = true
				}
				if approveItem.QuantityApproved < request.Items[i].QuantityRequested {
					allApproved = false
				}
				break
			}
		}
	}

	// Determine status
	status := models.RequestStatusApproved
	if !anyApproved {
		status = models.RequestStatusRejected
	} else if !allApproved {
		status = models.RequestStatusPartial
	}

	approvedByID := userID.(uint)
	request.Status = status
	request.ApprovedByID = &approvedByID
	request.ApprovedDate = &now
	if input.Notes != "" {
		request.Notes = request.Notes + "\n[Approval Notes]: " + input.Notes
	}

	tx.Save(&request)
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"data": request, "message": "Stock request approved successfully"})
}

// RejectStockRequest godoc
// @Summary Reject a stock request
// @Description Reject a pending stock request
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Param input body RejectStockRequestInput true "Rejection data"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id}/reject [post]
func RejectStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only reject pending requests"})
		return
	}

	var input RejectStockRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	now := time.Now()
	approvedByID := userID.(uint)

	request.Status = models.RequestStatusRejected
	request.ApprovedByID = &approvedByID
	request.ApprovedDate = &now
	request.RejectionReason = input.RejectionReason

	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"data": request, "message": "Stock request rejected"})
}

// CancelStockRequest godoc
// @Summary Cancel a stock request
// @Description Cancel a pending stock request (by requester)
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id}/cancel [post]
func CancelStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only cancel pending requests"})
		return
	}

	request.Status = models.RequestStatusCancelled
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"data": request, "message": "Stock request cancelled"})
}

// DeleteStockRequest godoc
// @Summary Delete a stock request
// @Description Delete a stock request (only if status is pending or cancelled)
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param id path int true "Stock Request ID"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/{id} [delete]
func DeleteStockRequest(c *gin.Context) {
	id := c.Param("id")
	var request models.StockRequest

	if err := database.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stock request not found"})
		return
	}

	if request.Status != models.RequestStatusPending && request.Status != models.RequestStatusCancelled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only delete pending or cancelled requests"})
		return
	}

	// Delete items first
	database.DB.Where("stock_request_id = ?", request.ID).Delete(&models.StockRequestItem{})
	database.DB.Delete(&request)

	c.JSON(http.StatusOK, gin.H{"message": "Stock request deleted successfully"})
}

// Helper function to generate request number
func generateRequestNumber(requestType string) string {
	prefix := "REQ"
	if requestType == models.RequestTypeInventory {
		prefix = "REQ-INV"
	} else if requestType == models.RequestTypeMedicine {
		prefix = "REQ-MED"
	}

	year := time.Now().Year()
	var count int64
	database.DB.Model(&models.StockRequest{}).
		Where("request_type = ? AND EXTRACT(YEAR FROM created_at) = ?", requestType, year).
		Count(&count)

	return fmt.Sprintf("%s-%d-%04d", prefix, year, count+1)
}

// ==================== My Requests (for current user's room) ====================

// GetMyStockRequests godoc
// @Summary Get stock requests for current user's room
// @Description Get stock requests where the current user's room is the requester
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/my-requests [get]
func GetMyStockRequests(c *gin.Context) {
	// This would need user-room association logic
	// For now, return all requests the user created
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var requests []models.StockRequest
	database.DB.Preload("FromRoom").Preload("ToRoom").Preload("Items").
		Where("requested_by_id = ?", userID).
		Order("created_at DESC").
		Find(&requests)

	c.JSON(http.StatusOK, gin.H{"data": requests})
}

// GetPendingApprovals godoc
// @Summary Get pending stock requests for approval
// @Description Get stock requests pending approval (for depo/pharmacy rooms)
// @Tags Stock Requests
// @Accept json
// @Produce json
// @Param to_room_id query int false "Filter by destination room (depo)"
// @Success 200 {object} map[string]interface{}
// @Router /stock-requests/pending-approvals [get]
func GetPendingApprovals(c *gin.Context) {
	var requests []models.StockRequest
	query := database.DB.Preload("FromRoom").Preload("ToRoom").Preload("RequestedBy").Preload("Items.Inventory").Preload("Items.Medicine").
		Where("status = ?", models.RequestStatusPending)

	if toRoomID := c.Query("to_room_id"); toRoomID != "" {
		query = query.Where("to_room_id = ?", toRoomID)
	}

	query.Order("priority DESC, created_at ASC").Find(&requests)

	c.JSON(http.StatusOK, gin.H{"data": requests})
}
