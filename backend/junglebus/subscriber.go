package junglebus

import (
	"context"
	"log"
	"time"

	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
	"github.com/b-open-io/go-junglebus"
	"github.com/b-open-io/go-junglebus/models"
)

// Subscriber handles JungleBus subscription and transaction processing
type Subscriber struct {
	subscriptionID string
	junglebusURL   string
	redis          *storage.RedisClient
	client         *junglebus.Client
	subscription   *junglebus.Subscription
	connected      bool
	syncing        bool
	lastBlock      uint64
	lastBlockTime  time.Time
}

// NewSubscriber creates a new JungleBus subscriber
func NewSubscriber(junglebusURL, subscriptionID string, redis *storage.RedisClient) *Subscriber {
	return &Subscriber{
		subscriptionID: subscriptionID,
		junglebusURL:   junglebusURL,
		redis:          redis,
	}
}

// Start begins listening to JungleBus subscription
func (s *Subscriber) Start() error {
	// Create JungleBus client
	client, err := junglebus.New(
		junglebus.WithHTTP(s.junglebusURL),
	)
	if err != nil {
		return err
	}
	s.client = client

	// Get last block from Redis, never go below minimum
	const minFromBlock uint64 = 600000 // BitPic genesis block - never sync before this

	lastBlock, err := s.redis.GetLastBlock()
	if err != nil {
		log.Printf("Warning: failed to get last block from Redis: %v", err)
		lastBlock = minFromBlock
	}

	// Always use at least minFromBlock - never sync earlier blocks
	if lastBlock < minFromBlock {
		log.Printf("Stored block %d is before genesis, starting from %d", lastBlock, minFromBlock)
		lastBlock = minFromBlock
	} else {
		log.Printf("Resuming from block %d", lastBlock)
	}

	log.Printf("Connecting to JungleBus subscription: %s", s.subscriptionID)

	// Set up event handlers
	eventHandler := junglebus.EventHandler{
		OnTransaction: s.onTransaction,
		OnMempool:     s.onMempool,
		OnStatus:      s.onStatus,
		OnError:       s.onError,
	}

	// Subscribe to the stream
	subscription, err := client.Subscribe(
		context.Background(),
		s.subscriptionID,
		lastBlock,
		eventHandler,
	)
	if err != nil {
		return err
	}

	s.subscription = subscription
	s.connected = true
	s.syncing = true

	log.Println("Subscribed to JungleBus, listening for transactions...")

	// Block forever - the subscription runs in its own goroutine
	select {}
}

// GetStatus returns the current subscriber status
func (s *Subscriber) GetStatus() (connected bool, syncing bool, lastBlock uint64, lastBlockTime time.Time) {
	return s.connected, s.syncing, s.lastBlock, s.lastBlockTime
}

// onTransaction handles confirmed transactions
func (s *Subscriber) onTransaction(tx *models.TransactionResponse) {
	s.processTransaction(tx, true)
}

// onMempool handles unconfirmed transactions
func (s *Subscriber) onMempool(tx *models.TransactionResponse) {
	s.processTransaction(tx, false)
}

// onStatus handles status updates
func (s *Subscriber) onStatus(status *models.ControlResponse) {
	switch status.Status {
	case "connected":
		s.connected = true
		log.Printf("JungleBus connected")
	case "disconnected":
		s.connected = false
		log.Printf("JungleBus disconnected")
	case "block-done":
		s.lastBlock = uint64(status.Block)
		s.lastBlockTime = time.Now()
		// Save progress periodically
		if status.Block%100 == 0 {
			if err := s.redis.SetLastBlock(uint64(status.Block)); err != nil {
				log.Printf("Warning: failed to persist block %d: %v", status.Block, err)
			} else {
				log.Printf("Block %d done", status.Block)
			}
		}
	case "error":
		log.Printf("JungleBus error: %s", status.Message)
	default:
		log.Printf("JungleBus status: %s at block %d", status.Status, status.Block)
	}
}

// onError handles errors
func (s *Subscriber) onError(err error) {
	log.Printf("JungleBus error: %v", err)
	s.connected = false
}

// processTransaction processes a transaction from JungleBus
func (s *Subscriber) processTransaction(tx *models.TransactionResponse, confirmed bool) {
	// Transaction is already bytes from JungleBus
	txBytes := tx.Transaction

	// Parse BitPic data
	data, err := bitpic.ParseTransaction(txBytes)
	if err != nil {
		// Not a BitPic transaction, ignore
		return
	}

	// Use block time if available, otherwise use current time
	timestamp := int64(tx.BlockTime)
	if timestamp == 0 {
		timestamp = time.Now().Unix()
	}
	data.Timestamp = timestamp

	// Store in Redis
	if err := s.redis.SetAvatar(data.Paymail, data.Outpoint, tx.Id, timestamp, confirmed); err != nil {
		log.Printf("Failed to store avatar: %v", err)
		return
	}

	status := "unconfirmed"
	if confirmed {
		status = "confirmed"
	}
	log.Printf("BitPic (%s): %s -> %s @ block %d", status, data.Paymail, tx.Id, tx.BlockHeight)
}
