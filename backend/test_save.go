//go:build ignore

package main

import (
	"fmt"
	"starter/backend/database"
	"starter/backend/models"
)

func main() {
	database.Connect()
	consent := models.GeneralConsentInpatient{
		VisitID: 261,
		SignerName: "Test",
	}
	err := database.DB.Save(&consent).Error
	if err != nil {
		fmt.Println("ERROR:", err)
	} else {
		fmt.Println("SUCCESS")
	}
}
