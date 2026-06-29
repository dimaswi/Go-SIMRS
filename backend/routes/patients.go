package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupPatientRoutes(rg *gin.RouterGroup) {
	// Patient list and CRUD
	rg.GET("/patients", middleware.RequirePermission("patients.view"), handlers.GetPatients)
	rg.GET("/patients/search", middleware.RequireAnyPermission("patients.view", "visits.view", "registrations.view", "medical_records.view"), handlers.SearchPatients)
	rg.GET("/patients/stats", middleware.RequirePermission("patients.view"), handlers.GetPatientStats)
	rg.GET("/patients/by-rm/:no_rm", middleware.RequireAnyPermission("patients.view", "visits.view", "registrations.view", "medical_records.view"), handlers.GetPatientByNoRM)
	rg.GET("/patients/:id", middleware.RequireAnyPermission("patients.view", "visits.view", "registrations.view", "medical_records.view"), handlers.GetPatient)
	rg.POST("/patients", middleware.RequirePermission("patients.create"), handlers.CreatePatient)
	rg.PUT("/patients/:id", middleware.RequirePermission("patients.update"), handlers.UpdatePatient)
	rg.DELETE("/patients/:id", middleware.RequirePermission("patients.delete"), handlers.DeletePatient)

	// Patient status and photo
	rg.PATCH("/patients/:id/status", middleware.RequirePermission("patients.update"), handlers.UpdatePatientStatus)
	rg.PATCH("/patients/:id/last-visit", middleware.RequirePermission("patients.update"), handlers.UpdatePatientLastVisit)
	rg.POST("/patients/:id/photo", middleware.RequirePermission("patients.update"), handlers.UploadPatientPhoto)

	// Patient finalization
	rg.POST("/patients/:id/finalize", middleware.RequirePermission("patients.finalize"), handlers.FinalizePatient)
	rg.POST("/patients/:id/unfinalize", middleware.RequirePermission("patients.finalize"), handlers.UnfinalizePatient)

	// Reference data
	rg.GET("/patient-statuses", handlers.GetPatientStatuses)
	rg.GET("/blood-types", handlers.GetBloodTypes)
	rg.GET("/rhesus-types", handlers.GetRhesusTypes)
	rg.GET("/insurance-types", handlers.GetInsuranceTypes)
}
