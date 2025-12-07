package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupProcedureRoutes sets up procedure-related routes
func setupProcedureRoutes(rg *gin.RouterGroup) {
	// Procedure routes
	rg.GET("/procedures", middleware.RequirePermission("procedures.view"), handlers.GetProcedures)
	rg.GET("/procedures/:id", middleware.RequirePermission("procedures.view"), handlers.GetProcedure)
	rg.POST("/procedures", middleware.RequirePermission("procedures.create"), handlers.CreateProcedure)
	rg.PUT("/procedures/:id", middleware.RequirePermission("procedures.update"), handlers.UpdateProcedure)
	rg.DELETE("/procedures/:id", middleware.RequirePermission("procedures.delete"), handlers.DeleteProcedure)

	// Procedure parameters
	rg.GET("/procedures/:id/parameters", middleware.RequirePermission("procedures.view"), handlers.GetProcedureParameters)
	rg.GET("/procedures/:id/parameters/:paramId", middleware.RequirePermission("procedures.view"), handlers.GetProcedureParameter)
	rg.POST("/procedures/:id/parameters", middleware.RequirePermission("procedures.update"), handlers.CreateProcedureParameter)
	rg.POST("/procedures/:id/parameters/bulk", middleware.RequirePermission("procedures.update"), handlers.BulkCreateProcedureParameters)
	rg.POST("/procedures/:id/parameters/apply-defaults", middleware.RequirePermission("procedures.update"), handlers.ApplyDefaultParameters)
	rg.PUT("/procedures/:id/parameters/:paramId", middleware.RequirePermission("procedures.update"), handlers.UpdateProcedureParameter)
	rg.PUT("/procedures/:id/parameters/reorder", middleware.RequirePermission("procedures.update"), handlers.ReorderParameters)
	rg.DELETE("/procedures/:id/parameters/:paramId", middleware.RequirePermission("procedures.update"), handlers.DeleteProcedureParameter)

	// Procedure categories
	rg.GET("/procedure-categories", middleware.RequirePermission("procedures.view"), handlers.GetProcedureCategories)

	// Patient classes
	rg.GET("/patient-classes", middleware.RequirePermission("procedures.view"), handlers.GetPatientClasses)

	// Procedure types and input types
	rg.GET("/procedure-types", middleware.RequirePermission("procedures.view"), handlers.GetProcedureTypes)
	rg.GET("/input-types", middleware.RequirePermission("procedures.view"), handlers.GetInputTypes)
	rg.GET("/parameter-templates", middleware.RequirePermission("procedures.view"), handlers.GetDefaultParameterTemplates)
}
