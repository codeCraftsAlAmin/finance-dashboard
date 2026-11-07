"""Tools and technologies to learn next."""

from fastapi import APIRouter, Query, status
from sqlalchemy import case, select

from app.deps import CurrentUser, DbSession, get_owned
from app.models import LearnTool
from app.schemas.life import ToolCreate, ToolRead, ToolStatus, ToolSummary, ToolUpdate

router = APIRouter(prefix="/tools", tags=["tools"])

_PRIORITY_ORDER = case(
    (LearnTool.priority == "high", 0), (LearnTool.priority == "medium", 1), else_=2
)

_DONE_LAST = case((LearnTool.status == "done", 1), else_=0)


@router.get("", response_model=list[ToolRead])
def list_tools(
    user: CurrentUser,
    db: DbSession,
    status_filter: ToolStatus | None = Query(default=None, alias="status"),
) -> list[LearnTool]:
    stmt = select(LearnTool).where(LearnTool.user_id == user.id)
    if status_filter:
        stmt = stmt.where(LearnTool.status == status_filter)
    return list(db.scalars(stmt.order_by(_DONE_LAST, _PRIORITY_ORDER, LearnTool.created_at.desc())))


@router.get("/summary", response_model=ToolSummary)
def summary(user: CurrentUser, db: DbSession) -> dict:
    tools = list(db.scalars(select(LearnTool).where(LearnTool.user_id == user.id)))
    by_priority = {"high": 0, "medium": 0, "low": 0}
    for tool in tools:
        if tool.status != "done":
            by_priority[tool.priority] += 1
    return {
        "next_count": sum(1 for t in tools if t.status == "next"),
        "learning_count": sum(1 for t in tools if t.status == "learning"),
        "done_count": sum(1 for t in tools if t.status == "done"),
        "by_priority": by_priority,
    }


@router.post("", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
def create_tool(payload: ToolCreate, user: CurrentUser, db: DbSession) -> LearnTool:
    tool = LearnTool(user_id=user.id, **payload.model_dump())
    db.add(tool)
    db.commit()
    return tool


@router.patch("/{tool_id}", response_model=ToolRead)
def update_tool(tool_id: int, payload: ToolUpdate, user: CurrentUser, db: DbSession) -> LearnTool:
    tool = get_owned(db, LearnTool, tool_id, user, "Tool")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tool, field, value)
    db.commit()
    return tool


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(tool_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, LearnTool, tool_id, user, "Tool"))
    db.commit()
