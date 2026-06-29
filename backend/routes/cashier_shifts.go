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
		shifts.GET("/current", handlers.GetCurrentShift)
		shifts.POST("/open", handlers.OpenShift)
		shifts.POST("/close", handlers.CloseShift)
	}
}
