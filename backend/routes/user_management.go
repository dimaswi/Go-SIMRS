package routes

import (
	"starter/backend/handlers"
	"starter/backend/middleware"

	"github.com/gin-gonic/gin"
)

func setupPublicSettingsRoutes(rg *gin.RouterGroup) {
	rg.GET("/settings", handlers.GetSettings)
}

func setupProtectedSettingsRoutes(rg *gin.RouterGroup) {
	rg.GET("/auth/profile", handlers.GetProfile)
	rg.GET("/auth/preferences/medical-record-tabs", handlers.GetMedicalRecordTabPreference)
	rg.PUT("/auth/preferences/medical-record-tabs", handlers.UpsertMedicalRecordTabPreference)
	rg.PUT("/settings", handlers.UpdateSettings)
	rg.POST("/settings/upload", handlers.UploadLogo)
}

func setupUserRoutes(rg *gin.RouterGroup) {
	rg.GET("/users", middleware.RequirePermission("users.view"), handlers.GetUsers)
	rg.GET("/users/:id", middleware.RequirePermission("users.view"), handlers.GetUser)
	rg.POST("/users", middleware.RequirePermission("users.create"), handlers.CreateUser)
	rg.PUT("/users/:id", middleware.RequirePermission("users.update"), handlers.UpdateUser)
	rg.DELETE("/users/:id", middleware.RequirePermission("users.delete"), handlers.DeleteUser)
}

func setupRoleRoutes(rg *gin.RouterGroup) {
	rg.GET("/roles", middleware.RequirePermission("roles.view"), handlers.GetRoles)
	rg.GET("/roles/:id", middleware.RequirePermission("roles.view"), handlers.GetRole)
	rg.POST("/roles", middleware.RequirePermission("roles.create"), handlers.CreateRole)
	rg.PUT("/roles/:id", middleware.RequirePermission("roles.update"), handlers.UpdateRole)
	rg.DELETE("/roles/:id", middleware.RequirePermission("roles.delete"), handlers.DeleteRole)
}

func setupPermissionRoutes(rg *gin.RouterGroup) {
	rg.GET("/permissions", middleware.RequirePermission("permissions.view"), handlers.GetPermissions)
	rg.GET("/permissions/by-module", middleware.RequirePermission("permissions.view"), handlers.GetPermissionsByModule)
	rg.GET("/permissions/:id", middleware.RequirePermission("permissions.view"), handlers.GetPermission)
	rg.POST("/permissions", middleware.RequirePermission("permissions.create"), handlers.CreatePermission)
	rg.PUT("/permissions/:id", middleware.RequirePermission("permissions.update"), handlers.UpdatePermission)
	rg.DELETE("/permissions/:id", middleware.RequirePermission("permissions.delete"), handlers.DeletePermission)
}
