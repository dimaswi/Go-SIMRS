package main

import (
	"fmt"
	"log"
	"time"

	"starter/backend/models"

	"net/http"
	"io/ioutil"
	"encoding/json"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=postgres password=Dimasw1950 dbname=simrs port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var user models.User
	if err := db.Where("username = ?", "admin").First(&user).Error; err != nil {
		log.Fatal(err)
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     user.ID,
		"permissions": []string{"visits.view", "medical_records.view"},
		"exp":         time.Now().Add(time.Hour * 24).Unix(),
	})
	tokenString, _ := token.SignedString([]byte("dev-secret-key-not-for-production-change-this-in-prod"))

	// Call API
	req, _ := http.NewRequest("GET", "http://localhost:8080/api/visits?room_id=16&visit_type=outpatient", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println("API Response Status:", resp.StatusCode)
	
	var response struct {
		Data []models.Visit `json:"data"`
	}
	json.Unmarshal(body, &response)
	visits := response.Data
	fmt.Printf("API returned %d visits\n", len(visits))
	for _, v := range visits {
		fmt.Printf("Visit %d: Reg %d, Room %d, Type: %s, Status: %s, CheckIn: %v, Deleted: %v\n", v.ID, v.RegistrationID, v.RoomID, v.VisitType, v.Status, v.CheckInTime, v.DeletedAt.Time)
	}
}
