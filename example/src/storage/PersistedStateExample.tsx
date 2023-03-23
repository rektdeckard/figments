import * as React from "react";

import usePersistedState from "./usePersistedState";

const PersistedStateExample = () => {
  const [nameA, setNameA] = usePersistedState<string | null>(
    {
      channel: "observed",
      key: "nameA",
    },
    ""
  );
  const [boolA, setBoolA] = usePersistedState<boolean>(
    {
      channel: "observed",
      key: "boolA",
    },
    false
  );

  return (
    <div>
      <h3>Persisted state</h3>
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
