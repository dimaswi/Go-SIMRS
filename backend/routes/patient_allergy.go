package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// SetupPatientAllergyRoutes sets up routes for patient allergy management
func SetupPatientAllergyRoutes(api *gin.RouterGroup) {
	allergies := api.Group("/patient-allergies")
	{
		// Get allergy options (category, criticality)
		allergies.GET("/options", handlers.GetAllergyOptions)

		// Search SNOMED CT for allergy
		allergies.GET("/snomed/search", handlers.SearchSnomedAllergy)

		// Get allergies by patient
		allergies.GET("/patient/:patient_id", handlers.GetPatientAllergies)
		allergies.GET("/patient/:patient_id/history", handlers.GetPatientAllergyHistory)
		allergies.GET("/patient/:patient_id/count", handlers.GetPatientActiveAllergiesCount)

		// Get allergies by visit (returns all patient allergies, not just from this visit)
		allergies.GET("/visit/:visit_id", handlers.GetVisitAllergies)

		// CRUD operations
		allergies.POST("", handlers.CreatePatientAllergy)
		allergies.POST("/bulk", handlers.BulkCreatePatientAllergies)
		allergies.PUT("/:id", handlers.UpdatePatientAllergy)
		allergies.DELETE("/:id", handlers.DeletePatientAllergy)
	}
}
