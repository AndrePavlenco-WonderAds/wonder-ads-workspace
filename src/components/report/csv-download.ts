// Descarregar um CSV gerado no browser. Com BOM, para o Excel e o Sheets
// lerem os acentos («Posição», «implantes dentários») à primeira.

export function downloadCsv(text: string, fileName: string): void {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
