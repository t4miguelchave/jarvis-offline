import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  htmlContent?: string;
  isEmail?: boolean;
  type: 'text' | 'image' | 'video';
  imagePreview?: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

@Injectable({ providedIn: 'root' })
export class JarvisService {
  private baseUrl = 'https://jarvis-api-xjdg.onrender.com';

  constructor(private http: HttpClient) {}

  // ---- BACKEND CALLS ----

  async sendText(message: string, sessionId: string): Promise<string> {
    const body = { message, session_id: sessionId };
    const res = await firstValueFrom(
      this.http.post<{ response: string }>(`${this.baseUrl}/chat`, body)
    );
    return res.response;
  }

  async sendImage(message: string, imageBase64: string, sessionId: string, mimeType = 'image/jpeg'): Promise<string> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', sessionId);
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

  async sendVideo(message: string, videoBase64: string, sessionId: string, mimeType = 'video/mp4'): Promise<string> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('session_id', sessionId);
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

  async clearSession(sessionId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/chat/${sessionId}`)).catch(() => {});
  }

  // ---- CONVERSATIONS ----

  generateId(): string {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  async loadAllConversations(): Promise<Conversation[]> {
    try {
      const convs = await firstValueFrom(
        this.http.get<Conversation[]>(`${this.baseUrl}/cloud/conversations`)
      );
      if (!convs) return [];
      
      return convs
        .map(c => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
        }))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch {
      // Offline fallback: return empty if server unreachable
      return [];
    }
  }

  async saveConversation(conv: Conversation): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/cloud/conversation`, conv)
      );
    } catch {
      console.error('Failed to save conversation to cloud');
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      await this.clearSession(id);
    } catch {
      console.error('Failed to delete conversation');
    }
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    const all = await this.loadAllConversations();
    return all.find(c => c.id === id) || null;
  }

  createNewConversation(): Conversation {
    const id = this.generateId();
    return {
      id,
      title: 'Nova conversa',
      preview: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };
  }

  setBaseUrl(url: string) { this.baseUrl = url.replace(/\/$/, ''); }
  getBaseUrl(): string { return this.baseUrl; }
}
