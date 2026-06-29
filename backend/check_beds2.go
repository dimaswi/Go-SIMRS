
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
    
    var room models.Room
    database.DB.Where("name = ?", "BIR ALI").First(&room)
    fmt.Printf("Room ID: %v\n", room.ID)
    
    var beds []models.Bed
    database.DB.Joins("JOIN room_units ON room_units.id = beds.room_unit_id").Where("room_units.room_id = ? AND room_units.deleted_at IS NULL", room.ID).Find(&beds)
    if len(beds) > 0 {
        fmt.Printf("First bed: ID=%v, BedNumber=%v\n", beds[0].ID, beds[0].BedNumber)
    }
}

