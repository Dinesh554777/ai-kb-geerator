"""
extractor.py – Calls the LLM to extract structured info from a conversation.
Returns a dict with: title, category, problem, solution, tags, severity.
"""

import json
import os
from openai import OpenAI

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY", "")
        _client = OpenAI(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are an expert technical writer and knowledge base specialist.
Your job is to analyse resolved customer support conversations and extract structured information.

You MUST return valid JSON with exactly these fields:
{
  "title": "Short, clear article title (max 10 words)",
  "category": "One of: Account & Billing | Technical Issues | Product Usage | Shipping & Delivery | Returns & Refunds | Security | Other",
  "subcategory": "A more specific category (2-4 words)",
  "problem": "A concise, third-person description of the customer's core issue (2-3 sentences)",
  "solution": "Step-by-step resolution written for an end-user. Use numbered steps.",
  "root_cause": "Brief explanation of WHY the issue occurred (1 sentence)",
  "tags": ["array", "of", "3-6", "search", "keywords"],
  "severity": "low | medium | high",
  "estimated_read_time": "X min read",
  "helpful_tip": "Optional pro-tip the user should know"
}

Be precise. Be helpful. Write for a non-technical audience unless the topic requires technical depth.
"""


def extract_from_conversation(conversation_summary: str) -> dict:
    """
    Send the conversation summary to the LLM and parse the structured extraction.
    Falls back to a mock extraction if no API key is set (demo mode).
    """
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key or api_key == "your-api-key-here":
        return _mock_extraction(conversation_summary)

    client = _get_client()

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Analyse this resolved support conversation and return the structured JSON:\n\n{conversation_summary}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        raw = response.choices[0].message.content
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e), **_mock_extraction(conversation_summary)}


def _mock_extraction(text: str) -> dict:
    """
    Demo-mode extraction: uses keyword heuristics to produce a realistic-looking
    result without calling the OpenAI API.
    """
    text_lower = text.lower()

    # Category detection
    if any(w in text_lower for w in ["password", "login", "account", "email", "2fa"]):
        category = "Account & Billing"
        title = "How to Reset Your Account Password"
        problem = "The customer was unable to log into their account due to a forgotten or expired password."
        solution = "1. Click 'Forgot Password' on the login page.\n2. Enter your registered email address.\n3. Check your inbox for a reset link (check spam if not received).\n4. Click the link and set a new password within 15 minutes.\n5. Log in with your new credentials."
        root_cause = "Password expiry policy or user forgot credentials after extended inactivity."
        tags = ["password", "login", "account", "reset", "authentication"]
        tip = "Enable 'Remember me' on trusted devices to reduce login friction."
        subcategory = "Password Management"
    elif any(w in text_lower for w in ["bill", "charge", "refund", "payment", "invoice"]):
        category = "Account & Billing"
        title = "Disputing an Incorrect Charge on Your Account"
        problem = "The customer noticed an unexpected or incorrect charge on their account statement."
        solution = "1. Log into your account and navigate to Billing > Transaction History.\n2. Identify the disputed charge and click 'Report Issue'.\n3. Fill in the dispute form with the date and amount.\n4. Submit — our team reviews within 3-5 business days.\n5. A credit will appear if the dispute is validated."
        root_cause = "Double billing can occur during payment gateway timeouts or promotion code mis-application."
        tags = ["billing", "charge", "refund", "invoice", "payment"]
        tip = "Download monthly invoices from your billing dashboard for your records."
        subcategory = "Billing Disputes"
    elif any(w in text_lower for w in ["shipping", "deliver", "package", "order", "track"]):
        category = "Shipping & Delivery"
        title = "Tracking a Delayed or Missing Order"
        problem = "The customer's order had not arrived by the expected delivery date and could not be located easily."
        solution = "1. Visit your Orders page and click on the specific order.\n2. Click 'Track Shipment' — this opens the carrier tracking page.\n3. If tracking shows 'Delivered' but you haven't received it, check with neighbours or your building management.\n4. If the issue persists > 3 days, contact support with your order number.\n5. We will initiate a carrier investigation or reship within 24 hours."
        root_cause = "Delivery delays are typically caused by carrier backlogs, incorrect delivery addresses, or customs holds for international orders."
        tags = ["shipping", "delivery", "tracking", "order", "delay"]
        tip = "Add delivery instructions (e.g., leave at door) to reduce missed deliveries."
        subcategory = "Order Tracking"
    else:
        category = "Technical Issues"
        title = "Resolving Common Application Errors"
        problem = "The customer encountered a technical error that prevented them from completing their intended action."
        solution = "1. Refresh the page and try again.\n2. Clear your browser cache and cookies (Settings > Privacy > Clear Data).\n3. Try an alternative browser or device.\n4. Disable browser extensions temporarily.\n5. If the issue persists, contact support with a screenshot and your account email."
        root_cause = "Most client-side errors are caused by stale cache, incompatible browser extensions, or temporary server blips."
        tags = ["error", "bug", "technical", "troubleshoot", "browser"]
        tip = "Always use an up-to-date browser for the best experience."
        subcategory = "App Errors"

    return {
        "title": title,
        "category": category,
        "subcategory": subcategory,
        "problem": problem,
        "solution": solution,
        "root_cause": root_cause,
        "tags": tags,
        "severity": "medium",
        "estimated_read_time": "2 min read",
        "helpful_tip": tip,
    }
