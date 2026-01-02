package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetNotifications returns notifications for the current user
func GetNotifications(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var notifications []models.Notification
	query := database.DB.Where("user_id = ?", userID).Order("created_at DESC")

	// Filter by read status if provided
	if isRead := c.Query("is_read"); isRead != "" {
		if isRead == "true" {
			query = query.Where("is_read = ?", true)
		} else if isRead == "false" {
			query = query.Where("is_read = ?", false)
		}
	}

	// Limit results
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	if err := query.Limit(limit).Preload("Room").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	// Convert to response format
	var response []models.NotificationResponse
	for _, n := range notifications {
		resp := models.NotificationResponse{
			ID:        n.ID,
			Type:      n.Type,
			Title:     n.Title,
			Message:   n.Message,
			Data:      n.Data,
			IsRead:    n.IsRead,
			ReadAt:    n.ReadAt,
			CreatedAt: n.CreatedAt,
		}
		if n.Room != nil {
			resp.Room = &models.RoomBasic{
				ID:   n.Room.ID,
				Name: n.Room.Name,
				Code: n.Room.Code,
			}
		}
		response = append(response, resp)
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// GetUnreadCount returns the count of unread notifications
func GetUnreadCount(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var count int64
	if err := database.DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"count": count}})
}

// MarkAsRead marks a notification as read
func MarkAsRead(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	idParam := c.Param("id")
	notifID, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	now := time.Now()
	result := database.DB.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", notifID, userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllAsRead marks all notifications as read for the current user
func MarkAllAsRead(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	now := time.Now()
	if err := database.DB.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": now,
		}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// DeleteNotification deletes a notification
func DeleteNotification(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	idParam := c.Param("id")
	notifID, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	result := database.DB.Where("id = ? AND user_id = ?", notifID, userID).Delete(&models.Notification{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notification"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}

// ClearAll deletes all notifications for the current user
func ClearAll(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	if err := database.DB.Where("user_id = ?", userID).Delete(&models.Notification{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications cleared"})
}

// === User Room Assignment Management ===

// GetUserRoomAssignments returns room assignments for a user
func GetUserRoomAssignments(c *gin.Context) {
	userIDParam := c.Param("user_id")
	userID, err := strconv.ParseUint(userIDParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var assignments []models.UserRoomAssignment
	if err := database.DB.Where("user_id = ? AND is_active = ?", userID, true).
		Preload("Room").Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room assignments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assignments})
}

// AssignUserToRoom assigns a user to a room for notifications
func AssignUserToRoom(c *gin.Context) {
	var request struct {
		UserID uint `json:"user_id" binding:"required"`
		RoomID uint `json:"room_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if assignment already exists
	var existing models.UserRoomAssignment
	result := database.DB.Where("user_id = ? AND room_id = ?", request.UserID, request.RoomID).First(&existing)
	if result.Error == nil {
		// Update existing to active
		existing.IsActive = true
		database.DB.Save(&existing)
		c.JSON(http.StatusOK, gin.H{"data": existing, "message": "Room assignment activated"})
		return
	}

	// Create new assignment
	assignment := models.UserRoomAssignment{
		UserID:   request.UserID,
		RoomID:   request.RoomID,
		IsActive: true,
	}

	if err := database.DB.Create(&assignment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room assignment"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": assignment})
}

// RemoveUserFromRoom removes a user from a room
func RemoveUserFromRoom(c *gin.Context) {
	var request struct {
		UserID uint `json:"user_id" binding:"required"`
		RoomID uint `json:"room_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := database.DB.Model(&models.UserRoomAssignment{}).
		Where("user_id = ? AND room_id = ?", request.UserID, request.RoomID).
		Update("is_active", false)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove room assignment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room assignment removed"})
}

// === Notification Service Functions ===

// NotificationService provides methods to create and send notifications
type NotificationService struct{}

// Global notification service instance
var NotifService *NotificationService

// InitNotificationService initializes the global notification service
func InitNotificationService() {
	NotifService = &NotificationService{}
}

// getAdminUserIDs returns all user IDs with admin roles (Super Admin or admin)
func getAdminUserIDs() []uint {
	var adminIDs []uint

	err := database.DB.Table("users").
		Joins("JOIN roles ON users.role_id = roles.id").
		Where("(roles.name = ? OR roles.name = ? OR roles.name = ?) AND users.deleted_at IS NULL", "Super Admin", "admin", "Admin").
		Pluck("users.id", &adminIDs).Error

	if err != nil {
		log.Printf("[getAdminUserIDs] Error: %v", err)
	}
	log.Printf("[getAdminUserIDs] Found admin IDs: %v", adminIDs)

	return adminIDs
}

// mergeUserIDs merges two user ID slices, removing duplicates
func mergeUserIDs(existing []uint, toAdd []uint) []uint {
	seen := make(map[uint]bool)
	for _, id := range existing {
		seen[id] = true
	}
	for _, id := range toAdd {
		if !seen[id] {
			existing = append(existing, id)
			seen[id] = true
		}
	}
	return existing
}

// CreateAndSend creates a notification and sends it via SSE
func (s *NotificationService) CreateAndSend(notification *models.Notification) error {
	if err := database.DB.Create(notification).Error; err != nil {
		return err
	}

	// Send via SSE to the user
	if Hub != nil {
		Hub.SendToUsers([]uint{notification.UserID}, "notification", gin.H{
			"id":         notification.ID,
			"type":       notification.Type,
			"title":      notification.Title,
			"message":    notification.Message,
			"data":       notification.Data,
			"created_at": notification.CreatedAt,
		})
	}

	return nil
}

// NotifyRoomUsers sends notifications to all users assigned to a room
func (s *NotificationService) NotifyRoomUsers(roomID uint, notifType models.NotificationType, title, message string, data interface{}) error {
	log.Printf("[NotifyRoomUsers] Called with roomID=%d, title=%s", roomID, title)

	// Get all active users assigned to this room via user_room_assignments
	var userIDs []uint
	database.DB.Table("user_room_assignments").
		Where("room_id = ? AND is_active = ? AND deleted_at IS NULL", roomID, true).
		Pluck("user_id", &userIDs)
	log.Printf("[NotifyRoomUsers] Found %d users from user_room_assignments", len(userIDs))

	// Also get users from room_staff table (staff assigned to room via employee)
	var staffUserIDs []uint
	database.DB.Table("users").
		Joins("JOIN room_staff ON room_staff.employee_id = users.employee_id").
		Where("room_staff.room_id = ? AND room_staff.deleted_at IS NULL AND users.deleted_at IS NULL", roomID).
		Pluck("users.id", &staffUserIDs)
	log.Printf("[NotifyRoomUsers] Found %d users from room_staff", len(staffUserIDs))

	// Merge both lists
	userIDs = mergeUserIDs(userIDs, staffUserIDs)
	log.Printf("[NotifyRoomUsers] Total after room_staff merge: %d", len(userIDs))

	// Also include System Administrators so they receive all notifications
	adminIDs := getAdminUserIDs()
	log.Printf("[NotifyRoomUsers] Found %d admin users: %v", len(adminIDs), adminIDs)
	userIDs = mergeUserIDs(userIDs, adminIDs)
	log.Printf("[NotifyRoomUsers] Total users after merge: %d", len(userIDs))

	if len(userIDs) == 0 {
		log.Printf("[NotifyRoomUsers] No users to notify, returning")
		return nil
	}

	// Convert data to JSON string
	var dataStr string
	if data != nil {
		if jsonBytes, err := json.Marshal(data); err == nil {
			dataStr = string(jsonBytes)
		}
	}

	// Create notifications for each user and collect IDs for SSE
	var createdNotifications []models.Notification
	for _, userID := range userIDs {
		notification := models.Notification{
			UserID:  userID,
			RoomID:  &roomID,
			Type:    notifType,
			Title:   title,
			Message: message,
			Data:    dataStr,
		}
		if err := database.DB.Create(&notification).Error; err != nil {
			continue // Skip failed ones
		}
		createdNotifications = append(createdNotifications, notification)
	}

	// Send SSE to room users with notification IDs
	if Hub != nil {
		// Group notifications by user for targeted SSE
		for _, notif := range createdNotifications {
			Hub.SendToUser(notif.UserID, "notification", gin.H{
				"id":         notif.ID,
				"type":       notifType,
				"title":      title,
				"message":    message,
				"data":       data,
				"room_id":    roomID,
				"created_at": notif.CreatedAt,
			})
		}
	}

	return nil
}

// NotifyUsers sends notifications to specific users
func (s *NotificationService) NotifyUsers(userIDs []uint, notifType models.NotificationType, title, message string, data interface{}) error {
	// Also include System Administrators so they receive all notifications
	adminIDs := getAdminUserIDs()
	userIDs = mergeUserIDs(userIDs, adminIDs)

	if len(userIDs) == 0 {
		return nil
	}

	// Convert data to JSON string
	var dataStr string
	if data != nil {
		if jsonBytes, err := json.Marshal(data); err == nil {
			dataStr = string(jsonBytes)
		}
	}

	// Create notifications for each user and send SSE with ID
	for _, userID := range userIDs {
		notification := models.Notification{
			UserID:  userID,
			Type:    notifType,
			Title:   title,
			Message: message,
			Data:    dataStr,
		}
		if err := database.DB.Create(&notification).Error; err != nil {
			continue
		}

		// Send SSE to this user with notification ID
		if Hub != nil {
			Hub.SendToUser(userID, "notification", gin.H{
				"id":         notification.ID,
				"type":       notifType,
				"title":      title,
				"message":    message,
				"data":       data,
				"created_at": notification.CreatedAt,
			})
		}
	}

	return nil
}

// NotifyByRole sends notifications to all users with a specific role
func (s *NotificationService) NotifyByRole(roleName string, notifType models.NotificationType, title, message string, data interface{}) error {
	// Get all users with this role
	var userIDs []uint
	if err := database.DB.Table("users").
		Joins("JOIN roles ON users.role_id = roles.id").
		Where("roles.name = ? AND users.deleted_at IS NULL", roleName).
		Pluck("users.id", &userIDs).Error; err != nil {
		return err
	}

	if len(userIDs) == 0 {
		return nil
	}

	return s.NotifyUsers(userIDs, notifType, title, message, data)
}

// NotifyByRoles sends notifications to all users with any of the specified roles
func (s *NotificationService) NotifyByRoles(roleNames []string, notifType models.NotificationType, title, message string, data interface{}) error {
	if len(roleNames) == 0 {
		return nil
	}

	// Get all users with these roles
	var userIDs []uint
	if err := database.DB.Table("users").
		Joins("JOIN roles ON users.role_id = roles.id").
		Where("roles.name IN ? AND users.deleted_at IS NULL", roleNames).
		Pluck("users.id", &userIDs).Error; err != nil {
		log.Printf("[NotifyByRoles] Error: %v", err)
		return err
	}

	log.Printf("[NotifyByRoles] Found %d users with roles %v", len(userIDs), roleNames)

	if len(userIDs) == 0 {
		return nil
	}

	return s.NotifyUsers(userIDs, notifType, title, message, data)
}
