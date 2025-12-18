package handlers

import (
	"time"

	"github.com/b-open-io/bitpic/junglebus"
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// StatusHandler handles the /api/status endpoint
type StatusHandler struct {
	redis      *storage.RedisClient
	subscriber *junglebus.Subscriber
}

// StatusResponse represents the status response
type StatusResponse struct {
	LastBlock     uint64 `json:"lastBlock"`
	LastBlockTime string `json:"lastBlockTime"`
	TotalAvatars  int64  `json:"totalAvatars"`
	Connected     bool   `json:"connected"`
	Syncing       bool   `json:"syncing"`
}

// NewStatusHandler creates a new status handler
func NewStatusHandler(redis *storage.RedisClient, subscriber *junglebus.Subscriber) *StatusHandler {
	return &StatusHandler{
		redis:      redis,
		subscriber: subscriber,
	}
}

// Handle returns the current system status
func (h *StatusHandler) Handle(c *fiber.Ctx) error {
	// Get total avatars
	totalAvatars, err := h.redis.GetTotalAvatars()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get total avatars",
		})
	}

	// Get subscriber status
	connected, syncing, lastBlock, lastBlockTime := h.subscriber.GetStatus()

	// Format last block time
	var lastBlockTimeStr string
	if !lastBlockTime.IsZero() {
		lastBlockTimeStr = lastBlockTime.Format(time.RFC3339)
	}

	return c.JSON(StatusResponse{
		LastBlock:     lastBlock,
		LastBlockTime: lastBlockTimeStr,
		TotalAvatars:  totalAvatars,
		Connected:     connected,
		Syncing:       syncing,
	})
}
