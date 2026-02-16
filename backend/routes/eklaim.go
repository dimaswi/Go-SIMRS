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

	// ==================== E-KLAIM LOCAL SERVER ====================
	// Fitur integrasi dengan E-Klaim local server (BPJS desktop app)
	// Navigasi: List SEP → Eklaim → Report → Log
	eklaimLocal := r.Group("/eklaim-local")
	eklaimLocal.Use(middleware.AuthMiddleware())
	{
		// Dashboard
		eklaimLocal.GET("/dashboard", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimDashboard)

		// Server connectivity
		eklaimLocal.GET("/ping", middleware.RequirePermission("eklaim.view"), handlers.PingEKlaimServer)

		// List SEP — daftar kunjungan yang sudah punya SEP
		eklaimLocal.GET("/list-sep", middleware.RequirePermission("eklaim.view"), handlers.GetListSEP)
		eklaimLocal.GET("/list-sep/:sepId", middleware.RequirePermission("eklaim.view"), handlers.GetSEPDetail)
		eklaimLocal.POST("/list-sep/:sepId/duplicate-rm", middleware.RequirePermission("eklaim.create"), handlers.DuplicateRM)
		eklaimLocal.POST("/list-sep/:sepId/create-claim", middleware.RequirePermission("eklaim.create"), handlers.CreateClaimFromSEP)

		// Eklaim — list & detail data eklaim local (setelah new_claim sukses)
		eklaimLocal.GET("", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimLocalList)
		eklaimLocal.GET("/:id", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimLocalDetail)

		// RM Duplicate editing
		eklaimLocal.POST("/:id/init-rm-duplicate", middleware.RequirePermission("eklaim.create"), handlers.InitRMDuplicate)
		eklaimLocal.PUT("/:id/rm-duplicate", middleware.RequirePermission("eklaim.edit"), handlers.UpdateRMDuplicate)
		eklaimLocal.POST("/:id/sync-rm-from-visit", middleware.RequirePermission("eklaim.edit"), handlers.SyncRMFromVisit)
		eklaimLocal.POST("/:id/sync-billing-tarif", middleware.RequirePermission("eklaim.edit"), handlers.SyncBillingTarif)

		// E-Klaim Local Server API calls
		eklaimLocal.POST("/:id/new-claim", middleware.RequirePermission("eklaim.create"), handlers.SendNewClaim)
		eklaimLocal.POST("/:id/update-patient", middleware.RequirePermission("eklaim.edit"), handlers.SendUpdatePatient)
		eklaimLocal.POST("/:id/set-claim-data", middleware.RequirePermission("eklaim.edit"), handlers.SendSetClaimData)
		eklaimLocal.POST("/:id/grouper", middleware.RequirePermission("eklaim.grouping"), handlers.SendGrouper)
		eklaimLocal.POST("/:id/final", middleware.RequirePermission("eklaim.final"), handlers.SendFinalClaim)
		eklaimLocal.POST("/:id/cancel", middleware.RequirePermission("eklaim.edit"), handlers.SendCancelClaim)
		eklaimLocal.DELETE("/:id/delete-claim", middleware.RequirePermission("eklaim.edit"), handlers.SendDeleteClaim)
		eklaimLocal.POST("/:id/reedit", middleware.RequirePermission("eklaim.edit"), handlers.SendReeditClaim)

		// Read-only from E-Klaim server
		eklaimLocal.GET("/:id/claim-data", middleware.RequirePermission("eklaim.view"), handlers.GetClaimData)
		eklaimLocal.GET("/:id/claim-print", middleware.RequirePermission("eklaim.view"), handlers.GetClaimPrint)

		// Search APIs — HARUS sebelum /:id routes untuk menghindari Gin route collision
		eklaimLocal.GET("/search/idrg-diagnosa", middleware.RequirePermission("eklaim.view"), handlers.SearchIDRGDiagnosa)
		eklaimLocal.GET("/search/idrg-procedure", middleware.RequirePermission("eklaim.view"), handlers.SearchIDRGProcedure)
		eklaimLocal.GET("/search/inacbg-diagnosa", middleware.RequirePermission("eklaim.view"), handlers.SearchINACBGDiagnosa)
		eklaimLocal.GET("/search/inacbg-procedure", middleware.RequirePermission("eklaim.view"), handlers.SearchINACBGProcedure)

		// Report — status klaim per periode
		eklaimLocal.GET("/claim-status", middleware.RequirePermission("eklaim.view"), handlers.GetClaimStatusList)

		// Defaults — config defaults for form auto-fill
		eklaimLocal.GET("/defaults", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimDefaults)

		// Global Logs — semua log komunikasi E-Klaim
		eklaimLocal.GET("/logs", middleware.RequirePermission("eklaim.view"), handlers.GetAllEKlaimLocalLogs)

		// Per-claim Logs
		eklaimLocal.GET("/:id/logs", middleware.RequirePermission("eklaim.view"), handlers.GetEKlaimLocalLogs)

		// === iDRG Flow ===
		eklaimLocal.POST("/:id/idrg-diagnosa", middleware.RequirePermission("eklaim.edit"), handlers.SendIDRGDiagnosaSet)
		eklaimLocal.GET("/:id/idrg-diagnosa", middleware.RequirePermission("eklaim.view"), handlers.GetIDRGDiagnosa)
		eklaimLocal.POST("/:id/idrg-procedure", middleware.RequirePermission("eklaim.edit"), handlers.SendIDRGProcedureSet)
		eklaimLocal.GET("/:id/idrg-procedure", middleware.RequirePermission("eklaim.view"), handlers.GetIDRGProcedure)
		eklaimLocal.POST("/:id/grouper-idrg", middleware.RequirePermission("eklaim.grouping"), handlers.SendGrouperIDRG)
		eklaimLocal.POST("/:id/final-idrg", middleware.RequirePermission("eklaim.final"), handlers.SendFinalIDRG)
		eklaimLocal.POST("/:id/reedit-idrg", middleware.RequirePermission("eklaim.edit"), handlers.SendReeditIDRG)

		// === INACBG Flow ===
		eklaimLocal.POST("/:id/import-inacbg", middleware.RequirePermission("eklaim.edit"), handlers.SendIDRGToINACBGImport)
		eklaimLocal.POST("/:id/inacbg-diagnosa", middleware.RequirePermission("eklaim.edit"), handlers.SendINACBGDiagnosaSet)
		eklaimLocal.GET("/:id/inacbg-diagnosa", middleware.RequirePermission("eklaim.view"), handlers.GetINACBGDiagnosa)
		eklaimLocal.POST("/:id/inacbg-procedure", middleware.RequirePermission("eklaim.edit"), handlers.SendINACBGProcedureSet)
		eklaimLocal.GET("/:id/inacbg-procedure", middleware.RequirePermission("eklaim.view"), handlers.GetINACBGProcedure)
		eklaimLocal.POST("/:id/grouper-inacbg-stage1", middleware.RequirePermission("eklaim.grouping"), handlers.SendGrouperINACBGStage1)
		eklaimLocal.POST("/:id/grouper-inacbg-stage2", middleware.RequirePermission("eklaim.grouping"), handlers.SendGrouperINACBGStage2)
		eklaimLocal.POST("/:id/final-inacbg", middleware.RequirePermission("eklaim.final"), handlers.SendFinalINACBG)
		eklaimLocal.POST("/:id/reedit-inacbg", middleware.RequirePermission("eklaim.edit"), handlers.SendReeditINACBG)

		// === Claim Send & Re-edit ===
		eklaimLocal.POST("/:id/send-claim", middleware.RequirePermission("eklaim.send"), handlers.SendClaimSend)
		eklaimLocal.POST("/:id/reedit-claim", middleware.RequirePermission("eklaim.edit"), handlers.SendClaimReeditLocal)
	}
}
