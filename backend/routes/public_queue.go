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
	}
}
