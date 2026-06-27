import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";

export function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background font-body-md text-on-background">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen md:ml-64 w-full md:w-[calc(100%-256px)]">
        <Topbar />
        <main className="relative flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
