import React, { Suspense } from "react";
import * as ReactDOM from "react-dom";

import StorageExample from "./storage/StorageExample";
import PersistedStateExample from "./storage/PersistedStateExample";
import "./ui.css";

const App: React.FC<{}> = () => {
  return (
    <div className="app">
      <StorageExample />
      <PersistedStateExample />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("react-page"));
