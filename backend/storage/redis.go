package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps the Redis client with BitPic-specific operations
type RedisClient struct {
	client *redis.Client
	ctx    context.Context
}

// AvatarData represents avatar metadata stored in Redis
type AvatarData struct {
	Outpoint  string `json:"outpoint"`
	Timestamp int64  `json:"timestamp"`
	Paymail   string `json:"paymail"`
	TxID      string `json:"txid"`
	Confirmed bool   `json:"confirmed"`
	IsRef     bool   `json:"isRef,omitempty"`     // True if this points to an ordinal
	RefOrigin string `json:"refOrigin,omitempty"` // The ordinal origin being referenced
}

// FeedItem represents an item in the feed
type FeedItem struct {
	Paymail   string `json:"paymail"`
	Outpoint  string `json:"outpoint"`
	Timestamp int64  `json:"timestamp"`
	URL       string `json:"url"`
	TxID      string `json:"txid"`
	Confirmed bool   `json:"confirmed"`
}

// NewRedisClient creates a new Redis client connection
func NewRedisClient(redisURL string) (*RedisClient, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)
	ctx := context.Background()

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{
		client: client,
		ctx:    ctx,
	}, nil
}

// SetAvatar stores avatar data for a paymail
func (r *RedisClient) SetAvatar(paymail, outpoint, txid string, timestamp int64, confirmed bool, isRef bool, refOrigin string) error {
	data := AvatarData{
		Outpoint:  outpoint,
		Timestamp: timestamp,
		Paymail:   paymail,
		TxID:      txid,
		Confirmed: confirmed,
		IsRef:     isRef,
		RefOrigin: refOrigin,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal avatar data: %w", err)
	}

	// Store current avatar
	key := fmt.Sprintf("bitpic:current:%s", paymail)
	if err := r.client.Set(r.ctx, key, jsonData, 0).Err(); err != nil {
		return fmt.Errorf("failed to set avatar: %w", err)
	}

	// Add to feed (sorted set by timestamp)
	feedKey := "bitpic:feed"
	if err := r.client.ZAdd(r.ctx, feedKey, redis.Z{
		Score:  float64(timestamp),
		Member: paymail,
	}).Err(); err != nil {
		return fmt.Errorf("failed to add to feed: %w", err)
	}

	// Store metadata for feed lookup
	metaKey := fmt.Sprintf("bitpic:meta:%s", paymail)
	if err := r.client.Set(r.ctx, metaKey, jsonData, 0).Err(); err != nil {
		return fmt.Errorf("failed to set metadata: %w", err)
	}

	return nil
}

// GetAvatar retrieves the current avatar outpoint for a paymail
func (r *RedisClient) GetAvatar(paymail string) (string, error) {
	key := fmt.Sprintf("bitpic:current:%s", paymail)
	result, err := r.client.Get(r.ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get avatar: %w", err)
	}

	var data AvatarData
	if err := json.Unmarshal([]byte(result), &data); err != nil {
		return "", fmt.Errorf("failed to unmarshal avatar data: %w", err)
	}

	return data.Outpoint, nil
}

// GetAvatarData retrieves the full avatar data for a paymail
func (r *RedisClient) GetAvatarData(paymail string) (*AvatarData, error) {
	key := fmt.Sprintf("bitpic:current:%s", paymail)
	result, err := r.client.Get(r.ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get avatar: %w", err)
	}

	var data AvatarData
	if err := json.Unmarshal([]byte(result), &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal avatar data: %w", err)
	}

	return &data, nil
}

// GetFeed retrieves paginated feed items
func (r *RedisClient) GetFeed(offset, limit int64, ordfsBaseURL string) ([]FeedItem, int64, error) {
	feedKey := "bitpic:feed"

	// Get total count
	total, err := r.client.ZCard(r.ctx, feedKey).Result()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get feed count: %w", err)
	}

	// Get paymails from sorted set (reversed for newest first)
	paymails, err := r.client.ZRevRange(r.ctx, feedKey, offset, offset+limit-1).Result()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get feed: %w", err)
	}

	var items []FeedItem
	for _, paymail := range paymails {
		metaKey := fmt.Sprintf("bitpic:meta:%s", paymail)
		result, err := r.client.Get(r.ctx, metaKey).Result()
		if err != nil {
			continue
		}

		var data AvatarData
		if err := json.Unmarshal([]byte(result), &data); err != nil {
			continue
		}

		url := fmt.Sprintf("%s/%s", ordfsBaseURL, data.Outpoint)
		items = append(items, FeedItem{
			Paymail:   data.Paymail,
			Outpoint:  data.Outpoint,
			Timestamp: data.Timestamp,
			URL:       url,
			TxID:      data.TxID,
			Confirmed: data.Confirmed,
		})
	}

	return items, total, nil
}

// Exists checks if an avatar exists for a paymail
func (r *RedisClient) Exists(paymail string) (bool, error) {
	key := fmt.Sprintf("bitpic:current:%s", paymail)
	count, err := r.client.Exists(r.ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check existence: %w", err)
	}
	return count > 0, nil
}

// CacheImage stores an image in cache with TTL
func (r *RedisClient) CacheImage(outpoint string, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("bitpic:image:%s", outpoint)
	if err := r.client.Set(r.ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("failed to cache image: %w", err)
	}
	return nil
}

// GetCachedImage retrieves a cached image
func (r *RedisClient) GetCachedImage(outpoint string) ([]byte, error) {
	key := fmt.Sprintf("bitpic:image:%s", outpoint)
	result, err := r.client.Get(r.ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get cached image: %w", err)
	}
	return result, nil
}

// SetLastBlock stores the last processed block height
func (r *RedisClient) SetLastBlock(height uint64) error {
	key := "bitpic:sync:lastBlock"
	if err := r.client.Set(r.ctx, key, height, 0).Err(); err != nil {
		return fmt.Errorf("failed to set last block: %w", err)
	}
	return nil
}

// GetLastBlock retrieves the last processed block height
func (r *RedisClient) GetLastBlock() (uint64, error) {
	key := "bitpic:sync:lastBlock"
	result, err := r.client.Get(r.ctx, key).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get last block: %w", err)
	}
	return result, nil
}

// GetTotalAvatars returns the total count of avatars
func (r *RedisClient) GetTotalAvatars() (int64, error) {
	pattern := "bitpic:current:*"
	var cursor uint64
	var count int64

	for {
		var keys []string
		var err error
		keys, cursor, err = r.client.Scan(r.ctx, cursor, pattern, 100).Result()
		if err != nil {
			return 0, fmt.Errorf("failed to scan keys: %w", err)
		}

		count += int64(len(keys))

		if cursor == 0 {
			break
		}
	}

	return count, nil
}

// PaymailData represents a registered paymail
type PaymailData struct {
	Handle         string `json:"handle"`
	IdentityPubkey string `json:"identityPubkey"`
	PaymentAddress string `json:"paymentAddress"`
	OrdAddress     string `json:"ordAddress"`
	CreatedAt      int64  `json:"createdAt"`
}

// SetPaymail stores a paymail record
func (r *RedisClient) SetPaymail(data *PaymailData) error {
	if data.CreatedAt == 0 {
		data.CreatedAt = time.Now().Unix()
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal paymail data: %w", err)
	}

	key := fmt.Sprintf("paymail:%s", data.Handle)
	if err := r.client.Set(r.ctx, key, jsonData, 0).Err(); err != nil {
		return fmt.Errorf("failed to set paymail: %w", err)
	}

	// Add to index
	if err := r.client.SAdd(r.ctx, "paymail:index", data.Handle).Err(); err != nil {
		return fmt.Errorf("failed to add to index: %w", err)
	}

	return nil
}

// GetPaymail retrieves a paymail record
func (r *RedisClient) GetPaymail(handle string) (*PaymailData, error) {
	key := fmt.Sprintf("paymail:%s", handle)
	result, err := r.client.Get(r.ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get paymail: %w", err)
	}

	var data PaymailData
	if err := json.Unmarshal([]byte(result), &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal paymail data: %w", err)
	}

	return &data, nil
}

// GetPaymailByPubkey looks up a paymail by identity pubkey
func (r *RedisClient) GetPaymailByPubkey(pubkey string) (*PaymailData, error) {
	// Get all handles from the index
	handles, err := r.client.SMembers(r.ctx, "paymail:index").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get paymail index: %w", err)
	}

	// Check each handle for matching pubkey
	for _, handle := range handles {
		data, err := r.GetPaymail(handle)
		if err != nil {
			continue
		}
		if data != nil && strings.EqualFold(data.IdentityPubkey, pubkey) {
			return data, nil
		}
	}

	return nil, nil
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	return r.client.Close()
}
