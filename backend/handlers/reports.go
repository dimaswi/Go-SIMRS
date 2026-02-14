package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ====================================================================
// REPORT UTILITIES - Shared helpers for all report handlers
// ====================================================================

// ReportDateRange holds parsed date range from query params
type ReportDateRange struct {
	StartDate time.Time
	EndDate   time.Time
}

// ParseDateRange extracts start_date and end_date from query params.
// Defaults to current month if not provided.
func ParseDateRange(c *gin.Context) ReportDateRange {
	now := time.Now()
	startStr := c.Query("start_date")
	endStr := c.Query("end_date")

	startDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	endDate := now

	if startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = t
		}
	}
	if endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second) // End of day
		}
	}

	return ReportDateRange{StartDate: startDate, EndDate: endDate}
}

// IsExcelExport checks if the request wants Excel export
func IsExcelExport(c *gin.Context) bool {
	return c.Query("format") == "excel"
}

// ========================================
// Excel export helpers
// ========================================

// ExcelStyleConfig holds styling configuration
type ExcelStyleConfig struct {
	HeaderStyle int
	DataStyle   int
	NumberStyle int
	MoneyStyle  int
}

// NewExcelFile creates a new Excel file with a styled sheet
func NewExcelFile(sheetName string) (*excelize.File, *ExcelStyleConfig, error) {
	f := excelize.NewFile()
	// Rename default sheet
	idx, _ := f.GetSheetIndex("Sheet1")
	if idx >= 0 {
		f.SetSheetName("Sheet1", sheetName)
	}

	// Header style (bold, background color)
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"2B5797"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})

	// Data style
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10},
		Alignment: &excelize.Alignment{Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "D0D0D0", Style: 1},
			{Type: "right", Color: "D0D0D0", Style: 1},
			{Type: "top", Color: "D0D0D0", Style: 1},
			{Type: "bottom", Color: "D0D0D0", Style: 1},
		},
	})

	// Number style
	numberStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Size: 10},
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		NumFmt:       3, // #,##0
		CustomNumFmt: nil,
		Border: []excelize.Border{
			{Type: "left", Color: "D0D0D0", Style: 1},
			{Type: "right", Color: "D0D0D0", Style: 1},
			{Type: "top", Color: "D0D0D0", Style: 1},
			{Type: "bottom", Color: "D0D0D0", Style: 1},
		},
	})

	// Money style
	moneyFmt := "#,##0"
	moneyStyle, _ := f.NewStyle(&excelize.Style{
		Font:         &excelize.Font{Size: 10},
		Alignment:    &excelize.Alignment{Horizontal: "right", Vertical: "center"},
		CustomNumFmt: &moneyFmt,
		Border: []excelize.Border{
			{Type: "left", Color: "D0D0D0", Style: 1},
			{Type: "right", Color: "D0D0D0", Style: 1},
			{Type: "top", Color: "D0D0D0", Style: 1},
			{Type: "bottom", Color: "D0D0D0", Style: 1},
		},
	})

	return f, &ExcelStyleConfig{
		HeaderStyle: headerStyle,
		DataStyle:   dataStyle,
		NumberStyle: numberStyle,
		MoneyStyle:  moneyStyle,
	}, nil
}

// WriteExcelHeader writes header row to Excel sheet
func WriteExcelHeader(f *excelize.File, sheet string, headers []string, style int) {
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, style)
	}
}

// SendExcel sends the Excel file as a download response
func SendExcel(c *gin.Context, f *excelize.File, filename string) {
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.xlsx", filename))
	c.Header("Content-Transfer-Encoding", "binary")
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal generate file Excel"})
		return
	}
}

// columnName converts 1-based column index to Excel column letter (1=A, 2=B, 27=AA)
func columnName(col int) string {
	name, _ := excelize.ColumnNumberToName(col)
	return name
}
