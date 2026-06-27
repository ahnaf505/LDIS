import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Loader2, 
  FileText, 
  Folder, 
  Eye, 
  EyeOff, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Info,
  ExternalLink
} from "lucide-react";
import { getOcrDocumentById, type OcrDocumentResponse } from "../lib/elasticsearch";
import { getS3ObjectUrl } from "../lib/s3";

export function DocumentDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [documentData, setDocumentData] = useState<OcrDocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer settings
  const [showBoxes, setShowBoxes] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorMode, setColorMode] = useState<"rainbow" | "confidence" | "single">("confidence");
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"ocr" | "meta">("ocr");  // Image load state for SVG overlays
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // References for scrolling
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getOcrDocumentById(id, controller.signal)
      .then((data) => {
        setDocumentData(data);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load document details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  const document = documentData?.source;
  const [imageUrl, setImageUrl] = useState<string>("");

  // Decrypt S3 document image securely
  useEffect(() => {
    if (!document) return;
    let active = true;
    let objectUrl: string | null = null;

    async function loadSecureImage() {
      try {
        const rawS3Url = getS3ObjectUrl(document!, documentData?.bucket);
        const secureUrl = rawS3Url.replace("/api/s3/", "/api/secure/");

        // Generate Key Set
        const key1Buf = crypto.getRandomValues(new Uint8Array(32));
        const key2Buf = crypto.getRandomValues(new Uint8Array(32));
        const key1Hex = Array.prototype.map.call(key1Buf, (x) => ("00" + x.toString(16)).slice(-2)).join("");
        const key2Hex = Array.prototype.map.call(key2Buf, (x) => ("00" + x.toString(16)).slice(-2)).join("");

        const response = await fetch(`${secureUrl}?k1=${key1Hex}`, {
          headers: {
            "X-Key-2": key2Hex,
          },
        });
        if (!response.ok) throw new Error("Secure image fetch failed");

        const finalBuffer = await response.arrayBuffer();

        const key1 = await crypto.subtle.importKey("raw", key1Buf, { name: "AES-CBC" }, false, ["decrypt"]);
        const key2 = await crypto.subtle.importKey("raw", key2Buf, { name: "AES-CBC" }, false, ["decrypt"]);

        const iv2 = finalBuffer.slice(0, 16);
        const cipherText2 = finalBuffer.slice(16);
        const layer1Buffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv2) }, key2, cipherText2);

        const iv1 = layer1Buffer.slice(0, 16);
        const cipherText1 = layer1Buffer.slice(16);
        const rawBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv1) }, key1, cipherText1);

        if (!active) return;

        const blob = new Blob([rawBuffer]);
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error("Failed to decrypt secure document image:", err);
      }
    }

    loadSecureImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document]);

  // Parse lines with polygons
  const lines = useMemo(() => {
    if (!document?.structure || !Array.isArray(document.structure)) {
      return [];
    }

    return document.structure.map((item, idx) => {
      let points: [number, number][] = [];
      let isValid = false;
      try {
        const parsed = JSON.parse(item.bbox_json);
        if (
          Array.isArray(parsed) &&
          parsed.length === 4 &&
          parsed.every((p) => Array.isArray(p) && p.length === 2)
        ) {
          points = parsed as [number, number][];
          isValid = true;
        }
      } catch {
        // Ignore JSON parse errors
      }

      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const minX = points.length ? Math.min(...xs) : 0;
      const maxX = points.length ? Math.max(...xs) : 0;
      const minY = points.length ? Math.min(...ys) : 0;
      const maxY = points.length ? Math.max(...ys) : 0;

      return {
        id: idx,
        text: item.text,
        confidence: item.confidence,
        points,
        isValid,
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      };
    });
  }, [document]);

  // Filter lines by search term
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) {
      return lines;
    }
    const query = searchQuery.toLowerCase();
    return lines.filter((line) => line.text.toLowerCase().includes(query));
  }, [lines, searchQuery]);

  // Handle color calculations
  const getBoxColor = (line: typeof lines[0], isHighlighted: boolean) => {
    if (isHighlighted) {
      return "#3b82f6"; // Bright blue for active selection
    }

    if (colorMode === "confidence") {
      // Map confidence to Red -> Orange -> Green
      const hue = Math.max(0, Math.min(120, line.confidence * 120));
      return `hsl(${hue}, 85%, 45%)`;
    }

    if (colorMode === "single") {
      return "#003b73"; // Primary brand color
    }

    // Rainbow mode: different color per index
    const hue = (line.id * 57) % 360;
    return `hsl(${hue}, 80%, 45%)`;
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);
    setImgLoaded(true);
  };

  const scrollToLine = (line: typeof lines[0]) => {
    if (!imgLoaded || !imageContainerRef.current) return;

    setSelectedLineIndex(line.id);

    // Calculate percentage coordinates
    const targetX = line.minX + line.width / 2;
    const targetY = line.minY + line.height / 2;

    const container = imageContainerRef.current;
    
    const scrollableWidth = container.scrollWidth;
    const scrollableHeight = container.scrollHeight;

    const relativeX = (targetX / naturalWidth) * scrollableWidth;
    const relativeY = (targetY / naturalHeight) * scrollableHeight;

    container.scrollTo({
      left: relativeX - container.clientWidth / 2,
      top: relativeY - container.clientHeight / 2,
      behavior: "smooth"
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-on-surface flex-col gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <span className="font-semibold text-body-md">Loading document...</span>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-on-surface flex-col gap-4 p-4">
        <div className="text-error bg-error-container/20 p-4 border border-error max-w-md text-center">
          <h2 className="font-bold text-headline-md mb-2">Failed to Load</h2>
          <p className="text-body-sm">{error || "Document not found."}</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-container transition-colors"
        >
          <ArrowLeft size={16} /> Back to Search
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Top Header */}
      <header className="h-14 bg-surface border-b border-outline-variant flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-container-low transition-colors rounded-none border border-outline-variant text-on-surface"
            title="Back to search"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-body-md md:text-body-lg text-on-surface truncate" title={document.filename}>
              {document.filename}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-medium">
              <span className="flex items-center gap-1">
                <Folder size={12} /> {document.batch_name}
              </span>
              <span>•</span>
              <span className="uppercase">{document.extension.replace(/^\./, "")}</span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">


          {/* Toggle Bounding Boxes */}
          <button 
            onClick={() => setShowBoxes(!showBoxes)}
            className={`flex items-center gap-2 px-3 py-2 border transition-colors ${
              showBoxes 
                ? "bg-primary-container/20 border-primary text-primary" 
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {showBoxes ? <Eye size={16} /> : <EyeOff size={16} />}
            <span className="text-[12px] font-semibold hidden md:inline">Bounding Boxes</span>
          </button>


        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Document Image Canvas */}
        <div className="flex-1 bg-surface-container-lowest overflow-hidden flex flex-col relative">
          <div 
            ref={imageContainerRef}
            className="flex-1 overflow-auto p-8 flex items-start justify-center cursor-grab active:cursor-grabbing select-none"
          >
            {imgLoaded ? (
              <div className="relative inline-block shadow-lg border border-outline-variant bg-white">
                <img 
                  src={imageUrl} 
                  alt={document.filename}
                  className="max-w-full max-h-[calc(100vh-8rem)] object-contain block pointer-events-none"
                />

                {/* Render overlay bounding boxes */}
                {showBoxes && (
                  <svg 
                    ref={svgRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
                  >
                    {lines.map((line) => {
                      if (!line.isValid) return null;
                      const isSelected = selectedLineIndex === line.id;
                      const isHovered = hoveredLineIndex === line.id;
                      const highlight = isSelected || isHovered;
                      const strokeColor = getBoxColor(line, highlight);

                      // SVG Polygon point string format
                      const pointStr = line.points.map((p) => p.join(",")).join(" ");

                      return (
                        <g key={line.id} className="pointer-events-auto cursor-pointer">
                          <polygon
                            points={pointStr}
                            fill={highlight ? "rgba(59, 130, 246, 0.15)" : "transparent"}
                            stroke={strokeColor}
                            strokeWidth={highlight ? 8 : 4}
                            onClick={() => {
                              setSelectedLineIndex(line.id);
                              const lineEl = window.document.getElementById(`ocr-line-${line.id}`);
                              if (lineEl) {
                                lineEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              }
                            }}
                            onMouseEnter={() => setHoveredLineIndex(line.id)}
                            onMouseLeave={() => setHoveredLineIndex(null)}
                          />
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            ) : (
              imageUrl && (
                <img 
                  src={imageUrl} 
                  alt={document.filename}
                  onLoad={handleImageLoad}
                  className="opacity-0 max-w-full max-h-[calc(100vh-8rem)] object-contain block"
                />
              )
            )}
          </div>


        </div>

        {/* Right Side: Tabbed OCR Info & Metadata Sidebar */}
        <aside className="w-80 border-l border-outline-variant bg-surface flex flex-col shrink-0 overflow-hidden h-full">
          {/* Tabs */}
          <div className="flex border-b border-outline-variant shrink-0 bg-surface-container-lowest">
            <button 
              onClick={() => setActiveTab("ocr")}
              className={`flex-1 py-3 text-[12px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === "ocr" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <FileText size={14} /> OCR Lines ({lines.length})
            </button>
            <button 
              onClick={() => setActiveTab("meta")}
              className={`flex-1 py-3 text-[12px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === "meta" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <Info size={14} /> Document Info
            </button>
          </div>

          {activeTab === "ocr" ? (
            // OCR TAB
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Within Page */}
              <div className="p-3 border-b border-outline-variant shrink-0 bg-surface-container-low/55">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search text in page..."
                    className="w-full pl-8 pr-3 py-1.5 bg-surface border border-outline-variant rounded-none text-body-sm text-[12px] focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Lines Scroll List */}
              <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
                {filteredLines.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant">
                    <p className="font-semibold">No lines found</p>
                    <p className="text-[11px] mt-1">Try another search term.</p>
                  </div>
                ) : (
                  filteredLines.map((line) => {
                    const isSelected = selectedLineIndex === line.id;
                    const isHovered = hoveredLineIndex === line.id;
                    
                    return (
                      <div 
                        id={`ocr-line-${line.id}`}
                        key={line.id}
                        onClick={() => scrollToLine(line)}
                        onMouseEnter={() => setHoveredLineIndex(line.id)}
                        onMouseLeave={() => setHoveredLineIndex(null)}
                        className={`p-3 text-[13px] transition-colors cursor-pointer group flex flex-col gap-1.5 ${
                          isSelected 
                            ? "bg-primary-container/15 border-l-4 border-l-primary" 
                            : isHovered 
                              ? "bg-surface-container-low" 
                              : "hover:bg-surface-container-low"
                        }`}
                      >
                        <p className={`font-medium break-words leading-relaxed ${isSelected ? "text-primary font-bold" : "text-on-surface"}`}>
                          {line.text}
                        </p>
                        <div className="flex justify-between items-center text-[10px] text-on-surface-variant select-none">
                          <span className="font-mono text-[9px] bg-surface-container-high px-1 py-0.5 border border-outline-variant">
                            Line #{line.id + 1}
                          </span>
                          <span className={`font-semibold ${
                            line.confidence > 0.85 
                              ? "text-tertiary" 
                              : line.confidence > 0.5 
                                ? "text-secondary" 
                                : "text-error"
                          }`}>
                            Conf: {Math.round(line.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // METADATA TAB
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">File Properties</h3>
                <div className="bg-surface-container-low border border-outline-variant divide-y divide-outline-variant font-body-sm text-[12px]">
                  <div className="p-3 flex justify-between gap-4">
                    <span className="text-on-surface-variant font-medium">Filename</span>
                    <span className="text-on-surface font-semibold text-right break-all">{document.filename}</span>
                  </div>
                  <div className="p-3 flex justify-between gap-4">
                    <span className="text-on-surface-variant font-medium">Dataset Name</span>
                    <span className="text-on-surface font-semibold text-right flex items-center gap-1">
                      <Folder size={12} /> {document.batch_name}
                    </span>
                  </div>
                  <div className="p-3 flex justify-between gap-4">
                    <span className="text-on-surface-variant font-medium">Extension</span>
                    <span className="text-on-surface font-semibold uppercase">{document.extension.replace(/^\./, "")}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">OCR Statistics</h3>
                <div className="bg-surface-container-low border border-outline-variant p-3 space-y-3 font-body-sm text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">OCR Lines Detected</span>
                    <span className="text-on-surface font-bold">{lines.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Total Text Characters</span>
                    <span className="text-on-surface font-bold">
                      {lines.reduce((acc, l) => acc + l.text.length, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Average Confidence</span>
                    <span className="text-on-surface font-bold text-tertiary">
                      {lines.length > 0
                        ? `${Math.round(
                            (lines.reduce((acc, l) => acc + l.confidence, 0) / lines.length) * 100
                          )}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
              </div>



              <div className="pt-4">
                <a 
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 border border-outline text-on-surface px-4 py-2 hover:bg-surface-container-low transition-colors font-semibold text-[12px]"
                >
                  <ExternalLink size={14} /> Open Original S3 URL
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
