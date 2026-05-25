// Cron service for carmen-ocr backend.
//
// Usage:
//
//	./cron — runs all daily jobs (01:00 UTC daily)
//
// Auth: X-Admin-Key header using MASTER_API_KEY env var.
package main

import (
	"log"
	"os"
)

func main() {
	log.SetFlags(log.LstdFlags)

	cfg, err := newConfig(os.Getenv("BACKEND_URL"), os.Getenv("MASTER_API_KEY"))
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	failed := 0
	for _, j := range cfg.jobs() {
		log.Printf("▶ %s", j.name)
		if err := j.fn(); err != nil {
			log.Printf("✗ %s: %v", j.name, err)
			failed++
		} else {
			log.Printf("✓ %s", j.name)
		}
	}

	if failed > 0 {
		log.Printf("%d job(s) failed", failed)
		os.Exit(1)
	}
	log.Print("all jobs completed")
}
