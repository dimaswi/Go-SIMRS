package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// KFARoutes registers KFA (Kode Farmasi Indonesia) related routes
func KFARoutes(r *gin.RouterGroup) {
	kfa := r.Group("/kfa")
	kfa.Use(middleware.AuthMiddleware())
	{
		// KFA Master Data CRUD
		master := kfa.Group("/master")
		{
			master.GET("", middleware.RequirePermission("integrations.view"), handlers.GetKFAMasters)
			master.GET("/:id", middleware.RequirePermission("integrations.view"), handlers.GetKFAMaster)
			master.POST("", middleware.RequirePermission("integrations.manage"), handlers.CreateKFAMaster)
			master.PUT("/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateKFAMaster)
			master.DELETE("/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteKFAMaster)

			// Search for autocomplete
			master.GET("/search", middleware.RequirePermission("integrations.view"), handlers.SearchKFAFromMaster)
		}

		// Medicine to KFA Mapping CRUD
		mapping := kfa.Group("/mapping")
		{
			mapping.GET("", middleware.RequirePermission("integrations.view"), handlers.GetMedicineKFAMappings)
			mapping.GET("/:id", middleware.RequirePermission("integrations.view"), handlers.GetMedicineKFAMapping)
			mapping.GET("/medicine/:medicine_id", middleware.RequirePermission("integrations.view"), handlers.GetMedicineKFAMappingByMedicine)
			mapping.POST("", middleware.RequirePermission("integrations.manage"), handlers.CreateMedicineKFAMapping)
			mapping.PUT("/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateMedicineKFAMapping)
			mapping.DELETE("/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteMedicineKFAMapping)

			// Verify mapping
			mapping.POST("/:id/verify", middleware.RequirePermission("integrations.manage"), handlers.VerifyMedicineKFAMapping)
		}

		// Statistics and Unmapped
		kfa.GET("/stats", middleware.RequirePermission("integrations.view"), handlers.GetKFAMappingStats)
		kfa.GET("/unmapped", middleware.RequirePermission("integrations.view"), handlers.GetUnmappedMedicines)

		// SatuSehat KFA Lookup (live API)
		lookup := kfa.Group("/lookup")
		{
			lookup.GET("/code/:code", middleware.RequirePermission("integrations.view"), handlers.LookupKFAByCode)
			lookup.GET("/search", middleware.RequirePermission("integrations.view"), handlers.SearchKFAFromSatuSehat)
		}

		// SatuSehat FHIR Medication Send
		medication := kfa.Group("/medication")
		{
			medication.POST("/send/:id", middleware.RequirePermission("integrations.manage"), handlers.SendMedicationToSatuSehat)
		}
	}
}
