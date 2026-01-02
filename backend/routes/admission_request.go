package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupAdmissionRequestRoutes(r *gin.Engine) {
	admission := r.Group("/api/admission-requests")
	admission.Use(middleware.AuthMiddleware())
	{
		// Get all admission requests (with filters)
		admission.GET("", handlers.GetAdmissionRequests)

		// Get pending count (for badge notification)
		admission.GET("/pending-count", handlers.GetPendingAdmissionRequestsCount)

		// Get single admission request
		admission.GET("/:id", handlers.GetAdmissionRequest)

		// Create new admission request (from disposition)
		admission.POST("", handlers.CreateAdmissionRequest)

		// Process (approve) admission request - by admission staff
		admission.PUT("/:id/process", handlers.ProcessAdmissionRequest)

		// Reject admission request - by admission staff
		admission.PUT("/:id/reject", handlers.RejectAdmissionRequest)

		// Cancel admission request - by requester
		admission.PUT("/:id/cancel", handlers.CancelAdmissionRequest)
	}
}
