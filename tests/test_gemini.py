import os
import sys
import pytest
from dotenv import load_dotenv

# Ensure project root is on sys.path so 'services' and 'models' can be imported
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from services.gemini_service import GeminiService
from models.schemas import User

# Load environment variables from .env file for testing
load_dotenv()

# Condition to skip the test if the Gemini API key is not set in the environment
skip_if_no_key = pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY is not set in the environment."
)

@skip_if_no_key
@pytest.mark.asyncio
async def test_gemini_api_connection():
    """
    Tests that the GeminiService can successfully connect to the API and get a response.
    This is a simple integration test to verify credentials and connectivity.
    """
    # ARRANGE: Instantiate the service and create dummy data for the call
    gemini_service = GeminiService()
    # The get_ai_response method requires a User object, so we create a minimal one for this test.
    dummy_user = User(phone_number="test_user", language="English")
    simple_prompt = "hello"

    # ACT: Call the service to get a response from the live API
    response = await gemini_service.get_ai_response(
        user_message=simple_prompt,
        user_profile=dummy_user,
        chat_history=[] # Pass an empty history for this simple test
    )

    # ASSERT: Verify that we received a valid, non-empty string response
    assert isinstance(response, str), "The response should be a string."
    assert len(response) > 0, "The response should not be empty."
