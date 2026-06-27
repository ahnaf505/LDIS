import { useState, useEffect } from "react";
import { FileArchive, Folder, FolderX, Download, ChevronLeft, ChevronRight, Eye, Database, Trash2, Loader2 } from "lucide-react";
import clsx from "clsx";
import { Link } from "react-router-dom";

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
  initiatedBy: InitiatedBy;
  date: string;
  type: string;
};

function buf2hex(buffer: ArrayBuffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}

export function BatchesView() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion States
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="font-headline-lg text-[24px] font-bold text-on-surface">Datasets</h2>
          <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Manage and monitor document processing jobs.</p>
        </div>
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
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Created Date</th>
                  <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-[14px] divide-y divide-outline-variant">
                {datasets.map((batch) => (
                  <tr key={batch.id} className={clsx("hover:bg-surface-container-low transition-colors group h-[40px]", batch.status === "Failed" && "bg-error-container/10")}>
                    <td className="px-4 py-2">
                      <input type="checkbox" className="rounded-none border-outline-variant text-primary focus:ring-primary bg-surface h-4 w-4" />
                    </td>
                    <td className="px-4 py-2 font-headline-md text-[14px] text-on-surface">
                      <div className="flex items-center gap-2">
                        {batch.type === "zip" && <FileArchive size={18} className="text-outline" />}
                        {batch.type === "folder" && <Folder size={18} className="text-outline" />}
                        {batch.type === "folder_off" && <FolderX size={18} className="text-outline" />}
                        <Link to={`/search?q=&index=${batch.id}`} className="hover:underline">{batch.name}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-code-sm text-[12px] text-on-surface-variant tabular-nums">{batch.docs.toLocaleString()}</td>
                    <td className="px-4 py-2 font-code-sm text-[12px] text-on-surface-variant">{batch.date}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
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
    </div>
  );
}


