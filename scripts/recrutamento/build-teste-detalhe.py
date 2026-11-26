# Gera o documento do teste de atenção ao detalhe (Fase 2 · Parte 1 do
# Recrutamento), a versão com os erros marcados (v80.55) e a folha de
# soluções. 10 erros plantados, iguais à grelha da app
# (src/lib/recrutamento/templates.ts, pergunta d1).
#
# Escreve documento.html, documento-marcado.html e solucoes.html ao lado do
# script; os PDFs saem do Chrome:
#   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
#     --no-pdf-header-footer --print-to-pdf=out.pdf file:///…/documento.html
# e vão para private/recrutamento/ (servidos só a SuperAdmins por
# /api/admin/recrutamento/materiais/<id>). Não versionar os .html.
import html, os

OUT = os.path.dirname(os.path.abspath(__file__))
D = "www.clinicavaleazul.pt"

PAGES = [
    {
        "url": "/",
        "title": "Clínica Dentária Vale Azul | Dentista em Lisboa e Cascais",
        "meta": "Dentistas em Lisboa e Cascais com mais de 15 anos de experiência. Marque a sua consulta online ou por telefone.",
        "headings": "H1: Dentistas em Lisboa e Cascais · H2: Tratamentos · H2: As nossas unidades",
        "canonical": f"https://{D}/",
        "robots": "index, follow",
    },
    {
        "url": "/implantes-dentarios",
        "title": "Implantes Dentários em Lisboa e Cascais | Vale Azul",
        "meta": "Implantes dentários com planeamento digital e acompanhamento em todas as fases. Primeira consulta de avaliação gratuita.",
        "headings": "H1: Implantes dentários · H2: Como funciona · H2: Perguntas frequentes",
        "canonical": f"https://{D}/implantes-dentarios",
        "robots": "noindex, follow",  # ERRO d
    },
    {
        "url": "/ortodontia",
        # ERRO a — title com mais de 60 caracteres
        "title": "Ortodontia e Alinhadores Invisíveis em Lisboa | Clínica Dentária Vale Azul — Marque Já",
        "meta": "Aparelhos fixos e alinhadores invisíveis para crianças e adultos, com consultas de controlo incluídas no plano.",
        "headings": "H1: Ortodontia · H2: Alinhadores invisíveis · H2: Aparelhos fixos",
        "canonical": f"https://{D}/ortodontia",
        "robots": "index, follow",
    },
    {
        "url": "/branqueamento-dentario",
        "title": "Branqueamento Dentário em Lisboa e Cascais | Vale Azul",
        # ERRO b (1/2) — meta description igual à da /higiene-oral
        "meta": "Tratamentos de estética dentária com resultados naturais. Marque a sua consulta em Lisboa ou Cascais.",
        "headings": "H1: Branqueamento dentário · H2: Em consultório ou em casa · H2: Preços",
        # ERRO c — canonical a apontar para outra página
        "canonical": f"https://{D}/ortodontia",
        "robots": "index, follow",
    },
    {
        "url": "/higiene-oral",
        "title": "Higiene Oral e Destartarização | Clínica Vale Azul",
        # ERRO b (2/2)
        "meta": "Tratamentos de estética dentária com resultados naturais. Marque a sua consulta em Lisboa ou Cascais.",
        "headings": "H1: Higiene oral · H2: De quanto em quanto tempo · H2: O que inclui",
        "canonical": f"https://{D}/higiene-oral",
        "robots": "index, follow",
    },
    {
        "url": "/equipa",
        "title": "A Nossa Equipa de Médicos Dentistas | Vale Azul",
        "meta": "Conheça os médicos dentistas e higienistas que o acompanham nas unidades de Lisboa e de Cascais.",
        # ERRO e — dois H1
        "headings": "H1: A nossa equipa · H2: Medicina dentária · H1: Higiene oral",
        "canonical": f"https://{D}/equipa",
        "robots": "index, follow",
    },
    {
        "url": "/contactos",
        "title": "Contactos e Marcações | Clínica Dentária Vale Azul",
        "meta": "Moradas, telefones e horários das unidades de Lisboa e de Cascais. Marque a sua consulta em poucos minutos.",
        "headings": "H1: Contactos · H2: Lisboa · H2: Cascais",
        "canonical": f"https://{D}/contactos",
        "robots": "index, follow",
    },
]

# Só a /ortodontia pode passar dos 60 caracteres.
for p in PAGES:
    n = len(p["title"])
    assert (n > 60) == (p["url"] == "/ortodontia"), (p["url"], n)
    print(f"{n:3d}  {p['url']}")

LINKS = [
    ("/", "Marcar consulta", "/contactos#marcacao", "200"),
    ("/", "Implantes dentários", "/implantes-dentarios", "200"),
    ("/implantes-dentarios", "Ver preços", "/precos", "200"),
    ("/ortodontia", "Alinhadores invisíveis", "/ortodontia#alinhadores", "200"),
    ("/equipa", "Dra. Inês Lopes", "/equipa/ines-lopes", "200"),
    ("/contactos", "Como chegar à unidade de Cascais", "/unidades/cascais", "404"),  # ERRO f
    ("/blog/quando-fazer-destartarizacao", "Higiene oral", "/higiene-oral", "200"),
]

KEYWORDS = [
    ("implantes dentários lisboa", 6, 4),
    ("ortodontia lisboa", 9, 7),
    ("dentista cascais", 3, 3),
    ("branqueamento dentário cascais", 12, 11),
    ("clínica dentária avenidas novas", 5, 4),
]

e = html.escape

MARKED = False


def m(n, text):
    """Um erro plantado: na versão marcada fica sublinhado com o número da grelha."""
    return f'<mark class="err" data-n="{n}">{text}</mark>' if MARKED else text



def var(a, b):
    d = a - b
    return "=" if d == 0 else (f"+{d}" if d > 0 else f"−{-d}")


CSS = """
@page { size: A4; margin: 14mm 15mm 12mm 15mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1b1d2a; font-size: 10.2pt; line-height: 1.5; margin: 0; }
.top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1b1d2a; padding-bottom: 10px; }
.eyebrow { font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #6a6f85; font-weight: 600; }
h1 { font-size: 21pt; margin: 4px 0 0; letter-spacing: -.02em; }
.meta { font-size: 9pt; color: #4a4f63; text-align: right; line-height: 1.6; }
h2 { font-size: 12.5pt; margin: 20px 0 8px; padding-top: 4px; letter-spacing: -.01em; }
h2 span { color: #8a8fa5; font-weight: 500; margin-right: 6px; }
p { margin: 0 0 8px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 4px; }
.kpi { border: 1px solid #dfe1ea; border-radius: 8px; padding: 8px 10px; }
.kpi b { display: block; font-size: 15pt; letter-spacing: -.02em; }
.kpi small { color: #6a6f85; font-size: 8.5pt; }
.card { border: 1px solid #dfe1ea; border-radius: 8px; padding: 8px 11px; margin-bottom: 7px; break-inside: avoid; }
.card .url { font-family: Menlo, monospace; font-size: 9pt; font-weight: 700; color: #343ed7; margin-bottom: 3px; }
.row { display: grid; grid-template-columns: 92px 1fr; gap: 8px; font-size: 9.2pt; padding: 1.5px 0; }
.row .k { color: #6a6f85; }
.mono { font-family: Menlo, monospace; font-size: 8.6pt; }
table { width: 100%; border-collapse: collapse; font-size: 9.2pt; margin-top: 4px; break-inside: avoid; }
th { text-align: left; font-size: 8.3pt; text-transform: uppercase; letter-spacing: .05em; color: #6a6f85; border-bottom: 1.5px solid #1b1d2a; padding: 5px 6px; }
td { border-bottom: 1px solid #e6e8ef; padding: 5px 6px; vertical-align: top; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.note { font-size: 8.8pt; color: #6a6f85; margin-top: 5px; }
ol { margin: 4px 0 0 18px; padding: 0; } li { margin-bottom: 4px; }
.foot { margin-top: 12px; border-top: 1px solid #dfe1ea; padding-top: 8px; font-size: 8.5pt; color: #8a8fa5; display: flex; justify-content: space-between; }
.break { break-before: page; }
.keep { break-inside: avoid; }
"""

ERR_FIELDS = {
    ("/ortodontia", "title"): 1,
    ("/branqueamento-dentario", "meta"): 2,
    ("/higiene-oral", "meta"): 2,
    ("/branqueamento-dentario", "canonical"): 3,
    ("/implantes-dentarios", "robots"): 4,
}


def fld(p, k):
    v = e(p[k])
    if k == "headings" and p["url"] == "/equipa":
        return v.replace("H1: Higiene oral", m(5, "H1: Higiene oral"))
    n = ERR_FIELDS.get((p["url"], k))
    return m(n, v) if n else v


def build_doc():
    cards = "".join(
        f"""<div class="card"><div class="url">{e(p['url'])}</div>
<div class="row"><span class="k">Title</span><span>{fld(p, 'title')}</span></div>
<div class="row"><span class="k">Meta description</span><span>{fld(p, 'meta')}</span></div>
<div class="row"><span class="k">Cabeçalhos</span><span>{fld(p, 'headings')}</span></div>
<div class="row"><span class="k">Canonical</span><span class="mono">{fld(p, 'canonical')}</span></div>
<div class="row"><span class="k">Meta robots</span><span class="mono">{fld(p, 'robots')}</span></div></div>"""
        for p in PAGES
    )

    links = "".join(
        f"<tr><td class='mono'>{e(o)}</td><td>{e(t)}</td><td class='mono'>{m(6, e(d)) if s == '404' else e(d)}</td><td class='num'>{m(6, s) if s == '404' else s}</td></tr>"
        for o, t, d, s in LINKS
    )
    kws = "".join(
        f"<tr><td>{e(k)}</td><td class='num'>{a}</td><td class='num'>{b}</td><td class='num'>{var(a, b)}</td></tr>"
        for k, a, b in KEYWORDS
    )

    return f"""<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Auditoria SEO — Clínica Dentária Vale Azul</title><style>{CSS}</style></head><body>
<div class="top">
  <div><div class="eyebrow">Auditoria SEO on-page · relatório mensal</div><h1>Clínica Dentária Vale Azul</h1></div>
  <div class="meta">Domínio: <b>{D}</b><br>Data do rastreio: {m(9, "31/11/2026")}<br>Dados de 01/10/2026 a 31/10/2026<br>Unidades: Lisboa (Avenidas Novas) e Cascais</div>
</div>

<h2><span>1</span>Resumo</h2>
<div class="kpis">
  <div class="kpi"><small>Sessões orgânicas (outubro)</small><b>1.500</b><small>setembro: 1.200</small></div>
  <div class="kpi"><small>Pedidos de marcação pelo site</small><b>46</b><small>setembro: 38</small></div>
  <div class="kpi"><small>Páginas analisadas</small><b>7</b><small>de 42 páginas indexáveis</small></div>
</div>
<p>Em outubro, o site teve 1.500 sessões orgânicas, contra 1.200 em setembro: {m(10, "um crescimento de 20%")}. As pesquisas com o nome da clínica representam 640 dessas 1.500 sessões (42,7%). Os pedidos de marcação pelo formulário passaram de 38 para 46 (+21,1%).</p>
<p>A clínica está bem posicionada para «implantes dentários lisboa» (posição 4), mas perde visibilidade em «branqueamento dentário cascais», onde a {m(8, "concorência")} ocupa os três primeiros lugares. Nas próximas páginas estão os dados técnicos das sete páginas principais, uma amostra dos links internos, a consistência das moradas e telefones e a evolução das palavras-chave.</p>

<h2><span>2</span>Páginas principais</h2>
{cards}

<div class="keep"><h2><span>3</span>Links internos (amostra do rastreio)</h2>
<table><thead><tr><th>Página de origem</th><th>Texto do link</th><th>Destino</th><th style="text-align:right">Estado HTTP</th></tr></thead><tbody>{links}</tbody></table></div>

<div class="keep"><h2><span>4</span>Moradas e telefones (NAP)</h2>
<table><thead><tr><th>Unidade</th><th>Campo</th><th>Site (página Contactos)</th><th>Perfil da Empresa no Google</th></tr></thead><tbody>
<tr><td rowspan="3"><b>Lisboa</b></td><td>Nome</td><td>Clínica Dentária Vale Azul — Lisboa</td><td>Clínica Dentária Vale Azul — Lisboa</td></tr>
<tr><td>Morada</td><td>Av. da República, 45, 1050-187 Lisboa</td><td>Av. da República, 45, 1050-187 Lisboa</td></tr>
<tr><td>Telefone</td><td>213 456 789</td><td>213 456 789</td></tr>
<tr><td rowspan="3"><b>Cascais</b></td><td>Nome</td><td>Clínica Dentária Vale Azul — Cascais</td><td>Clínica Dentária Vale Azul — Cascais</td></tr>
<tr><td>Morada</td><td>Rua Frederico Arouca, 120, 2750-355 Cascais</td><td>Rua Frederico Arouca, 120, 2750-355 Cascais</td></tr>
<tr><td>Telefone</td><td>{m(7, "214 830 112")}</td><td>{m(7, "214 830 121")}</td></tr>
</tbody></table>
<p class="note">Horário nas duas unidades e nas duas fontes: segunda a sexta, 09:00–20:00; sábado, 09:00–13:00.</p></div>

<div class="keep"><h2><span>5</span>Palavras-chave</h2>
<table><thead><tr><th>Palavra-chave</th><th style="text-align:right">Posição setembro</th><th style="text-align:right">Posição outubro</th><th style="text-align:right">Variação</th></tr></thead><tbody>{kws}</tbody></table>
<p class="note">Variação positiva = subiu de posição. Posições médias no Google, Portugal, telemóvel e computador.</p></div>

<div class="keep"><h2><span>6</span>Próximos passos</h2>
<ol>
<li>Publicar dois artigos por mês no blog, sobre implantes e ortodontia.</li>
<li>Criar uma página própria para o branqueamento em Cascais, com casos reais e preços.</li>
<li>Pedir avaliações no Google aos pacientes das duas unidades, no fim de cada tratamento.</li>
</ol>
<div class="foot"><span>Preparado pela equipa de SEO · Relatório de 02/12/2026</span><span>Documento interno</span></div></div>
</body></html>"""

SOL = [
    ("Title com mais de 60 caracteres", "Secção 2, página /ortodontia", f"O title tem {len(PAGES[2]['title'])} caracteres: é cortado nos resultados do Google."),
    ("Meta description duplicada", "Secção 2, /branqueamento-dentario e /higiene-oral", "As duas páginas têm a mesma meta description, palavra por palavra."),
    ("Canonical para a página errada", "Secção 2, /branqueamento-dentario", "O canonical aponta para /ortodontia: o Google pode deixar de mostrar a página do branqueamento."),
    ("Noindex numa página importante", "Secção 2, /implantes-dentarios", "Meta robots «noindex, follow» na página do serviço principal (é a que está na posição 4)."),
    ("Dois H1 na mesma página", "Secção 2, /equipa", "«H1: A nossa equipa» e «H1: Higiene oral»: o segundo devia ser H2."),
    ("Link partido (404)", "Secção 3, link da /contactos", "«Como chegar à unidade de Cascais» leva a /unidades/cascais, que dá 404."),
    ("Telefone diferente (NAP)", "Secção 4, unidade de Cascais", "Site: 214 830 112. Perfil da Empresa no Google: 214 830 121 (os dois últimos algarismos trocados)."),
    ("Erro ortográfico", "Secção 1, 2.º parágrafo", "«concorência» em vez de «concorrência»."),
    ("Data errada", "Cabeçalho, «Data do rastreio»", "31/11/2026 não existe: novembro tem 30 dias."),
    ("Percentagem mal calculada", "Secção 1, 1.º parágrafo", "De 1.200 para 1.500 sessões é +25%, não +20%. (Os 42,7% e os +21,1% estão certos.)"),
]

sol_rows = "".join(
    f"<tr><td class='num'><b>{i}</b></td><td><b>{e(a)}</b></td><td>{e(b)}</td><td>{e(c)}</td></tr>" for i, (a, b, c) in enumerate(SOL, 1)
)
SOLDOC = f"""<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Teste de detalhe — soluções</title><style>{CSS}
table {{ font-size: 9.6pt; }} td {{ padding: 7px 6px; }}</style></head><body>
<div class="top"><div><div class="eyebrow">Recrutamento · Fase 2 · Parte 1 · Atenção ao detalhe</div><h1>Soluções do teste</h1></div>
<div class="meta">Só para o entrevistador<br>Documento: Auditoria SEO — Clínica Dentária Vale Azul</div></div>
<p style="margin-top:14px">O candidato encontra os erros na call, sem AI. 1 ponto por erro encontrado (máximo 10). Usar AI ou dizer «parece-me tudo bem» é red flag. Os números são os da grelha da entrevista na app.</p>
<table><thead><tr><th style="text-align:right">#</th><th>Erro plantado</th><th>Onde está</th><th>Porque é erro</th></tr></thead><tbody>{sol_rows}</tbody></table>
<p class="note" style="margin-top:12px">Tudo o resto do documento está certo de propósito (títulos das outras páginas com 60 caracteres ou menos, canonicals próprios, links com estado 200, telefone de Lisboa igual nas duas fontes, variações das palavras-chave). Se o candidato apontar outra coisa, não conta como erro plantado, mas pode mostrar critério.</p>
</body></html>"""

assert len(SOL) == 10
DOC = build_doc()
MARKED = True
MCSS = """
mark.err { background: #fff1a6; color: inherit; border-bottom: 2.5px solid #e0312b; padding: 0 2px; border-radius: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
mark.err::after { content: attr(data-n); display: inline-block; margin-left: 3px; min-width: 13px; height: 13px; padding: 0 3px; border-radius: 7px; background: #e0312b; color: #fff; font: 700 7.5pt/13px -apple-system, Helvetica, Arial, sans-serif; text-align: center; vertical-align: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.banner { margin: 0 0 10px; padding: 7px 11px; border-radius: 8px; background: #fde8e7; border: 1px solid #f3b4b0; color: #8f1d17; font-size: 9pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.banner b { color: #b3241c; }
"""
MDOC = build_doc().replace("</style>", MCSS + "</style>", 1).replace(
    "<body>\n<div class=\"top\">",
    "<body>\n<div class=\"banner\"><b>Versão do entrevistador — não mostrar ao candidato.</b> Os 10 erros plantados estão a amarelo, sublinhados a vermelho, com o número da grelha da entrevista (1–10).</div>\n<div class=\"top\">",
    1,
)
assert MDOC.count('class="err"') == 13, MDOC.count('class="err"')
open(os.path.join(OUT, "documento.html"), "w").write(DOC)
open(os.path.join(OUT, "documento-marcado.html"), "w").write(MDOC)
open(os.path.join(OUT, "solucoes.html"), "w").write(SOLDOC)
print("ok")
