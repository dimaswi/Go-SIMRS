package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupPPKRoutes(rg *gin.RouterGroup) {
	ppk := rg.Group("/ppk")
	ppk.Use(middleware.RequirePermission("master_data.view"))
	{
		ppk.GET("", handlers.GetPPKList)
		ppk.GET("/:id", handlers.GetPPKByID)
		ppk.POST("", middleware.RequirePermission("master_data.create"), handlers.CreatePPK)
		ppk.PUT("/:id", middleware.RequirePermission("master_data.update"), handlers.UpdatePPK)
		ppk.DELETE("/:id", middleware.RequirePermission("master_data.delete"), handlers.DeletePPK)
	}
}
