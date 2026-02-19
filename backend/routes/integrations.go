package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// IntegrationsRoutes registers integration-related routes
func IntegrationsRoutes(r *gin.RouterGroup) {
	integrations := r.Group("/integrations")
	integrations.Use(middleware.AuthMiddleware())
	{
		// Get list of all available integrations
		integrations.GET("", middleware.RequirePermission("integrations.view"), handlers.GetAllIntegrations)

		// General sync logs (all integrations)
		integrations.GET("/sync-logs", middleware.RequirePermission("integrations.view"), handlers.GetAllSyncLogs)

		// Integration-specific routes
		integration := integrations.Group("/:type")
		{
			// Config management
			integration.GET("/config", middleware.RequirePermission("integrations.view"), handlers.GetIntegrationConfig)
			integration.POST("/config/init", middleware.RequirePermission("integrations.manage"), handlers.InitIntegrationConfig)
			integration.POST("/config/reset", middleware.RequirePermission("integrations.manage"), handlers.ResetIntegrationConfig)
			integration.PUT("/config", middleware.RequirePermission("integrations.manage"), handlers.UpdateIntegrationConfig)

			// Connection testing
			integration.POST("/test", middleware.RequirePermission("integrations.view"), handlers.TestIntegrationConnection)

			// Logs and statistics
			integration.GET("/logs", middleware.RequirePermission("integrations.view"), handlers.GetIntegrationLogs)
			integration.GET("/stats", middleware.RequirePermission("integrations.view"), handlers.GetIntegrationStats)
		}

		// SatuSehat specific routes
		satusehat := integrations.Group("/satusehat")
		{
			// Get organization info
			satusehat.GET("/organization", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatOrganization)

			// Search patient by NIK
			satusehat.GET("/patient", middleware.RequirePermission("integrations.view"), handlers.SearchSatuSehatPatient)

			// Search practitioner by NIK
			satusehat.GET("/practitioner", middleware.RequirePermission("integrations.view"), handlers.SearchSatuSehatPractitioner)

			// Get encounters (visits)
			satusehat.GET("/encounters", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatEncounters)

			// Get conditions (diagnoses)
			satusehat.GET("/conditions", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatConditions)

			// Get observations
			satusehat.GET("/observations", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatObservations)

			// Get medication requests
			satusehat.GET("/medications", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatMedicationRequests)

			// Get history data
			satusehat.GET("/history", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatHistory)

			// Get readiness status
			satusehat.GET("/readiness", middleware.RequirePermission("integrations.view"), handlers.GetSatuSehatReadiness)

			// Lookup IHS Number for patient
			satusehat.POST("/patient/:id/lookup", middleware.RequirePermission("integrations.manage"), handlers.LookupPatientIHS)

			// Lookup IHS Number for practitioner
			satusehat.POST("/practitioner/:id/lookup", middleware.RequirePermission("integrations.manage"), handlers.LookupPractitionerIHS)

			// Send location to SatuSehat
			satusehat.POST("/location/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendLocationToSatuSehat)

			// Send encounter to SatuSehat (legacy - without diagnosis)
			satusehat.POST("/encounter/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendEncounterToSatuSehat)

			// Send encounter with diagnosis to SatuSehat (new - complete flow)
			satusehat.POST("/encounter/:id/send-with-diagnosis", middleware.RequirePermission("integrations.manage"), handlers.SendEncounterWithDiagnosisToSatuSehat)

			// Preview FHIR data before sending
			satusehat.GET("/encounter/:id/preview", middleware.RequirePermission("integrations.view"), handlers.PreviewEncounterFHIR)

			// Get comprehensive SatuSehat sync status for encounter
			satusehat.GET("/encounter/:id/status", middleware.RequirePermission("integrations.view"), handlers.GetEncounterSatuSehatStatus)

			// Send individual condition (diagnosis) to SatuSehat
			satusehat.POST("/condition/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendConditionToSatuSehat)

			// Get visit diagnoses with SatuSehat status
			satusehat.GET("/visit/:id/diagnoses", middleware.RequirePermission("integrations.view"), handlers.GetVisitDiagnoses)

			// Send vital signs (observations) to SatuSehat
			satusehat.POST("/visit/:id/send-vital-signs", middleware.RequirePermission("integrations.manage"), handlers.SendVitalSignsToSatuSehat)

			// Send procedure to SatuSehat
			satusehat.POST("/procedure/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendProcedureToSatuSehat)

			// Send medication request to SatuSehat
			satusehat.POST("/medication/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendMedicationRequestToSatuSehat)

			// Send medication dispense to SatuSehat
			satusehat.POST("/medication-dispense/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendMedicationDispenseToSatuSehat)

			// Send all medication dispenses for an order
			satusehat.POST("/order/:id/send-dispenses", middleware.RequirePermission("integrations.manage"), handlers.SendAllMedicationDispensesToSatuSehat)

			// Send questionnaire response (pengkajian resep) to SatuSehat
			satusehat.POST("/medicine-order/:medicine_order_id/questionnaire-response", middleware.RequirePermission("integrations.manage"), handlers.SendQuestionnaireResponseToSatuSehat)

			// Send medication administration to SatuSehat
			satusehat.POST("/medicine-order-item/:item_id/administration", middleware.RequirePermission("integrations.manage"), handlers.SendMedicationAdministrationToSatuSehat)

			// Send composition (resume medis) to SatuSehat
			satusehat.POST("/composition/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendCompositionToSatuSehat)

			// Send clinical impression to SatuSehat
			// type: history (Riwayat Perjalanan Penyakit), rationale (Rasional Klinis), prognosis (Prognosis), triage (Asesmen Triage)
			satusehat.POST("/clinical-impression/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendClinicalImpressionToSatuSehat)

			// Get clinical impression status for a visit
			satusehat.GET("/clinical-impression/:id/status", middleware.RequirePermission("integrations.view"), handlers.GetClinicalImpressionStatus)

			// Send allergy intolerance to SatuSehat
			satusehat.POST("/allergy/:id/send", middleware.RequirePermission("integrations.manage"), handlers.SendAllergyIntoleranceToSatuSehat)

			// Send all patient allergies for a visit to SatuSehat
			satusehat.POST("/visit/:id/send-allergies", middleware.RequirePermission("integrations.manage"), handlers.SendVisitAllergiesToSatuSehat)

			// Get allergy status for a patient
			satusehat.GET("/patient/:patient_id/allergies/status", middleware.RequirePermission("integrations.view"), handlers.GetPatientAllergyStatusForSatuSehat)

			// ============================================================================
			// Lab/Radiology Resources (ServiceRequest, Specimen, DiagnosticReport)
			// For VisitProcedure (procedures done directly at visit room)
			// ============================================================================

			// Send ServiceRequest to SatuSehat
			satusehat.POST("/servicerequest/:visitProcedureId/send", middleware.RequirePermission("integrations.manage"), handlers.SendServiceRequestToSatuSehat)

			// Send Specimen to SatuSehat
			satusehat.POST("/specimen/:visitProcedureId/send", middleware.RequirePermission("integrations.manage"), handlers.SendSpecimenToSatuSehat)

			// Send DiagnosticReport to SatuSehat
			satusehat.POST("/diagnosticreport/:visitProcedureId/send", middleware.RequirePermission("integrations.manage"), handlers.SendDiagnosticReportToSatuSehat)

			// Get Lab resource status for a visit procedure
			satusehat.GET("/lab/:visitProcedureId/status", middleware.RequirePermission("integrations.view"), handlers.GetLabResourceStatus)

			// Send all lab resources in sequence (ServiceRequest -> Specimen -> Observations -> DiagnosticReport)
			satusehat.POST("/lab/:visitProcedureId/send-all", middleware.RequirePermission("integrations.manage"), handlers.SendAllLabResourcesToSatuSehat)

			// ============================================================================
			// Lab/Radiology Resources for ProcedureOrder System
			// For orders sent to Lab/Radiology departments
			// ============================================================================

			// Send ServiceRequest from ProcedureOrderItem
			satusehat.POST("/servicerequest-order/:orderItemId/send", middleware.RequirePermission("integrations.manage"), handlers.SendServiceRequestFromOrder)

			// Send Specimen from ProcedureOrderItem
			satusehat.POST("/specimen-order/:orderItemId/send", middleware.RequirePermission("integrations.manage"), handlers.SendSpecimenFromOrder)

			// Send DiagnosticReport from ProcedureOrderItem
			satusehat.POST("/diagnosticreport-order/:orderItemId/send", middleware.RequirePermission("integrations.manage"), handlers.SendDiagnosticReportFromOrder)

			// Get Lab resource status for ProcedureOrderItem
			satusehat.GET("/lab-order/:orderItemId/status", middleware.RequirePermission("integrations.view"), handlers.GetLabResourceStatusFromOrder)

			// Send all lab resources in sequence from ProcedureOrderItem
			satusehat.POST("/lab-order/:orderItemId/send-all", middleware.RequirePermission("integrations.manage"), handlers.SendAllLabResourcesFromOrder)

			// ============================================================================
			// MedicationStatement - Riwayat Pengobatan
			// ============================================================================

			// Send MedicationStatement from Anamnesis (current medications)
			satusehat.POST("/medicationstatement/:anamnesisId/send", middleware.RequirePermission("integrations.manage"), handlers.SendMedicationStatementFromAnamnesis)

			// Get MedicationStatement monitoring data
			satusehat.GET("/monitoring/medicationstatement", middleware.RequirePermission("integrations.view"), handlers.GetMedicationStatementMonitoring)

			// ============================================================================
			// CarePlan - Rencana Rawat / Instruksi
			// ============================================================================

			// Send CarePlan from CPPT (Plan + Instruction) - untuk Rawat Inap
			satusehat.POST("/careplan/cppt/:cpptId/send", middleware.RequirePermission("integrations.manage"), handlers.SendCarePlanFromCPPT)

			// Send CarePlan from Disposition (Follow-up plan / RTL) - untuk semua tipe
			satusehat.POST("/careplan/disposition/:dispositionId/send", middleware.RequirePermission("integrations.manage"), handlers.SendCarePlanFromDisposition)

			// Send CarePlan from AssessmentPlan (Treatment plan) - untuk Rawat Jalan/IGD
			satusehat.POST("/careplan/assessment/:assessmentPlanId/send", middleware.RequirePermission("integrations.manage"), handlers.SendCarePlanFromAssessmentPlan)

			// Get CarePlan monitoring data
			satusehat.GET("/monitoring/careplan", middleware.RequirePermission("integrations.view"), handlers.GetCarePlanMonitoring)
		}
	}
}
