// Starting point for React.
// - Finds the # root in index.html
// - Mounts react to it
// - Imports the index.css

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
