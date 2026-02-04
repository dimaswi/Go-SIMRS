package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// SetupQualityCostRoutes configures quality control and cost management routes
func SetupQualityCostRoutes(router *gin.RouterGroup) {
	qc := router.Group("/quality-cost")
	{
		// Quality Control (Kendali Mutu)
		qc.GET("/quality-metrics", handlers.GetQualityMetrics)
		qc.GET("/quality-trends", handlers.GetQualityTrends)

		// Cost Control (Kendali Biaya)
		qc.GET("/cost-summary", handlers.GetCostAnalysisSummary)
		qc.GET("/cost-cases", handlers.GetCostCaseList)
		qc.GET("/top-loss-cases", handlers.GetTopLossCases)
		qc.GET("/cost-by-category", handlers.GetCostByCategory)
		qc.GET("/pending-claims", handlers.GetPendingClaims)
	}
}
