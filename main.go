package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	c, e := loadConfig()
	if e != nil {
		log.Fatal(e)
	}
	if e = ensureStorage(c); e != nil {
		log.Fatal(e)
	}
	store, e := openStore(c.DBDriver, c.DBDSN)
	if e != nil {
		log.Fatal(e)
	}
	defer store.DB.Close()
	api := &API{Config: c, Store: store, Panel: newPanel(c)}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	server := &http.Server{Addr: c.Listen, Handler: api.routes(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdown)
	}()
	log.Printf("shop listening on %s (db: %s)", c.Listen, c.DBDriver)
	if e = server.ListenAndServe(); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}
