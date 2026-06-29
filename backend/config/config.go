package config

import (
	"fmt"
	"log"
	"os"
	"strings"
)

type Config struct {
	DatabaseDSN        string
	CasemixDatabaseDSN string
	JWTSecret          string
	ServerPort         string
	Environment        string
	CORSAllowedOrigins []string
}

func Load() *Config {
	env := getEnv("APP_ENV", "development")

	config := &Config{
		Environment: env,
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		CORSAllowedOrigins: getEnvCSV("CORS_ALLOWED_ORIGINS", []string{
			"http://localhost:*",
			"http://127.0.0.1:*",
			"http://192.168.12.122:*",
			"http://43.128.92.161:*",
			"https://43.128.92.161:*",
			"http://bpjs_dev.dimaswysnu.com:*",
			"https://bpjs_dev.dimaswysnu.com:*",
			"https://simrs.klinikmuhammadiyahkedungadem.id",
			"http://simrs.klinikmuhammadiyahkedungadem.id",
		}),
	}

	// Database DSN - wajib diset di production
	if env == "production" {
		config.DatabaseDSN = getEnvRequired("DATABASE_DSN")
		config.CasemixDatabaseDSN = getEnv("CASEMIX_DATABASE_DSN", config.DatabaseDSN)
		config.JWTSecret = getEnvRequired("JWT_SECRET")
	} else {
		// Development defaults
		config.DatabaseDSN = getEnv("DATABASE_DSN", "host=localhost user=starter password=starter123 dbname=starter port=5434 sslmode=disable")
		config.CasemixDatabaseDSN = getEnv("CASEMIX_DATABASE_DSN", config.DatabaseDSN)
		config.JWTSecret = getEnv("JWT_SECRET", "dev-secret-key-not-for-production")
	}

	// Validasi JWT Secret length
	if len(config.JWTSecret) < 32 {
		log.Printf("WARNING: JWT_SECRET is too short (minimum 32 characters recommended for production)")
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvRequired(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(fmt.Sprintf("Required environment variable %s is not set", key))
	}
	return value
}

func getEnvCSV(key string, defaultValues []string) []string {
	raw := os.Getenv(key)
	if strings.TrimSpace(raw) == "" {
		return defaultValues
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		item := strings.TrimSpace(p)
		if item != "" {
			result = append(result, item)
		}
	}

	if len(result) == 0 {
		return defaultValues
	}

	return result
}
