package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// setupStockRequestRoutes configures stock request routes
func setupStockRequestRoutes(rg *gin.RouterGroup) {
	stockRequests := rg.Group("/stock-requests")
	{
		// List all
		stockRequests.GET("", middleware.RequirePermission("stock_requests.view"), handlers.GetStockRequests)

		// Special queries (must be before /:id to avoid conflicts)
		stockRequests.GET("/my-requests", middleware.RequirePermission("stock_requests.view"), handlers.GetMyStockRequests)
		stockRequests.GET("/pending-approvals", middleware.RequirePermission("stock_requests.approve"), handlers.GetPendingApprovals)

		// CRUD operations
		stockRequests.GET("/:id", middleware.RequirePermission("stock_requests.view"), handlers.GetStockRequest)
		stockRequests.POST("", middleware.RequirePermission("stock_requests.create"), handlers.CreateStockRequest)
		stockRequests.PUT("/:id", middleware.RequirePermission("stock_requests.update"), handlers.UpdateStockRequest)
		stockRequests.DELETE("/:id", middleware.RequirePermission("stock_requests.delete"), handlers.DeleteStockRequest)

		// Actions
		stockRequests.POST("/:id/submit", middleware.RequirePermission("stock_requests.create"), handlers.SubmitStockRequest)
		stockRequests.POST("/:id/approve", middleware.RequirePermission("stock_requests.approve"), handlers.ApproveStockRequest)
		stockRequests.POST("/:id/reject", middleware.RequirePermission("stock_requests.approve"), handlers.RejectStockRequest)
		stockRequests.POST("/:id/cancel", middleware.RequirePermission("stock_requests.delete"), handlers.CancelStockRequest)
	}
}

// setupDistributionRoutes configures stock distribution routes
func setupDistributionRoutes(rg *gin.RouterGroup) {
	distributions := rg.Group("/distributions")
	{
		distributions.GET("", middleware.RequirePermission("distributions.view"), handlers.GetDistributions)
		distributions.GET("/:id", middleware.RequirePermission("distributions.view"), handlers.GetDistribution)
		distributions.POST("", middleware.RequirePermission("distributions.create"), handlers.CreateDistribution)
		distributions.POST("/:id/receive", middleware.RequirePermission("distributions.receive"), handlers.ReceiveDistribution)
	}
}

// setupPurchaseRoutes configures purchase routes
func setupPurchaseRoutes(rg *gin.RouterGroup) {
	purchases := rg.Group("/purchases")
	{
		purchases.GET("", middleware.RequirePermission("purchases.view"), handlers.GetPurchases)
		purchases.GET("/:id", middleware.RequirePermission("purchases.view"), handlers.GetPurchase)
		purchases.POST("", middleware.RequirePermission("purchases.create"), handlers.CreatePurchase)
		purchases.PUT("/:id", middleware.RequirePermission("purchases.update"), handlers.UpdatePurchase)
		purchases.DELETE("/:id", middleware.RequirePermission("purchases.delete"), handlers.DeletePurchase)
		purchases.POST("/:id/submit", middleware.RequirePermission("purchases.create"), handlers.SubmitPurchase)
		purchases.POST("/:id/approve", middleware.RequirePermission("purchases.approve"), handlers.ApprovePurchase)
		purchases.POST("/:id/receive", middleware.RequirePermission("purchases.receive"), handlers.ReceivePurchase)
		purchases.POST("/:id/payments", middleware.RequirePermission("purchases.update"), handlers.RecordPurchasePayment)
		purchases.POST("/:id/cancel", middleware.RequirePermission("purchases.delete"), handlers.CancelPurchase)
	}
}

// setupStockOpnameRoutes configures stock opname routes
func setupStockOpnameRoutes(rg *gin.RouterGroup) {
	opname := rg.Group("/stock-opname")
	{
		opname.GET("", middleware.RequirePermission("stock_opname.view"), handlers.GetStockOpnames)
		opname.GET("/room-stock/:roomId", middleware.RequirePermission("stock_opname.view"), handlers.GetRoomStock) // Get inventory/medicine in a specific room
		opname.GET("/:id", middleware.RequirePermission("stock_opname.view"), handlers.GetStockOpname)
		opname.POST("", middleware.RequirePermission("stock_opname.create"), handlers.CreateStockOpname)
		opname.PUT("/:id", middleware.RequirePermission("stock_opname.update"), handlers.UpdateStockOpname)
		opname.DELETE("/:id", middleware.RequirePermission("stock_opname.delete"), handlers.DeleteStockOpname)
		opname.POST("/:id/complete", middleware.RequirePermission("stock_opname.complete"), handlers.CompleteStockOpname)
		opname.POST("/:id/approve", middleware.RequirePermission("stock_opname.approve"), handlers.ApproveStockOpname)
	}
}
