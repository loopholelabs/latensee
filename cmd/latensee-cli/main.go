package main

import (
	"context"
	"flag"
	"fmt"
	"strings"
	"time"

	"github.com/go-redis/redis/v9"
)

func testCommandLatency(
	ctx context.Context,

	rdb *redis.Client,
	command []any,
	interval time.Duration,

) (chan time.Duration, chan error) {
	res := make(chan time.Duration)
	errs := make(chan error)

	go func() {
		for {
			before := time.Now()
			if err := rdb.Do(ctx, command...).Err(); err != nil {
				errs <- err

				return
			}

			res <- time.Since(before)

			time.Sleep(interval)
		}
	}()

	return res, errs
}

func main() {
	url := flag.String("url", "redis://localhost:6379/0", "Redis connection URL")
	interval := flag.Duration("interval", time.Millisecond*500, "Time to wait in between measuring latency")
	command := flag.String("command", "set test 1", "Command to measure latency for")

	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	opt, err := redis.ParseURL(*url)
	if err != nil {
		panic(err)
	}

	rdb := redis.NewClient(opt)
	defer rdb.Close()

	cmd := []any{}
	for _, c := range strings.Split(*command, " ") {
		cmd = append(cmd, any(c))
	}

	res, errs := testCommandLatency(
		ctx,
		rdb,
		cmd,
		*interval,
	)

	for {
		select {
		case r := <-res:
			fmt.Println(r)
		case err := <-errs:
			panic(err)
		}
	}
}
