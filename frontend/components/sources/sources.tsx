"use client";
import { useEffect, useRef, useState } from "react";
import { SourceIcon, UploadIcon } from "@/components/icons/brand";
import { hostedAuth } from "@/lib/auth";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import type { Pack, Evidence } from "@/types";

type TeacherNoteAttachment = {
  id: string;
  file: File;
  kind: "document" | "image";
  mode?: "extract" | "primary-source";
  previewUrl?: string;
  caption?: string;
  description?: string;
};

const documentMimes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
]);
const docExtensions = ["pdf", "docx", "pptx", "txt", "md"];
const imageExtensions = ["png", "jpg", "jpeg", "webp"];
const imageMimes = new Set(["image/png", "image/jpeg", "image/webp"]);

const fileSize = (n: number) =>
  n < 1024 * 1024
    ? `${Math.ceil(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function Sources({
  pack,
  refresh,
  run,
  viewEvidence,
}: {
  pack: Pack;
  refresh: () => void;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  viewEvidence: (e: Evidence) => void;
}) {
  const [textOpen, setTextOpen] = useState(false);
  const [replace, setReplace] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<TeacherNoteAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const docInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const dropzoneInput = useRef<HTMLInputElement>(null);

  const clearAttachments = () => {
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    setAttachmentError("");
    setIsDragging(false);
  };

  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    };
  }, [attachments]);

  const addFiles = (files: File[]) => {
    setAttachmentError("");
    const next: TeacherNoteAttachment[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isImg = imageExtensions.includes(ext) || imageMimes.has(file.type);
      const isDoc =
        docExtensions.includes(ext) ||
        documentMimes.has(file.type) ||
        (ext && docExtensions.includes(ext));

      if (isImg) {
        if (file.size > 5 * 1024 * 1024) {
          setAttachmentError(`${file.name} is larger than the 5 MB image limit.`);
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          kind: "image",
          previewUrl: URL.createObjectURL(file),
          caption: "",
          description: "",
        });
      } else if (isDoc) {
        if (file.size > 10 * 1024 * 1024) {
          setAttachmentError(`${file.name} is larger than the 10 MB document limit.`);
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          kind: "document",
          mode: "extract",
        });
      } else {
        setAttachmentError(`${file.name} is not a supported document or image.`);
      }
    }

    setAttachments((old) => [...old, ...next]);
  };

  const removeAttachment = (id: string) =>
    setAttachments((old) => {
      const target = old.find((x) => x.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return old.filter((x) => x.id !== id);
    });

  const updateAttachment = (id: string, values: Partial<TeacherNoteAttachment>) =>
    setAttachments((old) =>
      old.map((a) => (a.id === id ? { ...a, ...values } : a))
    );

  const closeNotes = () => {
    clearAttachments();
    setTextOpen(false);
  };

  return (
    <div className="page stack">
      <div className="row spread">
        <div>
          <div className="kicker">Trusted knowledge boundary</div>
          <h1>Source library</h1>
          <p className="muted">
            Preserve the original material. Trace every claim back to it.
          </p>
        </div>
        <Button
          onClick={() => {
            setReplace(undefined);
            setTextOpen(true);
          }}
        >
          + Add teacher notes
        </Button>
      </div>

      <label className="asset-card">
        <span className="row">
          <UploadIcon size={20} />
          {uploading
            ? "Uploading and extracting…"
            : "Upload PDF, PPTX, DOCX, TXT or Markdown"}
        </span>
        <small>
          Multiple files supported · 10 MB each · Text-based documents only ·
          Scans require OCR
        </small>
        <input
          type="file"
          multiple
          accept=".pdf,.pptx,.docx,.txt,.md"
          disabled={uploading}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            setUploading(true);
            try {
              for (const file of files) {
                const f = new FormData();
                f.append("file", file);
                await run(
                  () =>
                    api(`/packs/${pack.id}/sources`, {
                      method: "POST",
                      body: f,
                    }),
                  "Source extracted with provenance"
                );
              }
            } finally {
              setUploading(false);
              e.target.value = "";
              refresh();
            }
          }}
        />
      </label>

      <div className="notice">
        Adding or replacing sources marks existing assets stale. Historical source
        versions and approvals are retained.
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Version</th>
              <th>Evidence units</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pack.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <SourceIcon
                    size={15}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                  {s.name}
                </td>
                <td>v{s.version}</td>
                <td>
                  {pack.evidence.filter((e) => e.source_id === s.id).length}
                </td>
                <td>
                  {hostedAuth && s.has_original && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(async () => {
                          const signed = await api<{ url: string }>(
                            `/sources/${s.id}/versions/${s.version}/download`
                          );
                          window.open(
                            signed.url,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }, "Private download opened; link expires in 60 seconds")
                      }
                    >
                      Download original
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReplace(s.id);
                      setTextOpen(true);
                    }}
                  >
                    Replace with text
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>Extracted evidence</h4>
      {pack.evidence.map((e, i) => (
        <article className="asset-card" key={e.id}>
          <div className="row spread">
            <b>
              E{i + 1} · {e.source_name}
            </b>
            <small>
              {e.location} · Source v{e.source_version}
            </small>
          </div>
          <p className="prose">
            {e.text.slice(0, 220)}
            {e.text.length > 220 ? "…" : ""}
          </p>
          <Button variant="ghost" onClick={() => viewEvidence(e)}>
            Inspect source passage →
          </Button>
        </article>
      ))}

      <Panel
        open={textOpen}
        onClose={closeNotes}
        title={replace ? "Replace source — new version" : "Add trusted teacher notes"}
        description="Only enter material you trust. Intent and objectives are not source evidence."
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            let text = String(f.get("text") || "");
            const imageNotes = attachments
              .filter(
                (a) => a.kind === "image" && (a.caption || a.description)
              )
              .map(
                (a) =>
                  `\n\n[Figure: ${a.caption || a.file.name}]\n${a.description || ""}`
              )
              .join("");
            if (imageNotes) {
              text += imageNotes;
            }
            await run(
              () =>
                post(`/packs/${pack.id}/sources/text`, {
                  name: f.get("name"),
                  text,
                  source_id: replace,
                }),
              "Source saved"
            );
            closeNotes();
            refresh();
          }}
        >
          <label>
            Source name
            <input
              className="input"
              name="name"
              defaultValue={
                pack.sources.find((s) => s.id === replace)?.name ||
                "Teacher notes"
              }
              required
            />
          </label>

          <div className="row" style={{ gap: 8 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => docInput.current?.click()}
            >
              + Attach Document
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => imgInput.current?.click()}
            >
              + Attach Image
            </Button>
            <input
              ref={docInput}
              className="sr-only"
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={(e) => {
                addFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            <input
              ref={imgInput}
              className="sr-only"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                addFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </div>

          <div
            className={`asset-card ${isDragging ? "dropzone-active" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="File upload drop zone. Drag and drop documents or images, or press Enter to browse files."
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dropzoneInput.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => dropzoneInput.current?.click()}
            style={{
              cursor: "pointer",
              borderStyle: "dashed",
              borderColor: isDragging ? "var(--accent, #2763ae)" : undefined,
              backgroundColor: isDragging
                ? "rgba(39, 99, 174, 0.05)"
                : undefined,
              textAlign: "center",
              padding: "20px 16px",
            }}
          >
            <b>Drag & drop a document or image here</b>
            <br />
            <small>
              or browse files · Images are limited to 5 MB · Documents up to 10 MB
            </small>
            <input
              ref={dropzoneInput}
              className="sr-only"
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                addFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </div>

          {attachmentError && (
            <div className="alert" role="alert">
              {attachmentError}
            </div>
          )}

          {attachments.map((a) => (
            <article className="asset-card stack" key={a.id}>
              {a.kind === "image" && a.previewUrl && (
                <img
                  src={a.previewUrl}
                  alt={`Local preview of ${a.file.name}`}
                  style={{
                    maxHeight: 180,
                    objectFit: "contain",
                    alignSelf: "flex-start",
                  }}
                />
              )}
              <div className="row spread">
                <b>
                  {a.kind === "image" ? "IMG" : "DOC"} · {a.file.name}
                </b>
                <small>{fileSize(a.file.size)}</small>
              </div>

              {a.kind === "document" ? (
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    type="button"
                    variant={a.mode === "extract" ? "default" : "ghost"}
                    onClick={() => updateAttachment(a.id, { mode: "extract" })}
                  >
                    Extract & Edit (Phase B)
                  </Button>
                  <Button
                    type="button"
                    variant={
                      a.mode === "primary-source" ? "default" : "ghost"
                    }
                    onClick={() =>
                      updateAttachment(a.id, { mode: "primary-source" })
                    }
                  >
                    Attach as Primary Source (Phase B)
                  </Button>
                </div>
              ) : (
                <>
                  <label>
                    Figure caption
                    <input
                      className="input"
                      placeholder="e.g. Free-body diagram for incline plane"
                      value={a.caption || ""}
                      onChange={(e) =>
                        updateAttachment(a.id, { caption: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Authoritative teacher description
                    <textarea
                      className="input"
                      placeholder="Explain the key visual elements and physical laws shown in this diagram"
                      value={a.description || ""}
                      onChange={(e) =>
                        updateAttachment(a.id, { description: e.target.value })
                      }
                    />
                  </label>
                  <small className="muted">
                    Teacher description is the authoritative grounding for this
                    image. OCR is not used in this phase.
                  </small>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeAttachment(a.id)}
              >
                Remove
              </Button>
            </article>
          ))}

          <label>
            Trusted content
            <textarea
              className="input"
              name="text"
              minLength={30}
              required
              placeholder="Enter authoritative lesson notes, core definitions, and reference text..."
              style={{ minHeight: 220 }}
            />
          </label>

          <div className="row">
            <Button type="button" variant="ghost" onClick={closeNotes}>
              Cancel
            </Button>
            <Button variant="default">Save source version</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
