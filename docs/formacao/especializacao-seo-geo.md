# Especialização SEO/GEO — Estrutura de Módulos, Aulas e Quizzes

Documento de especificação para implementar em `https://workspace.wonder-ads.com/formacao/seo-geo`.
Fonte: Bibl. 1 Vídeos de Formação (33 vídeos), Bibl. 2 Vídeos de Formação (22 entradas, 1 duplicada, 3 por gravar) e EXAM_QUIZ_QUESTIONS (38 blocos de perguntas).

## Lógica de organização

Progressão do mais simples para o mais difícil, seguindo o percurso real de um consultor novo:

1. Primeiro o que é preciso para "funcionar" na WonderAds (mindset, protocolos, ferramentas internas).
2. Depois as rotinas diárias/semanais/mensais com o cliente.
3. Depois como lidar com situações difíceis (aprovações, problemas, tickets).
4. Depois o trabalho técnico de SEO, na ordem em que acontece num projeto: auditoria e research → roadmap e onboarding → on-page → conteúdo → local SEO → backlinks.
5. Por fim, crescimento de conta (cross-sell, up-sell, renovação), que exige domínio de todo o resto.

Regras aplicadas:

- Cada aula = 1 vídeo. Cada módulo agrupa vídeos da mesma categoria.
- O quiz de cada módulo usa apenas perguntas dos vídeos desse módulo.
- Os dois sub-módulos originais (COMUNICAÇÃO e CLIENT DELIVERY) foram fundidos: a coluna "Origem" em cada aula guarda de onde veio (COM = Comunicação, CD = Client Delivery, B2 = Biblioteca 2).
- O vídeo "Postar GMB Post" (qO-XAuRbl_E) aparecia nas duas bibliotecas; fica uma vez só, no módulo de Local SEO.
- Aulas sem vídeo ainda estão marcadas como `A GRAVAR` e devem aparecer como "em breve" (bloqueadas) no workspace.
- Perguntas sem resposta marcada no doc original estão sinalizadas com `⚠️ CONFIRMAR` e com a resposta mais provável indicada. Ver Anexo B.

## Formato das perguntas neste documento

```
Qn [single]  → escolha única, opções com [x] = correta
Qn [multi]   → escolha múltipla, várias [x]
Qn [vf]      → verdadeiro/falso, resposta indicada com → V ou → F
```

Sugestão de regra de aprovação: 80% para desbloquear o módulo seguinte, tentativas ilimitadas, perguntas baralhadas.

## Visão geral

| # | Módulo | Aulas | Perguntas | Vídeos a gravar |
|---|--------|-------|-----------|-----------------|
| 1 | Boas-vindas, Mindset e Ferramentas Internas | 6 | 19 | 0 |
| 2 | Rotinas de Reporting e Comunicação com o Cliente | 8 | 12 | 1 |
| 3 | Gestão de Situações com o Cliente | 4 | 25 | 0 |
| 4 | Auditoria Técnica e Keyword Research | 6 | 26 | 2 |
| 5 | Roadmap e Onboarding de Cliente Novo | 5 | 37 | 0 |
| 6 | On-Page SEO | 5 | 31 | 0 |
| 7 | Estratégia de Conteúdo | 3 | 20 | 0 |
| 8 | Produção e Otimização de Conteúdo | 4 | 31 | 0 |
| 9 | Local SEO — Google Business Profile | 4 | 15 | 0 |
| 10 | Off-Page SEO — Backlinks | 5 | 35 | 0 |
| 11 | Crescimento de Conta: Cross-sell, Up-sell e Renovação | 4 | 21 | 0 |
| | Total | 54 | 272 | 3 |

---

## Módulo 1 — Boas-vindas, Mindset e Ferramentas Internas

Objetivo: o consultor percebe o que se espera dele, conhece os protocolos base e configura as ferramentas obrigatórias no primeiro dia.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 1.1 | Bem-vindos ao Departamento de SEO e GEO │ Mindset de Consultor de SEO/GEO | https://youtu.be/rHyBzn8XUkE | COM | — | OK |
| 1.2 | Como utilizar a app interna | https://youtu.be/PIh_7uEJ-Sw | CD | — | OK |
| 1.3 | Como criar assinatura Gmail e aplicar | https://youtu.be/Dc5QNdWRCLc | CD | Anexar HTML `wonderads-signature.html` (download) + `butterfly.gif` | OK |
| 1.4 | Como instalar o Fathom e utilizar o mesmo | https://youtu.be/0aJevETkcPc | CD | — | OK |
| 1.5 | Como agendar reunião com a equipa/André/Administração presente | https://youtu.be/RDn6aFO_oiw | COM | — | OK |
| 1.6 | Como fazer um pedido de ausência | https://youtu.be/DcrZE67Lm80 | COM | — | OK |

### Quiz Módulo 1 (19 perguntas)

Aula 1.3 — Assinatura Gmail

Q1 [vf] É opcional eu ter a assinatura de email em inglês e em português. → F

Q2 [single] Basta ter a assinatura de Gmail da empresa em: ⚠️ CONFIRMAR (sem resposta marcada; pela Q1 e Q5, a correta é "Ambas")
- [ ] Inglês
- [ ] Português
- [x] Ambas as anteriores

Q3 [multi] A minha assinatura de Gmail da empresa apenas precisa de ter:
- [x] Email
- [x] Nome
- [x] Cargo
- [x] Telefone
- [x] Link para agendamento
- [ ] Morada
- [x] Logotipo da empresa
- [ ] Dados empresariais da WonderAds

Q4 [vf] Posso ter uma assinatura de empresa que eu decida criar por mim mesmo no meu Gmail da empresa. → F

Q5 [vf] É minha total responsabilidade ter o Gmail da empresa em PT e Inglês desde o início da minha carreira na WonderAds. → V

Aula 1.4 — Fathom

Q6 [vf] Em reuniões de equipa não preciso de utilizar o Fathom para gravar a reunião. → F

Q7 [single] O Fathom é utilizado para:
- [ ] Automatizar emails
- [x] Gravar reuniões
- [ ] Gravar chamadas WhatsApp
- [ ] Todas as anteriores

Q8 [single] O Fathom é obrigatório ser usado por:
- [ ] Consultores
- [ ] Administração
- [ ] Web Designers
- [x] Todos os anteriores

Q9 [vf] O Fathom serve para nos protegermos em caso de conflito mas também para formação de colegas. → V

Q10 [vf] O Fathom em reuniões de 15 minutos com clientes não é obrigatório ser autorizado na reunião. → F

Q11 [single] A administração da WonderAds tem como protocolo pedir as gravações de reuniões de colegas:
- [ ] 1 vez por semana
- [ ] 1 vez por mês
- [ ] 2 vezes por mês
- [x] Esporadicamente e aleatoriamente a qualquer momento

Aula 1.5 — Agendar reunião com a equipa/André/Administração

Q12 [single] Devo sempre verificar qual plataforma antes de agendar uma reunião com um colega:
- [ ] Google Meet
- [x] Google Calendar
- [ ] Gmail
- [ ] Outlook Calendar
- [ ] Todas as anteriores

Q13 [vf] Para verificar a agenda/calendário de um colega devo sempre ir ao Google Calendar e selecionar do lado esquerdo onde diz "Meet with…" o email do colega em questão. → V

Q14 [vf] Quando quero agendar uma reunião de urgência com a administração da WonderAds, neste caso, é opcional verificar os agendamentos no Google Calendar. → F

Q15 [multi] Cenário: Quero agendar uma reunião de acompanhamento extra com o André, devo:
- [ ] Verificar o Google Meet e Gmail
- [x] Verificar o Google Calendar e disponibilidades do André
- [x] Tentar evitar a hora de almoço
- [ ] Agendar sempre para as 18:00-20:00
- [ ] Todas as anteriores

Aula 1.6 — Pedido de ausência

Q16 [vf] O pedido de ausência só entra em efetivo depois de este ser aceite por um membro da equipa administrativa. → V

Q17 [single] Um pedido de ausência só é obrigatório ser pedido caso a ausência seja superior a:
- [ ] 10 min.
- [ ] 20 min.
- [x] 30 min.
- [ ] 60 min.
- [ ] 120 min.

Q18 [vf] Posso fazer um pedido de ausência diretamente pelo grupo no WhatsApp a um membro da administração em vez de submeter na app pelo protocolo. → F

Q19 [vf] É total responsabilidade do consultor estar disponível para reuniões, mensagens e chamadas dentro do horário de trabalho, desde que não haja um pedido de ausência aprovado. → V

Sem perguntas: aulas 1.1 e 1.2 (ver Anexo C).

---

## Módulo 2 — Rotinas de Reporting e Comunicação com o Cliente

Objetivo: dominar o ciclo diário → semanal → mensal de comunicação, o NPS e as surprise news.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 2.1 | Como criar um Daily Update (interno) | https://youtu.be/53hU0LqoIhw | CD | — | OK |
| 2.2 | Como criar um Weekly Report (externo) | https://youtu.be/btQ0c57SQV8 | CD | — | OK |
| 2.3 | Como criar um Monthly Report (pela app) | https://youtu.be/rxVJOnzqogg | CD | — | OK |
| 2.4 | Roleplay: Como enviar um Monthly Report em vídeo | https://youtu.be/0OsdUmWc83M | COM | — | OK |
| 2.5 | Como gerar o Monthly Report para cliente e-commerce (Shopify, etc.) | — | B2 | Depende de alterações à action Monthly Report na app antes de gravar (André Pereira) | A GRAVAR |
| 2.6 | Roleplay: Como enviar Surprise News ao cliente | https://youtu.be/v4BX2Z_8Fno | COM | — | OK |
| 2.7 | Como enviar NPS Form ao cliente (SMS, 1 semana de espera, 1 follow-up e 1 semana depois call) | https://youtu.be/5WWjo9BsXbY | COM | — | OK |
| 2.8 | Roleplay: Follow-up call de NPS Form a cliente que ainda não respondeu | https://youtu.be/sJsGrgB-GcA | COM | — | OK |

### Quiz Módulo 2 (12 perguntas)

Protocolos gerais (aulas 2.1–2.3)

Q1 [multi] Quais destes são os protocolos obrigatórios na empresa?
- [x] Daily update à equipa
- [ ] Daily update ao cliente
- [x] Weekly report ao cliente
- [ ] Weekly report à equipa
- [x] Monthly report ao cliente
- [x] Monthly report ao cliente com Loom ou Reunião
- [ ] Loom bi-semanal para o cliente

Aulas 2.3–2.4 — Monthly Report

Q2 [vf] O consultor na altura do report mensal deve sempre perguntar se o cliente prefere ter um vídeo de overview do relatório para poder ver no seu tempo ou perguntar se o cliente prefere ter uma reunião de esclarecimento de dúvidas sobre o relatório mensal. → V

Q3 [vf] Caso o cliente prefira ter o relatório com vídeo de overview do relatório, o consultor deve estudar e analisar bem o report antes de começar o vídeo. → V

Q4 [vf] Caso o consultor prefira ter um vídeo de overview do relatório, o consultor deve fazer uma apresentação PowerPoint para apresentar o report mensal. → F

Q5 [single] O consultor deve sempre deixar claro que: ⚠️ CONFIRMAR (sem resposta marcada; a mais completa é a 3.ª opção)
- [ ] Temos que saber a faturação mensal do cliente para gerir expectativas
- [ ] O cliente deve fazer a contagem de leads
- [x] O cliente deve fazer a contagem de leads por mês e perguntar de onde estas descobriram o negócio (Google, AIs, Instagram, etc.)
- [ ] Nós fazemos a contagem de leads fechadas pelo cliente e ele não tem que se preocupar

Q6 [vf] O consultor deve sempre saber se o cliente está a ter uma boa taxa de conversão. → V

Q7 [single] Cenário: O cliente tem bastantes leads a chegar e a taxa de conversão/fecho na receção/primeira barreira do cliente está muito baixa. Devo: ⚠️ CONFIRMAR (sem resposta marcada; a mais completa é a 4.ª opção)
- [ ] Apresentar ao cliente um novo roadmap
- [ ] Dizer ao cliente que se calhar a receção tem que ser despedida
- [ ] Sugerir ao cliente a nossa consultoria de vendas
- [x] Dizer ao cliente que a melhor estratégia é uma formação comercial com a receção (primeiro gate do cliente) e para isso vamos ver internamente o melhor preço/roadmap para o cliente dando um desconto de cliente. Escalar depois ao André/Alex.
- [ ] Todas as anteriores estão corretas

Q8 [vf] O vídeo de overview do relatório e/ou a reunião de apresentação do roadmap devem mencionar detalhes técnicos e ir fundo. → F

Aula 2.6 — Surprise News

Q9 [single] Quais dos seguintes pode ser uma surprise news?
- [ ] GSC 180 clicks orgânicos nos últimos 28 dias
- [ ] Salto de 20 posições para uma keyword importante para o cliente
- [ ] Tivemos um salto de 25% nas impressões no Google Analytics
- [x] Todas as anteriores

Q10 [vf] Na mensagem de envio de surprise news para enviar no grupo com o cliente temos sempre que identificar sem falta o chefe máximo da empresa. → V

Aulas 2.7–2.8 — NPS Form

Q11 [single] Dentro de quantos dias deve-se ligar a um cliente que não preencheu o NPS form? ⚠️ CONFIRMAR (sem opções no doc original; pelo título do vídeo 2.7 o protocolo é SMS → 1 semana → follow-up → 1 semana → call, logo ~14 dias)
- [ ] 3 dias
- [ ] 7 dias
- [x] 14 dias
- [ ] 30 dias

Q12 [single] Quanto tempo leva o NPS form da WonderAds?
- [ ] 1 minuto
- [x] 5-10 minutos
- [ ] 15 minutos
- [ ] 15-20 minutos

Sem perguntas: aulas 2.1, 2.2 (cobertas pela Q1), 2.5 (a gravar).

---

## Módulo 3 — Gestão de Situações com o Cliente

Objetivo: reagir bem quando o cliente não aprova, tem dúvidas administrativas, reporta um problema técnico ou precisa de alterações web.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 3.1 | Como reforçar a aprovação do cliente em materiais + follow-ups (1.º aviso na tabela, 2.º aviso 3 dias depois, 3.º aviso call 5 dias depois) c/ roleplay | https://youtu.be/BqvAx7cFKdk | COM | — | OK |
| 3.2 | Como solucionar um problema administrativo (ex.: dúvida sobre preço da Wikipedia page) | https://youtu.be/4-KCE7JJ2Js | COM | — | OK |
| 3.3 | Como solucionar um problema técnico | https://youtu.be/5a9lbODTF8c | CD | — | OK |
| 3.4 | Como criar um ticket de alterações WEB corretamente | https://youtu.be/u0euxplXZro | CD | — | OK |

### Quiz Módulo 3 (25 perguntas)

Aula 3.1 — Pedir aprovações aos clientes

Q1 [single] É minha total responsabilidade como consultor de SEO:
- [ ] (A) Mencionar aos meus clientes logo que adiciono novos documentos à tabela de pending review para ele aprovar
- [ ] (B) Dar um reminder aos clientes por mensagem 3 dias depois de adicionar o documento (caso não esteja aprovado ainda)
- [ ] (C) Ligar ao cliente para ele aprovar os documentos passados 5 dias de o cliente ainda não os ter revisto
- [x] (D) Todas as opções anteriores

Q2 [vf] É obrigatório ligar ao cliente para aprovar os documentos caso ele não esteja a responder por mensagens ou emails aos follow-ups da equipa. → V

Q3 [single] Só é obrigatório ligar ao cliente para aprovar os documentos passados quantos dias de ignorância por parte do cliente:
- [x] 5 dias
- [ ] 10 dias
- [ ] 14 dias
- [ ] 20 dias

Q4 [vf] Eu não tenho a responsabilidade de mencionar ao cliente que adicionei novos documentos para aprovação na tabela de pending review. → F

Q5 [single] Numa chamada de follow-up para o cliente aprovar documentos em atraso eu devo explicar ao cliente que:
- [ ] O atraso de documentos implica o atraso do roadmap
- [ ] O atraso de aprovação implica o atraso das analytics do GA4 e do GSC
- [x] O atraso de aprovações implica o atraso do roadmap e frutos de SEO/faturação
- [ ] O atraso de aprovações significa que as actions que temos programadas para fazer a seguir estão suspensas e o cliente está a ter a parceria a meio gás

Q6 [single] O primeiro follow-up por mensagem sobre documentação por aprovação deve ser enviado obrigatoriamente ao cliente passados quantos dias:
- [ ] 2 dias
- [x] 3 dias
- [ ] 4 dias
- [ ] 5 dias

Aula 3.2 — Acalmar e resolver um problema administrativo

Q7 [single] É importante dizer ao cliente que iremos dar resposta à pergunta/problema no máximo dentro de:
- [x] 24 horas
- [ ] 48 horas
- [ ] 72 horas
- [ ] 1 semana

Q8 [single] Se não souber responder a uma questão administrativa do cliente devo sempre perguntar primeiro a quem: ⚠️ CONFIRMAR (sem resposta marcada; pela Q10 o primeiro passo é a equipa/colegas)
- [ ] André Pavlenco
- [ ] Alex Pavlenco
- [x] Colega de equipa
- [ ] Alice Santos

Q9 [vf] Um problema administrativo tem sempre resposta. → V

Q10 [single] Se o meu cliente vier com uma pergunta que não sei responder, é minha total responsabilidade:
- [x] (A) Manter a calma, informar o cliente de que iremos retornar com uma resposta, colocar a questão à equipa do DPT no grupo e, caso nenhum colega saiba responder ou ajudar, recorrer à ajuda do André
- [ ] (B) Manter a calma, dizer ao cliente que iremos retornar com uma resposta e encaminhar de imediato a questão ao André
- [ ] (C) Manter a calma e responder com aquilo que me parece mais provável, confirmando depois internamente caso o cliente volte a questionar
- [ ] (D) Explicar ao cliente que essa questão não é da minha competência e encaminhá-lo para outro departamento, sem qualquer acompanhamento posterior

Aula 3.3 — Acalmar e resolver um problema técnico

Q11 [vf] Ao receber um problema técnico de um cliente (por reunião, mensagem ou email), o primeiro passo é sempre perceber se sabemos ou não a solução a 100% antes de responder ao cliente. → V

Q12 [single] Quando sabemos a solução a 100%, a mensagem correta a enviar ao cliente é:
- [ ] (A) "Olá cliente, a solução é X, damos feedback em breve!"
- [ ] (B) "Olá cliente, estamos a estudar a melhor resolução e a solução é X!"
- [x] (C) "Olá cliente, a solução é X, estamos a resolver enquanto falamos!"
- [ ] (D) "Olá cliente, o problema está resolvido, foi X."

Q13 [vf] O fluxo "Como solucionar um problema técnico" aplica-se também e igualzinho a problemas administrativos, desde que sejam urgentes. → F

Q14 [single] Um cliente reporta que o formulário do site não está a enviar leads. Após estancar o cliente, o passo imediatamente a seguir é:
- [ ] (A) Abrir logo um ticket de urgência máxima
- [ ] (B) Publicar no Slack Channel para acelerar
- [x] (C) Perceber o problema em detalhe
- [ ] (D) Ir procurar solução no Claude + ChatGPT + Net

Q15 [vf] Num problema Web, o ticket deve ser sempre criado com urgência máxima porque afeta a operação do cliente. → F

Q16 [single] O cliente reporta que o Google Search Console deixou de mostrar dados corretamente e o problema é claramente da plataforma (Não Web). Devo:
- [ ] (A) Abrir um ticket com urgência máxima porque é um bug
- [ ] (B) Publicar no Slack Channel geral da empresa
- [x] (C) Procurar solução com Claude + Net e, em paralelo, verificar se o GSC tem plataforma de suporte por email ou chamada
- [ ] (D) Recorrer imediatamente à equipa para pedir reunião com um colega

Q17 [single] Ao contactar o suporte de uma plataforma externa (ex.: GSC, Meta, CRM do cliente) para resolver um problema Não Web:
- [ ] (A) Devo tratar internamente e só avisar o cliente quando tiver resposta final do suporte
- [x] (B) Devo entrar em contacto com o suporte e avisar o cliente da situação
- [ ] (C) Devo pedir ao cliente para ele próprio abrir o ticket junto do suporte, porque a conta é dele

Q18 [vf] "Recorrer à equipa" é o primeiro passo sempre que o problema técnico parece complexo, para poupar tempo. → F

Q19 [multi] Quando recorro à equipa para me ajudar a resolver um problema técnico, o fluxo pode terminar em:
- [x] (A) Solucionar por WhatsApp com apoio da equipa
- [x] (B) Pedir reunião com um colega
- [ ] (C) Reencaminhar o cliente diretamente para o colega que sabe resolver
- [ ] (D) Abrir ticket com urgência máxima em nome do colega
- [ ] (E) Marcar reunião direta entre o colega e o cliente

Q20 [single] Cenário: Um cliente envia por WhatsApp "o site está em baixo, não consigo aceder a nada". Estou em reunião com outro cliente e só vejo a mensagem 15 min depois. A ação mais correta é:
- [ ] (A) Responder logo com "Olá cliente, a solução é reiniciar o servidor, estamos a resolver enquanto falamos!" para dar resposta rápida
- [x] (B) Estancar com a mensagem de "estamos a trabalhar em resolver…", perceber o problema, e como é Web + bug, abrir ticket com urgência máxima e publicar no Slack Channel
- [ ] (C) Pedir logo reunião com um colega da equipa técnica antes de responder ao cliente
- [ ] (D) Ir ao Claude + ChatGPT + Net procurar a solução antes de responder ao cliente

Aula 3.4 — Criação de tickets de web design

Q21 [multi] Quando vamos criar um ticket de web design devemos sempre:
- [x] Verificar quem é o designer com menos tasks Not Started
- [x] Verificar quem é o designer com menos tasks In Progress
- [ ] Verificar quem é o designer com mais tasks Done
- [x] Explicar e numerar ao máximo as secções que a nova página deve ter
- [ ] Escolher sempre o designer que está mais habituado ao projeto em questão
- [ ] Todas as anteriores

Q22 [vf] Quando vou criar um ticket de web design e todos os designers estão em equilíbrio devo selecionar aquele que está mais habituado ao cliente em questão (branding, tom, etc.). → V

Q23 [vf] Quando vou criar um ticket de web design é a minha responsabilidade total atribuir o ticket ao web designer com menos tarefas para obter o design/resposta o mais rápido possível de forma efetiva. → V

Q24 [vf] No título do ticket de web design devo escrever sempre o nome do cliente no título sem falta. → F

Q25 [vf] É a minha total responsabilidade deixar no fundo da página do cliente na app os acessos todos que temos do cliente. → V

---

## Módulo 4 — Auditoria Técnica e Keyword Research

Objetivo: saber diagnosticar um site (app WonderAds, ScreamingFrog) e construir a lista de keywords de um projeto com Semrush.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 4.1 | Website SEO Audit para boas práticas de SEO (APP WA) — Parte 1 | https://youtu.be/EmAfTeK96lM | B2 | Detalhes de design, técnicos, on-page, off-page, velocidade (André Pereira) | OK |
| 4.2 | Website SEO Audit para boas práticas de SEO — Parte 2 | — | B2 | Consultor por atribuir | A GRAVAR |
| 4.3 | ScreamingFrog | — | B2 | Fran R | A GRAVAR |
| 4.4 | Keyword Research │ Parte 1 | https://youtu.be/Z8OSZPVtHPE | B2 | João B | OK |
| 4.5 | Keyword Research │ Parte 2 | https://youtu.be/iBw6ZmZSZ4M | B2 | André Pereira | OK |
| 4.6 | Keyword Research │ Parte 3 — Semrush para a keyword research | https://youtu.be/-Y_232vvfhQ | B2 | André Pereira | OK |

### Quiz Módulo 4 (26 perguntas)

Aula 4.1 — Website SEO Audit (Parte 1)

Q1 [vf] Antes de gerar um SEO Audit, é fundamental que o cliente já tenha o formulário de onboarding preenchido, porque a ferramenta baseia-se nas respostas do próprio cliente para trazer resultados mais alinhados com o projeto. → V

Q2 [single] Antes de gerar o audit, o consultor deve verificar se as Live Tools estão a funcionar. O que acontece se alguma estiver a falhar?
- [ ] O audit é gerado na mesma sem qualquer alerta
- [x] Aparece normalmente um aviso com foco na Data for SEO, que é a ferramenta onde a app vai buscar a maioria dos dados
- [ ] A app bloqueia todo o departamento SEO até tudo estar restabelecido
- [ ] O consultor tem de reiniciar a app para as ferramentas voltarem a ligar

Q3 [single] Cenário: Vou correr o primeiro SEO Audit de um cliente novo. Qual é a configuração mais correta?
- [ ] Profundidade "All" + Focus "Technical Only", para ser mais rápido
- [x] Profundidade "All" + Focus "Everything" — para pegar tudo com segurança e ter uma visão geral, deixando focos específicos para momentos posteriores do projeto
- [ ] Profundidade "Deep" com limite máximo de 10 páginas + Focus "Content Only"
- [ ] Profundidade "Quick" + Focus "Everything", porque a app extrapola sozinha as restantes páginas

Q4 [multi] O campo de comentários no formulário do SEO Audit é opcional e serve para:
- [x] Sinalizar especificidades do cliente que ajudam a app a trazer pontos mais relevantes (ex.: troca recente de site, problemas de indexação conhecidos)
- [ ] Escrever a proposta comercial que vai ser enviada ao cliente
- [x] Registar contextos que não estão no onboarding form mas que valem a pena o audit considerar
- [ ] Publicar diretamente uma nota pública na homepage do cliente
- [ ] Definir o preço da mensalidade de SEO do cliente

Q5 [vf] Uma vez gerado o audit, este devolve, entre outros, um Authority Score, dados de velocidade do site, dados de visibilidade e as keywords que o cliente já tem a rankear e que mais trazem acessos. → V

Q6 [single] O overview detalhado no final do report vem por defeito em inglês. Como é que o consultor pode adaptá-lo para enviar ao cliente português?
- [ ] Copiar o texto para o Google Translate manualmente
- [x] Usar o campo "Adjust Result" no final do SEO Audit (que traz bons exemplos, incluindo tradução para português de Portugal) e a app reescreve tudo já traduzido
- [ ] Pedir ao departamento de design para traduzir o PDF antes de enviar
- [ ] Enviar em inglês mesmo, porque o cliente aceita sempre

Aula 4.4 — Keyword Research (Parte 1)

Q7 [vf] A Keyword Research na app da WonderAds encontra-se em Overall SEO > Keyword Research, e lê automaticamente o onboarding form do cliente para trazer informação inicial antes de o consultor preencher os campos adicionais. → V

Q8 [single] Ao preencher a Keyword Research na app, o campo "Comments or Additions" serve para:
- [ ] Adicionar apenas informação técnica sobre o site (velocidade, indexação, plugins)
- [x] Adicionar detalhes que o cliente não colocou no onboarding form mas que surgiram em conversas/reuniões posteriores, para o output ficar mais próximo do que o cliente quer e reduzir alterações depois
- [ ] Escrever o roadmap dos próximos 6 meses
- [ ] Deixar em branco, porque o Claude já sabe tudo pelo onboarding form

Q9 [single] Qual é o número ideal de keywords que devemos ter definidas por projeto para investir bem os recursos e alcançar resultados rápidos?
- [ ] 10 keywords
- [x] 25 keywords
- [ ] 50 keywords
- [ ] 100 keywords
- [ ] Não há número ideal — quantas mais, melhor

Q10 [single] Nos projetos com garantias (top 3 para pelo menos 3 keywords), o que devemos fazer na hora de selecionar as keywords?
- [ ] Escolher apenas keywords de altíssimo volume, mesmo que sejam difíceis de ranquear
- [x] Adicionar 5-6 quick wins — keywords em que o cliente já está a rondar o top 8-15, que com alguns blog posts e alterações ao site conseguem subir posições rapidamente
- [ ] Escolher só keywords que já estão no top 3, para garantir o cumprimento da garantia sem trabalho adicional
- [ ] Ignorar a garantia porque não há forma de a assegurar sem sorte

Q11 [single] Cenário: Estou a fazer keyword research para um cabeleireiro com salões em várias localizações. Aparece a keyword "balayage" com 8.100 pesquisas e dificuldade fácil, mas o volume está a vir maioritariamente dos Estados Unidos. Devo:
- [ ] Adicionar "balayage" à lista mesmo assim, porque 8.100 pesquisas é um volume forte
- [x] Verificar a seleção de localização no Semrush (que estava mal), analisar variantes locais como "balayage Sesimbra" ou "balayage Viseu" alinhadas com as localizações reais dos salões, e adicionar essas
- [ ] Excluir a keyword sem procurar variantes, porque volume vindo dos EUA não interessa
- [ ] Adicionar as duas — a original e as variantes locais — para "cobrir" ambos os públicos

Q12 [multi] Sobre o fluxo correto para validar as sugestões de keywords devolvidas pelo Claude:
- [x] Passar cada keyword sugerida pelo Semrush para ver volume real e dificuldade
- [x] Priorizar keywords com maior volume e menor dificuldade
- [x] Analisar variantes de keywords no Semrush para encontrar opções semelhantes ao que o cliente quer mas mais alcançáveis
- [x] Selecionar 30 a 40 keywords antes da revisão final (porque o cliente vai pedir para retirar/adicionar algumas até chegar às 25)
- [ ] Confiar 100% no output do Claude e aprovar tudo em bloco sem passar pelo Semrush
- [x] Guardar sempre o documento da keyword research, porque o consultor vai precisar de voltar lá para adicionar/retirar keywords a pedido do cliente
- [ ] Ignorar a localização das pesquisas do Semrush, uma vez que o volume total é o único indicador importante

Q13 [single] Depois de adicionar as keywords selecionadas ao sistema (com a possibilidade de guardar variantes junto de cada uma), o próximo passo é:
- [ ] Publicar diretamente no site do cliente as páginas otimizadas para essas keywords
- [x] Clicar em Aprovar, o que envia automaticamente para a tabela Pending Review para o cliente poder deixar comentários ou pedir alterações
- [ ] Enviar por email ao cliente um PDF com a lista, esperando que ele imprima e assine
- [ ] Guardar internamente sem partilhar até à próxima reunião mensal

Aula 4.5 — Keyword Research (Parte 2)

Q14 [single] O número de keywords a selecionar para o foco do projeto depende do tamanho do cliente. Quantas keywords devemos selecionar para cada tipo de projeto?
- [ ] Light: 10 / Core: 15 / Growth: 20
- [x] Light: 15 / Core: 20 / Growth: 25
- [ ] Light: 20 / Core: 25 / Growth: 30
- [ ] Light: 25 / Core: 25 / Growth: 25 (o mesmo número para todos)

Q15 [single] Porque é que o número de keywords não deve exceder as médias definidas por tipo de projeto (Light/Core/Growth)?
- [ ] Porque o Google penaliza sites que tentam ranquear para muitas keywords ao mesmo tempo
- [x] Porque o número está alinhado com as horas de trabalho disponíveis para cada projeto, garantindo foco e entrega real
- [ ] Porque o Semrush não deixa monitorizar mais do que 25 keywords em simultâneo
- [ ] Porque o cliente paga por keyword monitorizada

Q16 [single] Cenário: Estou a fazer a Keyword Research de um cliente novo em Vila Nova de Gaia. O onboarding form já foi lido automaticamente pela app, mas o cliente reforçou 3 keywords prioritárias por WhatsApp e, em conversa, disse que quer priorizar um serviço específico como venda interna. Devo:
- [ ] Ignorar a informação do WhatsApp porque não está no onboarding form oficial
- [x] Reforçar as keywords prioritárias no campo Additional Focus, definir o Geotarget para Porto, deixar todas as intenções de pesquisa ativas e adicionar comentários alinhados com o foco de venda interna do cliente antes de gerar
- [ ] Definir Geotarget para Portugal inteiro para "cobrir mais chão", e ignorar o serviço que o cliente quer priorizar internamente
- [ ] Gerar primeiro sem preencher nada e só depois ajustar os campos, para comparar os dois outputs

Q17 [single] Uma vez selecionadas as keywords no report e enviadas para aprovação (Pending Review), o passo seguinte, depois da validação do cliente, é:
- [ ] Publicar automaticamente as páginas otimizadas para essas keywords
- [x] Selecionar as keywords aprovadas e clicar em "Send it to Track", para começarem a ser monitorizadas como as palavras-chave de foco do projeto de SEO
- [ ] Enviar as keywords ao cliente por email para ele monitorizar manualmente
- [ ] Guardar as keywords localmente e revisitar apenas na renovação daí a 6 meses

Q18 [vf] A seleção de keywords feita agora é definitiva até ao fim do contrato e não pode ser revisitada, para manter a consistência da estratégia. → F

Aula 4.6 — Keyword Research (Parte 3 — Semrush)

Q19 [single] Cenário: Estou a analisar um cliente novo (Medway) no Semrush pela primeira vez. Depois de meter o domínio, qual é o primeiro cuidado que devo ter antes de olhar para os dados?
- [ ] Escolher a base de dados global, para ter a maior amostra possível de keywords
- [x] Definir a localização do país do cliente (ex.: Portugal) antes de fazer o search, para os dados serem representativos
- [ ] Ignorar a localização, porque o Semrush deteta automaticamente pela extensão .pt do domínio
- [ ] Meter a localização do concorrente principal, para comparar diretamente

Q20 [single] Dentro do Domain Overview do Semrush, para ver o histórico de posições orgânicas do cliente ao longo do tempo, o consultor deve ir a:
- [ ] Backlinks > Referring Domains
- [x] Organic Rankings > Positions
- [ ] Traffic Analytics > Sources
- [ ] Site Audit > Issues

Q21 [vf] O gráfico de barras em Organic Rankings > Positions permite navegar pelo histórico dos últimos meses (ex.: até 6 meses, 1 ou 2 anos) e ao clicar num mês específico mostra as keywords que estavam a rankear nesse mês. → V

Q22 [single] Na aba Organic Rankings > Positions, algumas keywords aparecem sem posição atribuída, com um símbolo específico de uma estrela de quatro pontas. O que representam essas keywords?
- [ ] Keywords que o Semrush ainda não conseguiu processar
- [ ] Keywords bloqueadas pelo Google por serem sensíveis
- [x] Respostas em IA — keywords para as quais o cliente pode estar a aparecer em respostas geradas por AI
- [ ] Keywords que o cliente comprou em Google Ads
- [ ] Keywords em que o cliente aparece em 1.º no Google Maps (GMB)

Q23 [single] Cenário: Estou a analisar o Organic Rankings do Medway. Quero encontrar oportunidades rápidas para o cliente (quick wins). Uma tática eficaz é:
- [ ] Filtrar por posições 1 a 3 para ver onde já estamos bem e reforçar
- [x] Filtrar por posições 11 a 20 — keywords que estão na 2.ª página do Google e que com pouco trabalho conseguem passar para a 1.ª página
- [ ] Filtrar por posições 50+ para atacar o que ainda tem espaço de crescimento
- [ ] Filtrar apenas as keywords com volume acima de 10.000

Q24 [single] O consultor está a validar/enriquecer a lista de keywords do cliente e quer explorar variações e ideias novas em torno de uma keyword específica (ex.: "Invisalign"). Qual ferramenta do Semrush deve usar?
- [ ] Backlink Analytics
- [ ] Site Audit
- [x] Keyword Magic Tool
- [ ] Position Tracking

Q25 [single] O que devolve o filtro Phrase Match dentro do Keyword Magic Tool, e porque é útil?
- [ ] Devolve apenas a keyword exata pesquisada, sem variações — útil para medir volume real
- [x] Devolve keywords que contêm a frase pesquisada, muitas vezes long tail e mais fundo de funil, com menos volume mas de pessoas que já estão a pesquisar com intenção mais clara (pode ser usado para blogs por exemplo)
- [ ] Devolve apenas keywords em inglês, mesmo que o país esteja definido como Portugal
- [ ] Devolve as keywords onde o cliente aparece em 1.º lugar no Google

Q26 [multi] Quais são as 3 ferramentas do Semrush recomendadas para trabalhar a keyword research de um cliente?
- [x] Keyword Magic Tool
- [x] Domain Overview
- [x] Organic Rankings (Positions)
- [ ] Backlink Gap Analysis
- [ ] Site Audit
- [ ] Social Media Poster

Sem perguntas: aulas 4.2 e 4.3 (a gravar).

---

## Módulo 5 — Roadmap e Onboarding de Cliente Novo

Objetivo: transformar auditoria e research num roadmap, preparar e conduzir a onboarding call, e deixar o cliente configurado (Searchable, GA4).

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 5.1 | Como fazer um SEO Roadmap inicial e checklists | https://youtu.be/zdL3DcOkpCM | CD | Tem docs a anexar por baixo do vídeo | OK |
| 5.2 | Como fazer uma primeira reunião de parceria (onboarding) e gerir expectativas de timings/aprovações | https://youtu.be/IUoZxz4RRg0 | COM | Anexar: [Guidelines Pré-Onboarding Call │ WonderAds SEO/GEO DPT](https://docs.google.com/document/d/1tA3u3ir4N1hKYRwwi1MrIdj4dZVM5qcFtkoyxIDddO8/edit?usp=sharing). Materiais a trazer: Site Audit, Keyword Research, Roadmap Client, acessos Site/GMB/GA4/GSC, fotos. Protocolos: WhatsApp ativo, Weekly Updates, Monthly Report + call | OK |
| 5.3 | Actual Call: Onboarding call de um cliente novo por um consultor | https://youtu.be/T97p9o6m9JE | COM | — | OK |
| 5.4 | Como dar setup de um cliente novo no searchable.com (Searchable Parte 1) | https://youtu.be/kzbSFY35bUk | CD | — | OK |
| 5.5 | Como criar os eventos no GA4 do cliente para tracking correto | https://youtu.be/7SX3As-Uwy8 | CD | — | OK |

### Quiz Módulo 5 (37 perguntas)

Aula 5.1 — Roadmap de SEO e GEO

Q1 [vf] Apenas os projetos maiores (Growth e Core) devem ter um projeto criado no Claude da empresa (seo@wonder-ads.com). → F

Q2 [vf] O Claude da empresa deve ter sempre o onboarding form do cliente guardado na memória. → V

Q3 [vf] É minha total responsabilidade como consultor SEO/GEO ter os meus projetos todos com os blocos "DO's, DONT's e NOTES" preenchidos de acordo com o que o cliente gosta/deixa fazer, não gosta/não deixa fazer e apontamentos do projeto respetivamente. → V

Q4 [vf] Quando o Claude me dá feedback sobre os Do's, Dont's e Notes de um projeto, eu já não preciso de verificar o onboarding form. → F

Q5 [single] Todos os acessos a GA4, GSC, GMB, etc. devem estar na seguinte conta:
- [ ] meu-nome@wonder-ads.com
- [ ] info@wonder-ads.com
- [ ] acessos@wonder-ads.com
- [x] seo@wonder-ads.com
- [ ] Todas as anteriores

Q6 [single] O preenchimento e construção com qualidade de um roadmap deve levar no mínimo:
- [ ] 30 min.
- [ ] 1 hora
- [x] 2 horas
- [ ] 3 horas

Q7 [vf] O roadmap, briefing de DO's, Dont's, Notes, keywords, etc. para uma reunião de onboarding é essencial ter tudo pronto pelo menos 24 horas antes da reunião. → V

Q8 [single] Cenário: tenho reunião de onboarding na sexta-feira às 11:00, devo ter tudo pronto no máximo (limite) na:
- [ ] Segunda-feira às 23:00
- [ ] Terça-feira às 23:00
- [ ] Quarta-feira às 11:00
- [x] Quinta-feira às 11:00

Q9 [vf] Todos os roadmaps devem seguir para aprovação de um superior ou colega como protocolo na WonderAds. → V

Q10 [vf] Um roadmap de SEO e GEO deve ser construído apenas com base no que a concorrência está a fazer, copiando as suas estratégias para garantir resultados equivalentes. → F

Q11 [multi] Antes ou durante a construção do roadmap de um cliente novo, é minha total responsabilidade:
- [x] (A) Analisar o onboarding form do cliente
- [x] (B) Fazer keyword research alinhado com os serviços/nicho do cliente
- [x] (C) Analisar os concorrentes diretos (SEO tradicional e visibilidade em AIs)
- [ ] (D) Perguntar ao cliente qual é o preço que ele acha justo cobrar
- [x] (E) Verificar o estado técnico atual do site (indexação, velocidade, mobile)
- [ ] (F) Ver o roadmap de um cliente do mesmo nicho para poupar tempo

Q12 [vf] O roadmap de GEO (Generative Engine Optimization) é opcional e só deve ser feito se o cliente pedir especificamente para aparecer em ChatGPT, Perplexity ou outras AIs. → F

Q13 [single] Cenário: Vou fazer o roadmap de um cliente novo de uma clínica dentária no Porto. Devo:
- [ ] (A) Definir logo 50 target keywords
- [x] (B) Analisar onboarding form, fazer keyword research (SEO + prompts em AIs via Searchable), estudar concorrentes locais, definir target keywords com o cliente, e só depois estruturar ações mensais com priorização
- [ ] (C) Focar apenas em backlinks nos primeiros 3 meses porque é o que dá resultado mais rápido em grandes cidades
- [ ] (D) Copiar o roadmap de outra clínica dentária no Porto que já tenho na carteira e ajustar o nome

Q14 [vf] No roadmap devo sempre priorizar as ações que trazem quick wins nos primeiros meses (ex.: otimização de páginas já existentes, GMB, correções técnicas) antes de partir para ações de longo prazo como blog em massa e link building agressivo. → V

Q15 [vf] Um consultor de SEO na Wonder tem total responsabilidade no roadmap que apresenta e daí trazer resultados, daí ser importante ser feito com qualidade. → V

Q16 [vf] O roadmap deve ser um documento fixo e nunca mais ser mexido depois de aprovado pelo cliente para manter a consistência da estratégia até ao fim. → F

Q17 [vf] É muito importante verificar o website do cliente para verificar páginas que precisam de atenção de design, bugs, velocidades, etc. para além de usar o Claude. Dá-se sempre preferência à qualidade na elaboração dos roadmaps em vez de preferência à velocidade. Um bom roadmap leva tempo para ser montado para os próximos meses. → V

Aulas 5.2–5.3 — Preparar a pré-onboarding call de cliente novo

Q18 [vf] Para uma reunião de onboarding, basta o consultor levar o Roadmap Client pronto, porque os restantes materiais (Do's/Dont's/Notes, Site Audit, Keyword Research) podem ser trabalhados no decorrer do primeiro mês de parceria. → F

Q19 [multi] Quais dos seguintes materiais devem estar prontos para rever na reunião de onboarding?
- [x] Do's, Dont's, Notes
- [x] Site Audit
- [x] Keyword Research
- [x] Roadmap Client
- [ ] Weekly Report da primeira semana
- [ ] Contrato assinado pela administração
- [ ] Documento de overview dos últimos 6 meses

Q20 [vf] A keyword research pode ser deixada para ser feita ao vivo com o cliente na própria onboarding call, para envolver o cliente na escolha das keywords desde o início. → F

Q21 [single] Qual destes acessos NÃO faz parte da lista obrigatória que devemos pedir e registar na app caso o cliente ainda não tenha fornecido?
- [ ] Acesso ao Site Cliente
- [ ] Acesso ao GMB Cliente
- [x] Acesso à CRM do Cliente
- [ ] Acesso ao GA4 Cliente
- [ ] Acesso ao GSC Cliente

Q22 [multi] Quais são os acessos e materiais que devemos pedir e registar na app caso o cliente ainda não os tenha fornecido?
- [x] Acesso Site Cliente
- [x] Acesso GMB Cliente
- [x] Acesso GA4 Cliente
- [x] Acesso GSC Cliente
- [x] Fotos/Materiais
- [ ] Acesso ao Instagram e Facebook do cliente
- [ ] Acesso à conta bancária do cliente para faturação
- [ ] Palavra-passe do domínio no registrar

Q23 [vf] As Fotos/Materiais do cliente são opcionais de pedir no arranque do projeto, uma vez que podemos sempre gerar imagens via IA e recorrer a bancos de imagens da internet (Envato Elements). → F

Q24 [single] Segundo os protocolos que devemos mencionar sem falta na onboarding call, os Weekly Updates são enviados ao cliente no WhatsApp:
- [ ] Todas as segundas-feiras
- [ ] Todas as quartas-feiras
- [x] Todas as sextas-feiras
- [ ] Todos os primeiros dias úteis da semana
- [ ] Apenas quando haja novidades relevantes para reportar

Q25 [vf] Nos protocolos apresentados na onboarding call devemos deixar claro ao cliente que preferimos comunicação exclusivamente por email, para manter tudo registado por escrito e evitar mensagens de WhatsApp fora de horas. → F

Q26 [vf] É obrigatório mencionar ao cliente na onboarding call que precisamos de aprovações e resposta pelo menos todas as semanas. → V

Q27 [single] Segundo os protocolos a mencionar sem falta na onboarding call, qual é a frequência mínima de reporting formal + call com o cliente?
- [ ] Weekly Report + 1x Call por semana
- [ ] Bi-Weekly Report + 1x Call por mês
- [x] Monthly Report + 1x Call (pelo menos) por mês
- [ ] Monthly Report entregue apenas em vídeo Loom, sem call
- [ ] Daily update + Monthly Call

Q28 [multi] Quais dos seguintes protocolos devem ser mencionados sem falta ao cliente na reunião de onboarding?
- [x] Precisamos de aprovações e resposta pelo menos semanalmente
- [x] WhatsApp ativo todos os dias e preferimos que nos liguem mal haja dúvidas
- [x] Enviamos Weekly Updates no WhatsApp todas as sextas-feiras
- [x] Monthly Reporting e 1x Call (pelo menos)
- [ ] Vamos publicar posts no GMB sem necessidade de aprovação prévia
- [ ] O cliente é responsável por fazer o site audit uma vez por trimestre
- [ ] Todas as reuniões futuras serão gravadas apenas se o cliente autorizar caso a caso

Q29 [vf] Os Do's, Dont's e Notes só precisam de estar preenchidos depois da onboarding call, com base no que for discutido na própria reunião com o cliente. → F

Q30 [single] Cenário: Tenho reunião de onboarding com um cliente novo daqui a 3 dias. O cliente ainda não me enviou os acessos ao GMB nem ao GA4, e eu ainda não fiz keyword research. Devo:
- [ ] Ir para a reunião assim mesmo e pedir os acessos + falar sobre keywords ao vivo com o cliente, para poupar tempo
- [ ] Adiar a reunião de onboarding até o cliente enviar todos os acessos em falta
- [x] Pedir imediatamente os acessos em falta e registá-los na app assim que chegarem; fazer a keyword research antes da reunião; ter Do's/Dont's/Notes, Site Audit e Roadmap Client prontos para rever na reunião
- [ ] Fazer uma keyword research superficial só com base nas keywords óbvias do site e apresentar o resto no primeiro weekly report

Q31 [vf] Na onboarding call podemos deixar claro que o cliente pode responder às nossas aprovações quando lhe for conveniente, desde que garanta pelo menos uma resposta por mês. → F

Q32 [single] Cenário: Estou a preparar a onboarding call de um cliente novo de uma clínica dentária. Já tenho o Site Audit e o Roadmap Client prontos, mas ainda não preenchi os Do's/Dont's/Notes nem fiz keyword research. Devo:
- [ ] Ir para a reunião com o que tenho, uma vez que Site Audit e Roadmap são os dois documentos que estruturam a call
- [x] Preencher os Do's/Dont's/Notes com base no onboarding form do cliente + fazer keyword research alinhada com o nicho antes da reunião — os 4 documentos (Do's/Dont's/Notes, Site Audit, Keyword Research, Roadmap Client) têm que estar prontos para rever
- [ ] Fazer apenas a keyword research; os Do's/Dont's/Notes podem ser preenchidos ao longo do primeiro mês de parceria
- [ ] Pedir ao cliente para ele próprio começar a reunião a preencher os Do's/Dont's/Notes connosco em direto

Aula 5.4 — Setup de cliente novo no Searchable (Parte 1)

Q33 [multi] Quais destes campos são obrigatórios no setup do Searchable?
- [x] Tom de Voz/Writing Style
- [x] Memory/Memória
- [x] Onboarding Form Uploaded
- [x] Competidores
- [x] Zona Regional do Business
- [ ] Cor preferida do logotipo do cliente
- [ ] Nome do animal de estimação do CEO
- [ ] Fuso horário do gestor de conta
- [ ] Palavra-passe do Instagram do cliente

Q34 [multi] Quais destes passos fazem parte do fluxo correto de setup?
- [x] Fazer upload do onboarding form antes de configurar campos
- [x] Preencher Tom de Voz com base no material do cliente
- [x] Validar competidores com o cliente antes de guardar
- [x] Definir Zona Regional do Business
- [ ] Ativar o Searchable sem preencher memória
- [ ] Copiar o setup de outro cliente sem adaptar
- [x] Confirmar que todos os campos obrigatórios estão preenchidos antes de dar o setup como concluído

Q35 [vf] O Searchable tem que ser sempre preenchido e é obrigatório ter setup e ativo para todos os meus projetos. → V

Q36 [vf] O setup do Searchable pode ser efetuado sem darmos upload do onboarding form do cliente. → F

Q37 [multi] O que acontece se o Searchable for usado num projeto sem estar corretamente configurado no início?
- [x] O output pode não refletir o tom do cliente
- [x] Podem aparecer referências a competidores errados ou inexistentes
- [x] A comunicação pode falhar culturalmente para a região do cliente
- [ ] O Searchable corrige-se automaticamente sozinho
- [ ] O cliente não nota diferença nenhuma
- [x] Perde-se consistência entre entregas do mesmo projeto

Sem perguntas: aula 5.5 (GA4).

---

## Módulo 6 — On-Page SEO

Objetivo: otimizar uma página existente ponto a ponto com as actions da app WonderAds.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 6.1 | Header Tags — Como estruturar H1/H2/H3 e gerar com a action da app | https://youtu.be/rm-xN5LqnJA | B2 | Manuel S | OK |
| 6.2 | Meta Titles & Descriptions — boas práticas + action da app | https://youtu.be/DKdcn0N9sWY | B2 | Manuel S | OK |
| 6.3 | Image Alt Text — como gerar alt text SEO-friendly + action da app | https://youtu.be/bl5KVi8IKaA | B2 | André Pereira | OK |
| 6.4 | Internal Linking — estratégia de linking interno + action da app | https://youtu.be/1ku2t6Sp5sQ | B2 | André Pereira | OK |
| 6.5 | Schema Markup com boas práticas SEO | https://youtu.be/uvW5_gObUN4 | B2 | Fran R | OK |

### Quiz Módulo 6 (31 perguntas)

Aula 6.1 — Header Tags

Q1 [vf] Numa página bem estruturada podemos ter mais do que um H1, desde que cada H1 introduza um tema principal diferente dentro da mesma página. → F

Q2 [vf] Ao estruturar os headers de uma página é aceitável saltar de um H2 diretamente para um H4 sempre que o subtema seja demasiado específico para justificar um H3. → F

Q3 [single] Qual é o intervalo de caracteres recomendado para o H1 (título da página)?
- [ ] 30 a 40 caracteres
- [ ] 50 a 60 caracteres
- [x] 60 a 70 caracteres
- [ ] 70 a 90 caracteres
- [ ] Não há limite, desde que contenha as target keywords

Q4 [multi] Sobre as keywords e estrutura dos headers, seleciona todas as afirmações corretas:
- [x] O H1 deve conter keywords para chamar a atenção
- [x] Os H2 podem ou não incluir keywords, desde que sejam frases bem estruturadas
- [x] Os H3, H4 e H5 devem ser mais diretos ao ponto, entre 30 a 40 caracteres
- [ ] Todos os headers (H1 a H6) têm obrigatoriamente que conter a keyword primária exata
- [x] Os H2 devem ter entre 50 a 60 caracteres
- [ ] Os H1 devem ser sempre mais curtos que os H3 para não distrair o leitor

Q5 [single] Cenário: Estou a montar uma página nova para um cliente e a estrutura atual é: 1x H1 → 3x H2 → dentro do 2.º H2 salto para 2x H4 (sem H3) → depois um H2 final. A extensão Detailed SEO confirma esta contagem. Devo:
- [ ] Manter assim, porque o importante é que haja apenas um H1 e que os subtítulos existam
- [x] Corrigir a hierarquia: os H4 dentro do 2.º H2 têm que passar a H3 (ou ser precedidos por um H3), porque não se pode saltar níveis na hierarquia de headers
- [ ] Transformar os H4 em H2 para "elevar" a importância desses subtemas
- [ ] Adicionar um segundo H1 antes dos H4 para justificar o salto de nível

Q6 [vf] Para gerar a estrutura de headers de uma página nova, o consultor deve usar a action própria da APP da WonderAds em vez de escrever os headers manualmente à mão a partir do zero. → V

Aula 6.2 — Meta Titles & Descriptions

Q7 [vf] Os meta tags são conteúdos HTML visíveis no topo da página, que aparecem em bold para o utilizador logo que este entra no site. → F

Q8 [single] Qual é o limite de caracteres recomendado para o meta title?
- [ ] Até 40 caracteres
- [x] Até 60 caracteres
- [ ] Entre 90 a 110 caracteres
- [ ] Entre 150 a 160 caracteres
- [ ] Não há limite, desde que contenha a keyword principal

Q9 [single] Qual é o intervalo de caracteres recomendado para a meta description?
- [ ] 30 a 60 caracteres
- [ ] 60 a 90 caracteres
- [ ] 100 a 130 caracteres
- [x] 150 a 160 caracteres
- [ ] Acima de 200 caracteres, para dar mais contexto ao Google

Q10 [multi] Sobre boas práticas de meta titles e descriptions, seleciona todas as afirmações corretas:
- [x] A keyword principal deve estar no começo do meta title
- [x] A meta description deve conter as keywords que queremos rankear/dar ênfase
- [x] Quando o utilizador pesquisa pela keyword, esta aparece em bold dentro da description no Google
- [ ] O meta title e a meta description devem ser sempre iguais para reforçar a keyword
- [x] É boa prática espalhar o máximo de keywords no meta title e description, desde que fique legível para o utilizador
- [ ] A meta description tem que estar visível dentro do corpo da página, no início do primeiro parágrafo

Q11 [single] Cenário: Vou criar/otimizar os meta titles e descriptions de um cliente novo, uma clínica dentária cujo foco principal é implantologia. Devo:
- [ ] Escrever os metas manualmente à mão para cada página, para garantir qualidade
- [x] Ir ao departamento SEO na app → cliente → click actions → tab "MetaTitles e MetaDescriptions", inserir o URL, escolher a quantidade de páginas a otimizar (10/25/50) e o focus word "implantologia" para gerar
- [ ] Pedir ao cliente que ele próprio escreva os meta titles e descriptions
- [ ] Copiar os meta titles e descriptions do concorrente principal do cliente e adaptar o nome

Q12 [vf] O meta title e a meta description são conteúdos que ficam dentro do `<head>` da página, não visíveis no corpo da página, mas que o Google e o utilizador leem antes de clicarem no resultado da pesquisa. → V

Aula 6.3 — Image Alt Text

Q13 [vf] O alt text é um conteúdo que aparece visível por baixo da imagem no website, servindo como legenda para o utilizador. → F

Q14 [multi] Para que serve o alt text?
- [x] Acessibilidade para utilizadores que não conseguem ver a imagem
- [x] Ranqueamento da imagem no Google Imagens
- [ ] Aumentar o tempo médio de carregamento da página
- [x] Permitir ao Google perceber o conteúdo/contexto da imagem
- [ ] Substituir a meta description da página onde a imagem está inserida
- [x] Reforçar a keyword-alvo da página quando faz sentido

Q15 [vf] O alt text deve conter apenas a keyword primária da página, sem descrição, para não diluir o ranqueamento. → F

Q16 [single] Cenário: Estou a otimizar as imagens de uma página de serviço "Cirurgia à Ciática" de uma clínica de coluna. Uma das imagens mostra o Dr. em consulta com um paciente a apontar para uma zona lombar num modelo anatómico. O alt text mais correto é:
- [ ] "imagem1.jpg"
- [ ] "ciatica ciatica cirurgia ciatica coluna ciatica" (packed com a keyword)
- [x] "Médico especialista a explicar cirurgia à ciática a paciente em consulta na clínica"
- [ ] "Foto profissional tirada no consultório" (descrição sem keyword)

Q17 [single] Qual é a melhor forma de verificar rapidamente o alt text de uma imagem específica numa página?
- [ ] Ir ao GA4 e filtrar por imagens
- [x] Clicar com o botão direito na imagem → Inspecionar, e ler o atributo alt no código HTML
- [ ] Fazer download da imagem e ver as propriedades no computador
- [ ] Perguntar ao cliente qual foi o alt text que ele definiu no upload

Q18 [vf] Numa imagem meramente decorativa/genérica (ex.: um selo ou ícone que não tem relação direta com um serviço específico), é boa prática forçar sempre uma keyword da página no alt text, mesmo que fique fora de contexto. → F

Aula 6.4 — Internal Linking

Q19 [single] O que é um link interno?
- [ ] Um link de outro site externo que aponta para o site do cliente
- [x] Um link entre páginas do mesmo site (categoria para categoria, tópico para tópico, ou para a homepage)
- [ ] Um link partilhado nas redes sociais do cliente que direciona para o site
- [ ] Um link no rodapé que aponta para o site do web designer

Q20 [multi] Para que servem os links internos?
- [x] Distribuir a autoridade do site pelas várias páginas
- [x] Facilitar aos bots do Google fazer uma leitura completa do site através de vários caminhos
- [x] Reforçar o SEO da página ao conectar conteúdos relacionados
- [ ] Substituir a necessidade de backlinks externos
- [ ] Diminuir intencionalmente o tempo médio na página para melhorar o bounce rate
- [x] Ajudar o utilizador a explorar mais conteúdo relacionado dentro do site

Q21 [vf] Os links internos devem ser feitos exclusivamente da homepage para as páginas internas, nunca entre páginas de serviços do mesmo nível. → F

Q22 [single] Cenário: Estou a otimizar a página do serviço "Implantologia" de uma clínica dentária. No final da página quero adicionar internal linking. A abordagem mais correta é:
- [ ] Adicionar links para todas as páginas do site, incluindo "Política de Privacidade" e "Termos e Condições"
- [x] Adicionar links para outros tratamentos relacionados (ex.: "Cirurgia Oral", "Estética Dentária") e para a página "Agendar Consulta", em formato de botão ou dentro do texto
- [ ] Não adicionar internal links no final da página, uma vez que podem fazer o utilizador sair antes de chegar ao CTA
- [ ] Adicionar links apenas para páginas de blogs, nunca para outras páginas de serviço, para evitar canibalização

Q23 [vf] Os links internos só podem ser inseridos em formato de botão no final da página; não é boa prática colocá-los diretamente dentro do texto/parágrafo. → F

Aula 6.5 — Schema Markup

Q24 [vf] O Schema Markup é um bloco de código, no formato JSON-LD recomendado pelo Google, que descreve o conteúdo da página aos motores de busca e sistemas de IA, sendo uma camada invisível para o utilizador. → V

Q25 [multi] Quais são as três razões principais para implementar Schema Markup numa página?
- [x] Resultados enriquecidos no Google (estrelinhas, breadcrumbs, preço de receita/produto, etc.)
- [x] Definir a entidade — ajudar o Google a perceber que o site do cliente, a ficha do Google Business e o perfil noutro site são o mesmo negócio (e que tipo de negócio é)
- [x] Ser mais bem lido por sistemas de IA (ChatGPT e semelhantes leem melhor informação estruturada do que texto solto)
- [ ] Melhorar a velocidade de carregamento da página
- [ ] Substituir a necessidade de meta title e meta description

Q26 [single] Qual é a regra mais importante do Schema Markup, que se aplica a todos os campos e nunca deve ser violada?
- [ ] O esquema tem de estar sempre no topo do HTML da página, dentro do `<head>`
- [x] O esquema só pode descrever informação que está visível na página; colocar dados que não constam da página viola as diretrizes do Google e pode dar penalização
- [ ] O esquema tem obrigatoriamente de ser gerado à mão em JSON-LD, sem uso de ferramentas
- [ ] O esquema tem de ser atualizado todos os dias para o Google não desconfiar

Q27 [single] Ao gerar Schema Markup na app da WonderAds (SEO Actions > Schema Markup), qual é a opção que vem marcada por defeito no campo Schema Type e porquê?
- [ ] Article — porque a maioria das páginas são artigos de blog
- [ ] MedicalClinic — porque a maioria dos clientes é da área de saúde
- [x] auto @graph — porque uma página normalmente não é uma coisa só (um negócio + página web + breadcrumb + FAQ) e este modo identifica tudo, junta num único bloco e amarra as partes umas às outras como uma entidade só
- [ ] LocalBusiness — porque é o mais compatível com Google Maps

Q28 [single] Cenário: Estou a gerar o Schema Markup na app para a página de serviço de um cliente. Nos campos Market e Language vejo a opção "Autodetected". Devo:
- [ ] Substituir sempre por "Portugal" e "Português", porque a maioria dos clientes é PT
- [x] Deixar em Autodetected — a app deteta o endereço, telefone, domínio e idioma da própria página (não usa geolocalização de quem faz o crawl), o que funciona bem para clientes em várias geografias (verificar manualmente sempre)
- [ ] Deixar em branco, para o Google descobrir sozinho no crawl
- [ ] Meter o país onde eu estou fisicamente, para o Google validar a origem do crawl

Q29 [single] Cenário: Publiquei o Schema Markup na página. Como devo validar o resultado?
- [ ] Basta usar o Rich Results Test do Google — se passar aí, o código está correto
- [ ] Basta usar o Schema Markup Validator — se passar aí, os resultados enriquecidos vão aparecer
- [x] Usar sempre as duas ferramentas em conjunto — Rich Results Test (diz se gerou algum tipo de resultado enriquecido) e Schema Markup Validator (diz se o código está correto), porque uma pode passar e a outra pode falhar
- [ ] Não é necessário validar depois de publicar; a app garante a correção do output

Q30 [multi] Quanto ao local onde colar o bloco de Schema Markup na página, seleciona todas as afirmações corretas:
- [x] O Google aceita o bloco em qualquer parte do HTML da página; não tem obrigatoriamente de estar no topo
- [x] Colocar na própria página tem a vantagem de manter o esquema junto do conteúdo que ele descreve, o que ajuda quem depois for mexer na página a perceber que existe um esquema ali
- [x] Deve ser colado no widget HTML — nunca no editor de texto, porque o editor passa por um filtro que apaga o script ao salvar e o esquema desaparece sem aviso
- [ ] Deve ser colado no editor de texto porque é mais fácil de manter
- [ ] O Schema tem obrigatoriamente de ficar dentro da tag `<head>` da página, no topo do HTML
- [x] Pode ser colado na última secção da página, editando o widget HTML dessa secção

Q31 [single] Cenário: Depois de gerar o Schema na app e validar, o Rich Results Test aponta um erro em breadcrumbs, mas o Schema Markup Validator diz que está tudo correto. O elemento em causa não é essencial para esta página. Devo:
- [ ] Ignorar o Rich Results Test porque o Validator confirmou que o código está válido
- [ ] Reverter o Schema todo e não implementar nada até ao próximo sprint
- [x] Editar o esquema para retirar essa parte específica (breadcrumbs), publicar, dar refresh e voltar a correr ambas as ferramentas até estar tudo OK
- [ ] Publicar na mesma e abrir ticket ao Google Support a pedir esclarecimento

---

## Módulo 7 — Estratégia de Conteúdo

Objetivo: decidir o que escrever e quando, com base em dados (Searchable, Content Gap, Content Calendar).

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 7.1 | Como encontrar tópicos e prompts atualizados para dar target num cliente (Searchable Parte 2) | https://youtu.be/8POIya1_KtI | CD | — | OK |
| 7.2 | Content Gap Analysis — identificar gaps vs concorrência e transformar em backlog editorial | https://youtu.be/lTg5D-zgnIA | B2 | João B | OK |
| 7.3 | Content Calendar — como construir um calendário de postagens GMB/Blog | https://youtu.be/7mxDOE8f4BI | B2 | João B | OK |

### Quiz Módulo 7 (20 perguntas)

Aula 7.1 — Searchable Parte 2 (tópicos e prompts)

Q1 [vf] Por vezes usar a opção Seed Keywords no Searchable para encontrar prompts relevantes a dar target traz bons resultados para tópicos a abordar em artigos de blog. → V

Q2 [multi] Posso usar o Searchable para encontrar tópicos/temas relevantes para as target keywords que o cliente tem no projeto, usando esses tópicos e prompts para escrever:
- [x] Artigos Blog
- [x] FAQs
- [x] Landing Pages
- [ ] Propostas de Cross Sell
- [ ] E-Books
- [x] Blocos de Conteúdo para Páginas Existentes e Novas
- [ ] Documentação de DOs & Dont's

Q3 [vf] É minha total responsabilidade ter o Searchable setup logo nos primeiros dias de um cliente comigo/parceria para o track de resultados começar o quanto antes. → V

Q4 [vf] O Searchable é uma ferramenta adicional de SEO e portanto não é preciso ter em projetos mais pequenos. → F

Q5 [single] O Searchable deixou de funcionar e a plataforma atingiu um limite de pedidos. Devo fazer:
- [ ] Contactar o meu superior o mais rapidamente possível
- [ ] Mencionar à equipa
- [ ] Enviar email ao suporte da Searchable
- [x] Perguntar à equipa se é geral e, caso seja necessário, passar a limitação ao André

Q6 [vf] Devo sempre usar os prompts sugeridos pelo Searchable para escrever artigos/blocos com aqueles H1s. → V

Q7 [vf] Não é recomendado criar muito conteúdo no site do cliente usando os insights do Searchable e termos recomendados a abordar. → F

Q8 [vf] Antes de adicionar prompts ao Searchable devo validar com o cliente quais são os temas/dúvidas mais comuns dos clientes finais dele. → V

Aula 7.2 — Content Gap Analysis

Q9 [vf] Uma Content Gap Analysis serve para identificar tópicos e páginas que os concorrentes do cliente têm no site e o cliente não tem, para depois preencher essas lacunas com conteúdo próprio. → V

Q10 [vf] Antes de gerar uma Content Gap Analysis na app, o consultor pode ir direto à dashboard e clicar em Generate sem preencher os Do's, Dont's e Notes do projeto, uma vez que a IA consegue perceber sozinha o contexto do cliente. → F

Q11 [multi] Ao preencher a Content Gap Analysis na app da WonderAds (Departamento SEO > On-Page SEO > Content Gap Analysis), o consultor deve preencher:
- [x] Page or cluster topic — tema ou temas relacionados com o nicho do cliente
- [x] Competitor URLs — links dos concorrentes analisados
- [x] Target keywords que estão a ser priorizadas no momento (não é necessário adicionar todas)
- [x] Do's, Dont's e Notes do projeto preenchidos antes de gerar
- [ ] Preço médio dos produtos do cliente
- [ ] Data de aniversário do CEO do cliente
- [ ] Palavra-passe do WordPress do cliente

Q12 [single] Cenário: A Content Gap Analysis devolveu 30 tópicos que os concorrentes têm e o cliente não. Devo:
- [ ] Adicionar automaticamente os 30 tópicos ao roadmap do cliente para ganhar tempo
- [x] Escolher só os tópicos que chamam mais a atenção, abrir a página do concorrente para cada um e analisar se é longo/curto, simples/complexo e bem construído, para depois lançar algo 10x melhor
- [ ] Copiar exatamente o conteúdo do concorrente e publicar no site do cliente
- [ ] Ignorar o report porque 30 tópicos é demasiado para tratar num roadmap de 6 meses

Q13 [single] Sobre a intenção de pesquisa a manter no plano de conteúdo sugerido pela Content Gap Analysis, seleciona a afirmação mais correta:
- [ ] Devemos priorizar apenas conteúdo transacional, porque é o único que traz vendas
- [ ] Devemos priorizar apenas conteúdo informacional, porque é o único que aparece no ChatGPT e Gemini
- [x] Devemos manter um balanceamento entre transacional (vendas), informacional (visibilidade em AIs), navegacional (navegação interna do site) e local (trazer pessoas para a loja física ou zona do cliente)
- [ ] A intenção de pesquisa é irrelevante, o que importa é o volume de pesquisa da keyword

Q14 [single] Depois de o consultor validar os tópicos, prioridades e intenções sugeridas pela Content Gap Analysis, o passo seguinte é:
- [ ] Implementar todos os conteúdos internamente sem envolver o cliente, para acelerar o roadmap
- [x] Enviar o report analisado ao cliente, mostrando o que os concorrentes têm e ele não tem, para obter aprovação e avançar com as adições
- [ ] Publicar o conteúdo dos concorrentes no site do cliente sem informar
- [ ] Guardar o report para apresentar apenas na reunião de renovação daí a 6 meses

Aula 7.3 — Content Calendar

Q15 [vf] O Content Calendar é uma ferramenta dentro da app da WonderAds que serve para planear a postagem de conteúdo (blog posts e/ou GMB posts) do cliente ao longo do tempo. → V

Q16 [vf] Posso ir direto à dashboard do Content Calendar e clicar em Generate sem preencher primeiro os Do's, Dont's e Notes do projeto, uma vez que a IA da app já conhece o cliente por outros contextos anteriores. → F

Q17 [single] Cenário: Estou a preparar o Content Calendar da Brancóptica, que é um cliente novo cujo site NÃO tem conteúdo nenhum. Devo:
- [ ] Escolher monthly (1 post por mês) para não sobrecarregar o cliente com aprovações no arranque
- [ ] Escolher pelo menos weekly, porque é sempre a frequência ideal independentemente do estado do cliente
- [x] Escolher pelo menos bi-weekly (2x por semana), porque como o site não tem conteúdo convém postar de forma consistente e agressiva para começar a ganhar tração
- [ ] Não usar o Content Calendar até o cliente aprovar manualmente o primeiro artigo

Q18 [single] Cenário: Um cliente meu já tem 300-400 blog posts publicados e prefere fazer conteúdo super elaborado (qualidade acima de quantidade). Para este cliente devo:
- [ ] Escolher bi-weekly na mesma para manter a constância que o Google valoriza
- [x] Adaptar a frequência para monthly, porque o benefício de postar weekly não compensa quando o cliente prefere fazer conteúdo super elaborado
- [ ] Deixar o Claude decidir sozinho o time frame com base no histórico do site
- [ ] Copiar o time frame de outro cliente do mesmo nicho para poupar tempo

Q19 [single] Sobre a escolha dos dias da semana para publicar conteúdo, seleciona a afirmação MAIS correta:
- [ ] Publicar em dias aleatórios de cada semana, para o Google não perceber que existe um padrão automatizado
- [x] Manter datas constantes (ex.: 2.ª e 6.ª, ou 3.ª e 5.ª), porque o Google dá prioridade a mostrar páginas de sites ativos e constantes, e a IA evita referir posts antigos quando há conteúdo mais recente sobre o mesmo tema noutros sites
- [ ] Concentrar todos os posts do mês no último dia útil, para o Google indexar tudo de uma vez
- [ ] Escolher o dia consoante a disponibilidade do consultor em cada semana, sem regra fixa

Q20 [multi] Quais destes passos fazem parte do fluxo correto de criação e implementação do Content Calendar?
- [x] Preencher primeiro os Do's, Dont's e Notes do projeto antes de gerar
- [x] Selecionar o timeframe (1, 3 ou 6 meses) e os temas cluster do cliente
- [x] Escolher a frequência (weekly, bi-weekly, monthly) consoante o estado atual de conteúdo e o perfil do cliente
- [ ] Publicar automaticamente o output do Claude no site do cliente sem revisão nem aprovação
- [x] Analisar com os próprios olhos o output do Claude, porque a IA comete erros e não se corrige sozinha se não lhe pedirmos
- [x] Enviar para approval via docs; se o cliente pedir alterações, fazer no doc, alterar, e voltar a enviar para approval
- [x] Depois de aprovado, criar as tasks no roadmap com o título específico do blog/GMB post (ex.: "Criação de blog — Lentes de Contacto: Guia de Adaptação com Optometrista")
- [ ] Colocar tasks genéricas do tipo "criação de artigos para o site" no roadmap para poupar tempo

---

## Módulo 8 — Produção e Otimização de Conteúdo

Objetivo: escrever, publicar e renovar conteúdo com qualidade SEO/GEO usando a app.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 8.1 | Como criar um artigo otimizado SEO-wise na APP Central da WonderAds — Parte 1 (APP) | https://youtu.be/-bdNcJ-lJJo | CD | — | OK |
| 8.2 | Como publicar os artigos blog da app e páginas SEO em HTML (UX 10/10) — Parte 2 | https://youtu.be/6B_u_9zBqvY | CD | Anexar ficheiros enviados pelo André + copy box para copiar e colar | OK |
| 8.3 | FAQ Section Generator — como criar FAQ com Google e IA | https://youtu.be/lLGlEIKMKV4 | B2 | Fran R | OK |
| 8.4 | Content Refresh — como otimizar e renovar páginas existentes do site do cliente | https://youtu.be/q322H3Eq81w | B2 | Manuel S | OK |

### Quiz Módulo 8 (31 perguntas)

Aula 8.1 — Escrita de artigos blog via APP

Q1 [single] Na app da WonderAds, para começar a escrever um artigo blog, o consultor deve ir a:
- [ ] (A) Definições > Novo Conteúdo > Blog
- [x] (B) Quick Actions > Write Blog Article
- [ ] (C) Menu lateral > Criar Task > Artigo
- [ ] (D) Homepage > Criar Cliente > Novo Blog

Q2 [vf] O tópico que colamos no campo do artigo corresponde exatamente à keyword primária que queremos dar target. → V

Q3 [single] As keywords secundárias devem ser inseridas no campo:
- [ ] (A) Todas na mesma linha separadas por vírgula
- [x] (B) Uma keyword por linha
- [ ] (C) Separadas por ponto e vírgula
- [ ] (D) Dentro de aspas e separadas por hífen

Q4 [multi] Quais destes campos são opcionais na criação do artigo blog via app?
- [ ] Keyword Primária
- [ ] Keywords Secundárias
- [x] LSI Keywords
- [x] Internal Linking Links
- [x] Audiência
- [x] Referências
- [x] CTA

Q5 [vf] Independentemente do que já está rankeado no Google para aquela keyword, o consultor deve sempre gerar o artigo com 1.200 palavras. → F

Q6 [vf] Na criação do artigo blog via app é responsabilidade do consultor deixar links para linkagem interna sempre que faça sentido. → V

Q7 [single] Cenário: Vou criar um artigo blog para o cliente "Sentir Saúde" com o tópico "Pilates Clínico na Gravidez". Devo:
- [x] (A) Colar o tópico como keyword primária, verificar as target keywords do projeto para escolher secundárias relevantes (ex.: "Pilates Clínico Porto"), definir o word count consoante o que está rankeado, adicionar internal links e CTA
- [ ] (B) Colar apenas o tópico e gerar o artigo com as definições default para poupar tempo
- [ ] (C) Pedir ao cliente para ele próprio enviar a estrutura do artigo antes de gerar
- [ ] (D) Gerar o artigo primeiro em Claude/ChatGPT e depois colar o resultado na app

Q8 [single] Depois de gerar o conteúdo do artigo via app, o próximo passo é:
- [ ] (A) Publicar automaticamente no site do cliente sem revisão
- [ ] (B) Enviar diretamente ao cliente por email para aprovação imediata
- [x] (C) Transformar o conteúdo para HTML e/ou trazer mais pontos de SEO relevantes para dentro do conteúdo
- [ ] (D) Guardar como rascunho e esperar o próximo weekly report

Q9 [multi] Quais destes passos fazem parte do fluxo correto de criação de um artigo blog via app?
- [x] Colar o tópico do artigo como keyword primária
- [x] Consultar as target keywords do cliente antes de adicionar secundárias
- [x] Adicionar keywords secundárias uma por linha
- [x] Definir word count com base no que está rankeado no Google
- [x] Adicionar links de internal linking quando relevante
- [x] Definir CTA alinhado com o objetivo do cliente
- [ ] Publicar diretamente no site sem passar por HTML nem revisão SEO
- [ ] Ignorar as target keywords do projeto e usar apenas o tópico

Aula 8.2 — Publicação de artigos blog e páginas em HTML

Q10 [single] Quem deve assinar os artigos blog? ⚠️ CONFIRMAR (sem resposta marcada; a mais provável é "A maior referência no cliente/clínica")
- [ ] A pessoa que aprova o blog
- [ ] A recepcionista
- [ ] O CEO/Diretor da clínica
- [x] A maior referência no cliente/clínica

Q11 [vf] Todos os artigos devem ter um CTA. → V

Q12 [single] Todos os artigos devem ter:
- [ ] Assinatura
- [ ] CTA
- [ ] FAQs c/ schema
- [ ] Internal Linking
- [x] Todas as anteriores

Q13 [single] As target keywords (palavras-chave do projeto) nos artigos blog e páginas do site devem estar:
- [x] Em negrito
- [ ] Em itálico
- [ ] Sempre sublinhadas
- [ ] Todas as anteriores

Aula 8.3 — FAQ com Google e IA

Q14 [vf] Duas regras resumem a criação de um FAQ bem feito: as perguntas vêm sempre de dados (não da nossa cabeça) e a resposta vem sempre no começo para os AIs lerem (não no fim). → V

Q15 [vf] É importante a resposta vir sempre no início para o ChatGPT, Claude, etc. lerem e nos mencionarem a possíveis clientes. → V

Q16 [single] Ao pesquisar o termo principal no Google para encontrar perguntas para o FAQ, a secção mais importante a analisar é:
- [ ] Os anúncios pagos no topo da SERP, porque mostram o que a concorrência já responde
- [ ] A AI Overview no topo, porque é a única fonte fiável hoje em dia
- [x] A secção "As pessoas também perguntam", abrindo cada caixa para gerar mais perguntas relacionadas
- [ ] Os resultados orgânicos da primeira posição, copiando os títulos como perguntas

Q17 [vf] Quando o consultor está a fazer o FAQ fora do país onde o cliente atende (clientes estrangeiros, por ex. Inglaterra), deve usar as ferramentas de pesquisa avançada do Google e definir a região onde o cliente opera, para os resultados serem locais e relevantes. → V

Q18 [multi] Quais destas ferramentas fazem parte do fluxo apresentado para recolher perguntas para o FAQ?
- [x] Google — secção "As pessoas também perguntam"
- [x] Google Search Console — aba Desempenho, filtrando por queries relevantes
- [x] People Also Asked (com país, localização e linguagem do cliente)
- [x] Conversar com o atendimento ao cliente do nosso cliente, para captar perguntas reais do dia a dia
- [ ] Copiar diretamente o FAQ do concorrente principal do cliente
- [ ] Ahrefs Site Audit
- [ ] Perguntar diretamente ao Claude quais são as perguntas, sem cruzar dados externos

Q19 [vf] Todas as perguntas que aparecem no Google Search Console para o cliente são relevantes para o FAQ e devem ser incluídas sem filtro. → F

Q20 [single] Cenário: Reuni as perguntas do Google ("As pessoas também perguntam"), o CSV do People Also Asked, o export do GSC e o link da página. Colei tudo no Claude. O prompt mais correto para pedir ao Claude é:
- [ ] "Escreve-me um FAQ completo com 20 perguntas sobre este tema"
- [x] "Esta é a página. Estas são as perguntas que juntei. Tira as que já estão respondidas no conteúdo original da página, junta as que são a mesma escrita de forma diferente, e devolve-me as 6 melhores perguntas para criar um FAQ para esta página"
- [ ] "Inventa 6 perguntas criativas que ainda ninguém tenha feito sobre este serviço"
- [ ] "Copia o FAQ do concorrente e adapta para o meu cliente"

Q21 [vf] O Claude, por defeito, já conhece o preço que a agência/cliente cobra, os horários, a duração dos tratamentos e outros dados específicos do negócio, por isso as respostas geradas não precisam de ser complementadas com informação adicional. → F

Q22 [single] Cenário: O Claude devolveu 6 perguntas com respostas para o FAQ da página. Uma das respostas é genérica e termina com "entre em contacto para saber mais". Devo:
- [ ] Aceitar assim, porque encaminhar o utilizador para contacto é sempre positivo para gerar leads
- [ ] Publicar como está e deixar o cliente completar depois
- [x] Rever a resposta e complementá-la com dados reais e diferenciadores que só eu tenho (preço, duração, personalização, processo, garantias) — porque respostas que já tiram a dúvida ao utilizador são melhores para SEO/IA e evitam encaminhar leads que não vão fechar
- [ ] Pedir ao Claude para reescrever mais 5 vezes até deixar de mandar contactar

Q23 [vf] Na implementação do FAQ na página, as perguntas devem estar em H3 e as respostas em estilo normal (texto). → V

Aula 8.4 — Content Refresh

Q24 [vf] Fazer refresh a uma página existente do site do cliente é normalmente mais eficaz e mais eficiente do que criar uma página nova do zero, porque a página antiga já tem alguma força e visibilidade acumuladas. Atenção que não é regra geral e por vezes pode acontecer uma página nova dar rank melhor e mais rápido que uma página antiga. → V

Q25 [multi] Quais destas são razões válidas para fazer refresh regular ao conteúdo das páginas de um cliente?
- [x] O Google e os motores de busca valorizam conteúdo atualizado e vão silenciando/despriorizando páginas paradas há 2-3 anos
- [x] Uma página com preços antigos, serviços que já não existem ou referências desatualizadas transmite descuido ao utilizador, quebra a confiança e reduz o tempo em página
- [x] Atualizar uma página existente exige muito menos esforço do que construir uma página do zero
- [ ] É obrigatório mudar 100% do conteúdo da página todos os meses para o Google não penalizar
- [ ] Só as páginas de topo (homepage e páginas de serviço principais) precisam de refresh; as outras podem ficar como estão
- [x] Content refresh é um processo contínuo, não uma ação pontual. Devo ter isto periodicamente no Roadmap dos meus clientes

Q26 [multi] Quais destes são pilares a avaliar quando se decide o que precisa de refresh numa página?
- [x] Internal linkings quebrados (links internos que apontam para páginas que já não existem e geram 404)
- [x] Otimização/refresh das meta tags (meta titles e meta descriptions)
- [x] Conteúdo que está parado há bastante tempo e que nunca foi otimizado (páginas escritas uma vez, sem target keywords nos headings, textos, etc.)
- [x] Páginas de serviços — verificar se todos os serviços que o cliente presta atualmente estão no site, e se serviços que já não faz continuam a ocupar espaço
- [ ] Cor do botão de CTA principal
- [ ] Número de plugins instalados no WordPress

Q27 [single] Qual é o n.º de palavras recomendado no mínimo para uma página de serviço bem otimizada?
- [ ] 300 a 600 palavras
- [ ] 800 a 1.000 palavras
- [x] 1.200 a 2.000 palavras
- [ ] Acima de 3.000 palavras, sem limite superior

Q28 [single] Cenário: Vou otimizar a página de "Ginecologia" de um cliente. Um colega diz-me para poupar tempo copiando o link da página do concorrente que está em 1.º lugar, colar no Claude e pedir "analisa isto e faz-me uma versão melhor". Devo:
- [ ] Fazer exatamente isso, porque o Claude analisa o link melhor do que qualquer pessoa e é muito mais rápido
- [x] Fazer análise manual primeiro: abrir a página do concorrente, contar quantas vezes a keyword principal é mencionada, contar blocos de texto, imagens, FAQs, vídeos, ver a ordem dos headers e meta tags — e SÓ DEPOIS dar esses dados ao Claude para gerar uma página 2x melhor em cada ponto
- [ ] Copiar o conteúdo do concorrente diretamente e mudar meia dúzia de palavras
- [ ] Ignorar a concorrência e escrever apenas com base no que o cliente pediu

Q29 [multi] Porque é que não devemos limitar-nos a dar o link do concorrente ao Claude e pedir para "analisar e replicar melhor"?
- [x] O Claude não vê a página como nós vemos, e pode falhar em coisas óbvias que ao olho humano chamam a atenção
- [x] Corre-se o risco de focar apenas nos erros do concorrente e ignorar o conteúdo bom que ele já tem e que devíamos igualar/superar
- [x] A análise manual (contar keywords, blocos, imagens, FAQs, vídeos) demora 10-15 minutos e é o passo mais importante para dar ao Claude informação que ele sozinho não capta
- [ ] É proibido pelo Google usar Claude para analisar concorrentes
- [ ] O Claude devolve sempre exatamente o mesmo conteúdo que o concorrente, sem melhorias

Q30 [single] Cenário: Já fiz a análise manual do concorrente que está em 1.º lugar para "ginecologia" e contei: keyword mencionada 16 vezes, 6 blocos de texto, 5 imagens, 1 FAQ com 11 perguntas. Passei tudo ao Claude, gerei o conteúdo otimizado 2x melhor. O passo seguinte é:
- [ ] Publicar diretamente no site do cliente porque já foi gerado com base na análise
- [x] Copiar o conteúdo para um documento live (partilhado por link com o cliente como editor), adicioná-lo à tabela de Pending Review e aguardar a aprovação do cliente antes de publicar no site
- [ ] Enviar o conteúdo em PDF fechado por email ao cliente, sem possibilidade de o cliente editar
- [ ] Guardar internamente e implementar apenas depois de rever com o cliente na próxima reunião mensal

Q31 [vf] Depois de o conteúdo otimizado estar live no site do cliente, o trabalho está terminado — não é necessário monitorizar a evolução da página. → F

---

## Módulo 9 — Local SEO — Google Business Profile

Objetivo: auditar, alimentar e gerir a reputação do perfil GMB de um cliente.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 9.1 | GMB Profile Audit — checklist completa (categorias, NAP, fotos, produtos, atributos, Q&A) | https://youtu.be/yj8N3apW6hg | B2 | João B | OK |
| 9.2 | Criar GMB Posts — o que é, para que serve, que fotos usar, e se o cliente não tiver fotos | https://youtu.be/IEPBz1JbXh8 | B2 | Manuel S | OK |
| 9.3 | Publicar um GMB Post no GMB Profile | https://youtu.be/qO-XAuRbl_E | CD + B2 | Mesmo vídeo nas duas bibliotecas (deduplicado) | OK |
| 9.4 | GMB Reviews Responder — como responder a reviews positivas e negativas + action para drafts | https://youtu.be/GzmUAU36CCI | B2 | André Pereira | OK |

### Quiz Módulo 9 (15 perguntas)

Aula 9.1 — GMB Profile Audit

Q1 [multi] Para gerar o report na GMB Profile Audit da app da WonderAds, o consultor deve preencher:
- [x] GMB Profile URL (link de partilha do perfil de Google Business do cliente)
- [x] Notas com o estado atual do perfil (ex.: se nunca foi usado, se está descuidado, se começou a ser otimizado recentemente)
- [ ] Screenshot da homepage do site do cliente
- [ ] Password de acesso ao GMB do cliente
- [ ] Nome do concorrente principal no Google Maps

Q2 [single] O que significa NAP no contexto de otimização de Google My Business?
- [ ] New Address Protocol — protocolo de indexação de endereços do Google
- [x] Names, Addresses and Phone Numbers — dados que o Google usa para ligar o perfil GMB à página da loja no site do cliente
- [ ] Nearby Area Points — pontos de referência geográficos usados para ranquear localmente
- [ ] Non-Approved Places — perfis não verificados no Google Maps

Q3 [single] Quantas categorias secundárias permite o Google adicionar num perfil de Google My Business e que devemos aproveitar para adicionar keywords do projeto sem falta?
- [ ] 3
- [ ] 5
- [x] 9
- [ ] 15

Q4 [single] Cenário: A GMB Audit devolveu que o NAP do perfil não coincide com o NAP da página da loja no site do cliente (a morada tem uma abreviatura diferente e o telefone tem espaços a mais no site). O consultor deve:
- [ ] Ignorar, porque o Google reconhece automaticamente pequenas variações de formatação
- [ ] Alterar apenas o perfil GMB, porque o site é responsabilidade do cliente
- [x] Garantir que Nome, Morada e Número de Telemóvel coincidem exatamente entre o GMB e a página da loja, para o Google conseguir ligar o perfil à loja com certeza
- [ ] Criar um segundo perfil GMB com o formato do site para o Google escolher o que preferir

Q5 [single] Cenário: Estou a fazer a auditoria ao GMB de um cliente novo (ótica com loja física em Viseu). O report devolveu: (a) faltam 4 categorias secundárias; (b) o NAP do perfil GMB tem a morada como "Rua Direita, 45" e no site aparece "R. Direita nº 45"; (c) o telefone no GMB tem +351 e no site aparece sem indicativo; (d) o horário está desatualizado desde antes da pandemia; (e) não há posts GMB há mais de 8 meses. Qual é a abordagem mais correta?
- [ ] Corrigir apenas as categorias secundárias em falta e deixar o resto para uma segunda fase do roadmap
- [ ] Alterar apenas a morada e telefone no site do cliente para coincidir com o GMB, porque é mais rápido
- [x] Adicionar as 4 categorias secundárias, uniformizar o NAP nos dois lados garantindo correspondência exata (Nome + Morada + N.º Telemóvel iguais em GMB e página da loja), atualizar o horário, e planear a retoma de GMB Posts com constância — porque o report entrega "a papinha toda feita" mas a execução (site + GMB + calendário) é responsabilidade do consultor
- [ ] Enviar o report em bruto ao cliente para ele próprio implementar as correções no GMB
- [ ] Corrigir tudo no GMB, mas deixar o site como está, porque o Google prioriza sempre a informação do próprio perfil GMB

Aulas 9.2–9.3 — GMB Post

Q6 [multi] Na publicação de um GMB Post, o consultor deve (seleciona duas):
- [ ] Priorizar imagens feitas em Claude
- [x] Priorizar imagens de qualidade do cliente
- [ ] Priorizar textos escritos pelo cliente
- [x] Adaptar todos os textos com target keywords

Q7 [vf] Na publicação de um GMB Post, o consultor deve sempre gerar imagens com o ChatGPT. → F

Q8 [single] Na publicação de um GMB Post de um cliente sem conteúdo (imagens) devemos logo: ⚠️ CONFIRMAR (sem resposta marcada; pela Q6/Q7 e pelo módulo de cross-sell, a mais provável é a 2.ª opção)
- [ ] Ir automaticamente gerar imagens com Claude para publicar o post ASAP
- [x] Comunicar à equipa e team leader a possibilidade de um cross sell de uma sessão fotográfica
- [ ] Dizer ao cliente que tem que ter as imagens até ao fim do mês
- [ ] Comunicar ao cliente que iremos usar banco de imagens da internet (Envato Elements)

Aula 9.4 — GMB Reviews Responder

Q9 [vf] Numa review negativa é boa prática responder publicamente com todos os detalhes do caso do cliente, incluindo o que aconteceu no atendimento, para mostrar transparência a quem lê. → F

Q10 [single] Qual é o tempo de resposta ideal a uma review negativa no perfil do Google Business?
- [x] Em menos de 24 horas
- [ ] Entre 24 a 48 horas
- [ ] Entre 48 a 72 horas
- [ ] Até 1 semana
- [ ] Não há prazo, desde que se responda ainda no mesmo mês

Q11 [single] Qual é o tempo de resposta aceitável a uma review positiva no perfil do Google Business?
- [ ] Em menos de 1 hora
- [x] Entre 24 a 48 horas
- [ ] Até 1 semana
- [ ] Até 15 dias
- [ ] Só é obrigatório responder se o utilizador tiver escrito texto para além das estrelas

Q12 [single] Qual é o tamanho recomendado para uma resposta a uma review positiva?
- [ ] 10 a 20 palavras, apenas um agradecimento
- [x] 40 a 60 palavras, curto, específico e direto ao ponto
- [ ] 80 a 120 palavras, para dar contexto sobre a clínica
- [ ] Acima de 150 palavras, para reforçar keywords
- [ ] Não há limite, desde que agradeça

Q13 [single] Qual é o tamanho máximo recomendado para uma resposta a uma review negativa?
- [ ] Até 40 palavras
- [ ] Até 60 palavras
- [x] Até 100 palavras
- [ ] Até 200 palavras
- [ ] Sem limite, desde que se responda a cada ponto do reviewer

Q14 [multi] Sobre boas práticas na resposta a reviews do GMB, seleciona todas as corretas:
- [x] Sempre que fizer sentido no contexto, incluir palavras-chave do cliente na resposta
- [x] Cada resposta deve ser diferente, nunca copy-paste da anterior
- [x] Nas respostas negativas, o objetivo é direcionar o utilizador para um atendimento particular em vez de tentar resolver publicamente no perfil
- [x] Respostas a reviews de 5 estrelas sem texto podem ser mais simplificadas
- [ ] Devemos sempre publicar a resposta diretamente no GMB sem passar por aprovação do cliente, para ganhar tempo
- [ ] As respostas em inglês são desnecessárias — deve responder-se sempre na língua da clínica

Q15 [single] Cenário: A White Clinic recebeu uma review de 1 estrela às 14h com uma reclamação sobre o tempo de espera na consulta. Devo:
- [ ] Responder logo no próprio dia com um pedido de desculpa público e explicar detalhadamente o que possa ter causado o atraso
- [x] Gerar uma resposta (até ~100 palavras) que reconheça a experiência, peça desculpa e direcione o utilizador para um contacto particular da clínica; enviar essa resposta ao cliente para aprovação e publicar no GMB em menos de 24 horas
- [ ] Esperar pela revisão semanal de reviews para tratar esta juntamente com as restantes
- [ ] Responder de imediato com a mesma resposta-template que já usámos noutras reviews negativas anteriores

---

## Módulo 10 — Off-Page SEO — Backlinks

Objetivo: perceber o que é um bom backlink, criar backlinks, analisar a concorrência e corrigir links quebrados.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 10.1 | Como fazer a gestão de backlinks — Parte 1 | https://youtu.be/9PylOS6OZFY | CD | — | OK |
| 10.2 | Como fazer a gestão de backlinks e o que são — Parte 2 (call c/ equipa) | https://youtu.be/1M9MD0hXnRg | CD | — | OK |
| 10.3 | Roleplay: Criação de 1 backlink live para um cliente (Doctoralia) | https://youtu.be/Z3LNfnoAhlU | CD | — | OK |
| 10.4 | Competitor Backlink Gap — ler o gap vs concorrência e priorizar oportunidades | https://youtu.be/1R86p-A0R8o | B2 | André Pereira | OK |
| 10.5 | Broken-Link Building — encontrar e resolver links com erros 4xx e links com defeito | https://youtu.be/hMicZK0NQRg | B2 | Fran R | OK |

### Quiz Módulo 10 (35 perguntas)

Aulas 10.1–10.2 — Gestão de backlinks

Q1 [vf] Quantos mais backlinks um site tiver, melhor será sempre o seu SEO. → F

Q2 [vf] Comprar backlinks em grande quantidade é a forma mais rápida e segura de melhorar o ranking do cliente no Google. → F

Q3 [vf] Se um site tem Domain Authority (DA) muito alto, qualquer backlink desse site vai beneficiar o cliente, independentemente do tema. → F

Q4 [single] O que é um backlink?
- [ ] Um link interno entre páginas do próprio site do cliente
- [x] Um link de outro site externo que aponta para o site do cliente
- [ ] Um link partilhado nas redes sociais do cliente
- [ ] Um link para o email da empresa

Q5 [vf] Backlinks provenientes de sites relevantes para o nicho/setor do cliente têm mais valor do que backlinks de sites sem qualquer relação com o nicho. → V

Q6 [vf] Se um cliente aparecer mencionado num artigo de um site com boa autoridade, isso já conta como backlink. → F

Q7 [single] Qual destas opções representa o MELHOR backlink para o cliente?
- [ ] Um link de um site com DA 80, mas de um tema totalmente diferente do cliente
- [x] Um link de um site com DA 40, relevante para o setor do cliente e com tráfego real
- [ ] Um link de um diretório genérico que aceita qualquer empresa
- [ ] Um link colocado em 500 sites automaticamente através de software

Q8 [single] Qual destas situações é a MAIS prejudicial para o SEO do cliente?
- [ ] Ter poucos backlinks, mas todos de qualidade
- [ ] Não ter backlinks nenhuns
- [x] Ter muitos backlinks de sites de spam e má reputação
- [ ] Ter backlinks com nofollow

Q9 [vf] Usar sempre exatamente a mesma palavra-chave no anchor text de todos os backlinks do cliente ajuda a posicionar melhor essa palavra-chave no Google. → F

Q10 [single] Qual é a melhor forma de avaliar se um site é bom para colocar o backlink do cliente?
- [ ] Ver apenas o DA/DR do site
- [ ] Ver apenas o número de backlinks que o site tem
- [x] Analisar DA/DR + relevância temática + tráfego orgânico real + perfil de backlinks do próprio site
- [ ] Ver se o site tem design bonito e moderno

Aula 10.3 — Roleplay: criação de backlink (Doctoralia)

Q11 [vf] Todos os backlinks são bons para o SEO do cliente. → F

Q12 [single] O que é mais importante na hora de escolher onde colocar um backlink?
- [ ] Quantidade de sites
- [x] Autoridade e relevância do site
- [ ] Cor do design do site
- [ ] Se o site tem anúncios

Q13 [single] Qual é o aspeto mais importante do perfil do backlink que devemos sempre colocar para criar o propriamente dito "backlink"?
- [ ] N.º de telefone da empresa
- [ ] Morada da empresa
- [x] Website da empresa
- [ ] Todas as anteriores

Q14 [vf] Um perfil backlink sem link do site do cliente na Wonder é considerado um backlink. → F

Aula 10.4 — Competitor Backlink Gap

Q15 [vf] O Competitor Backlink Gap é uma pesquisa que serve para encontrar oportunidades de backlink que os concorrentes do nosso cliente já têm, para conseguirmos replicar essas oportunidades para o nosso cliente. → V

Q16 [vf] Os competidores indicados pelo cliente no onboarding form são sempre concorrentes de SEO relevantes para o Backlink Gap e têm sempre backlinks que podemos "ir buscar" para os nossos clientes. → F

Q17 [single] Para escolher os concorrentes a colocar na análise de Backlink Gap, como consultor devo:
- [ ] Usar apenas os competidores indicados no onboarding form do cliente
- [ ] Usar apenas os competidores sugeridos pelo Semrush no Domain Overview / Competitive Positioning Map
- [x] Combinar competidores do onboarding form com competidores identificados no Semrush (Domain Overview / Competitive Positioning Map), validando serviço a serviço se realmente fazem sentido
- [ ] Usar todos os concorrentes que aparecem no mapa do Semrush em modo automático, sem validar

Q18 [single] Cenário: Na análise do Backlink Gap para um cliente de fisioterapia, aparece que um dos concorrentes tem 21.000 backlinks vindos de um único site chamado "Vietnam Rice Code", que não tem qualquer ligação temática com fisioterapia nem saúde. Devo:
- [ ] Contactar o "Vietnam Rice Code" para tentar replicar esses 21.000 backlinks para o meu cliente
- [x] Ignorar essa oportunidade, porque a quantidade anormal e a falta de relação temática indicam claramente backlinks comprados e sem qualquer valor para SEO
- [ ] Adicionar o "Vietnam Rice Code" à shortlist de sites-alvo porque o volume elevado ajuda o Authority Score do cliente
- [ ] Reportar o concorrente ao Google por ter comprado backlinks

Q19 [multi] Quando estamos a analisar quais os sites do Backlink Gap que fazem sentido para o cliente, o que devemos ter em conta?
- [x] Se o site é confiável e de qualidade
- [x] Authority Score do site
- [x] Ligação temática/relevância do site com o nicho do cliente
- [ ] Se o site tem um design bonito e moderno
- [ ] Se o site aceita qualquer empresa sem verificação

Q20 [single] Depois de identificar os concorrentes relevantes no Semrush, o passo seguinte no fluxo de uma análise "Backlinks Competitor Gap" é:
- [ ] Enviar a lista de concorrentes por email ao cliente para ele aprovar site a site
- [x] Ir à app da WonderAds, abrir a action Backlink Competitor Gap, adicionar os concorrentes + tópicos foco e gerar o estudo
- [ ] Contactar diretamente cada site concorrente para pedir os backlinks
- [ ] Fazer o estudo apenas dentro do Semrush e exportar em CSV

Q21 [multi] O estudo gerado pelo Competitor Backlink Gap na app da WonderAds organiza as oportunidades por tipo de fonte. Que tipos de fonte podem aparecer no output?
- [x] Imprensa local
- [x] Sites de notícias
- [x] Revistas e portais de saúde
- [x] Diretórios clínicos (ex.: Doctoralia)
- [x] Blogs e fóruns temáticos (ex.: maternidade, bebé)
- [ ] Anúncios pagos do Google Ads dos concorrentes
- [ ] Reviews do Google Business Profile dos concorrentes
- [ ] Contas de redes sociais dos concorrentes

Aula 10.5 — Links com erros 4xx e links com defeito

Q22 [vf] Um link quebrado é um link que aponta para uma página que devolve erro 404. → V

Q23 [vf] Como o Ahrefs corre na nuvem e envia email quando termina, posso e devo deixar o site audit a correr e trabalhar noutras coisas em paralelo. → V

Q24 [vf] Quando não encontro uma página equivalente para redirecionar, a solução mais segura é redirecionar todos os URLs quebrados para a homepage. → F

Q25 [single] Cenário: O cliente tem várias páginas 404 antigas que já não têm equivalente no site atual, mas o serviço/tema continua a ser oferecido pelo cliente. Devo:
- [ ] Redirecionar todas para a homepage para eliminar os 404 rapidamente
- [ ] Deixar como 404 porque o Google acaba por remover essas páginas do índice
- [x] Recriar a página no mesmo endereço, mesmo que dê mais trabalho, abrindo tarefa nova para não perder a autoridade daquele URL
- [ ] Redirecionar todas para a página de contacto genérica do site

Q26 [single] Qual é a diferença entre um redirect 301 e um redirect 302?
- [ ] O 301 é temporário e o 302 é permanente
- [x] O 301 é permanente e passa autoridade; o 302 é temporário e não passa autoridade
- [ ] Ambos passam autoridade; a diferença é apenas visual no browser
- [ ] O 302 é o mais recomendado porque é mais seguro para SEO

Q27 [vf] Posso usar um redirect 302 sempre que quiser porque, se ficar ativo mais de 30 dias, acaba por ter o mesmo efeito de um 301. → F

Q28 [multi] Ao usar o Claude para trabalhar o relatório de links quebrados exportado do Ahrefs, o que é que o Claude faz por nós?
- [x] Agrupa as URLs de destino e mostra quantas páginas apontam para cada uma
- [x] Ordena as URLs partidas da que tem mais links a apontar para a que tem menos
- [x] Sugere um destino para cada URL quebrada com base na intenção, cruzando com o sitemap do cliente
- [ ] Confirma automaticamente se o destino sugerido faz sentido e publica o redirect no WordPress
- [x] Torna a lista muito mais manejável, porque a mesma URL quebrada está normalmente repetida em menu, rodapé e banner
- [ ] Substitui a necessidade de o consultor abrir cada destino sugerido para validar caso a caso

Q29 [single] Cenário: O consultor exportou o relatório do Ahrefs e o CSV tem 380 URLs 4xx. Depois de colar o CSV e o sitemap no Claude, a plataforma agrupa as URLs e sugere destinos. Devo:
- [ ] Confiar 100% nas sugestões do Claude e criar os 301 em bloco
- [x] Abrir cada destino sugerido pelo Claude, verificar se faz sentido com base no serviço/página, ajustar manualmente onde for preciso e só depois criar os 301 no plugin Redirection
- [ ] Redirecionar tudo para a homepage porque 380 URLs é demasiado para tratar caso a caso
- [ ] Ignorar o relatório porque o Google acaba por descobrir e desindexar sozinho os 404 com o tempo

Q30 [vf] Uma cadeia de redirecionamentos (A → B → C) é a forma mais eficiente de organizar redirects antigos porque preserva o histórico da URL. → F

Q31 [single] Depois de aplicar as correções e voltar a correr o crawl no Ahrefs, o consultor deve verificar:
- [x] Se os 404 desapareceram e se não apareceram cadeias de redirecionamento (A → B → C)
- [ ] Apenas se os 404 desapareceram
- [ ] Apenas se o site está a carregar mais rápido
- [ ] Se o cliente recebeu email do Ahrefs com o novo relatório

Q32 [vf] O Ahrefs permite agendar um crawl automático semanal que envia email quando aparece um 404 novo, deixando de ser um trabalho reativo e passando a ser corretivo. → V

Q33 [single] Para criar redirects num site em WordPress, qual é o plugin utilizado no fluxo?
- [ ] Yoast SEO
- [ ] Rank Math
- [x] Redirection
- [ ] WP Rocket

Q34 [vf] O Claude conhece o site do cliente e o histórico do projeto o suficiente para decidir sozinho os destinos finais dos redirects, sem necessidade de validação do consultor. → F

Q35 [multi] Quais destes passos fazem parte do fluxo correto para encontrar e resolver links 4xx e links com defeito?
- [x] Correr o Site Audit no Ahrefs
- [x] Filtrar por "páginas com erro 4xx" ou "página tem link para uma página com erro"
- [x] Exportar o CSV e colar no Claude juntamente com o sitemap do cliente
- [ ] Deixar o Claude decidir sozinho e criar os 301 automaticamente
- [x] Validar caso a caso os destinos sugeridos pelo Claude
- [x] Corrigir o link diretamente na página de origem quando está mal escrito, ou criar redirect 301 quando a página deixou mesmo de existir
- [ ] Redirecionar sempre tudo para a homepage para simplificar a operação
- [x] Voltar a correr o crawl no Ahrefs para confirmar que os 404 desapareceram e que não há cadeias de redirecionamento
- [x] Deixar o crawl agendado semanalmente para receber avisos de novos 404

---

## Módulo 11 — Crescimento de Conta: Cross-sell, Up-sell e Renovação

Objetivo: identificar oportunidades de crescimento no cliente, registá-las internamente e preparar renovações. Último módulo porque exige domínio de todos os anteriores.

| Aula | Título | Vídeo | Origem | Anexos / notas | Estado |
|------|--------|-------|--------|----------------|--------|
| 11.1 | Como encontrar/considerar um up-sell e cross-sell — Parte 1 | https://youtu.be/EKLoRs7oUk4 | COM | — | OK |
| 11.2 | Roleplay: Como considerar um up-sell ou cross-sell para web design de site completo — Parte 2 | https://youtu.be/IwNmucpVg0Y | COM | — | OK |
| 11.3 | Como registar um cross-sell ou uma proposta de renovação internamente | https://youtu.be/AGqu9w37GOU | COM | — | OK |
| 11.4 | Protocolo de preparar uma renovação (5% de comissão ao consultor por renovação ganha) | https://youtu.be/WuR4iMTerBo | COM | Anexar: [HDS Learning — Renewal Review.docx](https://docs.google.com/document/d/1LDYepNTQ8Q3L6bm2Ij-g6DQvsmjmcNvc/edit) e [HDS Roadmap — 6 meses.docx](https://docs.google.com/document/d/1hyo9_2hBHnnL8IIrGSN-a_47vGKUTLYn/edit?usp=sharing) | OK |

### Quiz Módulo 11 (21 perguntas)

Aulas 11.1–11.3 — Cross-sells e up-sells

Q1 [single] A melhor maneira de perceber um cross sell e/ou um upsell é ir falando com o cliente ao longo do tempo e perceber os pain points.
- [ ] Mentira, devo propor um redesign ao cliente se o site foi desenhado há muito tempo
- [ ] Mentira, é ir vendo o website do cliente
- [x] Verdade, é comunicar com o cliente mas também é importante visitar o site do cliente

Q2 [single] Uma CRM é:
- [ ] Um sistema de contabilidade usado para calcular impostos e emitir faturas automaticamente
- [x] Uma ferramenta de gestão de relacionamento com clientes que centraliza contactos, interações e oportunidades de venda para o cliente
- [ ] Um tipo de hospedagem para melhorar a velocidade do site do cliente
- [ ] Um protocolo de segurança informática que protege bases de dados contra ataques

Q3 [single] Se o cliente não tiver a gerir os clientes da melhor forma possível e a perder leads é a minha total responsabilidade de:
- [ ] Perceber o mais rápido possível como é que o cliente gere os seus contactos e leads atualmente
- [ ] Testar os formulários do site e ver como é o flow de uma lead do site
- [ ] Falar com a equipa e com o cliente e propor um cross sell de consultoria de CRM
- [x] Todas as anteriores

Q4 [single] Queres fazer um cross do cliente para um website redesign novo. Qual é a melhor métrica para ver se o site do cliente está apelativo e os utilizadores estão a gostar?
- [ ] Número total de páginas indexadas pelo Google
- [ ] Velocidade de carregamento do servidor medida em milissegundos
- [x] Tempo médio na página e bounce rate, porque mostram se os utilizadores estão a explorar o conteúdo ou a sair rapidamente sem interagir
- [ ] Quantidade de plugins instalados no CMS

Q5 [single] É a minha total responsabilidade perceber:
- [ ] Qual é a satisfação do cliente com o site atual
- [ ] Quantas páginas faltam no site do cliente para melhores resultados SEO (corpo clínico, sobre nós, serviços todos)
- [ ] O tempo médio de utilizador por página do site
- [x] Todas as anteriores

Q6 [vf] A fase n.º 1 de um processo de cross sell e upsell é perceber se há oportunidades e quais são as oportunidades. → V

Q7 [vf] A segunda fase de um processo cross sell de um cliente de SEO para email marketing é perceber como está o email marketing do competidor/concorrente. → F

Q8 [vf] Na fase de juntar argumentos para propor um cross-sell ao cliente temos que procurar e juntar argumentos apelativos e que façam sentido para o dono da empresa, como por exemplo a perda de faturação/pacientes (porque o cliente tem um site pouco apelativo e o bounce rate está alto). → V

Q9 [vf] Se tiver a propor um cross sell de redesign de website a um cliente de SEO tenho que juntar alguns websites de concorrentes com websites melhores e resultados para keywords no nicho do cliente. → V

Q10 [single] Em qualquer cross sell e/ou upsell é importante:
- [ ] Oferecer sempre o produto mais caro como um website novo, independentemente do perfil do cliente
- [x] Fazer uma análise de como o concorrente/competição está a fazer esse tal serviço/produto, para perceber o posicionamento no mercado e identificar oportunidades de diferenciação
- [ ] Evitar mencionar produtos ou serviços adicionais durante a conversa com o cliente
- [ ] Aplicar exatamente o mesmo desconto a todos os clientes

Q11 [single] Num cross para o DPT WEB (projeto de website): ⚠️ CONFIRMAR (sem resposta marcada no doc original; a renovação paga 5%, confirmar se o cross-sell web é também 5%)
- [ ] O consultor de SEO que trouxe o cross sell ganha uma comissão de 2,5% do projeto
- [x] O consultor de SEO que trouxe o cross sell ganha uma comissão de 5% do projeto
- [ ] O consultor de SEO que trouxe o cross sell ganha uma comissão de 7,5% do projeto
- [ ] O consultor de SEO que trouxe o cross sell ganha uma comissão de 10% do projeto

Q12 [vf] Assumindo a responsabilidade pelos meus clientes, procuro sempre avaliar se existe margem para melhorar a sua faturação mensal e proponho cross sells de outras consultorias (melhorar as vendas da receção, Ads para complementar o serviço, website redesign, etc.). → V

Q13 [multi] A WonderAds (para clientes internos/cross sells) faz a venda de:
- [x] CRM
- [x] Web Design
- [x] Email Marketing
- [ ] Edição de Vídeos em Bulk
- [x] META Ads
- [ ] TikTok Ads

Q14 [vf] O objetivo essencial para apresentar um cross sell é alavancar os resultados dos serviços já comprados pelo cliente. Por exemplo, oferecemos Google Ads a um cliente de SEO/GEO para alavancar os resultados gerais da conta/cliente. → V

Q15 [vf] Para clientes em Portugal a WonderAds não oferece a captação de imagens (sessão fotográfica). → F

Aula 11.4 — Preparar uma renovação de um cliente

Q16 [multi] Para a renovação de um cliente tenho como responsabilidade trazer para a reunião:
- [x] O documento de 7 pontos dos últimos 6 meses de parceria
- [x] A proposta de roadmap para os próximos 6 meses de parceria
- [ ] A tabela de pending review
- [ ] As últimas mensagens no grupo do WhatsApp
- [x] As aplicações abertas nas abas para ter prontas na reunião

Q17 [vf] Durante a call de renovação o objetivo é falarmos sobre como correram os passados 6 meses e o que propomos serem os próximos 6 meses com o cliente. → V

Q18 [single] Para a preparação de renovação de um cliente, o documento de overview dos últimos 6 meses tem quantas partes? ⚠️ CONFIRMAR (sem resposta marcada; pela Q16 "documento de 7 pontos" e pelas 7 secções marcadas na Q21, a correta é 7)
- [ ] Tem 3 partes
- [ ] Tem 5 partes
- [x] Tem 7 partes
- [ ] Tem 10 partes

Q19 [vf] Para a preparação de renovação de um cliente de SEO é responsabilidade minha como consultor de SEO deste projeto trazer o roadmap proposto para os próximos 3 meses. → V ⚠️ CONFIRMAR (o doc original marca V, mas contradiz a Q16 que fala em roadmap para 6 meses; provavelmente deve ser F ou a pergunta deve dizer "6 meses")

Q20 [vf] Para a preparação de reunião de renovação de um cliente é opcional ter as abas das plataformas de analytics abertas no computador para a reunião. → F

Q21 [multi] O documento de overview dos últimos 6 meses para trazer para a reunião de renovação deve ter:
- [x] Resumo executivo
- [ ] Tabela de Pending Review do projeto
- [x] Keywords e Authority Score
- [x] Search Visibility Analytics (GA e GSC)
- [x] AI Visibility (Searchable.com data)
- [ ] DO's, Dont's e Notas do projeto
- [x] GMB Profile Analytics
- [x] Recomendação de próximos passos
- [ ] Último Weekly Report enviado ao cliente
- [x] Sources

---

## Anexo A — Vídeos a gravar (3)

| Aula | Título | Consultor | Nota |
|------|--------|-----------|------|
| 2.5 | Monthly Report para cliente e-commerce (Shopify, etc.) | André Pereira | Enviar primeiro alterações a implementar na action Monthly Report; gravar depois de feitas |
| 4.2 | Website SEO Audit — Parte 2 | por atribuir | — |
| 4.3 | ScreamingFrog | Fran R | Falado na reunião |

No workspace: mostrar como "Em breve", bloqueadas, sem contar para a percentagem de conclusão do módulo até terem vídeo.

## Anexo B — Perguntas a confirmar antes de publicar (10)

| Módulo | Pergunta | Problema | Resposta assumida |
|--------|----------|----------|-------------------|
| 1 | Q2 Basta ter a assinatura em… | Sem resposta marcada | Ambas |
| 2 | Q5 O consultor deve sempre deixar claro que… | Sem resposta marcada | Cliente conta leads/mês + origem |
| 2 | Q7 Cenário leads vs conversão baixa | Sem resposta marcada | Formação comercial à receção + escalar |
| 2 | Q11 Dentro de quantos dias ligar (NPS) | Sem opções no doc original | 14 dias (opções criadas a partir do título do vídeo 2.7) |
| 3 | Q8 A quem perguntar primeiro (admin) | Sem resposta marcada | Colega de equipa |
| 8 | Q10 Quem assina os artigos blog | Sem resposta marcada | Maior referência no cliente/clínica |
| 9 | Q8 GMB Post de cliente sem imagens | Sem resposta marcada | Cross-sell sessão fotográfica |
| 11 | Q11 Comissão cross-sell DPT WEB | Sem resposta marcada | 5% |
| 11 | Q18 Doc de overview tem quantas partes | Sem resposta marcada | 7 |
| 11 | Q19 Roadmap 3 meses (V) | Contradiz Q16 (6 meses) | Corrigir enunciado para 6 meses ou marcar F |

Outras notas de revisão:

- Módulo 2 Q1 (protocolos obrigatórios): as opções "Monthly report ao cliente" e "Monthly report ao cliente com Loom ou Reunião" estão ambas marcadas como corretas — validar se se quer manter as duas ou fundir numa só.
- Módulo 8 Q12 ("Todos os artigos devem ter") está como escolha única com "Todas as anteriores" correta; pode converter-se em multi com todas marcadas.
- Módulo 9 Q6 diz "seleciona duas" no enunciado — manter texto ou tratar como multi genérico.

## Anexo C — Aulas sem perguntas de quiz (10)

Estas aulas ficam sem avaliação no quiz do módulo (o módulo continua a ter quiz, só não cobre estas aulas). Se se quiser cobertura completa, criar 2-3 perguntas por aula:

| Aula | Título |
|------|--------|
| 1.1 | Bem-vindos / Mindset de Consultor |
| 1.2 | Como utilizar a app interna |
| 2.1 | Daily Update (parcialmente coberta pela Q1 do M2) |
| 2.2 | Weekly Report (parcialmente coberta pela Q1 do M2) |
| 2.5 | Monthly Report e-commerce (a gravar) |
| 4.2 | Site Audit Parte 2 (a gravar) |
| 4.3 | ScreamingFrog (a gravar) |
| 5.3 | Actual Call: Onboarding (coberta pelas perguntas de pré-onboarding 5.2) |
| 5.5 | Eventos GA4 |
| 11.3 | Registar cross-sell/renovação internamente |

## Anexo D — Mapa de origem (bibliotecas → módulos)

Para verificar que nenhum vídeo ficou de fora.

| Vídeo (ID YouTube) | Biblioteca | Aula |
|--------------------|-----------|------|
| rHyBzn8XUkE | 1 COM | 1.1 |
| IUoZxz4RRg0 | 1 COM | 5.2 |
| T97p9o6m9JE | 1 COM | 5.3 |
| 5WWjo9BsXbY | 1 COM | 2.7 |
| sJsGrgB-GcA | 1 COM | 2.8 |
| v4BX2Z_8Fno | 1 COM | 2.6 |
| 0OsdUmWc83M | 1 COM | 2.4 |
| EKLoRs7oUk4 | 1 COM | 11.1 |
| IwNmucpVg0Y | 1 COM | 11.2 |
| 4-KCE7JJ2Js | 1 COM | 3.2 |
| BqvAx7cFKdk | 1 COM | 3.1 |
| DcrZE67Lm80 | 1 COM | 1.6 |
| WuR4iMTerBo | 1 COM | 11.4 |
| RDn6aFO_oiw | 1 COM | 1.5 |
| AGqu9w37GOU | 1 COM | 11.3 |
| PIh_7uEJ-Sw | 1 CD | 1.2 |
| 53hU0LqoIhw | 1 CD | 2.1 |
| btQ0c57SQV8 | 1 CD | 2.2 |
| rxVJOnzqogg | 1 CD | 2.3 |
| Dc5QNdWRCLc | 1 CD | 1.3 |
| zdL3DcOkpCM | 1 CD | 5.1 |
| kzbSFY35bUk | 1 CD | 5.4 |
| 8POIya1_KtI | 1 CD | 7.1 |
| u0euxplXZro | 1 CD | 3.4 |
| 5a9lbODTF8c | 1 CD | 3.3 |
| -bdNcJ-lJJo | 1 CD | 8.1 |
| 6B_u_9zBqvY | 1 CD | 8.2 |
| 7SX3As-Uwy8 | 1 CD | 5.5 |
| qO-XAuRbl_E | 1 CD + 2 | 9.3 |
| 0aJevETkcPc | 1 CD | 1.4 |
| 9PylOS6OZFY | 1 CD | 10.1 |
| 1M9MD0hXnRg | 1 CD | 10.2 |
| Z3LNfnoAhlU | 1 CD | 10.3 |
| EmAfTeK96lM | 2 | 4.1 |
| (sem link) Site Audit Pt 2 | 2 | 4.2 |
| (sem link) ScreamingFrog | 2 | 4.3 |
| rm-xN5LqnJA | 2 | 6.1 |
| DKdcn0N9sWY | 2 | 6.2 |
| IEPBz1JbXh8 | 2 | 9.2 |
| bl5KVi8IKaA | 2 | 6.3 |
| 1ku2t6Sp5sQ | 2 | 6.4 |
| uvW5_gObUN4 | 2 | 6.5 |
| lTg5D-zgnIA | 2 | 7.2 |
| 1R86p-A0R8o | 2 | 10.4 |
| hMicZK0NQRg | 2 | 10.5 |
| yj8N3apW6hg | 2 | 9.1 |
| GzmUAU36CCI | 2 | 9.4 |
| 7mxDOE8f4BI | 2 | 7.3 |
| q322H3Eq81w | 2 | 8.4 |
| lLGlEIKMKV4 | 2 | 8.3 |
| Z8OSZPVtHPE | 2 | 4.4 |
| iBw6ZmZSZ4M | 2 | 4.5 |
| -Y_232vvfhQ | 2 | 4.6 |
| (sem link) Monthly Report e-commerce | 2 | 2.5 |

## Anexo E — Instruções para Claude Code

Contexto: este documento é a fonte de verdade para a página `/formacao/seo-geo` no WonderAds Workspace App. O card atual mostra "Especialização SEO/GEO — EM PREPARAÇÃO — Dois sub-módulos: COMUNICAÇÃO e CLIENT DELIVERY". Substituir essa estrutura de 2 sub-módulos pelos 11 módulos acima.

Tarefas:

1. Criar/atualizar o modelo de dados de formação com a hierarquia Curso → Módulo → Aula e Módulo → Quiz → Pergunta → Opção. Sugestão de campos:

```json
{
  "course": {
    "slug": "seo-geo",
    "title": "Especialização SEO/GEO",
    "description": "11 módulos, do mindset e ferramentas internas até cross-sell e renovação. Cada módulo termina com um quiz.",
    "modules": [
      {
        "order": 1,
        "slug": "boas-vindas-mindset-ferramentas",
        "title": "Boas-vindas, Mindset e Ferramentas Internas",
        "objective": "…",
        "lessons": [
          {
            "order": 1,
            "code": "1.1",
            "title": "Bem-vindos ao Departamento de SEO e GEO │ Mindset de Consultor",
            "youtube_id": "rHyBzn8XUkE",
            "status": "published",
            "attachments": [{ "label": "…", "url": "…" }],
            "source": "COM"
          }
        ],
        "quiz": {
          "pass_threshold": 0.8,
          "shuffle": true,
          "questions": [
            {
              "order": 1,
              "lesson_code": "1.3",
              "type": "vf",
              "prompt": "É opcional eu ter a assinatura de email em inglês e em português.",
              "options": [
                { "label": "Verdadeiro", "correct": false },
                { "label": "Falso", "correct": true }
              ],
              "needs_review": false
            }
          ]
        }
      }
    ]
  }
}
```

2. Fazer o parse deste ficheiro Markdown para gerar o seed (ou escrever o seed à mão a partir dele). Regras de parse:
   - Cada `## Módulo N — …` abre um módulo; a tabela seguinte lista as aulas (colunas: Aula, Título, Vídeo, Origem, Anexos, Estado).
   - `Estado = A GRAVAR` → `status: "coming_soon"`, sem `youtube_id`.
   - Em `### Quiz Módulo N`, cada linha `Qn [tipo] enunciado` abre uma pergunta; `[vf]` termina em `→ V` ou `→ F`; `[single]`/`[multi]` têm opções `- [x]`/`- [ ]`.
   - As linhas "Aula X.Y — …" entre perguntas indicam o `lesson_code` das perguntas seguintes.
   - `⚠️ CONFIRMAR` → `needs_review: true` (mostrar badge no admin, não bloquear publicação).

3. Lógica de progressão:
   - Aula concluída = vídeo visto (ou marcado manualmente como visto).
   - Quiz do módulo desbloqueia quando todas as aulas com vídeo estão concluídas.
   - Módulo concluído = quiz aprovado (≥ 80%). Módulo seguinte desbloqueia com o anterior concluído (tornar configurável; permitir admin a saltar).
   - Percentagem do card "Especialização SEO/GEO" = módulos concluídos / 11.
   - Aulas `coming_soon` não contam para a percentagem.

4. Admin: permitir editar perguntas/opções e marcar `needs_review` como resolvido; permitir adicionar vídeo às aulas `coming_soon` sem alterar a ordem.

5. Registo: guardar por consultor as tentativas de quiz (data, score, respostas) para o relatório semanal de erros/pontuação já existente na app.
