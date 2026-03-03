import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import pyodbc
import requests
from dotenv import load_dotenv


def bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SupabaseQueueClient:
    def __init__(self, url: str, service_key: str, table: str, batch_size: int) -> None:
        self.url = url.rstrip("/")
        self.table = table
        self.batch_size = batch_size
        self.base = f"{self.url}/rest/v1/{self.table}"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def fetch_pending(self) -> List[Dict[str, Any]]:
        params = {
            "select": "id,customer_id,full_name,email,phone,document,address,status,source,created_at",
            "status": "eq.pending",
            "order": "id.asc",
            "limit": str(self.batch_size),
        }
        response = requests.get(self.base, headers=self.headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []

    def mark_processed(self, row_id: int) -> None:
        payload = {
            "status": "processed",
            "processed_at": now_iso(),
            "last_error": None,
        }
        response = requests.patch(
            self.base,
            headers=self.headers,
            params={"id": f"eq.{row_id}"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def mark_error(self, row_id: int, message: str) -> None:
        payload = {
            "status": "error",
            "last_error": (message or "Erro desconhecido")[:900],
        }
        response = requests.patch(
            self.base,
            headers=self.headers,
            params={"id": f"eq.{row_id}"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def ensure_order_number_min(self, min_value: int) -> None:
        response = requests.post(
            f"{self.url}/rest/v1/rpc/ensure_customer_order_number_min",
            headers=self.headers,
            json={"min_value": int(min_value)},
            timeout=30,
        )
        response.raise_for_status()


class ErpWriter:
    def __init__(
        self,
        conn_str: str,
        insert_sql: str,
        param_order: List[str],
        dry_run: bool = False,
        max_retries: int = 3,
        retry_delay_seconds: float = 2.0,
        retry_backoff_multiplier: float = 2.0,
    ) -> None:
        self.conn_str = conn_str
        self.insert_sql = insert_sql
        self.param_order = param_order
        self.dry_run = dry_run
        self.max_retries = max(1, max_retries)
        self.retry_delay_seconds = max(0.1, retry_delay_seconds)
        self.retry_backoff_multiplier = max(1.0, retry_backoff_multiplier)

    def _params_from_row(self, row: Dict[str, Any]) -> List[Any]:
        return [row.get(key) for key in self.param_order]

    def write_customer(self, row: Dict[str, Any]) -> None:
        params = self._params_from_row(row)
        if self.dry_run:
            logging.info("DRY_RUN ativo: cliente seria enviado ao ERP: %s", params)
            return

        delay = self.retry_delay_seconds
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                conn = pyodbc.connect(self.conn_str, timeout=10)
                try:
                    cursor = conn.cursor()
                    cursor.execute(self.insert_sql, params)
                    conn.commit()
                finally:
                    conn.close()
                if attempt > 1:
                    logging.info("Escrita ERP ok após retry (tentativa %s)", attempt)
                return
            except Exception as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                logging.warning(
                    "Falha ao escrever no ERP (tentativa %s/%s): %s. Nova tentativa em %.1fs",
                    attempt,
                    self.max_retries,
                    exc,
                    delay,
                )
                time.sleep(delay)
                delay *= self.retry_backoff_multiplier

        raise RuntimeError(f"Falha ao gravar no ERP após {self.max_retries} tentativas: {last_error}")

    def get_last_preorder_number(self, sql: str) -> int:
        if not sql.strip():
            raise RuntimeError("SQL de último pedido não informado")
        conn = pyodbc.connect(self.conn_str, timeout=10)
        try:
            cur = conn.cursor()
            cur.execute(sql)
            row = cur.fetchone()
            if not row or row[0] is None:
                return 0
            return int(row[0])
        finally:
            conn.close()


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Variável obrigatória ausente: {name}")
    return value


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, ".env")
    load_dotenv(env_path)

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    try:
        supabase_url = required_env("SUPABASE_URL")
        supabase_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
        queue_table = os.getenv("QUEUE_TABLE", "customer_erp_queue").strip() or "customer_erp_queue"
        batch_size = int(os.getenv("QUEUE_BATCH_SIZE", "20"))
        poll_interval = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))

        erp_conn_str = required_env("ERP_ODBC_CONN_STR")
        erp_insert_sql = required_env("ERP_INSERT_SQL")
        erp_param_order_raw = required_env("ERP_PARAM_ORDER")
        erp_param_order = [x.strip() for x in erp_param_order_raw.split(",") if x.strip()]
        if not erp_param_order:
            raise RuntimeError("ERP_PARAM_ORDER inválido.")

        erp_write_max_retries = int(os.getenv("ERP_WRITE_MAX_RETRIES", "3"))
        erp_write_retry_delay_seconds = float(os.getenv("ERP_WRITE_RETRY_DELAY_SECONDS", "2"))
        erp_write_retry_backoff_multiplier = float(os.getenv("ERP_WRITE_RETRY_BACKOFF_MULTIPLIER", "2"))
        order_sequence_sync_enabled = bool_env("ORDER_SEQUENCE_SYNC_ENABLED", False)
        erp_last_preorder_sql = os.getenv("ERP_LAST_PREORDER_SQL", "").strip()

        dry_run = bool_env("DRY_RUN", False)

        queue = SupabaseQueueClient(
            url=supabase_url,
            service_key=supabase_key,
            table=queue_table,
            batch_size=batch_size,
        )
        erp = ErpWriter(
            conn_str=erp_conn_str,
            insert_sql=erp_insert_sql,
            param_order=erp_param_order,
            dry_run=dry_run,
            max_retries=erp_write_max_retries,
            retry_delay_seconds=erp_write_retry_delay_seconds,
            retry_backoff_multiplier=erp_write_retry_backoff_multiplier,
        )
    except Exception as exc:
        logging.error("Falha na inicialização do conector: %s", exc)
        return 1

    logging.info(
        "Conector ERP iniciado. DRY_RUN=%s, fila=%s, retries=%s, order_sync=%s",
        dry_run,
        queue_table,
        erp_write_max_retries,
        order_sequence_sync_enabled,
    )

    while True:
        try:
            if order_sequence_sync_enabled and erp_last_preorder_sql:
                try:
                    last_number = erp.get_last_preorder_number(erp_last_preorder_sql)
                    if last_number > 0:
                        queue.ensure_order_number_min(last_number)
                        logging.info("Sequência de pré-venda sincronizada com ERP: >= %s", last_number)
                except Exception as sync_err:
                    logging.warning("Falha ao sincronizar sequência de pedidos com ERP: %s", sync_err)

            pending = queue.fetch_pending()
            if pending:
                logging.info("Registros pendentes: %s", len(pending))
            for row in pending:
                row_id = row.get("id")
                if row_id is None:
                    continue
                try:
                    erp.write_customer(row)
                    queue.mark_processed(int(row_id))
                    logging.info("Cliente fila #%s processado com sucesso.", row_id)
                except Exception as err:
                    logging.exception("Falha ao processar fila #%s: %s", row_id, err)
                    try:
                        queue.mark_error(int(row_id), str(err))
                    except Exception:
                        logging.exception("Falha ao registrar erro na fila #%s", row_id)
        except Exception as cycle_err:
            logging.exception("Erro no ciclo de processamento: %s", cycle_err)

        time.sleep(poll_interval)


if __name__ == "__main__":
    sys.exit(main())
