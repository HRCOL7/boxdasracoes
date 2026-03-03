Cadastro/Login de Clientes no Site
==================================

Resumo
------
- O checkout agora exige login do cliente.
- O site exibe modal de Login/Cadastro quando necessário.
- No cadastro, os dados do cliente são enviados ao Supabase Auth + tabela de perfil.
- Também é criada uma entrada na fila `customer_erp_queue` para integração com o ERP Support.

Arquivos alterados
------------------
- `js/customer-auth.js` (novo)
- `js/cart.js`
- `js/whatsapp.js`
- `index.html`
- `products.html`
- `product.html`
- `css/base.css`
- `supabase-customer-setup.sql` (novo)
- `supabase-orders-setup.sql` (novo)

Passo 1: criar tabelas/policies no Supabase
-------------------------------------------
1. Abra o SQL Editor do Supabase.
2. Rode o script `supabase-customer-setup.sql` completo.
3. Rode o script `supabase-orders-setup.sql` completo.

Numeração de pré-venda (para o vendedor digitar no Support)
-----------------------------------------------------------
- Ao finalizar a compra, o site cria um registro em `customer_orders`.
- O campo `order_number` é sequencial no formato operacional, iniciando em `129951`.
- Esse número é enviado no WhatsApp como:
	- `Pré-venda: 129951`

Passo 2: validar no site
------------------------
1. Abra o site.
2. Adicione produto ao carrinho.
3. Clique em "Finalizar".
4. O modal de autenticação deve abrir se não estiver logado.
5. Faça cadastro/login e finalize o pedido.

Observações de integração ERP
-----------------------------
- A tabela `customer_erp_queue` recebe os cadastros com `status='pending'`.
- O conector local (na rede da empresa) deve ler essa fila e inserir no Support.
- Após processar, o conector atualiza status para `processed` ou `error`.
