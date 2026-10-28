package app.quranmubarak.reader.auto;

import android.app.Activity;
import android.graphics.Color;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** Match system icon contrast to the app's own theme, including edge-to-edge Android. */
public final class QuranSystemBars {
  private QuranSystemBars() {}
  public static void restore(Activity activity) {
    apply(activity, activity.getSharedPreferences("quran-appearance",0).getBoolean("night",false));
  }
  @SuppressWarnings("deprecation")
  public static void apply(Activity activity, boolean night) {
    activity.getSharedPreferences("quran-appearance",0).edit().putBoolean("night",night).apply();
    WindowInsetsControllerCompat bars=WindowCompat.getInsetsController(activity.getWindow(),activity.getWindow().getDecorView());
    bars.setAppearanceLightStatusBars(!night);
    bars.setAppearanceLightNavigationBars(!night);
    int background=Color.parseColor(night?"#0e2a22":"#f2ecdc");
    activity.getWindow().setStatusBarColor(background);
    activity.getWindow().setNavigationBarColor(background);
  }
}
