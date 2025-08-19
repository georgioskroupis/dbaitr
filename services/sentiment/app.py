from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os

MODEL_ID = os.environ.get('MODEL_ID', 'cardiffnlp/twitter-xlm-roberta-base-sentiment')

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
model.eval()

app = FastAPI()

class SentimentIn(BaseModel):
    text: str

@app.post('/')
def infer(payload: SentimentIn):
    with torch.no_grad():
        inputs = tokenizer(payload.text, return_tensors='pt', truncation=True, max_length=256)
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1).cpu().numpy()[0]
        # Model labels: 0=negative, 1=neutral, 2=positive
        return {
            'model': MODEL_ID,
            'probs': {
                'neg': float(probs[0]),
                'neu': float(probs[1]),
                'pos': float(probs[2])
            }
        }

