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
  Page,
  PageHeader,
  PageHeaderTools,
  PageSection,
  PageSectionVariants,
} from "@patternfly/react-core";
import { PauseIcon, PlayIcon } from "@patternfly/react-icons";
import { bind } from "@pojntfx/dudirekta";
import { useEffect, useState } from "react";
import { useElementSize } from "usehooks-ts";
import "./main.scss";

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
  const maxIntervalsToDisplay = 60;

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

  const intervalMilliSecond = 500;

  const [isLatencyMeasuring, setIsLatencyMeasuring] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }

    remote.SetURL("redis://localhost:6379/0");
    remote.SetInterval(intervalMilliSecond);
    remote.SetCommands(["set test 0", "get test"]);

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

  return ready ? (
    <>
      <Page
        header={
          <PageHeader
            logo="LatenSee"
            logoComponent="span"
            headerTools={
              <PageHeaderTools>
                <Button
                  variant="primary"
                  icon={isLatencyMeasuring ? <PauseIcon /> : <PlayIcon />}
                  onClick={() => {
                    setIsLatencyMeasuring((latency) => !latency);

                    isLatencyMeasuring
                      ? remote.StopLatencyMeasurement()
                      : remote.StartLatencyMeasurement();
                  }}
                >
                  {" "}
                  {isLatencyMeasuring ? "Stop" : "Start"} test
                </Button>
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
                    labels={({ datum }: any) => `${datum.y} µs`}
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
                  tickFormat={(tick) => tick.toFixed(0) + " µs"}
                />

                <ChartGroup>
                  {Object.keys(results.commands).map((command, i) => (
                    <ChartLine
                      interpolation="basis"
                      key={i}
                      name={command}
                      data={results.commands[command].map(
                        (latencyMicroSecond, j) => ({
                          x:
                            (results.offset * intervalMilliSecond) / 1000 +
                            (j * intervalMilliSecond) / 1000,
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
