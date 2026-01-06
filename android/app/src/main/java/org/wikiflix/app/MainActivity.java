package org.wikiflix.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Handles the splash screen transition.
    SplashScreen.installSplashScreen(this);

    super.onCreate(savedInstanceState);

    // Enables edge-to-edge display from the Android side.
    // This works with the CSS safe-area-inset variables from the web side.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
  }
}
