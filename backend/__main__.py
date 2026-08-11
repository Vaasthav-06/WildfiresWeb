"""
Backend entry point. Run with:
    python -m backend
or:
    uvicorn backend.main:app --reload --port 8001
"""

from backend.main import serve


if __name__ == "__main__":
    serve()
