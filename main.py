import logging
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.schemas import User, ChatMessage
from services.database_service import DatabaseService
from services.gemini_service import GeminiService

# --- Logging setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FastAPI app ---
app = FastAPI(title="Arogya Mitra API")

# --- CORS (allow all origins so the standalone frontend can call this API) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # later you can restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Services ---
db_service = DatabaseService()
gemini_service = GeminiService()

# --- Safety configuration ---
CRITICAL_KEYWORDS = [
    "suicide",
    "kill myself",
    "want to die",
    "heart attack",
    "chest pain",
    "can't breathe",
    "unconscious",
    "poison",
    "accident",
    "bleeding heavily",
]

CRITICAL_RESPONSE_MESSAGE = (
    "This seems like a critical situation. Please contact emergency services "
    "immediately by calling 108. This is an AI assistant and not a substitute "
    "for a medical professional."
)

# --- Pydantic models ---


class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    response: str


# --- Helpers ---


async def get_or_create_user(user_id: str) -> User:
    """Use user_id as the stable identifier, mapped to the existing phone_number field."""
    existing: Optional[Dict[str, Any]] = await db_service.get_user(user_id)
    if existing:
        return User(**existing)

    user = User(phone_number=user_id)
    await db_service.create_or_update_user(user)
    logger.info(f"Created new user profile for user_id={user_id}")
    return user


# --- API endpoints ---


@app.get("/")
async def root():
    """Simple status endpoint for the API."""
    return {"status": "Arogya Mitra API is running"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """Main chat endpoint for the decoupled frontend.

    Expects JSON:
      { "user_id": "...", "message": "..." }

    Returns:
      { "response": "AI response here" }
    """
    user_id = payload.user_id.strip()
    message = payload.message.strip()

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty.")

    logger.info(f"Chat message from user_id={user_id}: '{message}'")

    # Safety: critical keyword check
    if any(k in message.lower() for k in CRITICAL_KEYWORDS):
        ai_response_text = CRITICAL_RESPONSE_MESSAGE
    else:
        # Fetch or create user profile
        user_profile = await get_or_create_user(user_id)

        # Get recent chat history for context
        history: List[Dict[str, Any]] = await db_service.get_chat_history(user_id)

        # Ask Gemini
        ai_response_text = await gemini_service.get_ai_response(
            user_message=message,
            user_profile=user_profile,
            chat_history=history,
        )

    # Persist conversation (best-effort)
    try:
        await db_service.save_chat_message(
            ChatMessage(phone_number=user_id, sender="user", message_text=message)
        )
        await db_service.save_chat_message(
            ChatMessage(phone_number=user_id, sender="bot", message_text=ai_response_text)
        )
    except Exception as e:
        logger.error(f"Error saving chat messages for user_id={user_id}: {e}")

    return ChatResponse(response=ai_response_text)
