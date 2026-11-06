
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { Footer } from "../components/Footer/Footer";

export function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content">
      <Header variant="default" />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
