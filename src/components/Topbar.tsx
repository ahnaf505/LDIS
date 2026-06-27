import { Bell, User } from "lucide-react";

export function Topbar() {
  return (
    <header className="bg-surface-bright dark:bg-surface-container sticky top-0 z-10 border-b border-outline-variant flex justify-between items-center h-[56px] px-margin-desktop shrink-0">
      <div className="flex items-center w-full max-w-md">
        {/* Search input removed as requested */}
      </div>
      <div className="flex items-center gap-4 ml-4">
        <button className="bg-primary text-on-primary px-4 py-1.5 rounded-none font-headline-md text-[14px] hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm whitespace-nowrap hidden sm:block">
          New Dataset
        </button>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <button className="p-1.5 rounded-none hover:bg-surface-container-high transition-colors">
            <Bell size={20} />
          </button>
          <button className="p-1.5 rounded-none hover:bg-surface-container-high transition-colors">
            <User size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}


