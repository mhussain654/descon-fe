export interface TrainingVideo {
  id: number;
  title_en: string;
  title_ur: string;
  description_en: string | null;
  description_ur: string | null;
  position: number;
  published: boolean;
  content_type: string;
  byte_size: number;
  playback_url: string;
}
