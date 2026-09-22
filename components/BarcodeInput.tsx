"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  onDetected: (code: string) => void;
  placeholder?: string;
}

/**
 * إدخال باركود: يدعم ماسحات الباركود (تعمل كلوحة مفاتيح) + كاميرا عبر BarcodeDetector إن توفرت.
 * بدون أي مكتبات خارجية — آمن Offline.
 */
export function BarcodeInput({ onDetected, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [supportCamera, setSupportCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    try {
      setSupportCamera(typeof window !== "undefined" && "BarcodeDetector" in window);
    } catch {
      setSupportCamera(false);
    }
    return () => {
      try {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
    };
  }, []);

  function submit(v?: string) {
    const code = (v ?? value).trim();
    if (!code) return;
    try {
      onDetected(code);
    } catch { /* ignore */ }
    setValue("");
  }

  async function startCamera() {
    if (scanning) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      // انتظر تركيب الفيديو
      setTimeout(() => {
        try {
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            void video.play().catch(() => undefined);
            loop(video);
          }
        } catch { /* ignore */ }
      }, 100);
    } catch {
      alert("تعذر فتح الكاميرا — أدخل الباركود يدوياً");
    }
  }

  function stopCamera() {
    try {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    } catch { /* ignore */ }
    setScanning(false);
  }

  async function loop(video: HTMLVideoElement) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD = (window as any).BarcodeDetector;
      if (!BD) return;
      const detector = new BD({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0) {
            const raw = String(codes[0].rawValue ?? "").trim();
            if (raw) {
              submit(raw);
              stopCamera();
              return;
            }
          }
        } catch { /* تابع */ }
        rafRef.current = requestAnimationFrame(() => void loop(video));
      };
      void tick();
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder ?? "امسح الباركود أو أدخله يدوياً ثم Enter"}
          inputMode="text"
          autoComplete="off"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left dir-ltr dark:border-gray-700 dark:bg-gray-800"
          dir="ltr"
        />
        <button
          onClick={() => submit()}
          className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700"
        >
          ➕
        </button>
        {supportCamera && !scanning && (
          <button
            onClick={() => void startCamera()}
            className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            title="مسح بالكاميرا"
          >
            📷
          </button>
        )}
      </div>
      {scanning && (
        <div className="rounded-xl border border-gray-200 bg-black p-2 dark:border-gray-700">
          <video ref={videoRef} className="h-48 w-full rounded-lg object-cover" muted playsInline />
          <button
            onClick={stopCamera}
            className="mt-2 w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white"
          >
            إيقاف الكاميرا
          </button>
        </div>
      )}
    </div>
  );
}
