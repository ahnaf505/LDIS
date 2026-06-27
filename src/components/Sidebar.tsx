import { NavLink } from "react-router-dom";
import {
  FileText,
  Layers,
  Search,
  History,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

export function Sidebar() {
  return (
    <aside className="bg-surface dark:bg-surface-dim h-full w-20 md:w-64 fixed left-0 top-0 border-r border-outline-variant flex-col py-margin-desktop z-20 hidden md:flex">
      <div className="px-gutter mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-none bg-primary text-on-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
          L
        </div>
        <div className="hidden md:block">
          <h1 className="font-headline-md text-[18px] font-bold leading-tight">
            <span className="text-primary">LDIS</span>{" "}
            <span className="text-on-surface">Lookup</span>
          </h1>
          <p className="font-body-sm text-[12px] text-on-surface-variant">Lookup Tier</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-unit">
        <NavItem to="/documents" icon={FileText} label="Documents" />
        <NavItem to="/batches" icon={Layers} label="Datasets" />
        <NavItem to="/search" icon={Search} label="Search" />
        <NavItem to="/history" icon={History} label="History" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </nav>

      <div className="px-gutter mt-auto flex flex-col gap-1">
        <div className="h-px bg-outline-variant my-2"></div>
        <NavItem to="/help" icon={HelpCircle} label="Help" />
        <button className="flex items-center gap-3 px-gutter py-2 rounded-none text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200">
          <LogOut size={20} />
          <span className="hidden md:inline text-[14px]">Logout</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
          clsx(
            "flex items-center gap-3 px-3 py-2 rounded-none transition-colors duration-200 text-[14px]",
            isActive
            ? "bg-secondary-container text-on-secondary-container font-bold border-r-4 border-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        )
      }
    >
      <Icon size={20} />
      <span className="hidden md:inline">{label}</span>
    </NavLink>
  );
}


