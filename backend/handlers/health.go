package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
}

// Health handles the /health endpoint
func Health(c *fiber.Ctx) error {
	return c.JSON(HealthResponse{
		Status: "ok",
	})
}
