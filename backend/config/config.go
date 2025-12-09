package config

import (
	"fmt"
	"log"
	"os"
)

type Config struct {
	DatabaseDSN string
	JWTSecret   string
	ServerPort  string
	Environment string
}

func Load() *Config {
	env := getEnv("APP_ENV", "development")
	
	config := &Config{
		Environment: env,
		ServerPort:  getEnv("SERVER_PORT", "8080"),
	}

	// Database DSN - wajib diset di production
	if env == "production" {
		config.DatabaseDSN = getEnvRequired("DATABASE_DSN")
		config.JWTSecret = getEnvRequired("JWT_SECRET")
	} else {
		// Development defaults
		config.DatabaseDSN = getEnv("DATABASE_DSN", "host=localhost user=starter password=starter123 dbname=starter port=5434 sslmode=disable")
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
