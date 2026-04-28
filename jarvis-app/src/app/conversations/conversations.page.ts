import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton,
  IonIcon, IonFooter, IonSpinner,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, settingsOutline, closeOutline, sendOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { JarvisService, Conversation } from '../services/jarvis.service';
import { NotificationService, AppNotification } from '../services/notification.service';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton,
    IonIcon, IonFooter, IonSpinner,
  ],
  templateUrl: './conversations.page.html',
  styleUrls: ['./conversations.page.scss'],
})
export class ConversationsPage implements OnInit, OnDestroy {
  conversations: Conversation[] = [];

  // Notification card
  activeNotification: AppNotification | null = null;
  suggestedReply: string | null = null;
  isGeneratingReply = false;
  private notifSub?: Subscription;

  constructor(
    private jarvis: JarvisService,
    private notifService: NotificationService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {
    addIcons({ addOutline, trashOutline, settingsOutline, closeOutline, sendOutline });
  }

  async ngOnInit() {
    await this.loadConversations();
    await this.setupNotifications();
  }

  async ionViewWillEnter() {
    await this.loadConversations();
  }

  ngOnDestroy() {
    this.notifSub?.unsubscribe();
    this.notifService.stopListening();
  }

  async setupNotifications() {
    const hasPermission = await this.notifService.hasPermission();
    if (!hasPermission) {
      await this.notifService.requestPermission();
    }
    await this.notifService.startListening();

    this.notifSub = this.notifService.notification$.subscribe(notif => {
      this.activeNotification = notif;
      this.suggestedReply = null;
    });
  }

  async generateReply() {
    if (!this.activeNotification) return;
    this.isGeneratingReply = true;
    try {
      const prompt = `Recebi uma mensagem no ${this.activeNotification.app} de "${this.activeNotification.title}": "${this.activeNotification.text}". Sugere uma resposta curta e natural em português.`;
      const sessionId = 'notif_reply_' + Date.now();
      this.suggestedReply = await this.jarvis.sendText(prompt, sessionId);
    } catch {
      this.suggestedReply = 'Erro ao gerar resposta.';
    } finally {
      this.isGeneratingReply = false;
    }
  }

  dismissNotification() {
    this.activeNotification = null;
    this.suggestedReply = null;
  }

  async loadConversations() {
    this.conversations = await this.jarvis.loadAllConversations();
  }

  newConversation() {
    const conv = this.jarvis.createNewConversation();
    this.router.navigate(['/chat', conv.id], { state: { conversation: conv, isNew: true } });
  }

  openConversation(conv: Conversation) {
    this.router.navigate(['/chat', conv.id], { state: { conversation: conv, isNew: false } });
  }

  async deleteConversation(conv: Conversation, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Apagar conversa',
      message: `Apagar "${conv.title}"?`,
      cssClass: 'jarvis-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Apagar',
          handler: async () => {
            await this.jarvis.deleteConversation(conv.id);
            await this.loadConversations();
            const toast = await this.toastCtrl.create({ message: 'Conversa apagada', duration: 2000, color: 'danger', position: 'top' });
            toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  async openSettings() {
    const alert = await this.alertCtrl.create({
      header: '⚙️ Configurações',
      message: 'URL do backend Jarvis:',
      cssClass: 'jarvis-alert',
      inputs: [{ name: 'url', type: 'url', placeholder: 'https://jarvis-api-xjdg.onrender.com', value: this.jarvis.getBaseUrl() }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (data) => { if (data.url) this.jarvis.setBaseUrl(data.url); } },
      ],
    });
    await alert.present();
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  }
}
