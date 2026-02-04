package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterEKlaimRoutes registers all E-Klaim related routes
func RegisterEKlaimRoutes(r *gin.RouterGroup) {
	eklaim := r.Group("/eklaim")
	eklaim.Use(middleware.AuthMiddleware())
	{
		// CRUD Operations
		eklaim.GET("", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaims)
		eklaim.GET("/:id", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaim)
		eklaim.POST("", middleware.RequirePermission("eklaim.create"), handlers.CreateEKlaim)
		eklaim.PUT("/:id", middleware.RequirePermission("eklaim.edit"), handlers.UpdateEKlaim)

		// Diagnosis Management
		eklaim.POST("/:id/diagnosis", middleware.RequirePermission("eklaim.edit"), handlers.AddEKlaimDiagnosis)
		eklaim.DELETE("/:id/diagnosis/:diagnosisId", middleware.RequirePermission("eklaim.edit"), handlers.RemoveEKlaimDiagnosis)

		// Procedure Management
		eklaim.POST("/:id/procedure", middleware.RequirePermission("eklaim.edit"), handlers.AddEKlaimProcedure)
		eklaim.DELETE("/:id/procedure/:procedureId", middleware.RequirePermission("eklaim.edit"), handlers.RemoveEKlaimProcedure)

		// iDRG Flow (Sesuai 25 Kriteria KEMENKES)
		eklaim.POST("/:id/grouping-idrg", middleware.RequirePermission("eklaim.grouping"), handlers.GroupingIDRG)
		eklaim.POST("/:id/final-idrg", middleware.RequirePermission("eklaim.final"), handlers.FinalIDRG)
		eklaim.POST("/:id/edit-idrg", middleware.RequirePermission("eklaim.edit"), handlers.EditIDRG)

		// INACBG Flow
		eklaim.POST("/:id/import-inacbg", middleware.RequirePermission("eklaim.edit"), handlers.ImportToINACBG)
		eklaim.POST("/:id/grouping-inacbg", middleware.RequirePermission("eklaim.grouping"), handlers.GroupingINACBG)
		eklaim.POST("/:id/final-inacbg", middleware.RequirePermission("eklaim.final"), handlers.FinalINACBG)
		eklaim.POST("/:id/edit-inacbg", middleware.RequirePermission("eklaim.edit"), handlers.EditINACBG)

		// Final Claim & Send
		eklaim.POST("/:id/final-claim", middleware.RequirePermission("eklaim.final"), handlers.FinalClaim)
		eklaim.POST("/:id/send-claim", middleware.RequirePermission("eklaim.send"), handlers.SendClaim)

		// Logs
		eklaim.GET("/:id/logs", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimLogs)
	}
}
