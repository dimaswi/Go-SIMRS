package main

import (
	"fmt"
	"starter/backend/database"
	"starter/backend/config"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)

	var columns []string
	database.DB.Raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'").Pluck("column_name", &columns)
	fmt.Println("Employee columns:", columns)
}
