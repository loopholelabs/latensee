import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLegendTooltip,
  ChartLine,
  createContainer,
} from "@patternfly/react-charts";
import {
  Button,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  Modal,
  Page,
  PageHeader,
  PageHeaderTools,
  PageSection,
  PageSectionVariants,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  CogIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import { bind } from "@pojntfx/dudirekta";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { useElementSize } from "usehooks-ts";
import "./main.scss";

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
  const [remote, setRemote] = useState({
    SetURL: (url: string) => Promise<void>,
    SetInterval: (intervalMilliSecond: number) => Promise<void>,
    SetCommands: (commands: string[]) => Promise<void>,
    StartLatencyMeasurement: () => Promise<void>,
    StopLatencyMeasurement: () => Promise<void>,
    GetIsLatencyMeasuring: () => Promise<boolean>,
  });

  const [ready, setReady] = useState(false);

  const [results, setResults] = useState<IResults>({
    offset: 0,
    commands: {},
  });
  let maxIntervalsToDisplay = 60;

  useEffect(() => {
    bind(
      () =>
        new WebSocket(
          new URLSearchParams(window.location.search).get("socketURL") ||
            "ws://localhost:1337"
        ),
      {
        HandleLatencyMeasurement: (
          command: string,
          latencyMicroSecond: number
        ) => {
          setResults((oldResults) => {
            const newResults = { ...oldResults };

            newResults.offset++;

            if (!newResults.commands[command]) {
              newResults.commands[command] = [latencyMicroSecond];
            } else {
              newResults.commands[command].push(latencyMicroSecond);
            }

            if (newResults.commands[command].length > maxIntervalsToDisplay) {
              newResults.commands[command].shift();
            }

            return newResults;
          });
        },
        HandleError: (err: string) => {
          alert(err);
        },
      },
      remote,
      setRemote,
      {
        onOpen: () => setReady(true),
      }
    );
  }, []);

  const [isLatencyMeasuring, setIsLatencyMeasuring] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }

    (async () =>
      (await remote.GetIsLatencyMeasuring())
        ? setIsLatencyMeasuring(true)
        : setIsLatencyMeasuring(false))();
  }, [ready]);

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
    if (!ready) {
      return;
    }

    (async () => await remote.SetCommands(commands))();
  }, [ready, commands]);

  const [command, setCommand] = useState("");

  const [intervalMilliSecond, setIntervalMilliSecond] = useState(500);

  useEffect(() => {
    if (!ready) {
      return;
    }

    (async () => await remote.SetInterval(intervalMilliSecond))();
  }, [ready, intervalMilliSecond]);

  const [redisURL, setRedisURL] = useState("redis://localhost:6379/0");

  useEffect(() => {
    if (!ready) {
      return;
    }

    (async () => await remote.SetURL(redisURL))();
  }, [ready, redisURL]);

  useEffect(() => {
    if (!ready && isSettingsOpen) {
      return;
    }

    (async () =>
      await Promise.all([
        await remote.SetCommands(commands),
        await remote.SetInterval(intervalMilliSecond),
        await remote.SetURL(redisURL),
      ]))();
  }, [ready, isSettingsOpen]);

  return ready ? (
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
          <HelperText className="pf-u-py-sm">
            <HelperTextItem className="pf-x-text--helper">
              No commands have been set up yet.
            </HelperTextItem>
          </HelperText>
        ) : (
          <DataList
            isCompact
            className="pf-u-my-md"
            aria-label="List of commands to test"
          >
            {commands.map((command, i) => (
              <DataListItem key={i} aria-labelledby={`command-${i}`}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell
                        className="pf-u-display-flex pf-u-justify-content-flex-start pf-u-align-self-center"
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

        <TextInputGroup className="pf-u-mt-sm">
          <TextInputGroupMain
            placeholder="Command to add"
            value={command}
            onChange={(e) => setCommand(e)}
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
              <PlusIcon className="pf-u-mr-0 pf-u-mr-sm-on-md" />

              <span className="pf-u-display-none pf-u-display-inline-block-on-md">
                Add command
              </span>
            </Button>
          </TextInputGroupUtilities>
        </TextInputGroup>

        <Title headingLevel="h2" className="pf-u-pt-lg pf-u-pb-sm">
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
              onChange={(e) => {
                const v = parseInt(e);

                if (isNaN(v)) {
                  console.error("Could not parse test interval");

                  return;
                }

                setIntervalMilliSecond(v);
              }}
            />
          </FormGroup>

          <FormGroup label="Redis URL" isRequired fieldId="redis-url">
            <TextInput
              isRequired
              type="text"
              id="redis-url"
              name="redis-url"
              value={redisURL}
              onChange={(e) => {
                const v = e.trim();

                if (v.length <= 0) {
                  console.error("Could not work with empty Redis URL");

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
              onChange={(e) => {
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
            logo="LatenSee"
            logoComponent="span"
            headerTools={
              <PageHeaderTools>
                <Toolbar>
                  <ToolbarContent>
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
                          <DownloadIcon className="pf-u-mr-0 pf-u-mr-sm-on-md" />

                          <span className="pf-u-display-none pf-u-display-inline-block-on-md">
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
                            remote.StopLatencyMeasurement();

                            setIsStoppable(false);
                            setIsLatencyMeasuring(false);
                          }}
                        >
                          <TimesIcon className="pf-u-mr-0 pf-u-mr-sm-on-md" />

                          <span className="pf-u-display-none pf-u-display-inline-block-on-md">
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
                            remote.StopLatencyMeasurement();

                            return;
                          }

                          if (!isStoppable) {
                            setResults({ offset: 0, commands: {} });
                          }

                          remote.StartLatencyMeasurement();
                        }}
                      >
                        {isLatencyMeasuring ? (
                          <PauseIcon className="pf-u-mr-0 pf-u-mr-sm-on-md" />
                        ) : (
                          <PlayIcon className="pf-u-mr-0 pf-u-mr-sm-on-md" />
                        )}

                        <span className="pf-u-display-none pf-u-display-inline-block-on-md">
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
        <div ref={ref} className="pf-x-chart">
          <PageSection variant={PageSectionVariants.light}>
            <div
              style={{
                height: height - 48,
                width: width - 48,
              }}
            >
              <Chart
                height={height - 48}
                width={width - 48}
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
                  right: 50,
                  top: 50,
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
    <span>Loading ...</span>
  );
};

export default App;
