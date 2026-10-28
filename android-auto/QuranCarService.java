package app.quranmubarak.reader.auto;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.media3.common.*;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.session.*;
import androidx.media3.session.MediaLibraryService.MediaLibrarySession;
import androidx.media3.session.MediaSession.ControllerInfo;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import java.util.*;

/** Native audio library for Android Auto. No WebView or activity is required for playback. */
@UnstableApi
public final class QuranCarService extends MediaLibraryService {
  private ExoPlayer player;
  private MediaLibrarySession session;
  private JSONArray reciters, surahs,translationAudio,audioSources;
  private String translationAudioId="";
  private JSONObject labels,translations,numberingSystems;
  private Locale uiLocale;
  private final Set<String> languageParents=new HashSet<>(Arrays.asList("root","home","library","surahs","reciters","recent","verse-surahs","downloads"));
  private SharedPreferences saved;
  private String currentReciter;
  private int verseRepeats=1,surahRepeats=1,verseRound=1,surahRound=1;
  private QuranCarLibrary library;
  private final android.os.Handler tasks=new android.os.Handler(android.os.Looper.getMainLooper());
  private Runnable pendingGap,pendingStop;
  private int pauseSeconds,rangeSurah,rangeFrom,rangeTo,listIndex;
  private String activeList="";
  private long sleepDeadline;
  private boolean sleepAtEnd;



  @Override public void onCreate() {
    super.onCreate();
    saved = getSharedPreferences("quran-auto", MODE_PRIVATE);
    try {
      JSONObject catalog = new JSONObject(readCatalogue());
      reciters = catalog.getJSONArray("reciters"); surahs = catalog.getJSONArray("surahs");translationAudio=catalog.getJSONArray("translationAudio");audioSources=new JSONArray();for(int i=0;i<reciters.length();i++)audioSources.put(reciters.optJSONObject(i));for(int i=0;i<translationAudio.length();i++)audioSources.put(translationAudio.optJSONObject(i));translationAudioId=saved.getString("translationAudio","");if(!translationAudioId.isEmpty())translationSource(translationAudioId);
      translations = catalog.getJSONObject("labels");
      numberingSystems = catalog.optJSONObject("numberingSystems");
      if(!selectLanguage(saved.getString("language","fa")))selectLanguage("fa");
    } catch (Exception e) { throw new IllegalStateException("Invalid bundled Quran media catalogue", e); }
    currentReciter = saved.getString("reciter", reciters.optJSONObject(0).optString("id"));
    library=new QuranCarLibrary(saved,surahs);
    pauseSeconds=saved.getInt("pauseSeconds",0);rangeSurah=saved.getInt("rangeSurah",0);rangeFrom=saved.getInt("rangeFrom",0);rangeTo=saved.getInt("rangeTo",0);
    activeList=saved.getString("activeList","");listIndex=saved.getInt("listIndex",0);
    sleepDeadline=saved.getLong("sleepDeadline",0);sleepAtEnd=saved.getBoolean("sleepAtEnd",false);
    verseRepeats=saved.getInt("verseRepeats",1);surahRepeats=saved.getInt("surahRepeats",1);
    ResolvingDataSource.Factory audioSource=new ResolvingDataSource.Factory(new DefaultDataSource.Factory(this),spec->{
      String url=spec.uri.toString();
      for(int i=0;i<audioSources.length();i++){
        JSONObject r=audioSources.optJSONObject(i);String directory=r.optString("tanzilDirectory");
        String base=directory.isEmpty()?"https://verses.quran.com/Minshawi/Murattal/mp3/":"https://tanzil.net/res/audio/"+directory+"/";
        if(!url.startsWith(base))continue;
        String file=url.substring(base.length());if(!file.matches("[0-9]{6}\\.mp3"))continue;
        int surah=Integer.parseInt(file.substring(0,3)),ayah=Integer.parseInt(file.substring(3,6));
        JSONObject s=surahs.optJSONObject(surah-1);if(s==null||ayah<1||ayah>s.optInt("vc"))continue;
        java.io.File cached=QuranAudioBridge.audioFile(this,r.optString("id"),surah,ayah);
        if(cached.isFile()&&cached.length()>0){cached.setLastModified(System.currentTimeMillis());return spec.withUri(android.net.Uri.fromFile(cached));}
      }
      return spec;
    });
    player = new ExoPlayer.Builder(this).setMediaSourceFactory(new QuranVerseMediaSourceFactory(new DefaultMediaSourceFactory(audioSource,new androidx.media3.extractor.DefaultExtractorsFactory().setMp3ExtractorFlags(androidx.media3.extractor.mp3.Mp3Extractor.FLAG_DISABLE_ID3_METADATA)),this::translationUri,item->durationHint(item,false),item->durationHint(item,true))).build();
    player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true);
    player.setHandleAudioBecomingNoisy(true);
    player.setWakeMode(C.WAKE_MODE_LOCAL);
    player.addListener(new Player.Listener() {
      @Override public void onMediaItemTransition(MediaItem item, int reason) {
        if(reason!=Player.MEDIA_ITEM_TRANSITION_REASON_AUTO&&reason!=Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)cancelGap();
        if(reason==Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)verseRound++;else verseRound=1;
        applyRepeat();remember();refreshLibrary();controls();
        if((reason==Player.MEDIA_ITEM_TRANSITION_REASON_AUTO||reason==Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)&&pauseSeconds>0&&player.getPlayWhenReady()){
          playAfterGap();
        }
      }
      @Override public void onPlaybackStateChanged(int state) {
        if(state!=Player.STATE_ENDED || !player.getPlayWhenReady())return;
        finishQueue();
      }
      @Override public void onIsPlayingChanged(boolean playing) { remember();controls(); }
      @Override public void onTimelineChanged(Timeline timeline,int reason){rememberDurations();}
      @Override public void onPlaybackParametersChanged(PlaybackParameters parameters) { remember();controls(); }
      @Override public void onPlayWhenReadyChanged(boolean ready,int reason){if(!ready&&reason!=Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)cancelGap();}
    });
    MediaLibrarySession.Builder builder = new MediaLibrarySession.Builder(this,new ForwardingPlayer(player){
      @Override public void play(){cancelGap();super.play();}
      @Override public void pause(){cancelGap();super.pause();}
      @Override public void setPlayWhenReady(boolean ready){cancelGap();super.setPlayWhenReady(ready);}
      @Override public void stop(){cancelGap();super.stop();}
      @Override public void seekTo(int index,long position){cancelGap();super.seekTo(index,position);}
    }, new Library());
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launch != null) builder.setSessionActivity(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    builder.setCommandButtonsForMediaItems(Arrays.asList(
      new CommandButton.Builder(CommandButton.ICON_CHECK_CIRCLE_UNFILLED).setDisplayName(label("apply")).setSessionCommand(new SessionCommand("applySetting",Bundle.EMPTY)).build(),
      new CommandButton.Builder(CommandButton.ICON_STAR_UNFILLED).setDisplayName(label("favoriteAction")).setSessionCommand(new SessionCommand("favoriteItem",Bundle.EMPTY)).build()
    ));
    session = builder.build();scheduleStop();
    controls();
  }
  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if(intent!=null && "android.media.action.MEDIA_PLAY_FROM_SEARCH".equals(intent.getAction())) {
      List<MediaItem> matches=search(intent.getStringExtra(android.app.SearchManager.QUERY));
      if(!matches.isEmpty()) {
        String[] id=matches.get(0).mediaId.split("/");
        currentReciter=id[1]; player.setMediaItems(queue(id[1],Integer.parseInt(id[2])),Integer.parseInt(id[3])-1,0);
        player.prepare(); player.play();
      }
      return START_NOT_STICKY;
    }
    return super.onStartCommand(intent,flags,startId);
  }
  @Override public MediaLibrarySession onGetSession(ControllerInfo controller) { return session; }
  @Override public void onDestroy() {
    remember();tasks.removeCallbacksAndMessages(null);
    if (session != null) session.release();
    if (player != null) player.release();
    super.onDestroy();
  }
  private String readCatalogue() throws java.io.IOException {
    try (java.io.InputStream in=getAssets().open("quran-auto.json"); java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()) {
      byte[] buffer=new byte[8192]; int count;
      while((count=in.read(buffer))!=-1) out.write(buffer,0,count);
      return out.toString("UTF-8");
    }
  }
  private void applyRepeat(){player.setRepeatMode(verseRepeats==0 || verseRound<verseRepeats?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}
  private void finishQueue(){
        if(sleepAtEnd){sleepAtEnd=false;player.pause();persistOptions();controls();return;}
        if(surahRepeats==0 || surahRound<surahRepeats){surahRound++;player.seekToDefaultPosition(0);playAfterGap();return;}
        if(rangeSurah>0){player.pause();return;}
        if(!activeList.isEmpty()){
          try{JSONArray list=library.list(activeList).getJSONArray("surahs");if(++listIndex<list.length()){surahRound=1;player.setMediaItems(queue(currentReciter,list.getInt(listIndex)));player.prepare();player.play();remember();return;}}
          catch(Exception ignored){}activeList="";player.pause();remember();return;
        }
        MediaItem item=player.getCurrentMediaItem();if(item==null)return;
        String[] p=item.mediaId.split("/");int next=Integer.parseInt(p[2])+1;
        if(next<=114){surahRound=1;player.setMediaItems(queue(currentReciter,next));player.prepare();player.play();}

  }
  private void playAfterGap(){cancelGap();if(pauseSeconds==0){player.play();return;}player.pause();pendingGap=()->{pendingGap=null;player.play();};tasks.postDelayed(pendingGap,pauseSeconds*1000L);}
  private void cancelGap(){if(pendingGap!=null)tasks.removeCallbacks(pendingGap);pendingGap=null;}
  private void scheduleStop(){
    if(pendingStop!=null)tasks.removeCallbacks(pendingStop);pendingStop=null;
    if(sleepDeadline<=0)return;
    if(sleepDeadline<=System.currentTimeMillis()){sleepDeadline=0;persistOptions();return;}
    pendingStop=()->{pendingStop=null;sleepDeadline=0;cancelGap();player.pause();persistOptions();controls();};tasks.postDelayed(pendingStop,sleepDeadline-System.currentTimeMillis());
  }
  private void persistOptions(){saved.edit().putInt("pauseSeconds",pauseSeconds).putInt("rangeSurah",rangeSurah).putInt("rangeFrom",rangeFrom).putInt("rangeTo",rangeTo).putString("activeList",activeList).putInt("listIndex",listIndex).putLong("sleepDeadline",sleepDeadline).putBoolean("sleepAtEnd",sleepAtEnd).putString("translationAudio",translationAudioId).apply();}
  private void normalPlayback(){
    boolean ranged=rangeSurah>0,waiting=pendingGap!=null;cancelGap();
    verseRepeats=surahRepeats=verseRound=surahRound=1;pauseSeconds=rangeSurah=rangeFrom=rangeTo=0;
    player.setPlaybackSpeed(1f);applyRepeat();persistOptions();
    if(ranged&&player.getCurrentMediaItem()!=null){String[] p=selectedVerse().split("/");boolean playing=player.getPlayWhenReady()||waiting;long position=player.getCurrentPosition();player.setMediaItems(queue(p[1],Integer.parseInt(p[2])),Integer.parseInt(p[3])-1,position);player.prepare();player.setPlayWhenReady(playing);}
    else if(waiting)player.play();
  }

  private Bundle options(){Bundle b=new Bundle();b.putFloat("speed",player.getPlaybackParameters().speed);b.putInt("verse",verseRepeats);b.putInt("surah",surahRepeats);b.putInt("pause",pauseSeconds);b.putInt("rangeSurah",rangeSurah);b.putInt("from",rangeFrom);b.putInt("to",rangeTo);b.putLong("sleepDeadline",sleepDeadline);b.putBoolean("sleepAtEnd",sleepAtEnd);b.putString("translationAudio",translationAudioId);return b;}
  private void controls() {
    if(session==null)return;
    String[] p=selectedVerse().split("/");boolean marked=library.favorite(Integer.parseInt(p[2]),Integer.parseInt(p[3]));
    session.setSessionExtras(options());
    session.setCustomLayout(Arrays.asList(
      new CommandButton.Builder(verseRepeats==1?CommandButton.ICON_REPEAT_OFF:CommandButton.ICON_REPEAT_ONE).setDisplayName(verseRepeats==1?label("repeatThree"):label("stopRepeat")).setSessionCommand(new SessionCommand("repeatVerse",Bundle.EMPTY)).build(),
      new CommandButton.Builder(CommandButton.ICON_PLAYBACK_SPEED_1_0).setDisplayName(label("normalPlayback")).setSessionCommand(new SessionCommand("normalPlayback",Bundle.EMPTY)).build(),
      new CommandButton.Builder(marked?CommandButton.ICON_STAR_FILLED:CommandButton.ICON_STAR_UNFILLED).setDisplayName(marked?label("removeFavorite"):label("addFavorite")).setSessionCommand(new SessionCommand("favoriteCurrent",Bundle.EMPTY)).build()
    ));
  }
  private boolean mayEdit(ControllerInfo c){return c!=null&&(c.isTrusted()||c.getPackageName().equals(getPackageName())||c.getPackageName().equals("com.google.android.projection.gearhead"));}
  private SessionResult browseResult(String node,String message){Bundle b=new Bundle();if(node!=null)b.putString("androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_RESULT_BROWSE_NODE",node);b.putString("androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_RESULT_MESSAGE",message);b.putBoolean("androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_RESULT_REFRESH_ITEM",true);return new SessionResult(SessionResult.RESULT_SUCCESS,b);}
  private void refreshCarLibrary(){for(String id:Arrays.asList("home","library","favorites","playlists"))session.notifyChildrenChanged(id,children(id).size(),null);controls();}
  private void applySetting(String key,String value){
    if(!key.equals("normal")&&!Arrays.asList("speed","verse","surah","pause","range","timer","translation").contains(key))throw new IllegalArgumentException("Unknown setting");
    boolean waiting=pendingGap!=null;
    if(key.equals("normal")){normalPlayback();remember();controls();return;}
    if(key.equals("translation")){
      if(!value.equals("off"))translationSource(value);cancelGap();
      translationAudioId=value.equals("off")?"":value;
      if(player.getCurrentMediaItem()!=null){boolean playing=player.getPlayWhenReady();int index=player.getCurrentMediaItemIndex();ArrayList<MediaItem> list=new ArrayList<>();for(int i=0;i<player.getMediaItemCount();i++)list.add(player.getMediaItemAt(i));player.setMediaItems(list,index,0);player.prepare();player.setPlayWhenReady(playing);}
    }
    else if(key.equals("speed")){float n=Float.parseFloat(value);if(!Arrays.asList(.75f,1f,1.25f,1.5f,2f).contains(n))throw new IllegalArgumentException();player.setPlaybackSpeed(n);}
    else if(key.equals("verse")||key.equals("surah")){int n=Integer.parseInt(value);if(!Arrays.asList(0,1,2,3,5,10).contains(n))throw new IllegalArgumentException();if(key.equals("verse"))verseRepeats=n;else surahRepeats=n;verseRound=surahRound=1;applyRepeat();}
    else if(key.equals("pause")){int n=Integer.parseInt(value);if(!Arrays.asList(0,2,5,10).contains(n))throw new IllegalArgumentException();cancelGap();pauseSeconds=n;}
    else if(key.equals("timer")){
      if(!Arrays.asList("off","end","15","30","60").contains(value))throw new IllegalArgumentException();
      sleepAtEnd=value.equals("end");sleepDeadline=value.equals("off")||sleepAtEnd?0:System.currentTimeMillis()+Long.parseLong(value)*60000;scheduleStop();
    }else if(key.equals("range")){
      if(value.equals("off")){cancelGap();rangeSurah=rangeFrom=rangeTo=0;}
      else{
        if(!Arrays.asList("5","10","end").contains(value))throw new IllegalArgumentException();cancelGap();
        String[] p=selectedVerse().split("/");rangeSurah=Integer.parseInt(p[2]);rangeFrom=Integer.parseInt(p[3]);rangeTo=value.equals("end")?surahs.optJSONObject(rangeSurah-1).optInt("vc"):Math.min(surahs.optJSONObject(rangeSurah-1).optInt("vc"),rangeFrom+Integer.parseInt(value)-1);
        verseRepeats=3;surahRepeats=3;pauseSeconds=5;verseRound=surahRound=1;applyRepeat();
      }
      MediaItem current=player.getCurrentMediaItem();if(current!=null){boolean playing=player.getPlayWhenReady();String[] p=current.mediaId.split("/");List<MediaItem> items=selectionQueue(p[1],Integer.parseInt(p[2]));player.setMediaItems(items,Math.max(0,Integer.parseInt(p[3])-(rangeSurah>0?rangeFrom:1)),value.equals("off")?player.getCurrentPosition():0);player.prepare();player.setPlayWhenReady(playing);}
    }else throw new IllegalArgumentException("Unknown setting");
    if(waiting&&Arrays.asList("pause","range","translation").contains(key))playAfterGap();
    persistOptions();remember();controls();session.notifyChildrenChanged("settings",children("settings").size(),null);session.notifyChildrenChanged("settings/"+key,children("settings/"+key).size(),null);
  }
  private boolean selectLanguage(String language) {
    if(!translations.has(language))return false;
    labels=translations.optJSONObject(language);
    String numbering=numberingSystems==null?null:numberingSystems.optString(language,null);
    uiLocale=Locale.forLanguageTag(language+(numbering==null?"":"-u-nu-"+numbering));
    saved.edit().putString("language",language).apply();return true;
  }
  private boolean updateLanguage(String language) {
    if(!translations.has(language))return false;
    if(language.equals(saved.getString("language",""))&&uiLocale!=null&&uiLocale.getLanguage().equals(language))return true;
    if(!selectLanguage(language))return false;
    if(player!=null){
      for(int i=0;i<player.getMediaItemCount();i++){
        MediaItem original=player.getMediaItemAt(i);String[] p=original.mediaId.split("/");
        if(p.length==4&&p[0].equals("v")){
          MediaMetadata metadata=verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3])).mediaMetadata;
          player.replaceMediaItem(i,original.buildUpon().setMediaMetadata(metadata).build());
        }
      }
    }
    if(session!=null){controls();for(String parent:new HashSet<>(languageParents))try{session.notifyChildrenChanged(parent,children(parent).size(),null);}catch(RuntimeException ignored){}}
    return true;
  }
  private void refreshLibrary() {
    if(session==null)return;
    for(String parent:Arrays.asList("home","surahs","reciters","recent","verse-surahs")) {
      try{session.notifyChildrenChanged(parent,children(parent).size(),null);}catch(RuntimeException ignored){}
    }
  }
  private String label(String key) { return labels.optString(key); }
  private String number(int value) { return java.text.NumberFormat.getIntegerInstance(uiLocale).format(value); }
  private JSONObject reciter(String id) {
    for (int i=0;i<reciters.length();i++) { JSONObject r=reciters.optJSONObject(i); if (r.optString("id").equals(id)) return r; }
    throw new IllegalArgumentException("Unknown reciter");
  }
  private MediaItem item(String id, String title, String artist, boolean browse, boolean playable, String uri) {
    MediaMetadata metadata = new MediaMetadata.Builder().setTitle(title).setArtist(artist).setIsBrowsable(browse).setIsPlayable(playable)
      .setMediaType(browse ? MediaMetadata.MEDIA_TYPE_FOLDER_MIXED : MediaMetadata.MEDIA_TYPE_MUSIC).build();
    MediaItem.Builder b = new MediaItem.Builder().setMediaId(id).setMediaMetadata(metadata);
    if (uri != null) b.setUri(uri);
    return b.build();
  }
  private android.net.Uri artwork(int surah){return android.net.Uri.parse("content://"+getPackageName()+".artwork/surah/"+String.format(Locale.ROOT,"%03d.png",surah));}
  private MediaItem verse(String reciterId, int surah, int ayah) {
    JSONObject r = reciter(reciterId), s = surahs.optJSONObject(surah-1);
    if (s == null || ayah < 1 || ayah > s.optInt("vc")) throw new IllegalArgumentException("Invalid verse");
    String file = String.format(Locale.ROOT, "%03d%03d.mp3", surah, ayah);
    String directory = r.optString("tanzilDirectory");
    String uri = directory.isEmpty() ? "https://verses.quran.com/Minshawi/Murattal/mp3/"+file : "https://tanzil.net/res/audio/"+directory+"/"+file;
    MediaItem result=item("v/"+reciterId+"/"+surah+"/"+ayah, s.optString("ar")+" · "+label("verse")+" "+number(ayah), r.optString("name"), false, true, uri);
    return result.buildUpon().setMediaMetadata(result.mediaMetadata.buildUpon().setArtworkUri(artwork(surah)).setSubtitle(s.optJSONArray("texts").optString(ayah-1)).setDescription(s.optJSONArray("texts").optString(ayah-1)).setSupportedCommands(Arrays.asList("favoriteItem")).build()).build();
  }
  private List<MediaItem> queue(String r, int s) {
    ArrayList<MediaItem> items = new ArrayList<>();
    JSONObject surah = surahs.optJSONObject(s-1);
    if (surah == null) throw new IllegalArgumentException("Invalid surah");
    for (int a=1;a<=surah.optInt("vc");a++) items.add(verse(r,s,a));
    return items;
  }
  private List<MediaItem> selectionQueue(String r,int s){List<MediaItem> items=queue(r,s);return rangeSurah==s?new ArrayList<>(items.subList(rangeFrom-1,rangeTo)):items;}
  private void remember() {
    if (saved == null || player == null) return;
    rememberDurations();
    MediaItem item = player.getCurrentMediaItem();
    if (item == null) return;
    String[] parts=item.mediaId.split("/");
    if(parts.length==4)currentReciter=parts[1];
    LinkedHashMap<String,String> recent=new LinkedHashMap<>();
    try{
      JSONArray old=new JSONArray(saved.getString("recent","[]"));
      if(parts.length==4)recent.put(parts[1]+"/"+parts[2],item.mediaId);
      for(int i=0;i<old.length();i++){String id=old.optString(i);String[] p=id.split("/");if(p.length==4)recent.putIfAbsent(p[1]+"/"+p[2],id);}
    }catch(JSONException ignored){}
    JSONArray history=new JSONArray();for(String id:recent.values()){if(history.length()==8)break;history.put(id);}
    persistOptions();
    saved.edit().putString("recent",history.toString()).putString("item",item.mediaId).putLong("position",player.getCurrentPosition())
      .putInt("verseRepeats",verseRepeats).putInt("surahRepeats",surahRepeats).putString("reciter",currentReciter).putFloat("speed",player.getPlaybackParameters().speed).apply();
  }
  private String normalize(String text) {
    StringBuilder digits=new StringBuilder();
    for(int i=0;i<text.length();i++){char c=text.charAt(i);int digit=Character.digit(c,10);digits.append(digit>=0?(char)('0'+digit):c);}
    return java.text.Normalizer.normalize(digits.toString(),java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","")
      .replace('ٱ','ا').replace('ة','ه').replace('ى','ي').replace('ی','ي').replace('ک','ك').replace('ـ',' ').trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);
  }
  private List<MediaItem> search(String query) {
    ArrayList<MediaItem> result=new ArrayList<>();
    if(query==null || query.trim().isEmpty()) {
      String id=saved.getString("item",""); String[] p=id.split("/");
      if(p.length==4) {try{result.add(verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3])));return result;}catch(RuntimeException ignored){}}
      result.add(verse(currentReciter,1,1)); return result;
    }
    String q=" "+normalize(query)+" ";
    String chosenReciter=currentReciter;int bestReciterScore=0;
    for(int i=0;i<reciters.length();i++){
      JSONObject r=reciters.optJSONObject(i);String name=normalize(r.optString("name")),base=name.split("—")[0].trim();
      boolean second=name.contains("—");if(second&&!q.contains("دوم")&&!q.contains("second"))continue;
      int score=q.contains(" "+base+" ")?base.length()*10:0;
      String[] tokens=base.split(" ");String family=tokens[tokens.length-1];
      if(family.length()>=3&&q.contains(" "+family+" "))score=Math.max(score,family.length());
      if(second&&score>0)score+=1000;
      String alias=r.optString("id").replaceFirst("^tanzil-", "").split("-")[0];if(q.contains(" "+alias+" "))score=Math.max(score,alias.length());
      if(score>bestReciterScore){bestReciterScore=score;chosenReciter=r.optString("id");}
    }
    java.util.regex.Matcher numbered=java.util.regex.Pattern.compile("(?:سوره|surah)\\s*([0-9]{1,3})(?:\\s*(?:ايه|ayah|verse)\\s*([0-9]{1,3}))?").matcher(q);
    if(numbered.find()){
      try{result.add(verse(chosenReciter,Integer.parseInt(numbered.group(1)),numbered.group(2)==null?1:Integer.parseInt(numbered.group(2))));}catch(IllegalArgumentException ignored){}
      return result;
    }
    java.util.regex.Matcher address=java.util.regex.Pattern.compile("(?:^|\\s)([0-9]{1,3})\\s*[:/]\\s*([0-9]{1,3})(?:\\s|$)").matcher(q);
    if(address.find()){
      try{result.add(verse(chosenReciter,Integer.parseInt(address.group(1)),Integer.parseInt(address.group(2))));}catch(IllegalArgumentException ignored){}
      return result;
    }
    java.util.regex.Matcher requestedAyah=java.util.regex.Pattern.compile("(?:اي[ةه]|ayah|verse)\\s*([0-9]{1,3})").matcher(q);
    int ayah=requestedAyah.find()?Integer.parseInt(requestedAyah.group(1)):1;
    for(int i=0;i<surahs.length();i++) {
      JSONObject s=surahs.optJSONObject(i);
      if(q.contains(" "+normalize(s.optString("ar"))+" ") || q.contains(" "+normalize(s.optString("ar")).replaceFirst("^ال", "")+" ") || q.contains(" "+normalize(s.optString("fa"))+" ")) {if(ayah>=1&&ayah<=s.optInt("vc"))result.add(verse(chosenReciter,s.optInt("n"),ayah));}
    }
    if(result.isEmpty()&&bestReciterScore>0){String[] p=selectedVerse().split("/");result.add(verse(chosenReciter,Integer.parseInt(p[2]),Integer.parseInt(p[3])));}
    return result;
  }
  private String selectedVerse() {
    MediaItem playing=player.getCurrentMediaItem();
    return playing!=null?playing.mediaId:saved.getString("item","v/"+currentReciter+"/1/1");
  }
  private MediaItem continuation() {
    String[] p=selectedVerse().split("/");
    MediaItem track=verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3]));
    MediaItem result=item("resume",label("resume"),track.mediaMetadata.title+" · "+reciter(p[1]).optString("name"),false,true,null);
    return result.buildUpon().setMediaMetadata(result.mediaMetadata.buildUpon().setArtworkUri(artwork(Integer.parseInt(p[2]))).build()).build();
  }
  private String durationKey(MediaItem item,boolean translated){String[] p=item.mediaId.split("/");return "duration/"+(translated?translationAudioId:p[1])+"/"+p[2]+"/"+p[3];}
  private long durationHint(MediaItem item,boolean translated){long hint=saved.getLong(durationKey(item,translated),0);return hint>0?hint:Math.max(60000,saved.getString("item","").equals(item.mediaId)?saved.getLong("position",0)+30000:60000);}
  private void rememberDurations(){
    if(player==null||translationAudioId.isEmpty()||player.getCurrentMediaItem()==null)return;
    Timeline timeline=player.getCurrentTimeline();if(timeline.isEmpty())return;
    Timeline.Window window=timeline.getWindow(player.getCurrentMediaItemIndex(),new Timeline.Window());if(window.lastPeriodIndex-window.firstPeriodIndex!=1)return;
    for(int i=0;i<2;i++){long duration=timeline.getPeriod(window.firstPeriodIndex+i,new Timeline.Period()).durationUs;if(duration>0){String key=durationKey(player.getCurrentMediaItem(),i==1);long ms=duration/1000;if(saved.getLong(key,0)!=ms)saved.edit().putLong(key,ms).apply();}}
  }
  private JSONObject translationSource(String id){for(int i=0;i<translationAudio.length();i++){JSONObject item=translationAudio.optJSONObject(i);if(item.optString("id").equals(id))return item;}throw new IllegalArgumentException("Unknown translation audio");}
  private String translationUri(MediaItem item){
    if(translationAudioId.isEmpty())return null;String[] p=item.mediaId.split("/");if(p.length!=4||!p[0].equals("v"))return null;
    int n=Integer.parseInt(p[2]),a=Integer.parseInt(p[3]);library.validate(n,a);
    return "https://tanzil.net/res/audio/"+translationSource(translationAudioId).optString("tanzilDirectory")+"/"+String.format(Locale.ROOT,"%03d%03d.mp3",n,a);
  }
  private boolean downloaded(String r,int n,int count) {
    java.io.File first=QuranAudioBridge.audioFile(this,r,n,1);
    if(!new java.io.File(first.getParentFile(),String.format(Locale.ROOT,"%03d.pin",n)).isFile())return false;
    for(int a=1;a<=count;a++){java.io.File f=QuranAudioBridge.audioFile(this,r,n,a);if(!f.isFile()||f.length()==0)return false;}
    if(!translationAudioId.isEmpty()&&!r.equals(translationAudioId))return downloaded(translationAudioId,n,count);
    return true;
  }
  private MediaItem surahItem(String r,JSONObject surah,boolean browse) {
    String id=(browse?"s/":"v/")+r+"/"+surah.optInt("n")+(browse?"":"/1");
    MediaItem result=item(id,number(surah.optInt("n"))+" · "+surah.optString("ar"),reciter(r).optString("name"),browse,!browse,null);
    return result.buildUpon().setMediaMetadata(result.mediaMetadata.buildUpon()
      .setArtworkUri(artwork(surah.optInt("n"))).setMediaType(browse?MediaMetadata.MEDIA_TYPE_FOLDER_MIXED:MediaMetadata.MEDIA_TYPE_ALBUM).build()).build();
  }
  private List<MediaItem> children(String parent) {
    ArrayList<MediaItem> items=new ArrayList<>();
    if(parent.equals("root")) {
      items.add(item("home",label("home"),"",true,false,null));
      items.add(item("surahs",label("surahs"),"",true,false,null));
      items.add(item("library",label("library"),"",true,false,null));
    } else if(parent.equals("home")) {
      items.add(continuation());
      JSONObject reading=library.point();if(reading.has("s")){int n=reading.optInt("s"),a=reading.optInt("a");items.add(item("reading",label("readingPoint"),surahs.optJSONObject(n-1).optString("ar")+" · "+label("verse")+" "+number(a),false,true,null));}
      items.add(item("favorites",label("favorites"),"",true,false,null));
      items.add(item("playlists",label("playlists"),"",true,false,null));
      items.add(item("recent",label("recent"),"",true,false,null));
      String[] p=selectedVerse().split("/");
      items.add(item("s/"+p[1]+"/"+p[2],label("chooseVerse"),surahs.optJSONObject(Integer.parseInt(p[2])-1).optString("ar"),true,false,null));
      items.add(item("reciters",label("chooseReciter"),reciter(currentReciter).optString("name"),true,false,null));
    } else if(parent.equals("favorites")){
      JSONArray values=library.array("favorites");for(int i=0;i<values.length();i++){JSONObject v=values.optJSONObject(i);items.add(verse(currentReciter,v.optInt("s"),v.optInt("a")));}
    } else if(parent.equals("playlists")){
      JSONArray values=library.array("playlists");for(int i=0;i<values.length();i++){JSONObject v=values.optJSONObject(i);items.add(item("list/"+v.optString("id"),v.optString("title"),"",false,true,null));}
    } else if(parent.equals("settings")){
      for(String key:Arrays.asList("speed","verse","surah","pause","range","timer","translation"))items.add(item("settings/"+key,label("setting_"+key),settingSummary(key),true,false,null));
    } else if(parent.startsWith("settings/")){
      String key=parent.substring(9);String[] values;
      switch(key){case "speed":values=new String[]{"0.75","1","1.25","1.5","2"};break;case "verse":case "surah":values=new String[]{"1","2","3","5","10","0"};break;case "pause":values=new String[]{"0","2","5","10"};break;case "range":values=new String[]{"off","5","10","end"};break;case "timer":values=new String[]{"off","15","30","60","end"};break;case "translation":values=new String[translationAudio.length()+1];values[0]="off";for(int i=0;i<translationAudio.length();i++)values[i+1]=translationAudio.optJSONObject(i).optString("id");break;default:throw new IllegalArgumentException();}
      for(String value:values){MediaItem row=item("option/"+key+"/"+value,(settingSelected(key,value)?"✓ ":"")+settingChoice(key,value),"",false,false,null);items.add(row.buildUpon().setMediaMetadata(row.mediaMetadata.buildUpon().setSupportedCommands(Arrays.asList("applySetting")).build()).build());}
    } else if(parent.equals("library")) {
      items.add(item("settings",label("playbackSettings"),"",true,false,null));
      items.add(item("favorites",label("favorites"),"",true,false,null));
      items.add(item("playlists",label("playlists"),"",true,false,null));
      items.add(item("reciters",label("chooseReciter"),reciter(currentReciter).optString("name"),true,false,null));
      items.add(item("verse-surahs",label("chooseVerse"),"",true,false,null));
      items.add(item("downloads",label("downloads"),"",true,false,null));
    } else if(parent.equals("recent")) {
      try{JSONArray history=new JSONArray(saved.getString("recent","[]"));
        for(int i=0;i<history.length();i++){String[] p=history.getString(i).split("/");items.add(verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3])));}
      }catch(JSONException e){throw new IllegalArgumentException(e);}
    } else if(parent.equals("reciters")) {
      for(int i=0;i<reciters.length();i++){JSONObject r=reciters.optJSONObject(i);
        items.add(item("pick/"+r.optString("id"),(r.optString("id").equals(currentReciter)?"✓ ":"")+r.optString("name"),"",false,true,null));
      }
    } else if(parent.equals("surahs")||parent.equals("verse-surahs")||parent.equals("downloads")) {
      for(int i=0;i<surahs.length();i++){JSONObject surah=surahs.optJSONObject(i);
        if(parent.equals("downloads")&&!downloaded(currentReciter,surah.optInt("n"),surah.optInt("vc")))continue;
        items.add(surahItem(currentReciter,surah,parent.equals("verse-surahs")));
      }
    } else if(parent.startsWith("r/")) {
      // Preserve saved media IDs from older car hosts, but make surahs immediately playable.
      String r=parent.substring(2);reciter(r);
      for(int i=0;i<surahs.length();i++)items.add(surahItem(r,surahs.optJSONObject(i),false));
    } else if(parent.startsWith("s/")) {
      String[] p=parent.split("/");if(p.length!=3)throw new IllegalArgumentException();
      items.addAll(queue(p[1],Integer.parseInt(p[2])));
    } else throw new IllegalArgumentException("Unknown parent");
    return items;
  }
  private String settingSummary(String key){switch(key){case "translation":return translationAudioId.isEmpty()?label("off"):translationSource(translationAudioId).optString("name");case "speed":return java.text.NumberFormat.getNumberInstance(uiLocale).format(player.getPlaybackParameters().speed)+"×";case "verse":return verseRepeats==1?label("off"):verseRepeats==0?label("forever"):number(verseRepeats)+" · "+label("times");case "surah":return surahRepeats==1?label("off"):surahRepeats==0?label("forever"):number(surahRepeats)+" · "+label("times");case "pause":return pauseSeconds==0?label("off"):number(pauseSeconds)+" · "+label("seconds");case "range":return rangeSurah==0?label("off"):number(rangeFrom)+"–"+number(rangeTo);case "timer":return sleepAtEnd?label(rangeSurah>0?"endRange":"endSurah"):sleepDeadline==0?label("off"):number((int)Math.max(1,(sleepDeadline-System.currentTimeMillis()+59999)/60000))+" · "+label("minutes");default:throw new IllegalArgumentException();}}
  private boolean settingSelected(String key,String value){switch(key){case "translation":return value.equals(translationAudioId)||value.equals("off")&&translationAudioId.isEmpty();case "speed":return Float.parseFloat(value)==player.getPlaybackParameters().speed;case "verse":return Integer.parseInt(value)==verseRepeats;case "surah":return Integer.parseInt(value)==surahRepeats;case "pause":return Integer.parseInt(value)==pauseSeconds;case "range":return value.equals("off")&&rangeSurah==0;case "timer":return value.equals("off")&&sleepDeadline==0&&!sleepAtEnd||value.equals("end")&&sleepAtEnd;default:return false;}}
  private String settingChoice(String key,String value){
    if(value.equals("off")||value.equals("0")&&key.equals("pause"))return label("off");
    if(key.equals("translation"))return translationSource(value).optString("name");
    if(value.equals("end"))return label(key.equals("timer")&&rangeSurah>0?"endRange":"endSurah");
    if(key.equals("speed"))return value.equals("1")?label("normalSpeed"):java.text.NumberFormat.getNumberInstance(uiLocale).format(Float.parseFloat(value))+"×";
    if((key.equals("verse")||key.equals("surah"))&&value.equals("1"))return label("noRepeat");
    if(value.equals("0"))return label("forever");
    return number(Integer.parseInt(value))+" · "+label(key.equals("pause")?"seconds":key.equals("timer")?"minutes":key.equals("range")?"verses":"times");
  }
  private MediaItem resolveBrowseItem(String id) {
    if(id.equals("root"))return item("root",label("app"),"",true,false,null);
    if(id.equals("resume"))return continuation();
    if(id.equals("reading"))return children("home").stream().filter(x->x.mediaId.equals(id)).findFirst().orElseThrow(()->new IllegalArgumentException());
    if(id.startsWith("list/")){JSONObject list=library.list(id.substring(5));return item(id,list.optString("title"),"",false,true,null);}
    if(id.startsWith("settings/"))return item(id,label("setting_"+id.substring(9)),settingSummary(id.substring(9)),true,false,null);
    if(id.startsWith("option/")){String[] p=id.split("/");if(p.length!=3)throw new IllegalArgumentException();return children("settings/"+p[1]).stream().filter(x->x.mediaId.equals(id)).findFirst().orElseThrow(()->new IllegalArgumentException());}
    if(id.startsWith("v/")){String[] p=id.split("/");if(p.length!=4)throw new IllegalArgumentException();return verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3]));}
    if(id.startsWith("pick/")){String r=id.substring(5);return item(id,reciter(r).optString("name"),"",false,true,null);}
    if(id.startsWith("r/")){String r=id.substring(2);return item(id,reciter(r).optString("name"),"",true,false,null);}
    if(id.startsWith("s/")){String[] p=id.split("/");if(p.length!=3)throw new IllegalArgumentException();int n=Integer.parseInt(p[2]);if(n<1||n>114)throw new IllegalArgumentException();return surahItem(p[1],surahs.optJSONObject(n-1),true);}
    for(String parent:Arrays.asList("root","home","library"))for(MediaItem result:children(parent))if(result.mediaId.equals(id))return result;
    throw new IllegalArgumentException("Unknown media ID");
  }
  private final class Library implements MediaLibrarySession.Callback {
    @Override public int onPlayerCommandRequest(MediaSession session,ControllerInfo controller,int command){
      if(Arrays.asList(Player.COMMAND_PLAY_PAUSE,Player.COMMAND_STOP,Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,Player.COMMAND_SEEK_TO_DEFAULT_POSITION,Player.COMMAND_SEEK_TO_MEDIA_ITEM,Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,Player.COMMAND_SEEK_BACK,Player.COMMAND_SEEK_FORWARD).contains(command))cancelGap();
      return SessionResult.RESULT_SUCCESS;
    }
    @Override public MediaSession.ConnectionResult onConnect(MediaSession s, ControllerInfo c) {
      SessionCommands commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
        .add(new SessionCommand("repeatVerse",Bundle.EMPTY)).add(new SessionCommand("repeatSurah",Bundle.EMPTY)).add(new SessionCommand("normalPlayback",Bundle.EMPTY)).add(new SessionCommand("favoriteCurrent",Bundle.EMPTY)).add(new SessionCommand("applySetting",Bundle.EMPTY)).add(new SessionCommand("favoriteItem",Bundle.EMPTY)).build();
      if(c.getPackageName().equals(getPackageName()))commands=commands.buildUpon().add(new SessionCommand("configureRepeat",Bundle.EMPTY)).add(new SessionCommand("refreshDownloads",Bundle.EMPTY)).add(new SessionCommand("configureLanguage",Bundle.EMPTY)).add(new SessionCommand("refreshCarLibrary",Bundle.EMPTY)).add(new SessionCommand("configureCarOptions",Bundle.EMPTY)).build();
      return new MediaSession.ConnectionResult.AcceptedResultBuilder(s).setAvailableSessionCommands(commands).build();
    }
    @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession s, ControllerInfo c, SessionCommand command, Bundle args) {
      switch(command.customAction) {
        case "normalPlayback":case "speed":normalPlayback();break;
        case "favoriteCurrent":case "favoriteItem":
          if(!mayEdit(c))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          try{String id=command.customAction.equals("favoriteCurrent")?selectedVerse():args.getString(MediaConstants.EXTRA_KEY_MEDIA_ID,"");String[] p=id.split("/");if(p.length!=4||!p[0].equals("v"))throw new IllegalArgumentException();int n=Integer.parseInt(p[2]),a=Integer.parseInt(p[3]);boolean add=!library.favorite(n,a);library.mutate(new JSONObject().put("action","favorite").put("s",n).put("a",a).put("add",add));refreshCarLibrary();return Futures.immediateFuture(browseResult(null,label(add?"favoriteSaved":"favoriteRemoved")));}catch(Exception e){return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE));}
        case "applySetting":case "configureCarOptions":
          if(!mayEdit(c))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          try{String key,value;if(command.customAction.equals("applySetting")){String[] p=args.getString(MediaConstants.EXTRA_KEY_MEDIA_ID,"").split("/");if(p.length!=3||!p[0].equals("option"))throw new IllegalArgumentException();key=p[1];value=p[2];}else{key=args.getString("key","");value=args.getString("value","");}applySetting(key,value);return Futures.immediateFuture(browseResult(key.equals("normal")?"settings":"settings/"+key,label("saved")));}catch(Exception e){return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE));}
        case "refreshCarLibrary":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          refreshCarLibrary();return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
        case "repeatVerse": verseRepeats=verseRepeats==1?3:1;verseRound=1;applyRepeat();break;
        case "repeatSurah": surahRepeats=surahRepeats==1?3:1;surahRound=1;break;
        case "configureLanguage":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          return Futures.immediateFuture(new SessionResult(updateLanguage(args.getString("language",""))?SessionResult.RESULT_SUCCESS:SessionError.ERROR_BAD_VALUE));
        case "refreshDownloads":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          session.notifyChildrenChanged("downloads",children("downloads").size(),null);
          return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
        case "configureRepeat":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          int v=args.getInt("verse",1),whole=args.getInt("surah",1);
          if(!Arrays.asList(0,1,2,3,5,10).contains(v)||!Arrays.asList(0,1,2,3,5,10).contains(whole))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE));
          verseRepeats=v;surahRepeats=whole;verseRound=1;surahRound=1;applyRepeat();break;

        default: return Futures.immediateFuture(new SessionResult(SessionError.ERROR_NOT_SUPPORTED));
      }
      controls(); remember();
      return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
    }
    @Override public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(MediaLibrarySession s, ControllerInfo c, LibraryParams p) {
      return Futures.immediateFuture(LibraryResult.ofItem(item("root",label("app"),"",true,false,null),p));
    }
    @Override public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(MediaLibrarySession s, ControllerInfo c, String id, int page, int size, LibraryParams p) {
      try {
        if(Arrays.asList("home","favorites","playlists","recent").contains(id)&&!mayEdit(c))return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_PERMISSION_DENIED));
        List<MediaItem> list=children(id);languageParents.add(id);
        if(page<0 || size<1) throw new IllegalArgumentException();
        long offset=(long)page*size; int start=(int)Math.min(offset,list.size()), end=(int)Math.min(offset+size,list.size());
        return Futures.immediateFuture(LibraryResult.ofItemList(list.subList(start,end),p));
      } catch (RuntimeException e) { return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE)); }
    }
    @Override public ListenableFuture<LibraryResult<Void>> onSearch(MediaLibrarySession s, ControllerInfo c, String query, LibraryParams p) {
      s.notifySearchResultChanged(c,query,search(query).size(),p);
      return Futures.immediateFuture(LibraryResult.ofVoid());
    }
    @Override public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetSearchResult(MediaLibrarySession s, ControllerInfo c, String query, int page, int size, LibraryParams p) {
      if(page<0 || size<1)return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
      List<MediaItem> list=search(query);long offset=(long)page*size;
      return Futures.immediateFuture(LibraryResult.ofItemList(list.subList((int)Math.min(offset,list.size()),(int)Math.min(offset+size,list.size())),p));
    }
    @Override public ListenableFuture<LibraryResult<MediaItem>> onGetItem(MediaLibrarySession s, ControllerInfo c, String id) {
      try {
        if((id.equals("reading")||id.startsWith("list/"))&&!mayEdit(c))return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_PERMISSION_DENIED));
        MediaItem result=resolveBrowseItem(id);
        return Futures.immediateFuture(LibraryResult.ofItem(result,null));
      } catch (RuntimeException e) { return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE)); }
    }
    @Override public ListenableFuture<List<MediaItem>> onAddMediaItems(MediaSession s, ControllerInfo c, List<MediaItem> requested) {
      try {
        ArrayList<MediaItem> resolved=new ArrayList<>();
        for(MediaItem item:requested) {
          String[] p=item.mediaId.split("/");
          if(p.length!=4 || !p[0].equals("v"))throw new IllegalArgumentException();
          resolved.add(verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3])));
        }
        return Futures.immediateFuture(resolved);
      } catch(RuntimeException e) { return Futures.immediateFailedFuture(new IllegalArgumentException("Invalid Quran queue",e)); }
    }
    @Override public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onSetMediaItems(MediaSession s, ControllerInfo c, List<MediaItem> requested, int index, long position) {
      try {
        if(requested.isEmpty()) throw new IllegalArgumentException();
        String id=requested.get(index>=0&&index<requested.size()?index:0).mediaId;
        if(id.isEmpty() && requested.get(0).requestMetadata.searchQuery!=null) {
          List<MediaItem> matches=search(requested.get(0).requestMetadata.searchQuery);
          if(matches.isEmpty())throw new IllegalArgumentException("No matching surah");
          id=matches.get(0).mediaId;
        }
        if((id.equals("reading")||id.startsWith("list/"))&&!mayEdit(c))throw new IllegalArgumentException("Private library");
        String nextList=activeList;int nextListIndex=listIndex;
        boolean resume=id.equals("resume");
        if(id.equals("reading")){JSONObject point=library.point();id="v/"+currentReciter+"/"+point.getInt("s")+"/"+point.getInt("a");}
        boolean listSelection=id.startsWith("list/");
        if(listSelection){nextList=id.substring(5);nextListIndex=0;JSONArray items=library.list(nextList).getJSONArray("surahs");id="v/"+currentReciter+"/"+items.getInt(0)+"/1";}
        else if(!resume&&!id.startsWith("pick/")){nextList="";nextListIndex=0;}

        if(resume) id=selectedVerse();
        if(id.startsWith("pick/")){
          String r=id.substring(5);reciter(r);String[] selected=selectedVerse().split("/");
          id="v/"+r+"/"+selected[2]+"/"+selected[3];position=0;
        }
        String[] p=id.split("/"); if(p.length!=4 || !p[0].equals("v")) throw new IllegalArgumentException();
        int surah=Integer.parseInt(p[2]), ayah=Integer.parseInt(p[3]); verse(p[1],surah,ayah);
        activeList=nextList;listIndex=nextListIndex;if(listSelection)rangeSurah=rangeFrom=rangeTo=0;
        currentReciter=p[1];
        verseRound=1;surahRound=1;applyRepeat();
        player.setPlaybackSpeed(saved.getFloat("speed",1f));
        if(rangeSurah!=surah||ayah<rangeFrom||ayah>rangeTo)rangeSurah=rangeFrom=rangeTo=0;persistOptions();
        return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(selectionQueue(p[1],surah),ayah-(rangeSurah>0?rangeFrom:1),resume?(player.getCurrentMediaItem()!=null?player.getCurrentPosition():saved.getLong("position",0)):Math.max(0,position==C.TIME_UNSET?0:position)));
      } catch(Exception e) { return Futures.immediateFailedFuture(new IllegalArgumentException("Invalid Quran media selection",e)); }
    }
  }
}
