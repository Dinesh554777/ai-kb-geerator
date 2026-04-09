"""
generator.py – Takes extracted metadata and renders a full knowledge base article.
Also handles the article storage (in-memory + JSON persistence).
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "articles.json"


def _load_articles() -> list[dict]:
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _save_articles(articles: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(articles, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def generate_article(extraction: dict, raw_conversation: str = "") -> dict:
    """
    Build a complete KB article dict from an LLM extraction result.
    Saves it to the JSON store and returns the full article.
    """
    article_id = str(uuid.uuid4())[:8].upper()
    now = datetime.now(timezone.utc).isoformat()

    article = {
        "id": article_id,
        "title": extraction.get("title", "Untitled Article"),
        "category": extraction.get("category", "Other"),
        "subcategory": extraction.get("subcategory", ""),
        "problem": extraction.get("problem", ""),
        "solution": extraction.get("solution", ""),
        "root_cause": extraction.get("root_cause", ""),
        "tags": extraction.get("tags", []),
        "severity": extraction.get("severity", "medium"),
        "estimated_read_time": extraction.get("estimated_read_time", "2 min read"),
        "helpful_tip": extraction.get("helpful_tip", ""),
        "views": 0,
        "helpful_votes": 0,
        "created_at": now,
        "updated_at": now,
        "source_preview": raw_conversation[:300] + "..." if len(raw_conversation) > 300 else raw_conversation,
        "status": "published",
        "version": 1,
    }

    articles = _load_articles()

    # Deduplication: check if a very similar title already exists
    for existing in articles:
        if existing["title"].lower() == article["title"].lower():
            existing["updated_at"] = now
            existing["version"] += 1
            existing["source_preview"] = article["source_preview"]
            _save_articles(articles)
            return {**existing, "_action": "updated"}

    articles.append(article)
    _save_articles(articles)
    return {**article, "_action": "created"}


def get_all_articles() -> list[dict]:
    return _load_articles()


def get_article_by_id(article_id: str) -> dict | None:
    for a in _load_articles():
        if a["id"] == article_id:
            return a
    return None


def search_articles(query: str) -> list[dict]:
    query_lower = query.lower()
    results = []
    for a in _load_articles():
        score = 0
        if query_lower in a["title"].lower():
            score += 10
        if query_lower in a["problem"].lower():
            score += 5
        if query_lower in a["solution"].lower():
            score += 3
        for tag in a.get("tags", []):
            if query_lower in tag.lower():
                score += 4
        if query_lower in a.get("category", "").lower():
            score += 2
        if score > 0:
            results.append({**a, "_score": score})
    results.sort(key=lambda x: x["_score"], reverse=True)
    return results


def get_stats() -> dict:
    articles = _load_articles()
    categories: dict[str, int] = {}
    severities: dict[str, int] = {}
    for a in articles:
        cat = a.get("category", "Other")
        categories[cat] = categories.get(cat, 0) + 1
        sev = a.get("severity", "medium")
        severities[sev] = severities.get(sev, 0) + 1

    return {
        "total_articles": len(articles),
        "categories": categories,
        "severities": severities,
        "most_viewed": sorted(articles, key=lambda x: x.get("views", 0), reverse=True)[:3],
    }


def increment_views(article_id: str) -> None:
    articles = _load_articles()
    for a in articles:
        if a["id"] == article_id:
            a["views"] = a.get("views", 0) + 1
    _save_articles(articles)


def vote_helpful(article_id: str) -> None:
    articles = _load_articles()
    for a in articles:
        if a["id"] == article_id:
            a["helpful_votes"] = a.get("helpful_votes", 0) + 1
    _save_articles(articles)


def delete_article(article_id: str) -> bool:
    articles = _load_articles()
    new_articles = [a for a in articles if a["id"] != article_id]
    if len(new_articles) < len(articles):
        _save_articles(new_articles)
        return True
    return False
