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
		buildings.GET("", middleware.RequirePermission("buildings.view"), handlers.GetBuildings)
		buildings.GET("/:id", middleware.RequirePermission("buildings.view"), handlers.GetBuilding)
		buildings.POST("", middleware.RequirePermission("buildings.create"), handlers.CreateBuilding)
		buildings.PUT("/:id", middleware.RequirePermission("buildings.update"), handlers.UpdateBuilding)
		buildings.DELETE("/:id", middleware.RequirePermission("buildings.delete"), handlers.DeleteBuilding)

		// Building-Room assignment
		buildings.POST("/:id/rooms", middleware.RequirePermission("buildings.update"), handlers.AssignRoomToBuilding)
		buildings.DELETE("/:id/rooms/:room_id", middleware.RequirePermission("buildings.update"), handlers.UnassignRoomFromBuilding)
		buildings.GET("/:id/rooms", middleware.RequirePermission("buildings.view"), handlers.GetBuildingRooms)
	}

	// Floor Plan Layout (shared across buildings)
	floorPlan := r.Group("/api/floor-plan")
	floorPlan.Use(middleware.AuthMiddleware())
	{
		floorPlan.GET("/layout", middleware.RequirePermission("buildings.view"), handlers.GetFloorPlanLayout)
		floorPlan.PUT("/layout", middleware.RequirePermission("buildings.update"), handlers.SaveFloorPlanLayout)
	}

	// Bedside Summary (under visits)
	bedside := r.Group("/api/visits")
	bedside.Use(middleware.AuthMiddleware())
	{
		bedside.GET("/:id/bedside-summary", handlers.GetBedsideSummary)
	}
}
