from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scan_router import router as scan_router

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)

# Routes
app.include_router(scan_router)