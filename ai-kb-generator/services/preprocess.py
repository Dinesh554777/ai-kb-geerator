"""
preprocess.py – Cleans and structures raw conversation data
before it is analyzed by the extractor.
"""

import re
import json
from typing import Union


def parse_conversation(raw: Union[str, dict, list]) -> list[dict]:
    """
    Accept a conversation in multiple formats and return a normalised
    list of turn dicts: [{role, text}, ...]

    Supported input formats:
      • Plain string  – e.g. "Agent: Hi\nCustomer: My bill is wrong"
      • JSON string   – array of {role, content} objects
      • Python list   – already parsed turn list
      • Python dict   – single-turn shorthand  {customer, agent}
    """

    if isinstance(raw, list):
        return _normalise_turns(raw)

    if isinstance(raw, dict):
        turns = []
        if "customer" in raw:
            turns.append({"role": "customer", "text": raw["customer"]})
        if "agent" in raw:
            turns.append({"role": "agent", "text": raw["agent"]})
        return turns

    if isinstance(raw, str):
        # Try JSON first
        stripped = raw.strip()
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                return _normalise_turns(parsed)
            except json.JSONDecodeError:
                pass

        # Fall back to "Role: text" line format
        return _parse_text_conversation(stripped)

    return []


def _normalise_turns(turns: list) -> list[dict]:
    normalised = []
    for t in turns:
        if isinstance(t, dict):
            role = (
                t.get("role") or t.get("sender") or t.get("speaker") or "unknown"
            ).lower()
            text = t.get("content") or t.get("text") or t.get("message") or ""
            normalised.append({"role": role, "text": clean_text(text)})
    return normalised


def _parse_text_conversation(text: str) -> list[dict]:
    turns = []
    pattern = re.compile(r"^(agent|support|customer|user|client)\s*:\s*", re.IGNORECASE)

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = pattern.match(line)
        if m:
            role = m.group(1).lower()
            if role in ("support", "agent"):
                role = "agent"
            elif role in ("user", "client", "customer"):
                role = "customer"
            content = clean_text(line[m.end():])
            turns.append({"role": role, "text": content})
        elif turns:
            # Continuation of the previous turn
            turns[-1]["text"] += " " + clean_text(line)

    return turns


def clean_text(text: str) -> str:
    """Remove excessive whitespace and obvious noise."""
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    return text


def summarise_conversation(turns: list[dict]) -> str:
    """Flatten turns into a single readable block for LLM prompts."""
    lines = []
    for t in turns:
        role = t.get("role", "unknown").capitalize()
        lines.append(f"{role}: {t['text']}")
    return "\n".join(lines)


def extract_customer_problem(turns: list[dict]) -> str:
    """Return the first substantive customer message as a quick problem hint."""
    for t in turns:
        if t.get("role") == "customer" and len(t["text"]) > 15:
            return t["text"]
    return ""
