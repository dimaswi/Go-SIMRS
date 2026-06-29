
package main

import (
    "fmt"
    "io/ioutil"
    "net/http"
    "starter/backend/config"
    "starter/backend/database"
    "starter/backend/models"
    "github.com/joho/godotenv"
    "time"
    "github.com/golang-jwt/jwt/v5"
)

func main() {
    godotenv.Load()
    cfg := config.Load()
    database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)
    
    var user models.User
    database.DB.First(&user)
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "username": user.Username,
        "role": user.Role,
        "exp": time.Now().Add(time.Hour).Unix(),
    })
    tokenString, _ := token.SignedString([]byte(cfg.JWTSecret))
    
    req, _ := http.NewRequest("GET", "http://localhost:8080/api/rooms/48/beds", nil)
    req.Header.Set("Authorization", "Bearer " + tokenString)
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Printf("Status: %d\nBody: %s\n", resp.StatusCode, string(body))
}

