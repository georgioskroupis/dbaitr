export const IDV_FLAGS = {
  IDV_AI_APPROVAL: process.env.NEXT_PUBLIC_IDV_AI_APPROVAL === 'true',
  STRICT_MINIMAL: process.env.NEXT_PUBLIC_IDV_STRICT_MINIMAL !== 'false', // default true
  ON_DEVICE: process.env.NEXT_PUBLIC_IDV_ONDEVICE !== 'false', // default true
};

export const IDV_THRESHOLDS = {
  FACE_SIMILARITY_MIN: 0.65, // cosine similarity (legacy placeholder)
  FACE_HIST_SIM_MIN: 0.35, // histogram correlation (0..1) min acceptable
  BLUR_LAPLACIAN_MIN: 60, // higher = sharper; 60 is soft baseline
  BRIGHTNESS_MIN: 40, // out of 255
  BRIGHTNESS_MAX: 220,
  PASSIVE_LIVENESS_MIN: 0.6,
  ACTIVE_LIVENESS_MIN_STEPS: 2, // number of prompts to pass
};
