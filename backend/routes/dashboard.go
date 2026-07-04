package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupDashboardRoutes configures dashboard routes
func SetupDashboardRoutes(api *gin.RouterGroup) {
	dashboard := api.Group("/dashboard")
	dashboard.Use(middleware.AuthMiddleware())
	dashboard.Use(middleware.RequirePermission("dashboard.view"))
	{
		// Main dashboard statistics
		dashboard.GET("/stats", handlers.GetDashboardStats)

		// Chart data for visualizations
		dashboard.GET("/charts", handlers.GetDashboardCharts)

		// Quick summary for widgets (with period comparisons)
		dashboard.GET("/summary", handlers.GetDashboardSummary)

		// Recent activity feed
		dashboard.GET("/recent", handlers.GetRecentActivity)

		// Bed monitoring data
		dashboard.GET("/bed-monitoring", handlers.GetBedMonitoring)
	}
}
