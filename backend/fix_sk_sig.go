package main

import (
	"encoding/json"
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

	// Fix document_signatures
	database.DB.Model(&models.DocumentSignature{}).
		Where("document_type = ?", models.DocTypeSuratKontrol).
		Update("required_signatures", 2)

	// Check setting
	var setting models.Setting
	if err := database.DB.Where("key = ?", "document_signature_config").First(&setting).Error; err == nil {
		var configMap map[string]interface{}
		json.Unmarshal([]byte(setting.Value), &configMap)
		
		fmt.Println("Old setting:", setting.Value)
		
		if skConfig, ok := configMap[string(models.DocTypeSuratKontrol)].(map[string]interface{}); ok {
			skConfig["required_signatures"] = 2
			configMap[string(models.DocTypeSuratKontrol)] = skConfig
			
			newVal, _ := json.Marshal(configMap)
			setting.Value = string(newVal)
			database.DB.Save(&setting)
			fmt.Println("New setting:", setting.Value)
		} else {
			fmt.Println("Surat Kontrol not found in setting.")
		}
	} else {
		fmt.Println("Setting document_signature_config not found.")
	}
}
