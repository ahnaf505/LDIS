import { User, Camera } from "lucide-react";

export function SettingsView() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-48 lg:w-64 flex-shrink-0">
        <h2 className="font-headline-lg text-[24px] font-bold text-on-surface mb-6">Settings</h2>
        <nav className="flex flex-col gap-1 border-l border-outline-variant pl-4">
          <a href="#profile" className="font-body-md text-[14px] py-2 px-3 text-primary border-l-2 -ml-[17px] border-primary bg-surface-container-low rounded-none font-bold">Profile Settings</a>
          <a href="#ocr" className="font-body-md text-[14px] py-2 px-3 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-none transition-colors">OCR Engine</a>
          <a href="#notifications" className="font-body-md text-[14px] py-2 px-3 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-none transition-colors">Notifications</a>
          <a href="#billing" className="font-body-md text-[14px] py-2 px-3 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-none transition-colors">Billing & Plans</a>
          <a href="#api" className="font-body-md text-[14px] py-2 px-3 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface rounded-none transition-colors">API Keys</a>
        </nav>
      </aside>

      <div className="flex-1 space-y-12 pb-20">
        <section id="profile" className="bg-surface-container-lowest border border-outline-variant rounded-none p-6 lg:p-8">
          <div className="mb-6 border-b border-outline-variant pb-4">
            <h3 className="font-headline-md text-[18px] font-bold text-on-surface">Profile Settings</h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Manage your personal information and account details.</p>
          </div>
          <div className="flex items-start gap-6 mb-8">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-none bg-surface-container-high border border-outline-variant overflow-hidden flex items-center justify-center">
                <User size={36} className="text-on-surface-variant" />
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Avatar</label>
              <div className="flex gap-3">
                <button className="bg-surface-container-highest text-on-surface font-body-sm text-[12px] px-4 py-2 rounded-none hover:bg-surface-variant transition-colors border border-outline-variant">Change</button>
                <button className="text-error font-body-sm text-[12px] px-4 py-2 hover:bg-error-container/20 rounded-none transition-colors">Remove</button>
              </div>
              <p className="font-body-sm text-outline mt-2 text-xs">JPG, GIF or PNG. Max size of 2MB.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Full Name</label>
              <input type="text" defaultValue="Jane Doe" className="w-full bg-surface-container-lowest border border-outline-variant rounded-none px-3 py-2 font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary focus:border-2 transition-colors" />
            </div>
            <div>
              <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Email Address</label>
              <input type="email" defaultValue="jane.doe@enterprise.com" className="w-full bg-surface-container-lowest border border-outline-variant rounded-none px-3 py-2 font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary focus:border-2 transition-colors" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Role / Title</label>
              <input type="text" defaultValue="Senior Discovery Analyst" className="w-full bg-surface-container-lowest border border-outline-variant rounded-none px-3 py-2 font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary focus:border-2 transition-colors" />
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button className="bg-primary text-on-primary font-body-md text-[14px] px-6 py-2 rounded-none hover:opacity-90 transition-opacity">Save Profile</button>
          </div>
        </section>

        <section id="ocr" className="bg-surface-container-lowest border border-outline-variant rounded-none p-6 lg:p-8">
          <div className="mb-6 border-b border-outline-variant pb-4">
            <h3 className="font-headline-md text-[18px] font-bold text-on-surface">OCR Engine Preferences</h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Configure global extraction behaviors and confidence thresholds.</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Primary Language</label>
              <select className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-none px-3 py-2 font-body-md text-[14px] text-on-surface focus:outline-none focus:border-primary focus:border-2 transition-colors">
                <option>English (US)</option>
                <option>English (UK)</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
                <option>Multi-lingual Auto-detect</option>
              </select>
            </div>
            <div className="bg-surface-container-low p-4 rounded-none border border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <label className="block font-label-caps text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">Confidence Threshold Alert</label>
                <span className="font-code-sm text-[12px] text-primary">85%</span>
              </div>
              <input type="range" min="50" max="100" defaultValue="85" className="w-full h-1 bg-outline-variant rounded-none appearance-none cursor-pointer accent-primary" />
              <p className="font-body-sm text-outline mt-2 text-xs">Flag documents requiring manual review if extraction confidence falls below this percentage.</p>
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary focus:ring-offset-surface-container-lowest bg-surface-container-lowest" />
                <span className="font-body-md text-[14px] text-on-surface">Enable handwriting recognition (Beta)</span>
              </label>
              <p className="font-body-sm text-outline ml-7 mt-1 text-xs">May increase processing time per document by 15-20%.</p>
            </div>
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary focus:ring-offset-surface-container-lowest bg-surface-container-lowest" />
                <span className="font-body-md text-[14px] text-on-surface">Auto-deskew scanned images</span>
              </label>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button className="bg-surface-container-highest text-on-surface border border-outline-variant font-body-md text-[14px] px-6 py-2 rounded-none hover:bg-surface-variant transition-colors mr-3">Discard</button>
            <button className="bg-primary text-on-primary font-body-md text-[14px] px-6 py-2 rounded-none hover:opacity-90 transition-opacity">Apply Settings</button>
          </div>
        </section>

        <section id="notifications" className="bg-surface-container-lowest border border-outline-variant rounded-none p-6 lg:p-8">
          <div className="mb-6 border-b border-outline-variant pb-4">
            <h3 className="font-headline-md text-[18px] font-bold text-on-surface">System Notifications</h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Manage email and in-app alerts for dataset processing.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-outline-variant">
              <div>
                <p className="font-body-md text-[14px] font-semibold text-on-surface">Dataset Completion</p>
                <p className="font-body-sm text-[12px] text-on-surface-variant">Notify me when a large dataset finishes processing.</p>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary" />
                  <span className="font-body-sm text-[12px]">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary" />
                  <span className="font-body-sm text-[12px]">In-App</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-outline-variant">
              <div>
                <p className="font-body-md text-[14px] font-semibold text-on-surface">Low Confidence Flags</p>
                <p className="font-body-sm text-[12px] text-on-surface-variant">Alerts for documents requiring manual review.</p>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary" />
                  <span className="font-body-sm text-[12px]">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-primary border-outline-variant rounded-none focus:ring-primary" />
                  <span className="font-body-sm text-[12px]">In-App</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-body-md text-[14px] font-semibold text-on-surface">System Maintenance</p>
                <p className="font-body-sm text-[12px] text-on-surface-variant">Important updates regarding platform downtime.</p>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked disabled className="w-4 h-4 text-outline border-outline-variant rounded-none bg-surface-variant" />
                  <span className="font-body-sm text-[12px] text-outline">Email (Required)</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


