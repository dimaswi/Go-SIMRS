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
		// Doctor private templates
		orders.GET("/templates", handlers.GetDoctorMedicineTemplates)
		orders.POST("/templates", middleware.RequirePermission("medicine_orders.create"), handlers.CreateDoctorMedicineTemplate)
		orders.PUT("/templates/:id", middleware.RequirePermission("medicine_orders.update"), handlers.UpdateDoctorMedicineTemplate)
		orders.DELETE("/templates/:id", middleware.RequirePermission("medicine_orders.cancel"), handlers.DeleteDoctorMedicineTemplate)

		// Get all medicine orders (with filters) - accessible by doctors and pharmacists
		orders.GET("", handlers.GetMedicineOrders)

		// In-room medication timesheet (hourly administration)
		orders.GET("/timesheet", middleware.RequirePermission("medical_records.medicine_order"), handlers.GetMedicationTimesheet)
		orders.POST("/timesheet/item", middleware.RequirePermission("medical_records.medicine_order"), handlers.CreateMedicationTimesheetItem)
		orders.DELETE("/timesheet/item/:id", middleware.RequirePermission("medical_records.medicine_order"), handlers.DeleteMedicationTimesheetItem)
		orders.POST("/timesheet/entry", middleware.RequirePermission("medical_records.medicine_order"), handlers.UpsertMedicationTimesheetEntry)

		// Get single medicine order
		orders.GET("/:id", handlers.GetMedicineOrder)

		// Create new medicine order (from doctor)
		orders.POST("", middleware.RequirePermission("medicine_orders.create"), handlers.CreateMedicineOrder)

		// Update medicine order (only pending orders)
		orders.PUT("/:id", middleware.RequirePermission("medicine_orders.update"), handlers.UpdateMedicineOrder)

		// Cancel medicine order
		orders.POST("/:id/cancel", middleware.RequirePermission("medicine_orders.cancel"), handlers.CancelMedicineOrder)

		// Recalculate order status (fix inconsistent status)
		orders.POST("/:id/recalculate", middleware.RequirePermission("pharmacy.edit"), handlers.RecalculateOrderStatus)

		// Pharmacy item management (for pharmacists to edit prescriptions)
		orders.POST("/:id/items", middleware.RequirePermission("pharmacy.edit"), handlers.AddMedicineOrderItem)
		orders.PUT("/:id/items/:itemId", middleware.RequirePermission("pharmacy.edit"), handlers.UpdateMedicineOrderItem)
		orders.DELETE("/:id/items/:itemId", middleware.RequirePermission("pharmacy.edit"), handlers.DeleteMedicineOrderItem)

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
