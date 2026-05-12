package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"starter/backend/database"
	"starter/backend/models"
	"strings"

	"github.com/gin-gonic/gin"
)

const defaultBPJSFingerprintAppPath = `C:\Program Files (x86)\BPJS Kesehatan\Aplikasi Sidik Jari BPJS Kesehatan\After.exe`

type launchBPJSFingerprintRequest struct {
	ExecutablePath string `json:"executable_path"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	AutoSubmit     bool   `json:"auto_submit"`
}

// LaunchBPJSFingerprintApp opens the BPJS fingerprint desktop app and fills the login form.
func LaunchBPJSFingerprintApp(c *gin.Context) {
	var input launchBPJSFingerprintRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	if runtime.GOOS != "windows" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fitur ini hanya tersedia pada server Windows"})
		return
	}

	username := strings.TrimSpace(input.Username)
	password := strings.TrimSpace(input.Password)
	if username == "" || password == "" {
		configuredUsername, configuredPassword, err := loadBPJSFingerprintCredentials()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca konfigurasi sidik jari BPJS", "detail": err.Error()})
			return
		}
		if username == "" {
			username = configuredUsername
		}
		if password == "" {
			password = configuredPassword
		}
	}
	if username == "" || password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username dan password wajib diisi atau disimpan di setting BPJS VClaim"})
		return
	}

	executablePath := strings.TrimSpace(input.ExecutablePath)
	if executablePath == "" {
		executablePath = defaultBPJSFingerprintAppPath
	}
	executablePath = filepath.Clean(executablePath)

	if !strings.EqualFold(filepath.Ext(executablePath), ".exe") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path aplikasi harus mengarah ke file .exe"})
		return
	}

	fileInfo, err := os.Stat(executablePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File aplikasi sidik jari tidak ditemukan", "detail": err.Error()})
		return
	}
	if fileInfo.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path aplikasi sidik jari tidak valid"})
		return
	}

	script := buildBPJSFingerprintLaunchScript(executablePath, username, password, input.AutoSubmit)
	cmd := exec.Command(
		"powershell",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		script,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal membuka aplikasi sidik jari BPJS",
			"detail": sanitizePowerShellOutput(output),
		})
		return
	}

	message := "Aplikasi sidik jari BPJS berhasil dibuka dan field login terisi"
	if input.AutoSubmit {
		message = "Aplikasi sidik jari BPJS berhasil dibuka, field login terisi, dan login dikirim"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"data": gin.H{
			"executable_path": executablePath,
			"auto_submit":     input.AutoSubmit,
		},
	})
}

func buildBPJSFingerprintLaunchScript(executablePath, username, password string, autoSubmit bool) string {
	usernameKeys := escapeSendKeys(username)
	passwordKeys := escapeSendKeys(password)
	submitLine := ""
	if autoSubmit {
		submitLine = "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"
	}

	return fmt.Sprintf(`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell
$process = Start-Process -FilePath %s -PassThru
$activated = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  if ($process.HasExited) {
    throw 'Aplikasi sidik jari tertutup sebelum jendela siap digunakan.'
  }
  $process.Refresh()
  if ($process.MainWindowHandle -ne 0) {
    if ($wshell.AppActivate($process.Id)) {
      $activated = $true
      break
    }
  }
}
if (-not $activated) {
  throw 'Jendela aplikasi sidik jari tidak ditemukan. Pastikan backend berjalan pada desktop Windows yang sama dengan pengguna.'
}
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait(%s)
[System.Windows.Forms.SendKeys]::SendWait('{TAB}')
[System.Windows.Forms.SendKeys]::SendWait(%s)
%s
`, quotePowerShellString(executablePath), quotePowerShellString(usernameKeys), quotePowerShellString(passwordKeys), submitLine)
}

func quotePowerShellString(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

func sanitizePowerShellOutput(output []byte) string {
	trimmed := strings.TrimSpace(string(output))
	if trimmed == "" {
		return "Tidak ada detail error dari PowerShell"
	}
	return trimmed
}

func escapeSendKeys(value string) string {
	replacer := strings.NewReplacer(
		"{", "{{}",
		"}", "{}}",
		"+", "{+}",
		"^", "{^}",
		"%", "{%}",
		"~", "{~}",
		"(", "{(}",
		")", "{)}",
		"[", "{[}",
		"]", "{]}",
		"\n", " ",
		"\r", " ",
		"\t", " ",
	)
	return replacer.Replace(value)
}

func loadBPJSFingerprintCredentials() (string, string, error) {
	var configs []models.IntegrationConfig
	if err := database.DB.Where(
		"integration = ? AND key IN ?",
		models.IntegrationTypeBPJSVClaim,
		[]string{"fingerprint_username", "fingerprint_password"},
	).Find(&configs).Error; err != nil {
		return "", "", err
	}

	values := make(map[string]string, len(configs))
	for _, config := range configs {
		values[config.Key] = strings.TrimSpace(config.Value)
	}

	return values["fingerprint_username"], values["fingerprint_password"], nil
}