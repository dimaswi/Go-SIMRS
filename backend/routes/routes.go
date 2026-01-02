package routes

import (
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes configures all application routes
func SetupRoutes(r *gin.Engine) {
	// API group
	api := r.Group("/api")
	{
		// Auth routes (public)
		setupAuthRoutes(api)

		// Settings (public read)
		setupPublicSettingsRoutes(api)

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// Settings (protected write)
			setupProtectedSettingsRoutes(protected)

			// User management
			setupUserRoutes(protected)
			setupRoleRoutes(protected)
			setupPermissionRoutes(protected)

			// Employee management
			setupEmployeeRoutes(protected)

			// Region management
			setupRegionRoutes(protected)

			// Master data
			setupMasterDataRoutes(protected)

			// Counter management
			setupCounterRoutes(protected)

			// Room management
			setupRoomRoutes(protected)

			// Procedure management
			setupProcedureRoutes(protected)

			// Patient management
			setupPatientRoutes(protected)

			// Inventory management
			setupInventoryRoutes(protected)

			// Medicine/Pharmacy management
			setupMedicineRoutes(protected)

			// Stock Request & Distribution
			setupStockRequestRoutes(protected)
			setupDistributionRoutes(protected)
			setupPurchaseRoutes(protected)
			setupStockOpnameRoutes(protected)
			setupSupplierRoutes(protected)

			// Room Stock Management
			setupRoomMedicineRoutes(protected)
			setupRoomInventoryRoutes(protected)

			// Medicine Order (Prescription) Management
			setupMedicineOrderRoutes(protected)

			// Procedure Order (Radiology & Laboratory) Management
			SetupProcedureOrderRoutes(protected)
		}

		// Queue & Registration (mixed public/protected routes)
		SetupQueueRoutes(api)
		SetupRegistrationRoutes(api)
		SetupVisitRoutes(r)     // Visit routes
		SetupRoomQueueRoutes(r) // Room Queue routes

		// Billing & Payment routes
		SetupBillingRoutes(api)

		// Inpatient Routes (CPPT, Fluid Balance)
		RegisterInpatientRoutes(api)

		// Admission Request Routes (Permintaan Rawat Inap)
		SetupAdmissionRequestRoutes(r)

		// ICD Routes (ICD-10, ICD-9-CM, ICD-O) - Public access for search
		SetupICDRoutes(api)
	}

	// Notification Routes (with SSE)
	SetupNotificationRoutes(r)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
}
