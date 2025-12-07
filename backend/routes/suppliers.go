package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupSupplierRoutes sets up routes for supplier management
func setupSupplierRoutes(protected *gin.RouterGroup) {
	suppliers := protected.Group("/suppliers")
	{
		suppliers.GET("", middleware.RequirePermission("suppliers.view"), handlers.GetSuppliers)
		suppliers.GET("/all", middleware.RequirePermission("suppliers.view"), handlers.GetAllSuppliers)
		suppliers.GET("/:id", middleware.RequirePermission("suppliers.view"), handlers.GetSupplier)
		suppliers.POST("", middleware.RequirePermission("suppliers.create"), handlers.CreateSupplier)
		suppliers.PUT("/:id", middleware.RequirePermission("suppliers.update"), handlers.UpdateSupplier)
		suppliers.DELETE("/:id", middleware.RequirePermission("suppliers.delete"), handlers.DeleteSupplier)
	}
}
