# Sentiment Inference Service

A minimal FastAPI service hosting an XLM-RoBERTa 3-class sentiment model and returning raw probabilities.

## Model
- Default: `cardiffnlp/twitter-xlm-roberta-base-sentiment`
- Output: `{ probs: { neg, neu, pos } }`

## Run locally
- Requirements: Python 3.10+
- Install: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port 8000`

## Deploy
- Build: `docker build -t sentiment:latest .`
- Run: `docker run -p 8000:8000 sentiment:latest`

Set `SENTIMENT_INFERENCE_URL` in the Next.js app to this service URL.

