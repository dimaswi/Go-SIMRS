package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// SetupPublicQueueRoutes configures public access routes for online queue booking
func SetupPublicQueueRoutes(r *gin.Engine) {
	public := r.Group("/api/public")
	{
		public.GET("/settings", handlers.PublicGetSettings)
		public.GET("/schedules", handlers.PublicGetSchedules)
		public.GET("/check-nik", handlers.PublicCheckNIK)
		public.POST("/register-queue", handlers.PublicRegisterQueue)
		public.GET("/cashier-display", handlers.GetCashierDisplay)

		// Public Kiosk & Queue Display routes
		public.GET("/counters/open", handlers.GetOpenCounters)
		public.GET("/counters/:id", handlers.GetCounter)
		public.GET("/queues", handlers.GetQueues)
		public.POST("/queues", handlers.CreateQueue)
		public.GET("/room-queues", handlers.GetRoomQueues)
		public.GET("/rooms", handlers.GetRooms)
		public.GET("/rooms/:id/staff", handlers.GetRoomStaff)
		public.GET("/schedules/available-doctors", handlers.GetAvailableDoctorsByDate)
	}
}
