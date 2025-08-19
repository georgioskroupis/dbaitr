import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI() // No apiKey option provided, so it defaults to ADC or GEMINI_API_KEY/GOOGLE_API_KEY env var.
  ],
  model: 'googleai/gemini-2.0-flash', // Using the model specified in the existing project files.
});
