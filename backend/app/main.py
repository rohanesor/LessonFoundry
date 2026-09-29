from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.models import entities
from app.api.routes import router
from app.api.classroom_routes import router as classroom_router


@asynccontextmanager
async def lifespan(app):
    from app.config import log_configuration_status, validate_configuration
    from app.config_check import check_staging

    validate_configuration()
    log_configuration_status()
    if os.getenv("AUTH_MODE") == "supabase" or os.getenv("APP_ENV") in (
        "staging",
        "production",
    ):
        check_staging(engine)
    else:
        Base.metadata.create_all(engine, checkfirst=True)
    yield


app = FastAPI(title="LessonFoundry", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(classroom_router)  # specific student routes before legacy catch-all
app.include_router(router)
