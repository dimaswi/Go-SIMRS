package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupBPJSRoutes configures all BPJS-related routes
func SetupBPJSRoutes(api *gin.RouterGroup) {
	bpjs := api.Group("/bpjs")
	{
		// Protected routes - require authentication
		bpjs.Use(middleware.AuthMiddleware())

		// Config routes (admin only)
		config := bpjs.Group("/config")
		config.Use(middleware.RequirePermission("integrations.view"))
		{
			config.GET("", handlers.GetBPJSConfig)
			config.PUT("", handlers.UpdateBPJSConfig)
			config.POST("/init", handlers.InitBPJSConfig)
		}

		// Test connection
		bpjs.GET("/test-connection", middleware.RequirePermission("integrations.view"), handlers.TestBPJSConnection)

		// API Tester (like Postman)
		bpjs.POST("/api-test", middleware.RequirePermission("integrations.view"), handlers.BPJSAPITester)

		// Referensi BPJS Antrian Online
		referensi := bpjs.Group("/referensi")
		referensi.Use(middleware.RequirePermission("integrations.view"))
		{
			referensi.GET("/poli", handlers.GetBPJSReferensiPoli)
			referensi.GET("/dokter", handlers.GetBPJSReferensiDokter)
			referensi.GET("/jadwal-dokter", handlers.GetBPJSJadwalDokter)
			referensi.POST("/jadwal-dokter", handlers.UpdateBPJSJadwalDokter)
		}

		// Sync logs
		logs := bpjs.Group("/logs")
		logs.Use(middleware.RequirePermission("integrations.view"))
		{
			logs.GET("", handlers.GetBPJSSyncLogs)
			logs.GET("/stats", handlers.GetBPJSSyncStats)
		}

		// Poli mapping
		mapping := bpjs.Group("/mapping")
		mapping.Use(middleware.RequirePermission("integrations.view"))
		{
			// Poli mapping
			mapping.GET("/poli", handlers.GetBPJSPoliMappings)
			mapping.POST("/poli", middleware.RequirePermission("integrations.manage"), handlers.CreateBPJSPoliMapping)
			mapping.PUT("/poli/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateBPJSPoliMapping)
			mapping.DELETE("/poli/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteBPJSPoliMapping)

			// Doctor mapping
			mapping.GET("/dokter", handlers.GetBPJSDoctorMappings)
			mapping.POST("/dokter", middleware.RequirePermission("integrations.manage"), handlers.CreateBPJSDoctorMapping)
			mapping.PUT("/dokter/:id", middleware.RequirePermission("integrations.manage"), handlers.UpdateBPJSDoctorMapping)
			mapping.DELETE("/dokter/:id", middleware.RequirePermission("integrations.manage"), handlers.DeleteBPJSDoctorMapping)
			mapping.POST("/dokter/sync", middleware.RequirePermission("integrations.manage"), handlers.SyncBPJSDoctorFromReferensi)
		}
	}
}
