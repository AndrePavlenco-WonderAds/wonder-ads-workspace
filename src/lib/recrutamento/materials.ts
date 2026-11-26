// Recrutamento (v80.55) — os materiais de apoio das perguntas: os PDFs do
// teste de atenção ao detalhe (Fase 2 · Parte 1). Os ficheiros vivem em
// private/recrutamento/ (fora do public/: só SuperAdmins os leem, pela rota
// /api/admin/recrutamento/materiais/<id>). Gerados por
// scripts/recrutamento/build-teste-detalhe.py. Puro — serve o cliente e a rota.

export type MaterialId = "teste-detalhe-candidato" | "teste-detalhe-marcado" | "teste-detalhe-solucoes";

export type Material = {
  id: MaterialId;
  label: string;
  hint: string;
  /** Só para o entrevistador — nunca mostrar ao candidato. */
  interviewerOnly: boolean;
  /** O ficheiro em private/recrutamento/. */
  file: string;
  /** O nome com que se descarrega. */
  downloadName: string;
};

export const MATERIALS: Record<MaterialId, Material> = {
  "teste-detalhe-candidato": {
    id: "teste-detalhe-candidato",
    label: "Documento do candidato",
    hint: "O exercício, sem marcas. Envia-o na call ou partilha só esta janela.",
    interviewerOnly: false,
    file: "teste-detalhe-candidato.pdf",
    downloadName: "Teste de detalhe SEO — documento para o candidato.pdf",
  },
  "teste-detalhe-marcado": {
    id: "teste-detalhe-marcado",
    label: "Com os erros marcados",
    hint: "O mesmo documento, página a página, com os 10 erros a amarelo e o número da grelha.",
    interviewerOnly: true,
    file: "teste-detalhe-marcado.pdf",
    downloadName: "Teste de detalhe SEO — documento com os erros marcados (só entrevistador).pdf",
  },
  "teste-detalhe-solucoes": {
    id: "teste-detalhe-solucoes",
    label: "Soluções",
    hint: "Onde está cada erro e porque é erro, numa página.",
    interviewerOnly: true,
    file: "teste-detalhe-solucoes.pdf",
    downloadName: "Teste de detalhe SEO — soluções (só entrevistador).pdf",
  },
};

export function isMaterialId(v: string): v is MaterialId {
  return Object.prototype.hasOwnProperty.call(MATERIALS, v);
}

export function materialHref(id: MaterialId, download = false): string {
  return `/api/admin/recrutamento/materiais/${id}${download ? "?download=1" : ""}`;
}
