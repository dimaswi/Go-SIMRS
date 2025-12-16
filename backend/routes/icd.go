package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupICDRoutes sets up ICD-10, ICD-9-CM, and ICD-O routes
func SetupICDRoutes(router *gin.RouterGroup) {
	// ICD-10 routes (Diagnosis) - No permission required for read operations
	icd10 := router.Group("/icd10")
	{
		icd10.GET("", handlers.SearchICD10)                                                    // Search ICD-10
		icd10.GET("/stats", handlers.GetICD10Stats)                                            // Get statistics
		icd10.GET("/chapters", handlers.GetICD10Chapters)                                      // Get chapters
		icd10.GET("/id/:id", handlers.GetICD10ByID)                                            // Get by ID
		icd10.GET("/:code", handlers.GetICD10ByCode)                                           // Get by code
		icd10.POST("", middleware.RequirePermission("icd.create"), handlers.CreateICD10)       // Create ICD-10
		icd10.PUT("/:id", middleware.RequirePermission("icd.update"), handlers.UpdateICD10)    // Update ICD-10
		icd10.DELETE("/:id", middleware.RequirePermission("icd.delete"), handlers.DeleteICD10) // Delete ICD-10
	}

	// ICD-9-CM routes (Procedures) - No permission required for read operations
	icd9cm := router.Group("/icd9cm")
	{
		icd9cm.GET("", handlers.SearchICD9CM)                                                    // Search ICD-9-CM
		icd9cm.GET("/stats", handlers.GetICD9CMStats)                                            // Get statistics
		icd9cm.GET("/id/:id", handlers.GetICD9CMByID)                                            // Get by ID
		icd9cm.GET("/:code", handlers.GetICD9CMByCode)                                           // Get by code
		icd9cm.POST("", middleware.RequirePermission("icd.create"), handlers.CreateICD9CM)       // Create ICD-9-CM
		icd9cm.PUT("/:id", middleware.RequirePermission("icd.update"), handlers.UpdateICD9CM)    // Update ICD-9-CM
		icd9cm.DELETE("/:id", middleware.RequirePermission("icd.delete"), handlers.DeleteICD9CM) // Delete ICD-9-CM
	}

	// ICD-O routes (Morphology) - No permission required for read operations
	icdo := router.Group("/icdo")
	{
		icdo.GET("", handlers.SearchICDOMorphology) // Search ICD-O
	}
}
