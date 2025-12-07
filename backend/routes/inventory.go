package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupInventoryRoutes(rg *gin.RouterGroup) {
	inventories := rg.Group("/inventories")
	{
		// Get inventory categories, conditions, statuses, units from master data
		inventories.GET("/categories", handlers.GetInventoryCategories)
		inventories.GET("/conditions", handlers.GetInventoryConditions)
		inventories.GET("/statuses", handlers.GetInventoryStatuses)
		inventories.GET("/units", handlers.GetInventoryUnits)

		// List and create inventories
		inventories.GET("", middleware.RequirePermission("inventories.view"), handlers.GetInventories)
		inventories.POST("", middleware.RequirePermission("inventories.create"), handlers.CreateInventory)

		// Single inventory operations
		inventories.GET("/:id", middleware.RequirePermission("inventories.view"), handlers.GetInventory)
		inventories.PUT("/:id", middleware.RequirePermission("inventories.update"), handlers.UpdateInventory)
		inventories.DELETE("/:id", middleware.RequirePermission("inventories.delete"), handlers.DeleteInventory)

		// Inventory items (individual trackable items)
		inventories.GET("/:id/items", middleware.RequirePermission("inventories.view"), handlers.GetInventoryItems)
		inventories.POST("/:id/items", middleware.RequirePermission("inventories.create"), handlers.CreateInventoryItem)
		inventories.PUT("/:id/items/:itemId", middleware.RequirePermission("inventories.update"), handlers.UpdateInventoryItem)
		inventories.DELETE("/:id/items/:itemId", middleware.RequirePermission("inventories.delete"), handlers.DeleteInventoryItem)
		inventories.POST("/:id/items/:itemId/assign", middleware.RequirePermission("inventories.update"), handlers.AssignItemToRoom)

		// Inventory transactions (stock in/out)
		inventories.GET("/:id/transactions", middleware.RequirePermission("inventories.view"), handlers.GetInventoryTransactions)
		inventories.POST("/:id/transactions", middleware.RequirePermission("inventories.update"), handlers.CreateInventoryTransaction)
	}
}
