package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupCashierShiftRoutes configures routes for cashier shift management
func SetupCashierShiftRoutes(rg *gin.RouterGroup) {
	shifts := rg.Group("/cashier-shifts")
	shifts.Use(middleware.AuthMiddleware())
	{
		shifts.GET("/current", middleware.RequirePermission("cashier_shifts.view"), handlers.GetCurrentShift)
		shifts.POST("/open", middleware.RequirePermission("cashier_shifts.open"), handlers.OpenShift)
		shifts.POST("/close", middleware.RequirePermission("cashier_shifts.close"), handlers.CloseShift)
	}
}
