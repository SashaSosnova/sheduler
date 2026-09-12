package com.sosnova.scheduler;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onPause() {
    super.onPause();
    // Capacitor pauses WebView timers here, which freezes Firestore.
    // Keep JS running so the family doc can still upload/listen.
    resumeWebView();
  }

  @Override
  public void onStop() {
    super.onStop();
    SyncKeepAliveService.start(this);
    resumeWebView();
  }

  @Override
  public void onResume() {
    super.onResume();
    SyncKeepAliveService.stop(this);
    resumeWebView();
    notifyJsResume();
  }

  private void resumeWebView() {
    if (getBridge() == null) return;
    WebView webView = getBridge().getWebView();
    if (webView == null) return;
    webView.onResume();
    webView.resumeTimers();
  }

  private void notifyJsResume() {
    if (getBridge() == null) return;
    WebView webView = getBridge().getWebView();
    if (webView == null) return;
    webView.evaluateJavascript(
      "window.dispatchEvent(new Event('sheduler-resume'));",
      null
    );
  }
}
