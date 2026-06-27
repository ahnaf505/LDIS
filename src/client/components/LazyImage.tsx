import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { FileText } from "lucide-react";
import clsx from "clsx";

type LazyImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  containerClassName?: string;
  placeholder?: ReactNode;
};

function buf2hex(buffer: ArrayBuffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}

export function LazyImage({ placeholder, src, className, containerClassName, ...props }: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isDrawn, setIsDrawn] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setFailed(false);
    setIsDrawn(false);
  }, [src]);

  // Intersection Observer
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Secure Image Fetch, Double Decryption, and Canvas Drawing
  useEffect(() => {
    if (!isVisible || !src || failed || isDrawn) return;
    let active = true;
    let objectUrl: string | null = null;

    async function fetchSecureImage() {
      try {
        const secureUrl = src!.replace("/api/s3/", "/api/secure/");
        const key1Buf = crypto.getRandomValues(new Uint8Array(32));
        const key2Buf = crypto.getRandomValues(new Uint8Array(32));
        const key1Hex = buf2hex(key1Buf);
        const key2Hex = buf2hex(key2Buf);

        const response = await fetch(`${secureUrl}?k1=${key1Hex}`, {
          headers: { "X-Key-2": key2Hex },
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

        const img = new Image();
        img.onload = () => {
          if (!active) return;
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              setIsDrawn(true);
            }
          }
          URL.revokeObjectURL(objectUrl!);
          objectUrl = null;
        };
        img.onerror = () => {
          if (active) setFailed(true);
        };
        img.src = objectUrl;

      } catch (error) {
        console.error("Secure decryption or drawing failed:", error);
        if (active) setFailed(true);
      }
    }

    fetchSecureImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isVisible, src, failed, isDrawn]);

  return (
    <div 
      ref={hostRef} 
      className={clsx("relative", containerClassName)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container text-outline select-none p-2 border border-outline-variant">
          <FileText size={24} className="text-outline" />
          <span className="text-[10px] font-semibold text-outline-variant mt-1">Image Unavailable</span>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className={clsx("absolute inset-0 w-full h-full object-cover pointer-events-none select-none", className, !isDrawn && "invisible")}
            style={props.style}
          />
          {!isDrawn && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container text-on-surface-variant">
              {placeholder}
            </div>
          )}
        </>
      )}
    </div>
  );
}
