from fastapi import FastAPI

app= FastAPI(
    title="A2UI Learning Agent",
    version="0.1.0"
)

@app.get("/")
def home():
    return {
        "message":"Welcome to A2UI Learning Agent",
    }

@app.get("/health")
def health():
    return {
        "status":" healthy"
    }
    