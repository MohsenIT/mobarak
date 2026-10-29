package app.quranmubarak.reader.auto;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.speech.*;
import android.content.pm.PackageManager;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.*;
import java.util.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE,shadows={QuranDictationTest.Available.class})
public class QuranDictationTest {
 @Implements(SpeechRecognizer.class) public static class Available extends ShadowSpeechRecognizer {
  @Implementation protected static boolean isRecognitionAvailable(android.content.Context c){return true;}
 }
 @Test public void permissionDenialIsExplicitAndNeverPretendsSpeechWasHeard(){
  Activity parent=Robolectric.buildActivity(Activity.class).setup().get();List<String> events=new ArrayList<>();
  QuranDictationActivity.launch(parent,"fa-IR",(type,value)->events.add(type+":"+value));
  Intent intent=Shadows.shadowOf(parent).getNextStartedActivity();
  var controller=Robolectric.buildActivity(QuranDictationActivity.class,intent).setup();
  int flags=controller.get().getWindow().getAttributes().flags;
  assertTrue((flags&android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE)!=0);
  assertTrue((flags&android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)!=0);
  controller.get().onRequestPermissionsResult(71,new String[]{android.Manifest.permission.RECORD_AUDIO},new int[]{PackageManager.PERMISSION_DENIED});
  assertEquals(Arrays.asList("error:not-allowed","end:"),events);controller.destroy();parent.finish();
 }
 @Test public void nativeResultsUseRequestedLanguageAndReleaseTheRecognizer(){
  Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(android.Manifest.permission.RECORD_AUDIO);
  Activity parent=Robolectric.buildActivity(Activity.class).setup().get();List<String> events=new ArrayList<>();
  QuranDictationActivity.launch(parent,"fa-IR",(type,value)->events.add(type+":"+value));
  var controller=Robolectric.buildActivity(QuranDictationActivity.class,Shadows.shadowOf(parent).getNextStartedActivity()).setup();
  var recognizer=Shadows.shadowOf(ShadowSpeechRecognizer.getLatestSpeechRecognizer());
  assertEquals("fa-IR",recognizer.getLastRecognizerIntent().getStringExtra(RecognizerIntent.EXTRA_LANGUAGE));
  recognizer.triggerOnReadyForSpeech(new Bundle());Bundle result=new Bundle();result.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION,new ArrayList<>(Arrays.asList("منصوری")));recognizer.triggerOnResults(result);
  assertEquals(Arrays.asList("start:","result:منصوری","end:"),events);assertTrue(recognizer.isDestroyed());controller.destroy();parent.finish();
 }
}
