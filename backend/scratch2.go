package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	url := "http://localhost:8080/bpjs-webhook/antrean/status"
	payload := []byte(`{"kodepoli":"BED","kodedokter":268349,"tanggalperiksa":"2026-06-23","jampraktek":"08:00-14:00"}`)
	
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	// The webhook uses x-token but wait, it might use the mock auth locally
	// In Go-SIMRS we can pass x-username and x-password
	req.Header.Set("x-username", "admin")
	req.Header.Set("x-password", "admin")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	fmt.Println("Status:", resp.StatusCode)
	fmt.Println("Body:", string(body))
}
