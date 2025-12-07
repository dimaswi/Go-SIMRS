package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupRoomInventoryRoutes sets up all room inventory related routes
func setupRoomInventoryRoutes(rg *gin.RouterGroup) {
	roomInventories := rg.Group("/room-inventories")
	{
		// List all room inventories with pagination
		roomInventories.GET("", middleware.RequirePermission("room-inventories.view"), handlers.GetAllRoomInventories)

		// Get single room inventory
		roomInventories.GET("/:id", middleware.RequirePermission("room-inventories.view"), handlers.GetRoomInventory)

		// Create room inventory assignment
		roomInventories.POST("", middleware.RequirePermission("room-inventories.create"), handlers.CreateRoomInventory)

		// Update room inventory
		roomInventories.PUT("/:id", middleware.RequirePermission("room-inventories.update"), handlers.UpdateRoomInventoryStock)

		// Delete room inventory
		roomInventories.DELETE("/:id", middleware.RequirePermission("room-inventories.delete"), handlers.DeleteRoomInventory)

		// Adjust stock
		roomInventories.POST("/:id/adjust", middleware.RequirePermission("room-inventories.update"), handlers.AdjustRoomInventoryStock)

		// Transfer stock between rooms
		roomInventories.POST("/transfer", middleware.RequirePermission("room-inventories.update"), handlers.TransferInventoryStock)

		// Get low stock inventories
		roomInventories.GET("/low-stock", middleware.RequirePermission("room-inventories.view"), handlers.GetLowStockInventories)
	}

	// Inventory-specific room routes
	inventories := rg.Group("/inventories")
	{
		// Get rooms by inventory
		inventories.GET("/:id/rooms", middleware.RequirePermission("room-inventories.view"), handlers.GetRoomsByInventory)

		// Get total stock of an inventory across all rooms
		inventories.GET("/:id/total-stock", middleware.RequirePermission("room-inventories.view"), handlers.GetTotalInventoryStock)
	}
}
