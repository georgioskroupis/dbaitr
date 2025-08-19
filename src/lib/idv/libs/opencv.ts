// Placeholder loader for OpenCV.js. No network fetch here; wire up to a local script tag if self-hosted later.
export async function loadOpenCV(): Promise<any | null> {
  // TODO: inject <script src="/vendor/opencv.js"> and await window.cv load
  return null;
}

