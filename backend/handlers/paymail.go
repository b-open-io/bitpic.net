package handlers

import (
	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
)

// feeTolerance is the satoshi shortfall we accept between the fee the wallet
// quoted (at the exchange rate when the user paid) and what actually landed
// on-chain. Small and fixed — it only absorbs rounding, not rate drift.
const feeTolerance = 1000

// PaymailHandler handles paymail-related endpoints
type PaymailHandler struct {
	redis      *storage.RedisClient
	feeAddress string
}

// NewPaymailHandler creates a new paymail handler. feeAddress is the address
// that must receive the registration fee.
func NewPaymailHandler(redis *storage.RedisClient, feeAddress string) *PaymailHandler {
	return &PaymailHandler{
		redis:      redis,
		feeAddress: feeAddress,
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

// RegisterRequest is the paymail registration request body. The wallet pays the
// registration fee and includes the signed fee transaction (bare tx or atomic
// BEEF hex) plus feeSats — the satoshi amount it quoted at the exchange rate at
// payment time.
type RegisterRequest struct {
	Handle         string `json:"handle"`
	IdentityPubkey string `json:"identityPubkey"`
	PaymentAddress string `json:"paymentAddress"`
	OrdAddress     string `json:"ordAddress"`
	PaymentRawtx   string `json:"paymentRawtx"`
	FeeSats        uint64 `json:"feeSats"`
}

// Register creates a new paymail record after verifying the registration fee
// was paid to the fee address.
func (h *PaymailHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
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
	if req.IdentityPubkey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Identity pubkey is required",
		})
	}
	if req.PaymentAddress == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Payment address is required",
		})
	}
	if req.OrdAddress == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Ordinals address is required",
		})
	}
	if req.PaymentRawtx == "" || req.FeeSats == 0 {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Registration fee payment is required",
		})
	}

	// Verify the fee transaction pays the fee address. Parsed locally from the
	// wallet-signed tx, so this confirms the instant the user pays.
	txBytes, err := extractTxBytes(req.PaymentRawtx)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid fee transaction: " + err.Error(),
		})
	}
	payment, err := bitpic.VerifyFeePayment(txBytes, h.feeAddress)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid fee transaction: " + err.Error(),
		})
	}
	if payment.PaidSats+feeTolerance < req.FeeSats {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"error": "Fee payment is insufficient",
		})
	}

	// Check if handle already exists
	existing, _ := h.redis.GetPaymail(req.Handle)
	if existing != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Handle already taken",
		})
	}

	// Claim the fee txid so one payment can't register multiple handles.
	fresh, err := h.redis.ClaimPaymentTxid(payment.TxID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to register paymail",
		})
	}
	if !fresh {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "This fee payment has already been used",
		})
	}

	// Store paymail
	data := &storage.PaymailData{
		Handle:         req.Handle,
		IdentityPubkey: req.IdentityPubkey,
		PaymentAddress: req.PaymentAddress,
		OrdAddress:     req.OrdAddress,
		PaymentTxid:    payment.TxID,
	}
	if err := h.redis.SetPaymail(data); err != nil {
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

// GetByPubkey looks up a paymail by identity pubkey
func (h *PaymailHandler) GetByPubkey(c *fiber.Ctx) error {
	pubkey := c.Params("pubkey")
	if pubkey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Pubkey is required",
		})
	}

	paymail, err := h.redis.GetPaymailByPubkey(pubkey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to lookup paymail",
		})
	}

	if paymail == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":  "No paymail found for this pubkey",
			"pubkey": pubkey,
		})
	}

	return c.JSON(fiber.Map{
		"handle":  paymail.Handle,
		"paymail": paymail.Handle + "@bitpic.net",
	})
}
