package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// SetupPatientPortalRoutes configures patient portal routes (public access)
func SetupPatientPortalRoutes(r *gin.Engine) {
	portal := r.Group("/api/patient-portal")
	{
		// Public endpoint - login
		portal.POST("/login", handlers.PatientPortalLogin)

		// Protected endpoints - require patient token
		protected := portal.Group("")
		protected.Use(handlers.PatientPortalAuthMiddleware())
		{
			// Profile
			protected.GET("/profile", handlers.PatientPortalGetProfile)

			// Visit history
			protected.GET("/visits", handlers.PatientPortalGetVisitHistory)

			// Available documents for a visit
			protected.GET("/available-docs/:visitId", handlers.PatientPortalGetAvailableDocs)

			// Medical resume for specific visit
			protected.GET("/visits/:visitId/resume", handlers.PatientPortalGetMedicalResume)

			// Allergies
			protected.GET("/allergies", handlers.PatientPortalGetAllergies)

			// Print/Download PDFs (validates patient ownership)
			print := protected.Group("/print")
			{
				// Visit-based documents
				print.GET("/outpatient-resume/:visitId", handlers.PatientPortalPrintOutpatientResume)
				print.GET("/inpatient-resume/:visitId", handlers.PatientPortalPrintInpatientResume)
				print.GET("/emergency-summary/:visitId", handlers.PatientPortalPrintEmergencySummary)
				print.GET("/cppt/:visitId", handlers.PatientPortalPrintCPPT)
				print.GET("/sick-letter/:visitId", handlers.PatientPortalPrintSickLetter)
				print.GET("/referral-letter/:visitId", handlers.PatientPortalPrintReferralLetter)
				print.GET("/inpatient-certificate/:visitId", handlers.PatientPortalPrintInpatientCertificate)
				print.GET("/triage-form/:visitId", handlers.PatientPortalPrintTriageForm)

				// Order-based documents (lab, radiology, prescription)
				print.GET("/lab-result/:orderId", handlers.PatientPortalPrintLabResult)
				print.GET("/radiology-result/:orderId", handlers.PatientPortalPrintRadiologyResult)
				print.GET("/prescription/:orderId", handlers.PatientPortalPrintPrescription)
			}
		}
	}
}
