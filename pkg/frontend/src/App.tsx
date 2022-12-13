import { bind } from "@pojntfx/dudirekta";
import { useEffect, useState } from "react";
import "./main.scss";

const App = () => {
  const [remote, setRemote] = useState({
    SetURL: (url: string) => Promise<void>,
    SetInterval: (intervalMilliSecond: number) => Promise<void>,
    SetCommands: (commands: string[]) => Promise<void>,
    StartLatencyMeasurement: () => Promise<void>,
    StopLatencyMeasurement: () => Promise<void>,
  });

  const [ready, setReady] = useState(false);

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
          console.log(command, latencyMicroSecond);
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

  useEffect(() => {
    if (!ready) {
      return;
    }

    remote.SetURL("redis://localhost:6379/0");
    remote.SetInterval(500);
    remote.SetCommands(["set test 0", "get test"]);
  }, [ready]);

  return ready ? (
    <>
      <h1>LatenSee</h1>

      <button onClick={() => remote.StartLatencyMeasurement()}>
        Start latency measurement
      </button>
      <button onClick={() => remote.StopLatencyMeasurement()}>
        Stop latency measurement
      </button>
    </>
  ) : (
    <span>Loading ...</span>
  );
};

export default App;
