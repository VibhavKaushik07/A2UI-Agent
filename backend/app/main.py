import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import Base, engine, get_db, Conversation, Message, Lesson
from app.schemas.lesson import Question, LessonSpec, Progress, ActionEnvelope
from app.agents.planner import plan
from app.a2ui.protocol import catalog, messages, delete


@asynccontextmanager
async def lifespan(app):
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="A2UI Learning Agent", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH"}:
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 100_000:
                return JSONResponse(
                    status_code=413,
                    content={"error": {"message": "Request exceeds 100 KB"}},
                )
        request._body = bytes(data)
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse(
        status_code=exc.status_code, content={"error": {"message": str(exc.detail)}}
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "message": "Invalid request fields",
                "details": [
                    {"field": list(e["loc"]), "message": e["msg"]} for e in exc.errors()
                ],
            }
        },
    )


@app.exception_handler(Exception)
async def internal_error(request, exc):
    logging.exception("Request failed")
    return JSONResponse(
        status_code=500,
        content={"error": {"message": "The service could not complete this request."}},
    )


def get_record(db, model, id):
    record = db.get(model, id)
    if not record:
        raise HTTPException(404, "Record not found")
    return record


@app.get("/")
def home():
    return {"message": "Welcome to A2UI Learning Agent", "docs": "/docs"}


@app.get("/health")
@app.get("/api/v1/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "mode": "demo" if settings.demo_mode else "ai",
        "protocol": "v0.9.1",
    }


@app.get("/api/v1/catalog")
def get_catalog():
    return catalog()


@app.post("/api/v1/conversations", status_code=201)
def create_conversation(db: Session = Depends(get_db)):
    c = Conversation()
    db.add(c)
    db.commit()
    return {"id": c.id, "title": c.title}


@app.get("/api/v1/conversations")
def conversations(db: Session = Depends(get_db)):
    return [
        {"id": c.id, "title": c.title}
        for c in db.scalars(
            select(Conversation).order_by(Conversation.created_at.desc()).limit(100)
        )
    ]


def lesson_payload(lesson, create=True):
    legacy = {
        **lesson.spec,
        "blocks": [
            {"nodes": [], "edges": [], **block} for block in lesson.spec["blocks"]
        ],
    }
    spec = LessonSpec.model_validate(legacy)
    return {
        "id": lesson.id,
        "spec": lesson.spec,
        "progress": lesson.progress,
        "mode": lesson.mode,
        "revision": lesson.revision,
        "messages": messages(spec, lesson.id, lesson.progress, create),
    }


@app.get("/api/v1/conversations/{id}")
def conversation(id: str, db: Session = Depends(get_db)):
    c = get_record(db, Conversation, id)
    history = db.scalars(
        select(Message)
        .where(Message.conversation_id == id)
        .order_by(Message.created_at)
    ).all()
    lesson = db.scalar(select(Lesson).where(Lesson.conversation_id == id))
    return {
        "id": id,
        "title": c.title,
        "notes": c.notes,
        "messages": [{"role": m.role, "content": m.content} for m in history],
        "lesson": lesson_payload(lesson) if lesson else None,
    }


@app.get("/api/v1/lessons/{id}")
def get_lesson(id: str, db: Session = Depends(get_db)):
    return lesson_payload(get_record(db, Lesson, id))


locks: dict[str, asyncio.Lock] = {}


@app.post("/api/v1/conversations/{id}/questions")
async def question(
    id: str, body: Question, stream: bool = False, db: Session = Depends(get_db)
):
    c = get_record(db, Conversation, id)
    lock = locks.setdefault(id, asyncio.Lock())
    if lock.locked():
        raise HTTPException(
            409, "A lesson is already being generated for this conversation"
        )
    async with lock:
        lesson = db.scalar(select(Lesson).where(Lesson.conversation_id == id))
        history = [
            {"role": m.role, "content": m.content}
            for m in db.scalars(
                select(Message)
                .where(Message.conversation_id == id)
                .order_by(Message.created_at.desc())
                .limit(12)
            )
        ][::-1]
        notes = c.notes if body.notes is None else body.notes
        try:
            previous = (
                {
                    **lesson.spec,
                    "blocks": [
                        {"nodes": [], "edges": [], **block}
                        for block in lesson.spec["blocks"]
                    ],
                }
                if lesson
                else None
            )
            spec, mode = await asyncio.wait_for(
                plan(body.question, notes, history, previous),
                timeout=settings.model_timeout + 10,
            )
            messages(spec, lesson.id if lesson else "validation")
        except Exception as exc:
            logging.warning("Lesson generation failed: %s", type(exc).__name__)
            raise HTTPException(
                502,
                "Lesson generation failed. Check AI configuration or try a simpler question.",
            ) from exc
        created = lesson is None
        replaced = lesson is not None and [
            b["kind"] for b in lesson.spec["blocks"]
        ] != [b.kind for b in spec.blocks]
        if lesson is None:
            lesson = Lesson(conversation_id=id, spec=spec.model_dump(), mode=mode)
            db.add(lesson)
        else:
            lesson.spec, lesson.mode = spec.model_dump(), mode
            lesson.progress = {}
            lesson.revision += 1
        c.notes = notes
        c.title = spec.title
        db.add_all(
            [
                Message(conversation_id=id, role="user", content=body.question),
                Message(
                    conversation_id=id,
                    role="assistant",
                    content=spec.title + ": " + spec.objective,
                ),
            ]
        )
        db.commit()
        payload = lesson_payload(lesson, created or replaced)
        if replaced:
            payload["messages"].insert(0, delete(lesson.id))
    if not stream:
        return payload

    async def events():
        yield (
            "event: lesson\ndata: "
            + json.dumps({k: v for k, v in payload.items() if k != "messages"})
            + "\n\n"
        )
        for message in payload["messages"]:
            yield "event: a2ui\ndata: " + json.dumps(message) + "\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.put("/api/v1/lessons/{id}/progress")
def save_progress(id: str, body: Progress, db: Session = Depends(get_db)):
    lesson = db.scalar(select(Lesson).where(Lesson.id == id).with_for_update())
    if not lesson:
        raise HTTPException(404, "Record not found")
    if int(body.component_id.split("-")[1]) >= len(lesson.spec["blocks"]):
        raise HTTPException(422, "Unknown component")
    from app.services.progress import validate_state

    try:
        validate_state(
            lesson.spec["blocks"][int(body.component_id.split("-")[1])], body.state
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    lesson.progress = {**lesson.progress, body.component_id: body.state}
    db.commit()
    return {"saved": True}


@app.post("/api/v1/conversations/{id}/actions")
async def action(id: str, envelope: ActionEnvelope, db: Session = Depends(get_db)):
    body = envelope.model_dump()
    from jsonschema import Draft202012Validator, FormatChecker
    from app.a2ui.protocol import SCHEMA_DIR

    schema = json.loads((SCHEMA_DIR / "client_to_server.json").read_text())
    if not Draft202012Validator(schema, format_checker=FormatChecker()).is_valid(body):
        raise HTTPException(422, "Invalid A2UI action envelope")
    event = body.get("action", {})
    lesson = db.scalar(select(Lesson).where(Lesson.conversation_id == id))
    if (
        not lesson
        or event.get("surfaceId") != lesson.id
        or event.get("name") != "explain_further"
    ):
        raise HTTPException(422, "Unknown action or surface")
    if event.get("sourceComponentId") not in [
        f"block-{i}" for i in range(len(lesson.spec["blocks"]))
    ]:
        raise HTTPException(422, "Unknown component")
    return await question(
        id,
        Question(
            question="Explain the current lesson more simply with another example."
        ),
        False,
        db,
    )


@app.delete("/api/v1/lessons/{id}")
def delete_lesson(id: str, db: Session = Depends(get_db)):
    lesson = get_record(db, Lesson, id)
    db.delete(lesson)
    db.commit()
    return delete(id)
