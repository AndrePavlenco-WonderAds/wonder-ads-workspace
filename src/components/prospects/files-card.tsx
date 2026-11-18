"use client";

// O cartão «Anexos» da Ficha do prospect (v80.0): os ficheiros soltos da
// ficha (proposta assinada, briefing do cliente, prints) e, por baixo, os
// que foram anexados às notas das reuniões — tudo num sítio só.

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { LIMITS, NOTE_TYPE_LABEL } from "@/lib/prospects/shared";
import { formatDate } from "@/lib/dates";
import { Card, DeleteButton, EmptyHint, SectionHead, personOf, relTime, useDirtyFlag, useProspect } from "./ui";
import { AttachmentTile, DropZone, UploadQueue, useProspectUploads } from "./uploads";

export function FilesCard() {
  const { file, viewer, send, slug, people, now } = useProspect();
  const uploads = useProspectUploads(slug, 20);
  const [saving, setSaving] = useState(false);
  useDirtyFlag("files:upload", uploads.items.length > 0);

  // Assim que todos os ficheiros da fila acabam, grava-os na ficha de uma vez.
  const readyIds = uploads.done.map((d) => d.id).join(",");
  useEffect(() => {
    if (saving || uploads.uploading || uploads.done.length === 0) return;
    setSaving(true);
    const batch = uploads.done;
    void send({ op: "files.add", files: batch }).then((ok) => {
      setSaving(false);
      // Sai da fila só o que ficou gravado; um ficheiro que falhou continua
      // à vista com o erro.
      if (ok) batch.forEach((d) => d.id && uploads.remove(d.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyIds, uploads.uploading]);

  const fromNotes = file.notes.flatMap((n) =>
    n.attachments.map((a) => ({ a, note: n })),
  );
  const total = file.files.length + fromNotes.length;

  return (
    <Card id="anexos">
      <SectionHead
        icon={Paperclip}
        title="Anexos"
        hint={total > 0 ? `${total} ficheiro${total === 1 ? "" : "s"}` : "Proposta, briefing, prints, atas"}
      />
      {viewer.canWrite && file.files.length < LIMITS.files && (
        <div className="mb-3">
          <DropZone onFiles={uploads.add} label="Largar ficheiros aqui ou escolher" />
          <UploadQueue items={uploads.items} onRemove={uploads.remove} />
        </div>
      )}
      {total === 0 ? (
        !viewer.canWrite && <EmptyHint>Sem anexos.</EmptyHint>
      ) : (
        <div className="space-y-1.5">
          {file.files.map((a) => (
            <AttachmentTile
              key={a.id}
              a={a}
              sub={`${personOf(people, a.addedBy).name} · ${relTime(a.addedAt, now)}`}
              right={
                viewer.canWrite && (viewer.isAdmin || viewer.username === a.addedBy) ? (
                  <DeleteButton onConfirm={() => send({ op: "file.delete", id: a.id })} />
                ) : null
              }
            />
          ))}
          {fromNotes.length > 0 && (
            <>
              <p className="pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Nas notas</p>
              {fromNotes.map(({ a, note }) => (
                <AttachmentTile
                  key={`${note.id}-${a.id}`}
                  a={a}
                  sub={`${note.title || NOTE_TYPE_LABEL[note.type]}${note.date ? ` · ${formatDate(`${note.date}T12:00:00`)}` : ""}`}
                />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
