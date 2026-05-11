package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupMedicineRoutes(rg *gin.RouterGroup) {
	medicines := rg.Group("/medicines")
	{
		// Get medicine categories, types, forms, units from master data
		medicines.GET("/categories", handlers.GetMedicineCategories)
		medicines.GET("/types", handlers.GetMedicineTypes)
		medicines.GET("/forms", handlers.GetMedicineForms)
		medicines.GET("/units", handlers.GetMedicineUnits)

		// List and create medicines
		medicines.GET("", middleware.RequirePermission("medicines.view"), handlers.GetMedicines)
		medicines.POST("", middleware.RequirePermission("medicines.create"), handlers.CreateMedicine)

		// Single medicine operations
		medicines.GET("/:id/traceability", middleware.RequirePermission("medicines.view"), handlers.GetMedicineTraceability)
		medicines.GET("/:id", middleware.RequirePermission("medicines.view"), handlers.GetMedicine)
		medicines.PUT("/:id", middleware.RequirePermission("medicines.update"), handlers.UpdateMedicine)
		medicines.DELETE("/:id", middleware.RequirePermission("medicines.delete"), handlers.DeleteMedicine)
	}
}
