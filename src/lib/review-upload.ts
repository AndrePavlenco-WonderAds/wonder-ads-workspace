// Upload de um documento para a tabela Pending Review (v77.80) — PDF, Word,
// imagens, o que for. Vai direto do browser para o Blob pela mesma rota de
// token dos Client Files (`/api/files/upload`, 200 MB, tipos comuns), e o
// URL público resultante passa a ser o `docLink` da linha: é o que o cliente
// abre ao carregar em «Open».
//
// Só para o browser — usado pelo «Add row manually» e pelas linhas da tabela
// interna.

import { upload } from "@vercel/blob/client";

/** O que o input de ficheiro aceita. É um filtro de conveniência no seletor,
 *  não uma fronteira — a rota de upload tem a sua própria lista. */
export const REVIEW_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,image/*,video/*";

export async function uploadReviewDoc(
  clientSlug: string,
  file: File,
): Promise<{ url: string; fileName: string }> {
  const blob = await upload(`reviews/${clientSlug}/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/files/upload",
  });
  return { url: blob.url, fileName: file.name };
}

/** «Homepage-v2.pdf» → «Homepage-v2» — para pré-preencher a Task. */
export function fileNameToTask(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return (i > 0 ? fileName.slice(0, i) : fileName).trim();
}
