package com.sosnova.scheduler;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;

public class FamilyAlertsBootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    SharedPreferences prefs =
        context.getSharedPreferences(FamilyListenService.PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("enabled", false)) return;
    ContextCompat.startForegroundService(context, new Intent(context, FamilyListenService.class));
  }
}
