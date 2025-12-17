.PHONY: build run test clean docker-build docker-run

# Build the application
build:
	go build -o bitpic .

# Run the application
run:
	go run main.go

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -f bitpic
	go clean

# Build Docker image
docker-build:
	docker build -t bitpic-backend .

# Run Docker container
docker-run:
	docker run -p 8080:8080 \
		-e REDIS_URL=${REDIS_URL} \
		-e JUNGLEBUS_URL=${JUNGLEBUS_URL} \
		-e JUNGLEBUS_SUBSCRIPTION_ID=${JUNGLEBUS_SUBSCRIPTION_ID} \
		-e ORDFS_URL=${ORDFS_URL} \
		-e ARC_URL=${ARC_URL} \
		bitpic-backend

# Install dependencies
deps:
	go mod download

# Update dependencies
update:
	go get -u ./...
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	go vet ./...
