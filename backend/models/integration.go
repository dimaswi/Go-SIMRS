package models

import (
	"time"

	"gorm.io/gorm"
)

// IntegrationType represents the type of external integration
type IntegrationType string

const (
	IntegrationTypeBPJS        IntegrationType = "bpjs"         // Legacy, for backward compatibility
	IntegrationTypeBPJSAntrian IntegrationType = "bpjs-antrian" // BPJS Antrian Online / JKN Mobile
	IntegrationTypeBPJSVClaim  IntegrationType = "bpjs-vclaim"  // BPJS VClaim
	IntegrationTypeBPJSICare   IntegrationType = "bpjs-icare"   // BPJS I-Care
	IntegrationTypeBPJSApotek  IntegrationType = "bpjs-apotek"  // BPJS Apotek Online
	IntegrationTypeBPJSRME     IntegrationType = "bpjs-rme"     // BPJS RME (Rekam Medis Elektronik)
	IntegrationTypeSatuSehat   IntegrationType = "satusehat"
	IntegrationTypePCare       IntegrationType = "pcare"
	IntegrationTypeEKlaim      IntegrationType = "eklaim" // E-Klaim Local Server
)

// BPJSServiceTypes returns all BPJS service integration types
func BPJSServiceTypes() []IntegrationType {
	return []IntegrationType{
		IntegrationTypeBPJSAntrian,
		IntegrationTypeBPJSVClaim,
		IntegrationTypeBPJSICare,
		IntegrationTypeBPJSApotek,
		IntegrationTypeBPJSRME,
	}
}

// IsBPJSType checks if the integration type is a BPJS type
func IsBPJSType(t IntegrationType) bool {
	switch t {
	case IntegrationTypeBPJS, IntegrationTypeBPJSAntrian, IntegrationTypeBPJSVClaim,
		IntegrationTypeBPJSICare, IntegrationTypeBPJSApotek, IntegrationTypeBPJSRME:
		return true
	}
	return false
}

// IntegrationConfig stores configuration for external system integrations
type IntegrationConfig struct {
	ID          uint            `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `gorm:"index" json:"-"`
	Integration IntegrationType `gorm:"not null;size:50;index" json:"integration"` // bpjs, satusehat, pcare, vclaim
	Key         string          `gorm:"not null;size:100" json:"key"`
	Value       string          `gorm:"type:text" json:"value"`
	Description string          `gorm:"type:text" json:"description"`
	IsEncrypted bool            `gorm:"default:false" json:"is_encrypted"`
	IsSecret    bool            `gorm:"default:false" json:"is_secret"` // If true, don't return value to frontend
}

// IntegrationSyncLog stores API request/response logs for all integrations
type IntegrationSyncLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	// Integration Type
	Integration IntegrationType `gorm:"not null;size:50;index" json:"integration"`

	// Request Info
	Endpoint    string `gorm:"not null;size:255;index" json:"endpoint"`
	Method      string `gorm:"not null;size:10" json:"method"`
	RequestBody string `gorm:"type:text" json:"request_body"`

	// Response Info
	ResponseCode int    `json:"response_code"`
	ResponseBody string `gorm:"type:text" json:"response_body"`

	// Status
	Status       string `gorm:"not null;size:20;index" json:"status"` // success, failed, timeout
	ErrorMessage string `gorm:"type:text" json:"error_message"`

	// Timing
	RequestAt  time.Time  `gorm:"not null;index" json:"request_at"`
	ResponseAt *time.Time `json:"response_at"`
	DurationMs int        `json:"duration_ms"`

	// Reference
	ReferenceType string `gorm:"size:50" json:"reference_type"` // queue, sep, claim, encounter, etc
	ReferenceID   *uint  `json:"reference_id"`
}

// TableName returns the table name for IntegrationConfig
func (IntegrationConfig) TableName() string {
	return "integration_configs"
}

// TableName returns the table name for IntegrationSyncLog
func (IntegrationSyncLog) TableName() string {
	return "integration_sync_logs"
}

// IntegrationConfigKey represents config key patterns
type IntegrationConfigKey struct {
	Integration IntegrationType
	Key         string
	Description string
	IsEncrypted bool
	IsSecret    bool
	Default     string
}

// createBPJSConfigKeys creates config keys for a BPJS service type
func createBPJSConfigKeys(integrationType IntegrationType, serviceName string) []IntegrationConfigKey {
	return []IntegrationConfigKey{
		{Integration: integrationType, Key: "cons_id", Description: "Consumer ID " + serviceName, IsEncrypted: false, IsSecret: false, Default: ""},
		{Integration: integrationType, Key: "secret_key", Description: "Secret Key " + serviceName, IsEncrypted: false, IsSecret: true, Default: ""},
		{Integration: integrationType, Key: "user_key", Description: "User Key " + serviceName, IsEncrypted: false, IsSecret: true, Default: ""},
		{Integration: integrationType, Key: "kode_ppk", Description: "Kode Faskes/PPK", IsEncrypted: false, IsSecret: false, Default: ""},
		{Integration: integrationType, Key: "nama_ppk", Description: "Nama Faskes", IsEncrypted: false, IsSecret: false, Default: ""},
		{Integration: integrationType, Key: "environment", Description: "Environment: development atau production", IsEncrypted: false, IsSecret: false, Default: "development"},
		{Integration: integrationType, Key: "base_url_dev", Description: "Base URL Development", IsEncrypted: false, IsSecret: false, Default: "https://apijkn-dev.bpjs-kesehatan.go.id"},
		{Integration: integrationType, Key: "base_url_prod", Description: "Base URL Production", IsEncrypted: false, IsSecret: false, Default: "https://apijkn.bpjs-kesehatan.go.id"},
		{Integration: integrationType, Key: "sync_interval_minutes", Description: "Interval sinkronisasi dalam menit", IsEncrypted: false, IsSecret: false, Default: "5"},
		{Integration: integrationType, Key: "auto_sync_enabled", Description: "Enable auto sync", IsEncrypted: false, IsSecret: false, Default: "false"},
		// Webhook credentials - BPJS uses these to authenticate when calling our endpoints
		{Integration: integrationType, Key: "webhook_username", Description: "Username untuk BPJS webhook ke RS", IsEncrypted: false, IsSecret: false, Default: ""},
		{Integration: integrationType, Key: "webhook_password", Description: "Password untuk BPJS webhook ke RS", IsEncrypted: false, IsSecret: true, Default: ""},
	}
}

// BPJS Config Keys (Legacy - for backward compatibility)
var BPJSConfigKeys = []IntegrationConfigKey{
	{Integration: IntegrationTypeBPJS, Key: "cons_id", Description: "Consumer ID dari BPJS", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "secret_key", Description: "Secret Key dari BPJS", IsEncrypted: false, IsSecret: true, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "user_key", Description: "User Key dari BPJS", IsEncrypted: false, IsSecret: true, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "kode_ppk", Description: "Kode Faskes/PPK", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "nama_ppk", Description: "Nama Faskes", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "environment", Description: "Environment: development atau production", IsEncrypted: false, IsSecret: false, Default: "development"},
	{Integration: IntegrationTypeBPJS, Key: "base_url_dev", Description: "Base URL Development", IsEncrypted: false, IsSecret: false, Default: "https://apijkn-dev.bpjs-kesehatan.go.id"},
	{Integration: IntegrationTypeBPJS, Key: "base_url_prod", Description: "Base URL Production", IsEncrypted: false, IsSecret: false, Default: "https://apijkn.bpjs-kesehatan.go.id"},
	{Integration: IntegrationTypeBPJS, Key: "sync_interval_minutes", Description: "Interval sinkronisasi dalam menit", IsEncrypted: false, IsSecret: false, Default: "5"},
	{Integration: IntegrationTypeBPJS, Key: "auto_sync_enabled", Description: "Enable auto sync", IsEncrypted: false, IsSecret: false, Default: "false"},
	{Integration: IntegrationTypeBPJS, Key: "webhook_username", Description: "Username untuk BPJS webhook ke RS", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeBPJS, Key: "webhook_password", Description: "Password untuk BPJS webhook ke RS", IsEncrypted: false, IsSecret: true, Default: ""},
}

// Per-service BPJS Config Keys
var BPJSAntrianConfigKeys = createBPJSConfigKeys(IntegrationTypeBPJSAntrian, "Antrian Online")
var BPJSVClaimConfigKeys = createBPJSConfigKeys(IntegrationTypeBPJSVClaim, "VClaim")
var BPJSICareConfigKeys = createBPJSConfigKeys(IntegrationTypeBPJSICare, "I-Care")
var BPJSApotekConfigKeys = createBPJSConfigKeys(IntegrationTypeBPJSApotek, "Apotek Online")
var BPJSRMEConfigKeys = createBPJSConfigKeys(IntegrationTypeBPJSRME, "RME")

// E-Klaim Config Keys
var EKlaimConfigKeys = []IntegrationConfigKey{
	{Integration: IntegrationTypeEKlaim, Key: "eklaim_local_url", Description: "URL E-Klaim Local Server (contoh: http://192.168.56.101/E-Klaim/ws.php)", IsEncrypted: false, IsSecret: false, Default: "http://localhost/E-Klaim/ws.php"},
	{Integration: IntegrationTypeEKlaim, Key: "eklaim_secret_key", Description: "Secret Key Enkripsi (64 karakter hex dari BPJS)", IsEncrypted: false, IsSecret: true, Default: ""},
	{Integration: IntegrationTypeEKlaim, Key: "eklaim_coder_nik", Description: "NIK Koder Default", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeEKlaim, Key: "eklaim_kode_tarif", Description: "Kode Tarif RS Default (contoh: BP, CS, dll)", IsEncrypted: false, IsSecret: false, Default: ""},
}

// SatuSehat Config Keys - TANPA enkripsi, simpan plain text
var SatuSehatConfigKeys = []IntegrationConfigKey{
	{Integration: IntegrationTypeSatuSehat, Key: "client_id", Description: "Client ID dari SatuSehat", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeSatuSehat, Key: "client_secret", Description: "Client Secret dari SatuSehat", IsEncrypted: false, IsSecret: true, Default: ""},
	{Integration: IntegrationTypeSatuSehat, Key: "organization_id", Description: "Organization ID SatuSehat", IsEncrypted: false, IsSecret: false, Default: ""},
	{Integration: IntegrationTypeSatuSehat, Key: "environment", Description: "Environment: development atau production", IsEncrypted: false, IsSecret: false, Default: "development"},
	{Integration: IntegrationTypeSatuSehat, Key: "base_url_dev", Description: "Base URL Development", IsEncrypted: false, IsSecret: false, Default: "https://api-satusehat-stg.dto.kemkes.go.id"},
	{Integration: IntegrationTypeSatuSehat, Key: "base_url_prod", Description: "Base URL Production", IsEncrypted: false, IsSecret: false, Default: "https://api-satusehat.kemkes.go.id"},
	{Integration: IntegrationTypeSatuSehat, Key: "auto_sync_enabled", Description: "Enable auto sync", IsEncrypted: false, IsSecret: false, Default: "false"},
}

// GetAllIntegrationConfigKeys returns all config keys for all integrations
func GetAllIntegrationConfigKeys() []IntegrationConfigKey {
	var all []IntegrationConfigKey
	all = append(all, BPJSConfigKeys...)
	all = append(all, BPJSAntrianConfigKeys...)
	all = append(all, BPJSVClaimConfigKeys...)
	all = append(all, BPJSICareConfigKeys...)
	all = append(all, BPJSApotekConfigKeys...)
	all = append(all, BPJSRMEConfigKeys...)
	all = append(all, SatuSehatConfigKeys...)
	all = append(all, EKlaimConfigKeys...)
	return all
}

// GetIntegrationConfigKeys returns config keys for a specific integration
func GetIntegrationConfigKeys(integration IntegrationType) []IntegrationConfigKey {
	switch integration {
	case IntegrationTypeBPJS:
		return BPJSConfigKeys
	case IntegrationTypeBPJSAntrian:
		return BPJSAntrianConfigKeys
	case IntegrationTypeBPJSVClaim:
		return BPJSVClaimConfigKeys
	case IntegrationTypeBPJSICare:
		return BPJSICareConfigKeys
	case IntegrationTypeBPJSApotek:
		return BPJSApotekConfigKeys
	case IntegrationTypeBPJSRME:
		return BPJSRMEConfigKeys
	case IntegrationTypeSatuSehat:
		return SatuSehatConfigKeys
	case IntegrationTypeEKlaim:
		return EKlaimConfigKeys
	default:
		return nil
	}
}

// GetBPJSServiceName returns the display name for a BPJS service type
func GetBPJSServiceName(integration IntegrationType) string {
	switch integration {
	case IntegrationTypeBPJSAntrian:
		return "Antrian Online"
	case IntegrationTypeBPJSVClaim:
		return "VClaim"
	case IntegrationTypeBPJSICare:
		return "I-Care"
	case IntegrationTypeBPJSApotek:
		return "Apotek Online"
	case IntegrationTypeBPJSRME:
		return "RME"
	default:
		return "BPJS"
	}
}
