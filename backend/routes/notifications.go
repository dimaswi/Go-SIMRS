package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupNotificationRoutes sets up notification routes
func SetupNotificationRoutes(r *gin.Engine) {
	notifications := r.Group("/api/notifications")
	notifications.Use(middleware.AuthMiddleware())
	{
		// Get user's notifications
		notifications.GET("", handlers.GetNotifications)

		// Get unread count
		notifications.GET("/unread-count", handlers.GetUnreadCount)

		// Mark single notification as read
		notifications.PUT("/:id/read", handlers.MarkAsRead)

		// Mark all as read
		notifications.PUT("/mark-all-read", handlers.MarkAllAsRead)

		// Delete single notification
		notifications.DELETE("/:id", handlers.DeleteNotification)

		// Clear all notifications
		notifications.DELETE("", handlers.ClearAll)
	}

	// Room assignment routes (admin only)
	roomAssignments := r.Group("/api/user-room-assignments")
	roomAssignments.Use(middleware.AuthMiddleware())
	{
		roomAssignments.GET("/user/:user_id", handlers.GetUserRoomAssignments)
		roomAssignments.POST("", handlers.AssignUserToRoom)
		roomAssignments.DELETE("", handlers.RemoveUserFromRoom)
	}

	// SSE endpoint for real-time notifications
	sse := r.Group("/api/sse")
	sse.Use(middleware.AuthMiddleware())
	{
		sse.GET("/notifications", handlers.SSEHandler)
	}
}
