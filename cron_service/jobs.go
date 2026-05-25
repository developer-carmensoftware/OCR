package main

import (
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const (
	jobTimeout      = 120 * time.Second
	maxResponseBody = 64 * 1024 // 64 KB — admin endpoints return small JSON
	maxRetries      = 3
	retryBaseDelay  = 2 * time.Second
)

type config struct {
	backendURL   string
	masterAPIKey string
	client       *http.Client
}

func newConfig(backendURL, masterAPIKey string) (*config, error) {
	backendURL = strings.TrimRight(backendURL, "/")
	if backendURL == "" {
		return nil, fmt.Errorf("BACKEND_URL is not set")
	}
	isLocalhost := strings.HasPrefix(backendURL, "http://localhost") ||
		strings.HasPrefix(backendURL, "http://127.0.0.1")
	if !strings.HasPrefix(backendURL, "https://") && !isLocalhost {
		return nil, fmt.Errorf("BACKEND_URL must start with https:// (http:// only allowed for localhost)")
	}
	if masterAPIKey == "" {
		return nil, fmt.Errorf("MASTER_API_KEY is not set")
	}

	client := &http.Client{
		Timeout: jobTimeout,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
		},
	}

	return &config{
		backendURL:   backendURL,
		masterAPIKey: masterAPIKey,
		client:       client,
	}, nil
}

func (c *config) post(path string) error {
	var lastErr error
	for attempt := range maxRetries {
		if attempt > 0 {
			delay := retryBaseDelay * time.Duration(attempt)
			log.Printf("  retry %d/%d in %s (last error: %v)", attempt, maxRetries-1, delay, lastErr)
			time.Sleep(delay)
		}
		lastErr = c.doPost(path)
		if lastErr == nil {
			return nil
		}
		// don't retry client errors (4xx except 429)
		if isClientError(lastErr) {
			return lastErr
		}
	}
	return lastErr
}

func (c *config) doPost(path string) error {
	req, err := http.NewRequest(http.MethodPost, c.backendURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Admin-Key", c.masterAPIKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if resp.StatusCode >= 400 {
		return &httpError{code: resp.StatusCode, body: string(body)}
	}
	return nil
}

type httpError struct {
	code int
	body string
}

func (e *httpError) Error() string {
	return fmt.Sprintf("HTTP %d: %s", e.code, e.body)
}

func isClientError(err error) bool {
	var e *httpError
	if !errors.As(err, &e) {
		return false
	}
	return e.code >= 400 && e.code < 500 && e.code != 429
}

// ── Job definitions ───────────────────────────────────────────────────────────

type job struct {
	name string
	fn   func() error
}

func (c *config) jobs() []job {
	return []job{
		{"session-purge", func() error { return c.post("/api/v1/admin/retention/run") }},
		{"daily-summary", func() error { return c.post("/api/v1/admin/summary/rebuild") }},
		{"daily-model-cost", func() error { return c.post("/api/v1/admin/summary/model-cost") }},
		{"monthly-summary", func() error { return c.post("/api/v1/admin/summary/monthly") }},
		{"anomaly-detection", func() error { return c.post("/api/v1/admin/anomaly/run") }},
		{"pricing-sync", func() error { return c.post("/api/v1/admin/pricing/sync") }},
	}
}
