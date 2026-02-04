package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupArchiveRoutes configures routes for medical record archive management
func SetupArchiveRoutes(rg *gin.RouterGroup) {
	archives := rg.Group("/archives")
	archives.Use(middleware.AuthMiddleware())
	{
		// Archive CRUD
		archives.GET("", middleware.RequirePermission("archives.view"), handlers.GetArchives)
		archives.GET("/statistics", middleware.RequirePermission("archives.view"), handlers.GetArchiveStatistics)
		archives.GET("/borrowed", middleware.RequirePermission("archives.view"), handlers.GetBorrowedArchives)
		archives.GET("/:id", middleware.RequirePermission("archives.view"), handlers.GetArchiveByID)
		archives.GET("/patient/:patient_id", middleware.RequirePermission("archives.view"), handlers.GetArchiveByPatient)
		archives.POST("", middleware.RequirePermission("archives.manage"), handlers.CreateOrUpdateArchive)
		archives.POST("/sync", middleware.RequirePermission("archives.manage"), handlers.SyncArchiveFromVisits)

		// Location management
		archives.PUT("/:id/location", middleware.RequirePermission("archives.manage"), handlers.UpdateArchiveLocation)

		// Borrowing workflow
		archives.POST("/:id/borrow", middleware.RequirePermission("archives.borrow"), handlers.BorrowArchive)
		archives.POST("/:id/return", middleware.RequirePermission("archives.borrow"), handlers.ReturnArchive)
		archives.GET("/:id/movements", middleware.RequirePermission("archives.view"), handlers.GetArchiveMovements)
	}

	// Archive Destruction (requires higher permission)
	destructions := rg.Group("/archive-destructions")
	destructions.Use(middleware.AuthMiddleware())
	{
		destructions.GET("", middleware.RequirePermission("archives.destruction"), handlers.GetDestructions)
		destructions.GET("/:id/items", middleware.RequirePermission("archives.destruction"), handlers.GetDestructionItems)
		destructions.POST("/propose", middleware.RequirePermission("archives.destruction"), handlers.ProposeDestruction)
		destructions.POST("/:id/approve", middleware.RequirePermission("archives.destruction.approve"), handlers.ApproveDestruction)
		destructions.POST("/:id/execute", middleware.RequirePermission("archives.destruction.execute"), handlers.ExecuteDestruction)
	}
}
