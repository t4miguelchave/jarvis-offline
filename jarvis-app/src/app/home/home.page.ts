import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonFooter,
  IonTextarea, IonButton, IonIcon, IonSpinner, IonButtons,
  IonActionSheet, IonAlert, AlertController, ActionSheetController,
  ToastController, LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sendOutline, imageOutline, videocamOutline, trashOutline,
  settingsOutline, micOutline, closeOutline, checkmarkOutline
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { JarvisService, Message } from '../services/jarvis.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonFooter,
    IonTextarea, IonButton, IonIcon, IonSpinner, IonButtons,
    IonActionSheet, IonAlert
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('chatContent') chatContent!: IonContent;

  messages: Message[] = [];
  inputText: string = '';
  isLoading: boolean = false;
  showSettingsAlert: boolean = false;
  backendUrl: string = '';
  private shouldScrollToBottom = false;

  constructor(
    private jarvis: JarvisService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    addIcons({
      sendOutline, imageOutline, videocamOutline, trashOutline,
      settingsOutline, micOutline, closeOutline, checkmarkOutline
    });
  }

  async ngOnInit() {
    this.messages = await this.jarvis.loadMessages();
    this.backendUrl = this.jarvis.getBaseUrl();
    this.shouldScrollToBottom = true;
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  scrollToBottom() {
    if (this.chatContent) {
      this.chatContent.scrollToBottom(300);
    }
  }

  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    this.addMessage('user', text, 'text');
    this.inputText = '';
    this.isLoading = true;

    try {
      const response = await this.jarvis.sendText(text);
      this.addMessage('assistant', response, 'text');
    } catch (err) {
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
        {
          text: '📷 Tirar foto',
          handler: () => this.captureImage(CameraSource.Camera),
        },
        {
          text: '🖼️ Escolher da galeria',
          handler: () => this.captureImage(CameraSource.Photos),
        },
        {
          text: '🎥 Escolher vídeo da galeria',
          handler: () => this.pickVideo(),
        },
        {
          text: 'Cancelar',
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  async captureImage(source: CameraSource) {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
      });

      if (!photo.base64String) return;

      const prompt = await this.promptForMessage(
        'Perguntar ao Jarvis sobre esta imagem:',
        'Ex: Quantas calorias tem isto?'
      );
      if (prompt === null) return;

      const previewUrl = `data:image/jpeg;base64,${photo.base64String}`;
      const question = prompt || 'O que está nesta imagem? Se for comida, calcula as calorias.';

      this.addMessage('user', question, 'image', previewUrl);
      this.isLoading = true;

      const loading = await this.showLoading('Jarvis a analisar imagem...');
      try {
        const response = await this.jarvis.sendImage(question, photo.base64String);
        this.addMessage('assistant', response, 'text');
      } catch (err) {
        this.showToast('Erro ao enviar imagem. Verifica a ligação.', 'danger');
      } finally {
        this.isLoading = false;
        loading.dismiss();
      }
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) {
        this.showToast('Erro ao aceder à câmera.', 'danger');
      }
    }
  }

  async pickVideo() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';

      input.onchange = async (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        const prompt = await this.promptForMessage(
          'Perguntar ao Jarvis sobre este vídeo:',
          'Ex: O que está acontecendo neste vídeo?'
        );
        if (prompt === null) return;

        const question = prompt || 'O que está neste vídeo?';
        this.addMessage('user', question, 'video');
        this.isLoading = true;

        const loading = await this.showLoading('Jarvis a analisar vídeo...');
        try {
          const base64 = await this.fileToBase64(file);
          const response = await this.jarvis.sendVideo(question, base64, file.type);
          this.addMessage('assistant', response, 'text');
        } catch (err) {
          this.showToast('Erro ao enviar vídeo.', 'danger');
        } finally {
          this.isLoading = false;
          loading.dismiss();
        }
      };

      input.click();
    } catch (err) {
      this.showToast('Erro ao aceder à galeria de vídeos.', 'danger');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private addMessage(role: 'user' | 'assistant', content: string, type: Message['type'], imagePreview?: string) {
    this.messages.push({ role, content, type, imagePreview, timestamp: new Date() });
    this.jarvis.saveMessages(this.messages);
    this.shouldScrollToBottom = true;
  }

  async clearChat() {
    const alert = await this.alertCtrl.create({
      header: 'Limpar conversa',
      message: 'Tens a certeza que queres apagar toda a conversa?',
      cssClass: 'jarvis-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Apagar',
          cssClass: 'danger-btn',
          handler: async () => {
            this.messages = [];
            await this.jarvis.saveMessages([]);
            await this.jarvis.clearHistory().catch(() => {});
          },
        },
      ],
    });
    await alert.present();
  }

  async openSettings() {
    const alert = await this.alertCtrl.create({
      header: '⚙️ Configurações',
      message: 'URL do backend Jarvis (Railway):',
      cssClass: 'jarvis-alert',
      inputs: [
        {
          name: 'url',
          type: 'url',
          placeholder: 'https://jarvis-xxx.railway.app',
          value: this.jarvis.getBaseUrl(),
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            if (data.url) {
              this.jarvis.setBaseUrl(data.url);
              this.showToast('URL guardada!', 'success');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async promptForMessage(header: string, placeholder: string): Promise<string | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header,
        cssClass: 'jarvis-alert',
        inputs: [{ name: 'msg', type: 'text', placeholder }],
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(null) },
          { text: 'Enviar', handler: (data) => resolve(data.msg || '') },
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
