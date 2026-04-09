"""
clustering.py – Groups similar articles/conversations using TF-IDF + cosine similarity.
Used by the pattern detection dashboard endpoint.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def find_similar_articles(articles: list[dict], threshold: float = 0.35) -> list[dict]:
    """
    Returns a list of cluster groups.  Each group is a list of article IDs
    that are semantically similar to each other.
    """
    if len(articles) < 2:
        return []

    texts = [
        f"{a.get('title','')} {a.get('problem','')} {' '.join(a.get('tags',[]))}"
        for a in articles
    ]

    vectorizer = TfidfVectorizer(stop_words="english", max_features=500)
    try:
        tfidf = vectorizer.fit_transform(texts)
    except Exception:
        return []

    sim_matrix = cosine_similarity(tfidf)

    visited = set()
    clusters = []

    for i in range(len(articles)):
        if i in visited:
            continue
        group = [articles[i]["id"]]
        visited.add(i)
        for j in range(i + 1, len(articles)):
            if j not in visited and sim_matrix[i][j] >= threshold:
                group.append(articles[j]["id"])
                visited.add(j)
        if len(group) > 1:
            clusters.append(group)

    return clusters


def get_trending_tags(articles: list[dict], top_n: int = 10) -> list[dict]:
    """Return the most frequent tags across all articles."""
    tag_counts: dict[str, int] = {}
    for a in articles:
        for tag in a.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"tag": t, "count": c} for t, c in sorted_tags[:top_n]]
