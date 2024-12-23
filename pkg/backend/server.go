package backend

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pojntfx/hydrapp/hydrapp/pkg/utils"
	"github.com/pojntfx/panrpc/go/pkg/rpc"
	"github.com/redis/go-redis/v9"
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
	ctx context.Context

	url      string
	interval time.Duration
	commands []string

	cancel context.CancelFunc

	ForRemotes func(
		cb func(remoteID string, remote remote) error,
	) error
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
					_ = l.ForRemotes(func(remoteID string, remote remote) error {
						if remoteID == rpc.GetRemoteID(ctx) {
							peer = &remote
						}

						return nil
					})

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
					_ = l.ForRemotes(func(remoteID string, remote remote) error {
						if remoteID == rpc.GetRemoteID(ctx) {
							peer = &remote
						}

						return nil
					})

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

	service := &local{
		ctx: ctx,
	}

	var clients atomic.Int64
	registry := rpc.NewRegistry[remote, json.RawMessage](
		service,

		&rpc.RegistryHooks{
			OnClientConnect: func(remoteID string) {
				log.Printf("%v clients connected", clients.Add(1))
			},
			OnClientDisconnect: func(remoteID string) {
				log.Printf("%v clients connected", clients.Add(-1))
			},
		},
	)
	service.ForRemotes = registry.ForRemotes

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		panic(err)
	}

	log.Println("Listening on", listener.Addr())

	go func() {
		defer listener.Close()

		if err := http.Serve(listener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					w.WriteHeader(http.StatusInternalServerError)

					log.Println("Client disconnected with error:", err)
				}
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

				linkCtx, cancelLinkCtx := context.WithCancel(r.Context())
				defer cancelLinkCtx()

				encoder := json.NewEncoder(conn)
				decoder := json.NewDecoder(conn)

				go func() {
					if err := registry.LinkStream(
						linkCtx,

						func(v rpc.Message[json.RawMessage]) error {
							return encoder.Encode(v)
						},
						func(v *rpc.Message[json.RawMessage]) error {
							return decoder.Decode(v)
						},

						func(v any) (json.RawMessage, error) {
							b, err := json.Marshal(v)
							if err != nil {
								return nil, err
							}

							return json.RawMessage(b), nil
						},
						func(data json.RawMessage, v any) error {
							return json.Unmarshal([]byte(data), v)
						},

						nil,
					); err != nil {
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
