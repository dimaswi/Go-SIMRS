package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

func setupNutritionRoutes(rg *gin.RouterGroup) {
	nutrition := rg.Group("/nutrition")
	{
		// Reference data (categories, diet types, meal times)
		nutrition.GET("/categories", handlers.GetNutritionMenuCategories)
		nutrition.GET("/diet-types", handlers.GetNutritionDietTypes)
		nutrition.POST("/diet-types", handlers.CreateNutritionDietType)
		nutrition.GET("/meal-times", handlers.GetNutritionMealTimes)
		nutrition.GET("/ingredient-units", handlers.GetNutritionIngredientUnits)

		// Master Menu Makanan
		menus := nutrition.Group("/menus")
		{
			menus.GET("", handlers.GetNutritionMenus)
			menus.GET("/:id", handlers.GetNutritionMenu)
			menus.POST("", handlers.CreateNutritionMenu)
			menus.PUT("/:id", handlers.UpdateNutritionMenu)
			menus.DELETE("/:id", handlers.DeleteNutritionMenu)
		}

		// Master Bahan Gizi
		ingredients := nutrition.Group("/ingredients")
		{
			ingredients.GET("", handlers.GetNutritionIngredients)
			ingredients.GET("/:id", handlers.GetNutritionIngredient)
			ingredients.POST("", handlers.CreateNutritionIngredient)
			ingredients.PUT("/:id", handlers.UpdateNutritionIngredient)
			ingredients.DELETE("/:id", handlers.DeleteNutritionIngredient)
		}

		// Input Faktur Bahan Gizi (tanpa stok)
		invoices := nutrition.Group("/invoices")
		{
			invoices.GET("", handlers.GetNutritionIngredientInvoices)
			invoices.GET("/:id", handlers.GetNutritionIngredientInvoice)
			invoices.POST("", handlers.CreateNutritionIngredientInvoice)
			invoices.PUT("/:id", handlers.UpdateNutritionIngredientInvoice)
			invoices.DELETE("/:id", handlers.DeleteNutritionIngredientInvoice)
		}

		// Master Paket Makanan
		mealPackages := nutrition.Group("/meal-packages")
		{
			mealPackages.GET("", handlers.GetNutritionPackages)
			mealPackages.GET("/:id", handlers.GetNutritionPackage)
			mealPackages.POST("", handlers.CreateNutritionPackage)
			mealPackages.PUT("/:id", handlers.UpdateNutritionPackage)
			mealPackages.DELETE("/:id", handlers.DeleteNutritionPackage)
		}

		// Order Gizi (Nutrition Orders)
		orders := nutrition.Group("/orders")
		{
			orders.GET("", handlers.GetNutritionOrders)
			orders.GET("/:id", handlers.GetNutritionOrder)
			orders.POST("", handlers.CreateNutritionOrder)
			orders.PUT("/:id/status", handlers.UpdateNutritionOrderStatus)
			orders.DELETE("/:id", handlers.DeleteNutritionOrder)
		}

		// Kitchen Dashboard
		nutrition.GET("/kitchen", handlers.GetKitchenDashboard)

		// Nutrition Reports
		nutrition.GET("/reports/ingredient-usage", handlers.GetNutritionIngredientUsageReport)
	}
}
