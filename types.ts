export enum AppState {
  IDLE = 'IDLE',
  EDITING = 'EDITING',
  RENDERING = 'RENDERING',
  FINISHED = 'FINISHED'
}

export interface SongData {
  file: File | null;
  url: string | null;
  name: string;
}

export type VisualizerMode = 'bars' | 'circle';

export interface VisualData {
  backgroundImage: string | null; // URL or Base64
  caption: string;
}

export interface AiGenerationState {
  isGeneratingImage: boolean;
  isGeneratingCaption: boolean;
  error: string | null;
}