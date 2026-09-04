package com.sosnova.scheduler;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStop() {
    super.onStop();
    SyncKeepAliveService.start(this);
  }

  @Override
  public void onResume() {
    super.onResume();
    SyncKeepAliveService.stop(this);
  }
}
