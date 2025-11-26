# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

All commands assume the repository root as the working directory.

### Environment & dependencies

- Install Python dependencies (after activating your virtualenv if used):
  - `pip install -r requirements.txt`

Environment configuration is loaded via `core/config.py` using `pydantic-settings` with `env_file = ".env"`. You must provide all required variables (Supabase, Gemini, Twilio, Traccar, Google Sheets, etc.) in `.env` or the environment for the app and integration tests to function.

### Run the API server

FastAPI app entrypoint is `main.py` with the application instance `app`.

- Start a development server with auto-reload:
  - `uvicorn main:app --reload`

The app exposes:
- `GET /` – simple status check (`{"status": "Arogya Mitra is running"}`).
- `POST /api/sms` – SMSSync-style webhook secured by `SMSSYNC_SECRET_KEY` form field.
- `POST /api/whatsapp` – Twilio webhook secured by Twilio request signature.

There is also a background polling task that starts on application startup and continuously polls the Traccar API for messages using token-based authentication.

### Linting

Linting is configured in `.github/workflows/ci.yml` using Flake8.

- Run the same lint command as CI:
  - `flake8 . --count --max-complexity=10 --statistics --ignore=E501,F401,E302,E305,W293,E261`

### Tests

Tests live under `tests/` and are mostly integration tests that talk to real external services. They are skipped automatically if required credentials are missing.

- Run the full test suite (mirrors CI):
  - POSIX shells: `PYTHONPATH=. pytest tests/ --disable-warnings -q`
  - PowerShell: `$env:PYTHONPATH='.'; pytest tests/ --disable-warnings -q`

- Run a single test file:
  - `pytest tests/test_gemini.py -q`

- Run a single test function, e.g. the Gemini connectivity test:
  - `pytest tests/test_gemini.py::test_gemini_api_connection -q`

## High-level architecture

### Overview

This project is an AI-powered public health assistant (“Arogya Mitra”) built on FastAPI. It integrates multiple channels (SMSSync, WhatsApp via Twilio, and Traccar), a Supabase-backed persistence layer, Google Sheets as a health knowledge base, and Google Gemini for generative responses.

At a high level:
- `main.py` defines the FastAPI app, HTTP endpoints, and background polling for Traccar.
- `core/config.py` centralizes configuration via environment variables.
- `models/schemas.py` defines core Pydantic models shared across services.
- `services/` contains small, focused service classes for each external system.
- `tests/` contains integration-style tests for each external dependency.

### Request and message flow

1. **Ingress channels**
   - **SMSSync Webhook** (`POST /api/sms`):
     - Accepts form fields `secret`, `message`, and `from` (aliased to `from_`).
     - Validates `secret` against `settings.SMSSYNC_SECRET_KEY`.
     - Delegates to `handle_incoming_message` as a background task.
   - **Twilio WhatsApp Webhook** (`POST /api/whatsapp`):
     - Reads form data from the request.
     - Validates the request using `twilio.request_validator.RequestValidator` with `settings.TWILIO_AUTH_TOKEN` and `X-Twilio-Signature`, checking against `settings.BASE_URL`.
     - Extracts `From` and `Body` fields and delegates to `handle_incoming_message` as a background task.
   - **Traccar Polling**:
     - `poll_traccar_for_sms` runs in a loop as a background task started by the `@app.on_event("startup")` handler.
     - Uses an `httpx.AsyncClient` with `Authorization: Bearer {settings.TRACCAR_TOKEN}` to poll `${TRACCAR_API_URL}/api/messages`.
     - For each message, invokes `process_message_logic` and then deletes the message from Traccar.

2. **Core routing logic** (`handle_incoming_message` and `process_message_logic` in `main.py`)
   - `handle_incoming_message` is the central entrypoint for all non-Traccar messages:
     - Logs the incoming message.
     - Performs a simple keyword scan against `CRITICAL_KEYWORDS` (e.g., "suicide", "heart attack", "chest pain").
     - If a critical keyword is detected, it schedules a background task to immediately send a pre-defined emergency response via `NotificationService`.
     - Otherwise, it schedules `process_message_logic` in the background.
   - `process_message_logic` encapsulates the main AI conversation flow:
     - Fetches user profile from `DatabaseService.get_user`. If no profile exists, creates a new `User` record with the phone number and persists it via `create_or_update_user`.
     - Retrieves recent chat history for the user via `DatabaseService.get_chat_history`.
     - Calls `GeminiService.get_ai_response` with the current message, user profile, and chat history to generate the response text.
     - Persists both the user message and the AI response as `ChatMessage` records via `DatabaseService.save_chat_message`.
     - Sends the AI response back to the user via `NotificationService.send_sms`.

This split allows you to add new ingress channels (e.g., another webhook) by reusing the same `handle_incoming_message` and `process_message_logic` functions.

### Configuration and models

- `core/config.py`:
  - Uses `Settings(BaseSettings)` to load all required credentials and configuration values (Supabase, Gemini, Twilio, Traccar, SMSSync, base URL, Google credentials) from environment variables or `.env`.
  - Exposes a singleton `settings = Settings()` that is imported by `main.py` and all services.

- `models/schemas.py`:
  - `User`: Captures phone number, language, optional age, and presence of chronic conditions (`has_diabetes`, `has_hypertension`, `other_conditions`). This is used both for persistence and as structured context passed into Gemini.
  - `ChatMessage`: Represents a single message in the conversation history with `phone_number`, `sender` (`"user"` or `"bot"`), and `message_text`.

These models are the shared contract between the FastAPI layer, Supabase storage, and the Gemini prompt construction.

### Services layer

Each service in `services/` is responsible for one external integration and is designed to be imported and reused wherever needed.

- `services/database_service.py` – **Supabase persistence**
  - Initializes an asynchronous Supabase `AsyncClient` using `settings.SUPABASE_URL` and `settings.SUPABASE_KEY`.
  - `get_user(phone_number)`: Fetches a user record from the `users` table.
  - `create_or_update_user(user_data: User)`: Upserts a user profile into `users`.
  - `save_chat_message(message: ChatMessage)`: Inserts a new record into the `chat_history` table.
  - `get_chat_history(phone_number, limit=5)`: Retrieves recent chat history sorted by `created_at` descending, then reverses it to chronological order.

- `services/gemini_service.py` – **Google Gemini interaction**
  - Configures `google.generativeai` with `settings.GEMINI_API_KEY` and initializes `GenerativeModel('gemini-1.5-flash-latest')` on construction.
  - Maintains a rich `SYSTEM_INSTRUCTION` that defines the assistant persona, scope, and a requirement for concise answers.
  - `get_ai_response(user_message, user_profile: User, chat_history)`: Builds a multi-part prompt including system instruction, user health profile, recent chat transcript, and the latest user message; calls `generate_content_async` and returns `response.text`.

- `services/gsheets_service.py` – **Google Sheets knowledge base**
  - Parses `GOOGLE_APPLICATION_CREDENTIALS_JSON` from the environment and uses `gspread.service_account_from_dict` to authenticate.
  - Opens a configured sheet (default name `"HealthDB"`), reads `sheet1`, and loads all records into memory for fast lookups.
  - `get_health_info(topic)`: Performs a case-insensitive search by `topic` field and returns the matching row dict or `None`.

- `services/notification_service.py` – **Twilio notifications**
  - Initializes a `twilio.rest.Client` using `settings.TWILIO_ACCOUNT_SID` and `settings.TWILIO_AUTH_TOKEN` and stores `settings.TWILIO_PHONE_NUMBER` as the default sender.
  - `send_sms(to_number, message_body)`: Async wrapper around the Twilio client using `asyncio.to_thread`:
    - Uses the standard SMS number by default.
    - If `to_number` starts with `"whatsapp:"`, switches the sender to `whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}`.

### Testing strategy

Tests under `tests/` are primarily integration tests, each guarded by environment-variable-based skip conditions so they do not run without real credentials:

- `tests/test_database.py` – Supabase user profile integration.
- `tests/test_gemini.py` – Gemini connectivity and response retrieval.
- `tests/test_gsheets.py` – Google Sheets connectivity and topic lookup.
- `tests/test_twilio.py` – Twilio client initialization.

These tests are useful as connectivity checks and examples of how to exercise each service in isolation. They rely on the same configuration scheme as the main app (dotenv + environment variables).