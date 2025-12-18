package junglebus

import (
	"context"
	"log"
	"sync"
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

	// Stats for batched logging
	statsMu        sync.Mutex
	txCount        uint64
	blockCount     uint64
	bitpicCount    uint64
	parseErrors    uint64
	lastLogBlock   uint64
	lastLogTime    time.Time
}

const (
	logInterval      = 10 * time.Second // Log stats every 10 seconds
	logBlocksEvery   = 1000             // Or every 1000 blocks
	bitpicStartBlock = 610255           // First BitPic transaction block - never sync before this
)

// NewSubscriber creates a new JungleBus subscriber
func NewSubscriber(junglebusURL, subscriptionID string, redis *storage.RedisClient) *Subscriber {
	return &Subscriber{
		subscriptionID: subscriptionID,
		junglebusURL:   junglebusURL,
		redis:          redis,
		lastLogTime:    time.Now(),
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

	// Get last block from Redis, never go below BitPic start block
	lastBlock, err := s.redis.GetLastBlock()
	if err != nil {
		log.Printf("Warning: failed to get last block from Redis: %v", err)
		lastBlock = bitpicStartBlock
	}

	// Always use at least bitpicStartBlock - never sync earlier blocks
	if lastBlock < bitpicStartBlock {
		log.Printf("Stored block %d is before BitPic genesis, starting from %d", lastBlock, bitpicStartBlock)
		lastBlock = bitpicStartBlock
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
	s.statsMu.Lock()
	s.txCount++
	s.statsMu.Unlock()
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
		// Save progress every block (silently)
		s.redis.SetLastBlock(uint64(status.Block))

		// Batched logging
		s.statsMu.Lock()
		s.blockCount++
		blocksSinceLog := s.lastBlock - s.lastLogBlock
		timeSinceLog := time.Since(s.lastLogTime)

		// Log if enough blocks or enough time has passed
		if blocksSinceLog >= logBlocksEvery || timeSinceLog >= logInterval {
			log.Printf("Sync: block %d | %d blocks, %d txs, %d bitpics indexed",
				s.lastBlock, s.blockCount, s.txCount, s.bitpicCount)
			s.lastLogBlock = s.lastBlock
			s.lastLogTime = time.Now()
			s.blockCount = 0
			s.txCount = 0
		}
		s.statsMu.Unlock()
	case "error":
		log.Printf("JungleBus error: %s", status.Message)
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
		// Silently ignore non-BitPic transactions (expected)
		s.statsMu.Lock()
		s.parseErrors++
		s.statsMu.Unlock()
		return
	}

	// Use block time if available, otherwise use current time
	timestamp := int64(tx.BlockTime)
	if timestamp == 0 {
		timestamp = time.Now().Unix()
	}
	data.Timestamp = timestamp

	// Store in Redis
	if err := s.redis.SetAvatar(data.Paymail, data.Outpoint, tx.Id, timestamp, confirmed, data.IsRef, data.RefOrigin); err != nil {
		log.Printf("Failed to store avatar for %s: %v", data.Paymail, err)
		return
	}

	// Always log BitPic matches - these are rare and important
	s.statsMu.Lock()
	s.bitpicCount++
	s.statsMu.Unlock()

	status := "unconfirmed"
	if confirmed {
		status = "confirmed"
	}
	log.Printf("BitPic (%s): %s -> %s @ block %d", status, data.Paymail, tx.Id, tx.BlockHeight)
}
