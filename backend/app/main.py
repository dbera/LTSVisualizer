import sys
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.parser.puml_parser import parse_puml, parse_puml_file


def application_root() -> Path:
    """Return the source root or the PyInstaller bundle root."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)

    return Path(__file__).resolve().parents[2]


APP_ROOT = application_root()
SAMPLE_FILE = APP_ROOT / "sample-data" / "example.puml"
FRONTEND_DIST = APP_ROOT / "frontend" / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

app = FastAPI(
    title="LTSVisualizer API",
    version="0.1.0",
)

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


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "application": "LTSVisualizer",
    }


@app.get("/graph")
def get_graph() -> dict:
    if not SAMPLE_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="The bundled example graph was not found.",
        )

    graph = parse_puml_file(str(SAMPLE_FILE))
    return graph.to_dict()


@app.post("/graph/upload")
async def upload_graph(
    file: UploadFile = File(...),
) -> dict:
    filename = file.filename or ""

    if not filename.lower().endswith((".puml", ".plantuml", ".txt")):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please select a .puml, .plantuml, "
                "or compatible .txt file."
            ),
        )

    content_bytes = await file.read()

    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail="The selected file is not valid UTF-8 text.",
        ) from error

    if "@startuml" not in content:
        raise HTTPException(
            status_code=400,
            detail="The selected file does not contain @startuml.",
        )

    graph = parse_puml(content)

    if not graph.nodes:
        raise HTTPException(
            status_code=400,
            detail="No graph nodes were found in the selected file.",
        )

    return graph.to_dict()


if FRONTEND_ASSETS.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_ASSETS),
        name="frontend-assets",
    )


@app.get("/", include_in_schema=False)
def frontend_index():
    index_file = FRONTEND_DIST / "index.html"

    if index_file.exists():
        return FileResponse(index_file)

    return {
        "message": (
            "LTSVisualizer API is running, but the frontend "
            "production build was not found."
        ),
        "expected_frontend_path": str(FRONTEND_DIST),
    }
