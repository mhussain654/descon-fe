import SparkMD5 from 'spark-md5';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';
import type { TrainingVideo } from '../../../shared/trainingVideos/types';
export type { TrainingVideo };

export interface TrainingVideoInput {
  title_en: string;
  title_ur: string;
  description_en?: string;
  description_ur?: string;
  position: number;
  published: boolean;
}

async function authenticated<T>(request: (token: string) => Promise<T | undefined>): Promise<T> {
  const result = await staffAuthClient.authenticatedDataRequest(request);
  if (result === undefined) throw new Error('Empty training video response');
  return result;
}

export const trainingVideosClient = {
  list: () => authenticated(token => apiClient.get<TrainingVideo[]>('/admin/training_videos', {
    headers: { Authorization: `Bearer ${token}` },
  })),
  create: async (input: TrainingVideoInput, file: File, onProgress?: (percent: number) => void) => {
    // Active Storage direct upload: the large body goes to private S3, never through Puma.
    const md5 = new SparkMD5.ArrayBuffer();
    for (let offset = 0; offset < file.size; offset += 4 * 1024 * 1024) {
      md5.append(await file.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
    }
    const checksum = btoa(String.fromCharCode(...md5.end().match(/.{2}/g)!.map(hex => parseInt(hex, 16))));
    const ticket = await authenticated(token => apiClient.post<{ signed_id: string; upload_url: string; upload_headers: Record<string, string> }>(
      '/admin/training_videos/upload',
      { training_video_upload: { filename: file.name, byte_size: file.size, content_type: file.type, checksum } },
      { headers: { Authorization: `Bearer ${token}` } }
    ));
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', ticket.upload_url);
      for (const [name, value] of Object.entries(ticket.upload_headers)) request.setRequestHeader(name, value);
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
      };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Video upload failed'));
      request.onerror = () => reject(new Error('Video upload failed'));
      request.send(file);
    });
    return authenticated(token => apiClient.post<TrainingVideo>('/admin/training_videos',
      { training_video: { ...input, file: ticket.signed_id } }, { headers: { Authorization: `Bearer ${token}` } }));
  },
  update: (id: number, input: Partial<TrainingVideoInput>) => authenticated(token =>
    apiClient.patch<TrainingVideo>(`/admin/training_videos/${id}`, { training_video: input }, {
      headers: { Authorization: `Bearer ${token}` },
    })),
  remove: (id: number) => staffAuthClient.authenticatedDataRequest(token => apiClient.del<void>(`/admin/training_videos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })),
};
