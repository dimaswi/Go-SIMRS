
package main

import (
    "fmt"
    "starter/backend/config"
    "starter/backend/database"
    "starter/backend/models"
    "github.com/joho/godotenv"
)

func main() {
    godotenv.Load()
    cfg := config.Load()
    database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)
    var rooms []models.Room
    
    database.DB.Find(&rooms)
    for _, r := range rooms {
        fmt.Printf("Room ID: %d, Name: %s, ServiceType: %s\n", r.ID, r.Name, r.ServiceType)
    }
}

