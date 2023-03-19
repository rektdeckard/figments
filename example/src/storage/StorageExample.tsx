import * as React from "react";

import { Storage, ResponseType } from "../../../src";

const channelA = Storage.createClient("channel_a");
const channelB = Storage.createClient("channel_b");

type Data = {
  name: string;
  bool: boolean;
};

const StorageExample = () => {
  const [nameA, setNameA] = React.useState<string>("");
  const [boolA, setBoolA] = React.useState<boolean>(false);
  const [storageA, setStorageA] = React.useState<Data | null>(null);

  const [nameB, setNameB] = React.useState<string>("");
  const [boolB, setBoolB] = React.useState<boolean>(false);
  const [storageB, setStorageB] = React.useState<Data | null>(null);

  React.useEffect(() => {
    channelA.register<Data | null>("listener", (event) => {
      const { type, payload } = event.data.pluginMessage;

      if (payload.key !== "stuff") return;

      switch (type) {
        case ResponseType.GET:
        case ResponseType.SET:
          setStorageA(payload.value);
          break;
        case ResponseType.DELETE:
          setStorageA(null);
          break;
        default:
          return;
      }
    });

    channelB.register<Data | null>("listener", (event) => {
      const { type, payload } = event.data.pluginMessage;

      if (payload.key !== "stuff") return;

      switch (type) {
        case ResponseType.GET:
        case ResponseType.SET:
          setStorageB(payload.value);
          break;
        case ResponseType.DELETE:
          setStorageB(null);
          break;
        default:
          return;
      }
    });

    return () => {
      channelA.unregister("listener");
      channelB.unregister("listener");
    };
  }, []);

  return (
    <div>
      <h3>Storage</h3>
      <strong>Channel A</strong>
      <div className="row">
        <div className="row-part">
          <label htmlFor="boolA">
            Bool
            <input
              name="boolA"
              type="checkbox"
              checked={boolA}
              onChange={(e) => setBoolA(e.target.checked)}
            />
          </label>
          <label htmlFor="nameA">
            Name
            <input
              name="nameA"
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
            />
          </label>
        </div>
        <div className="row-part">
          <button
            onClick={() =>
              channelA.requestSet("stuff", { name: nameA, bool: boolA }, true)
            }
          >
            Store
          </button>
          <button onClick={() => channelA.requestReset("stuff", true)}>
            Reset
          </button>
        </div>
      </div>
      <pre>{JSON.stringify(storageA)}</pre>

      <strong>Channel B</strong>
      <div className="row">
        <div className="row-part">
          <label htmlFor="boolB">
            Bool
            <input
              name="boolB"
              type="checkbox"
              checked={boolB}
              onChange={(e) => setBoolB(e.target.checked)}
            />
          </label>
          <label htmlFor="nameB">
            Name
            <input
              name="nameB"
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
            />
          </label>
        </div>
        <div className="row-part">
          <button
            onClick={() =>
              channelB.requestSet("stuff", { name: nameB, bool: boolB }, true)
            }
          >
            Store
          </button>
          <button onClick={() => channelB.requestReset("stuff", true)}>
            Reset
          </button>
        </div>
      </div>
      <pre>{JSON.stringify(storageB)}</pre>
    </div>
  );
};

export default StorageExample;
