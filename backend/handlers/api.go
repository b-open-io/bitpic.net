package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// APIHandler handles the /api/avatar/:paymail endpoint
type APIHandler struct {
	redis     *storage.RedisClient
	ordfsURL  string
}

// AvatarMetadata represents avatar metadata returned by the API
type AvatarMetadata struct {
	Paymail  string `json:"paymail"`
	Outpoint string `json:"outpoint"`
	URL      string `json:"url"`
	Exists   bool   `json:"exists"`
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(redis *storage.RedisClient, ordfsURL string) *APIHandler {
	return &APIHandler{
		redis:    redis,
		ordfsURL: ordfsURL,
	}
}

// Handle returns avatar metadata
func (h *APIHandler) Handle(c *fiber.Ctx) error {
	paymail := c.Params("paymail")
	if paymail == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Paymail is required",
		})
	}

	outpoint, err := h.redis.GetAvatar(paymail)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch avatar",
		})
	}

	if outpoint == "" {
		return c.JSON(AvatarMetadata{
			Paymail: paymail,
			Exists:  false,
		})
	}

	return c.JSON(AvatarMetadata{
		Paymail:  paymail,
		Outpoint: outpoint,
		URL:      fmt.Sprintf("%s/content/%s", h.ordfsURL, outpoint),
		Exists:   true,
	})
}

// GetAvatarData fetches avatar metadata
func (h *APIHandler) GetAvatarData(paymail string) ([]byte, error) {
	outpoint, err := h.redis.GetAvatar(paymail)
	if err != nil {
		return nil, err
	}

	if outpoint == "" {
		return nil, fmt.Errorf("avatar not found")
	}

	data := AvatarMetadata{
		Paymail:  paymail,
		Outpoint: outpoint,
		URL:      fmt.Sprintf("%s/content/%s", h.ordfsURL, outpoint),
		Exists:   true,
	}

	return json.Marshal(data)
}
