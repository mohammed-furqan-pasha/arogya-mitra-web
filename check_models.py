import os

import google.generativeai as genai
from dotenv import load_dotenv

# 1. Load your API key from the .env file
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ Error: GEMINI_API_KEY not found in .env file.")
    raise SystemExit(1)

print(f"✅ Found API Key: {api_key[:5]}... (hidden)")

# 2. Configure the Google library
try:
    genai.configure(api_key=api_key)
    print("✅ Library configured. Contacting Google...")
except Exception as e:
    print(f"❌ Config Error: {e}")
    raise SystemExit(1)

# 3. List available models
try:
    print("\n--- AVAILABLE MODELS (supporting generateContent) ---")
    models_found = False
    for m in genai.list_models():
        # Some SDK versions expose supported_generation_methods; be defensive.
        methods = getattr(m, "supported_generation_methods", []) or []
        if "generateContent" in methods:
            print(f"👉 {m.name}")
            models_found = True

    if not models_found:
        print("\n⚠️  No models found that support generateContent.")
        print("   Your API key might be valid, but it has no access to Gemini/Generative models.")
        print("   Solution: In Google Cloud / AI Studio, enable the Generative Language / Gemini API for this project,")
        print("   ensure billing is enabled, then re-run this script.")
    else:
        print("\n✅ SUCCESS! Copy one of the names above into services/gemini_service.py,")
        print("   e.g., self.model = genai.GenerativeModel('<model_name_from_above>').")

except Exception as e:
    print(f"\n❌ Connection Error: {e}")
    print("   Check your internet connection and ensure your API Key is correct.")
    raise SystemExit(1)
