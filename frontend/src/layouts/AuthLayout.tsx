
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { Footer } from "../components/Footer/Footer";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content">
      <Header variant="simple" />
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
