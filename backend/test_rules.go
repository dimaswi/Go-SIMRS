package main

import (
	"encoding/json"
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

	// Dump the config
	rules := handlers.GetDefaultRulesExportedOrWhateverWeCanCall() // Oh wait, I can't call private functions.
	
	// Let's just make an HTTP request to the local backend to get the rules.
}
