Conector Local ERP (Support Informática)
=========================================

Objetivo
--------
Consumir a fila `customer_erp_queue` no Supabase e cadastrar clientes no banco do ERP Support que está na rede local (ex.: `192.168.15.147`).

Arquivos
--------
- `erp_connector/connector.py`
- `erp_connector/discover_schema.py`
- `erp_connector/requirements.txt`
- `erp_connector/.env.example`
- `erp_connector/run_connector.ps1`
- `erp_connector/install_connector_task.ps1`

Pré-requisitos
--------------
1. Python 3.10+
2. Driver ODBC do SQL Server instalado na máquina do conector:
   - ODBC Driver 17 ou 18 for SQL Server
3. Acesso de rede ao servidor do banco ERP (`192.168.15.147:1433`)
4. Chave `service_role` do Supabase (para ler/atualizar fila)

Passo a passo
-------------
1. Crie e ative um ambiente Python local.
2. Instale dependências:
   - `pip install -r erp_connector/requirements.txt`
3. Copie `erp_connector/.env.example` para `erp_connector/.env`.
4. Ajuste:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ERP_ODBC_CONN_STR`
   - `ERP_INSERT_SQL` (tabela/colunas reais do Support)
   - `ERP_PARAM_ORDER` (ordem dos campos)
   - `ERP_WRITE_MAX_RETRIES`, `ERP_WRITE_RETRY_DELAY_SECONDS`, `ERP_WRITE_RETRY_BACKOFF_MULTIPLIER`
   - `ORDER_SEQUENCE_SYNC_ENABLED=true`
   - `ERP_LAST_PREORDER_SQL` (query para obter o último número de pedido/pré-venda no Support)
5. Para primeiro teste, use `DRY_RUN=true`.
6. Execute:
   - `python erp_connector/connector.py`

Descobrir tabela/colunas do Support
-----------------------------------
Se você ainda não sabe o nome exato da tabela de clientes no banco do ERP:

- `python erp_connector/discover_schema.py`

Esse script usa `ERP_ODBC_CONN_STR` do `.env` e lista tabelas candidatas + colunas para montar o `ERP_INSERT_SQL` corretamente.

Rodar como serviço (Windows)
----------------------------
1. Teste manual antes:
   - `powershell -ExecutionPolicy Bypass -File erp_connector/run_connector.ps1`
2. Criar tarefa automática no startup:
   - `powershell -ExecutionPolicy Bypass -File erp_connector/install_connector_task.ps1 -ProjectRoot "D:\Hicaro\BOXDASRACOES"`
3. Iniciar imediatamente:
   - `Start-ScheduledTask -TaskName "BOXDASRACOES_ERP_Connector"`

Comportamento da fila
---------------------
- Lê registros `status = pending`.
- Se gravar no ERP com sucesso, marca no Supabase:
  - `status = processed`
  - `processed_at = now()`
  - `last_error = null`
- Se falhar, marca:
  - `status = error`
  - `last_error = mensagem`

Sincronismo de numeração com o Support
--------------------------------------
- O site gera pré-venda em `customer_orders.order_number` (Supabase).
- O conector pode sincronizar a sequência com o ERP antes de cada ciclo.
- Com `ORDER_SEQUENCE_SYNC_ENABLED=true`, o conector executa `ERP_LAST_PREORDER_SQL` e chama a função RPC `ensure_customer_order_number_min(...)` no Supabase.
- Isso evita que a numeração do site fique atrás da numeração já usada no Support.

Campos esperados na fila
------------------------
A tabela `customer_erp_queue` deve ter (mínimo):
- `id`
- `full_name`
- `email`
- `phone`
- `document`
- `address`
- `status`
- `processed_at`
- `last_error`

Observações importantes
-----------------------
- O conector deve rodar dentro da rede da empresa (ou VPN) para alcançar o banco ERP.
- Não use `service_role` no front-end do site.
- Depois de validar, rode o conector como serviço/tarefa agendada do Windows.
