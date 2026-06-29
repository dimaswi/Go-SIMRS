package handlers

import (
	"fmt"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func formatInpatientClass(class string) string {
	classMap := map[string]string{
		"kelas_1":   "Kelas 1",
		"kelas_2":   "Kelas 2",
		"kelas_3":   "Kelas 3",
		"non_kelas": "Non Kelas",
		"vip":       "VIP",
		"vvip":      "VVIP",
		"hcu":       "HCU",
		"intensif":  "Intensif",
		"isolasi":   "Isolasi",
		"icu":       "ICU",
		"nicu":      "NICU",
		"picu":      "PICU",
	}
	if label, ok := classMap[class]; ok {
		return label
	}
	if class == "" {
		return "-"
	}
	return class
}

// formatDateIndonesian formats date to Indonesian format (e.g. "31 Januari 2026")
func formatDateIndonesian(t time.Time) string {
	months := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	return fmt.Sprintf("%d %s %d", t.Day(), months[t.Month()], t.Year())
}

// formatDateTimeIndonesian formats datetime to Indonesian format (e.g. "31 Januari 2026, 14:30 WIB")
func formatDateTimeIndonesian(t time.Time) string {
	months := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	return fmt.Sprintf("%d %s %d, %02d:%02d WIB", t.Day(), months[t.Month()], t.Year(), t.Hour(), t.Minute())
}

func calculateAgeYears(birthDate time.Time) int {
	today := time.Now()
	years := today.Year() - birthDate.Year()
	if today.YearDay() < birthDate.YearDay() {
		years--
	}
	return years
}

func truncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen-3] + "..."
}

// formatEnumDisplay converts stored enum-like values to printable labels.
// Example: perut_atas -> Perut Atas
func formatEnumDisplay(value string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return ""
	}
	v = strings.ReplaceAll(v, "_", " ")
	v = strings.ReplaceAll(v, "-", " ")
	return strings.Title(strings.ToLower(v))
}

func formatPainMethodDisplay(value string) string {
	methodMap := map[string]string{
		"nrs":          "NRS",
		"wong_baker":   "Wong-Baker",
		"vas":          "VAS",
		"flacc":        "FLACC",
		"bps":          "BPS",
		"numeric":      "Numeric",
		"numeric_rate": "Numeric Rate",
	}
	key := strings.ToLower(strings.TrimSpace(value))
	if label, ok := methodMap[key]; ok {
		return label
	}
	return formatEnumDisplay(value)
}

func painScaleWithSeverity(scale int) string {
	severity := "Tidak Nyeri"
	if scale >= 1 && scale <= 3 {
		severity = "Ringan"
	} else if scale >= 4 && scale <= 6 {
		severity = "Sedang"
	} else if scale >= 7 {
		severity = "Berat"
	}
	return fmt.Sprintf("%d/10 (%s)", scale, severity)
}

func diagnosisTypeRank(t string) int {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "primary":
		return 0
	case "secondary":
		return 1
	case "differential":
		return 2
	default:
		return 3
	}
}

func parseLeadingInt(value string) int {
	digits := ""
	for _, ch := range value {
		if ch >= '0' && ch <= '9' {
			digits += string(ch)
		} else if digits != "" {
			break
		}
	}
	if digits == "" {
		return 0
	}
	n, err := strconv.Atoi(digits)
	if err != nil {
		return 0
	}
	return n
}

func safeString(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func normalizeCPPTFormatForPrint(format string) string {
	v := strings.ToLower(strings.TrimSpace(format))
	switch v {
	case models.CPPTFormatSBAR:
		return models.CPPTFormatSBAR
	case models.CPPTFormatTBAK:
		return models.CPPTFormatTBAK
	default:
		return models.CPPTFormatSOAP
	}
}

func cpptFormatHeaders(format string, mixed bool) [4]string {
	if mixed {
		return [4]string{"Catatan 1", "Catatan 2", "Catatan 3", "Catatan 4"}
	}

	switch normalizeCPPTFormatForPrint(format) {
	case models.CPPTFormatSBAR:
		return [4]string{"Situation", "Background", "Assessment", "Recommendation"}
	case models.CPPTFormatTBAK:
		return [4]string{"Tulis", "Baca Kembali", "Analisis", "Konfirmasi"}
	default:
		return [4]string{"Subjective", "Objective", "Assessment", "Plan"}
	}
}

func cpptFormatPrefixes(format string) [4]string {
	switch normalizeCPPTFormatForPrint(format) {
	case models.CPPTFormatSBAR:
		return [4]string{"S", "B", "A", "R"}
	case models.CPPTFormatTBAK:
		return [4]string{"T", "B", "A", "K"}
	default:
		return [4]string{"S", "O", "A", "P"}
	}
}

func buildCPPTFieldTextsForPrint(cppt models.CPPT, addPrefix bool) [4]string {
	fields := [4]string{
		strings.TrimSpace(cppt.Subjective),
		strings.TrimSpace(cppt.Objective),
		strings.TrimSpace(cppt.Assessment),
		strings.TrimSpace(cppt.Plan),
	}

	if strings.TrimSpace(cppt.Instruction) != "" {
		if fields[3] != "" {
			fields[3] += "\nInstruksi: " + strings.TrimSpace(cppt.Instruction)
		} else {
			fields[3] = "Instruksi: " + strings.TrimSpace(cppt.Instruction)
		}
	}

	if addPrefix {
		prefixes := cpptFormatPrefixes(cppt.CPPTFormat)
		for i := range fields {
			if fields[i] != "" {
				fields[i] = prefixes[i] + ": " + fields[i]
			}
		}
	}

	for i := range fields {
		if fields[i] == "" {
			fields[i] = "-"
		}
		fields[i] = truncateText(fields[i], 320)
	}

	return fields
}

// parseFollowUpDate parses string date to *time.Time for RM Duplicate
func parseFollowUpDate(dateStr string) *time.Time {
	if dateStr == "" {
		return nil
	}
	// Try multiple date formats
	formats := []string{
		"2006-01-02",
		"2006-01-02 15:04:05",
		time.RFC3339,
	}
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return &t
		}
	}
	return nil
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
