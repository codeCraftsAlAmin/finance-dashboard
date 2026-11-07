"""FastAPI application entry point."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.deps import DbSession
from app.routers import (
    auth,
    books,
    categories,
    challenges,
    dates,
    loans,
    overview,
    recurring,
    tools,
    transactions,
    vault,
)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Finance Dashboard API",
        version="1.0.0",
        docs_url="/api/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.docs_enabled else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Vault-Token"],
    )

    api = APIRouter(prefix="/api")
    for module in (
        auth,
        overview,
        categories,
        transactions,
        recurring,
        loans,
        books,
        dates,
        tools,
        challenges,
        vault,
    ):
        api.include_router(module.router)

    @api.get("/health", tags=["health"])
    def health(db: DbSession) -> dict[str, str]:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}

    app.include_router(api)
    return app


app = create_app()
