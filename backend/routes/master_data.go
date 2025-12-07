package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupMasterDataRoutes(rg *gin.RouterGroup) {
	// Public access for dropdowns
	rg.GET("/master-data/categories", handlers.GetMasterDataCategories)
	rg.GET("/master-data/category/:category", handlers.GetMasterDataByCategory)
	rg.POST("/master-data/multiple", handlers.GetMasterDataMultiple)

	// Protected CRUD
	rg.GET("/master-data/:id", middleware.RequirePermission("master_data.view"), handlers.GetMasterData)
	rg.POST("/master-data", middleware.RequirePermission("master_data.create"), handlers.CreateMasterData)
	rg.PUT("/master-data/:id", middleware.RequirePermission("master_data.update"), handlers.UpdateMasterData)
	rg.DELETE("/master-data/:id", middleware.RequirePermission("master_data.delete"), handlers.DeleteMasterData)
}
