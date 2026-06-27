import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder, Loader2, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { searchOcrDocuments, type ElasticsearchHit, type ElasticsearchOcrDocument } from "../lib/elasticsearch";
import { getS3ObjectUrl } from "../lib/s3";
import { LazyImage } from "../components/LazyImage";

function getScoreLabel(hit: ElasticsearchHit, query: string) {
  if (query.trim()) {
    return hit.score !== null ? hit.score.toFixed(2) : "0.00";
  }

  return null;
}

export function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const urlQuery = searchParams.get("q") || "";

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const PAGE_SIZE = 12;
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<ElasticsearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupStats, setLookupStats] = useState<{ count: number; elapsedMs: number } | null>(null);
  const [from, setFrom] = useState(0);
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset offset and results when the search query changes
  useEffect(() => {
    setResults([]);
    setTotal(0);
    setFrom(0);
  }, [deferredQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    if (from === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    searchOcrDocuments(deferredQuery, PAGE_SIZE, from, controller.signal)
      .then((response) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults((prev) => (from === 0 ? response.hits : [...prev, ...response.hits]));
        setTotal(response.total);
        setLookupStats({
          count: response.total,
          elapsedMs: response.tookMs,
        });
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const message = err instanceof Error ? err.message : "Failed to query Elasticsearch.";
        setError(message);
        if (from === 0) {
          setResults([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [deferredQuery, from]);

  const hasMore = results.length < total;

  // Setup intersection observer for infinite scrolling
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setFrom((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, results.length]);

  const resultSummary = useMemo(() => {
    if (loading && from === 0) {
      return "Searching OCR text...";
    }

    if (error) {
      return "Search unavailable";
    }

    return `${total.toLocaleString()} matches`;
  }, [error, loading, total]);

  return (
    <div className="absolute inset-0 flex flex-col bg-background z-10">
      <section className="bg-surface-container-lowest p-gutter border-b border-outline-variant shrink-0">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                const val = event.target.value;
                setQuery(val);
                setSearchParams(val ? { q: val } : {}, { replace: true });
              }}
              placeholder="Contains search in OCR text..."
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-body-sm text-[12px] hover:underline">
              Contains
            </button>
          </div>
        </div>
      </section>

      <section className="flex-1 overflow-auto bg-background p-gutter">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 className="text-headline-md text-[18px] font-bold text-on-surface">
              Search Results <span className="text-body-sm text-[12px] text-on-surface-variant font-normal">({resultSummary})</span>
            </h2>
            <div className="flex items-center gap-2 text-body-sm text-[12px] text-on-surface-variant">
              {lookupStats ? (
                <span className="px-2 py-0.5 border border-outline-variant rounded-none bg-surface-container-lowest">
                  {lookupStats.count} results in {lookupStats.elapsedMs} ms
                </span>
              ) : null}
              <span className="px-2 py-0.5 border border-outline-variant rounded-none bg-surface-container-lowest">
                Mode: <span className="text-on-surface font-semibold">contains</span>
              </span>
              <span className="px-2 py-0.5 border border-outline-variant rounded-none bg-surface-container-lowest">
                Index: <span className="text-on-surface font-semibold">tleak-batch-1</span>
              </span>
            </div>
          </div>

          {error ? (
            <div className="border border-error bg-error-container/20 text-on-surface p-4 rounded-none">
              <p className="font-semibold text-error mb-1">Elasticsearch search failed</p>
              <p className="text-body-sm text-[12px]">{error}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-12">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-16 text-on-surface-variant gap-3 border border-dashed border-outline-variant rounded-none bg-surface-container-lowest">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-body-sm text-[12px]">Querying OCR documents...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-on-surface-variant border border-dashed border-outline-variant rounded-none bg-surface-container-lowest">
                <FileText size={28} className="mb-3" />
                <p className="font-semibold text-on-surface">No OCR matches found</p>
                <p className="text-body-sm text-[12px] mt-1">Try a different term from the document text.</p>
              </div>
            ) : (
              <>
                {results.map((hit) => {
                  const { source } = hit;
                  const scoreLabel = getScoreLabel(hit, deferredQuery);

                  return (
                    <Link
                      to={`/document/${encodeURIComponent(hit.id)}`}
                      key={hit.id}
                      title={source.source_path}
                      className="bg-surface-container-lowest border border-outline-variant hover:border-primary overflow-hidden transition-colors flex flex-col cursor-pointer group"
                    >
                      <div className="relative bg-surface-container overflow-hidden h-44">
                        <SearchThumbnail source={source} bucket={hit.bucket} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />
                        {scoreLabel ? (
                          <div className="absolute top-3 right-3">
                            <span className="text-label-caps text-[11px] font-bold text-secondary bg-surface-container-low px-2 py-0.5 rounded-none border border-outline-variant whitespace-nowrap shadow-sm">
                              {scoreLabel}
                            </span>
                          </div>
                        ) : null}
                        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/90">
                          <span className="px-2 py-0.5 border border-white/30 bg-black/25 rounded-none">
                            {source.extension.replace(/^\./, "").toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="text-body-md text-[14px] font-bold truncate text-on-surface" title={source.filename}>
                          {source.filename}
                        </h3>
                        <div className="text-body-sm text-[12px] text-on-surface-variant mt-1 flex items-center gap-1">
                          <Folder size={16} /> {source.batch_name}
                        </div>
                        <div className="mt-auto pt-3 flex justify-between items-center border-t border-outline-variant mt-3">
                          <span className="text-label-caps text-[11px] font-bold text-secondary">
                            {source.ocr_line_count ?? 0} OCR LINES
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {hasMore && (
                  <div 
                    ref={sentinelRef} 
                    className="col-span-full flex justify-center items-center py-6 bg-surface-container-lowest border border-dashed border-outline-variant rounded-none"
                  >
                    <Loader2 className="animate-spin text-primary mr-2" size={18} />
                    <span className="text-body-sm text-[12px] text-on-surface-variant font-medium">Loading more documents...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SearchThumbnail({ source, bucket }: { source: ElasticsearchOcrDocument; bucket: string }) {
  return (
    <LazyImage
      src={getS3ObjectUrl(source, bucket)}
      alt={source.filename}
      containerClassName="h-full w-full"
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      placeholder={
        <div className="h-full w-full flex items-center justify-center bg-surface-container text-on-surface-variant">
          <Loader2 size={20} className="animate-spin" />
        </div>
      }
    />
  );
}
