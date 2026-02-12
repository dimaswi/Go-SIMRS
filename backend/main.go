package main

import (
	"log"
	"os"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/handlers"
	"starter/backend/middleware"
	"starter/backend/routes"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func init() {
	// Set default timezone to Asia/Jakarta (WIB) for the entire application
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		log.Println("Warning: failed to load Asia/Jakarta timezone, falling back to UTC+7")
		loc = time.FixedZone("WIB", 7*60*60)
	}
	time.Local = loc
	os.Setenv("TZ", "Asia/Jakarta")
}

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using default configuration")
	}

	// Load config
	cfg := config.Load()

	// Set JWT secret
	middleware.SetJWTSecret(cfg.JWTSecret)

	// Connect to database
	if err := database.Connect(cfg.DatabaseDSN); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Run migrations
	if err := database.Migrate(); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Initialize SSE Hub for real-time notifications
	handlers.InitSSEHub()
	handlers.InitNotificationService()
	log.Println("SSE Hub initialized for real-time notifications")

	// Setup Gin router
	r := gin.Default()

	// Serve static files for uploads
	r.Static("/uploads", "./uploads")

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://localhost:3000",
			"http://192.168.12.122:3232",
			"https://bpjs_dev.dimaswysnu.com",
			"http://bpjs_dev.dimaswysnu.com",
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Setup all routes
	routes.SetupRoutes(r)

	log.Printf("Server starting on port %s...", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
