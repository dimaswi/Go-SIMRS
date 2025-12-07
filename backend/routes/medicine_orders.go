package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupMedicineOrderRoutes sets up routes for medicine orders (prescriptions)
func setupMedicineOrderRoutes(router *gin.RouterGroup) {
	orders := router.Group("/medicine-orders")
	{
		// Get all medicine orders (with filters) - accessible by doctors and pharmacists
		orders.GET("", handlers.GetMedicineOrders)

		// Get single medicine order
		orders.GET("/:id", handlers.GetMedicineOrder)

		// Create new medicine order (from doctor)
		orders.POST("", middleware.RequirePermission("medicine_orders.create"), handlers.CreateMedicineOrder)

		// Update medicine order (only pending orders)
		orders.PUT("/:id", middleware.RequirePermission("medicine_orders.update"), handlers.UpdateMedicineOrder)

		// Cancel medicine order
		orders.POST("/:id/cancel", middleware.RequirePermission("medicine_orders.cancel"), handlers.CancelMedicineOrder)

		// Prescription Review (by pharmacist)
		orders.GET("/:id/review", handlers.GetPrescriptionReview)
		orders.POST("/:id/review", middleware.RequirePermission("pharmacy.review"), handlers.ReviewPrescription)

		// Dispense medicines (by pharmacist)
		orders.POST("/:id/dispense", middleware.RequirePermission("pharmacy.dispense"), handlers.DispenseMedicine)

		// Medicine Returns (by pharmacist)
		orders.GET("/:id/returns", handlers.GetMedicineReturns)
		orders.POST("/:id/returns", middleware.RequirePermission("pharmacy.return"), handlers.CreateMedicineReturn)
	}

	// Helper route to get available medicines in pharmacy room
	router.GET("/pharmacy-rooms/:room_id/medicines", handlers.GetPharmacyRoomMedicines)
}
