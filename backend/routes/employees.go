package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupEmployeeRoutes(rg *gin.RouterGroup) {
	rg.GET("/employees", middleware.RequirePermission("employees.view"), handlers.GetEmployees)
	rg.GET("/employees/types", middleware.RequirePermission("employees.view"), handlers.GetEmployeeTypes)
	rg.GET("/employees/statuses", middleware.RequirePermission("employees.view"), handlers.GetEmploymentStatuses)
	rg.GET("/employees/without-user", middleware.RequirePermission("employees.view"), handlers.GetEmployeesWithoutUser)
	rg.GET("/employees/:id", middleware.RequirePermission("employees.view"), handlers.GetEmployee)
	rg.POST("/employees", middleware.RequirePermission("employees.create"), handlers.CreateEmployee)
	rg.PUT("/employees/:id", middleware.RequirePermission("employees.update"), handlers.UpdateEmployee)
	rg.DELETE("/employees/:id", middleware.RequirePermission("employees.delete"), handlers.DeleteEmployee)
}
