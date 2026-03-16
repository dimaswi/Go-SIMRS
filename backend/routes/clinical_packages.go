package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupClinicalPackageRoutes(rg *gin.RouterGroup) {
	packages := rg.Group("/clinical-packages")
	{
		packages.GET("", middleware.RequirePermission("master_data.view"), handlers.GetClinicalPackages)
		packages.GET("/:id", middleware.RequirePermission("master_data.view"), handlers.GetClinicalPackage)
		packages.POST("", middleware.RequirePermission("master_data.create"), handlers.CreateClinicalPackage)
		packages.PUT("/:id", middleware.RequirePermission("master_data.update"), handlers.UpdateClinicalPackage)
		packages.DELETE("/:id", middleware.RequirePermission("master_data.delete"), handlers.DeleteClinicalPackage)
	}
}
