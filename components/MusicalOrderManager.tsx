"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import MusicalArtwork from "@/components/MusicalArtwork";
import { getMusicalDescriptionText } from "@/lib/musical-description";
import type { AppLanguage } from "@/lib/i18n";

type MusicalOrderItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  year: number | null;
  emoji: string | null;
  imagePath: string | null;
  posterDisplayMode: "crop" | "fit";
  posterAspect: "square" | "wide" | "tall";
  thumbnailUrl: string | null;
};

type MusicalOrderManagerProps = {
  language: AppLanguage;
  musicals: MusicalOrderItem[];
  action: (formData: FormData) => Promise<void>;
  copy: {
    title: string;
    text: string;
    save: string;
    reset: string;
    back: string;
  };
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (!movedItem) return items;
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export default function MusicalOrderManager({ language, musicals, action, copy }: MusicalOrderManagerProps) {
  const [items, setItems] = useState(musicals);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const initialOrder = useMemo(() => musicals.map((musical) => musical.id), [musicals]);

  const isDirty = useMemo(
    () => items.some((item, index) => item.id !== initialOrder[index]),
    [items, initialOrder],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateTouchMode = () => setIsTouchMode(mediaQuery.matches);
    updateTouchMode();
    mediaQuery.addEventListener("change", updateTouchMode);
    return () => mediaQuery.removeEventListener("change", updateTouchMode);
  }, []);

  function resetOrder() {
    setItems(
      initialOrder
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is MusicalOrderItem => !!item),
    );
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, id: string) {
    event.preventDefault();
    if (draggedId && draggedId !== id) {
      setDropTargetId(id);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggedId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDropTargetId(null);
      return;
    }

    setItems((currentItems) => {
      const fromIndex = currentItems.findIndex((item) => item.id === sourceId);
      const toIndex = currentItems.findIndex((item) => item.id === targetId);
      return moveItem(currentItems, fromIndex, toIndex);
    });
    setDropTargetId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTargetId(null);
  }

  function moveBy(id: string, delta: number) {
    setItems((currentItems) => {
      const fromIndex = currentItems.findIndex((item) => item.id === id);
      const toIndex = fromIndex + delta;
      return moveItem(currentItems, fromIndex, toIndex);
    });
  }

  return (
    <section className="card">
      <div className="content-editor-section-header">
        <h1 className="viewer-title">{copy.title}</h1>
        <p className="viewer-text">{copy.text}</p>
      </div>

      <form action={action}>
        <input type="hidden" name="orderedMusicalIds" value={JSON.stringify(items.map((item) => item.id))} />
        <div className="button-row" style={{ marginTop: 12 }}>
          <button type="submit" className="button-primary" disabled={!isDirty}>
            {copy.save}
          </button>
          <button type="button" className="button-secondary" onClick={resetOrder} disabled={!isDirty}>
            {copy.reset}
          </button>
          <Link href="/musicals" className="button-secondary">
            {copy.back}
          </Link>
        </div>

        <div
          className={`musicals-order-grid ${isTouchMode ? "is-touch" : ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: isTouchMode ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
            marginTop: 24,
          }}
        >
          {items.map((musical) => {
            const descriptionText = getMusicalDescriptionText(musical.description);

            return (
              <div
                key={musical.id}
                draggable={!isTouchMode}
                onDragStart={isTouchMode ? undefined : (event) => handleDragStart(event, musical.id)}
                onDragOver={isTouchMode ? undefined : (event) => handleDragOver(event, musical.id)}
                onDrop={isTouchMode ? undefined : (event) => handleDrop(event, musical.id)}
                onDragEnd={isTouchMode ? undefined : handleDragEnd}
                className={[
                  "show-card",
                  "musicals-grid-card",
                  "musical-order-card",
                  draggedId === musical.id ? "is-dragging" : "",
                  dropTargetId === musical.id ? "is-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                dir={language === "he" ? "rtl" : "ltr"}
              >
                <div className="musical-card-artwork">
                  <MusicalArtwork
                    imagePath={musical.imagePath}
                    posterDisplayMode={musical.posterDisplayMode}
                    posterAspect={musical.posterAspect}
                    title={musical.title}
                    thumbnailUrl={musical.thumbnailUrl}
                    emoji={musical.emoji}
                  />
                </div>
                <div className="musical-card-body">
                  <span className="musical-card-title">{musical.title}</span>
                  {musical.year ? <span className="musical-card-year">{musical.year}</span> : null}
                  <span className="musical-card-description-wrap">
                    <span
                      className={`musical-card-description ${descriptionText ? "" : "is-placeholder"}`}
                      dir={descriptionText ? "auto" : undefined}
                    >
                      {descriptionText || (language === "he" ? "אין עדיין תיאור למחזה הזה" : "There is no description for this musical yet.")}
                    </span>
                  </span>
                  {isTouchMode ? (
                    <div className="musical-order-touch-actions">
                      <button
                        type="button"
                        className="button-secondary button-small"
                        onClick={() => moveBy(musical.id, -1)}
                        disabled={items[0]?.id === musical.id}
                      >
                        {language === "he" ? "העבר למעלה" : "Move Up"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-small"
                        onClick={() => moveBy(musical.id, 1)}
                        disabled={items[items.length - 1]?.id === musical.id}
                      >
                        {language === "he" ? "העבר למטה" : "Move Down"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </section>
  );
}
