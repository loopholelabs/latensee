import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLegendTooltip,
  ChartLine,
  createContainer,
} from "@patternfly/react-charts";
import {
  Brand,
  Button,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  Modal,
  Page,
  PageSection,
  Spinner,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PageHeader, PageHeaderTools } from "@patternfly/react-core/deprecated";
import {
  CogIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import { ILocalContext, IRemoteContext, Registry } from "@pojntfx/panrpc";
import { JSONParser } from "@streamparser/json-whatwg";
import Papa from "papaparse";
import { useEffect, useRef, useState } from "react";
import useAsyncEffect from "use-async";
import { useElementSize } from "usehooks-ts";
import logoDark from "./logo-dark.png";
import logoLight from "./logo-light.png";
import "./main.scss";

const DARK_THEME_CLASS_NAME = "pf-v6-theme-dark";

class Local {
  constructor(
    private setResults: React.Dispatch<React.SetStateAction<IResults>>,
    private maxIntervalsToDisplay: number
  ) {
    this.HandleLatencyMeasurement = this.HandleLatencyMeasurement.bind(this);
  }

  async HandleLatencyMeasurement(
    ctx: ILocalContext,
    command: string,
    latencyMicroSecond: number
  ) {
    this.setResults((oldResults) => {
      const newResults = { ...oldResults };

      newResults.offset++;

      if (!newResults.commands[command]) {
        newResults.commands[command] = [latencyMicroSecond];
      } else {
        newResults.commands[command].push(latencyMicroSecond);
      }

      if (newResults.commands[command].length > this.maxIntervalsToDisplay) {
        newResults.commands[command].shift();
      }

      return newResults;
    });
  }

  async HandleError(ctx: ILocalContext, err: string) {
    alert(err);
  }
}

class Remote {
  async SetURL(ctx: IRemoteContext, url: string): Promise<void> {
    return;
  }

  async SetInterval(
    ctx: IRemoteContext,
    intervalMilliSecond: number
  ): Promise<void> {
    return;
  }

  async SetCommands(ctx: IRemoteContext, commands: string[]): Promise<void> {
    return;
  }

  async StartLatencyMeasurement(ctx: IRemoteContext): Promise<void> {
    return;
  }

  async StopLatencyMeasurement(ctx: IRemoteContext): Promise<void> {
    return;
  }

  async GetIsLatencyMeasuring(ctx: IRemoteContext): Promise<boolean> {
    return false;
  }
}

const getSeconds = (
  results: IResults,
  intervalMilliSecond: number,
  j: number
) =>
  (results.offset * intervalMilliSecond) / 1000 +
  (j * intervalMilliSecond) / 1000;

interface IResults {
  offset: number;
  commands: {
    [command: string]: number[];
  };
}

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const updateTheme = () => {
      if (darkModeMediaQuery.matches) {
        setDarkMode(true);

        return;
      }

      setDarkMode(false);
    };

    darkModeMediaQuery.addEventListener("change", updateTheme);

    updateTheme();

    return () => {
      darkModeMediaQuery.removeEventListener("change", updateTheme);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add(DARK_THEME_CLASS_NAME);

      return;
    }

    document.documentElement.classList.remove(DARK_THEME_CLASS_NAME);
  }, [darkMode]);

  const [clients, setClients] = useState(0);
  useEffect(() => console.log(clients, "clients connected"), [clients]);

  const [results, setResults] = useState<IResults>({
    offset: 0,
    commands: {},
  });
  let maxIntervalsToDisplay = 60;

  const [reconnect, setReconnect] = useState(false);
  const [registry] = useState(
    new Registry(
      new Local(setResults, maxIntervalsToDisplay),
      new Remote(),

      {
        onClientConnect: () => setClients((v) => v + 1),
        onClientDisconnect: () =>
          setClients((v) => {
            if (v === 1) {
              setReconnect(true);
            }

            return v - 1;
          }),
      }
    )
  );

  useAsyncEffect(async () => {
    if (reconnect) {
      await new Promise((r) => {
        setTimeout(r, 100);
      });

      setReconnect(false);

      return () => {};
    }

    const addr =
      new URLSearchParams(window.location.search).get("socketURL") ||
      "ws://localhost:1337";

    const socket = new WebSocket(addr);

    socket.addEventListener("error", (e) => {
      console.error("Disconnected with error, reconnecting:", e);

      setReconnect(true);
    });

    await new Promise<void>((res, rej) => {
      socket.addEventListener("open", () => res());
      socket.addEventListener("error", rej);
    });

    const encoder = new WritableStream({
      write(chunk) {
        socket.send(JSON.stringify(chunk));
      },
    });

    const parser = new JSONParser({
      paths: ["$"],
      separator: "",
    });
    const parserWriter = parser.writable.getWriter();
    const parserReader = parser.readable.getReader();
    const decoder = new ReadableStream({
      start(controller) {
        parserReader
          .read()
          .then(async function process({ done, value }) {
            if (done) {
              controller.close();

              return;
            }

            controller.enqueue(value?.value);

            parserReader
              .read()
              .then(process)
              .catch((e) => controller.error(e));
          })
          .catch((e) => controller.error(e));
      },
    });
    socket.addEventListener("message", (m) =>
      parserWriter.write(m.data as string)
    );
    socket.addEventListener("close", () => {
      parserReader.cancel();
      parserWriter.abort();
    });

    registry.linkStream(
      encoder,
      decoder,

      (v) => v,
      (v) => v
    );

    console.log("Connected to", addr);

    return () => socket.close();
  }, [reconnect]);

  const [isLatencyMeasuring, setIsLatencyMeasuring] = useState(false);

  useEffect(() => {
    if (clients <= 0) {
      return;
    }

    registry.forRemotes(async (_, remote) => {
      try {
        (await remote.GetIsLatencyMeasuring(undefined))
          ? setIsLatencyMeasuring(true)
          : setIsLatencyMeasuring(false);
      } catch (e) {
        alert(JSON.stringify((e as Error).message));
      }
    });
  }, [clients]);

  const CursorVoronoiContainer = createContainer("voronoi", "cursor");
  const legendData = Object.keys(results.commands).map((command) => ({
    childName: command,
    name: command,
  }));

  const [ref, { width, height }] = useElementSize();

  const [isStoppable, setIsStoppable] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const [commands, setCommands] = useState(["set test 0", "get test"]);

  useEffect(() => {
    if (clients <= 0) {
      return;
    }

    registry.forRemotes(async (_, remote) => {
      try {
        await remote.SetCommands(undefined, commands);
      } catch (e) {
        alert(JSON.stringify((e as Error).message));
      }
    });
  }, [clients, commands]);

  const [command, setCommand] = useState("");

  const [intervalMilliSecond, setIntervalMilliSecond] = useState(500);

  useEffect(() => {
    if (clients <= 0) {
      return;
    }

    registry.forRemotes(async (_, remote) => {
      try {
        await remote.SetInterval(undefined, intervalMilliSecond);
      } catch (e) {
        alert(JSON.stringify((e as Error).message));
      }
    });
  }, [clients, intervalMilliSecond]);

  const [redisURL, setRedisURL] = useState("redis://localhost:6379/0");

  useEffect(() => {
    if (clients <= 0) {
      return;
    }

    registry.forRemotes(async (_, remote) => {
      try {
        await remote.SetURL(undefined, redisURL);
      } catch (e) {
        alert(JSON.stringify((e as Error).message));
      }
    });
  }, [clients, redisURL]);

  useEffect(() => {
    if (clients <= 0 && isSettingsOpen) {
      return;
    }

    registry.forRemotes(async (_, remote) => {
      try {
        await Promise.all([
          await remote.SetCommands(undefined, commands),
          await remote.SetInterval(undefined, intervalMilliSecond),
          await remote.SetURL(undefined, redisURL),
        ]);
      } catch (e) {
        alert(JSON.stringify((e as Error).message));
      }
    });
  }, [clients, isSettingsOpen]);

  return clients > 0 ? (
    <>
      <Modal
        isOpen={isSettingsOpen}
        onEscapePress={() => setIsSettingsOpen(false)}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
        variant="medium"
        actions={[
          <Button
            key={1}
            variant="primary"
            onClick={() => setIsSettingsOpen(false)}
            type="submit"
            form="settings"
          >
            OK
          </Button>,
        ]}
      >
        <Title headingLevel="h2">Commands</Title>

        {commands.length <= 0 ? (
          <HelperText className="pf-v6-u-py-sm">
            <HelperTextItem className="pf-v6-x-text--helper">
              No commands have been set up yet.
            </HelperTextItem>
          </HelperText>
        ) : (
          <DataList
            isCompact
            className="pf-v6-u-my-md"
            aria-label="List of commands to test"
          >
            {commands.map((command, i) => (
              <DataListItem key={i} aria-labelledby={`command-${i}`}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell
                        className="pf-v6-u-display-flex pf-v6-u-justify-content-flex-start pf-v6-u-align-self-center"
                        key={1}
                      >
                        <span id={`command-${i}`}>{command}</span>
                      </DataListCell>,
                    ]}
                  />
                  <DataListAction
                    aria-labelledby={`command-${i} action-${i}`}
                    id={`action-${i}`}
                    aria-label="Actions"
                  >
                    <Button
                      variant="plain"
                      key={1}
                      onClick={() =>
                        setCommands((oldCommands) =>
                          oldCommands.filter((_, j) => i !== j)
                        )
                      }
                    >
                      <TimesIcon />
                    </Button>
                  </DataListAction>
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>
        )}

        <TextInputGroup className="pf-v6-u-mt-sm">
          <TextInputGroupMain
            placeholder="Command to add"
            value={command}
            onChange={(_, value) => setCommand(value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setCommands((commands) => [...commands, command]);
                setCommand("");
              }
            }}
          />

          <TextInputGroupUtilities>
            <Button
              variant="plain"
              aria-label="Add command"
              onClick={(e) => {
                setCommands((commands) => [...commands, command]);
                setCommand("");
              }}
            >
              <PlusIcon className="pf-v6-u-mr-0 pf-v6-u-mr-sm-on-md" />

              <span className="pf-v6-u-display-none pf-v6-u-display-inline-block-on-md">
                Add command
              </span>
            </Button>
          </TextInputGroupUtilities>
        </TextInputGroup>

        <Title headingLevel="h2" className="pf-v6-u-pt-lg pf-v6-u-pb-sm">
          Connection
        </Title>

        <Form
          id="settings"
          onSubmit={(e) => {
            e.preventDefault();
            setIsSettingsOpen(false);
          }}
        >
          <FormGroup
            label="Test interval (in milliseconds)"
            isRequired
            fieldId="test-interval"
          >
            <TextInput
              isRequired
              type="number"
              id="test-interval"
              name="test-interval"
              value={intervalMilliSecond}
              onChange={(_, e) => {
                const v = parseInt(e);

                if (isNaN(v)) {
                  console.error("Could not parse test interval");

                  return;
                }

                setIntervalMilliSecond(v);
              }}
            />
          </FormGroup>

          <FormGroup label="Redis/Valkey URL" isRequired fieldId="redis-url">
            <TextInput
              isRequired
              type="text"
              id="redis-url"
              name="redis-url"
              value={redisURL}
              onChange={(_, e) => {
                const v = e.trim();

                if (v.length <= 0) {
                  console.error("Could not work with empty Redis/Valkey URL");

                  return;
                }

                setRedisURL(v);
              }}
            />
          </FormGroup>

          <FormGroup
            label="Maximum intervals to display"
            isRequired
            fieldId="maximum-interval"
          >
            <TextInput
              isRequired
              type="number"
              id="maximum-interval"
              name="maximum-interval"
              defaultValue={maxIntervalsToDisplay}
              onChange={(_, e) => {
                const v = parseInt(e);

                if (isNaN(v)) {
                  console.error("Could not parse max intervals to display");

                  return;
                }

                maxIntervalsToDisplay = v;
              }}
            />
          </FormGroup>
        </Form>
      </Modal>

      <Page
        header={
          <PageHeader
            logo={
              <>
                <Brand
                  src={logoDark}
                  className="pf-v6-c-brand--dark pf-v6-u-py-sm"
                  alt="LatenSee logo (dark variant)"
                />

                <Brand
                  src={logoLight}
                  className="pf-v6-c-brand--light pf-v6-u-py-sm"
                  alt="LatenSee logo (light variant)"
                />
              </>
            }
            logoComponent="div"
            headerTools={
              <PageHeaderTools>
                <Toolbar>
                  <ToolbarContent className="pf-v6-u-pr-0">
                    <ToolbarItem>
                      <Button
                        variant="plain"
                        onClick={() => setIsSettingsOpen(true)}
                      >
                        <CogIcon />
                      </Button>
                    </ToolbarItem>

                    <ToolbarItem variant="separator" />

                    {!isLatencyMeasuring && results.offset !== 0 && (
                      <ToolbarItem>
                        <Button
                          variant="tertiary"
                          onClick={() => {
                            const element = document.createElement("a");
                            element.setAttribute(
                              "href",
                              "data:text/plain;charset=utf-8," +
                                encodeURIComponent(
                                  Papa.unparse({
                                    fields: [
                                      "timestampSeconds",
                                      "command",
                                      "latencyMicroSecond",
                                    ],
                                    data: Object.keys(results.commands)
                                      .map((command) =>
                                        results.commands[command].map(
                                          (latencyMicrosecond, j) => [
                                            getSeconds(
                                              results,
                                              intervalMilliSecond,
                                              j
                                            ),
                                            command,
                                            latencyMicrosecond,
                                          ]
                                        )
                                      )
                                      .reduce(
                                        (prev, curr) => [...prev, ...curr],
                                        []
                                      ),
                                  })
                                )
                            );
                            element.setAttribute("download", "latensee.csv");

                            element.style.display = "none";
                            document.body.appendChild(element);

                            element.click();

                            document.body.removeChild(element);
                          }}
                        >
                          <DownloadIcon className="pf-v6-u-mr-0 pf-v6-u-mr-sm-on-md" />

                          <span className="pf-v6-u-display-none pf-v6-u-display-inline-block-on-md">
                            Download CSV
                          </span>
                        </Button>
                      </ToolbarItem>
                    )}

                    {isStoppable && (
                      <ToolbarItem>
                        <Button
                          variant="danger"
                          onClick={() => {
                            registry.forRemotes(async (_, remote) => {
                              try {
                                remote.StopLatencyMeasurement(undefined);
                              } catch (e) {
                                alert(JSON.stringify((e as Error).message));
                              }
                            });

                            setIsStoppable(false);
                            setIsLatencyMeasuring(false);
                          }}
                        >
                          <TimesIcon className="pf-v6-u-mr-0 pf-v6-u-mr-sm-on-md" />

                          <span className="pf-v6-u-display-none pf-v6-u-display-inline-block-on-md">
                            Stop test
                          </span>
                        </Button>
                      </ToolbarItem>
                    )}

                    <ToolbarItem>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setIsLatencyMeasuring((latency) => !latency);
                          setIsStoppable(true);

                          if (isLatencyMeasuring) {
                            registry.forRemotes(async (_, remote) => {
                              try {
                                remote.StopLatencyMeasurement(undefined);
                              } catch (e) {
                                alert(JSON.stringify((e as Error).message));
                              }
                            });

                            return;
                          }

                          if (!isStoppable) {
                            setResults({ offset: 0, commands: {} });
                          }

                          registry.forRemotes(async (_, remote) => {
                            try {
                              remote.StartLatencyMeasurement(undefined);
                            } catch (e) {
                              alert(JSON.stringify((e as Error).message));
                            }
                          });
                        }}
                      >
                        {isLatencyMeasuring ? (
                          <PauseIcon className="pf-v6-u-mr-0 pf-v6-u-mr-sm-on-md" />
                        ) : (
                          <PlayIcon className="pf-v6-u-mr-0 pf-v6-u-mr-sm-on-md" />
                        )}

                        <span className="pf-v6-u-display-none pf-v6-u-display-inline-block-on-md">
                          {isLatencyMeasuring
                            ? "Pause"
                            : isStoppable
                            ? "Resume"
                            : "Start"}{" "}
                          test
                        </span>
                      </Button>
                    </ToolbarItem>
                  </ToolbarContent>
                </Toolbar>
              </PageHeaderTools>
            }
          />
        }
      >
        <div ref={ref} className="pf-v6-x-chart">
          <PageSection>
            <div
              style={{
                height: (height || 0) - 8,
                width: width || 0,
              }}
            >
              <Chart
                height={(height || 0) - 8}
                width={width || 0}
                ariaTitle="Latency results"
                ariaDesc="Graph displaying the latency results"
                containerComponent={
                  <CursorVoronoiContainer
                    cursorDimension="x"
                    labels={({ datum }: any) => `${datum.y / 1000} ms`}
                    labelComponent={
                      <ChartLegendTooltip
                        legendData={legendData}
                        title={(datum: any) => datum.x}
                      />
                    }
                    mouseFollowTooltips
                    voronoiDimension="x"
                    voronoiPadding={50}
                  />
                }
                legendData={legendData}
                legendOrientation="horizontal"
                legendPosition="bottom"
                padding={{
                  bottom: 75, // Adjusted to accommodate legend
                  left: 75, // Adjusted to accommodate legend
                  right: 0,
                  top: 0,
                }}
              >
                <ChartAxis tickFormat={(tick) => tick.toFixed(1) + " s"} />
                <ChartAxis
                  dependentAxis
                  tickFormat={(tick) => tick.toFixed(0) / 1000 + " ms"}
                />

                <ChartGroup>
                  {Object.keys(results.commands).map((command, i) => (
                    <ChartLine
                      interpolation="basis"
                      key={i}
                      name={command}
                      data={results.commands[command].map(
                        (latencyMicroSecond, j) => ({
                          x: getSeconds(results, intervalMilliSecond, j),
                          y: latencyMicroSecond,
                        })
                      )}
                    />
                  ))}
                </ChartGroup>
              </Chart>
            </div>
          </PageSection>
        </div>
      </Page>
    </>
  ) : (
    <Flex
      className="pf-v6-u-p-md pf-v6-u-h-100"
      spaceItems={{ default: "spaceItemsMd" }}
      direction={{ default: "column" }}
      justifyContent={{ default: "justifyContentCenter" }}
      alignItems={{ default: "alignItemsCenter" }}
    >
      <FlexItem>
        <Spinner aria-label="Loading spinner" />
      </FlexItem>

      <FlexItem>
        <Title headingLevel="h1">Connecting to backend ...</Title>
      </FlexItem>
    </Flex>
  );
};

export default App;
