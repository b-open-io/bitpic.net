package main

import (
	"log"
	"os"
	"time"

	"github.com/b-open-io/bitpic/handlers"
	"github.com/b-open-io/bitpic/junglebus"
	"github.com/b-open-io/bitpic/storage"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Get configuration from environment
	port := getEnv("PORT", "8080")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")
	junglebusURL := getEnv("JUNGLEBUS_URL", "https://junglebus.gorillapool.io")
	subscriptionID := getEnv("JUNGLEBUS_SUBSCRIPTION_ID", "d40d60de8e6fdaa627eefb14ea685052f5955e278d54f19e6564d6c5e5015eb3")
	ordfsURL := getEnv("ORDFS_URL", "https://ordfs.network")
	arcURL := getEnv("ARC_URL", "https://arc.taal.com")
	cacheTTLStr := getEnv("IMAGE_CACHE_TTL", "2592000") // 30 days default

	// Parse cache TTL
	cacheTTL, err := time.ParseDuration(cacheTTLStr + "s")
	if err != nil {
		cacheTTL = 2592000 * time.Second // 30 days
	}

	// Initialize Redis
	redis, err := storage.NewRedisClient(redisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redis.Close()

	log.Println("Connected to Redis")

	// Initialize JungleBus subscriber
	subscriber := junglebus.NewSubscriber(junglebusURL, subscriptionID, redis)
	go func() {
		if err := subscriber.Start(); err != nil {
			log.Fatalf("JungleBus subscriber failed: %v", err)
		}
	}()

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "BitPic Backend",
		ServerHeader: "BitPic",
		ErrorHandler: errorHandler,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,HEAD,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// Rate limiting: 100 requests per minute per IP
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Rate limit exceeded",
			})
		},
	}))

	// Initialize handlers
	avatarHandler := handlers.NewAvatarHandler(redis, ordfsURL, cacheTTL)
	feedHandler := handlers.NewFeedHandler(redis)
	apiHandler := handlers.NewAPIHandler(redis, ordfsURL)
	existsHandler := handlers.NewExistsHandler(redis)
	broadcastHandler := handlers.NewBroadcastHandler(arcURL, redis)
	statusHandler := handlers.NewStatusHandler(redis, subscriber)
	paymailHandler := handlers.NewPaymailHandler(redis)

	// Routes
	app.Get("/health", handlers.Health)
	app.Get("/u/:paymail", avatarHandler.Handle)
	app.Get("/api/feed", feedHandler.Handle)
	app.Get("/api/avatar/:paymail", apiHandler.Handle)
	app.Get("/api/exists/:paymail", existsHandler.Handle)
	app.Get("/api/status", statusHandler.Handle)
	app.Post("/api/broadcast", broadcastHandler.Handle)

	// Paymail routes
	app.Get("/api/paymail/:handle", paymailHandler.Get)
	app.Get("/api/paymail/:handle/available", paymailHandler.CheckAvailable)
	app.Post("/api/paymail/register", paymailHandler.Register)

	// Start server
	log.Printf("Starting server on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// errorHandler handles errors globally
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}
