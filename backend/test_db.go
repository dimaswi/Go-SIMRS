package main

import (
	"fmt"
	"starter/backend/database"
	"starter/backend/models"
)

func main() {
	database.Connect("host=localhost user=postgres password=postgres dbname=gosimrs port=5432 sslmode=disable TimeZone=Asia/Jakarta", "host=localhost user=postgres password=postgres dbname=gosimrs_casemix port=5432 sslmode=disable TimeZone=Asia/Jakarta")
	var logs []models.SignatureLog
	database.DB.Order("id desc").Limit(5).Find(&logs)
	for _, l := range logs {
		fmt.Printf("ID: %d, DocType: %s, SignerName: %s, Role: %s, Notes: %s\n", l.ID, l.DocumentType, l.SignerName, l.SignerRole, l.Notes)
	}
}
