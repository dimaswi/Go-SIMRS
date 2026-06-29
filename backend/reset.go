package main
import (
	"log"
	"starter/backend/database"
	"starter/backend/models"
)
func main() {
	database.Connect("host=localhost user=postgres password=postgres dbname=klinik port=5432 sslmode=disable TimeZone=Asia/Jakarta", "")
	database.DB.Where("key = ?", "signature_rules").Delete(&models.Setting{})
	log.Println("Deleted signature rules setting to reset to defaults")
}
