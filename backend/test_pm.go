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
	database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)

	var reg models.Registration
	database.DB.Where("registration_number = ?", "REG202606240001").First(&reg)

	fmt.Printf("Reg PaymentMethod: '%s'\n", reg.PaymentMethod)
}
