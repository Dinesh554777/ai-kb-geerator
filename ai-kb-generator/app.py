"""
app.py – Flask API backend for the AI KB Generator.
Serves the frontend static files and exposes REST endpoints.
"""

import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from services.preprocess import parse_conversation, summarise_conversation
from services.extractor import extract_from_conversation
from services.generator import (
    generate_article,
    get_all_articles,
    get_article_by_id,
    search_articles,
    get_stats,
    increment_views,
    vote_helpful,
    delete_article,
)
from models.clustering import find_similar_articles, get_trending_tags

load_dotenv()

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "frontend"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
CORS(app)

# ─────────────────────── Serve Frontend ────────────────────────

@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")


# ─────────────────────── API Endpoints ─────────────────────────

@app.route("/api/process", methods=["POST"])
def process_conversation():
    """
    Main endpoint: accept a raw conversation, extract structured info,
    generate and store a KB article.

    Body (JSON): { "conversation": "..." }
    """
    data = request.get_json(force=True)
    raw = data.get("conversation", "").strip()

    if not raw:
        return jsonify({"error": "No conversation provided"}), 400

    try:
        turns = parse_conversation(raw)
        summary = summarise_conversation(turns)
        extraction = extract_from_conversation(summary or raw)

        if "error" in extraction and len(extraction) == 1:
            return jsonify({"error": extraction["error"]}), 500

        article = generate_article(extraction, raw)
        return jsonify({"success": True, "article": article}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/articles", methods=["GET"])
def list_articles():
    category = request.args.get("category", "")
    articles = get_all_articles()
    if category:
        articles = [a for a in articles if a.get("category") == category]
    # Most recent first
    articles.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return jsonify(articles)


@app.route("/api/articles/<article_id>", methods=["GET"])
def get_article(article_id):
    article = get_article_by_id(article_id)
    if not article:
        return jsonify({"error": "Not found"}), 404
    increment_views(article_id)
    return jsonify(article)


@app.route("/api/articles/<article_id>", methods=["DELETE"])
def remove_article(article_id):
    ok = delete_article(article_id)
    if ok:
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404


@app.route("/api/articles/<article_id>/helpful", methods=["POST"])
def mark_helpful(article_id):
    vote_helpful(article_id)
    return jsonify({"success": True})


@app.route("/api/search", methods=["GET"])
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    results = search_articles(q)
    return jsonify(results)


@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify(get_stats())


@app.route("/api/patterns", methods=["GET"])
def patterns():
    articles = get_all_articles()
    clusters = find_similar_articles(articles)
    trending = get_trending_tags(articles)
    return jsonify({"clusters": clusters, "trending_tags": trending})


@app.route("/api/demo-conversations", methods=["GET"])
def demo_conversations():
    """Return sample conversations for the demo."""
    return jsonify(DEMO_CONVERSATIONS)


# ─────────────────────── Demo Data ────────────────────────────

DEMO_CONVERSATIONS = [
    {
        "label": "🔐 Password Reset Issue",
        "text": """Customer: Hi, I've been trying to log into my account for the past hour but I keep getting 'incorrect password'. I'm sure I'm using the right one.
Agent: Hello! I'm sorry to hear that. Let me help you reset your access. Have you tried the 'Forgot Password' option on the login page?
Customer: No, I wasn't sure if that would delete my account or something.
Agent: Not at all! It just sends a secure reset link to your email. Let me walk you through it. Click 'Forgot Password', enter your registered email, and check your inbox within 2 minutes.
Customer: Okay I tried it. Got an email!
Agent: Great! Click that link — it's valid for 15 minutes. Set a new password of at least 8 characters with one number.
Customer: Done! I'm in now. Thank you so much!
Agent: Wonderful! Is there anything else I can assist you with today?
Customer: No that's all, thanks!"""
    },
    {
        "label": "💳 Double Billing Problem",
        "text": """Customer: I was charged twice for my subscription this month. I see two charges of $29.99 on my statement dated the 3rd and 4th.
Agent: I sincerely apologise for this inconvenience. I can see the duplicate charge on our end. This was caused by a payment gateway timeout that triggered a retry.
Customer: So will I get a refund?
Agent: Absolutely. I've already initiated a full refund for the duplicate $29.99 charge. It will appear in your account within 3-5 business days.
Customer: Okay good. How do I make sure this doesn't happen again?
Agent: We've updated our gateway timeout handling in our latest patch, so this shouldn't recur. I'll also add a note to your account to flag any unusual billing activity.
Customer: Alright, thanks for the quick help.
Agent: Of course! You are a valued customer. Have a great day!"""
    },
    {
        "label": "📦 Missing Delivery",
        "text": """Customer: My order #ORD-88421 shows as delivered 2 days ago but I never received anything.
Agent: I'm sorry about that! Let me look up your order. I can see it was marked delivered on Tuesday at 2:14 PM at your front door.
Customer: Nothing was at my door. Could it have been stolen?
Agent: That's possible, unfortunately. First, could you check with neighbours or your building's mail room? Sometimes couriers leave packages with a neighbour.
Customer: I checked. Nothing there either.
Agent: In that case, I'll file a carrier investigation immediately. This typically resolves within 48 hours. As a courtesy, I'll also dispatch a replacement order today via express shipping.
Customer: Wow, that's great! I really needed that package.
Agent: Completely understand. You'll get a tracking number for the replacement within the hour. Is the delivery address the same?
Customer: Yes, same address.
Agent: Perfect. Investigation filed and replacement dispatched. You're all set!"""
    },
    {
        "label": "⚙️ App Crashing on Startup",
        "text": """Customer: Your app keeps crashing every time I open it. It just flashes and closes immediately. I'm on iPhone 14.
Agent: I'm sorry to hear that! This sounds like a cache corruption issue that a few iOS 17 users have reported. Let me help.
Customer: Okay what do I do?
Agent: First, force-close the app by swiping up and removing it from your recents. Then go to Settings > General > iPhone Storage, find our app, and tap 'Offload App'. Don't delete it — offloading keeps your data.
Customer: Okay done.
Agent: Now re-download the app from the App Store. The offloaded app will reinstall cleanly.
Customer: That fixed it! It's opening normally now.
Agent: Excellent! This was caused by a corrupted local database file from our v2.1.0 update. We've pushed a patch in v2.1.1 that prevents this. The App Store should auto-update tonight.
Customer: Good to know. Thanks!"""
    }
]


if __name__ == "__main__":
    print("🚀 AI Knowledge Base Generator running at http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
