package app.quranmubarak.reader.auto;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.media3.common.*;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
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
    player = new ExoPlayer.Builder(this).build();
    player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true);
    player.setHandleAudioBecomingNoisy(true);
    player.setWakeMode(C.WAKE_MODE_LOCAL);
    player.addListener(new Player.Listener() {
      @Override public void onMediaItemTransition(MediaItem item, int reason) { remember(); }
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
  private void controls() {
    session.setCustomLayout(Arrays.asList(
      new CommandButton.Builder().setDisplayName((player.getRepeatMode()==Player.REPEAT_MODE_ONE?"✓ ":"")+label("repeatVerse")).setIconResId(android.R.drawable.ic_menu_revert).setSessionCommand(new SessionCommand("repeatVerse",Bundle.EMPTY)).build(),
      new CommandButton.Builder().setDisplayName((player.getRepeatMode()==Player.REPEAT_MODE_ALL?"✓ ":"")+label("repeatSurah")).setIconResId(android.R.drawable.ic_menu_rotate).setSessionCommand(new SessionCommand("repeatSurah",Bundle.EMPTY)).build(),
      new CommandButton.Builder().setDisplayName(label("speed")+" · "+java.text.NumberFormat.getNumberInstance(getResources().getConfiguration().getLocales().get(0)).format(player.getPlaybackParameters().speed)).setIconResId(android.R.drawable.ic_media_ff).setSessionCommand(new SessionCommand("speed",Bundle.EMPTY)).build()
    ));
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
  private MediaItem verse(String reciterId, int surah, int ayah) {
    JSONObject r = reciter(reciterId), s = surahs.optJSONObject(surah-1);
    if (s == null || ayah < 1 || ayah > s.optInt("vc")) throw new IllegalArgumentException("Invalid verse");
    String file = String.format(Locale.ROOT, "%03d%03d.mp3", surah, ayah);
    String directory = r.optString("tanzilDirectory");
    String uri = directory.isEmpty() ? "https://verses.quran.com/Minshawi/Murattal/mp3/"+file : "https://tanzil.net/res/audio/"+directory+"/"+file;
    MediaItem result=item("v/"+reciterId+"/"+surah+"/"+ayah, s.optString("ar")+" · "+label("verse")+" "+number(ayah), r.optString("name"), false, true, uri);
    return result.buildUpon().setMediaMetadata(result.mediaMetadata.buildUpon().setSubtitle(s.optJSONArray("texts").optString(ayah-1)).build()).build();
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
    saved.edit().putString("item",item.mediaId).putLong("position",player.getCurrentPosition())
      .putInt("repeat",player.getRepeatMode()).putString("reciter",currentReciter).putFloat("speed",player.getPlaybackParameters().speed).apply();
  }
  private String normalize(String text) {
    return java.text.Normalizer.normalize(text,java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","")
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
    for(int i=0;i<surahs.length();i++) {
      JSONObject s=surahs.optJSONObject(i);
      if(q.contains(" "+normalize(s.optString("ar"))+" ") || q.contains(" "+normalize(s.optString("fa"))+" ")) result.add(verse(currentReciter,s.optInt("n"),1));
    }
    return result;
  }
  private List<MediaItem> children(String parent) {
    ArrayList<MediaItem> items = new ArrayList<>();
    if (parent.equals("root")) {
      if (saved.contains("item")) items.add(item("resume",label("resume"),"",false,true,null));
      for (int i=0;i<reciters.length();i++) {
        JSONObject r=reciters.optJSONObject(i);
        items.add(item("r/"+r.optString("id"),r.optString("name"),"",true,false,null));
      }
    } else if (parent.startsWith("r/")) {
      String id=parent.substring(2); JSONObject r=reciter(id);
      for(int i=0;i<surahs.length();i++) { JSONObject s=surahs.optJSONObject(i);
        items.add(item("s/"+id+"/"+s.optInt("n"),s.optString("ar"),r.optString("name"),true,false,null));
      }
    } else if (parent.startsWith("s/")) {
      String[] p=parent.split("/"); if(p.length!=3) throw new IllegalArgumentException();
      items.addAll(queue(p[1],Integer.parseInt(p[2])));
    } else throw new IllegalArgumentException("Unknown parent");
    return items;
  }
  private final class Library implements MediaLibrarySession.Callback {
    @Override public MediaSession.ConnectionResult onConnect(MediaSession s, ControllerInfo c) {
      SessionCommands commands = MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
        .add(new SessionCommand("repeatVerse",Bundle.EMPTY)).add(new SessionCommand("repeatSurah",Bundle.EMPTY)).add(new SessionCommand("speed",Bundle.EMPTY)).build();
      return new MediaSession.ConnectionResult.AcceptedResultBuilder(s).setAvailableSessionCommands(commands).build();
    }
    @Override public ListenableFuture<SessionResult> onCustomCommand(MediaSession s, ControllerInfo c, SessionCommand command, Bundle args) {
      switch(command.customAction) {
        case "repeatVerse": player.setRepeatMode(player.getRepeatMode()==Player.REPEAT_MODE_ONE?Player.REPEAT_MODE_OFF:Player.REPEAT_MODE_ONE); break;
        case "repeatSurah": player.setRepeatMode(player.getRepeatMode()==Player.REPEAT_MODE_ALL?Player.REPEAT_MODE_OFF:Player.REPEAT_MODE_ALL); break;
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
        MediaItem result;
        if(id.equals("root")) result=item("root",label("app"),"",true,false,null);
        else if(id.equals("resume") && saved.contains("item")) result=item("resume",label("resume"),"",false,true,null);
        else if(id.startsWith("v/")) {String[] p=id.split("/");if(p.length!=4)throw new IllegalArgumentException();result=verse(p[1],Integer.parseInt(p[2]),Integer.parseInt(p[3]));}
        else { int slash=id.lastIndexOf('/');String parent=id.startsWith("r/")?"root":"r/"+id.substring(2,slash);result=children(parent).stream().filter(x->x.mediaId.equals(id)).findFirst().orElseThrow(()->new IllegalArgumentException("Unknown media ID")); }
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
        if(resume) id=saved.getString("item","");
        String[] p=id.split("/"); if(p.length!=4 || !p[0].equals("v")) throw new IllegalArgumentException();
        int surah=Integer.parseInt(p[2]), ayah=Integer.parseInt(p[3]); verse(p[1],surah,ayah);
        currentReciter=p[1];
        player.setRepeatMode(saved.getInt("repeat",Player.REPEAT_MODE_OFF));
        player.setPlaybackSpeed(saved.getFloat("speed",1f));
        return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(queue(p[1],surah),ayah-1,resume?saved.getLong("position",0):Math.max(0,position==C.TIME_UNSET?0:position)));
      } catch(RuntimeException e) { return Futures.immediateFailedFuture(new IllegalArgumentException("Invalid Quran media selection",e)); }
    }
  }
}
