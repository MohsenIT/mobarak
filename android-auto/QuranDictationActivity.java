package app.quranmubarak.reader.auto;

import android.app.Activity;
import android.content.Intent;
import android.os.*;
import android.speech.*;
import android.content.pm.PackageManager;
import java.lang.ref.WeakReference;
import java.util.*;

/** Native recognition owns its runtime microphone permission; WebView speech is not used. */
public final class QuranDictationActivity extends Activity implements RecognitionListener {
  interface Listener { void event(String type,String value); }
  private static final Map<String,Listener> listeners=new HashMap<>();
  private static WeakReference<QuranDictationActivity> current=new WeakReference<>(null);
  private final Handler handler=new Handler(Looper.getMainLooper());
  private SpeechRecognizer recognizer;
  private String id; private boolean finished;
  static String launch(Activity parent,String language,Listener listener){
    String id=UUID.randomUUID().toString();listeners.put(id,listener);
    try{parent.startActivity(new Intent(parent,QuranDictationActivity.class).putExtra("id",id).putExtra("language",language));}
    catch(RuntimeException e){listeners.remove(id);listener.event("error","service-not-allowed");listener.event("end","");}
    return id;
  }
  static void cancel(String id,boolean accept){
    QuranDictationActivity activity=current.get();
    if(activity!=null&&Objects.equals(activity.id,id)){
      if(accept&&activity.recognizer!=null)activity.recognizer.stopListening();else activity.complete("aborted");
    }else listeners.remove(id);
  }
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    // Keep the existing WebView microphone/stop control interactive while recording.
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
    QuranSystemBars.restore(this);
    id=getIntent().getStringExtra("id");current=new WeakReference<>(this);
    if(id==null||!listeners.containsKey(id)){finish();return;}
    if(!SpeechRecognizer.isRecognitionAvailable(this)){complete("service-not-allowed");return;}
    if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},71);

  }
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){
    super.onRequestPermissionsResult(request,permissions,grants);
    if(request==71){if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)recognize();else complete("not-allowed");}
  }
  @Override public void onResume(){super.onResume();if(!finished&&checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)recognize();}
  private void recognize(){
    if(finished||recognizer!=null)return;
    try{
      recognizer=SpeechRecognizer.createSpeechRecognizer(this);recognizer.setRecognitionListener(this);
      Intent request=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,getIntent().getStringExtra("language")).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
      recognizer.startListening(request);handler.postDelayed(()->complete("timeout"),60000);
    }catch(SecurityException e){complete("not-allowed");}catch(RuntimeException e){complete("service-not-allowed");}
  }
  private void emit(String type,String value){Listener listener=listeners.get(id);if(listener!=null)listener.event(type,value);}
  private void complete(String error){
    if(finished)return;finished=true;handler.removeCallbacksAndMessages(null);
    if(error!=null)emit("error",error);emit("end","");listeners.remove(id);
    if(recognizer!=null){recognizer.cancel();recognizer.destroy();recognizer=null;}finish();
  }
  private String text(Bundle result){ArrayList<String> rows=result.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);return rows==null||rows.isEmpty()?"":rows.get(0);}
  @Override public void onReadyForSpeech(Bundle params){emit("start","");}
  @Override public void onResults(Bundle results){String text=text(results);if(!text.trim().isEmpty())emit("result",text);complete(text.trim().isEmpty()?"no-speech":null);}
  @Override public void onPartialResults(Bundle results){String text=text(results);if(!text.trim().isEmpty())emit("partial",text);}
  @Override public void onError(int code){complete(code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"not-allowed":code==SpeechRecognizer.ERROR_NETWORK||code==SpeechRecognizer.ERROR_NETWORK_TIMEOUT?"network":code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT?"no-speech":"audio-capture");}
  @Override public void onBeginningOfSpeech(){} @Override public void onRmsChanged(float rms){} @Override public void onBufferReceived(byte[] b){} @Override public void onEndOfSpeech(){} @Override public void onEvent(int type,Bundle data){}
  @Override public void onStop(){if(!finished)complete("aborted");super.onStop();}
  @Override public void onDestroy(){if(!finished)complete("aborted");super.onDestroy();}
}
