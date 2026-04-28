package com.miguelmac.jarvis;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {

    private BroadcastReceiver notificationReceiver = null;

    @Override
    public void load() {
        notificationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("app", intent.getStringExtra(JarvisNotificationService.EXTRA_APP));
                data.put("title", intent.getStringExtra(JarvisNotificationService.EXTRA_TITLE));
                data.put("text", intent.getStringExtra(JarvisNotificationService.EXTRA_TEXT));
                data.put("package", intent.getStringExtra(JarvisNotificationService.EXTRA_PACKAGE));
                
                notifyListeners("notificationReceived", data);
            }
        };

        IntentFilter filter = new IntentFilter(JarvisNotificationService.ACTION_NOTIFICATION);
        ContextCompat.registerReceiver(
            getContext(),
            notificationReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        String enabledListeners = android.provider.Settings.Secure.getString(
            getContext().getContentResolver(),
            "enabled_notification_listeners"
        );
        boolean enabled = enabledListeners != null && enabledListeners.contains(getContext().getPackageName());

        JSObject result = new JSObject();
        result.put("granted", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (notificationReceiver != null) {
            getContext().unregisterReceiver(notificationReceiver);
        }
        super.handleOnDestroy();
    }
}
