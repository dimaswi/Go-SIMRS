package main

import (
	"fmt"
	"github.com/joho/godotenv"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/handlers"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		fmt.Println("Error:", err)
		return
	}

	handlers.TestRules()
}
