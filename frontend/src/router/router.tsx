import { Route, Routes } from "react-router-dom";

import { App } from "../old/App";

function Router() {
  return (
    <Routes>
      <Route element={<App />} path="/" />
    </Routes>
  );
}

export default Router;
