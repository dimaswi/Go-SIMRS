package handlers

import "time"

// WIB is the Asia/Jakarta timezone (UTC+7)
var WIB *time.Location

func init() {
	var err error
	WIB, err = time.LoadLocation("Asia/Jakarta")
	if err != nil {
		WIB = time.FixedZone("WIB", 7*60*60)
	}
}

// ParseLocalDatetime parses a datetime string as local time (WIB).
// Supports formats: "2006-01-02T15:04", "2006-01-02 15:04"
// Falls back to time.Now() if parsing fails.
func ParseLocalDatetime(s string) time.Time {
	if t, err := time.ParseInLocation("2006-01-02T15:04", s, WIB); err == nil {
		return t
	}
	if t, err := time.ParseInLocation("2006-01-02 15:04", s, WIB); err == nil {
		return t
	}
	if t, err := time.ParseInLocation(time.RFC3339, s, WIB); err == nil {
		return t
	}
	return time.Now()
}

// TryParseLocalDatetime is like ParseLocalDatetime but returns ok=false on failure.
func TryParseLocalDatetime(s string) (time.Time, bool) {
	if t, err := time.ParseInLocation("2006-01-02T15:04", s, WIB); err == nil {
		return t, true
	}
	if t, err := time.ParseInLocation("2006-01-02 15:04", s, WIB); err == nil {
		return t, true
	}
	if t, err := time.ParseInLocation(time.RFC3339, s, WIB); err == nil {
		return t, true
	}
	return time.Time{}, false
}

// ParseLocalDate parses a date-only string as local time (WIB).
func ParseLocalDate(s string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", s, WIB)
}
