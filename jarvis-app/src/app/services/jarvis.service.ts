import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video';
  imagePreview?: string;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class JarvisService {
  // ⚠️ Change this after Railway deploy!
  private baseUrl = 'https://YOUR-RAILWAY-URL.railway.app';
  private sessionId = 'mobile-session-' + Date.now();

  constructor(private http: HttpClient) {
    this.loadSessionId();
  }

  async loadSessionId() {
    const { value } = await Preferences.get({ key: 'session_id' });
    if (value) {
      this.sessionId = value;
    } else {
      await Preferences.set({ key: 'session_id', value: this.sessionId });
    }
  }

  async sendText(message: string): Promise<string> {
    const body = { message, session_id: this.sessionId };
    const res = await firstValueFrom(
      this.http.post<{ response: string }>(`${this.baseUrl}/chat`, body)
    );
    return res.response;
  }

  async sendImage(message: string, imageBase64: string, mimeType: string = 'image/jpeg'): Promise<string> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', this.sessionId);

    // Convert base64 to blob
    const byteString = atob(imageBase64.split(',').pop() || imageBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeType });
    formData.append('image', blob, 'image.jpg');

    const res = await firstValueFrom(
      this.http.post<{ response: string }>(`${this.baseUrl}/chat/image`, formData)
    );
    return res.response;
  }

  async sendVideo(message: string, videoBase64: string, mimeType: string = 'video/mp4'): Promise<string> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', this.sessionId);

    const byteString = atob(videoBase64.split(',').pop() || videoBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeType });
    formData.append('video', blob, 'video.mp4');

    const res = await firstValueFrom(
      this.http.post<{ response: string }>(`${this.baseUrl}/chat/video`, formData)
    );
    return res.response;
  }

  async clearHistory(): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/chat/${this.sessionId}`)
    );
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async saveMessages(messages: Message[]) {
    await Preferences.set({ key: 'chat_history', value: JSON.stringify(messages) });
  }

  async loadMessages(): Promise<Message[]> {
    const { value } = await Preferences.get({ key: 'chat_history' });
    if (!value) return [];
    const msgs = JSON.parse(value) as Message[];
    return msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  }
}
