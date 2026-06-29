
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
    
    var units []models.RoomUnit
    database.DB.Where("room_id = ?", room.ID).Find(&units)
    fmt.Printf("Found %d units\n", len(units))
    
    var beds []models.Bed
    database.DB.Joins("JOIN room_units ON room_units.id = beds.room_unit_id").Where("room_units.room_id = ?", room.ID).Find(&beds)
    fmt.Printf("Found %d beds using join\n", len(beds))
}

