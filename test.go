package main

import (
	"fmt"
	"strings"
)

func formatNumericString(s string) string {
	var result strings.Builder
	var currentNum string

	formatIntPart := func(numStr string) string {
		n := len(numStr)
		if n <= 3 {
			return numStr
		}
		var res []byte
		for i, c := range numStr {
			if i > 0 && (n-i)%3 == 0 {
				res = append(res, '.')
			}
			res = append(res, byte(c))
		}
		return string(res)
	}

	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= '0' && c <= '9' {
			currentNum += string(c)
		} else {
			if currentNum != "" {
				result.WriteString(formatIntPart(currentNum))
				currentNum = ""
			}
			result.WriteByte(c)
		}
	}
	if currentNum != "" {
		result.WriteString(formatIntPart(currentNum))
	}

	return result.String()
}

func main() {
	fmt.Println("4000.00 - 10000.00 =>", formatNumericString("4000.00 - 10000.00"))
	fmt.Println("5000000 =>", formatNumericString("5000000"))
	fmt.Println("10.5 =>", formatNumericString("10.5"))
	fmt.Println("25000,50 =>", formatNumericString("25000,50"))
}
