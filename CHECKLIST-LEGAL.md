# Checklist legal e de acessibilidade — Box das Rações (v10)

> Isto NÃO é parecer jurídico. Os textos das páginas foram escritos como ponto de partida, em linguagem simples, e **precisam ser lidos por um advogado** antes de valerem. Onde não tive certeza, está escrito.

## 1. Feito no site
- [x] Política de Privacidade (`privacidade.html`), Termos de Uso (`termos.html`), Política de Cookies (`cookies.html`), Política de Trocas e Reembolso (`trocas-e-reembolso.html`)
- [x] Links no rodapé de todas as páginas (+ botão "Preferências de cookies")
- [x] Banner de cookies com aceitar / recusar / escolher (já existia desde a v8.1). **Precisa?** Sim: o site usa estatísticas de visita (analytics) e o ideal pela LGPD é pedir consentimento antes. Sem o aceite, só rodam os necessários.
- [x] Caixa de aceite (Privacidade + Termos) no cadastro; aviso com links no login; aceite dos termos no carrinho (uma vez por aparelho)
- [x] CPF/CNPJ deixou de ser obrigatório no cadastro
- [x] E-mail e CPF/CNPJ do cliente não vão mais no texto do WhatsApp nem na comanda
- [x] YouTube: só carrega ao tocar em reproduzir, em modo privacidade ampliada; miniatura não chama o YouTube
- [x] Texto alternativo em imagens: produtos (nome), banners (campo opcional `URL | descrição` no admin); imagens decorativas com alt vazio
- [x] "Marcas Parceiras" virou "Marcas" (não dá para provar parceria)
- [x] Contraste, teclado, nomes de botões: auditados antes (30/30 testes de acessibilidade) e mantidos nesta versão

## 2. Falta você preencher (arquivo `js/site-info.js`, um lugar só)
- [ ] Razão social e CNPJ
- [ ] Endereço, horário, e-mail de atendimento
- [ ] E-mail de privacidade e nome do responsável (encarregado)
- [ ] Cidade do foro
- [ ] Nas páginas legais, trocar cada aviso amarelo "[a preencher]" (prazo de guarda dos pedidos, prazo de reembolso, regras de entrega, produtos com receita, região do servidor, entregadores/meios de pagamento) e apagar o quadro de aviso se existir
- [ ] Sem CNPJ publicado o site descumpre a exigência de identificação do comércio eletrônico (Decreto 7.962/2013) — não tenho certeza dos artigos; o advogado confirma.

## 3. Dados: o que remover ou reduzir
- Feito: CPF/CNPJ opcional; e-mail e CPF fora do WhatsApp.
- Sugestão: cidade e UF obrigatórios no cadastro são dispensáveis se a entrega é local.
- Sugestão: só guarde CPF se for emitir nota com CPF.

## 4. Rastreadores e terceiros (riscos)
| Serviço | O que recebe | Risco | Ação |
|---|---|---|---|
| Analytics próprio (`site_events`) | Página, produto, código anônimo | Baixo; só com aceite | Definir prazo de guarda |
| Google Fonts | IP do visitante | Médio (LGPD/transferência) | Hospedar a fonte Nunito no próprio site (não consegui baixar daqui) |
| jsDelivr (supabase-js) | IP | Baixo | Opcional: hospedar o arquivo |
| YouTube | IP/cookies ao reproduzir | Médio | Já mitigado (nocookie + só ao clicar) |
| WhatsApp (Meta) | Texto do pedido | Inerente ao canal | Citado na política |
| Supabase / Netlify | Todos os dados do site | Servidores podem estar fora do Brasil | Confirmar região no painel e citar na política |
| Voz do assistente | Áudio via navegador | Baixo | Citado na política |
| Assistente com IA (futuro) | Mensagens do cliente | Alto se ativado | Atualizar política antes de ativar |
Não há Google Analytics, Meta Pixel nem outros pixels no código.

## 5. Imagens, fontes e ícones
- Logo e imagens do site: são da loja (confirmar que o arquivo do logo é de sua autoria/contratado).
- Banner com marca d'água **Vecteezy** (cães na tábua, usado como destaque): é imagem de banco **sem licença paga**. Trocar por foto própria ou licenciar. **Urgente.**
- Fonte Nunito (Google Fonts, licença aberta SIL OFL): uso livre; crédito não obrigatório.
- Ícones: SVGs desenhados no próprio código; nada a creditar.
- Fotos de produtos (vêm do ERP/fornecedores): fotos de fabricantes costumam ter direitos; confirmar autorização das marcas ou usar fotos próprias.
- Os dois prints do Petz que você mandou serviram só de referência de layout: não use imagens, textos nem marca da Petz.

## 6. Leis que provavelmente se aplicam (confirmar com advogado)
- LGPD — Lei 13.709/2018 (dados pessoais, cookies)
- Código de Defesa do Consumidor — Lei 8.078/1990 (arrependimento de 7 dias, art. 49; vícios, publicidade, informação clara)
- Decreto 7.962/2013 — comércio eletrônico (identificação da empresa, atendimento, arrependimento)
- Marco Civil da Internet — Lei 12.965/2014 (registros de acesso, responsabilidades)
- Regras do setor pet: produtos veterinários e ração são fiscalizados pelo Ministério da Agricultura (MAPA); medicamento veterinário pode exigir receita/responsável técnico e registro no CRMV. **Não tenho certeza dos números das normas**: peça ao advogado ou ao veterinário responsável.
- Tributário/fiscal (nota fiscal, MEI/Simples): contador.
- Guia de cookies da ANPD: existe, recomendo o advogado conferir a versão atual.

## 7. Outros riscos que encontrei
- Banner/imagem sem licença (item 5).
- Pedido só vale quando a loja confirma — está escrito nos Termos; mantenha na prática.
- Comanda por link: o endereço do pedido fica atrás de um código longo e secreto; não poste o link em lugar público.
- Repositório do GitHub está **público**: tornar privado e conferir se `erp_connector/backups` tem dados de clientes no histórico.
- CSP ainda em modo "só relatório" (não bloqueia): ativar depois de navegar por todas as páginas.
- Promessas de preço/estoque: o carrinho mostra preços do banco; se o ERP atrasar, pode divergir (já previsto nos Termos).

## 8. Para o advogado revisar
- Os 4 textos inteiros, em especial: bases legais (privacidade), compromissos assumidos nos Termos (erro de preço = cancelar sem custo), prazos de 7/30/90 dias nas trocas, produtos abertos, foro, dispensa/necessidade de encarregado para pequeno negócio, transferência internacional.

---

# Pronto para vender? (22/10/2026)

**Resposta curta: ainda não.** O site está funcional e testado com dados simulados, mas faltam itens que dependem de você, do banco real e da empresa.

## Bloqueia a venda (fazer antes de divulgar)
1. [ ] Preencher `js/site-info.js` (razão social, CNPJ, endereço, horário, e-mail, foro) e os avisos amarelos das páginas legais
2. [ ] Advogado ler os 4 textos legais
3. [ ] Aplicar no Supabase as migrações pendentes: `20261013000000_security_hardening.sql`, `20261015000000_site_events_limits.sql`, `20261017000000_admin_orders.sql`, `20261021000000_comanda_link.sql` (nessa ordem) e conferir se `supabase-orders-setup.sql` já foi rodado
4. [ ] Teste real ponta a ponta no site publicado: criar conta (e-mail de confirmação), fazer pedido, ver no painel de pedidos, abrir o link da comanda, favoritos, endereços e histórico. Tudo foi testado só com Supabase simulado
5. [ ] Supabase → Authentication → URL Configuration: colocar o domínio real (boxdasracoes.com.br) em Site URL e Redirect URLs (senão o e-mail de confirmação/recuperação de senha quebra)
6. [ ] Trocar o banner com marca d'água Vecteezy (sem licença)
7. [ ] Testar o envio real do pedido pelo WhatsApp (celular e computador) com o número da loja
8. [ ] Cadastrar o catálogo real (hoje são poucos produtos; faltam os ~9.000 do ERP) e conferir preços e estoque
9. [ ] Deixar claro à equipe: pedido só vale depois da confirmação da loja (está nos Termos)
10. [ ] Definir regras reais de entrega (área, taxa, horários, mínimo) e escrever nos Termos

## Importante, logo depois
- [ ] Tornar o repositório do GitHub privado e conferir `erp_connector/backups` no histórico
- [ ] Secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY` no GitHub para a rotina que impede o Supabase gratuito de pausar (ou migrar para o plano Pro, que também aguenta mais acessos)
- [ ] "Finalizar no site" não cobra online (diz "pronto para integração"): hoje a venda é por WhatsApp com Pix/cartão/dinheiro na entrega. Se não for integrar gateway, esconder esse botão
- [ ] Ativar a CSP (hoje só relatório) depois de navegar por todas as páginas
- [ ] Rodar Lighthouse/axe no site publicado
- [ ] Fotos próprias dos produtos; logo em resolução maior
- [ ] Google Search Console + Google Business Profile
- [ ] Hospedar a fonte no próprio site (tira o Google Fonts)
- [ ] Definir com o contador a emissão de nota fiscal

## O que já está pronto
Catálogo com busca, filtros, galeria, carrinho, endereço com confirmação e vários endereços, histórico, favoritos, pedido por WhatsApp com comanda por link, painel admin de pedidos, modo escuro, PWA, acessibilidade (30/30), cookies/LGPD, páginas legais, SEO básico.
