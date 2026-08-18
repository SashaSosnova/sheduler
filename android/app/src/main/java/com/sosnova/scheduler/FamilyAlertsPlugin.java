package com.sosnova.scheduler;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FamilyAlerts")
public class FamilyAlertsPlugin extends Plugin {
  @PluginMethod
  public void start(PluginCall call) {
    String code = call.getString("code", "");
    String role = call.getString("role", "parent");
    String childName = call.getString("childName", "Даня");
    if (code == null || code.isEmpty()) {
      call.reject("no family code");
      return;
    }
    SharedPreferences prefs =
        getContext().getSharedPreferences(FamilyListenService.PREFS, Context.MODE_PRIVATE);
    prefs
        .edit()
        .putBoolean("enabled", true)
        .putString("code", code)
        .putString("role", role)
        .putString("childName", childName == null || childName.isEmpty() ? "Даня" : childName)
        .apply();
    maybeAskIgnoreBattery();
    Intent intent = new Intent(getContext(), FamilyListenService.class);
    ContextCompat.startForegroundService(getContext(), intent);
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    SharedPreferences prefs =
        getContext().getSharedPreferences(FamilyListenService.PREFS, Context.MODE_PRIVATE);
    prefs.edit().putBoolean("enabled", false).apply();
    getContext().stopService(new Intent(getContext(), FamilyListenService.class));
    call.resolve();
  }

  private void maybeAskIgnoreBattery() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
    Context ctx = getContext();
    PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
    if (pm == null || pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) return;
    SharedPreferences prefs =
        ctx.getSharedPreferences(FamilyListenService.PREFS, Context.MODE_PRIVATE);
    if (prefs.getBoolean("batteryAsked", false)) return;
    prefs.edit().putBoolean("batteryAsked", true).apply();
    try {
      Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
      intent.setData(Uri.parse("package:" + ctx.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(intent);
    } catch (Exception ignored) {
      /* some OEMs hide this screen */
    }
  }
}
