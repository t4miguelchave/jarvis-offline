package com.miguelmac.jarvis;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import android.util.Log;

public class JarvisNotificationService extends NotificationListenerService {

    public static final String ACTION_NOTIFICATION = "com.miguelmac.jarvis.NOTIFICATION";
    public static final String EXTRA_APP = "app";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_PACKAGE = "package";

    private static final Set<String> MONITORED_APPS = new HashSet<>(Arrays.asList(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "org.telegram.messenger",
            "com.instagram.android"
    ));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        Log.d("JarvisNotification", "Notification received from: " + packageName);

        // Allow all apps for debugging
        // if (!MONITORED_APPS.contains(packageName)) return;

        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return;
        
        String title = extras.getString(Notification.EXTRA_TITLE);
        if (title == null) return;
        
        CharSequence textObj = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textObj == null) return;
        String text = textObj.toString();

        // Ignore group summaries (WhatsApp sends these)
        if ((sbn.getNotification().flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        // Ignore empty notifications
        if (text.trim().isEmpty() || title.trim().isEmpty()) return;

        String appName;
        switch (packageName) {
            case "com.whatsapp":
            case "com.whatsapp.w4b":
                appName = "WhatsApp";
                break;
            case "org.telegram.messenger":
                appName = "Telegram";
                break;
            case "com.instagram.android":
                appName = "Instagram";
                break;
            default:
                appName = packageName;
                break;
        }

        // Broadcast to the Ionic app via Capacitor plugin
        Intent intent = new Intent(ACTION_NOTIFICATION);
        intent.setPackage(getPackageName()); // Make it explicit for Android 8+
        intent.putExtra(EXTRA_APP, appName);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_TEXT, text);
        intent.putExtra(EXTRA_PACKAGE, packageName);
        
        sendBroadcast(intent);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {}
}
