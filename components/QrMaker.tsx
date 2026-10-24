"use client";

import "cropperjs/dist/cropper.css";
import type Cropper from "cropperjs";
import type QRCodeStyling from "qr-code-styling";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ModalCloseButton from "@/components/ModalCloseButton";
import type { AppLanguage } from "@/lib/i18n";

type HistoryItem = { id: string; createdAt: string; url: string; logoSize: number; logo: string | null };

const STRINGS = {
  he: {
    intro: "הדבק קישור, הוסף תמונה במרכז אם תרצה, והעתק או הורד. התחברות שומרת היסטוריה.",
    link: "קישור", newQr: "+ QR חדש", center: "תמונה במרכז (אופציונלי)", pick: "בחר תמונה…", recrop: "חתוך שוב", remove: "הסר",
    logoSize: "גודל התמונה:", logoWarn: "תמונה גדולה מדי עלולה להפריע לסריקה. מומלץ עד 30%.", copy: "העתק", copied: "הועתק!",
    dlPng: "הורד PNG", dlSvg: "הורד SVG", history: "ההיסטוריה שלי", histEmpty: "עדיין אין כלום. QR נשמר כשמעתיקים או מורידים אותו.",
    zoom: "זום", round: "חיתוך עגול", rotateLeft: "↺ סובב", rotateRight: "↻ סובב", ok: "אישור", willAdd: "יתווסף אוטומטית: ",
    noClipboard: "הדפדפן לא תומך בהעתקת תמונה. השתמש בהורדה.", copyFail: "ההעתקה נכשלה. נסה להוריד.", histFail: "לא הצלחנו לשמור בהיסטוריה",
    delete: "מחק", close: "סגור",
  },
  en: {
    intro: "Paste a link, add a centre image if you like, then copy or download. Signing in keeps a history.",
    link: "Link", newQr: "+ New QR", center: "Centre image (optional)", pick: "Choose image…", recrop: "Crop again", remove: "Remove",
    logoSize: "Image size:", logoWarn: "An image that is too large can make scanning harder. Up to 30% is recommended.", copy: "Copy", copied: "Copied!",
    dlPng: "Download PNG", dlSvg: "Download SVG", history: "My history", histEmpty: "Nothing yet. A QR is saved when you copy or download it.",
    zoom: "Zoom", round: "Round crop", rotateLeft: "↺ Rotate", rotateRight: "↻ Rotate", ok: "OK", willAdd: "Will be added automatically: ",
    noClipboard: "Your browser cannot copy images. Use download instead.", copyFail: "Copying failed. Try downloading.", histFail: "Could not save to history",
    delete: "Delete", close: "Close",
  },
} as const;

const normalize = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return "";

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

type QrConstructor = typeof QRCodeStyling;

async function loadQr(): Promise<QrConstructor> {
  return (await import("qr-code-styling")).default;
}

function buildOptions(data: string, size: number, logo: string | null, logoSize: number, margin: number) {
  return {
    width: size,
    height: size,
    data,
    image: logo ?? undefined,
    qrOptions: { errorCorrectionLevel: "H" as const },
    dotsOptions: { type: "square" as const, color: "#000000" },
    backgroundOptions: { color: "#ffffff" },
    imageOptions: { imageSize: logoSize / 100, margin, crossOrigin: "anonymous" },
  };
}

// A saved code draws itself in a small canvas.
function HistoryQr({ item, Qr }: { item: HistoryItem; Qr: QrConstructor | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!Qr || !ref.current) return;

    const box = ref.current;

    box.textContent = "";
    new Qr({ ...buildOptions(item.url, 96, item.logo, item.logoSize, 2), type: "canvas" }).append(box);
  }, [Qr, item]);

  return <div className="q" ref={ref} />;
}

export default function QrMaker({ language, signedIn }: { language: AppLanguage; signedIn: boolean }) {
  const t = STRINGS[language];
  const [value, setValue] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(30);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [Qr, setQr] = useState<QrConstructor | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const data = normalize(value);
  const ok = Boolean(data);

  const toast = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMessage(""), 2500);
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadQr().then((Constructor) => setQr(() => Constructor));
  }, []);

  // The live preview
  useEffect(() => {
    if (!Qr || !previewRef.current) return;

    if (!qrRef.current) {
      qrRef.current = new Qr({ ...buildOptions(" ", 280, null, 30, 6), type: "canvas" });
      qrRef.current.append(previewRef.current);
    }

    qrRef.current.update(buildOptions(ok ? data : " ", 280, logo, logoSize, 6));
  }, [Qr, data, ok, logo, logoSize]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/qr/history", { credentials: "same-origin" });

      if (response.ok) setItems(((await response.json()) as { items: HistoryItem[] }).items);
    } catch {
      // history is optional
    }
  }, []);

  useEffect(() => {
    if (signedIn) void loadHistory();
  }, [signedIn, loadHistory]);

  // History keeps a small WebP copy of the centre image so the request stays tiny.
  const smallLogo = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (!logo) return resolve(null);

        const image = new Image();

        image.onload = () => {
          const canvas = document.createElement("canvas");

          canvas.width = canvas.height = 320;
          canvas.getContext("2d")?.drawImage(image, 0, 0, 320, 320);
          resolve(canvas.toDataURL("image/webp", 0.85));
        };
        image.onerror = () => resolve(null);
        image.src = logo;
      }),
    [logo],
  );

  const saveToHistory = useCallback(async () => {
    if (!signedIn) return;

    try {
      const response = await fetch("/api/qr/history", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data, logoSize, logo: await smallLogo() }),
      });

      if (response.ok) setItems(((await response.json()) as { items: HistoryItem[] }).items);
      else toast(t.histFail);
    } catch {
      toast(t.histFail);
    }
  }, [signedIn, data, logoSize, smallLogo, toast, t.histFail]);

  const exportQr = useCallback(
    (type: "canvas" | "svg", size: number) => {
      if (!Qr) throw new Error("not ready");

      return new Qr({ ...buildOptions(data, size, logo, logoSize, Math.round(size / 48)), type });
    },
    [Qr, data, logo, logoSize],
  );

  const download = async (extension: "png" | "svg") => {
    if (!ok) return;

    await exportQr(extension === "svg" ? "svg" : "canvas", 1024).download({ name: "qr", extension });
    void saveToHistory();
  };

  const copyImage = async () => {
    if (!ok) return;

    if (!navigator.clipboard || typeof ClipboardItem === "undefined") return toast(t.noClipboard);

    try {
      const blob = exportQr("canvas", 1024)
        .getRawData("png")
        .then((raw) => (raw instanceof Blob ? raw : new Blob([raw as unknown as BlobPart], { type: "image/png" })));

      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      void saveToHistory();
    } catch {
      toast(t.copyFail);
    }
  };

  const reset = () => {
    setValue("");
    setLogo(null);
    setOriginal(null);
    setLogoSize(30);
    inputRef.current?.focus();
  };

  const restore = (item: HistoryItem) => {
    setValue(item.url);
    setLogoSize(item.logoSize);
    setLogo(item.logo);
    setOriginal(item.logo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Coming from a code on the home page (?code=<id>): that code opens, ready to copy or download
  useEffect(() => {
    if (items.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) return;

    const item = items.find((entry) => entry.id === code);

    window.history.replaceState(null, "", window.location.pathname);

    if (item) {
      setValue(item.url);
      setLogoSize(item.logoSize);
      setLogo(item.logo);
      setOriginal(item.logo);
    }
  }, [items]);

  const removeItem = async (id: string) => {
    const response = await fetch(`/api/qr/history/${id}`, { method: "DELETE", credentials: "same-origin" });

    if (response.ok) setItems(((await response.json()) as { items: HistoryItem[] }).items);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setOriginal(String(reader.result));
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const hint = useMemo(() => (ok && data !== value.trim() ? `${t.willAdd}${data}` : ""), [ok, data, value, t.willAdd]);

  return (
    <main className="qr-page">
      <p className="qr-sub">{t.intro}</p>

      <div className="qr-grid">
        <section className="card qr-card">
          <div className="qr-formhead">
            <label htmlFor="qr-url">{t.link}</label>
            <button type="button" className="button-secondary" onClick={reset}>
              {t.newQr}
            </button>
          </div>
          <input
            id="qr-url"
            ref={inputRef}
            className="input qr-url"
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="qr-hint">{hint}</div>

          <label>{t.center}</label>
          <div className="qr-row">
            <button type="button" className="button-secondary" onClick={() => fileRef.current?.click()}>
              {t.pick}
            </button>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="qr-thumb" src={logo} alt="" />
            ) : null}
            {logo ? (
              <button type="button" className="button-secondary" onClick={() => original && setCropOpen(true)}>
                {t.recrop}
              </button>
            ) : null}
            {logo ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setLogo(null);
                  setOriginal(null);
                }}
              >
                {t.remove}
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {logo ? (
            <div>
              <label htmlFor="qr-logo-size">
                {t.logoSize} {logoSize}%
              </label>
              <input
                id="qr-logo-size"
                className="qr-range"
                type="range"
                min={10}
                max={40}
                value={logoSize}
                onChange={(event) => setLogoSize(Number(event.target.value))}
              />
              <div className="qr-hint">{t.logoWarn}</div>
            </div>
          ) : null}
        </section>

        <aside className="card qr-card qr-preview">
          <div className={`qr-box${copied ? " flash" : ""}`} ref={previewRef} aria-live="polite" />
          <div className="qr-row qr-center">
            <button type="button" className={`button-primary${copied ? " qr-done" : ""}`} disabled={!ok || !Qr} onClick={copyImage}>
              {copied ? `✓ ${t.copied}` : t.copy}
            </button>
            <button type="button" className="button-secondary" disabled={!ok || !Qr} onClick={() => void download("png")}>
              {t.dlPng}
            </button>
            <button type="button" className="button-secondary" disabled={!ok || !Qr} onClick={() => void download("svg")}>
              {t.dlSvg}
            </button>
          </div>
          <div className="qr-toast" role="status">
            {message}
          </div>
        </aside>
      </div>

      {signedIn ? (
        <section className="qr-history">
          <h2>{t.history}</h2>
          <div className="qr-hist-grid">
            {items.map((item) => (
              <div
                key={item.id}
                className="qr-hist-item"
                role="button"
                tabIndex={0}
                title={item.url}
                onClick={() => restore(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") restore(item);
                }}
              >
                <HistoryQr item={item} Qr={Qr} />
                <div className="u">{item.url.replace(/^https?:\/\//, "")}</div>
                <button
                  type="button"
                  className="qr-del"
                  aria-label={t.delete}
                  title={t.delete}
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeItem(item.id);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {items.length === 0 ? <p className="qr-hint">{t.histEmpty}</p> : null}
        </section>
      ) : null}

      {mounted && cropOpen && original
        ? createPortal(
            <CropWindow
              image={original}
              labels={t}
              onCancel={() => setCropOpen(false)}
              onDone={(dataUrl) => {
                setLogo(dataUrl);
                setCropOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </main>
  );
}

function CropWindow({
  image,
  labels,
  onCancel,
  onDone,
}: {
  image: string;
  labels: (typeof STRINGS)[AppLanguage];
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [zoom, setZoom] = useState(0);
  const [round, setRound] = useState(false);

  const zoomMin = () => {
    const cropper = cropperRef.current;

    if (!cropper) return 1;

    const box = cropper.getCropBoxData();
    const natural = cropper.getImageData();

    return Math.max(box.width / natural.naturalWidth, box.height / natural.naturalHeight);
  };

  useEffect(() => {
    const element = imgRef.current;
    let cancelled = false;

    if (!element) return;

    void import("cropperjs").then(({ default: CropperJs }) => {
      if (cancelled) return;

      cropperRef.current = new CropperJs(element, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.9,
        background: false,
        guides: false,
        center: false,
        highlight: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
        zoom() {
          const cropper = cropperRef.current;

          if (!cropper) return;

          const canvas = cropper.getCanvasData();
          const min = zoomMin();

          setZoom(Math.min(1, Math.max(0, (canvas.width / canvas.naturalWidth - min) / (min * 6 - min))));
        },
      });
    });

    return () => {
      cancelled = true;
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [image]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirm = () => {
    const cropper = cropperRef.current;

    if (!cropper) return;

    const out = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingQuality: "high" });
    let canvas = out;

    if (round) {
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;

      const context = canvas.getContext("2d");

      if (context) {
        context.beginPath();
        context.arc(256, 256, 256, 0, Math.PI * 2);
        context.closePath();
        context.clip();
        context.drawImage(out, 0, 0, 512, 512);
      }
    }

    onDone(canvas.toDataURL("image/png"));
  };

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal-card card qr-crop" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton label={labels.close} onClick={onCancel} />
        <div className={`qr-stage${round ? " circle" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={image} alt="" />
        </div>
        <label htmlFor="qr-zoom">{labels.zoom}</label>
        <input
          id="qr-zoom"
          className="qr-range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={zoom}
          onChange={(event) => {
            const value = Number(event.target.value);
            const min = zoomMin();

            setZoom(value);
            cropperRef.current?.zoomTo(min + (min * 6 - min) * value);
          }}
        />
        <div className="qr-row">
          <label className="qr-inline">
            <input type="checkbox" checked={round} onChange={(event) => setRound(event.target.checked)} /> {labels.round}
          </label>
          <button type="button" className="button-secondary" onClick={() => cropperRef.current?.rotate(-90)}>
            {labels.rotateLeft}
          </button>
          <button type="button" className="button-secondary" onClick={() => cropperRef.current?.rotate(90)}>
            {labels.rotateRight}
          </button>
        </div>
        <div className="qr-actions">
          <button type="button" className="button-primary" onClick={confirm}>
            {labels.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
