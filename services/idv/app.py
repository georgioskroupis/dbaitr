from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io
import os

# Optional heavy imports
cv2 = None
try:
  import cv2  # type: ignore
except Exception:
  cv2 = None

insight = None
face_app = None
try:
  import insightface  # type: ignore
  from insightface.app import FaceAnalysis  # type: ignore
  insight = insightface
except Exception:
  insight = None

pyzbar = None
try:
  from pyzbar.pyzbar import decode as zbar_decode  # type: ignore
  pyzbar = True
except Exception:
  pyzbar = None

def np_from_upload(file: UploadFile) -> np.ndarray:
  content = file.file.read()
  img = Image.open(io.BytesIO(content)).convert('RGB')
  return np.array(img)

def compute_brightness_blur(img: np.ndarray):
  if cv2 is None:
    return 127.0, 0.0
  gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
  brightness = float(np.mean(gray))
  lap = cv2.Laplacian(gray, cv2.CV_64F)
  blur = float(lap.var())
  return brightness, blur

def ensure_face_app():
  global face_app
  if face_app is not None:
    return face_app
  if insight is None:
    return None
  try:
    providers = os.environ.get('ORT_PROVIDERS', 'CPUExecutionProvider').split(',')
    app = FaceAnalysis(name='buffalo_l', providers=providers)
    app.prepare(ctx_id=0, det_size=(640, 640))
    face_app = app
    return face_app
  except Exception:
    return None

def face_descriptor(app, img: np.ndarray):
  try:
    res = app.get(img)
    if not res:
      return None
    # Pick the largest face
    res.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
    emb = res[0].embedding if hasattr(res[0], 'embedding') else getattr(res[0], 'normed_embedding', None)
    return np.asarray(emb) if emb is not None else None
  except Exception:
    return None

def cosine(a: np.ndarray, b: np.ndarray) -> float:
  denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9
  return float(np.dot(a, b) / denom)

def detect_pdf417(img: np.ndarray) -> bool:
  if pyzbar is None:
    return False
  try:
    decoded = zbar_decode(Image.fromarray(img))
    for d in decoded:
      typ = str(getattr(d, 'type', '')).upper()
      if 'PDF417' in typ or 'PDF_417' in typ or typ == 'PDF417':
        return True
    return False
  except Exception:
    return False

app = FastAPI()

@app.post('/')
async def verify(front: UploadFile = File(...), back: UploadFile = File(...), selfie: UploadFile = File(...)):
  try:
    # Read images (ephemeral)
    front_np = np_from_upload(front)
    back_np = np_from_upload(back)
    selfie_np = np_from_upload(selfie)

    # Quality gates
    b_front, blur_front = compute_brightness_blur(front_np)
    b_back, blur_back = compute_brightness_blur(back_np)
    b_selfie, blur_selfie = compute_brightness_blur(selfie_np)
    if b_front < 40 or b_front > 220 or blur_front < 60:
      return { 'approved': False, 'reason': 'quality_front' }
    if b_back < 40 or b_back > 220 or blur_back < 60:
      return { 'approved': False, 'reason': 'quality_back' }
    if b_selfie < 40 or b_selfie > 220 or blur_selfie < 60:
      return { 'approved': False, 'reason': 'quality_selfie' }

    # Barcode (PDF417) on back
    if not detect_pdf417(back_np):
      return { 'approved': False, 'reason': 'barcode_mrz_not_found' }

    # Face descriptor compare (front vs selfie)
    app = ensure_face_app()
    if app is None:
      return { 'approved': False, 'reason': 'model_unavailable' }
    d1 = face_descriptor(app, front_np)
    d2 = face_descriptor(app, selfie_np)
    if d1 is None or d2 is None:
      return { 'approved': False, 'reason': 'face_not_detected' }
    score = cosine(d1, d2)
    min_sim = float(os.environ.get('FACE_SIMILARITY_MIN', '0.65'))
    if score < min_sim:
      return { 'approved': False, 'reason': 'face_mismatch' }

    # Basic liveness heuristic on selfie (size & center)
    # Use bbox from front descriptor step if available
    # For simplicity: rely on blur & brightness already checked

    return { 'approved': True }
  except Exception:
    return JSONResponse(status_code=500, content={ 'approved': False, 'reason': 'server_error' })
