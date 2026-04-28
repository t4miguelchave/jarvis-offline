import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonFooter,
  IonTextarea, IonButton, IonIcon, IonSpinner, IonButtons,
  AlertController, ActionSheetController, ToastController, LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sendOutline, imageOutline, videocamOutline, trashOutline,
  settingsOutline, arrowBackOutline, closeOutline, addOutline,
  volumeHighOutline, mailOutline, copyOutline
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { marked } from 'marked';
import { JarvisService, Message, Conversation } from '../services/jarvis.service';
import { volumeHighOutline, mailOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonFooter,
    IonTextarea, IonButton, IonIcon, IonSpinner, IonButtons,
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('chatContent') chatContent!: IonContent;

  conversation!: Conversation;
  messages: Message[] = [];
  inputText = '';
  isLoading = false;
  private shouldScrollToBottom = false;
  private isNew = false;

  constructor(
    private jarvis: JarvisService,
    private route: ActivatedRoute,
    private router: Router,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
  ) {
    addIcons({ sendOutline, imageOutline, videocamOutline, trashOutline, settingsOutline, arrowBackOutline, closeOutline, addOutline, volumeHighOutline, mailOutline, copyOutline });
  }

  async ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as any;

    if (state?.conversation) {
      this.conversation = state.conversation;
      this.isNew = state.isNew ?? true;
    } else {
      // Fallback: load from storage
      const id = this.route.snapshot.paramMap.get('id') || '';
      const loaded = await this.jarvis.loadConversation(id);
      if (loaded) {
        this.conversation = loaded;
        this.isNew = false;
      } else {
        this.conversation = this.jarvis.createNewConversation();
        this.isNew = true;
      }
    }

    this.messages = this.conversation.messages || [];
    this.shouldScrollToBottom = true;
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.chatContent?.scrollToBottom(300);
      this.shouldScrollToBottom = false;
    }
  }

  goBack() {
    this.router.navigate(['/conversations']);
  }

  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    await this.addMessage('user', text, 'text');
    this.inputText = '';
    this.isLoading = true;

    try {
      const response = await this.jarvis.sendText(text, this.conversation.id);
      await this.addMessage('assistant', response, 'text');
    } catch {
      this.showToast('Erro ao contactar o Jarvis. Verifica a ligação.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async openMediaPicker() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Enviar media',
      cssClass: 'jarvis-action-sheet',
      buttons: [
        { text: '📷 Tirar foto', handler: () => this.captureImage(CameraSource.Camera) },
        { text: '🖼️ Escolher da galeria', handler: () => this.captureImage(CameraSource.Photos) },
        { text: '🎥 Escolher vídeo', handler: () => this.pickVideo() },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await actionSheet.present();
  }

  async captureImage(source: CameraSource) {
    try {
      const photo = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: CameraResultType.Base64, source });
      if (!photo.base64String) return;
      const prompt = await this.promptForMessage('Perguntar ao Jarvis sobre esta imagem:', 'Ex: Quantas calorias tem isto?');
      if (prompt === null) return;
      const previewUrl = `data:image/jpeg;base64,${photo.base64String}`;
      const question = prompt || 'O que está nesta imagem? Se for comida, calcula as calorias.';
      await this.addMessage('user', question, 'image', previewUrl);
      this.isLoading = true;
      const loading = await this.showLoading('Jarvis a analisar imagem...');
      try {
        const response = await this.jarvis.sendImage(question, photo.base64String, this.conversation.id);
        await this.addMessage('assistant', response, 'text');
      } catch { this.showToast('Erro ao enviar imagem.', 'danger'); }
      finally { this.isLoading = false; loading.dismiss(); }
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) this.showToast('Erro ao aceder à câmera.', 'danger');
    }
  }

  async pickVideo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) return;
      const prompt = await this.promptForMessage('Perguntar ao Jarvis sobre este vídeo:', 'Ex: O que está neste vídeo?');
      if (prompt === null) return;
      const question = prompt || 'O que está neste vídeo?';
      await this.addMessage('user', question, 'video');
      this.isLoading = true;
      const loading = await this.showLoading('Jarvis a analisar vídeo...');
      try {
        const base64 = await this.fileToBase64(file);
        const response = await this.jarvis.sendVideo(question, base64, this.conversation.id, file.type);
        await this.addMessage('assistant', response, 'text');
      } catch { this.showToast('Erro ao enviar vídeo.', 'danger'); }
      finally { this.isLoading = false; loading.dismiss(); }
    };
    input.click();
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async addMessage(role: 'user' | 'assistant', content: string, type: Message['type'], imagePreview?: string) {
    let cleanContent = content;
    let isEmail = false;

    // Email parsing
    if (role === 'assistant' && content.includes('[ACTION: EMAIL]')) {
      isEmail = true;
      cleanContent = content.replace('[ACTION: EMAIL]', '').trim();
    }

    // Markdown parsing
    let htmlContent = cleanContent;
    if (role === 'assistant') {
      try {
        htmlContent = await marked.parse(cleanContent);
      } catch (e) {
        htmlContent = cleanContent; // fallback
      }
    }

    this.messages.push({ role, content: cleanContent, htmlContent, isEmail, type, imagePreview, timestamp: new Date() });

    // Update conversation metadata
    this.conversation.messages = this.messages;
    this.conversation.updatedAt = new Date();

    // Title = first user message (truncated)
    if (this.conversation.title === 'Nova conversa' && role === 'user') {
      this.conversation.title = cleanContent.length > 40 ? cleanContent.substring(0, 40) + '...' : cleanContent;
    }
    // Preview = last message
    this.conversation.preview = cleanContent.length > 60 ? cleanContent.substring(0, 60) + '...' : cleanContent;

    this.jarvis.saveConversation(this.conversation);
    this.shouldScrollToBottom = true;
  }

  async playAudio(text: string) {
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'pt-PT',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
    } catch (e) {
      this.showToast('Erro ao reproduzir áudio.', 'warning');
    }
  }

  async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Texto copiado!', 'success');
    } catch (e) {
      this.showToast('Erro ao copiar texto.', 'danger');
    }
  }

  openEmailClient(body: string) {
    const mailto = `mailto:?body=${encodeURIComponent(body)}`;
    window.open(mailto, '_system');
  }

  async clearChat() {
    const alert = await this.alertCtrl.create({
      header: 'Limpar conversa',
      message: 'Apagar todas as mensagens desta conversa?',
      cssClass: 'jarvis-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Apagar',
          handler: async () => {
            this.messages = [];
            this.conversation.messages = [];
            this.conversation.title = 'Nova conversa';
            this.conversation.preview = '';
            await this.jarvis.saveConversation(this.conversation);
            await this.jarvis.clearSession(this.conversation.id);
          },
        },
      ],
    });
    await alert.present();
  }

  private async promptForMessage(header: string, placeholder: string): Promise<string | null> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        cssClass: 'jarvis-alert',
        inputs: [{ name: 'msg', type: 'text', placeholder }],
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(null) },
          { text: 'Enviar', handler: data => resolve(data.msg || '') },
        ],
      });
      await alert.present();
    });
  }

  private async showLoading(message: string) {
    const loading = await this.loadingCtrl.create({ message, cssClass: 'jarvis-loading' });
    await loading.present();
    return loading;
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }
}
