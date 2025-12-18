package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// AvatarHandler handles the /u/:paymail endpoint
type AvatarHandler struct {
	redis     *storage.RedisClient
	ordfsURL  string
	cacheTTL  time.Duration
}

// NewAvatarHandler creates a new avatar handler
func NewAvatarHandler(redis *storage.RedisClient, ordfsURL string, cacheTTL time.Duration) *AvatarHandler {
	return &AvatarHandler{
		redis:    redis,
		ordfsURL: ordfsURL,
		cacheTTL: cacheTTL,
	}
}

// Handle fetches and returns the avatar image
func (h *AvatarHandler) Handle(c *fiber.Ctx) error {
	paymail := c.Params("paymail")
	if paymail == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Paymail is required")
	}

	// Get outpoint from Redis
	outpoint, err := h.redis.GetAvatar(paymail)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Failed to fetch avatar")
	}

	if outpoint == "" {
		return c.Status(fiber.StatusNotFound).SendString("Avatar not found")
	}

	// Check cache first
	cached, err := h.redis.GetCachedImage(outpoint)
	if err == nil && cached != nil {
		// Detect content type from cached data
		contentType := detectContentType(cached)
		if contentType == "" || !isAllowedContentType(contentType) {
			return c.Status(fiber.StatusUnsupportedMediaType).SendString("Unsupported image format")
		}

		// Set security headers
		c.Set("Content-Type", contentType)
		c.Set("Content-Security-Policy", "default-src 'none'")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Cache-Control", "public, max-age=2592000") // 30 days
		return c.Send(cached)
	}

	// Fetch from ORDFS
	url := fmt.Sprintf("%s/content/%s", h.ordfsURL, outpoint)
	resp, err := http.Get(url)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Failed to fetch image from ORDFS")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusNotFound).SendString("Image not found on ORDFS")
	}

	// Read image data
	imageData, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Failed to read image data")
	}

	// Get content type from response or detect it
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = detectContentType(imageData)
	}

	// Validate content type
	if contentType == "" || !isAllowedContentType(contentType) {
		return c.Status(fiber.StatusUnsupportedMediaType).SendString("Unsupported image format")
	}

	// Cache the image
	if err := h.redis.CacheImage(outpoint, imageData, h.cacheTTL); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Failed to cache image: %v\n", err)
	}

	// Set security headers and return image
	c.Set("Content-Type", contentType)
	c.Set("Content-Security-Policy", "default-src 'none'")
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Cache-Control", "public, max-age=2592000") // 30 days
	return c.Send(imageData)
}

// detectContentType detects the content type of image data
// Only allows safe image formats (blocks SVG for XSS protection)
func detectContentType(data []byte) string {
	if len(data) < 12 {
		return ""
	}

	// Check for common image formats
	switch {
	case len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47:
		return "image/png"
	case len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF:
		return "image/jpeg"
	case len(data) >= 6 && data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46:
		return "image/gif"
	case len(data) >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
		data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50:
		return "image/webp"
	default:
		// Unsupported format (including SVG which is blocked for security)
		return ""
	}
}

// isAllowedContentType checks if the content type is allowed
func isAllowedContentType(contentType string) bool {
	allowed := []string{
		"image/png",
		"image/jpeg",
		"image/gif",
		"image/webp",
	}

	for _, t := range allowed {
		if contentType == t {
			return true
		}
	}
	return false
}
