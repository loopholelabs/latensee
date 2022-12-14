package backend

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v9"
	"github.com/pojntfx/dudirekta/pkg/rpc"
	"github.com/pojntfx/hydrapp/hydrapp-utils/pkg/utils"
	"nhooyr.io/websocket"
)

var (
	ErrAlreadyMeasuring = errors.New("could not start measuring latency, a session is already in progress")
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

type local struct {
	Peers func() map[string]remote

	ctx context.Context

	url      string
	interval time.Duration
	commands []string

	cancel context.CancelFunc
}

func (l *local) SetURL(ctx context.Context, url string) error {
	l.url = url

	return nil
}

func (l *local) SetInterval(ctx context.Context, intervalMilliSecond int64) error {
	l.interval = time.Millisecond * time.Duration(intervalMilliSecond)

	return nil
}

func (l *local) SetCommands(ctx context.Context, commands []string) error {
	l.commands = commands

	return nil
}

func (l *local) GetIsLatencyMeasuring(ctx context.Context) (bool, error) {
	return l.cancel != nil, nil
}

func (l *local) StartLatencyMeasurement(ctx context.Context) error {
	if l.cancel != nil {
		return ErrAlreadyMeasuring
	}

	opt, err := redis.ParseURL(l.url)
	if err != nil {
		return err
	}

	rdb := redis.NewClient(opt)

	latencyCtx, cancel := context.WithCancel(l.ctx)
	l.cancel = cancel

	for _, command := range l.commands {
		var wg sync.WaitGroup
		wg.Add(1)

		go func(command string) {
			defer func() {
				cancel()

				_ = rdb.Close()

				l.cancel = nil
			}()

			cmd := []any{}
			for _, c := range strings.Split(command, " ") {
				cmd = append(cmd, any(c))
			}

			res, errs := testCommandLatency(
				latencyCtx,

				rdb,
				cmd,
				l.interval,
			)

			ranOnce := false
			for {
				select {
				case r := <-res:
					if !ranOnce {
						wg.Done()

						ranOnce = true
					}

					var peer *remote
					for peerID, candidate := range l.Peers() {
						if peerID == rpc.GetRemoteID(ctx) {
							peer = &candidate

							break
						}
					}

					if peer == nil {
						log.Println("could not find peer to write to, stopping")

						return
					}

					if err := peer.HandleLatencyMeasurement(l.ctx, command, r.Microseconds()); err != nil {
						log.Println("could not call latency measurement handler, stopping:", err)

						return
					}
				case err := <-errs:
					if !ranOnce {
						wg.Done()

						ranOnce = true
					}

					if errors.Is(err, context.Canceled) || errors.Is(err, redis.ErrClosed) {
						return
					}

					var peer *remote
					for peerID, candidate := range l.Peers() {
						if peerID == rpc.GetRemoteID(ctx) {
							peer = &candidate

							break
						}
					}

					if peer == nil {
						log.Println("could not find peer to write to, stopping")

						return
					}

					if err := peer.HandleError(l.ctx, err.Error()); err != nil {
						log.Println("could not call error handler, stopping:", err)

						return
					}

					return
				}
			}
		}(command)

		wg.Wait() // Ensures that the commands are run _in sequential order_ at least once
	}

	return nil
}

func (l *local) StopLatencyMeasurement(ctx context.Context) error {
	if l.cancel != nil {
		l.cancel()
	}

	l.cancel = nil

	return nil
}

type remote struct {
	HandleLatencyMeasurement func(ctx context.Context, command string, latencyMicroSecond int64) error
	HandleError              func(ctx context.Context, err string) error
}

func StartServer(ctx context.Context, addr string, heartbeat time.Duration, localhostize bool) (string, func() error, error) {
	if strings.TrimSpace(addr) == "" {
		addr = ":0"
	}

	l := &local{
		ctx: ctx,
	}
	registry := rpc.NewRegistry(
		l,
		remote{},

		time.Second*10,
		ctx,
		nil,
	)
	l.Peers = registry.Peers

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return "", nil, err
	}

	clients := 0
	go func() {
		if err := http.Serve(listener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clients++

			log.Printf("%v clients connected", clients)

			defer func() {
				clients--

				if err := recover(); err != nil {
					w.WriteHeader(http.StatusInternalServerError)

					log.Printf("Client disconnected with error: %v", err)
				}

				log.Printf("%v clients connected", clients)
			}()

			switch r.Method {
			case http.MethodGet:
				c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
					OriginPatterns: []string{"*"},
				})
				if err != nil {
					panic(err)
				}

				pings := time.NewTicker(time.Second / 2)
				defer pings.Stop()

				errs := make(chan error)
				go func() {
					for range pings.C {
						if err := c.Ping(ctx); err != nil {
							errs <- err

							return
						}
					}
				}()

				conn := websocket.NetConn(ctx, c, websocket.MessageText)
				defer conn.Close()

				go func() {
					if err := registry.Link(conn); err != nil {
						errs <- err

						return
					}
				}()

				if err := <-errs; err != nil {
					panic(err)
				}
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
		})); err != nil {
			if strings.HasSuffix(err.Error(), "use of closed network connection") {
				return
			}

			panic(err)
		}
	}()

	url, err := url.Parse("ws://" + listener.Addr().String())
	if err != nil {
		return "", nil, err
	}

	if localhostize {
		return utils.Localhostize(url.String()), listener.Close, nil
	}

	return url.String(), listener.Close, nil
}
