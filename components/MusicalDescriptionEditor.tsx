"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Editor, EditorContent, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { getTranslations, type AppLanguage } from "@/lib/i18n";
import { getDescriptionEditorContent } from "@/lib/musical-description";

type MusicalDescriptionEditorProps = {
  language?: AppLanguage;
  inputId: string;
  name: string;
  label: string;
  initialValue?: string | null;
  placeholder?: string;
};

const TextDirection = Extension.create({
  name: "textDirection",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "listItem"],
        attributes: {
          dir: {
            default: null,
            renderHTML: (attributes) => {
              if (!attributes.dir) {
                return {};
              }

              return { dir: attributes.dir };
            },
          },
        },
      },
    ];
  },
});

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rich-editor-button ${active ? "is-active" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rich-editor-group">
      <div className="rich-editor-group-label">{label}</div>
      <div className="rich-editor-group-buttons">{children}</div>
    </div>
  );
}

function getActiveDirection(editor: Editor | null) {
  if (!editor) {
    return null;
  }

  const paragraphDir = editor.getAttributes("paragraph").dir;
  const headingDir = editor.getAttributes("heading").dir;

  return paragraphDir || headingDir || null;
}

function applyDirection(editor: Editor | null, direction: "rtl" | "ltr") {
  if (!editor) {
    return;
  }

  editor.chain().focus().updateAttributes("paragraph", { dir: direction }).run();
  editor.chain().focus().updateAttributes("heading", { dir: direction }).run();
  editor.chain().focus().updateAttributes("bulletList", { dir: direction }).run();
  editor.chain().focus().updateAttributes("orderedList", { dir: direction }).run();
  editor.chain().focus().updateAttributes("listItem", { dir: direction }).run();
}

function applyAlignment(editor: Editor | null, align: "right" | "center" | "left") {
  if (!editor) {
    return;
  }

  editor.chain().focus().setTextAlign(align).run();
  editor.chain().focus().updateAttributes("bulletList", { style: `text-align: ${align}` }).run();
  editor.chain().focus().updateAttributes("orderedList", { style: `text-align: ${align}` }).run();
}

function getActiveAlignment(editor: Editor | null) {
  if (!editor) {
    return null;
  }

  if (editor.isActive({ textAlign: "right" })) return "right";
  if (editor.isActive({ textAlign: "center" })) return "center";
  if (editor.isActive({ textAlign: "left" })) return "left";

  return null;
}

type ToolbarState = {
  bold: boolean;
  underline: boolean;
  paragraph: boolean;
  heading: boolean;
  bulletList: boolean;
  orderedList: boolean;
  direction: "rtl" | "ltr" | null;
  alignment: "right" | "center" | "left" | null;
};

function getToolbarState(editor: Editor | null): ToolbarState {
  return {
    bold: !!editor?.isActive("bold"),
    underline: !!editor?.isActive("underline"),
    paragraph: !!editor?.isActive("paragraph"),
    heading: !!editor?.isActive("heading", { level: 2 }),
    bulletList: !!editor?.isActive("bulletList"),
    orderedList: !!editor?.isActive("orderedList"),
    direction: getActiveDirection(editor),
    alignment: getActiveAlignment(editor),
  };
}

export default function MusicalDescriptionEditor({
  language = "he",
  inputId,
  name,
  label,
  initialValue,
  placeholder,
}: MusicalDescriptionEditorProps) {
  const t = getTranslations(language).contentEditor.descriptionEditor;
  const [html, setHtml] = useState(() => getDescriptionEditorContent(initialValue));
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(() => getToolbarState(null));
  const listMenuRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        italic: false,
      }),
      Italic,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph", "bulletList", "orderedList"],
      }),
      TextDirection,
    ],
    content: getDescriptionEditorContent(initialValue),
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        dir: "auto",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setHtml(currentEditor.getHTML());
      setToolbarState(getToolbarState(currentEditor));
    },
  });

  useEffect(() => {
    const nextValue = getDescriptionEditorContent(initialValue);
    setHtml(nextValue);

    if (editor && editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue || "<p></p>", { emitUpdate: false });
      setToolbarState(getToolbarState(editor));
    }
  }, [editor, initialValue]);

  useEffect(() => {
    if (!editor) {
      setToolbarState(getToolbarState(null));
      return;
    }

    const syncToolbarState = () => {
      setToolbarState(getToolbarState(editor));
    };

    syncToolbarState();
    editor.on("selectionUpdate", syncToolbarState);
    editor.on("transaction", syncToolbarState);
    editor.on("focus", syncToolbarState);
    editor.on("blur", syncToolbarState);

    return () => {
      editor.off("selectionUpdate", syncToolbarState);
      editor.off("transaction", syncToolbarState);
      editor.off("focus", syncToolbarState);
      editor.off("blur", syncToolbarState);
    };
  }, [editor]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!listMenuRef.current?.contains(event.target as Node)) {
        setListMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const activeDirection = toolbarState.direction;
  const activeAlignment = toolbarState.alignment;
  const listActive = toolbarState.bulletList || toolbarState.orderedList;
  const isEmpty = !editor || editor.isEmpty;

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>

      <div className="rich-editor-shell">
        <div className="rich-editor-toolbar" role="toolbar" aria-label={t.toolbarAria}>
          <ToolbarGroup label={t.formatting}>
            <ToolbarButton
              label="B"
              active={toolbarState.bold}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="U"
              active={toolbarState.underline}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
          </ToolbarGroup>

          <ToolbarGroup label={t.block}>
            <ToolbarButton
              label={t.paragraph}
              active={toolbarState.paragraph}
              disabled={!editor}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />
            <ToolbarButton
              label={t.heading}
              active={toolbarState.heading}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            />
          </ToolbarGroup>

          <ToolbarGroup label={t.lists}>
            <div className="rich-editor-dropdown" ref={listMenuRef}>
              <ToolbarButton
                label={editor?.isActive("orderedList") ? t.orderedList : t.list}
                active={listActive || listMenuOpen}
                disabled={!editor}
                onClick={() => setListMenuOpen((current) => !current)}
              />
              {listMenuOpen ? (
                <div className="rich-editor-dropdown-menu">
                  <button
                    type="button"
                    className={`rich-editor-dropdown-item ${
                      toolbarState.bulletList ? "is-active" : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor?.chain().focus().toggleBulletList().run();
                      setListMenuOpen(false);
                    }}
                  >
                    {t.bulletListOption}
                  </button>
                  <button
                    type="button"
                    className={`rich-editor-dropdown-item ${
                      toolbarState.orderedList ? "is-active" : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      editor?.chain().focus().toggleOrderedList().run();
                      setListMenuOpen(false);
                    }}
                  >
                    {t.orderedListOption}
                  </button>
                </div>
              ) : null}
            </div>
          </ToolbarGroup>

          <ToolbarGroup label={t.direction}>
            <ToolbarButton
              label="RTL"
              active={activeDirection === "rtl"}
              disabled={!editor}
              onClick={() => applyDirection(editor, "rtl")}
            />
            <ToolbarButton
              label="LTR"
              active={activeDirection === "ltr"}
              disabled={!editor}
              onClick={() => applyDirection(editor, "ltr")}
            />
          </ToolbarGroup>

          <ToolbarGroup label={t.alignment}>
            <ToolbarButton
              label={t.alignRight}
              active={activeAlignment === "right"}
              disabled={!editor}
              onClick={() => applyAlignment(editor, "right")}
            />
            <ToolbarButton
              label={t.alignCenter}
              active={activeAlignment === "center"}
              disabled={!editor}
              onClick={() => applyAlignment(editor, "center")}
            />
            <ToolbarButton
              label={t.alignLeft}
              active={activeAlignment === "left"}
              disabled={!editor}
              onClick={() => applyAlignment(editor, "left")}
            />
          </ToolbarGroup>
        </div>

        <div
          className="rich-editor-area"
          data-placeholder={isEmpty ? placeholder ?? t.placeholder : undefined}
        >
          <EditorContent id={inputId} editor={editor} />
        </div>
      </div>

      <input type="hidden" name={name} value={html} />

      <div className="show-meta" style={{ marginTop: 0 }}>
        {t.helper}
      </div>
    </div>
  );
}
