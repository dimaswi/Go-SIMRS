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
		nutrition.GET("/meal-times", handlers.GetNutritionMealTimes)

		// Master Menu Makanan
		menus := nutrition.Group("/menus")
		{
			menus.GET("", handlers.GetNutritionMenus)
			menus.GET("/:id", handlers.GetNutritionMenu)
			menus.POST("", handlers.CreateNutritionMenu)
			menus.PUT("/:id", handlers.UpdateNutritionMenu)
			menus.DELETE("/:id", handlers.DeleteNutritionMenu)
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
	}
}
