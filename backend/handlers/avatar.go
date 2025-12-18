package handlers

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/image/draw"
)

// AvatarHandler handles the /u/:paymail endpoint
type AvatarHandler struct {
	redis    *storage.RedisClient
	ordfsURL string
	cacheTTL time.Duration
}

// Standard avatar sizes - these are cached
var allowedSizes = map[int]bool{
	32:  true,
	64:  true,
	128: true,
	256: true,
	512: true,
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
// Supports size query parameter: ?size=64, ?size=128, ?size=256, ?size=512
func (h *AvatarHandler) Handle(c *fiber.Ctx) error {
	paymail := c.Params("paymail")
	if paymail == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Paymail is required")
	}

	// Parse size parameter (default: original size, 0 means no resize)
	sizeStr := c.Query("size", "0")
	size, err := strconv.Atoi(sizeStr)
	if err != nil || size < 0 {
		size = 0
	}

	// Clamp to allowed sizes for caching efficiency
	if size > 0 && !allowedSizes[size] {
		// Find nearest allowed size
		size = nearestAllowedSize(size)
	}

	// Get outpoint from Redis
	outpoint, err := h.redis.GetAvatar(paymail)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Failed to fetch avatar")
	}

	if outpoint == "" {
		return c.Status(fiber.StatusNotFound).SendString("Avatar not found")
	}

	// Build cache key with size
	cacheKey := outpoint
	if size > 0 {
		cacheKey = fmt.Sprintf("%s_%d", outpoint, size)
	}

	// Check cache first
	cached, err := h.redis.GetCachedImage(cacheKey)
	if err == nil && cached != nil {
		contentType := detectContentType(cached)
		if contentType == "" || !isAllowedContentType(contentType) {
			return c.Status(fiber.StatusUnsupportedMediaType).SendString("Unsupported image format")
		}

		c.Set("Content-Type", contentType)
		c.Set("Content-Security-Policy", "default-src 'none'")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Cache-Control", "public, max-age=2592000") // 30 days
		return c.Send(cached)
	}

	// Fetch original from ORDFS (or cache)
	var imageData []byte
	cached, err = h.redis.GetCachedImage(outpoint)
	if err == nil && cached != nil {
		imageData = cached
	} else {
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

		imageData, err = io.ReadAll(resp.Body)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Failed to read image data")
		}

		// Cache original
		if err := h.redis.CacheImage(outpoint, imageData, h.cacheTTL); err != nil {
			fmt.Printf("Failed to cache original image: %v\n", err)
		}
	}

	contentType := detectContentType(imageData)
	if contentType == "" || !isAllowedContentType(contentType) {
		return c.Status(fiber.StatusUnsupportedMediaType).SendString("Unsupported image format")
	}

	// Resize if requested
	if size > 0 {
		resized, err := resizeImage(imageData, size, contentType)
		if err != nil {
			fmt.Printf("Failed to resize image: %v\n", err)
			// Fall back to original
		} else {
			imageData = resized
			// Cache resized version
			if err := h.redis.CacheImage(cacheKey, imageData, h.cacheTTL); err != nil {
				fmt.Printf("Failed to cache resized image: %v\n", err)
			}
		}
	}

	c.Set("Content-Type", contentType)
	c.Set("Content-Security-Policy", "default-src 'none'")
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Cache-Control", "public, max-age=2592000") // 30 days
	return c.Send(imageData)
}

// nearestAllowedSize finds the nearest allowed size
func nearestAllowedSize(requested int) int {
	sizes := []int{32, 64, 128, 256, 512}
	nearest := sizes[len(sizes)-1]
	minDiff := abs(requested - nearest)

	for _, s := range sizes {
		diff := abs(requested - s)
		if diff < minDiff {
			minDiff = diff
			nearest = s
		}
	}
	return nearest
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// resizeImage resizes an image to the specified size (square, maintains aspect ratio with crop)
func resizeImage(data []byte, size int, contentType string) ([]byte, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Create square output
	dst := image.NewRGBA(image.Rect(0, 0, size, size))

	// Calculate crop region for center square
	bounds := img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	var cropRect image.Rectangle
	if srcW > srcH {
		// Landscape - crop sides
		offset := (srcW - srcH) / 2
		cropRect = image.Rect(offset, 0, offset+srcH, srcH)
	} else {
		// Portrait or square - crop top/bottom
		offset := (srcH - srcW) / 2
		cropRect = image.Rect(0, offset, srcW, offset+srcW)
	}

	// Create cropped subimage
	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}
	if si, ok := img.(subImager); ok {
		img = si.SubImage(cropRect)
	}

	// Scale to target size with high-quality interpolation
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)

	// Encode back to original format
	var buf bytes.Buffer
	switch contentType {
	case "image/png":
		err = png.Encode(&buf, dst)
	case "image/jpeg":
		err = jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85})
	case "image/gif":
		err = gif.Encode(&buf, dst, nil)
	default:
		// Default to JPEG for unknown types
		err = jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	return buf.Bytes(), nil
}

// detectContentType detects the content type of image data
// Only allows safe image formats (blocks SVG for XSS protection)
func detectContentType(data []byte) string {
	if len(data) < 12 {
		return ""
	}

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
