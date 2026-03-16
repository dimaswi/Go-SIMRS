package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupRegionRoutes(rg *gin.RouterGroup) {
	// Stats
	rg.GET("/regions/stats", middleware.RequirePermission("regions.view"), handlers.GetRegionStats)

	// Provinces
	rg.GET("/regions/provinces", middleware.RequirePermission("regions.view"), handlers.GetProvinces)
	rg.GET("/regions/provinces/:id", middleware.RequirePermission("regions.view"), handlers.GetProvince)
	rg.POST("/regions/provinces", middleware.RequirePermission("regions.create"), handlers.CreateProvince)
	rg.PUT("/regions/provinces/:id", middleware.RequirePermission("regions.update"), handlers.UpdateProvince)

	// Regencies
	rg.GET("/regions/all-regencies", middleware.RequirePermission("regions.view"), handlers.GetAllRegencies)
	rg.GET("/regions/regencies/:province_id", middleware.RequirePermission("regions.view"), handlers.GetRegencies)
	rg.GET("/regions/regency/:id", middleware.RequirePermission("regions.view"), handlers.GetRegency)
	rg.POST("/regions/regencies", middleware.RequirePermission("regions.create"), handlers.CreateRegency)
	rg.PUT("/regions/regency/:id", middleware.RequirePermission("regions.update"), handlers.UpdateRegency)

	// Districts
	rg.GET("/regions/districts/:regency_id", middleware.RequirePermission("regions.view"), handlers.GetDistricts)
	rg.GET("/regions/district/:id", middleware.RequirePermission("regions.view"), handlers.GetDistrict)
	rg.POST("/regions/districts", middleware.RequirePermission("regions.create"), handlers.CreateDistrict)
	rg.PUT("/regions/district/:id", middleware.RequirePermission("regions.update"), handlers.UpdateDistrict)

	// Villages
	rg.GET("/regions/villages/:district_id", middleware.RequirePermission("regions.view"), handlers.GetVillages)
	rg.GET("/regions/village/:id", middleware.RequirePermission("regions.view"), handlers.GetVillage)
	rg.POST("/regions/villages", middleware.RequirePermission("regions.create"), handlers.CreateVillage)
	rg.PUT("/regions/village/:id", middleware.RequirePermission("regions.update"), handlers.UpdateVillage)
}
