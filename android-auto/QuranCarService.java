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
  private JSONArray reciters, surahs;
  private JSONObject labels;
  private SharedPreferences saved;
  private String currentReciter;
  private int verseRepeats=1,surahRepeats=1,verseRound=1,surahRound=1;


  @Override public void onCreate() {
    super.onCreate();
    try {
      JSONObject catalog = new JSONObject(readCatalogue());
      reciters = catalog.getJSONArray("reciters"); surahs = catalog.getJSONArray("surahs");
      JSONObject translations = catalog.getJSONObject("labels");
      String language = getResources().getConfiguration().getLocales().get(0).getLanguage();
      labels = translations.optJSONObject(language);
      if (labels == null) labels = translations.getJSONObject("fa");
    } catch (Exception e) { throw new IllegalStateException("Invalid bundled Quran media catalogue", e); }
    saved = getSharedPreferences("quran-auto", MODE_PRIVATE);
    currentReciter = saved.getString("reciter", reciters.optJSONObject(0).optString("id"));
    verseRepeats=saved.getInt("verseRepeats",1);surahRepeats=saved.getInt("surahRepeats",1);
    ResolvingDataSource.Factory audioSource=new ResolvingDataSource.Factory(new DefaultDataSource.Factory(this),spec->{
      String url=spec.uri.toString();
      for(int i=0;i<reciters.length();i++){
        JSONObject r=reciters.optJSONObject(i);String directory=r.optString("tanzilDirectory");
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
    player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(audioSource,new androidx.media3.extractor.DefaultExtractorsFactory().setMp3ExtractorFlags(androidx.media3.extractor.mp3.Mp3Extractor.FLAG_DISABLE_ID3_METADATA))).build();
    player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true);
    player.setHandleAudioBecomingNoisy(true);
    player.setWakeMode(C.WAKE_MODE_LOCAL);
    player.addListener(new Player.Listener() {
      @Override public void onMediaItemTransition(MediaItem item, int reason) {
        if(reason==Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)verseRound++;else verseRound=1;
        applyRepeat();remember();refreshLibrary();
      }
      @Override public void onPlaybackStateChanged(int state) {
        if(state!=Player.STATE_ENDED || !player.getPlayWhenReady())return;
        if(surahRepeats==0 || surahRound<surahRepeats){surahRound++;player.seekToDefaultPosition(0);player.play();return;}
        MediaItem item=player.getCurrentMediaItem();if(item==null)return;
        String[] p=item.mediaId.split("/");int next=Integer.parseInt(p[2])+1;
        if(next<=114){surahRound=1;player.setMediaItems(queue(currentReciter,next));player.prepare();player.play();}
      }
      @Override public void onIsPlayingChanged(boolean playing) { remember(); }
      @Override public void onPlaybackParametersChanged(PlaybackParameters parameters) { remember(); }
    });
    MediaLibrarySession.Builder builder = new MediaLibrarySession.Builder(this, player, new Library());
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launch != null) builder.setSessionActivity(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    session = builder.build();
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
    remember();
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
  private void controls() {
    session.setCustomLayout(Arrays.asList(
      new CommandButton.Builder().setDisplayName((verseRepeats==0?"✓ ":"")+label("repeatVerse")).setIconResId(android.R.drawable.ic_menu_revert).setSessionCommand(new SessionCommand("repeatVerse",Bundle.EMPTY)).build(),
      new CommandButton.Builder().setDisplayName((surahRepeats==0?"✓ ":"")+label("repeatSurah")).setIconResId(android.R.drawable.ic_menu_rotate).setSessionCommand(new SessionCommand("repeatSurah",Bundle.EMPTY)).build(),
      new CommandButton.Builder().setDisplayName(label("speed")+" · "+java.text.NumberFormat.getNumberInstance(getResources().getConfiguration().getLocales().get(0)).format(player.getPlaybackParameters().speed)).setIconResId(android.R.drawable.ic_media_ff).setSessionCommand(new SessionCommand("speed",Bundle.EMPTY)).build()
    ));
  }
  private void refreshLibrary() {
    if(session==null)return;
    for(String parent:Arrays.asList("home","surahs","reciters","recent","verse-surahs")) {
      try{session.notifyChildrenChanged(parent,children(parent).size(),null);}catch(RuntimeException ignored){}
    }
  }
  private String label(String key) { return labels.optString(key); }
  private String number(int value) { return java.text.NumberFormat.getIntegerInstance(getResources().getConfiguration().getLocales().get(0)).format(value); }
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
    return result.buildUpon().setMediaMetadata(result.mediaMetadata.buildUpon().setArtworkUri(artwork(surah)).setSubtitle(s.optJSONArray("texts").optString(ayah-1)).setDescription(s.optJSONArray("texts").optString(ayah-1)).build()).build();
  }
  private List<MediaItem> queue(String r, int s) {
    ArrayList<MediaItem> items = new ArrayList<>();
    JSONObject surah = surahs.optJSONObject(s-1);
    if (surah == null) throw new IllegalArgumentException("Invalid surah");
    for (int a=1;a<=surah.optInt("vc");a++) items.add(verse(r,s,a));
    return items;
  }
  private void remember() {
    if (saved == null || player == null) return;
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
    saved.edit().putString("recent",history.toString()).putString("item",item.mediaId).putLong("position",player.getCurrentPosition())
      .putInt("verseRepeats",verseRepeats).putInt("surahRepeats",surahRepeats).putString("reciter",currentReciter).putFloat("speed",player.getPlaybackParameters().speed).apply();
  }
  private String normalize(String text) {
    StringBuilder digits=new StringBuilder();
    for(int i=0;i<text.length();i++){char c=text.charAt(i);int digit=Character.digit(c,10);digits.append(digit>=0?(char)('0'+digit):c);}
    return java.text.Normalizer.normalize(digits.toString(),java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","")
      .replace('ٱ','ا').replace('ى','ي').replace('ی','ي').replace('ک','ك').replace('ـ',' ').trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);
  }
  private List<MediaItem> search(String query) {
    ArrayList<MediaItem> result=new ArrayList<>();
    if(query==null || query.trim().isEmpty()) {
      String id=saved.getString("item",""); String[] p=id.split("/");
      if(p.length==4) {try{result.add(verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3])));return result;}catch(RuntimeException ignored){}}
      result.add(verse(currentReciter,1,1)); return result;
    }
    String q=" "+normalize(query)+" ";
    java.util.regex.Matcher address=java.util.regex.Pattern.compile("(?:^|\\s)([0-9]{1,3})\\s*[:/]\\s*([0-9]{1,3})(?:\\s|$)").matcher(q);
    if(address.find()){
      try{result.add(verse(currentReciter,Integer.parseInt(address.group(1)),Integer.parseInt(address.group(2))));}catch(IllegalArgumentException ignored){}
      return result;
    }
    java.util.regex.Matcher requestedAyah=java.util.regex.Pattern.compile("(?:اي[ةه]|ayah|verse)\\s*([0-9]{1,3})").matcher(q);
    int ayah=requestedAyah.find()?Integer.parseInt(requestedAyah.group(1)):1;
    for(int i=0;i<surahs.length();i++) {
      JSONObject s=surahs.optJSONObject(i);
      if(q.contains(" "+normalize(s.optString("ar"))+" ") || q.contains(" "+normalize(s.optString("fa"))+" ")) {if(ayah>=1&&ayah<=s.optInt("vc"))result.add(verse(currentReciter,s.optInt("n"),ayah));}
    }
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
  private boolean downloaded(String r,int n,int count) {
    java.io.File first=QuranAudioBridge.audioFile(this,r,n,1);
    if(!new java.io.File(first.getParentFile(),String.format(Locale.ROOT,"%03d.pin",n)).isFile())return false;
    for(int a=1;a<=count;a++){java.io.File f=QuranAudioBridge.audioFile(this,r,n,a);if(!f.isFile()||f.length()==0)return false;}
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
      items.add(item("recent",label("recent"),"",true,false,null));
      String[] p=selectedVerse().split("/");
      items.add(item("s/"+p[1]+"/"+p[2],label("chooseVerse"),surahs.optJSONObject(Integer.parseInt(p[2])-1).optString("ar"),true,false,null));
      items.add(item("reciters",label("chooseReciter"),reciter(currentReciter).optString("name"),true,false,null));
    } else if(parent.equals("library")) {
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
  private MediaItem resolveBrowseItem(String id) {
    if(id.equals("root"))return item("root",label("app"),"",true,false,null);
    if(id.equals("resume"))return continuation();
    if(id.startsWith("v/")){String[] p=id.split("/");if(p.length!=4)throw new IllegalArgumentException();return verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3]));}
    if(id.startsWith("pick/")){String r=id.substring(5);return item(id,reciter(r).optString("name"),"",false,true,null);}
    if(id.startsWith("r/")){String r=id.substring(2);return item(id,reciter(r).optString("name"),"",true,false,null);}
    if(id.startsWith("s/")){String[] p=id.split("/");if(p.length!=3)throw new IllegalArgumentException();int n=Integer.parseInt(p[2]);if(n<1||n>114)throw new IllegalArgumentException();return surahItem(p[1],surahs.optJSONObject(n-1),true);}
    for(String parent:Arrays.asList("root","home","library"))for(MediaItem result:children(parent))if(result.mediaId.equals(id))return result;
    throw new IllegalArgumentException("Unknown media ID");
  }
  private final class Library implements MediaLibrarySession.Callback {
    @Override public MediaSession.ConnectionResult onConnect(MediaSession s, ControllerInfo c) {
      SessionCommands commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
        .add(new SessionCommand("repeatVerse",Bundle.EMPTY)).add(new SessionCommand("repeatSurah",Bundle.EMPTY)).add(new SessionCommand("speed",Bundle.EMPTY)).build();
      if(c.getPackageName().equals(getPackageName()))commands=commands.buildUpon().add(new SessionCommand("configureRepeat",Bundle.EMPTY)).add(new SessionCommand("refreshDownloads",Bundle.EMPTY)).build();
      return new MediaSession.ConnectionResult.AcceptedResultBuilder(s).setAvailableSessionCommands(commands).build();
    }
    @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession s, ControllerInfo c, SessionCommand command, Bundle args) {
      switch(command.customAction) {
        case "repeatVerse": verseRepeats=verseRepeats==0?1:0;verseRound=1;applyRepeat();break;
        case "repeatSurah": surahRepeats=surahRepeats==0?1:0;surahRound=1;break;
        case "refreshDownloads":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          session.notifyChildrenChanged("downloads",children("downloads").size(),null);
          return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
        case "configureRepeat":
          if(!c.getPackageName().equals(getPackageName()))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_PERMISSION_DENIED));
          int v=args.getInt("verse",1),whole=args.getInt("surah",1);
          if(!Arrays.asList(0,1,2,3,5,10).contains(v)||!Arrays.asList(0,1,2,3,5,10).contains(whole))return Futures.immediateFuture(new SessionResult(SessionError.ERROR_BAD_VALUE));
          verseRepeats=v;surahRepeats=whole;verseRound=1;surahRound=1;applyRepeat();break;
        case "speed": float speed=player.getPlaybackParameters().speed; player.setPlaybackSpeed(speed<1?1f:speed<1.25f?1.25f:speed<1.5f?1.5f:0.75f); break;
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
        List<MediaItem> list=children(id);
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
        boolean resume=id.equals("resume");
        if(resume) id=selectedVerse();
        if(id.startsWith("pick/")){
          String r=id.substring(5);reciter(r);String[] selected=selectedVerse().split("/");
          id="v/"+r+"/"+selected[2]+"/"+selected[3];position=0;
        }
        String[] p=id.split("/"); if(p.length!=4 || !p[0].equals("v")) throw new IllegalArgumentException();
        int surah=Integer.parseInt(p[2]), ayah=Integer.parseInt(p[3]); verse(p[1],surah,ayah);
        currentReciter=p[1];
        verseRound=1;surahRound=1;applyRepeat();
        player.setPlaybackSpeed(saved.getFloat("speed",1f));
        return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(queue(p[1],surah),ayah-1,resume?(player.getCurrentMediaItem()!=null?player.getCurrentPosition():saved.getLong("position",0)):Math.max(0,position==C.TIME_UNSET?0:position)));
      } catch(RuntimeException e) { return Futures.immediateFailedFuture(new IllegalArgumentException("Invalid Quran media selection",e)); }
    }
  }
}
