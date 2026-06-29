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
		visits.GET("", middleware.RequirePermission("visits.view"), handlers.GetVisits)

		// Get specific visit
		visits.GET("/:id", middleware.RequireAnyPermission("visits.view", "medical_records.view"), handlers.GetVisit)

		// Create new visit (optionally creates room queue)
		visits.POST("", middleware.RequirePermission("visits.create"), handlers.CreateVisit)

		// Update visit
		visits.PUT("/:id", middleware.RequirePermission("visits.update"), handlers.UpdateVisit)

		// Accept patient for visit
		visits.PUT("/:id/accept", middleware.RequirePermission("visits.update"), handlers.AcceptVisit)

		// Complete visit (finalize)
		visits.PUT("/:id/complete", middleware.RequirePermission("visits.update"), handlers.CompleteVisit)

		// Cancel visit
		visits.POST("/:id/cancel", middleware.RequirePermission("visits.delete"), handlers.CancelVisit)

		// Cancel complete visit (revert finalization)
		visits.PUT("/:id/cancel-complete", middleware.RequirePermission("visits.update"), handlers.CancelCompleteVisit)

		// Get visit statistics
		visits.GET("/stats/summary", middleware.RequirePermission("visits.stats"), handlers.GetVisitStats)

		// Medical record routes for a visit (separated tables)
		visits.GET("/:id/medical-record", middleware.RequirePermission("medical_records.view"), handlers.GetMedicalRecordSummary)

		// Individual section endpoints
		visits.GET("/:id/triage", middleware.RequirePermission("medical_records.view"), handlers.GetTriage)
		visits.POST("/:id/triage", middleware.RequirePermission("medical_records.triage"), handlers.SaveTriage)
		visits.PUT("/:id/triage", middleware.RequirePermission("medical_records.triage"), handlers.SaveTriage)

		visits.GET("/:id/anamnesis", middleware.RequirePermission("medical_records.view"), handlers.GetAnamnesis)
		visits.POST("/:id/anamnesis", middleware.RequirePermission("medical_records.anamnesis"), handlers.SaveAnamnesis)
		visits.PUT("/:id/anamnesis", middleware.RequirePermission("medical_records.anamnesis"), handlers.SaveAnamnesis)

		visits.GET("/:id/physical-exam", middleware.RequirePermission("medical_records.view"), handlers.GetPhysicalExam)
		visits.POST("/:id/physical-exam", middleware.RequirePermission("medical_records.physical_exam"), handlers.SavePhysicalExam)
		visits.PUT("/:id/physical-exam", middleware.RequirePermission("medical_records.physical_exam"), handlers.SavePhysicalExam)

		visits.GET("/:id/bersalin", middleware.RequirePermission("medical_records.view"), handlers.GetBersalinRecord)
		visits.POST("/:id/bersalin", middleware.RequirePermission("medical_records.physical_exam"), handlers.SaveBersalinRecord)
		visits.PUT("/:id/bersalin", middleware.RequirePermission("medical_records.physical_exam"), handlers.SaveBersalinRecord)

		visits.GET("/:id/diagnosis", middleware.RequirePermission("medical_records.view"), handlers.GetDiagnoses)
		visits.POST("/:id/diagnosis", middleware.RequirePermission("medical_records.diagnosis"), handlers.SaveDiagnoses)
		visits.PUT("/:id/diagnosis", middleware.RequirePermission("medical_records.diagnosis"), handlers.SaveDiagnoses)

		visits.GET("/:id/assessment-plan", middleware.RequirePermission("medical_records.view"), handlers.GetAssessmentPlan)
		visits.POST("/:id/assessment-plan", middleware.RequirePermission("medical_records.assessment_plan"), handlers.SaveAssessmentPlan)
		visits.PUT("/:id/assessment-plan", middleware.RequirePermission("medical_records.assessment_plan"), handlers.SaveAssessmentPlan)

		visits.GET("/:id/disposition", middleware.RequirePermission("medical_records.view"), handlers.GetDisposition)
		visits.POST("/:id/disposition", middleware.RequirePermission("medical_records.disposition"), handlers.SaveDisposition)
		visits.PUT("/:id/disposition", middleware.RequirePermission("medical_records.disposition"), handlers.SaveDisposition)
		visits.GET("/:id/discharge-planning", middleware.RequirePermission("medical_records.view"), handlers.GetDischargePlanning)
		visits.POST("/:id/discharge-planning", middleware.RequirePermission("medical_records.disposition"), handlers.SaveDischargePlanning)
		visits.PUT("/:id/discharge-planning", middleware.RequirePermission("medical_records.disposition"), handlers.SaveDischargePlanning)
		visits.GET("/:id/body-markers", middleware.RequirePermission("medical_records.view"), handlers.GetBodyMarkers)
		visits.POST("/:id/body-markers", middleware.RequirePermission("medical_records.physical_exam"), handlers.SaveBodyMarkers)
		visits.PUT("/:id/body-markers", middleware.RequirePermission("medical_records.physical_exam"), handlers.SaveBodyMarkers)
		visits.DELETE("/:id/disposition", middleware.RequirePermission("visits.delete"), handlers.CancelDisposition)
		visits.DELETE("/:id/follow-up-registration", middleware.RequirePermission("visits.delete"), handlers.CancelFollowUpRegistration)
		visits.GET("/:id/pending-orders", handlers.CheckPendingOrders)

		// Consultation - untuk visit konsultasi
		visits.GET("/:id/consultation", middleware.RequirePermission("medical_records.view"), handlers.GetConsultation)
		visits.POST("/:id/consultation", middleware.RequirePermission("medical_records.consultation_order"), handlers.SaveConsultation)

		// Sick Letter - Surat Keterangan Sakit
		visits.GET("/:id/sick-letter", middleware.RequirePermission("medical_records.view"), handlers.GetSickLetter)
		visits.GET("/:id/sick-letters", middleware.RequirePermission("medical_records.view"), handlers.GetSickLetters)
		visits.POST("/:id/sick-letter", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveSickLetter)
		visits.PUT("/:id/sick-letter", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveSickLetter)
		visits.DELETE("/:id/sick-letter/:letterId", middleware.RequirePermission("medical_records.sick_letter"), handlers.DeleteSickLetter)

		// Death Certificate - Surat Kematian
		visits.GET("/:id/death-certificate", middleware.RequirePermission("medical_records.view"), handlers.GetDeathCertificate)
		visits.GET("/:id/death-certificates", middleware.RequirePermission("medical_records.view"), handlers.GetDeathCertificates)
		visits.POST("/:id/death-certificate", middleware.RequirePermission("medical_records.death_certificate"), handlers.SaveDeathCertificate)
		visits.PUT("/:id/death-certificate", middleware.RequirePermission("medical_records.death_certificate"), handlers.SaveDeathCertificate)
		visits.DELETE("/:id/death-certificate/:certId", middleware.RequirePermission("medical_records.death_certificate"), handlers.DeleteDeathCertificate)

		// Health Certificate - Surat Keterangan Sehat
		visits.GET("/:id/health-certificates", middleware.RequirePermission("medical_records.view"), handlers.GetHealthCertificates)
		visits.POST("/:id/health-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveHealthCertificate)
		visits.PUT("/:id/health-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveHealthCertificate)
		visits.DELETE("/:id/health-certificate/:certId", middleware.RequirePermission("medical_records.sick_letter"), handlers.DeleteHealthCertificate)

		// Birth Certificate - Surat Keterangan Kelahiran
		visits.GET("/:id/birth-certificates", middleware.RequirePermission("medical_records.view"), handlers.GetBirthCertificates)
		visits.POST("/:id/birth-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveBirthCertificate)
		visits.PUT("/:id/birth-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveBirthCertificate)
		visits.DELETE("/:id/birth-certificate/:certId", middleware.RequirePermission("medical_records.sick_letter"), handlers.DeleteBirthCertificate)

		// Leave Certificate - Surat Keterangan Cuti
		visits.GET("/:id/leave-certificates", middleware.RequirePermission("medical_records.view"), handlers.GetLeaveCertificates)
		visits.POST("/:id/leave-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveLeaveCertificate)
		visits.PUT("/:id/leave-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveLeaveCertificate)
		visits.DELETE("/:id/leave-certificate/:certId", middleware.RequirePermission("medical_records.sick_letter"), handlers.DeleteLeaveCertificate)

		// MCU Certificate - Medical Check-Up
		visits.GET("/:id/mcu-certificates", middleware.RequirePermission("medical_records.view"), handlers.GetMCUCertificates)
		visits.POST("/:id/mcu-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveMCUCertificate)
		visits.PUT("/:id/mcu-certificate", middleware.RequirePermission("medical_records.sick_letter"), handlers.SaveMCUCertificate)
		visits.DELETE("/:id/mcu-certificate/:certId", middleware.RequirePermission("medical_records.sick_letter"), handlers.DeleteMCUCertificate)

		// Medical Record Edit Logs - Log Edit RM setelah pasien pulang
		visits.GET("/:id/edit-logs", middleware.RequirePermission("medical_records.view"), handlers.GetMedicalRecordEditLogs)
		visits.POST("/:id/edit-logs", middleware.RequirePermission("medical_records.view"), handlers.CreateMedicalRecordEditLog)

		// Visit Procedures - Tindakan yang dilakukan langsung di ruangan
		visits.GET("/:id/room-procedures", middleware.RequirePermission("medical_records.view"), handlers.GetRoomProceduresForVisit)                 // Daftar tindakan tersedia di ruangan
		visits.GET("/:id/procedures", middleware.RequirePermission("medical_records.view"), handlers.GetVisitProcedures)                             // Daftar tindakan yang sudah dilakukan
		visits.GET("/:id/procedures/:procedureId", middleware.RequirePermission("medical_records.view"), handlers.GetVisitProcedure)                 // Detail tindakan
		visits.POST("/:id/procedures", middleware.RequirePermission("medical_records.procedure"), handlers.CreateVisitProcedure)                          // Tambah tindakan baru
		visits.PUT("/:id/procedures/:procedureId", middleware.RequirePermission("medical_records.procedure"), handlers.SaveVisitProcedureResults)         // Simpan hasil tindakan
		visits.PUT("/:id/procedures/:procedureId/status", middleware.RequirePermission("medical_records.procedure"), handlers.UpdateVisitProcedureStatus) // Update status
		visits.DELETE("/:id/procedures/:procedureId", middleware.RequirePermission("medical_records.procedure"), handlers.DeleteVisitProcedure)           // Hapus tindakan
	}
}
