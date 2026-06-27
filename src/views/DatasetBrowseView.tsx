import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, Loader2, ArrowLeft, ChevronDown } from "lucide-react";

type S3Object = {
  key: string;
  size: number;
  lastModified: string;
};

type FilesResponse = {
  bucket: string;
  objects: S3Object[];
  nextContinuationToken?: string;
};

const PAGE_SIZE = 20;

export function DatasetBrowseView() {
  const { bucket } = useParams<{ bucket: string }>();
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (token?: string) => {
    const params = new URLSearchParams();
    params.set("maxKeys", String(PAGE_SIZE));
    if (token) params.set("continuationToken", token);

    const res = await fetch(`/api/datasets/${encodeURIComponent(bucket!)}/files?${params}`);
    if (!res.ok) throw new Error("Failed to list files");
    return res.json() as Promise<FilesResponse>;
  }, [bucket]);

  useEffect(() => {
    if (!bucket) return;
    setLoading(true);
    setError(null);
    setObjects([]);
    setNextToken(undefined);
    loadingRef.current = false;

    fetchPage()
      .then((data) => {
        setObjects(data.objects);
        setNextToken(data.nextContinuationToken);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bucket, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !nextToken) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextToken);
      setObjects((prev) => [...prev, ...data.objects]);
      setNextToken(data.nextContinuationToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [nextToken, fetchPage]);

  useEffect(() => {
    if (!nextToken || loading || loadingMore) return;
    const el = tableRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loadingRef.current || !nextToken) return;
      const threshold = el.scrollHeight - el.clientHeight - 400;
      if (el.scrollTop >= threshold) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [nextToken, loading, loadingMore, loadMore]);

  useEffect(() => {
    if (loading || !nextToken || loadingMore) return;
    const el = tableRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) loadMore();
  }, [loading, nextToken, loadingMore, loadMore, objects.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-on-surface-variant gap-3">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-body-sm text-[12px]">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-error bg-error-container/20 border border-error p-4 max-w-md mx-auto">
          <p className="font-semibold">Error: {error}</p>
        </div>
        <Link to="/batches" className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold">Back to Datasets</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/batches" className="p-2 hover:bg-surface-container-low transition-colors border border-outline-variant text-on-surface">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="font-headline-lg text-[24px] font-bold text-on-surface">{bucket}</h2>
          <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">Displaying {objects.length} file{objects.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div ref={tableRef} className="bg-surface-container-lowest border border-outline-variant overflow-auto shadow-sm flex-1">
        {objects.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">No files found in this bucket.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider">Last Modified</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-[14px] divide-y divide-outline-variant">
              {objects.map((obj) => (
                <tr key={obj.key} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-2 flex items-center gap-2">
                    <FileText size={16} className="text-outline shrink-0" />
                    <span className="text-on-surface truncate max-w-md">{obj.key}</span>
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant tabular-nums">
                    {obj.size < 1024 ? `${obj.size} B` : obj.size < 1048576 ? `${(obj.size / 1024).toFixed(1)} KB` : `${(obj.size / 1048576).toFixed(1)} MB`}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant">{new Date(obj.lastModified).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {loadingMore && (
          <div className="flex items-center justify-center py-4 text-on-surface-variant gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[12px]">Loading more...</span>
          </div>
        )}
        {nextToken && !loadingMore && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              className="flex items-center gap-2 px-4 py-2 border border-outline-variant hover:bg-surface-container-low transition-colors text-[12px] font-bold"
            >
              <ChevronDown size={14} />
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
