// Starting point for React.
// - Finds the # root in index.html
// - Mounts react to it
// - Imports the index.css

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthProvider.tsx";
import Router from "./router/router.tsx";
import "./styles/index.css";
import { applyStoredTableColor } from "./theme/tableColors.ts";

// The table color chosen in the settings, before the first render
applyStoredTableColor();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
