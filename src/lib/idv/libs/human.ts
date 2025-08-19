// Human loader without bundling the package. Expects a global Human class if you include it via script tag.
let humanInstance: any | null = null;
export async function loadHuman(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  if (humanInstance) return humanInstance;
  try {
    const anyWin = window as any;
    const Human = anyWin?.Human || anyWin?.human?.constructor;
    if (!Human) return null;
    const modelsUrl = (process.env.NEXT_PUBLIC_HUMAN_MODELS_URL || '/vendor/human/models/') as string;
    const human = new Human({
      cacheSensitivity: 0,
      backend: 'webgl',
      modelBasePath: modelsUrl,
      face: { enabled: true, detector: { rotation: true }, mesh: { enabled: true }, iris: { enabled: true }, emotion: { enabled: false }, description: { enabled: true } },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
    });
    await human?.load?.();
    humanInstance = human;
    return humanInstance;
  } catch {
    return null;
  }
}
