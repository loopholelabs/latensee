import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLegendTooltip,
  ChartLine,
  createContainer,
} from "@patternfly/react-charts";
import { bind } from "@pojntfx/dudirekta";
import { useEffect, useState } from "react";
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
  });

  const [ready, setReady] = useState(false);

  const [results, setResults] = useState<IResults>({
    offset: 0,
    commands: {},
  });
  const maxIntervalsToDisplay = 10;

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

  useEffect(() => {
    if (!ready) {
      return;
    }

    remote.SetURL("redis://localhost:6379/0");
    remote.SetInterval(intervalMilliSecond);
    remote.SetCommands(["set test 0", "get test"]);
  }, [ready]);

  const CursorVoronoiContainer = createContainer("voronoi", "cursor");
  const legendData = Object.keys(results.commands).map((command) => ({
    childName: command,
    name: command,
  }));

  return ready ? (
    <>
      <h1>LatenSee</h1>

      <button onClick={() => remote.StartLatencyMeasurement()}>
        Start latency measurement
      </button>
      <button onClick={() => remote.StopLatencyMeasurement()}>
        Stop latency measurement
      </button>

      <div
        style={{
          height: 600,
          width: 1920,
        }}
      >
        <Chart
          height={600}
          width={1920}
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
          <ChartAxis tickFormat={(tick) => tick.toFixed(0) + " s"} />
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
    </>
  ) : (
    <span>Loading ...</span>
  );
};

export default App;
