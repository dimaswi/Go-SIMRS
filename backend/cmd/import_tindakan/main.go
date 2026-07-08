package main

import (
	"log"
	"os"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/migrations"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	log.Println("Connecting to database...")
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err := migrations.ImportDataTindakan(database.DB)
	if err != nil {
		log.Fatalf("Import failed: %v", err)
	}

	log.Println("Data tindakan berhasil diimpor sepenuhnya.")
	_ = os.Stdout
}