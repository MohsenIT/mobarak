package app.quranmubarak.reader.auto;
import static org.junit.Assert.*;
import android.app.Activity;
import androidx.core.view.WindowCompat;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class QuranSystemBarsTest {
 @Test public void iconContrastTracksAppThemeAndSurvivesRestore(){
  Activity activity=Robolectric.buildActivity(Activity.class).setup().get();
  QuranSystemBars.apply(activity,false);
  assertTrue(WindowCompat.getInsetsController(activity.getWindow(),activity.getWindow().getDecorView()).isAppearanceLightStatusBars());
  QuranSystemBars.apply(activity,true);
  assertFalse(WindowCompat.getInsetsController(activity.getWindow(),activity.getWindow().getDecorView()).isAppearanceLightStatusBars());
  QuranSystemBars.restore(activity);
  assertFalse(WindowCompat.getInsetsController(activity.getWindow(),activity.getWindow().getDecorView()).isAppearanceLightStatusBars());
  activity.finish();
 }
}
