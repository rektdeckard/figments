import * as React from "react";

import { Storage, StorageClient, StorageMethod } from "../../../src";

const channelA = new StorageClient("observed", [
  [
    ["stuff"],
    (e) => {
      const { method, key, value } = e.data.pluginMessage;
      if (method === StorageMethod.SET || method === StorageMethod.DELETE) {
        console.log(`${key} changed to`, value);
      }
    },
  ],
]);
const channelB = Storage.createClient("async");

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
    channelA.enable();
    channelB.enable();

    channelA.observe<Data>(["stuff"], (event) => {
      const { method, value } = event.data.pluginMessage;

      switch (method) {
        case StorageMethod.GET:
        case StorageMethod.SET:
          setStorageA(value);
          break;
        case StorageMethod.DELETE:
          setStorageA(null);
          break;
        case StorageMethod.KEYS:
          console.log(value);
          break;
        default:
          return;
      }
    });

    return () => {
      channelA.disable();
      channelB.disable();
    };
  }, []);

  return (
    <div>
      <h3>Storage</h3>
      <strong>With Observer</strong>
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
              channelA.requestSet("stuff", { name: nameA, bool: boolA })
            }
          >
            SET
          </button>
          <button onClick={() => channelA.requestDelete("stuff")}>
            DELETE
          </button>
        </div>
      </div>
      <pre>{JSON.stringify(storageA, null, 2)}</pre>

      <strong>With Async</strong>
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
            onClick={async () => {
              const data = await channelB.setAsync("other_stuff", {
                name: nameB,
                bool: boolB,
              });
            }}
          >
            SET
          </button>
          <button
            onClick={async () => {
              const data = await channelB.getAsync<Data>("other_stuff");
              setStorageB(data);
            }}
          >
            GET
          </button>
          <button onClick={() => channelB.requestDelete("other_stuff")}>
            DELETE
          </button>
        </div>
      </div>
      <pre>{JSON.stringify(storageB, null, 2)}</pre>
    </div>
  );
};

export default StorageExample;
