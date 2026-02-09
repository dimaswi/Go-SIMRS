package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

func setupCounterRoutes(rg *gin.RouterGroup) {
	counters := rg.Group("/counters")
	{
		counters.GET("", handlers.GetCounters)
		counters.GET("/active", handlers.GetActiveCounters)
		counters.GET("/open", handlers.GetOpenCounters)
		counters.GET("/:id", handlers.GetCounter)
		counters.POST("", handlers.CreateCounter)
		counters.POST("/bulk-toggle-open", handlers.BulkToggleCounterOpen)
		counters.PUT("/:id", handlers.UpdateCounter)
		counters.DELETE("/:id", handlers.DeleteCounter)
		counters.POST("/:id/toggle-open", handlers.ToggleCounterOpen)
	}
}
