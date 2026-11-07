from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.config import Settings
from app.database import Base


def test_schema_compiles_for_postgresql():
    """Catches SQLite-only constructs without needing a running Postgres server."""
    dialect = postgresql.dialect()
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=dialect))
        assert "CREATE TABLE" in ddl
        for index in table.indexes:
            assert "CREATE" in str(CreateIndex(index).compile(dialect=dialect))
    big = str(CreateTable(Base.metadata.tables["transactions"]).compile(dialect=dialect))
    assert "BIGINT" in big  # money columns must not overflow on Postgres


def test_database_urls_from_hosting_providers_are_normalised():
    for scheme in ("postgres", "postgresql"):
        url = Settings(database_url=f"{scheme}://u:p@host/db").database_url
        assert url == "postgresql+psycopg://u:p@host/db"
    assert Settings(database_url="sqlite:///x.db").database_url == "sqlite:///x.db"
