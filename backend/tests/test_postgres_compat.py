from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.database import Base


def test_schema_compiles_for_postgres():
    dialect = postgresql.dialect()
    for table in Base.metadata.sorted_tables:
        sql = str(CreateTable(table).compile(dialect=dialect))
        assert "CREATE TABLE" in sql
        for index in table.indexes:
            str(CreateIndex(index).compile(dialect=dialect))


def test_stats_queries_compile_for_postgres():
    from sqlalchemy import extract, func, select

    from app.models import Transaction

    stmt = select(extract("year", Transaction.date), extract("month", Transaction.date), func.sum(Transaction.amount_minor))
    assert "EXTRACT" in str(stmt.compile(dialect=postgresql.dialect()))
