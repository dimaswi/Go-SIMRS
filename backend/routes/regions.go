package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

func setupRegionRoutes(rg *gin.RouterGroup) {
	// Stats
	rg.GET("/regions/stats", handlers.GetRegionStats)

	// Provinces
	rg.GET("/regions/provinces", handlers.GetProvinces)
	rg.GET("/regions/provinces/:id", handlers.GetProvince)
	rg.POST("/regions/provinces", handlers.CreateProvince)
	rg.PUT("/regions/provinces/:id", handlers.UpdateProvince)

	// Regencies
	rg.GET("/regions/all-regencies", handlers.GetAllRegencies)
	rg.GET("/regions/regencies/:province_id", handlers.GetRegencies)
	rg.GET("/regions/regency/:id", handlers.GetRegency)
	rg.POST("/regions/regencies", handlers.CreateRegency)
	rg.PUT("/regions/regency/:id", handlers.UpdateRegency)

	// Districts
	rg.GET("/regions/districts/:regency_id", handlers.GetDistricts)
	rg.GET("/regions/district/:id", handlers.GetDistrict)
	rg.POST("/regions/districts", handlers.CreateDistrict)
	rg.PUT("/regions/district/:id", handlers.UpdateDistrict)

	// Villages
	rg.GET("/regions/villages/:district_id", handlers.GetVillages)
	rg.GET("/regions/village/:id", handlers.GetVillage)
	rg.POST("/regions/villages", handlers.CreateVillage)
	rg.PUT("/regions/village/:id", handlers.UpdateVillage)
}
