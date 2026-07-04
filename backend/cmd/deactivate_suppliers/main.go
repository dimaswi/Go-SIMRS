package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"starter/backend/config"
	"starter/backend/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	var dryRun bool
	flag.BoolVar(&dryRun, "dry-run", false, "preview counts without updating data")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseDSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	var activeSuppliers int64
	if err := db.Model(&models.Supplier{}).Where("is_active = ?", true).Count(&activeSuppliers).Error; err != nil {
		log.Fatalf("failed to count active suppliers: %v", err)
	}

	fmt.Printf("Active suppliers: %d\n", activeSuppliers)

	if dryRun {
		fmt.Println("Dry run only. No data changed.")
		return
	}

	now := time.Now()
	if err := db.Model(&models.Supplier{}).
		Where("is_active = ?", true).
		Updates(map[string]interface{}{
			"is_active":  false,
			"updated_at": now,
		}).Error; err != nil {
		log.Fatalf("failed to deactivate suppliers: %v", err)
	}

	fmt.Fprintf(os.Stdout, "Deactivated %d suppliers.\n", activeSuppliers)
}
