import os
import sys
import base64
import tempfile
import uuid
from io import BytesIO
from typing import Optional, List

from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Make sure we can import from project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brain import ask_jarvis
from core.database import engine, get_db
from core import models

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Jarvis API",
    description="Personal AI Assistant — Jarvis Backend with Cloud Sync",
    version="2.1.0"
)

# Allow requests from the Ionic app (any origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    user_id: str = "miguel_admin"

class ChatResponse(BaseModel):
    response: str
    session_id: str

# ---- CLOUD SYNC SCHEMAS ----

class MessageSchema(BaseModel):
    role: str
    content: str
    type: str
    imagePreview: Optional[str] = None
    timestamp: str

class ConversationSchema(BaseModel):
    id: str
    title: str
    preview: str
    createdAt: str
    updatedAt: str
    messages: List[MessageSchema]

# ---- HELPER TO GET HISTORY ----
def get_history_from_db(db: Session, session_id: str):
    conv = db.query(models.DBConversation).filter(models.DBConversation.id == session_id).first()
    if not conv:
        return []
    
    # Sort messages by timestamp
    msgs = sorted(conv.messages, key=lambda m: m.timestamp)
    # Return last 20 messages as dicts for LLaMA
    history = [{"role": m.role, "content": m.content} for m in msgs]
    return history[-20:]

@app.get("/health")
def health_check():
    return {"status": "online", "jarvis": "ready"}

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    history = get_history_from_db(db, request.session_id)
    response = ask_jarvis(request.message, history=history)
    return ChatResponse(response=response, session_id=request.session_id)


@app.post("/chat/image", response_model=ChatResponse)
async def chat_with_image(
    message: str = Form(...),
    session_id: str = Form(default="default"),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        contents = await image.read()
        image_base64 = base64.b64encode(contents).decode("utf-8")
        mime_type = image.content_type or "image/jpeg"

        history = get_history_from_db(db, session_id)
        response = ask_jarvis(
            message,
            history=history,
            image_base64=image_base64,
            image_mime=mime_type
        )
        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar imagem: {str(e)}")


@app.post("/chat/video", response_model=ChatResponse)
async def chat_with_video(
    message: str = Form(...),
    session_id: str = Form(default="default"),
    video: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        import cv2
        import numpy as np

        contents = await video.read()
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        success, frame = cap.read()
        cap.release()
        os.unlink(tmp_path)

        if not success:
            raise HTTPException(status_code=400, detail="Não foi possível extrair frame do vídeo.")

        _, buffer = cv2.imencode(".jpg", frame)
        image_base64 = base64.b64encode(buffer).decode("utf-8")

        history = get_history_from_db(db, session_id)
        video_prompt = f"{message} (Esta é uma frame extraída de um vídeo)"
        
        response = ask_jarvis(
            video_prompt,
            history=history,
            image_base64=image_base64,
            image_mime="image/jpeg"
        )
        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar vídeo: {str(e)}")


# ---- CLOUD SYNC ENDPOINTS ----

@app.get("/cloud/conversations")
def get_conversations(user_id: str = "miguel_admin", db: Session = Depends(get_db)):
    """Fetch all conversations for a user."""
    convs = db.query(models.DBConversation).filter(models.DBConversation.user_id == user_id).all()
    
    result = []
    for c in convs:
        msgs = [{"role": m.role, "content": m.content, "type": m.type, "imagePreview": m.image_preview, "timestamp": m.timestamp.isoformat()} for m in c.messages]
        result.append({
            "id": c.id,
            "title": c.title,
            "preview": c.preview,
            "createdAt": c.created_at.isoformat(),
            "updatedAt": c.updated_at.isoformat(),
            "messages": msgs
        })
    return result

@app.post("/cloud/conversation")
def save_conversation(conv: ConversationSchema, user_id: str = "miguel_admin", db: Session = Depends(get_db)):
    """Upsert a conversation from the client to the cloud database."""
    import datetime
    from dateutil import parser
    
    db_conv = db.query(models.DBConversation).filter(models.DBConversation.id == conv.id).first()
    
    if not db_conv:
        db_conv = models.DBConversation(
            id=conv.id,
            user_id=user_id,
            title=conv.title,
            preview=conv.preview,
            created_at=parser.parse(conv.createdAt),
            updated_at=parser.parse(conv.updatedAt)
        )
        db.add(db_conv)
    else:
        db_conv.title = conv.title
        db_conv.preview = conv.preview
        db_conv.updated_at = parser.parse(conv.updatedAt)
        
        # Clear old messages to prevent duplicates (simplest sync strategy)
        db.query(models.DBMessage).filter(models.DBMessage.conversation_id == conv.id).delete()
    
    db.commit()
    
    # Insert new messages
    for m in conv.messages:
        db_msg = models.DBMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            role=m.role,
            type=m.type,
            content=m.content,
            image_preview=m.imagePreview,
            timestamp=parser.parse(m.timestamp)
        )
        db.add(db_msg)
        
    db.commit()
    return {"status": "success"}

@app.delete("/chat/{session_id}")
def delete_conversation(session_id: str, db: Session = Depends(get_db)):
    db.query(models.DBConversation).filter(models.DBConversation.id == session_id).delete()
    db.commit()
    return {"status": "deleted"}

# ---- CLOUD TASKS ENDPOINTS ----

class TaskSchema(BaseModel):
    id: str
    title: str
    isCompleted: bool
    dueDate: Optional[str] = None

@app.get("/cloud/tasks")
def get_tasks(user_id: str = "miguel_admin", db: Session = Depends(get_db)):
    tasks = db.query(models.DBTask).filter(models.DBTask.user_id == user_id).all()
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "title": t.title,
            "isCompleted": t.is_completed,
            "dueDate": t.due_date.isoformat() if t.due_date else None
        })
    return result

@app.post("/cloud/tasks")
def add_task(task: TaskSchema, user_id: str = "miguel_admin", db: Session = Depends(get_db)):
    from dateutil import parser
    db_task = models.DBTask(
        id=task.id,
        user_id=user_id,
        title=task.title,
        is_completed=task.isCompleted,
        due_date=parser.parse(task.dueDate) if task.dueDate else None
    )
    db.add(db_task)
    db.commit()
    return {"status": "success"}

@app.put("/cloud/tasks/{task_id}")
def update_task(task_id: str, task: TaskSchema, db: Session = Depends(get_db)):
    from dateutil import parser
    db_task = db.query(models.DBTask).filter(models.DBTask.id == task_id).first()
    if db_task:
        db_task.title = task.title
        db_task.is_completed = task.isCompleted
        db_task.due_date = parser.parse(task.dueDate) if task.dueDate else None
        db.commit()
    return {"status": "updated"}

@app.delete("/cloud/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    db.query(models.DBTask).filter(models.DBTask.id == task_id).delete()
    db.commit()
    return {"status": "deleted"}
