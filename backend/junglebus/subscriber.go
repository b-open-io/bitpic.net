package junglebus

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/b-open-io/bitpic/bitpic"
	"github.com/b-open-io/bitpic/storage"
)

// Subscriber handles JungleBus subscription and transaction processing
type Subscriber struct {
	subscriptionID string
	junglebusURL   string
	redis          *storage.RedisClient
	client         *http.Client
}

// JungleBusMessage represents a message from JungleBus
type JungleBusMessage struct {
	ID          string `json:"id"`
	Transaction string `json:"transaction"` // hex encoded
	BlockHash   string `json:"block_hash"`
	BlockHeight uint64 `json:"block_height"`
	BlockTime   uint64 `json:"block_time"`
}

// NewSubscriber creates a new JungleBus subscriber
func NewSubscriber(junglebusURL, subscriptionID string, redis *storage.RedisClient) *Subscriber {
	return &Subscriber{
		subscriptionID: subscriptionID,
		junglebusURL:   junglebusURL,
		redis:          redis,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Start begins listening to JungleBus subscription
func (s *Subscriber) Start() error {
	url := fmt.Sprintf("%s/v1/subscribe/%s", s.junglebusURL, s.subscriptionID)

	log.Printf("Connecting to JungleBus subscription: %s", s.subscriptionID)

	for {
		err := s.connect(url)
		if err != nil {
			log.Printf("JungleBus connection error: %v", err)
			log.Println("Reconnecting in 5 seconds...")
			time.Sleep(5 * time.Second)
			continue
		}
	}
}

// connect establishes SSE connection to JungleBus
func (s *Subscriber) connect(url string) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	log.Println("Connected to JungleBus, listening for transactions...")

	// Read SSE stream
	decoder := json.NewDecoder(resp.Body)
	buffer := make([]byte, 0, 8192)

	for {
		// Read line by line from the SSE stream
		line, err := s.readLine(resp.Body, &buffer)
		if err != nil {
			if err == io.EOF {
				return fmt.Errorf("connection closed")
			}
			return fmt.Errorf("failed to read stream: %w", err)
		}

		// Skip empty lines and comment lines
		if len(line) == 0 || line[0] == ':' {
			continue
		}

		// Parse SSE data field
		if len(line) > 6 && string(line[0:6]) == "data: " {
			data := line[6:]

			var msg JungleBusMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				log.Printf("Failed to unmarshal message: %v", err)
				continue
			}

			// Process transaction
			if err := s.processTransaction(&msg); err != nil {
				log.Printf("Failed to process transaction: %v", err)
			}
		}
	}
}

// readLine reads a single line from the stream
func (s *Subscriber) readLine(r io.Reader, buffer *[]byte) ([]byte, error) {
	*buffer = (*buffer)[:0]
	buf := make([]byte, 1)

	for {
		n, err := r.Read(buf)
		if err != nil {
			return *buffer, err
		}

		if n == 0 {
			continue
		}

		if buf[0] == '\n' {
			return *buffer, nil
		}

		if buf[0] != '\r' {
			*buffer = append(*buffer, buf[0])
		}
	}
}

// processTransaction processes a transaction from JungleBus
func (s *Subscriber) processTransaction(msg *JungleBusMessage) error {
	// Decode hex transaction
	txBytes, err := hexDecode(msg.Transaction)
	if err != nil {
		return fmt.Errorf("failed to decode transaction: %w", err)
	}

	// Parse BitPic data
	data, err := bitpic.ParseTransaction(txBytes)
	if err != nil {
		// Not a BitPic transaction, ignore
		return nil
	}

	// Use block time if available, otherwise use current time
	timestamp := int64(msg.BlockTime)
	if timestamp == 0 {
		timestamp = time.Now().Unix()
	}
	data.Timestamp = timestamp

	// Store in Redis
	if err := s.redis.SetAvatar(data.Paymail, data.Outpoint, timestamp); err != nil {
		return fmt.Errorf("failed to store avatar: %w", err)
	}

	log.Printf("New BitPic avatar: %s -> %s", data.Paymail, data.Outpoint)

	return nil
}

// hexDecode decodes a hex string to bytes
func hexDecode(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, fmt.Errorf("hex string must have even length")
	}

	bytes := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		var b byte
		_, err := fmt.Sscanf(s[i:i+2], "%02x", &b)
		if err != nil {
			return nil, fmt.Errorf("invalid hex character at position %d: %w", i, err)
		}
		bytes[i/2] = b
	}
	return bytes, nil
}
