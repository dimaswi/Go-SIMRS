package routes

import (
	"starter/backend/handlers"

	"github.com/gin-gonic/gin"
)

func setupAuthRoutes(rg *gin.RouterGroup) {
	rg.POST("/auth/login", handlers.Login)
}
