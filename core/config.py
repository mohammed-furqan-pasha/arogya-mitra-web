from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Loads and validates environment variables from the .env file.
    """
    # Supabase Credentials
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Gemini API Key
    GEMINI_API_KEY: str

    # Twilio Credentials
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str
    TWILIO_WHATSAPP_NUMBER: str
    TRACCAR_API_URL: str
    TRACCAR_PASSWORD: str
    SMSSYNC_SECRET_KEY: str
    BASE_URL: str

    # Google Cloud Service Account (for Google Sheets)SMSSYNC_SECRET_KEY: str
    # This should be the JSON content as a string
    GOOGLE_APPLICATION_CREDENTIALS_JSON: str

    class Config:
        # This tells pydantic to load variables from a .env file
        env_file = ".env"

# Create a single instance that can be imported throughout the application
settings = Settings()
