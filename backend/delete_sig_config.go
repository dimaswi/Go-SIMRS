package main

import (
	"fmt"
	"github.com/joho/godotenv"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/models"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		fmt.Println("Error:", err)
		return
	}

	res := database.DB.Where("key = ?", "document_signature_config_json").Delete(&models.Setting{})
	fmt.Printf("Deleted %d setting rows.\n", res.RowsAffected)
}
