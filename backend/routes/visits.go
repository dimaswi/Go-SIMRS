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
		visits.GET("/:id/pending-orders", handlers.CheckPendingOrders)

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
