package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoomQueueRoutes(r *gin.Engine) {
	roomQueues := r.Group("/api/room-queues")
	roomQueues.Use(middleware.AuthMiddleware())
	{
		// Get all room queues (with filters: room_id, date, status)
		roomQueues.GET("", handlers.GetRoomQueues)

		// Get specific room queue
		roomQueues.GET("/:id", handlers.GetRoomQueue)

		// Create new room queue
		roomQueues.POST("", handlers.CreateRoomQueue)

		// Update queue status
		roomQueues.PUT("/:id/status", middleware.RequirePermission("room_queues.manage"), handlers.UpdateQueueStatus)

		// Call specific queue
		roomQueues.PUT("/:id/call", middleware.RequirePermission("room_queues.call"), handlers.CallSpecificQueue)

		// Room-specific operations
		room := roomQueues.Group("/room/:room_id")
		{
			// Call next queue in this room
			room.POST("/call-next", middleware.RequirePermission("room_queues.call"), handlers.CallNextRoomQueue)

			// Get statistics for this room
			room.GET("/stats", handlers.GetRoomQueueStats)

			// Get current active queue (called/serving)
			room.GET("/current", handlers.GetCurrentRoomQueue)
		}
	}
}
