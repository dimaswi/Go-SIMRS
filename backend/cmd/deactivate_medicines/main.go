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

	var activeMedicines int64
	var activeBatches int64

	if err := db.Model(&models.Medicine{}).Where("is_active = ?", true).Count(&activeMedicines).Error; err != nil {
		log.Fatalf("failed to count active medicines: %v", err)
	}
	if err := db.Model(&models.MedicineBatch{}).Where("is_active = ?", true).Count(&activeBatches).Error; err != nil {
		log.Fatalf("failed to count active medicine batches: %v", err)
	}

	fmt.Printf("Active medicines: %d\n", activeMedicines)
	fmt.Printf("Active medicine batches: %d\n", activeBatches)

	if dryRun {
		fmt.Println("Dry run only. No data changed.")
		return
	}

	now := time.Now()
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Medicine{}).
			Where("is_active = ?", true).
			Updates(map[string]interface{}{
				"is_active":  false,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.MedicineBatch{}).
			Where("is_active = ?", true).
			Updates(map[string]interface{}{
				"is_active":  false,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		return nil
	}); err != nil {
		log.Fatalf("failed to deactivate medicines: %v", err)
	}

	fmt.Fprintf(os.Stdout, "Deactivated %d medicines and %d medicine batches.\n", activeMedicines, activeBatches)
}
