"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type ClipOrderItem = {
  id: string;
  title: string;
  sourceType: "youtube" | "upload";
};

type ClipOrderManagerProps = {
  language?: AppLanguage;
  clips: ClipOrderItem[];
  hiddenInputName?: string;
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export default function ClipOrderManager({
  language = "he",
  clips,
  hiddenInputName = "orderedClipIds",
}: ClipOrderManagerProps) {
  const t = getTranslations(language).contentEditor.musicals;
  const clipT = getTranslations(language).contentEditor.clips;
  const [items, setItems] = useState(clips);
  const [savedOrderIds, setSavedOrderIds] = useState(() => clips.map((clip) => clip.id));
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dropTargetClipId, setDropTargetClipId] = useState<string | null>(null);

  const isDirty = useMemo(
    () => items.some((item, index) => item.id !== savedOrderIds[index]),
    [items, savedOrderIds],
  );

  useEffect(() => {
    setItems(clips);
    setSavedOrderIds(clips.map((clip) => clip.id));
  }, [clips]);

  function resetOrder() {
    setItems((currentItems) =>
      savedOrderIds
        .map((clipId) => currentItems.find((item) => item.id === clipId))
        .filter((item): item is ClipOrderItem => !!item),
    );
    setDraggedClipId(null);
    setDropTargetClipId(null);
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, clipId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", clipId);
    setDraggedClipId(clipId);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, clipId: string) {
    event.preventDefault();

    if (draggedClipId && draggedClipId !== clipId) {
      setDropTargetClipId(clipId);
    }
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetClipId: string) {
    event.preventDefault();
    const sourceClipId = draggedClipId || event.dataTransfer.getData("text/plain");

    if (!sourceClipId || sourceClipId === targetClipId) {
      setDropTargetClipId(null);
      return;
    }

    setItems((currentItems) => {
      const fromIndex = currentItems.findIndex((item) => item.id === sourceClipId);
      const toIndex = currentItems.findIndex((item) => item.id === targetClipId);
      return moveItem(currentItems, fromIndex, toIndex);
    });
    setDropTargetClipId(null);
  }

  function handleDragEnd() {
    setDraggedClipId(null);
    setDropTargetClipId(null);
  }

  return (
    <section className="card content-editor-section clip-order-section" style={{ padding: 24 }}>
      <div className="content-editor-section-header">
        <h2 className="panel-title" style={{ marginBottom: 8 }}>
          {t.clipOrderTitle}
        </h2>
        <p className="show-meta" style={{ marginTop: 0 }}>
          {t.clipOrderText}
        </p>
      </div>

      {!clips.length ? (
        <div className="clip-order-empty">{t.clipOrderEmpty}</div>
      ) : (
        <div className="clip-order-form">
          <input type="hidden" name={hiddenInputName} value={JSON.stringify(items.map((item) => item.id))} />
          <ol className="clip-order-list">
            {items.map((clip, index) => (
              <li
                key={clip.id}
                draggable
                onDragStart={(event) => handleDragStart(event, clip.id)}
                onDragOver={(event) => handleDragOver(event, clip.id)}
                onDrop={(event) => handleDrop(event, clip.id)}
                onDragEnd={handleDragEnd}
                className={[
                  "clip-order-item",
                  draggedClipId === clip.id ? "is-dragging" : "",
                  dropTargetClipId === clip.id ? "is-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="clip-order-handle" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="clip-order-position">{index + 1}</div>
                <div className="clip-order-details">
                  <strong>{clip.title}</strong>
                  <span>{clip.sourceType === "youtube" ? clipT.sourceYoutube : clipT.sourceUpload}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="clip-order-toolbar">
            <div className="button-row content-editor-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="button-secondary"
                onClick={resetOrder}
                disabled={!isDirty}
              >
                {t.resetClipOrder}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
