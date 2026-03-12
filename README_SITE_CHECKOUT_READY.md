Checkout No Site - Base Pronta para PIX/Cartao
==============================================

O que ja foi preparado
----------------------
- Campo de confirmacao de endereco no carrinho:
  - Rua
  - Numero
  - Bairro
  - CEP
  - Referencia (opcional)
- Campo de agendamento da entrega:
  - Data
  - Janela: 09:00-11:00, 13:00-15:00, 15:00-18:00
- Botao novo no carrinho: "Finalizar no site"
- Validacao de checkout no site:
  - Carrinho com itens
  - Pagamento selecionado
  - Metodo online (PIX/debito/credito/link)
  - Endereco minimo preenchido + horario
- Criacao de pedido em `customer_orders` com:
  - `source = site_checkout_pending_payment`
  - `status = pending`
  - `note` com endereco e agendamento
- Fallback local caso Supabase esteja indisponivel:
  - Salva em `localStorage.site_checkout_last`

Arquivos envolvidos
-------------------
- `includes/header.html`
- `index.html`
- `products.html`
- `product.html`
- `css/base.css`
- `js/cart.js`
- `js/site-checkout.js`

Como o fluxo funciona hoje
--------------------------
1. Cliente adiciona itens ao carrinho.
2. Cliente escolhe pagamento.
3. Cliente preenche endereco/agendamento.
4. Cliente clica em "Finalizar no site".
5. O sistema cria um pedido pendente para futuro pagamento online.
6. Exibe o numero do pedido e confirma que esta pronto para integrar gateway.

Como ativar pagamento real depois
---------------------------------
1. Escolher gateway (ex.: Mercado Pago, Pagar.me, Asaas, Stripe).
2. Criar endpoint server-side para iniciar transacao (nunca no front-end).
3. No evento `checkout-site-ready`, chamar esse endpoint e redirecionar para pagina de pagamento.
4. Configurar webhook do gateway para atualizar `customer_orders.status`:
   - `paid`
   - `payment_failed`
   - `canceled`
5. Liberar expedicao apenas para pedidos `paid`.

Observacoes
-----------
- O checkout via WhatsApp continua funcionando normalmente.
- O checkout no site esta em modo de preparacao (sem cobranca real ainda).
- Campos de endereco sao preenchidos automaticamente quando possivel, usando dados do cliente logado.
