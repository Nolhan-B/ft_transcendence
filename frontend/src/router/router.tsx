import { Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";

import { App } from "../App";
import { HomePage } from "../pages/HomePage/HomePage";

function Router() {
  return (
    <Routes>
      {/* Default layout */}
      <Route element={<MainLayout />} path="/">
        <Route index element={<App/>} />
        <Route path='/home' element={<HomePage/>} />
      </Route>
    </Routes>
  );
}

export default Router;
