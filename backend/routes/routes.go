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
			setupPPKRoutes(protected)

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

			// Nutrition/Gizi Management
			setupNutritionRoutes(protected)
			setupClinicalPackageRoutes(protected)
		}

		// Queue & Registration (mixed public/protected routes)
		SetupQueueRoutes(api)
		SetupRegistrationRoutes(api)
		SetupVisitRoutes(r)     // Visit routes
		SetupRoomQueueRoutes(r) // Room Queue routes

		// Building & Floor Plan Routes
		SetupBuildingRoutes(r)

		// Billing & Payment routes
		SetupBillingRoutes(api)

		// Inpatient Routes (CPPT, Fluid Balance)
		RegisterInpatientRoutes(api)

		// Admission Request Routes (Permintaan Rawat Inap)
		SetupAdmissionRequestRoutes(r)

		// ICD Routes (ICD-10, ICD-9-CM, ICD-O) - Public access for search
		SetupICDRoutes(api)

		// Integrations Routes (BPJS, SatuSehat, etc)
		IntegrationsRoutes(api)

		// KFA Routes (Kode Farmasi Indonesia for SatuSehat MedicationRequest)
		KFARoutes(api)

		// LOINC/SNOMED Routes (for SatuSehat ServiceRequest - Lab/Radiology)
		LoincRoutes(api)

		// Patient Allergy Routes (with SNOMED CT codes for SatuSehat AllergyIntolerance)
		SetupPatientAllergyRoutes(api)

		// BPJS Bridging Routes (legacy, for specific BPJS operations)
		SetupBPJSRoutes(api)

		// Archive Routes (Medical Record Archive Management)
		SetupArchiveRoutes(api)

		// Print PDF Routes (Medical Record Document Printing)
		SetupPrintRoutes(api)

		// Dashboard Routes (Statistics, Charts, Summary)
		SetupDashboardRoutes(api)

		// Report Routes (Comprehensive SIMRS Reporting System)
		SetupReportRoutes(api)

		// Quality Control & Cost Management Routes (Kendali Mutu & Biaya)
		SetupQualityCostRoutes(api)

		// E-Klaim Routes (iDRG & INACBG Grouping per 25 Kriteria KEMENKES)
		RegisterEKlaimRoutes(api)

		// Digital Signature Routes (PIN Management, Document Signing, Audit Logs)
		SetupSignatureRoutes(protected)

	}

	// Public Signature Verification (for external parties)
	SetupPublicSignatureRoutes(api)

	// Notification Routes (with SSE)
	SetupNotificationRoutes(r)

	// BPJS Webhook Routes (public endpoints that BPJS calls to RS)
	// These are outside /api group as they have their own auth mechanism
	SetupBPJSWebhookRoutes(r)

	// Patient Portal Routes (public access with patient authentication)
	// Allows patients to view their own medical records from home
	SetupPatientPortalRoutes(r)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
}
