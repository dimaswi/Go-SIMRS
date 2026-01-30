package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// LoincRoutes registers LOINC and SNOMED related routes for lab/radiology mapping
func LoincRoutes(r *gin.RouterGroup) {
	loinc := r.Group("/loinc")
	loinc.Use(middleware.AuthMiddleware())
	{
		// LOINC Master Data (Struktur Kemkes IHS)
		master := loinc.Group("/master")
		{
			// List & Read
			master.GET("", middleware.RequirePermission("integrations.view"), handlers.GetLoincMasters)
			master.GET("/:id", middleware.RequirePermission("integrations.view"), handlers.GetLoincMaster)

			// Search for autocomplete (optimized for dropdown)
			master.GET("/search", middleware.RequirePermission("integrations.view"), handlers.SearchLoincFromMaster)

			// Lookup by code
			master.GET("/lookup/:code", middleware.RequirePermission("integrations.view"), handlers.LookupLoincByCode)

			// Get filter options
			master.GET("/kategori", middleware.RequirePermission("integrations.view"), handlers.GetLoincKategoriList)
			master.GET("/spesimen", middleware.RequirePermission("integrations.view"), handlers.GetLoincSpesimenList)
		}

		// SNOMED Master Data (Read-only dari Kemkes IHS)
		snomed := loinc.Group("/snomed")
		{
			// List & Read (Data Kemkes - read only)
			snomed.GET("", middleware.RequirePermission("integrations.view"), handlers.GetSnomedMasters)
			snomed.GET("/:id", middleware.RequirePermission("integrations.view"), handlers.GetSnomedMaster)

			// Search for autocomplete (optimized for large dataset)
			snomed.GET("/search", middleware.RequirePermission("integrations.view"), handlers.SearchSnomedFromMaster)

			// Lookup by code
			snomed.GET("/lookup/:code", middleware.RequirePermission("integrations.view"), handlers.LookupSnomedByCode)

			// Get by category (not applicable for Kemkes structure)
			snomed.GET("/category/:category", middleware.RequirePermission("integrations.view"), handlers.GetSnomedByCategory)

			// Get category list (not applicable for Kemkes structure)
			snomed.GET("/categories", middleware.RequirePermission("integrations.view"), handlers.GetSnomedCategoryList)
		}

		// Procedure to LOINC Mapping CRUD
		mapping := loinc.Group("/mapping")
		{
			mapping.GET("", middleware.RequirePermission("integrations.view"), handlers.GetProcedureLoincMappings)
			mapping.GET("/:id", middleware.RequirePermission("integrations.view"), handlers.GetProcedureLoincMapping)
			mapping.GET("/procedure/:procedure_id", middleware.RequirePermission("integrations.view"), handlers.GetProcedureLoincMappingByProcedure)
			mapping.POST("", middleware.RequirePermission("integrations.manage"), handlers.CreateProcedureLoincMapping)
			mapping.PUT("/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateProcedureLoincMapping)
			mapping.DELETE("/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteProcedureLoincMapping)

			// Verify mapping
			mapping.POST("/:id/verify", middleware.RequirePermission("integrations.manage"), handlers.VerifyProcedureLoincMapping)
		}

		// Statistics and Unmapped
		loinc.GET("/stats", middleware.RequirePermission("integrations.view"), handlers.GetLoincMappingStats)
		loinc.GET("/unmapped", middleware.RequirePermission("integrations.view"), handlers.GetUnmappedProcedures)
	}
}
