package main

import (
	"log"
	"starter/backend/config"
	"starter/backend/database"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatal(err)
	}
	if err := database.Migrate(); err != nil {
		log.Fatal("Migrate failed:", err)
	}
	log.Println("Migrate successful")
}
