
package main
import (
    "fmt"
    "encoding/json"
    "starter/backend/config"
    "starter/backend/database"
    "starter/backend/models"
    "github.com/joho/godotenv"
)
func main() {
    godotenv.Load()
    cfg := config.Load()
    database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)
    var beds []models.Bed
    database.DB.Joins("JOIN room_units ON room_units.id = beds.room_unit_id").Where("room_units.room_id = ? AND room_units.deleted_at IS NULL", "48").Preload("RoomUnit").Order("room_units.floor ASC, room_units.code ASC, beds.bed_number ASC").Find(&beds)
    
    j, _ := json.Marshal(beds)
    fmt.Println(string(j))
}

