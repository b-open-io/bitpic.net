package handlers

import (
	"strconv"

	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// FeedHandler handles the /api/feed endpoint
type FeedHandler struct {
	redis *storage.RedisClient
}

// NewFeedHandler creates a new feed handler
func NewFeedHandler(redis *storage.RedisClient) *FeedHandler {
	return &FeedHandler{
		redis: redis,
	}
}

// Handle returns paginated feed items
func (h *FeedHandler) Handle(c *fiber.Ctx) error {
	// Parse query parameters
	offsetStr := c.Query("offset", "0")
	limitStr := c.Query("limit", "20")

	offset, err := strconv.ParseInt(offsetStr, 10, 64)
	if err != nil || offset < 0 {
		offset = 0
	}

	limit, err := strconv.ParseInt(limitStr, 10, 64)
	if err != nil || limit < 1 {
		limit = 20
	}

	// Cap limit at 100
	if limit > 100 {
		limit = 100
	}

	// Get feed items
	items, err := h.redis.GetFeed(offset, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch feed",
		})
	}

	// Return empty array if no items
	if items == nil {
		items = []storage.FeedItem{}
	}

	return c.JSON(items)
}
