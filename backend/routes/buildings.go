package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupBuildingRoutes registers all building and floor plan routes
func SetupBuildingRoutes(r *gin.Engine) {
	buildings := r.Group("/api/buildings")
	buildings.Use(middleware.AuthMiddleware())
	{
		// Building CRUD
		buildings.GET("", handlers.GetBuildings)
		buildings.GET("/:id", handlers.GetBuilding)
		buildings.POST("", handlers.CreateBuilding)
		buildings.PUT("/:id", handlers.UpdateBuilding)
		buildings.DELETE("/:id", handlers.DeleteBuilding)

		// Building-Room assignment
		buildings.POST("/:id/rooms", handlers.AssignRoomToBuilding)
		buildings.DELETE("/:id/rooms/:room_id", handlers.UnassignRoomFromBuilding)
		buildings.GET("/:id/rooms", handlers.GetBuildingRooms)
	}

	// Floor Plan Layout (shared across buildings)
	floorPlan := r.Group("/api/floor-plan")
	floorPlan.Use(middleware.AuthMiddleware())
	{
		floorPlan.GET("/layout", handlers.GetFloorPlanLayout)
		floorPlan.PUT("/layout", handlers.SaveFloorPlanLayout)
	}

	// Bedside Summary (under visits)
	bedside := r.Group("/api/visits")
	bedside.Use(middleware.AuthMiddleware())
	{
		bedside.GET("/:id/bedside-summary", handlers.GetBedsideSummary)
	}
}
