package routes

import (
	"github.com/gin-gonic/gin"

	"starter/backend/handlers"
	"starter/backend/middleware"
)

// SetupProcedureOrderRoutes sets up all procedure order related routes
func SetupProcedureOrderRoutes(r *gin.RouterGroup) {
	procedureOrders := r.Group("/procedure-orders")
	procedureOrders.Use(middleware.AuthMiddleware())
	{
		// Get all procedure orders with filters
		procedureOrders.GET("", middleware.RequirePermission("procedure_orders.view"), handlers.GetProcedureOrders)

		// Get single procedure order
		procedureOrders.GET("/:id", middleware.RequirePermission("procedure_orders.view"), handlers.GetProcedureOrder)

		// Create new procedure order (from clinical room - radiology or laboratory order)
		procedureOrders.POST("", middleware.RequirePermission("procedure_orders.create"), handlers.CreateProcedureOrder)

		// Start working on order (radiology/lab technician)
		procedureOrders.POST("/:id/start", middleware.RequirePermission("procedure_orders.perform"), handlers.StartProcedureOrder)

		// Save item results without completing (radiology/lab technician)
		procedureOrders.POST("/:id/save-results", middleware.RequirePermission("procedure_orders.perform"), handlers.SaveItemResults)

		// Submit results and complete (radiology/lab technician) - legacy
		procedureOrders.POST("/:id/results", middleware.RequirePermission("procedure_orders.perform"), handlers.SubmitProcedureResults)

		// Complete order (radiology/lab technician)
		procedureOrders.POST("/:id/complete", middleware.RequirePermission("procedure_orders.perform"), handlers.CompleteProcedureOrder)

		// Cancel order
		procedureOrders.POST("/:id/cancel", middleware.RequirePermission("procedure_orders.create"), handlers.CancelProcedureOrder)

		// Validate result (by doctor)
		procedureOrders.POST("/:id/validate", middleware.RequirePermission("procedure_orders.validate"), handlers.ValidateProcedureResult)

		// Print result
		procedureOrders.GET("/:id/print", middleware.RequirePermission("procedure_orders.view"), handlers.PrintProcedureOrderResult)

		// Get orders by source visit
		procedureOrders.GET("/by-visit/:visit_id", middleware.RequirePermission("procedure_orders.view"), handlers.GetOrdersBySourceVisit)

		// Get patient history
		procedureOrders.GET("/history", middleware.RequirePermission("procedure_orders.view"), handlers.GetProcedureOrderHistory)

		// Get procedures by room (for creating order)
		procedureOrders.GET("/procedures/room/:room_id", middleware.RequirePermission("procedure_orders.view"), handlers.GetProceduresByRoom)

		// Get radiology rooms (for creating order)
		procedureOrders.GET("/rooms/radiology", middleware.RequirePermission("procedure_orders.view"), handlers.GetRadiologyRooms)

		// Get laboratory rooms (for creating order)
		procedureOrders.GET("/rooms/laboratory", middleware.RequirePermission("procedure_orders.view"), handlers.GetLaboratoryRooms)

		// Get consultation rooms (for creating order - excludes current room)
		procedureOrders.GET("/rooms/consultation", middleware.RequirePermission("procedure_orders.view"), handlers.GetConsultationRooms)

		// Get doctors by room (for consultation order)
		procedureOrders.GET("/doctors/room/:room_id", middleware.RequirePermission("procedure_orders.view"), handlers.GetDoctorsByRoom)

		// Get consultation procedures by room
		procedureOrders.GET("/procedures/consultation/:room_id", middleware.RequirePermission("procedure_orders.view"), handlers.GetConsultationProcedures)

		// Get surgery rooms (operating rooms)
		procedureOrders.GET("/rooms/surgery", middleware.RequirePermission("procedure_orders.view"), handlers.GetSurgeryRooms)

		// Get surgical procedures, optionally filtered by room_id
		procedureOrders.GET("/procedures/surgical", middleware.RequirePermission("procedure_orders.view"), handlers.GetSurgicalProcedures)
	}
}
