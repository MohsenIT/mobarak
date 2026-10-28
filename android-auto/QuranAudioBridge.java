package app.quranmubarak.reader.auto;

import android.app.Activity;
import android.content.ComponentName;
import android.net.Uri;
import android.os.*;
import android.webkit.WebView;
import androidx.media3.common.*;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.*;
import androidx.webkit.*;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Same-origin, main-frame bridge. Web playback and the car share one native session. */
@UnstableApi
public final class QuranAudioBridge implements AutoCloseable {
  private final Activity activity;
  private final WebView web;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService files=Executors.newSingleThreadExecutor();
  private final ListenableFuture<MediaController> future;
  private MediaController controller;
  private JavaScriptReplyProxy reply;
  private boolean closed;
  private String pendingLanguage;
  private long libraryRevision=-1;
  private final QuranCarLibrary library;
  private final Set<String> languages=new HashSet<>();
  private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
    public void onActivityCreated(Activity a,Bundle b){}
    public void onActivityStarted(Activity a){}
    public void onActivityResumed(Activity a){if(a==activity)handler.post(()->QuranSystemBars.restore(activity));}
    public void onActivityPaused(Activity a){}
    public void onActivityStopped(Activity a){}
    public void onActivitySaveInstanceState(Activity a,Bundle b){}
    public void onActivityDestroyed(Activity a){if(a==activity)close();}
  };
  private final Set<String> reciters=new HashSet<>(),audioSources=new HashSet<>();
  private final int[] counts=new int[114];
  private final Runnable tick=new Runnable(){public void run(){if(closed)return;state();handler.postDelayed(this,500);}};
  public QuranAudioBridge(Activity activity,WebView web) {
    this.activity=activity;this.web=web;
    QuranCarLibrary loadedLibrary;
    try(InputStream in=activity.getAssets().open("quran-auto.json");ByteArrayOutputStream out=new ByteArrayOutputStream()){
      byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);
      JSONObject data=new JSONObject(out.toString("UTF-8"));loadedLibrary=new QuranCarLibrary(activity.getSharedPreferences("quran-auto",android.content.Context.MODE_PRIVATE),data.getJSONArray("surahs"));JSONArray rs=data.getJSONArray("reciters"),ss=data.getJSONArray("surahs");
      Iterator<String> locales=data.getJSONObject("labels").keys();while(locales.hasNext())languages.add(locales.next());
      for(int i=0;i<rs.length();i++)reciters.add(rs.getJSONObject(i).getString("id"));audioSources.addAll(reciters);JSONArray ta=data.getJSONArray("translationAudio");for(int i=0;i<ta.length();i++)audioSources.add(ta.getJSONObject(i).getString("id"));
      for(int i=0;i<ss.length();i++)counts[i]=ss.getJSONObject(i).getInt("vc");
    }catch(Exception e){throw new IllegalStateException("Invalid native audio catalogue",e);}
    library=loadedLibrary;
    if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
    WebViewCompat.addWebMessageListener(web,"QuranNativeAudio",new HashSet<>(Arrays.asList("http://tauri.localhost","https://tauri.localhost")),(view,message,origin,mainFrame,proxy)->{
      if(!mainFrame||closed)return;
      String text=message.getData();if(text==null||text.length()>6000000)return;
      reply=proxy;
      try{command(new JSONObject(text));}catch(Exception e){try{sendError(new JSONObject(text).optInt("id"),"invalid-command");}catch(JSONException ignored){sendError(0,"invalid-command");}}
    });
    }else throw new IllegalStateException("WebView message listener unsupported");
    future=new MediaController.Builder(activity,new SessionToken(activity,new ComponentName(activity,QuranCarService.class))).buildAsync();
    future.addListener(()->{try{controller=future.get();if(pendingLanguage!=null)applyLanguage(pendingLanguage);controller.addListener(new Player.Listener(){@Override public void onEvents(Player p,Player.Events e){state();}});state();}catch(Exception e){sendError(0,"connection-failed");}},activity::runOnUiThread);
    activity.getApplication().registerActivityLifecycleCallbacks(lifecycle);
    handler.post(tick);
  }
  private void post(JSONObject data){if(reply!=null&&!closed&&WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))try{reply.postMessage(data.toString());}catch(RuntimeException ignored){}}
  private void sendError(int id,String code){try{post(new JSONObject().put("id",id).put("error",code));}catch(JSONException ignored){}}
  private void ok(int id){try{post(new JSONObject().put("id",id).put("ok",true));}catch(JSONException ignored){}}
  private void libraryState(){
    try{JSONObject data=library.snapshot();long revision=data.optLong("revision");if(revision==libraryRevision)return;libraryRevision=revision;post(new JSONObject().put("type","library").put("data",data));}catch(JSONException ignored){}
  }
  private void state(){
    libraryState();if(controller==null)return;
    try{
      long duration=controller.getDuration();Timeline timeline=controller.getCurrentTimeline();
      if(!timeline.isEmpty()){Timeline.Window w=timeline.getWindow(controller.getCurrentMediaItemIndex(),new Timeline.Window());for(int i=w.firstPeriodIndex;i<=w.lastPeriodIndex;i++)if(timeline.getPeriod(i,new Timeline.Period()).durationUs==C.TIME_UNSET){duration=0;break;}}
      JSONObject s=new JSONObject().put("type","state").put("connected",true).put("playing",controller.isPlaying()).put("playWhenReady",controller.getPlayWhenReady())
        .put("position",controller.getCurrentPosition()/1000d).put("duration",Math.max(0,duration)/1000d).put("speed",controller.getPlaybackParameters().speed)
        .put("ready",controller.getPlaybackState()!=Player.STATE_BUFFERING&&controller.getCurrentMediaItem()!=null&&controller.getPlayerError()==null).put("ended",controller.getPlaybackState()==Player.STATE_ENDED);
      MediaItem item=controller.getCurrentMediaItem();if(item!=null)s.put("item",item.mediaId);
      Bundle preferences=controller.getSessionExtras();JSONObject options=new JSONObject();for(String key:preferences.keySet())options.put(key,preferences.get(key));s.put("options",options);
      PlaybackException error=controller.getPlayerError();if(error!=null)s.put("error",error.getErrorCodeName());
      post(s);
    }catch(JSONException ignored){}
  }
  private void refreshDownloads(){if(controller!=null)controller.sendCustomCommand(new androidx.media3.session.SessionCommand("refreshDownloads",android.os.Bundle.EMPTY),android.os.Bundle.EMPTY);}
  private void applyLanguage(String language){
    Bundle args=new Bundle();args.putString("language",language);
    controller.sendCustomCommand(new SessionCommand("configureLanguage",Bundle.EMPTY),args);
  }
  private void command(JSONObject c)throws Exception{
    int id=c.optInt("id");String op=c.optString("op");
    if(op.equals("appearance")){
      String theme=c.getString("theme");if(!theme.equals("paper")&&!theme.equals("night"))throw new IllegalArgumentException("Invalid theme");
      QuranSystemBars.apply(activity,theme.equals("night"));ok(id);return;
    }
    if(op.equals("carOption")){
      if(controller==null)throw new IllegalStateException("Controller not ready");
      Bundle args=new Bundle();args.putString("key",c.getString("key"));args.putString("value",c.getString("value"));
      ListenableFuture<SessionResult> result=controller.sendCustomCommand(new SessionCommand("configureCarOptions",Bundle.EMPTY),args);
      result.addListener(()->{try{if(result.get().resultCode==SessionResult.RESULT_SUCCESS)ok(id);else sendError(id,"invalid-option");}catch(Exception e){sendError(id,"option-failed");}state();},activity::runOnUiThread);return;
    }
    if(op.equals("libraryGet")){libraryRevision=-1;libraryState();ok(id);return;}
    if(op.equals("library")){
      library.mutate(c);libraryState();
      if(controller!=null)controller.sendCustomCommand(new SessionCommand("refreshCarLibrary",Bundle.EMPTY),Bundle.EMPTY);
      ok(id);return;
    }
    if(op.equals("language")){
      String language=c.getString("language");if(!languages.contains(language))throw new IllegalArgumentException("Unsupported language");
      pendingLanguage=language;
      if(controller!=null)applyLanguage(language);
      else activity.getSharedPreferences("quran-auto",android.content.Context.MODE_PRIVATE).edit().putString("language",language).apply();
      ok(id);return;
    }
    if(op.equals("hello")){state();ok(id);return;}
    if(op.equals("deleteCache")){
      String r=c.getString("r");int s=c.getInt("s");validate(r,s,1);
      files.execute(()->{
        boolean success=true;
        for(int a=1;a<=counts[s-1];a++){File file=audioFile(activity,r,s,a);if(file.exists()&&!file.delete())success=false;}
        File pin=new File(audioFile(activity,r,s,1).getParentFile(),String.format(Locale.ROOT,"%03d.pin",s));if(pin.exists()&&!pin.delete())success=false;
        final boolean deleted=success;activity.runOnUiThread(()->{if(deleted){refreshDownloads();ok(id);}else sendError(id,"delete-failed");});
      });return;
    }
    if(op.equals("cache")){
      String r=c.getString("r");int s=c.getInt("s"),a=c.getInt("a");validate(r,s,a);
      String base64=c.getString("data");boolean pinned=c.optBoolean("pin");
      files.execute(()->{
        File temp=null;
        try{
          byte[] bytes=android.util.Base64.decode(base64,android.util.Base64.DEFAULT);
          if(bytes.length<4||bytes.length>4*1024*1024)throw new IOException("Invalid audio size");
          boolean mp3=bytes[0]=='I'&&bytes[1]=='D'&&bytes[2]=='3'||(bytes[0]&255)==255&&(bytes[1]&224)==224;
          if(!mp3)throw new IOException("Invalid MP3");
          File file=audioFile(activity,r,s,a);if(!file.getParentFile().isDirectory()&&!file.getParentFile().mkdirs())throw new IOException("Cannot create audio directory");
          temp=File.createTempFile("verse-",".part",file.getParentFile());
          try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);}
          if(!temp.renameTo(file))throw new IOException("Cannot save audio");
          if(pinned)new File(file.getParentFile(),String.format(Locale.ROOT,"%03d.pin",s)).createNewFile();
          pruneAudio();
          activity.runOnUiThread(()->{if(pinned&&a==counts[s-1])refreshDownloads();ok(id);});
        }catch(Exception e){if(temp!=null)temp.delete();activity.runOnUiThread(()->sendError(id,"cache-failed"));}
      });return;
    }
    if(controller==null){sendError(id,"not-connected");return;}
    switch(op){
      case "select":{
        String r=c.getString("r");int s=c.getInt("s"),a=c.getInt("a");validate(r,s,a);if(!reciters.contains(r))throw new IllegalArgumentException("Not a Quran reciter");
        MediaItem item=new MediaItem.Builder().setMediaId("v/"+r+"/"+s+"/"+a).build();
        controller.setMediaItem(item);controller.prepare();controller.setPlayWhenReady(c.optBoolean("play"));break;
      }
      case "play":controller.prepare();controller.play();break;
      case "pause":controller.pause();break;
      case "stop":controller.stop();break;
      case "seek":controller.seekTo(Math.max(0,(long)(c.getDouble("position")*1000)));break;
      case "speed":{float speed=(float)c.getDouble("value");if(speed<0.5f||speed>2f)throw new IllegalArgumentException();controller.setPlaybackSpeed(speed);break;}
      case "repeat":{
        Bundle args=new Bundle();args.putInt("verse",c.optInt("verse",1));args.putInt("surah",c.optInt("surah",1));
        controller.sendCustomCommand(new SessionCommand("configureRepeat",Bundle.EMPTY),args);break;
      }
      default:throw new IllegalArgumentException("Unknown command");
    }
    ok(id);state();
  }
  private void pruneAudio(){
    File[] directories=new File(activity.getFilesDir(),"recitation").listFiles();if(directories==null)return;
    ArrayList<File> transientFiles=new ArrayList<>();long total=0,old=System.currentTimeMillis()-7L*24*60*60*1000;
    for(File directory:directories){File[] entries=directory.listFiles();if(entries==null)continue;
      for(File file:entries){String name=file.getName();if(!name.matches("[0-9]{6}\\.mp3")||new File(directory,name.substring(0,3)+".pin").exists())continue;
        if(file.lastModified()<old){file.delete();continue;}transientFiles.add(file);total+=file.length();
      }
    }
    transientFiles.sort(Comparator.comparingLong(File::lastModified));
    for(File file:transientFiles){if(total<=40L*1024*1024)break;long length=file.length();if(file.delete())total-=length;}
  }
  private void validate(String r,int s,int a){if(!audioSources.contains(r)||s<1||s>114||a<1||a>counts[s-1])throw new IllegalArgumentException("Invalid verse");}
  static File audioFile(android.content.Context c,String r,int s,int a){return new File(new File(c.getFilesDir(),"recitation/"+r),String.format(Locale.ROOT,"%03d%03d.mp3",s,a));}
  @Override public void close(){if(closed)return;closed=true;activity.getApplication().unregisterActivityLifecycleCallbacks(lifecycle);handler.removeCallbacks(tick);files.shutdownNow();MediaController.releaseFuture(future);if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))try{WebViewCompat.removeWebMessageListener(web,"QuranNativeAudio");}catch(RuntimeException ignored){}}
}
