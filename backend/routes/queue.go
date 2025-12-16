package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupQueueRoutes sets up all queue-related routes
func SetupQueueRoutes(router *gin.RouterGroup) {
	queues := router.Group("/queues")
	queues.Use(middleware.AuthMiddleware())
	{
		// Get queues (with filters)
		queues.GET("", middleware.RequirePermission("queues.view"), handlers.GetQueues)

		// Get queue statistics
		queues.GET("/stats", middleware.RequirePermission("queues.view"), handlers.GetQueueStats)

		// Get current called queues (for display)
		queues.GET("/current", handlers.GetCurrentQueue) // Public for display

		// Get single queue
		queues.GET("/:id", middleware.RequirePermission("queues.view"), handlers.GetQueue)

		// Create queue (ambil nomor antrean)
		queues.POST("", middleware.RequirePermission("queues.create"), handlers.CreateQueue)

		// Call next queue
		queues.POST("/call-next", middleware.RequirePermission("queues.call"), handlers.CallNextQueue)

		// Call specific queue
		queues.POST("/:id/call", middleware.RequirePermission("queues.call"), handlers.CallQueue)

		// Skip queue
		queues.POST("/:id/skip", middleware.RequirePermission("queues.call"), handlers.SkipQueue)

		// Cancel queue
		queues.POST("/:id/cancel", middleware.RequirePermission("queues.delete"), handlers.CancelQueue)

		// Register from queue
		queues.POST("/:id/register", middleware.RequirePermission("registrations.create"), handlers.CreateRegistrationFromQueue)
	}
} // SetupRegistrationRoutes sets up all registration-related routes
func SetupRegistrationRoutes(router *gin.RouterGroup) {
	registrations := router.Group("/registrations")
	registrations.Use(middleware.AuthMiddleware())
	{
		// Get registrations (with filters)
		registrations.GET("", middleware.RequirePermission("registrations.view"), handlers.GetRegistrations)

		// Get today's registrations
		registrations.GET("/today", middleware.RequirePermission("registrations.view"), handlers.GetTodayRegistrations)

		// Get scheduled registrations (follow-up/kontrol)
		registrations.GET("/scheduled", middleware.RequirePermission("registrations.view"), handlers.GetScheduledRegistrations)

		// Search patient for queue registration
		registrations.GET("/search-patient", middleware.RequirePermission("registrations.create"), handlers.SearchPatientForQueue)

		// Get single registration
		registrations.GET("/:id", middleware.RequirePermission("registrations.view"), handlers.GetRegistration)

		// Create registration
		registrations.POST("", middleware.RequirePermission("registrations.create"), handlers.CreateRegistration)

		// Update registration
		registrations.PUT("/:id", middleware.RequirePermission("registrations.update"), handlers.UpdateRegistration)

		// Cancel registration
		registrations.POST("/:id/cancel", middleware.RequirePermission("registrations.delete"), handlers.CancelRegistration)

		// Complete registration
		registrations.POST("/:id/complete", middleware.RequirePermission("registrations.update"), handlers.CompleteRegistration)

		// Check-in scheduled registration (for follow-up)
		registrations.POST("/:id/checkin", middleware.RequirePermission("registrations.update"), handlers.CheckInScheduledRegistration)

		// Reschedule registration (for follow-up)
		registrations.PUT("/:id/reschedule", middleware.RequirePermission("registrations.update"), handlers.RescheduleRegistration)

		// Cancel scheduled registration
		registrations.POST("/:id/cancel-scheduled", middleware.RequirePermission("registrations.delete"), handlers.CancelScheduledRegistration)
	}
}
