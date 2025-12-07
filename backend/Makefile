.PHONY: run dev sync-provinces sync-regencies sync-districts sync-villages sync-all

# Run the backend server
run:
	go run main.go

# Run with hot reload (requires air: go install github.com/air-verse/air@latest)
dev:
	air

# Sync commands for regions
sync-provinces:
	go run cmd/sync_regions/main.go -provinces

sync-regencies:
	go run cmd/sync_regions/main.go -regencies

sync-districts:
	go run cmd/sync_regions/main.go -districts

sync-villages:
	go run cmd/sync_regions/main.go -villages

sync-all:
	go run cmd/sync_regions/main.go -all

# Sync specific province (usage: make sync-province ID=11)
sync-province:
	go run cmd/sync_regions/main.go -province=$(ID)

# Sync specific regency (usage: make sync-regency ID=1101)
sync-regency:
	go run cmd/sync_regions/main.go -regency=$(ID)

# Sync specific district (usage: make sync-district ID=1101010)
sync-district:
	go run cmd/sync_regions/main.go -district=$(ID)

# Build the application
build:
	go build -o bin/server main.go
	go build -o bin/sync_regions cmd/sync_regions/main.go

# Clean build artifacts
clean:
	rm -rf bin/

# Run tests
test:
	go test ./...

# Help
help:
	@echo "Available commands:"
	@echo "  make run              - Run the backend server"
	@echo "  make dev              - Run with hot reload (requires air)"
	@echo "  make build            - Build the application"
	@echo "  make test             - Run tests"
	@echo ""
	@echo "Region sync commands:"
	@echo "  make sync-provinces   - Sync all provinces"
	@echo "  make sync-regencies   - Sync all regencies"
	@echo "  make sync-districts   - Sync all districts"
	@echo "  make sync-villages    - Sync all villages"
	@echo "  make sync-all         - Sync all regions (takes a long time)"
	@echo ""
	@echo "Sync specific region:"
	@echo "  make sync-province ID=11       - Sync regencies for province 11"
	@echo "  make sync-regency ID=1101      - Sync districts for regency 1101"
	@echo "  make sync-district ID=1101010  - Sync villages for district 1101010"
