import os
import sys
from typing import List

import pyodbc
from dotenv import load_dotenv


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Variável obrigatória ausente: {name}")
    return value


def print_rows(title: str, rows: List[tuple]) -> None:
    print(f"\n=== {title} ===")
    if not rows:
        print("(sem resultados)")
        return
    for row in rows:
        print(" | ".join(["" if v is None else str(v) for v in row]))


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(base_dir, ".env"))

    conn_str = required_env("ERP_ODBC_CONN_STR")

    conn = pyodbc.connect(conn_str, timeout=10)
    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE='BASE TABLE'
              AND (
                LOWER(TABLE_NAME) LIKE '%client%'
                OR LOWER(TABLE_NAME) LIKE '%cadastro%'
                OR LOWER(TABLE_NAME) LIKE '%pessoa%'
                OR LOWER(TABLE_NAME) LIKE '%consumidor%'
              )
            ORDER BY TABLE_SCHEMA, TABLE_NAME
            """
        )
        table_rows = cur.fetchall()
        print_rows("Tabelas candidatas", [tuple(r) for r in table_rows])

        if not table_rows:
            cur.execute(
                """
                SELECT TOP 50 TABLE_SCHEMA, TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE='BASE TABLE'
                ORDER BY TABLE_SCHEMA, TABLE_NAME
                """
            )
            print_rows("Primeiras tabelas do banco", [tuple(r) for r in cur.fetchall()])
            return 0

        for schema_name, table_name in table_rows:
            cur.execute(
                """
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
                """,
                schema_name,
                table_name,
            )
            cols = cur.fetchall()
            print_rows(f"Colunas de {schema_name}.{table_name}", [tuple(r) for r in cols])

    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Erro: {exc}")
        sys.exit(1)
