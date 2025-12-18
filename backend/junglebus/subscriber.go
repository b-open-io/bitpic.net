package junglebus

import (
	"context"
	"log"
	"time"

	"github.com/GorillaPool/go-junglebus"
	"github.com/GorillaPool/go-junglebus/models"
	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
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

	// Get last block from Redis
	lastBlock, err := s.redis.GetLastBlock()
	if err != nil {
		log.Printf("Warning: failed to get last block from Redis: %v", err)
		lastBlock = 0
	}

	if lastBlock > 0 {
		log.Printf("Resuming from block %d", lastBlock)
	} else {
		log.Printf("Starting from current tip")
	}

	log.Printf("Connecting to JungleBus subscription: %s", s.subscriptionID)

	// Set up event handlers
	eventHandler := junglebus.EventHandler{
		OnTransaction: s.onTransaction,
		OnMempool:     s.onMempool,
		OnStatus:      s.onStatus,
		OnError:       s.onError,
	}

	// Subscribe with queue for better performance
	subscription, err := client.SubscribeWithQueue(
		context.Background(),
		s.subscriptionID,
		lastBlock,
		0, // Use server default queue
		eventHandler,
		&junglebus.SubscribeOptions{
			QueueSize: 10000,
		},
	)
	if err != nil {
		return err
	}

	s.subscription = subscription
	s.connected = true
	s.syncing = true

	log.Println("Connected to JungleBus, listening for transactions...")

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
	if status.StatusCode == 200 {
		s.syncing = false
		log.Printf("JungleBus sync complete at block %d", status.Block)
	} else if status.StatusCode == 100 {
		s.syncing = true
	}

	// Update last block
	if status.Block > 0 {
		s.lastBlock = uint64(status.Block)
		s.lastBlockTime = time.Now()

		// Persist to Redis
		if err := s.redis.SetLastBlock(uint64(status.Block)); err != nil {
			log.Printf("Warning: failed to persist last block: %v", err)
		}
	}
}

// onError handles errors
func (s *Subscriber) onError(err error) {
	log.Printf("JungleBus error: %v", err)
	s.connected = false
}

// processTransaction processes a transaction from JungleBus
func (s *Subscriber) processTransaction(tx *models.TransactionResponse, confirmed bool) {
	// Update last block info if this is a confirmed transaction
	if confirmed && tx.BlockHeight > 0 {
		s.lastBlock = uint64(tx.BlockHeight)
		s.lastBlockTime = time.Unix(int64(tx.BlockTime), 0)

		// Persist to Redis
		if err := s.redis.SetLastBlock(uint64(tx.BlockHeight)); err != nil {
			log.Printf("Warning: failed to persist last block: %v", err)
		}
	}

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
	log.Printf("New BitPic avatar (%s): %s -> %s", status, data.Paymail, data.Outpoint)
}
