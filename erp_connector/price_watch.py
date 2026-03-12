import logging
import os
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

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


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Variavel obrigatoria ausente: {name}")
    return value


def normalize_key(value: Any) -> str:
    return str(value or "").strip().lower()


def to_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


class SupabaseClient:
    def __init__(self, url: str, service_key: str, product_key_field: str = "internal") -> None:
        self.url = url.rstrip("/")
        self.product_key_field = product_key_field
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def fetch_products(self) -> List[Dict[str, Any]]:
        select = f"id,name,price,variants,is_unavailable,{self.product_key_field}"
        response = requests.get(
            f"{self.url}/rest/v1/products",
            headers=self.headers,
            params={"select": select, "limit": "10000"},
            timeout=40,
        )
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []

    def fetch_open_alerts(self) -> Dict[str, Dict[str, Any]]:
        response = requests.get(
            f"{self.url}/rest/v1/erp_price_alerts",
            headers=self.headers,
            params={
                "select": "id,product_id,product_key,erp_price,site_price,status,occurrences",
                "status": "eq.open",
                "limit": "10000",
            },
            timeout=40,
        )
        response.raise_for_status()
        data = response.json()
        out: Dict[str, Dict[str, Any]] = {}
        if isinstance(data, list):
            for row in data:
                try:
                    pid = int(row.get("product_id"))
                except Exception:
                    continue
                pkey = normalize_key(row.get("product_key"))
                out[f"{pid}|{pkey}"] = row
        return out

    def create_alert(
        self,
        product_id: int,
        product_name: str,
        product_key: str,
        site_price: Decimal,
        erp_price: Decimal,
    ) -> None:
        payload = {
            "product_id": product_id,
            "product_name": product_name,
            "product_key": product_key,
            "site_price": float(site_price),
            "erp_price": float(erp_price),
            "diff_amount": float(erp_price - site_price),
            "detected_at": now_iso(),
            "last_seen_at": now_iso(),
            "occurrences": 1,
            "status": "open",
            "resolved_at": None,
            "resolution_note": None,
        }
        response = requests.post(
            f"{self.url}/rest/v1/erp_price_alerts",
            headers=self.headers,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def refresh_alert(self, alert_id: int, site_price: Decimal, erp_price: Decimal, occurrences: int) -> None:
        payload = {
            "site_price": float(site_price),
            "erp_price": float(erp_price),
            "diff_amount": float(erp_price - site_price),
            "last_seen_at": now_iso(),
            "occurrences": int(occurrences) + 1,
            "status": "open",
            "resolved_at": None,
        }
        response = requests.patch(
            f"{self.url}/rest/v1/erp_price_alerts",
            headers=self.headers,
            params={"id": f"eq.{alert_id}"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def resolve_alert(self, alert_id: int, note: str = "Preco alinhado automaticamente") -> None:
        payload = {
            "status": "resolved_auto",
            "resolved_at": now_iso(),
            "resolution_note": note,
        }
        response = requests.patch(
            f"{self.url}/rest/v1/erp_price_alerts",
            headers=self.headers,
            params={"id": f"eq.{alert_id}"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()


class ErpReader:
    def __init__(self, conn_str: str, price_query: str) -> None:
        self.conn_str = conn_str
        self.price_query = price_query

    def fetch_prices(self) -> Dict[str, Decimal]:
        conn = pyodbc.connect(self.conn_str, timeout=10)
        try:
            cursor = conn.cursor()
            cursor.execute(self.price_query)
            rows = cursor.fetchall()
        finally:
            conn.close()

        out: Dict[str, Decimal] = {}
        for row in rows:
            if len(row) < 2:
                continue
            key = normalize_key(row[0])
            value = to_decimal(row[1])
            if not key or value is None:
                continue
            out[key] = value
        return out


def build_product_map(products: List[Dict[str, Any]], key_field: str) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    duplicate_keys: Dict[str, int] = {}
    for p in products:
        try:
            pid = int(p.get("id"))
        except Exception:
            continue

        product_name = str(p.get("name") or "")

        def add_target(raw_key: Any, price: Optional[Decimal], variant_label: str = "") -> None:
            key = normalize_key(raw_key)
            if not key or price is None:
                return
            if key in out:
                duplicate_keys[key] = duplicate_keys.get(key, 1) + 1
                # Keep first occurrence to avoid random key override.
                return
            name = product_name if not variant_label else f"{product_name} [{variant_label}]"
            out[key] = {
                "product_id": pid,
                "product_name": name,
                "product_key": str(raw_key or "").strip(),
                "site_price": price,
            }

        add_target(p.get(key_field), to_decimal(p.get("price")))

        variants = p.get("variants")
        if isinstance(variants, list):
            for variant in variants:
                if not isinstance(variant, dict):
                    continue
                v_code = variant.get("code")
                v_price = to_decimal(variant.get("price"))
                v_label = str(variant.get("weight") or variant.get("size") or "").strip()
                add_target(v_code, v_price, v_label)

    if duplicate_keys:
        sample = ", ".join(list(duplicate_keys.keys())[:10])
        logging.warning(
            "Foram encontrados codigos internos duplicados (%s chaves). Exemplo: %s",
            len(duplicate_keys),
            sample,
        )

    return out


def diff_prices(
    products_by_key: Dict[str, Dict[str, Any]],
    erp_prices: Dict[str, Decimal],
    threshold: Decimal,
) -> Tuple[List[Tuple[Dict[str, Any], Decimal]], List[str]]:
    mismatches: List[Tuple[Dict[str, Any], Decimal]] = []
    matching_alert_keys: List[str] = []

    for key, erp_price in erp_prices.items():
        target = products_by_key.get(key)
        if not target:
            continue
        site_price = to_decimal(target.get("site_price"))
        if site_price is None:
            continue

        if abs(site_price - erp_price) > threshold:
            mismatches.append((target, erp_price))
        else:
            pid = int(target.get("product_id"))
            pkey = normalize_key(target.get("product_key"))
            matching_alert_keys.append(f"{pid}|{pkey}")

    return mismatches, matching_alert_keys


def run_cycle(
    supa: SupabaseClient,
    erp: ErpReader,
    product_key_field: str,
    threshold: Decimal,
) -> None:
    products = supa.fetch_products()
    products_by_key = build_product_map(products, product_key_field)
    erp_prices = erp.fetch_prices()
    open_alerts = supa.fetch_open_alerts()

    mismatches, matching_alert_keys = diff_prices(products_by_key, erp_prices, threshold)

    created = 0
    updated = 0
    resolved = 0

    for target, erp_price in mismatches:
        product_id = int(target.get("product_id"))
        site_price = to_decimal(target.get("site_price"))
        if site_price is None:
            continue

        alert_key = f"{product_id}|{normalize_key(target.get('product_key'))}"
        existing = open_alerts.get(alert_key)
        if existing:
            supa.refresh_alert(
                alert_id=int(existing["id"]),
                site_price=site_price,
                erp_price=erp_price,
                occurrences=int(existing.get("occurrences") or 0),
            )
            updated += 1
        else:
            supa.create_alert(
                product_id=product_id,
                product_name=str(target.get("product_name") or ""),
                product_key=str(target.get("product_key") or ""),
                site_price=site_price,
                erp_price=erp_price,
            )
            created += 1

    for alert_key in matching_alert_keys:
        existing = open_alerts.get(alert_key)
        if not existing:
            continue
        supa.resolve_alert(int(existing["id"]))
        resolved += 1

    logging.info(
        "Price watch cycle: produtos=%s, erp=%s, mismatch=%s, novos=%s, atualizados=%s, resolvidos=%s",
        len(products_by_key),
        len(erp_prices),
        len(mismatches),
        created,
        updated,
        resolved,
    )


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(base_dir, ".env"))

    logging.basicConfig(
        level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if not bool_env("ERP_PRICE_WATCH_ENABLED", False):
        logging.info("ERP_PRICE_WATCH_ENABLED=false. Encerrando.")
        return 0

    try:
        supabase_url = required_env("SUPABASE_URL")
        supabase_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
        erp_conn = required_env("ERP_ODBC_CONN_STR")
        erp_price_query = required_env("ERP_PRICE_QUERY")

        product_key_field = os.getenv("ERP_PRICE_KEY_FIELD", "internal").strip() or "internal"
        poll_interval = int(os.getenv("ERP_PRICE_WATCH_POLL_SECONDS", "60"))
        threshold = to_decimal(os.getenv("ERP_PRICE_DIFF_THRESHOLD", "0.01")) or Decimal("0.01")

        supa = SupabaseClient(supabase_url, supabase_key, product_key_field=product_key_field)
        erp = ErpReader(erp_conn, erp_price_query)
    except Exception as exc:
        logging.error("Falha na inicializacao do monitor de preco ERP: %s", exc)
        return 1

    logging.info(
        "Monitor de preco ERP iniciado. key_field=%s, intervalo=%ss, threshold=%s",
        product_key_field,
        poll_interval,
        threshold,
    )

    while True:
        try:
            run_cycle(supa, erp, product_key_field, threshold)
        except Exception as cycle_err:
            logging.exception("Erro no ciclo do monitor de preco: %s", cycle_err)
        time.sleep(max(10, poll_interval))


if __name__ == "__main__":
    sys.exit(main())
