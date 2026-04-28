import os
import base64
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Model for text-only conversations
TEXT_MODEL = "llama-3.3-70b-versatile"
# Model with vision support (images/video frames)
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

SYSTEM_PROMPT = """You are Jarvis, a personal AI assistant. 
IMPORTANT RULES FOR YOUR TONE:
- Speak casually, like a friend (mano, tlgd, etc). Use Portuguese (PT-PT or PT-BR as appropriate).
- KEEP YOUR RESPONSES EXTREMELY SHORT AND DIRECT unless specifically asked for a detailed explanation. Don't be robotic.
- When you are asked to draft an email, YOU MUST append exactly "[ACTION: EMAIL]" at the very end of your response so the app knows to show an email button.
- When asked to write code, write clean, working code with brief explanations. Use markdown code blocks (```language).
- When analyzing food images, provide quick nutritional info (calories, protein, carbs, fats)."""


def ask_jarvis(prompt: str, history: list = [], image_base64: str = None, image_mime: str = "image/jpeg") -> str:
    """Send a prompt to Jarvis and get a response. Supports conversation history and images."""

    if image_base64:
        # Use vision model when image is provided
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history)
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_mime};base64,{image_base64}"
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        })

        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
    else:
        # Text-only conversation
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )

    return response.choices[0].message.content
