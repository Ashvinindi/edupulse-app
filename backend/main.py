import os
import io
import json
import re
import time
import traceback
from typing import List
from fastapi import Depends, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from google import genai
from dotenv import load_dotenv

# Database Libraries
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from pydantic import BaseModel

load_dotenv()

# DATABASE SETUP (Neon PostgreSQL) 
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing in .env file!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# DB Table Model
class SavedNoteDB(Base):
    __tablename__ = "saved_notes"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, index=True)
    summary = Column(Text)
    key_points = Column(Text)  # Saved as JSON string
    mermaid_code = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def initialize_database():
    try:
        Base.metadata.create_all(bind=engine)
        print(" Database initialized successfully.")
    except SQLAlchemyError as exc:
        print(f" WARNING: Database unavailable during startup: {exc}")

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Schemas
class NoteSaveRequest(BaseModel):
    file_name: str
    summary: str
    key_points: List[str]
    mermaid_code: str

# Load Environment Variables
load_dotenv()

app = FastAPI(title="EduPulse API")


@app.on_event("startup")
def startup_database():
    initialize_database()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini API Key Verification
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print(" ERROR: GEMINI_API_KEY is missing from .env file!")
else:
    print(" GEMINI_API_KEY loaded successfully.")

gemini_client = genai.Client(api_key=api_key)

MODEL_CANDIDATES = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]


def generate_slide_summary(prompt: str):
    last_error = None

    for model_name in MODEL_CANDIDATES:
        for attempt in range(2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"},
                )
                return response.text.strip()
            except Exception as exc:  # pragma: no cover - defensive fallback
                last_error = exc
                if "404" in str(exc) or "NOT_FOUND" in str(exc):
                    break
                if attempt == 0:
                    time.sleep(1)
                    continue
                break

    raise RuntimeError(f"All Gemini model attempts failed. Last error: {last_error}")


@app.get("/")
def read_root():
    return {"status": "online", "message": "EduPulse Backend is running!"}


@app.post("/api/analyze_slide")
async def analyze_slide(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    extracted_text = ""

    try:
        # 1. Read PDF Bytes
        pdf_bytes = await file.read()
        pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = ""

        # 2. Extract Text
        for page in pdf_reader.pages[:10]:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Unable to extract text from the PDF. It might be an Image-only scan PDF .",
            )

        # 3. Gemini Prompt
        prompt = f"""
        You are an academic tutor analyzing a lecture slide deck.
        Analyze the text below and return a valid JSON object strictly matching this structure:
        {{
            "summary": "A concise 2-paragraph summary in markdown format.",
            "key_points": ["Key concept 1", "Key concept 2", "Key concept 3"],
            "mermaid_code": "graph TD;\\n  A[Concept A] --> B[Concept B];"
        }}

        Return ONLY raw JSON. Do NOT wrap in markdown code blocks.

        Lecture Text:
        {extracted_text[:4000]}
        """

        raw_text = generate_slide_summary(prompt)
        cleaned_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        parsed_data = json.loads(cleaned_json)

        return {"status": "success", "data": parsed_data, "file_name": file.filename}

    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail="The AI response was not valid JSON. Please try again with a cleaner PDF.",
        ) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail="AI analysis is temporarily unavailable. Please try again in a moment.",
        ) from exc


# 2. Save Note to Database
@app.post("/api/notes/save")
def save_note(note_data: NoteSaveRequest, db: Session = Depends(get_db)):
    try:
        new_note = SavedNoteDB(
            file_name=note_data.file_name,
            summary=note_data.summary,
            key_points=json.dumps(note_data.key_points),
            mermaid_code=note_data.mermaid_code,
        )
        db.add(new_note)
        db.commit()
        db.refresh(new_note)
        return {"status": "success", "message": "Note saved successfully!", "id": new_note.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 3. Get All Saved Notes
@app.get("/api/notes")
def get_all_notes(db: Session = Depends(get_db)):
    notes = db.query(SavedNoteDB).order_by(SavedNoteDB.created_at.desc()).all()
    results = []
    for n in notes:
        results.append({
            "id": n.id,
            "file_name": n.file_name,
            "summary": n.summary,
            "key_points": json.loads(n.key_points) if n.key_points else [],
            "mermaid_code": n.mermaid_code,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return {"status": "success", "notes": results}

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(SavedNoteDB).filter(SavedNoteDB.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    return {"status": "success", "message": "Note deleted successfully"}