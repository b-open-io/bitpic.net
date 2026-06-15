package handlers

import (
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
	"github.com/bsv-blockchain/go-sdk/transaction"
	"github.com/gofiber/fiber/v2"
)

// BroadcastHandler handles the /api/broadcast endpoint.
//
// The wallet broadcasts the BitPic transaction itself; this endpoint's job is
// to index it immediately (parse + verify + store) so the avatar appears
// without waiting for JungleBus to observe it on the network. JungleBus remains
// the backstop for anything not posted here.
type BroadcastHandler struct {
	arcURL string
	redis  *storage.RedisClient
}

// BroadcastRequest is the request body. RawTx may be a bare transaction or
// (atomic) BEEF — the wallet's sendBsv returns atomic BEEF.
type BroadcastRequest struct {
	RawTx string `json:"rawtx"`
}

// BroadcastResponse is the response.
type BroadcastResponse struct {
	Success bool   `json:"success"`
	TxID    string `json:"txid,omitempty"`
	Error   string `json:"error,omitempty"`
}

// NewBroadcastHandler creates a new broadcast handler.
func NewBroadcastHandler(arcURL string, redis *storage.RedisClient) *BroadcastHandler {
	return &BroadcastHandler{
		arcURL: arcURL,
		redis:  redis,
	}
}

// Handle parses, verifies, and stores a BitPic transaction immediately.
func (h *BroadcastHandler) Handle(c *fiber.Ctx) error {
	var req BroadcastRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
			Success: false,
			Error:   "Invalid request body",
		})
	}

	if req.RawTx == "" {
		return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
			Success: false,
			Error:   "Raw transaction is required",
		})
	}

	txBytes, err := extractTxBytes(req.RawTx)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	data, err := bitpic.ParseTransaction(txBytes)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	// Store immediately as unconfirmed (JungleBus upgrades it to confirmed and
	// SetAvatar is newest-wins, so re-indexing is safe).
	timestamp := time.Now().Unix()
	if err := h.redis.SetAvatar(data.Paymail, data.Outpoint, data.TxID, timestamp, false, data.IsRef, data.RefOrigin); err != nil {
		log.Printf("Failed to store avatar for %s: %v", data.Paymail, err)
		return c.Status(fiber.StatusInternalServerError).JSON(BroadcastResponse{
			Success: false,
			Error:   "failed to store avatar",
		})
	}

	refInfo := ""
	if data.IsRef {
		refInfo = fmt.Sprintf(" (ref -> %s)", data.RefOrigin)
	}
	log.Printf("Indexed BitPic avatar (unconfirmed): %s -> %s%s", data.Paymail, data.Outpoint, refInfo)

	return c.JSON(BroadcastResponse{Success: true, TxID: data.TxID})
}

// extractTxBytes returns the raw transaction bytes from either a bare tx hex or
// (atomic) BEEF hex.
func extractTxBytes(input string) ([]byte, error) {
	b, err := hex.DecodeString(input)
	if err != nil {
		return nil, fmt.Errorf("invalid transaction hex: %w", err)
	}
	// The wallet's sendBsv returns atomic BEEF; extract the subject tx.
	if tx, err := transaction.NewTransactionFromBEEF(b); err == nil && tx != nil {
		return tx.Bytes(), nil
	}
	// Otherwise assume a bare raw transaction.
	return b, nil
}
