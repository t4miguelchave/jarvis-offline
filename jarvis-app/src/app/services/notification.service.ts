import { Injectable, NgZone } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { Subject } from 'rxjs';

export interface AppNotification {
  app: string;
  title: string;
  text: string;
  package: string;
  timestamp: Date;
}

// Register the native plugin
const NativeNotificationListener = registerPlugin<any>('NotificationListener');

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notification$ = new Subject<AppNotification>();
  private listenerHandle: any = null;

  constructor(private ngZone: NgZone) {}

  async hasPermission(): Promise<boolean> {
    try {
      const result = await NativeNotificationListener.hasPermission();
      return result.granted === true;
    } catch {
      return false;
    }
  }

  async requestPermission(): Promise<void> {
    try {
      await NativeNotificationListener.requestPermission();
    } catch {
      // Not on Android or plugin not available
    }
  }

  async startListening(): Promise<void> {
    try {
      this.listenerHandle = await NativeNotificationListener.addListener(
        'notificationReceived',
        (data: any) => {
          this.ngZone.run(() => {
            this.notification$.next({
              app: data.app,
              title: data.title,
              text: data.text,
              package: data.package,
              timestamp: new Date(),
            });
          });
        }
      );
    } catch {
      // Not on Android
    }
  }

  stopListening(): void {
    this.listenerHandle?.remove();
    this.listenerHandle = null;
  }
}
