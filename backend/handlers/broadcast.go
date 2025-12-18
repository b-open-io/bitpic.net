package handlers

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// BroadcastHandler handles the /api/broadcast endpoint
type BroadcastHandler struct {
	arcURL string
	redis  *storage.RedisClient
}

// ARCResponse represents the response from ARC
type ARCResponse struct {
	TxID        string `json:"txid"`
	BlockHash   string `json:"blockHash,omitempty"`
	BlockHeight int64  `json:"blockHeight,omitempty"`
	ExtraInfo   string `json:"extraInfo,omitempty"`
	Status      int    `json:"status"`
	Title       string `json:"title,omitempty"`
	Detail      string `json:"detail,omitempty"`
}

// BroadcastRequest represents the broadcast request body
type BroadcastRequest struct {
	RawTx string `json:"rawtx"`
}

// BroadcastResponse represents the response
type BroadcastResponse struct {
	Success bool   `json:"success"`
	TxID    string `json:"txid,omitempty"`
	Error   string `json:"error,omitempty"`
}

// NewBroadcastHandler creates a new broadcast handler
func NewBroadcastHandler(arcURL string, redis *storage.RedisClient) *BroadcastHandler {
	return &BroadcastHandler{
		arcURL: arcURL,
		redis:  redis,
	}
}

// Handle broadcasts a transaction via ARC
func (h *BroadcastHandler) Handle(c *fiber.Ctx) error {
	// Parse request body
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

	// Broadcast to ARC
	txid, err := h.broadcastToARC(req.RawTx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(BroadcastResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	// Immediately parse and store the transaction (don't wait for JungleBus)
	go h.parseAndStore(req.RawTx, txid)

	return c.JSON(BroadcastResponse{
		Success: true,
		TxID:    txid,
	})
}

// parseAndStore parses and stores a BitPic transaction immediately after broadcast
func (h *BroadcastHandler) parseAndStore(rawTxHex, txid string) {
	// Decode hex transaction
	txBytes, err := hex.DecodeString(rawTxHex)
	if err != nil {
		log.Printf("Failed to decode transaction %s: %v", txid, err)
		return
	}

	// Parse BitPic data
	data, err := bitpic.ParseTransaction(txBytes)
	if err != nil {
		// Not a BitPic transaction or parsing failed
		log.Printf("Failed to parse BitPic transaction %s: %v", txid, err)
		return
	}

	// Use current time for unconfirmed transaction
	timestamp := time.Now().Unix()
	data.Timestamp = timestamp

	// Store in Redis as unconfirmed
	if err := h.redis.SetAvatar(data.Paymail, data.Outpoint, txid, timestamp, false); err != nil {
		log.Printf("Failed to store avatar for %s: %v", data.Paymail, err)
		return
	}

	log.Printf("Immediately stored BitPic avatar (unconfirmed): %s -> %s", data.Paymail, data.Outpoint)
}

// broadcastToARC broadcasts a transaction to ARC
func (h *BroadcastHandler) broadcastToARC(rawTx string) (string, error) {
	url := fmt.Sprintf("%s/v1/tx", h.arcURL)

	// Create request body
	body := map[string]interface{}{
		"rawTx": rawTx,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to broadcast: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// Parse ARC response
	var arcResp ARCResponse
	if err := json.Unmarshal(respBody, &arcResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for errors
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		if arcResp.Detail != "" {
			return "", fmt.Errorf("ARC error: %s", arcResp.Detail)
		}
		return "", fmt.Errorf("ARC returned status %d", resp.StatusCode)
	}

	if arcResp.TxID == "" {
		return "", fmt.Errorf("no txid in response")
	}

	return arcResp.TxID, nil
}
