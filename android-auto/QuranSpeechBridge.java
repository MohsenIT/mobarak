package app.quranmubarak.reader.auto;
import android.app.Activity;
import android.webkit.WebView;
import androidx.webkit.*;
import java.util.*;
import org.json.*;

/** Only the app's local main frame may start speech recognition. */
public final class QuranSpeechBridge implements AutoCloseable {
 private final WebView web; private String active; private boolean closed;
 public QuranSpeechBridge(Activity activity,WebView web){
  this.web=web;
  WebViewCompat.addWebMessageListener(web,"QuranNativeSpeech",new HashSet<>(Arrays.asList("http://tauri.localhost","https://tauri.localhost")),(view,message,origin,mainFrame,proxy)->{
   if(!mainFrame||closed)return;
   try{
    String raw=message.getData();if(raw==null||raw.length()>1000)return;
    JSONObject data=new JSONObject(raw);String op=data.optString("op");int id=data.getInt("id");
    if(op.equals("start")){
     String language=data.optString("language");if(!language.matches("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*"))return;
     if(active!=null)QuranDictationActivity.cancel(active,false);
     active=QuranDictationActivity.launch(activity,language,(type,value)->{
      if(closed)return;
      try{proxy.postMessage(new JSONObject().put("id",id).put("type",type).put("value",value).toString());}catch(RuntimeException|JSONException ignored){}
     });
    }else if(op.equals("stop")||op.equals("abort")){if(active!=null)QuranDictationActivity.cancel(active,op.equals("stop"));}
   }catch(JSONException ignored){}
  });
 }
 @Override public void close(){closed=true;if(active!=null)QuranDictationActivity.cancel(active,false);WebViewCompat.removeWebMessageListener(web,"QuranNativeSpeech");}
}
