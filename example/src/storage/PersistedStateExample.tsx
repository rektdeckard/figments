import * as React from "react";

import usePersistedState from "./usePersistedState";

type Data = {
  name: string;
  bool: boolean;
};

const PersistedStateExample = () => {
  const [nameA, setNameA] = usePersistedState<string>("", {
    channel: "channel_a",
    key: "nameA",
    optimistic: true,
  });
  const [boolA, setBoolA] = usePersistedState<boolean>(false, {
    channel: "channel_a",
    key: "boolA",
    optimistic: true,
  });

  return (
    <div>
      <h3>Persisted state</h3>
      <strong>Data</strong>
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
      </div>
    </div>
  );
};

export default PersistedStateExample;
