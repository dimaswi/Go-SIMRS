package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupVisitRoutes(r *gin.Engine) {
	visits := r.Group("/api/visits")
	visits.Use(middleware.AuthMiddleware())
	{
		// Get all visits (with filters: registration_id, room_id, patient_id, visit_type, status, date range)
		visits.GET("", handlers.GetVisits)

		// Get specific visit
		visits.GET("/:id", handlers.GetVisit)

		// Create new visit (optionally creates room queue)
		visits.POST("", handlers.CreateVisit)

		// Update visit
		visits.PUT("/:id", handlers.UpdateVisit)

		// Accept patient for visit
		visits.PUT("/:id/accept", handlers.AcceptVisit)

		// Complete visit (finalize)
		visits.PUT("/:id/complete", handlers.CompleteVisit)

		// Cancel visit
		visits.POST("/:id/cancel", middleware.RequirePermission("visits.delete"), handlers.CancelVisit)

		// Cancel complete visit (revert finalization)
		visits.PUT("/:id/cancel-complete", handlers.CancelCompleteVisit)

		// Get visit statistics
		visits.GET("/stats/summary", handlers.GetVisitStats)

		// Medical record routes for a visit (separated tables)
		visits.GET("/:id/medical-record", handlers.GetMedicalRecordSummary)

		// Individual section endpoints
		visits.GET("/:id/triage", handlers.GetTriage)
		visits.POST("/:id/triage", handlers.SaveTriage)
		visits.PUT("/:id/triage", handlers.SaveTriage)

		visits.GET("/:id/anamnesis", handlers.GetAnamnesis)
		visits.POST("/:id/anamnesis", handlers.SaveAnamnesis)
		visits.PUT("/:id/anamnesis", handlers.SaveAnamnesis)

		visits.GET("/:id/physical-exam", handlers.GetPhysicalExam)
		visits.POST("/:id/physical-exam", handlers.SavePhysicalExam)
		visits.PUT("/:id/physical-exam", handlers.SavePhysicalExam)

		visits.GET("/:id/diagnosis", handlers.GetDiagnoses)
		visits.POST("/:id/diagnosis", handlers.SaveDiagnoses)
		visits.PUT("/:id/diagnosis", handlers.SaveDiagnoses)

		visits.GET("/:id/assessment-plan", handlers.GetAssessmentPlan)
		visits.POST("/:id/assessment-plan", handlers.SaveAssessmentPlan)
		visits.PUT("/:id/assessment-plan", handlers.SaveAssessmentPlan)

		visits.GET("/:id/disposition", handlers.GetDisposition)
		visits.POST("/:id/disposition", handlers.SaveDisposition)
		visits.PUT("/:id/disposition", handlers.SaveDisposition)
		visits.DELETE("/:id/disposition", middleware.RequirePermission("visits.delete"), handlers.CancelDisposition)
		visits.DELETE("/:id/follow-up-registration", middleware.RequirePermission("visits.delete"), handlers.CancelFollowUpRegistration)
		visits.GET("/:id/pending-orders", handlers.CheckPendingOrders)

		// Consultation - untuk visit konsultasi
		visits.GET("/:id/consultation", handlers.GetConsultation)
		visits.POST("/:id/consultation", handlers.SaveConsultation)

		// Sick Letter - Surat Keterangan Sakit
		visits.GET("/:id/sick-letter", handlers.GetSickLetter)
		visits.GET("/:id/sick-letters", handlers.GetSickLetters)
		visits.POST("/:id/sick-letter", handlers.SaveSickLetter)
		visits.PUT("/:id/sick-letter", handlers.SaveSickLetter)
		visits.DELETE("/:id/sick-letter/:letterId", handlers.DeleteSickLetter)

		// Death Certificate - Surat Kematian
		visits.GET("/:id/death-certificate", handlers.GetDeathCertificate)
		visits.GET("/:id/death-certificates", handlers.GetDeathCertificates)
		visits.POST("/:id/death-certificate", handlers.SaveDeathCertificate)
		visits.PUT("/:id/death-certificate", handlers.SaveDeathCertificate)
		visits.DELETE("/:id/death-certificate/:certId", handlers.DeleteDeathCertificate)

		// Health Certificate - Surat Keterangan Sehat
		visits.GET("/:id/health-certificates", handlers.GetHealthCertificates)
		visits.POST("/:id/health-certificate", handlers.SaveHealthCertificate)
		visits.PUT("/:id/health-certificate", handlers.SaveHealthCertificate)
		visits.DELETE("/:id/health-certificate/:certId", handlers.DeleteHealthCertificate)

		// Birth Certificate - Surat Keterangan Kelahiran
		visits.GET("/:id/birth-certificates", handlers.GetBirthCertificates)
		visits.POST("/:id/birth-certificate", handlers.SaveBirthCertificate)
		visits.PUT("/:id/birth-certificate", handlers.SaveBirthCertificate)
		visits.DELETE("/:id/birth-certificate/:certId", handlers.DeleteBirthCertificate)

		// Leave Certificate - Surat Keterangan Cuti
		visits.GET("/:id/leave-certificates", handlers.GetLeaveCertificates)
		visits.POST("/:id/leave-certificate", handlers.SaveLeaveCertificate)
		visits.PUT("/:id/leave-certificate", handlers.SaveLeaveCertificate)
		visits.DELETE("/:id/leave-certificate/:certId", handlers.DeleteLeaveCertificate)

		// MCU Certificate - Medical Check-Up
		visits.GET("/:id/mcu-certificates", handlers.GetMCUCertificates)
		visits.POST("/:id/mcu-certificate", handlers.SaveMCUCertificate)
		visits.PUT("/:id/mcu-certificate", handlers.SaveMCUCertificate)
		visits.DELETE("/:id/mcu-certificate/:certId", handlers.DeleteMCUCertificate)

		// Medical Record Edit Logs - Log Edit RM setelah pasien pulang
		visits.GET("/:id/edit-logs", handlers.GetMedicalRecordEditLogs)
		visits.POST("/:id/edit-logs", handlers.CreateMedicalRecordEditLog)

		// Visit Procedures - Tindakan yang dilakukan langsung di ruangan
		visits.GET("/:id/room-procedures", handlers.GetRoomProceduresForVisit)                 // Daftar tindakan tersedia di ruangan
		visits.GET("/:id/procedures", handlers.GetVisitProcedures)                             // Daftar tindakan yang sudah dilakukan
		visits.GET("/:id/procedures/:procedureId", handlers.GetVisitProcedure)                 // Detail tindakan
		visits.POST("/:id/procedures", handlers.CreateVisitProcedure)                          // Tambah tindakan baru
		visits.PUT("/:id/procedures/:procedureId", handlers.SaveVisitProcedureResults)         // Simpan hasil tindakan
		visits.PUT("/:id/procedures/:procedureId/status", handlers.UpdateVisitProcedureStatus) // Update status
		visits.DELETE("/:id/procedures/:procedureId", handlers.DeleteVisitProcedure)           // Hapus tindakan
	}
}
