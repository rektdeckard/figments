import React, { Suspense } from "react";
import * as ReactDOM from "react-dom";

import StorageExample from "./storage/StorageExample";
import PersistedStateExample from "./storage/PersistedStateExample";
import FetchExample from "./fetch/FetchExample";

import "./ui.css";

const App: React.FC<{}> = () => {
  return (
    <div className="app">
      <StorageExample />
      <PersistedStateExample />
      <hr />
      <FetchExample />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("react-page"));
