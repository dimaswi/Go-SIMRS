package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterInpatientRoutes registers all inpatient-related routes (CPPT, Fluid Balance)
func RegisterInpatientRoutes(r *gin.RouterGroup) {
	inpatient := r.Group("/visits/:id")
	inpatient.Use(middleware.AuthMiddleware())
	{
		// CPPT Routes
		cppt := inpatient.Group("/cppt")
		{
			cppt.GET("", handlers.GetCPPTs)
			cppt.GET("/:cpptId", handlers.GetCPPT)
			cppt.POST("", handlers.CreateCPPT)
			cppt.PUT("/:cpptId", handlers.UpdateCPPT)
			cppt.PUT("/:cpptId/verify", handlers.VerifyCPPT)
			cppt.DELETE("/:cpptId", handlers.DeleteCPPT)
		}

		// Fluid Balance Routes
		fluid := inpatient.Group("/fluid-balance")
		{
			fluid.GET("", handlers.GetFluidBalances)
			fluid.GET("/summary", handlers.GetFluidBalanceSummary)
			fluid.GET("/:balanceId", handlers.GetFluidBalance)
			fluid.POST("", handlers.CreateFluidBalance)
			fluid.PUT("/:balanceId", handlers.UpdateFluidBalance)
			fluid.DELETE("/:balanceId", handlers.DeleteFluidBalance)
		}
	}
}
