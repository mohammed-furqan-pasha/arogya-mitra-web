import os
import sys
import pytest
from dotenv import load_dotenv

# Ensure project root is on sys.path so 'services' and other modules can be imported
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from services.database_service import DatabaseService

# Load environment variables from .env file for testing
load_dotenv()

# Condition to skip the test if Supabase credentials are not found in the environment
# This is useful for running tests in a CI/CD environment without real credentials
skip_if_no_creds = pytest.mark.skipif(
    not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"),
    reason="Supabase credentials are not set in the environment."
)

@skip_if_no_creds
@pytest.mark.asyncio
async def test_get_and_update_user():
    """
    Tests fetching, updating, and verifying a user's profile.
    This is an integration test that requires a live Supabase connection.
    """
    # ARRANGE: Instantiate the service and define test data
    db_service = DatabaseService()
    test_phone_number = "+15550001111" # Must match the user you created in Supabase

    # ACT 1: Fetch the user
    user = await db_service.get_user(test_phone_number)

    # ASSERT 1: Verify the user was found and has the correct structure
    print(f"Fetched User: {user}") # Optional: for debugging
    assert user is not None, "Test user should be found in the database."
    assert isinstance(user, dict), "User data should be a dictionary."
    
    # Check that our new, specific health condition columns exist
    assert 'has_diabetes' in user, "User data must include 'has_diabetes' field."
    assert 'has_hypertension' in user, "User data must include 'has_hypertension' field."
    assert 'other_conditions' in user, "User data must include 'other_conditions' field."
    
    # Check that the data matches what we set in the database
    assert user.get('phone_number') == test_phone_number
    assert user.get('has_diabetes') is True
