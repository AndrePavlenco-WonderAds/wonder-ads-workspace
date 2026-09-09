// Origem pública da app para links que saem SEM pedido HTTP por perto —
// mensagens de Slack dos crons, e-mails, etc. Tudo o que tem um pedido à
// mão continua a usar `new URL(req.url).origin`, que já segue o domínio por
// onde a pessoa entrou.
//
// Quando o domínio próprio entrar, basta definir APP_BASE_URL na Vercel
// (Production) — nada disto precisa de mudar no código.

export const APP_URL = (
  process.env.APP_BASE_URL?.trim() || "https://wonder-ads-workspace.vercel.app"
).replace(/\/+$/, "");
