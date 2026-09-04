package com.sosnova.scheduler;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps the process (and WebView timers) alive for a short window after the
 * user leaves the app, so Firestore can finish uploading and keep listening.
 * Stops itself after {@link #KEEP_ALIVE_MS}, when the activity returns, or
 * when the user swipes the task away ({@code stopWithTask}).
 *
 * Must implement {@link #onTimeout} — Android 15 kills the process if a
 * dataSync foreground service overruns its budget without this callback.
 */
public class SyncKeepAliveService extends Service {
  public static final long KEEP_ALIVE_MS = 20L * 60L * 1000L;
  private static final int NOTIFICATION_ID = 7101;
  private static final String CHANNEL_ID = "family-sync-keepalive";

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable stopRunnable = this::stopSelf;
  private PowerManager.WakeLock wakeLock;

  public static void start(Context context) {
    try {
      ContextCompat.startForegroundService(
        context,
        new Intent(context, SyncKeepAliveService.class)
      );
    } catch (Exception ignored) {
      /* OEM blocked background FGS start */
    }
  }

  public static void stop(Context context) {
    try {
      context.stopService(new Intent(context, SyncKeepAliveService.class));
    } catch (Exception ignored) {
      /* not running */
    }
  }

  @Override
  public void onCreate() {
    super.onCreate();
    acquireWakeLock();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (!startForegroundSafe()) {
      stopSelf();
      return START_NOT_STICKY;
    }
    handler.removeCallbacks(stopRunnable);
    handler.postDelayed(stopRunnable, KEEP_ALIVE_MS);
    return START_NOT_STICKY;
  }

  @Override
  public void onTimeout(int startId) {
    stopSelf();
  }

  @Override
  public void onTimeout(int startId, int fgsType) {
    stopSelf();
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(stopRunnable);
    releaseWakeLock();
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void acquireWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) return;
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    if (pm == null) return;
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sheduler:sync");
    wakeLock.setReferenceCounted(false);
    wakeLock.acquire(KEEP_ALIVE_MS + 5000L);
  }

  private void releaseWakeLock() {
    if (wakeLock == null) return;
    try {
      if (wakeLock.isHeld()) wakeLock.release();
    } catch (Exception ignored) {
      /* already released */
    }
    wakeLock = null;
  }

  private boolean startForegroundSafe() {
    Notification notification = buildNotification();
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        );
      } else {
        startForeground(NOTIFICATION_ID, notification);
      }
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private Notification buildNotification() {
    ensureChannel();
    Intent launch = new Intent(this, MainActivity.class);
    launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent content = PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentTitle(getString(R.string.sync_keepalive_title))
      .setContentText(getString(R.string.sync_keepalive_text))
      .setContentIntent(content)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_DEFERRED);
    }
    return builder.build();
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      getString(R.string.sync_keepalive_channel),
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription(getString(R.string.sync_keepalive_channel_desc));
    channel.setShowBadge(false);
    channel.enableVibration(false);
    channel.setSound(null, null);
    nm.createNotificationChannel(channel);
  }
}
