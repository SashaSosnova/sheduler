package com.sosnova.scheduler;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Listens to the family Firestore doc while the app is closed,
 * so parent/child alerts work without a paid Cloud Functions plan.
 */
public class FamilyListenService extends Service {
  static final String PREFS = "family_alerts";
  static final String CHANNEL_LISTEN = "family-listen";
  static final String CHANNEL_ALERT = "parent-activity";
  static final String CHANNEL_TASK = "parent-tasks";
  static volatile boolean appResumed = false;

  private ListenerRegistration listener;

  @Override
  public void onCreate() {
    super.onCreate();
    ensureChannels();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForeground(9001, listenNotification());
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    if (!prefs.getBoolean("enabled", false)) {
      stopSelf();
      return START_NOT_STICKY;
    }
    String code = prefs.getString("code", "");
    if (code == null || code.isEmpty()) {
      stopSelf();
      return START_NOT_STICKY;
    }
    FirebaseAuth auth = FirebaseAuth.getInstance();
    if (auth.getCurrentUser() != null) {
      attach(code);
    } else {
      auth.signInAnonymously()
          .addOnSuccessListener(r -> attach(code))
          .addOnFailureListener(e -> stopSelf());
    }
    return START_STICKY;
  }

  private void attach(String code) {
    if (listener != null) listener.remove();
    listener =
        FirebaseFirestore.getInstance()
            .collection("families")
            .document(code)
            .addSnapshotListener(
                (snap, err) -> {
                  if (err != null || snap == null || !snap.exists()) return;
                  handleSnapshot(snap);
                });
  }

  private void handleSnapshot(DocumentSnapshot snap) {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    String role = prefs.getString("role", "parent");
    String childName = prefs.getString("childName", "Даня");
    Set<String> seen = new HashSet<>(prefs.getStringSet("seen", new HashSet<>()));
    List<Alert> alerts = collectAlerts(snap, role, childName);
    boolean catchUp = seen.isEmpty();
    List<Alert> fresh = new ArrayList<>();
    for (Alert alert : alerts) {
      if (seen.contains(alert.key)) continue;
      seen.add(alert.key);
      if (!catchUp) fresh.add(alert);
    }
    prefs.edit().putStringSet("seen", seen).apply();
    if (appResumed) return;
    for (Alert alert : fresh) showAlert(alert);
  }

  private List<Alert> collectAlerts(DocumentSnapshot snap, String role, String childName) {
    List<Alert> out = new ArrayList<>();
    if ("parent".equals(role)) {
      Object rawChew = snap.get("chewEntries");
      if (rawChew instanceof List) {
        for (Object row : (List<?>) rawChew) {
          if (!(row instanceof Map)) continue;
          Map<?, ?> entry = (Map<?, ?>) row;
          String id = asString(entry.get("id"));
          if (id.isEmpty()) continue;
          String food = asString(entry.get("food"));
          out.add(
              new Alert(
                  "chew:" + id,
                  childName + " заполнил дневник жевания",
                  food.isEmpty() ? "Запись сохранена" : "Еда: " + food,
                  CHANNEL_ALERT));
        }
      }
      Object daysRaw = snap.get("days");
      if (daysRaw instanceof Map) {
        Map<?, ?> days = (Map<?, ?>) daysRaw;
        for (Map.Entry<?, ?> dayEntry : days.entrySet()) {
          if (!(dayEntry.getValue() instanceof Map)) continue;
          String date = asString(dayEntry.getKey());
          Map<?, ?> day = (Map<?, ?>) dayEntry.getValue();
          Object finished = day.get("workoutFinishedAt");
          if (!(finished instanceof Number)) continue;
          long at = ((Number) finished).longValue();
          out.add(
              new Alert(
                  "workout:" + date + ":" + at,
                  childName + " сделал зарядку",
                  "Комплекс упражнений отмечен",
                  CHANNEL_ALERT));
        }
      }
    } else {
      Object daysRaw = snap.get("days");
      if (!(daysRaw instanceof Map)) return out;
      Map<?, ?> days = (Map<?, ?>) daysRaw;
      for (Map.Entry<?, ?> dayEntry : days.entrySet()) {
        if (!(dayEntry.getValue() instanceof Map)) continue;
        Map<?, ?> day = (Map<?, ?>) dayEntry.getValue();
        Object tasks = day.get("extraTasks");
        if (tasks instanceof List) {
          for (Object row : (List<?>) tasks) {
            if (!(row instanceof Map)) continue;
            Map<?, ?> task = (Map<?, ?>) row;
            if (!Boolean.TRUE.equals(task.get("fromParent"))) continue;
            String id = asString(task.get("id"));
            if (id.isEmpty()) continue;
            String label = asString(task.get("fromParentAs"));
            if (label.isEmpty()) label = "родителя";
            String text = asString(task.get("text"));
            out.add(
                new Alert(
                    "parent-task:" + id,
                    "Добавлено задание от " + label + ": " + text,
                    "Открой «Сегодня», чтобы отметить",
                    CHANNEL_TASK));
          }
        }
        Object reminders = day.get("reminders");
        if (reminders instanceof List) {
          for (Object row : (List<?>) reminders) {
            if (!(row instanceof Map)) continue;
            Map<?, ?> rem = (Map<?, ?>) row;
            if (!Boolean.TRUE.equals(rem.get("fromParent"))) continue;
            String id = asString(rem.get("id"));
            if (id.isEmpty()) continue;
            String label = asString(rem.get("fromParentAs"));
            if (label.isEmpty()) label = "родителя";
            String text = asString(rem.get("text"));
            String time = asString(rem.get("time"));
            out.add(
                new Alert(
                    "parent-reminder:" + id,
                    "Напоминание от " + label + ": " + text,
                    time.isEmpty() ? "Открой приложение" : "В " + time,
                    CHANNEL_TASK));
          }
        }
      }
    }
    return out;
  }

  private static String asString(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private void showAlert(Alert alert) {
    Intent open = new Intent(this, MainActivity.class);
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi =
        PendingIntent.getActivity(
            this,
            alert.key.hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification notification =
        new NotificationCompat.Builder(this, alert.channel)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(alert.title)
            .setContentText(alert.body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(alert.body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();
    NotificationManager nm = getSystemService(NotificationManager.class);
    int id = 9100 + Math.abs(alert.key.hashCode() % 8000);
    nm.notify(id, notification);
  }

  private Notification listenNotification() {
    Intent open = new Intent(this, MainActivity.class);
    PendingIntent pi =
        PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    return new NotificationCompat.Builder(this, CHANNEL_LISTEN)
        .setSmallIcon(android.R.drawable.ic_popup_reminder)
        .setContentTitle("Sheduler")
        .setContentText("Следим за семьёй в фоне")
        .setContentIntent(pi)
        .setOngoing(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build();
  }

  private void ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    NotificationChannel listen =
        new NotificationChannel(
            CHANNEL_LISTEN, "Фон семьи", NotificationManager.IMPORTANCE_LOW);
    listen.setDescription("Нужно, чтобы уведомления приходили при закрытом приложении");
    nm.createNotificationChannel(listen);
    NotificationChannel parent =
        new NotificationChannel(
            CHANNEL_ALERT, "Прогресс ребёнка", NotificationManager.IMPORTANCE_HIGH);
    parent.enableVibration(true);
    nm.createNotificationChannel(parent);
    NotificationChannel tasks =
        new NotificationChannel(
            CHANNEL_TASK, "Задания от родителя", NotificationManager.IMPORTANCE_HIGH);
    tasks.enableVibration(true);
    nm.createNotificationChannel(tasks);
  }

  @Override
  public void onDestroy() {
    if (listener != null) listener.remove();
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private static class Alert {
    final String key;
    final String title;
    final String body;
    final String channel;

    Alert(String key, String title, String body, String channel) {
      this.key = key;
      this.title = title;
      this.body = body;
      this.channel = channel;
    }
  }
}
