import { Filter, Download, Eye, Download as ExportIcon, Search, AlertTriangle, LogIn, Edit, ChevronDown, Folder } from "lucide-react";
import clsx from "clsx";

const historyData = [
  {
    id: 1,
    time: "10:42 AM",
    date: "Today",
    action: "Viewed",
    actionIcon: Eye,
    actionColor: "text-on-secondary-container",
    actionBg: "bg-secondary-container",
    reference: "Quarterly_Financial_Report_Q3.pdf",
    folder: "Finance / Reports / 2023",
    user: "J. Doe"
  },
  {
    id: 2,
    time: "09:15 AM",
    date: "Today",
    action: "Exported",
    actionIcon: ExportIcon,
    actionColor: "text-on-tertiary-container",
    actionBg: "bg-tertiary-container",
    reference: "Dataset OCR Data: Legal_Discovery_Set_A",
    tag: "CSV",
    details: "142 Documents Processed",
    user: "System"
  },
  {
    id: 3,
    time: "04:30 PM",
    date: "Yesterday",
    action: "Searched",
    actionIcon: Search,
    actionColor: "text-on-surface-variant",
    actionBg: "bg-surface-variant",
    reference: '"indemnification clause AND contractor"',
    details: "Global Search • 24 Results Found",
    user: "J. Doe"
  },
  {
    id: 4,
    time: "02:12 PM",
    date: "Yesterday",
    action: "Error",
    actionIcon: AlertTriangle,
    actionColor: "text-on-error-container",
    actionBg: "bg-error-container",
    reference: "OCR Failure: Scanned_Invoice_0049.png",
    errorDetails: "Image resolution too low for accurate processing (DPI < 150).",
    user: "System"
  },
  {
    id: 5,
    time: "11:05 AM",
    date: "Yesterday",
    action: "Viewed",
    actionIcon: Eye,
    actionColor: "text-on-secondary-container",
    actionBg: "bg-secondary-container",
    reference: "Employee_Handbook_2024_Draft.docx",
    folder: "HR / Policies / Drafts",
    user: "A. Smith"
  },
  {
    id: 6,
    time: "07:55 AM",
    date: "Yesterday",
    action: "User Login",
    actionIcon: LogIn,
    actionColor: "text-on-surface-variant",
    actionBg: "bg-surface-variant",
    reference: "Session started from IP: 192.168.1.45",
    details: "Web Client • Chrome on Windows",
    user: "A. Smith"
  },
  {
    id: 7,
    time: "05:12 PM",
    date: "2 Days Ago",
    action: "Metadata Updated",
    actionIcon: Edit,
    actionColor: "text-on-secondary-container",
    actionBg: "bg-secondary-container",
    reference: "Tax_Return_2022.pdf",
    details: "Updated tags: 'Urgent', 'Reviewed'",
    user: "J. Doe"
  }
];

export function HistoryView() {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-[24px] font-bold text-on-surface">Activity History</h2>
          <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">A chronological log of your recent interactions and document processes.</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button className="border border-outline-variant text-on-surface px-3 py-1.5 rounded-none font-body-sm text-[12px] flex items-center gap-2 hover:bg-surface-container-low transition-colors">
            <Filter size={16} />
            Filter
          </button>
          <button className="border border-outline-variant text-on-surface px-3 py-1.5 rounded-none font-body-sm text-[12px] flex items-center gap-2 hover:bg-surface-container-low transition-colors">
            <Download size={16} />
            Export Log
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-none overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-gutter py-2 border-b border-outline-variant bg-surface-container-low sticky top-0 z-0">
          <div className="col-span-3 md:col-span-2 font-label-caps text-[11px] font-bold text-outline uppercase">Timestamp</div>
          <div className="col-span-2 md:col-span-2 font-label-caps text-[11px] font-bold text-outline uppercase hidden md:block">Action</div>
          <div className="col-span-7 md:col-span-6 font-label-caps text-[11px] font-bold text-outline uppercase">Reference / Query</div>
          <div className="col-span-2 md:col-span-2 font-label-caps text-[11px] font-bold text-outline uppercase text-right hidden md:block">User</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {historyData.map((item) => {
            const Icon = item.actionIcon;
            return (
              <div key={item.id} className="grid grid-cols-12 gap-4 px-gutter py-3 border-b border-outline-variant hover:bg-surface-container-low transition-colors items-center group cursor-pointer">
                <div className="col-span-3 md:col-span-2 font-code-sm text-[12px] text-on-surface-variant">
                  {item.time}<br /><span className="text-outline text-[10px]">{item.date}</span>
                </div>
                <div className="col-span-2 md:col-span-2 hidden md:flex items-center gap-2">
                  <div className={clsx("w-6 h-6 rounded-none flex items-center justify-center", item.actionBg, item.actionColor)}>
                    <Icon size={14} />
                  </div>
                  <span className="font-body-sm text-[12px] text-on-surface">{item.action}</span>
                </div>
                <div className="col-span-9 md:col-span-6 flex flex-col">
                  <span className={clsx("font-body-md text-[14px]", item.action === "Viewed" || item.action === "Metadata Updated" ? "text-primary font-medium group-hover:underline" : "text-on-surface font-medium")}>
                    {item.action === "Searched" ? (
                      <><span className="font-code-sm">{item.reference.replace(/"/g, '')}</span></>
                    ) : item.reference}
                  </span>
                  
                  {item.folder && (
                    <span className="font-body-sm text-[12px] text-outline flex items-center gap-1 mt-0.5">
                      <Folder size={14} /> {item.folder}
                    </span>
                  )}
                  {item.tag && item.details && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-none text-[10px] font-medium border border-outline-variant">{item.tag}</span>
                      <span className="font-body-sm text-[12px] text-outline">{item.details}</span>
                    </div>
                  )}
                  {!item.tag && item.details && (
                    <span className="font-body-sm text-[12px] text-outline mt-0.5">{item.details}</span>
                  )}
                  {item.errorDetails && (
                    <span className="font-body-sm text-[12px] text-error mt-0.5">{item.errorDetails}</span>
                  )}
                </div>
                <div className="col-span-2 md:col-span-2 hidden md:flex justify-end items-center gap-2">
                  <span className="font-body-sm text-[12px] text-on-surface-variant">{item.user}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="bg-surface-bright border-t border-outline-variant p-3 flex justify-center">
          <button className="text-primary font-body-sm text-[12px] font-medium hover:underline flex items-center gap-1">
            Load More <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


