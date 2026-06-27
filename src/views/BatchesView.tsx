import { useState, useEffect, useRef } from "react";
import { FileArchive, Folder, FolderX, Upload, Download, ChevronLeft, ChevronRight, Eye, Database, Trash2, Loader2, Plus, X, Terminal, FileCode, RefreshCw, XCircle } from "lucide-react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { CodeBlock } from "../components/CodeBlock";

type InitiatedBy = {
  initials: string;
  name: string;
  color: string;
};

type Dataset = {
  id: string;
  name: string;
  status: string;
  progress: number;
  docs: number;
  bucket?: string;
  initiatedBy: InitiatedBy;
  date: string;
  type: string;
};

function sanitizeName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function buf2hex(buffer: ArrayBuffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}

export function BatchesView() {
  const origin = window.location.origin;
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion States
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // New Dataset Modal States
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const unixPreRef = useRef<HTMLPreElement>(null);
  const winPreRef = useRef<HTMLPreElement>(null);
  const pyPreRef = useRef<HTMLPreElement>(null);

  // Upload Modal States
  const [uploadTarget, setUploadTarget] = useState<Dataset | null>(null);
  const [uploadTab, setUploadTab] = useState<"web" | "curl" | "python">("web");
  const [fileQueue, setFileQueue] = useState<Array<{ file: File; key: string; status: "queued" | "uploading" | "success" | "failed"; error?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [curlPlatform, setCurlPlatform] = useState<"unix" | "win">("unix");

  const addFilesToQueue = (files: FileList, flatten = false) => {
    const entries = Array.from(files).map((f) => ({
      file: f,
      key: flatten ? f.name : f.name,
      status: "queued" as const,
    }));
    setFileQueue((prev) => [...prev, ...entries]);
  };

  const processQueue = async () => {
    setIsUploading(true);
    let token = uploadToken;
    if (!token) token = await generateToken();
    const authHeader = token ? { "Authorization": `Bearer ${token}` } : {};
    const queue = fileQueue.filter((e) => e.status === "queued");
    for (const entry of queue) {
      setFileQueue((prev) => prev.map((e) => e.file === entry.file ? { ...e, status: "uploading" as const } : e));
      try {
        const res = await fetch(`/api/s3/${encodeURIComponent(uploadTarget!.id)}/${encodeURIComponent(entry.key)}`, {
          method: "PUT",
          headers: authHeader,
          body: entry.file,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFileQueue((prev) => prev.map((e) => e.file === entry.file ? { ...e, status: "success" as const } : e));
      } catch (err: any) {
        setFileQueue((prev) => prev.map((e) => e.file === entry.file ? { ...e, status: "failed" as const, error: err.message } : e));
      }
    }
    setIsUploading(false);
    const successCount = fileQueue.filter((e) => e.status === "success").length;
    if (successCount > 0) {
      try {
        const syncRes = await fetch(`/api/datasets/${encodeURIComponent(uploadTarget!.id)}/sync-count`, { method: "POST" });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          setDatasets((prev) => prev.map((d) => d.id === uploadTarget!.id ? { ...d, docs: syncData.docs } : d));
        }
      } catch {}
    }
  };

  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading]);

  const closeUpload = () => {
    if (isUploading) return;
    setFileQueue([]);
    setUploadTarget(null);
    setUploadToken(null);
  };

  const loadToken = async (): Promise<boolean> => {
    if (!uploadTarget) return false;
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/upload-tokens/${encodeURIComponent(uploadTarget.id)}`);
      if (res.ok) {
        const data = await res.json();
        setUploadToken(data.token);
        return !!data.token;
      }
    } catch {} finally {
      setTokenLoading(false);
    }
    return false;
  };

  const generateToken = async () => {
    if (!uploadTarget) return null;
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/upload-tokens/${encodeURIComponent(uploadTarget.id)}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setUploadToken(data.token);
        return data.token as string;
      }
    } catch {} finally {
      setTokenLoading(false);
    }
    return null;
  };

  const revokeToken = async () => {
    if (!uploadTarget) return;
    setTokenLoading(true);
    try {
      await fetch(`/api/upload-tokens/${encodeURIComponent(uploadTarget.id)}`, { method: "DELETE" });
      setUploadToken(null);
    } catch {} finally {
      setTokenLoading(false);
    }
  };

  // Load or auto-generate token when switching to curl or python tab
  useEffect(() => {
    if (!uploadTarget || (uploadTab !== "curl" && uploadTab !== "python")) return;
    loadToken().then((found) => { if (!found) generateToken(); });
  }, [uploadTab, uploadTarget?.id]);

  useEffect(() => {
    if (!createError) return;
    const t = setTimeout(() => setCreateError(null), 6000);
    return () => clearTimeout(t);
  }, [createError]);

  const openNewDataset = () => {
    setNewName("");
    setNewDescription("");
    setShowNewDataset(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  };

  useEffect(() => {
    async function loadDatasets() {
      try {
        const key1Buf = crypto.getRandomValues(new Uint8Array(32));
        const key2Buf = crypto.getRandomValues(new Uint8Array(32));
        const key1Hex = buf2hex(key1Buf.buffer);
        const key2Hex = buf2hex(key2Buf.buffer);

        const res = await fetch(`/api/datasets?k1=${key1Hex}`, {
          headers: {
            "X-Key-2": key2Hex,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch datasets");
        
        const finalBuffer = await res.arrayBuffer();

        const key1 = await crypto.subtle.importKey("raw", key1Buf, { name: "AES-CBC" }, false, ["decrypt"]);
        const key2 = await crypto.subtle.importKey("raw", key2Buf, { name: "AES-CBC" }, false, ["decrypt"]);

        const iv2 = finalBuffer.slice(0, 16);
        const cipherText2 = finalBuffer.slice(16);
        const layer1Buffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv2) }, key2, cipherText2);

        const iv1 = layer1Buffer.slice(0, 16);
        const cipherText1 = layer1Buffer.slice(16);
        const rawBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv1) }, key1, cipherText1);

        const decodedText = new TextDecoder().decode(rawBuffer);
        const data = JSON.parse(decodedText);
        setDatasets(data);

        // Refresh doc counts for datasets with their own bucket
        for (const d of data) {
          if (d.bucket) {
            fetch(`/api/datasets/${encodeURIComponent(d.bucket)}/sync-count`, { method: "POST" })
              .then((r) => r.json() as any)
              .then((result) => {
                setDatasets((prev) => prev.map((x) => x.id === d.id ? { ...x, docs: result.docs } : x));
              })
              .catch(() => {});
          }
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    loadDatasets();
  }, []);

  const handleDeleteTrigger = (batch: Dataset) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setConfirmCode(code);
    setInputCode("");
    setDeleteError(null);
    setDatasetToDelete(batch);
  };

  const handleConfirmDelete = async () => {
    if (!datasetToDelete) return;
    if (inputCode !== confirmCode) {
      setDeleteError("Verification code does not match.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/datasets/${datasetToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete dataset from server");
      }

      setDatasets((prev) => prev.filter((d) => d.id !== datasetToDelete.id));
      setDatasetToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || "An error occurred while deleting.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateDataset = async () => {
    if (!newName.trim()) return;

    try {
      const response = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to create dataset");
      }

      const created = await response.json();
      setDatasets((prev) => [...prev, {
        id: created.id,
        name: created.name,
        status: "ready for query",
        progress: 100,
        docs: 0,
        initiatedBy: { initials: "ME", name: "Me", color: "#3B82F6" },
        date: new Date().toISOString().split("T")[0],
        type: "folder",
      }]);
      setShowNewDataset(false);
    } catch (err: any) {
      setCreateError(err.message || "An error occurred.");
    }
  };

  const handleUploadFile = async (file: File, key?: string) => {
    if (!uploadTarget) return;
    const objectKey = key || file.name;
    try {
      const res = await fetch(`/api/s3/${encodeURIComponent(uploadTarget.id)}/${encodeURIComponent(objectKey)}`, {
        method: "PUT",
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed for ${objectKey}`);
      setUploadTarget(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="font-headline-lg text-[24px] font-bold text-on-surface">Datasets</h2>
          <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Manage and monitor document processing jobs.</p>
        </div>
        <button onClick={openNewDataset} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-1.5 rounded-none font-headline-md text-[14px] hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm whitespace-nowrap">
          <Plus size={16} />
          New Dataset
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-none overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="w-full overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-on-surface-variant gap-3">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-body-sm text-[12px]">Loading datasets...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-error font-semibold">
              Error: {error}
            </div>
          ) : datasets.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              No datasets found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider w-8">
                    <input type="checkbox" className="rounded-none border-outline-variant text-primary focus:ring-primary bg-surface h-4 w-4" />
                  </th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Dataset Name</th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Documents</th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Created Date</th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-[14px] divide-y divide-outline-variant">
                {datasets.map((batch) => (
                  <tr key={batch.id} className="hover:bg-surface-container-low transition-colors group h-[40px]">
                    <td className="px-4 py-2">
                      <input type="checkbox" className="rounded-none border-outline-variant text-primary focus:ring-primary bg-surface h-4 w-4" />
                    </td>
                    <td className="px-4 py-2 font-headline-md text-[14px] text-on-surface">
                      <div className="flex items-center gap-2">
                        {batch.type === "zip" && <FileArchive size={18} className="text-outline" />}
                        {batch.type === "folder" && <Folder size={18} className="text-outline" />}
                        {batch.type === "folder_off" && <FolderX size={18} className="text-outline" />}
                        <Link to={`/batches/${batch.id}`} className="hover:underline">{batch.name}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-code-sm text-[12px] text-on-surface-variant tabular-nums">{batch.docs?.toLocaleString() ?? "0"}</td>
                    <td className="px-4 py-2">
                      <span className={clsx(
                        "inline-block px-2 py-0.5 text-[11px] font-semibold border",
                        batch.status?.toLowerCase() === "ready for query"
                          ? "text-tertiary border-tertiary/40 bg-tertiary-container/10"
                          : "text-on-surface-variant border-outline-variant bg-surface-container-low"
                      )}>
                        {batch.status?.toLowerCase() === "ready for query" ? "Ready for query" : "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-code-sm text-[12px] text-on-surface-variant">{batch.date}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="p-1 rounded-none text-outline hover:text-primary hover:bg-primary-fixed transition-colors" title="Upload" onClick={() => { setUploadTarget(batch); setUploadTab("web"); }}><Upload size={18} /></button>
                        <button className="p-1 rounded-none text-outline hover:text-primary hover:bg-primary-fixed transition-colors" title="Download"><Download size={18} /></button>
                        <button className="p-1 rounded-none text-outline hover:text-primary hover:bg-primary-fixed transition-colors" title="View"><Eye size={18} /></button>
                        <button className="p-1 rounded-none text-outline hover:text-primary hover:bg-primary-fixed transition-colors" title="Data Details"><Database size={18} /></button>
                        <button 
                          className="p-1 rounded-none text-outline hover:text-error hover:bg-error-container/20 transition-colors" 
                          title="Delete Dataset"
                          onClick={() => handleDeleteTrigger(batch)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3 flex items-center justify-between mt-auto">
          <span className="font-body-sm text-[12px] text-on-surface-variant">Showing 1 to {datasets.length} of {datasets.length} datasets</span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded-none hover:bg-surface-variant text-outline disabled:opacity-50" disabled>
              <ChevronLeft size={20} />
            </button>
            <button className="p-1 rounded-none hover:bg-surface-variant text-outline">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {datasetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface border border-outline-variant max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-headline-lg text-[18px] font-bold text-on-surface">Delete Dataset?</h3>
              <p className="font-body-sm text-[13px] text-on-surface-variant mt-1.5 leading-relaxed">
                You are about to permanently delete <strong className="text-on-surface">{datasetToDelete.name}</strong>. This action cannot be undone.
              </p>
            </div>

            <div className="bg-surface-container border border-outline-variant p-3 text-center rounded-none select-none">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-1">Verification Code</span>
              <span className="font-mono text-[24px] font-black tracking-widest text-primary selection:bg-transparent">{confirmCode}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider block">Type the 6 random numbers to confirm</label>
              <input 
                type="text" 
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 border border-outline-variant bg-surface rounded-none focus:outline-none focus:border-primary text-center font-mono text-[16px] tracking-widest"
              />
              {deleteError && (
                <span className="text-[11px] text-error font-semibold block mt-1">{deleteError}</span>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                onClick={() => setDatasetToDelete(null)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold text-on-surface"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-error text-white hover:bg-error/80 disabled:opacity-50 transition-colors text-[12px] font-bold flex items-center gap-1.5"
                disabled={isDeleting || inputCode.length !== 6}
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New Dataset Modal */}
      {showNewDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant w-full max-w-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div>
                <h3 className="font-headline-lg text-[18px] font-bold text-on-surface">New Dataset</h3>
                <p className="text-[12px] text-on-surface-variant mt-0.5">Register a new Elasticsearch index as a dataset.</p>
              </div>
              <button onClick={() => setShowNewDataset(false)} className="p-1.5 hover:bg-surface-container-high rounded-none text-outline transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block">Name <span className="text-error">*</span></label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. TLEAK Batch 1"
                    className="w-full px-3 py-2 border border-outline-variant bg-surface-container-lowest rounded-none focus:outline-none focus:border-primary text-[14px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block">Index Key</label>
                <input
                  type="text"
                  value={sanitizeName(newName)}
                  readOnly
                  placeholder="auto-generated from name"
                  className="w-full px-3 py-2 border border-outline-variant bg-surface-container-low text-on-surface-variant rounded-none text-[14px] cursor-default"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block">Description <span className="text-on-surface-variant font-normal normal-case tracking-normal">(optional)</span></label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief description of this dataset..."
                  className="w-full px-3 py-2 border border-outline-variant bg-surface-container-lowest rounded-none focus:outline-none focus:border-primary text-[14px] resize-none"
                />
              </div>
            </div>

            {createError && (
              <div className="mx-6 mb-2 flex items-start gap-2 bg-error-container/20 border border-error/40 px-4 py-3">
                <span className="text-error text-[13px] font-semibold shrink-0 mt-0.5">!</span>
                <p className="text-[12px] text-on-surface flex-1">{createError}</p>
                <button onClick={() => setCreateError(null)} className="text-outline hover:text-on-surface p-0.5">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-outline-variant">
              <button
                onClick={() => setShowNewDataset(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold text-on-surface"
              >
                Cancel
              </button>
              <button
                disabled={!newName.trim()}
                onClick={handleCreateDataset}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-40 transition-colors text-[12px] font-bold"
              >
                Create Dataset
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Upload Modal */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={isUploading ? undefined : closeUpload}>
          <div className="bg-surface border border-outline-variant w-full max-w-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div>
                <h3 className="font-headline-lg text-[18px] font-bold text-on-surface">Upload to {uploadTarget.name}</h3>
                <p className="text-[12px] text-on-surface-variant mt-0.5">Choose your upload method.</p>
              </div>
              <button onClick={isUploading ? undefined : closeUpload} className="p-1.5 hover:bg-surface-container-high rounded-none text-outline transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-outline-variant bg-surface-container-lowest">
              {(["web", "curl", "python"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setUploadTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-bold tracking-wider uppercase border-b-2 transition-all ${
                    uploadTab === tab
                      ? "border-primary text-primary bg-surface"
                      : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {tab === "web" && <Upload size={14} />}
                  {tab === "curl" && <Terminal size={14} />}
                  {tab === "python" && <FileCode size={14} />}
                  {tab === "web" ? "Web Upload" : tab === "curl" ? "cURL" : "Python"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {uploadTab === "web" && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center hover:border-primary transition-colors cursor-pointer"
                    onClick={() => document.getElementById("upload-input-files")?.click()}
                  >
                    <Upload size={28} className="mx-auto text-outline mb-2" />
                    <p className="text-[14px] font-semibold text-on-surface mb-1">Drop files here or click to browse</p>
                    <p className="text-[11px] text-on-surface-variant">Supports up to 20,000 files. For larger datasets, use cURL or Python.</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    id="upload-input-files"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files; if (f) addFilesToQueue(f); e.target.value = ""; }}
                  />
                  <input
                    type="file"
                    id="upload-input-folder"
                    className="hidden"
                    // @ts-ignore
                    webkitdirectory=""
                    onChange={(e) => { const f = e.target.files; if (f) addFilesToQueue(f, true); e.target.value = ""; }}
                  />
                  <div className="flex gap-2">
                    <label htmlFor="upload-input-files" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container transition-colors text-[12px] font-bold cursor-pointer">
                      <Upload size={14} /> Select Files
                    </label>
                    <label htmlFor="upload-input-folder" className="inline-flex items-center gap-2 px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold cursor-pointer">
                      <Folder size={14} /> Select Folder
                    </label>
                  </div>

                  {/* Upload Queue */}
                  {fileQueue.length > 0 && (
                    <div className="border border-outline-variant divide-y divide-outline-variant max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between px-3 py-2 bg-surface-container-low text-[11px] font-bold text-outline uppercase tracking-wider">
                        <span>Files ({fileQueue.length})</span>
                        <span>
                          {fileQueue.filter((e) => e.status === "success").length} done
                          {isUploading && ` · ${fileQueue.filter((e) => e.status === "uploading").length} uploading`}
                        </span>
                      </div>
                      {fileQueue.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                          {entry.status === "queued" && <div className="w-3 h-3 rounded-full border border-outline-variant shrink-0" />}
                          {entry.status === "uploading" && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
                          {entry.status === "success" && <div className="w-3 h-3 rounded-full bg-tertiary shrink-0" />}
                          {entry.status === "failed" && <div className="w-3 h-3 rounded-full bg-error shrink-0" />}
                          <span className="text-on-surface truncate flex-1">{entry.key}</span>
                          <span className={clsx(
                            "text-[10px] font-semibold shrink-0",
                            entry.status === "queued" && "text-on-surface-variant",
                            entry.status === "uploading" && "text-primary",
                            entry.status === "success" && "text-tertiary",
                            entry.status === "failed" && "text-error",
                          )}>
                            {entry.status === "queued" && "Queued"}
                            {entry.status === "uploading" && "Uploading"}
                            {entry.status === "success" && "Success"}
                            {entry.status === "failed" && "Failed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {fileQueue.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={processQueue}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-40 transition-colors text-[12px] font-bold"
                      >
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {isUploading ? "Uploading..." : "Upload All"}
                      </button>
                      {!isUploading && (
                        <button onClick={() => { setFileQueue([]); setUploadTarget(null); }} className="px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold text-on-surface">
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {uploadTab === "curl" && (
                <div className="space-y-3">
                  {uploadToken && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-low border border-outline-variant">
                      <span className="text-[11px] font-bold text-outline uppercase tracking-wider shrink-0">Token</span>
                      <code className="flex-1 text-[12px] font-mono text-on-surface truncate select-all">{uploadToken}</code>
                      <button onClick={() => { navigator.clipboard.writeText(uploadToken); setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); }} className="text-[11px] font-bold text-primary hover:underline shrink-0">{tokenCopied ? "Copied" : "Copy"}</button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-on-surface-variant">Upload files using cURL:</p>
                    <div className="flex gap-2 shrink-0">
                      {uploadToken ? (
                        <>
                          <button onClick={generateToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-outline-variant hover:bg-surface-container-low transition-colors text-[11px] font-bold text-on-surface disabled:opacity-40">
                            <RefreshCw size={12} className={tokenLoading ? "animate-spin" : ""} /> Regenerate
                          </button>
                          <button onClick={revokeToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-error/40 hover:bg-error-container/10 transition-colors text-[11px] font-bold text-error disabled:opacity-40">
                            <XCircle size={12} /> Revoke
                          </button>
                        </>
                      ) : (
                        <button onClick={generateToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container transition-colors text-[11px] font-bold disabled:opacity-40">
                          <RefreshCw size={12} className={tokenLoading ? "animate-spin" : ""} /> Generate Token
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex border border-outline-variant bg-surface-container-lowest">
                    <button onClick={() => setCurlPlatform("unix")} className={`flex-1 py-2 text-[11px] font-bold tracking-wider uppercase transition-all ${curlPlatform === "unix" ? "bg-surface text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-on-surface"}`}>macOS / Linux</button>
                    <button onClick={() => setCurlPlatform("win")} className={`flex-1 py-2 text-[11px] font-bold tracking-wider uppercase transition-all ${curlPlatform === "win" ? "bg-surface text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-on-surface"}`}>PowerShell</button>
                  </div>
                  {curlPlatform === "unix" ? (
                    <div className="relative">
                      <button
                        onClick={() => { if (unixPreRef.current) { navigator.clipboard.writeText(unixPreRef.current.textContent || ""); setCopiedLabel("unix"); setTimeout(() => setCopiedLabel(null), 2000); } }}
                        className="absolute top-2 right-2 text-[10px] font-bold text-primary hover:underline z-10"
                      >{copiedLabel === "unix" ? "Copied" : "Copy"}</button>
                      <CodeBlock ref={unixPreRef} language="bash" code={`FILE="your-file.jpg"\ncurl -X PUT \\\n  ${origin}/api/s3/${uploadTarget.id}/"$FILE" \\\n  -H "Authorization: Bearer ${uploadToken || "<your-token>"}" \\\n  -H "Content-Type: \${FILE##*.}" \\\n  --data-binary @"$FILE"`} />
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => { if (winPreRef.current) { navigator.clipboard.writeText(winPreRef.current.textContent || ""); setCopiedLabel("win"); setTimeout(() => setCopiedLabel(null), 2000); } }}
                        className="absolute top-2 right-2 text-[10px] font-bold text-primary hover:underline z-10"
                      >{copiedLabel === "win" ? "Copied" : "Copy"}</button>
                      <CodeBlock ref={winPreRef} language="powershell" code={`$FILE = "your-file.jpg"\ncurl.exe -X PUT "${origin}/api/s3/${uploadTarget.id}/$FILE" -H "Authorization: Bearer ${uploadToken || "<your-token>"}" -H "Content-Type: image/jpeg" --data-binary "@$FILE"`} />
                    </div>
                  )}
                </div>
              )}
              {uploadTab === "python" && (
                <div className="space-y-3">
                  {uploadToken && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-low border border-outline-variant">
                      <span className="text-[11px] font-bold text-outline uppercase tracking-wider shrink-0">Token</span>
                      <code className="flex-1 text-[12px] font-mono text-on-surface truncate select-all">{uploadToken}</code>
                      <button onClick={() => { navigator.clipboard.writeText(uploadToken); setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); }} className="text-[11px] font-bold text-primary hover:underline shrink-0">{tokenCopied ? "Copied" : "Copy"}</button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-on-surface-variant">Upload files using Python:</p>
                    <div className="flex gap-2 shrink-0">
                      {uploadToken ? (
                        <>
                          <button onClick={generateToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-outline-variant hover:bg-surface-container-low transition-colors text-[11px] font-bold text-on-surface disabled:opacity-40">
                            <RefreshCw size={12} className={tokenLoading ? "animate-spin" : ""} /> Regenerate
                          </button>
                          <button onClick={revokeToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-error/40 hover:bg-error-container/10 transition-colors text-[11px] font-bold text-error disabled:opacity-40">
                            <XCircle size={12} /> Revoke
                          </button>
                        </>
                      ) : (
                        <button onClick={generateToken} disabled={tokenLoading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container transition-colors text-[11px] font-bold disabled:opacity-40">
                          <RefreshCw size={12} className={tokenLoading ? "animate-spin" : ""} /> Generate Token
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { if (pyPreRef.current) { navigator.clipboard.writeText(pyPreRef.current.textContent || ""); setCopiedLabel("py"); setTimeout(() => setCopiedLabel(null), 2000); } }}
                      className="absolute top-2 right-2 text-[10px] font-bold text-primary hover:underline z-10"
                    >{copiedLabel === "py" ? "Copied" : "Copy"}</button>
                    <CodeBlock ref={pyPreRef} language="python" code={`import requests\n\nFILE = "your-file.jpg"\nurl = f"${origin}/api/s3/${uploadTarget.id}/{FILE}"\nheaders = {\n    "Authorization": "Bearer ${uploadToken || "<your-token>"}",\n}\n\nwith open(FILE, "rb") as f:\n    resp = requests.put(url, data=f, headers=headers)\n\nprint(resp.status_code)`} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-outline-variant">
              <button
                onClick={closeUpload}
                disabled={isUploading}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[12px] font-bold text-on-surface"
              >
                {isUploading ? "Upload in progress..." : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


