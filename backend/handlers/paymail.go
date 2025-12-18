package handlers

import (
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// PaymailHandler handles paymail-related endpoints
type PaymailHandler struct {
	redis *storage.RedisClient
}

// NewPaymailHandler creates a new paymail handler
func NewPaymailHandler(redis *storage.RedisClient) *PaymailHandler {
	return &PaymailHandler{
		redis: redis,
	}
}

// Get returns paymail data for a handle
func (h *PaymailHandler) Get(c *fiber.Ctx) error {
	handle := c.Params("handle")
	if handle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Handle is required",
		})
	}

	paymail, err := h.redis.GetPaymail(handle)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch paymail",
		})
	}

	if paymail == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Paymail not found",
		})
	}

	return c.JSON(paymail)
}

// Register creates a new paymail record
func (h *PaymailHandler) Register(c *fiber.Ctx) error {
	var req storage.PaymailData
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Handle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Handle is required",
		})
	}
	if req.PaymentAddress == "" || req.PaymentPubkey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Payment address and pubkey are required",
		})
	}

	// Check if handle already exists
	existing, _ := h.redis.GetPaymail(req.Handle)
	if existing != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Handle already taken",
		})
	}

	// Store paymail
	if err := h.redis.SetPaymail(&req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to register paymail",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"paymail": req.Handle + "@bitpic.net",
	})
}

// CheckAvailable checks if a handle is available
func (h *PaymailHandler) CheckAvailable(c *fiber.Ctx) error {
	handle := c.Params("handle")
	if handle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Handle is required",
		})
	}

	existing, _ := h.redis.GetPaymail(handle)
	available := existing == nil

	return c.JSON(fiber.Map{
		"available": available,
		"handle":    handle,
	})
}
