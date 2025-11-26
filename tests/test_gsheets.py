import os
import sys
import pytest
from dotenv import load_dotenv
# This import now works correctly because of pyproject.toml
from services.gsheets_service import GSheetsService
# Load environment variables from .env file for testing
load_dotenv()
# Ensure project root is on sys.path so 'services' can be imported
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
# Condition to skip the test if Google credentials are not in the environment .
skip_if_no_creds = pytest.mark.skipif(
    not os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON"),
    reason="Google application credentials are not set."
)

@skip_if_no_creds
@pytest.mark.asyncio
async def test_get_health_info():
    """
    Tests the connection to Google Sheets and retrieval of a specific topic.
    This is an integration test that requires a live connection.
    """
    # ARRANGE: Instantiate the service and define a known topic
    gsheets_service = GSheetsService()
    known_topic = "Dengue"  # This must exist in your Google Sheet

    # ACT: Fetch the health info for the known topic
    info = await gsheets_service.get_health_info(known_topic)

    # ASSERT: Verify that the correct data was returned
    assert info is not None, f"The topic '{known_topic}' was not found in the Google Sheet."
    assert isinstance(info, dict), "The returned data should be a dictionary."
    
    # Verify the structure and content of the returned data
    assert 'topic' in info, "The returned data must have a 'topic' key."
    assert info['topic'].lower() == known_topic.lower(), "The topic in the returned data should match the search topic."
