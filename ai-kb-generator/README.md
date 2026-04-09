# AI Knowledge Base Generator

An intelligent application that automatically converts customer support chat logs into structured, professional Knowledge Base (KB) articles. Built with a modern Flask backend and an elegant vanilla HTML/CSS/JS frontend.

## 🚀 Features

- **Automated Article Generation**: Extracts core issues, solutions, and metadata from raw chat transcripts.
- **Smart Formatting**: Structures articles with readable properties like Title, Category, Severity, Solution Steps, and Tags.
- **Modern UI**: A responsive, animated, and premium glassmorphism-inspired interface.
- **Pattern Recognition**: Analyzes historical articles to group trends, highlight common tags, and cluster related issues.
- **Library & Search**: Robust frontend sorting, filtering by categories, and quick tag-based search.
- **Demo Mode**: Built-in, heuristic-based fallback for processing text when `OPENAI_API_KEY` is not provided.

## 🛠️ Tech Stack

- **Backend**: Python, Flask, Flask-CORS, scikit-learn (TF-IDF clustering), NLTK.
- **Frontend**: HTML5, Vanilla CSS3 (Custom Properties, Glassmorphism, Animations), Vanilla JavaScript (ES6 Modules).
- **LLM Integration**: OpenAI Python SDK.

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd ai-kb-generator
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   # On Windows:
   .\.venv\Scripts\Activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   Copy `.env.example` to `.env` and fill in your API key.
   ```bash
   cp .env.example .env
   ```
   *Note: If you leave `OPENAI_API_KEY` as `your-api-key-here`, the app will cleanly fallback to a local Keyword-Extraction Demo Mode.*

## 🏃‍♂️ Running the Application

1. **Start the backend server:**
   ```bash
   python app.py
   ```
2. **Access the Web App:**
   Open your browser and navigate to:
   [http://localhost:5000](http://localhost:5000)

## 📁 Project Structure

```text
ai-kb-generator/
├── app.py                   # Main Flask API and serving logic
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
├── data/
│   └── chats.json           # Local JSON datastore for KB Articles
├── frontend/                # Client-Side Application
│   ├── index.html           # Main UI Shell
│   ├── style.css            # Styles, Animations, and Layout
│   └── app.js               # Frontend logic and API integration
├── models/
│   └── clustering.py        # ML logic for finding similar articles & trends
└── services/
    ├── extractor.py         # LLM logic for JSON extraction
    ├── generator.py         # CRUD operations and formatting for the KB datastore
    └── preprocess.py        # Chat parsing heuristics
```

## 🤝 Contributing
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
