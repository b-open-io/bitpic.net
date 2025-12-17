package handlers

import (
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// ExistsHandler handles the /api/exists/:paymail endpoint
type ExistsHandler struct {
	redis *storage.RedisClient
}

// NewExistsHandler creates a new exists handler
func NewExistsHandler(redis *storage.RedisClient) *ExistsHandler {
	return &ExistsHandler{
		redis: redis,
	}
}

// Handle returns "1" if avatar exists, "0" otherwise
func (h *ExistsHandler) Handle(c *fiber.Ctx) error {
	paymail := c.Params("paymail")
	if paymail == "" {
		return c.Status(fiber.StatusBadRequest).SendString("0")
	}

	exists, err := h.redis.Exists(paymail)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("0")
	}

	if exists {
		return c.SendString("1")
	}
	return c.SendString("0")
}
