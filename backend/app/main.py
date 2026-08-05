from fastapi import FastAPI, File, HTTPException, UploadFile

from fastapi.middleware.cors import CORSMiddleware
from app.parser.puml_parser import parse_puml, parse_puml_file


app = FastAPI(
    title="Reachability Graph Dashboard API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> dict:
    return {
        "message": "Reachability Graph Dashboard API is running"
    }


@app.get("/graph")
def get_graph() -> dict:
    graph = parse_puml_file("../sample-data/example.puml")
    return graph.to_dict()


@app.post("/graph/upload")
async def upload_graph(
    file: UploadFile = File(...),
) -> dict:
    filename = file.filename or ""

    if not filename.lower().endswith((".puml", ".plantuml")):
        raise HTTPException(
            status_code=400,
            detail="Please select a .puml or .plantuml file.",
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