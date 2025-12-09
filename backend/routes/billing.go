package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

// SetupBillingRoutes sets up billing related routes
func SetupBillingRoutes(router *gin.RouterGroup) {
	billing := router.Group("/billing")
	billing.Use(middleware.AuthMiddleware())
	{
		// Billing list and CRUD
		billing.GET("", middleware.RequirePermission("billing.view"), handlers.GetBillings)
		billing.GET("/:id", middleware.RequirePermission("billing.view"), handlers.GetBilling)
		billing.GET("/visit/:visit_id", middleware.RequirePermission("billing.view"), handlers.GetBillingByVisit)
		billing.POST("/generate/:visit_id", middleware.RequirePermission("billing.create"), handlers.GenerateBilling)
		billing.POST("/:id/finalize", middleware.RequirePermission("billing.finalize"), handlers.FinalizeBilling)
		billing.PUT("/:id/discount", middleware.RequirePermission("billing.update"), handlers.UpdateBillingDiscount)
		billing.POST("/:id/cancel", middleware.RequirePermission("billing.delete"), handlers.CancelBilling)

		// Payments
		billing.POST("/:id/payments", middleware.RequirePermission("billing.payment"), handlers.CreatePayment)
		billing.GET("/:id/payments", middleware.RequirePermission("billing.view"), handlers.GetPayments)
		billing.POST("/payments/:payment_id/void", middleware.RequirePermission("billing.void_payment"), handlers.VoidPayment)

		// Billable registrations (registrations ready to be billed) - per registration
		billing.GET("/billable-registrations", middleware.RequirePermission("billing.view"), handlers.GetBillableRegistrations)

		// Legacy: Billable visits (visits ready to be billed)
		billing.GET("/billable-visits", middleware.RequirePermission("billing.view"), handlers.GetBillableVisits)
	}

	// Registration Tariffs
	tariffs := router.Group("/registration-tariffs")
	tariffs.Use(middleware.AuthMiddleware())
	{
		tariffs.GET("", middleware.RequirePermission("billing.view"), handlers.GetRegistrationTariffs)
		tariffs.POST("", middleware.RequirePermission("billing.create"), handlers.CreateRegistrationTariff)
		tariffs.PUT("/:id", middleware.RequirePermission("billing.update"), handlers.UpdateRegistrationTariff)
		tariffs.DELETE("/:id", middleware.RequirePermission("billing.delete"), handlers.DeleteRegistrationTariff)
	}
}
