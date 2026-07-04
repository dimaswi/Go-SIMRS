package main

import (
	"log"

	"starter/backend/config"
	"starter/backend/database"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := database.SeedData(); err != nil {
		log.Fatalf("failed to sync permissions: %v", err)
	}

	log.Println("Permissions synced successfully")
}
