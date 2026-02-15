package eklaim

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"strings"
)

// ==========================================================================
// AES-256-CBC Encryption/Decryption untuk komunikasi dengan E-Klaim server
//
// Port dari fungsi PHP:
//   - inacbg_encrypt($data, $key)
//   - inacbg_decrypt($str, $strkey)
//   - inacbg_compare($a, $b)
//
// Alur:
//   Request:  JSON → encrypt(AES-256-CBC) → base64 → POST body
//   Response: base64 → decrypt(AES-256-CBC) → JSON
//
// Format payload terenkripsi: signature(10 bytes) + iv(16 bytes) + ciphertext
// Signature = HMAC-SHA256(ciphertext, key)[:10]
// ==========================================================================

var (
	ErrInvalidKeyLength  = errors.New("eklaim crypto: key harus 256-bit (64 hex chars → 32 bytes)")
	ErrSignatureNotMatch = errors.New("eklaim crypto: SIGNATURE_NOT_MATCH")
	ErrDecryptionFailed  = errors.New("eklaim crypto: gagal mendekripsi data")
	ErrInvalidPayload    = errors.New("eklaim crypto: payload terlalu pendek")
	ErrResponseFormat    = errors.New("eklaim crypto: format response tidak valid")
)

// hexKeyToBytes converts hex-encoded key string to 32-byte key.
// E-Klaim API key is provided as hex string.
func hexKeyToBytes(hexKey string) ([]byte, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, ErrInvalidKeyLength
	}
	if len(key) != 32 {
		return nil, ErrInvalidKeyLength
	}
	return key, nil
}

// Encrypt encrypts plaintext using AES-256-CBC with HMAC-SHA256 signature.
// Matches PHP inacbg_encrypt() function exactly.
//
// Steps:
//  1. Decode hex key to binary (32 bytes)
//  2. Generate random IV (16 bytes for AES-CBC)
//  3. PKCS7 pad the plaintext
//  4. Encrypt with AES-256-CBC
//  5. Create signature = HMAC-SHA256(ciphertext, key)[:10]
//  6. Combine: signature + iv + ciphertext
//  7. Base64 encode and chunk-split (76 chars per line)
func Encrypt(plaintext string, hexKey string) (string, error) {
	key, err := hexKeyToBytes(hexKey)
	if err != nil {
		return "", err
	}

	// Create AES cipher block
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Generate random IV
	iv := make([]byte, aes.BlockSize) // 16 bytes
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// PKCS7 pad the plaintext
	plaintextBytes := pkcs7Pad([]byte(plaintext), aes.BlockSize)

	// Encrypt with AES-256-CBC
	ciphertext := make([]byte, len(plaintextBytes))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, plaintextBytes)

	// Create signature: first 10 bytes of HMAC-SHA256(ciphertext, key)
	signature := createSignature(ciphertext, key)

	// Combine: signature(10) + iv(16) + ciphertext
	combined := make([]byte, 0, len(signature)+len(iv)+len(ciphertext))
	combined = append(combined, signature...)
	combined = append(combined, iv...)
	combined = append(combined, ciphertext...)

	// Base64 encode
	encoded := base64.StdEncoding.EncodeToString(combined)

	// Chunk split (76 chars per line, matching PHP chunk_split)
	encoded = chunkSplit(encoded, 76, "\r\n")

	return encoded, nil
}

// Decrypt decrypts AES-256-CBC encrypted data from E-Klaim server.
// Matches PHP inacbg_decrypt() function exactly.
//
// Steps:
//  1. Decode hex key to binary
//  2. Base64 decode the input
//  3. Extract: signature(10) + iv(16) + ciphertext(rest)
//  4. Verify HMAC-SHA256 signature (timing-safe compare)
//  5. Decrypt with AES-256-CBC
//  6. Remove PKCS7 padding
func Decrypt(encoded string, hexKey string) (string, error) {
	key, err := hexKeyToBytes(hexKey)
	if err != nil {
		return "", err
	}

	// Base64 decode
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil {
		// Try with RawStdEncoding if standard fails
		decoded, err = base64.RawStdEncoding.DecodeString(strings.TrimSpace(encoded))
		if err != nil {
			return "", ErrDecryptionFailed
		}
	}

	// Minimum size: signature(10) + iv(16) + 1 block(16) = 42
	if len(decoded) < 42 {
		return "", ErrInvalidPayload
	}

	// Extract parts
	ivSize := aes.BlockSize // 16
	signature := decoded[:10]
	iv := decoded[10 : 10+ivSize]
	ciphertext := decoded[10+ivSize:]

	// Verify signature (timing-safe comparison)
	calcSignature := createSignature(ciphertext, key)
	if !constantTimeCompare(signature, calcSignature) {
		return "", ErrSignatureNotMatch
	}

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Decrypt
	if len(ciphertext)%aes.BlockSize != 0 {
		return "", ErrDecryptionFailed
	}
	plaintext := make([]byte, len(ciphertext))
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(plaintext, ciphertext)

	// Remove PKCS7 padding
	plaintext, err = pkcs7Unpad(plaintext, aes.BlockSize)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// StripResponseEnvelope removes the E-Klaim response envelope markers.
// E-Klaim response has the format:
//
//	----BEGIN ENCRYPTED DATA----\r\n
//	<base64 encoded encrypted data>\r\n
//	----END ENCRYPTED DATA----\r\n
//
// This function strips those markers and returns the raw base64 content.
func StripResponseEnvelope(response string) string {
	// Remove "----BEGIN ENCRYPTED DATA----\r\n" from start
	// Remove "----END ENCRYPTED DATA----\r\n" from end
	response = strings.TrimSpace(response)

	// Check if it has the envelope markers
	if strings.Contains(response, "BEGIN ENCRYPTED DATA") {
		// Find first newline (after BEGIN marker)
		firstNewline := strings.Index(response, "\n")
		if firstNewline >= 0 {
			response = response[firstNewline+1:]
		}

		// Find last newline before END marker
		lastMarker := strings.LastIndex(response, "----END")
		if lastMarker >= 0 {
			response = response[:lastMarker]
		}
	}

	// Remove all whitespace/newlines from base64 string
	response = strings.ReplaceAll(response, "\r", "")
	response = strings.ReplaceAll(response, "\n", "")
	response = strings.TrimSpace(response)

	return response
}

// createSignature creates first 10 bytes of HMAC-SHA256(data, key)
func createSignature(data, key []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	fullMAC := mac.Sum(nil)
	return fullMAC[:10]
}

// constantTimeCompare performs timing-safe comparison.
// Matches PHP inacbg_compare() function.
func constantTimeCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

// pkcs7Pad pads data to blockSize using PKCS7 padding
func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	padBytes := make([]byte, padding)
	for i := range padBytes {
		padBytes[i] = byte(padding)
	}
	return append(data, padBytes...)
}

// pkcs7Unpad removes PKCS7 padding
func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 || len(data)%blockSize != 0 {
		return nil, ErrDecryptionFailed
	}
	padding := int(data[len(data)-1])
	if padding < 1 || padding > blockSize {
		return nil, ErrDecryptionFailed
	}
	for i := len(data) - padding; i < len(data); i++ {
		if data[i] != byte(padding) {
			return nil, ErrDecryptionFailed
		}
	}
	return data[:len(data)-padding], nil
}

// chunkSplit splits a string into chunks of given length, joined by separator.
// Matches PHP chunk_split().
func chunkSplit(str string, chunkLen int, end string) string {
	if len(str) == 0 {
		return ""
	}
	var result strings.Builder
	for i := 0; i < len(str); i += chunkLen {
		endIdx := i + chunkLen
		if endIdx > len(str) {
			endIdx = len(str)
		}
		result.WriteString(str[i:endIdx])
		result.WriteString(end)
	}
	return result.String()
}
