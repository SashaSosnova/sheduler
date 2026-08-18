package com.sosnova.scheduler;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(FamilyAlertsPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onResume() {
    super.onResume();
    FamilyListenService.appResumed = true;
  }

  @Override
  public void onPause() {
    FamilyListenService.appResumed = false;
    super.onPause();
  }
}
