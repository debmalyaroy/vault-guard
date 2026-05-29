package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// window is a per-IP sliding window counter.
type window struct {
	mu        sync.Mutex
	events    []time.Time
	limit     int
	duration  time.Duration
}

func newWindow(limit int, duration time.Duration) *window {
	return &window{limit: limit, duration: duration}
}

// allow returns true if the request is within the rate limit.
func (w *window) allow() (bool, int) {
	w.mu.Lock()
	defer w.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-w.duration)

	// Evict expired events
	i := 0
	for i < len(w.events) && w.events[i].Before(cutoff) {
		i++
	}
	w.events = w.events[i:]

	if len(w.events) >= w.limit {
		return false, w.limit - len(w.events)
	}
	w.events = append(w.events, now)
	return true, w.limit - len(w.events)
}

// limiterGroup manages per-IP sliding window limiters for one rate-limit rule.
type limiterGroup struct {
	mu      sync.RWMutex
	clients map[string]*window
	limit   int
	dur     time.Duration
}

func newLimiterGroup(limit int, dur time.Duration) *limiterGroup {
	g := &limiterGroup{
		clients: make(map[string]*window),
		limit:   limit,
		dur:     dur,
	}
	go g.evictLoop()
	return g
}

func (g *limiterGroup) get(ip string) *window {
	g.mu.RLock()
	w, ok := g.clients[ip]
	g.mu.RUnlock()
	if ok {
		return w
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if w, ok = g.clients[ip]; ok {
		return w
	}
	w = newWindow(g.limit, g.dur)
	g.clients[ip] = w
	return w
}

// evictLoop periodically removes stale IP entries to prevent unbounded growth.
func (g *limiterGroup) evictLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		g.mu.Lock()
		for ip := range g.clients {
			delete(g.clients, ip)
		}
		g.mu.Unlock()
	}
}

// RateLimiter holds separate windows for different endpoint categories.
type RateLimiter struct {
	attacks  *limiterGroup // 30 / minute
	sessions *limiterGroup // 10 / hour
	exports  *limiterGroup // 5 / hour
}

// NewRateLimiter creates a RateLimiter with the configured limits.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		attacks:  newLimiterGroup(30, time.Minute),
		sessions: newLimiterGroup(10, time.Hour),
		exports:  newLimiterGroup(5, time.Hour),
	}
}

// AttackLimit returns Gin middleware limiting attack/campaign endpoint calls.
func (r *RateLimiter) AttackLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, remaining := r.attacks.get(c.ClientIP()).allow()
		c.Header("X-RateLimit-Limit", "30")
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Window", "60s")
		if !ok {
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"limit":       "30 attacks per minute",
				"retry_after": 60,
			})
			return
		}
		c.Next()
	}
}

// SessionLimit returns Gin middleware limiting session creation.
func (r *RateLimiter) SessionLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, remaining := r.sessions.get(c.ClientIP()).allow()
		c.Header("X-RateLimit-Limit", "10")
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Window", "3600s")
		if !ok {
			c.Header("Retry-After", "3600")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"limit":       "10 sessions per hour",
				"retry_after": 3600,
			})
			return
		}
		c.Next()
	}
}

// ExportLimit returns Gin middleware limiting audit export calls.
func (r *RateLimiter) ExportLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, remaining := r.exports.get(c.ClientIP()).allow()
		c.Header("X-RateLimit-Limit", "5")
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Window", "3600s")
		if !ok {
			c.Header("Retry-After", "3600")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"limit":       "5 exports per hour",
				"retry_after": 3600,
			})
			return
		}
		c.Next()
	}
}
