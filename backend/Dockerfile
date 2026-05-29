# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /build

# Install build dependencies for CGO-free builds
RUN apk add --no-cache ca-certificates tzdata

# Download modules first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.Version=$(date -u +%Y%m%d.%H%M%S)" \
    -o /build/vaultguard ./cmd/server

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM scratch

# Import CA certs and timezone data from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy the compiled binary
COPY --from=builder /build/vaultguard /vaultguard

# Data directory (BoltDB volume mount point)
VOLUME ["/data"]

# Default environment variables — override at runtime
ENV PORT=8080 \
    CORS_ORIGINS="*" \
    USE_MOCK_BEDROCK=true \
    DATA_DIR=/data \
    GIN_MODE=release \
    BEDROCK_CLASSIFIER_MODEL=amazon.nova-lite-v1:0 \
    BEDROCK_REASONING_MODEL=meta.llama3-3-70b-instruct-v1:0 \
    BEDROCK_POLICY_MODEL=amazon.nova-pro-v1:0 \
    BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0

EXPOSE 8080

# Use non-root user for security
USER 65534:65534

ENTRYPOINT ["/vaultguard"]
