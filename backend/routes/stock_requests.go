package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

// setupStockRequestRoutes configures stock request routes
func setupStockRequestRoutes(rg *gin.RouterGroup) {
	stockRequests := rg.Group("/stock-requests")
	{
		// List all
		stockRequests.GET("", handlers.GetStockRequests)

		// Special queries (must be before /:id to avoid conflicts)
		stockRequests.GET("/my-requests", handlers.GetMyStockRequests)
		stockRequests.GET("/pending-approvals", handlers.GetPendingApprovals)

		// CRUD operations
		stockRequests.GET("/:id", handlers.GetStockRequest)
		stockRequests.POST("", handlers.CreateStockRequest)
		stockRequests.PUT("/:id", handlers.UpdateStockRequest)
		stockRequests.DELETE("/:id", handlers.DeleteStockRequest)

		// Actions
		stockRequests.POST("/:id/submit", handlers.SubmitStockRequest)
		stockRequests.POST("/:id/approve", handlers.ApproveStockRequest)
		stockRequests.POST("/:id/reject", handlers.RejectStockRequest)
		stockRequests.POST("/:id/cancel", handlers.CancelStockRequest)
	}
}

// setupDistributionRoutes configures stock distribution routes
func setupDistributionRoutes(rg *gin.RouterGroup) {
	distributions := rg.Group("/distributions")
	{
		distributions.GET("", handlers.GetDistributions)
		distributions.GET("/:id", handlers.GetDistribution)
		distributions.POST("", handlers.CreateDistribution)
		distributions.POST("/:id/receive", handlers.ReceiveDistribution)
	}
}

// setupPurchaseRoutes configures purchase routes
func setupPurchaseRoutes(rg *gin.RouterGroup) {
	purchases := rg.Group("/purchases")
	{
		purchases.GET("", handlers.GetPurchases)
		purchases.GET("/:id", handlers.GetPurchase)
		purchases.POST("", handlers.CreatePurchase)
		purchases.PUT("/:id", handlers.UpdatePurchase)
		purchases.DELETE("/:id", handlers.DeletePurchase)
		purchases.POST("/:id/submit", handlers.SubmitPurchase)
		purchases.POST("/:id/approve", handlers.ApprovePurchase)
		purchases.POST("/:id/receive", handlers.ReceivePurchase)
		purchases.POST("/:id/cancel", handlers.CancelPurchase)
	}
}

// setupStockOpnameRoutes configures stock opname routes
func setupStockOpnameRoutes(rg *gin.RouterGroup) {
	opname := rg.Group("/stock-opname")
	{
		opname.GET("", handlers.GetStockOpnames)
		opname.GET("/room-stock/:roomId", handlers.GetRoomStock) // Get inventory/medicine in a specific room
		opname.GET("/:id", handlers.GetStockOpname)
		opname.POST("", handlers.CreateStockOpname)
		opname.PUT("/:id", handlers.UpdateStockOpname)
		opname.DELETE("/:id", handlers.DeleteStockOpname)
		opname.POST("/:id/complete", handlers.CompleteStockOpname)
		opname.POST("/:id/approve", handlers.ApproveStockOpname)
	}
}
