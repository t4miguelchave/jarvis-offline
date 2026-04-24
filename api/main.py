import os
import sys
import base64
import tempfile
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make sure we can import from project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brain import ask_jarvis

app = FastAPI(
    title="Jarvis API",
    description="Personal AI Assistant — Jarvis Backend",
    version="1.0.0"
)

# Allow requests from the Ionic app (any origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage (per session_id)
sessions: dict[str, list] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    response: str
    session_id: str


@app.get("/health")
def health_check():
    """Check if the API is online."""
    return {"status": "online", "jarvis": "ready"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """Send a text message to Jarvis."""
    session_id = request.session_id
    if session_id not in sessions:
        sessions[session_id] = []

    history = sessions[session_id]

    response = ask_jarvis(request.message, history=history)

    # Update history
    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": response})

    # Keep last 20 messages
    if len(history) > 20:
        sessions[session_id] = history[-20:]

    return ChatResponse(response=response, session_id=session_id)


@app.post("/chat/image", response_model=ChatResponse)
async def chat_with_image(
    message: str = Form(default="O que está nesta imagem? Se for comida, calcula as calorias (kcal), proteínas, carboidratos e gorduras."),
    session_id: str = Form(default="default"),
    image: UploadFile = File(...)
):
    """Send a message with an image to Jarvis (e.g. calorie counting)."""
    try:
        contents = await image.read()
        image_base64 = base64.b64encode(contents).decode("utf-8")
        mime_type = image.content_type or "image/jpeg"

        session_id_val = session_id
        if session_id_val not in sessions:
            sessions[session_id_val] = []

        history = sessions[session_id_val]

        response = ask_jarvis(
            message,
            history=history,
            image_base64=image_base64,
            image_mime=mime_type
        )

        # Update history (text only for history, vision calls aren't stored as image)
        history.append({"role": "user", "content": f"[Imagem enviada] {message}"})
        history.append({"role": "assistant", "content": response})

        if len(history) > 20:
            sessions[session_id_val] = history[-20:]

        return ChatResponse(response=response, session_id=session_id_val)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar imagem: {str(e)}")


@app.post("/chat/video", response_model=ChatResponse)
async def chat_with_video(
    message: str = Form(default="O que está neste vídeo? Descreve o que vês."),
    session_id: str = Form(default="default"),
    video: UploadFile = File(...)
):
    """Send a message with a video to Jarvis (extracts first frame for analysis)."""
    try:
        import cv2
        import numpy as np

        contents = await video.read()

        # Write video to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # Extract first frame using OpenCV
        cap = cv2.VideoCapture(tmp_path)
        success, frame = cap.read()
        cap.release()
        os.unlink(tmp_path)

        if not success:
            raise HTTPException(status_code=400, detail="Não foi possível extrair frame do vídeo.")

        # Encode frame as JPEG base64
        _, buffer = cv2.imencode(".jpg", frame)
        image_base64 = base64.b64encode(buffer).decode("utf-8")

        session_id_val = session_id
        if session_id_val not in sessions:
            sessions[session_id_val] = []

        history = sessions[session_id_val]

        video_prompt = f"{message} (Esta é uma frame extraída de um vídeo)"
        response = ask_jarvis(
            video_prompt,
            history=history,
            image_base64=image_base64,
            image_mime="image/jpeg"
        )

        history.append({"role": "user", "content": f"[Vídeo enviado] {message}"})
        history.append({"role": "assistant", "content": response})

        if len(history) > 20:
            sessions[session_id_val] = history[-20:]

        return ChatResponse(response=response, session_id=session_id_val)

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="OpenCV não instalado. Instala com: pip install opencv-python-headless"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar vídeo: {str(e)}")


@app.delete("/chat/{session_id}")
def clear_session(session_id: str):
    """Clear conversation history for a session."""
    if session_id in sessions:
        del sessions[session_id]
    return {"message": "Histórico apagado", "session_id": session_id}
