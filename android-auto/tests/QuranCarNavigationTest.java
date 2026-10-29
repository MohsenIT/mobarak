package app.quranmubarak.reader.auto;

import static org.junit.Assert.*;
import android.content.Context;
import android.os.Looper;
import androidx.media3.common.*;
import androidx.media3.session.*;
import androidx.media3.session.MediaLibraryService.MediaLibrarySession;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import java.lang.reflect.*;
import java.util.*;

/** Runs against generated quran-auto.json and the real Media3 service in an Android JVM fixture. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class QuranCarNavigationTest {
  ServiceController<QuranCarService> controller;
  QuranCarService service;
  @Before public void setup(){
    controller=Robolectric.buildService(QuranCarService.class);service=controller.get();
    service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).edit().clear().commit();controller.create();
  }
  @After public void cleanup(){controller.destroy();}
  @SuppressWarnings("unchecked") List<MediaItem> children(String id)throws Exception{
    Method m=QuranCarService.class.getDeclaredMethod("children",String.class);m.setAccessible(true);return (List<MediaItem>)m.invoke(service,id);
  }
  MediaLibrarySession.Callback callback()throws Exception{
    Class<?> c=Class.forName("app.quranmubarak.reader.auto.QuranCarService$Library");Constructor<?> ctor=c.getDeclaredConstructor(QuranCarService.class);ctor.setAccessible(true);return (MediaLibrarySession.Callback)ctor.newInstance(service);
  }
  List<String> ids(List<MediaItem> items){List<String> result=new ArrayList<>();for(MediaItem item:items)result.add(item.mediaId);return result;}
  @Test public void rootHasThreeTaskTabsAndNoReciterTabs()throws Exception{
    assertEquals(Arrays.asList("home","surahs","library"),ids(children("root")));
    assertEquals(114,children("surahs").size());
    for(MediaItem item:children("surahs")){assertEquals(Boolean.TRUE,item.mediaMetadata.isPlayable);assertEquals(Boolean.FALSE,item.mediaMetadata.isBrowsable);}
  }
  @Test public void surahStartsWholeQueueDirectlyAndAyahsRemainOptional()throws Exception{
    MediaItem taha=children("surahs").get(19);
    MediaSession.MediaItemsWithStartPosition result=callback().onSetMediaItems(null,null,Arrays.asList(taha),0,0).get();
    assertEquals(135,result.mediaItems.size());assertEquals(0,result.startIndex);
    assertTrue(result.mediaItems.get(0).mediaId.endsWith("/20/1"));
    MediaItem optional=children("verse-surahs").get(19);
    assertEquals(Boolean.TRUE,optional.mediaMetadata.isBrowsable);assertEquals(135,children(optional.mediaId).size());
  }
  @Test public void reciterChangePreservesSelectedSurahAndAyah()throws Exception{
    String r=children("reciters").get(1).mediaId.substring(5);
    service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).edit().putString("item","v/minshawi-murattal/20/72").commit();
    MediaSession.MediaItemsWithStartPosition result=callback().onSetMediaItems(null,null,Arrays.asList(new MediaItem.Builder().setMediaId("pick/"+r).build()),0,0).get();
    assertEquals(71,result.startIndex);assertEquals("v/"+r+"/20/72",result.mediaItems.get(71).mediaId);assertEquals(0,result.startPositionMs);
  }
  @Test public void mansooriUsesEveryAyahWithoutChangingTheSelectedAyah()throws Exception{
    service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).edit().putString("item","v/minshawi-murattal/20/72").commit();
    MediaSession.MediaItemsWithStartPosition result=callback().onSetMediaItems(null,null,Arrays.asList(new MediaItem.Builder().setMediaId("pick/everyayah-mansoori").build()),0,0).get();
    assertEquals(71,result.startIndex);
    assertEquals("https://everyayah.com/data/Karim_Mansoori_40kbps/020072.mp3",result.mediaItems.get(71).localConfiguration.uri.toString());
  }
  @Test public void resumeRestoresSavedAyahAndPosition()throws Exception{
    String r=children("reciters").get(0).mediaId.substring(5);
    service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).edit().putString("item","v/"+r+"/20/72").putLong("position",1234).commit();
    MediaSession.MediaItemsWithStartPosition result=callback().onSetMediaItems(null,null,Arrays.asList(children("home").get(0)),0,0).get();
    assertEquals(71,result.startIndex);assertEquals(1234,result.startPositionMs);
  }
  @Test public void recentHistoryKeepsLatestAyahPerSurahAndAtMostEightEntries()throws Exception{
    Field field=QuranCarService.class.getDeclaredField("player");field.setAccessible(true);Player player=(Player)field.get(service);
    List<MediaItem> surahs=children("surahs");
    for(int n=1;n<=10;n++)player.setMediaItem(callback().onSetMediaItems(null,null,Arrays.asList(surahs.get(n-1)),0,0).get().mediaItems.get(0));
    assertEquals(8,children("recent").size());assertTrue(children("recent").get(0).mediaId.endsWith("/10/1"));
    String r=children("reciters").get(0).mediaId.substring(5);
    player.setMediaItem(children("s/"+r+"/10").get(1));
    assertEquals(8,children("recent").size());assertTrue(children("recent").get(0).mediaId.endsWith("/10/2"));
  }
  @Test public void invalidSelectionsDoNotResolveToExternalAudio()throws Exception{
    for(String id:Arrays.asList("https://example.com/audio.mp3","v/unknown/20/1","v/parhizgar/115/1","pick/unknown")){
      try{callback().onSetMediaItems(null,null,Arrays.asList(new MediaItem.Builder().setMediaId(id).build()),0,0).get();fail("Accepted "+id);}catch(java.util.concurrent.ExecutionException expected){}
    }
  }
  @Test @SuppressWarnings("unchecked") public void searchUnderstandsNamedAyahAndLocalizedAddresses()throws Exception{
    Method search=QuranCarService.class.getDeclaredMethod("search",String.class);search.setAccessible(true);
    for(String query:Arrays.asList("طه آیه ۷۲","طه آية ٧٢","۲۰:۷۲","20:72")){
      List<MediaItem> result=(List<MediaItem>)search.invoke(service,query);assertEquals(query,1,result.size());assertTrue(result.get(0).mediaId.endsWith("/20/72"));
    }
    assertTrue(((List<MediaItem>)search.invoke(service,"20:999")).isEmpty());
  }
  @Test public void coversUseBundledSurahArtAndProviderRejectsOtherFiles()throws Exception{
    android.content.pm.ProviderInfo info=new android.content.pm.ProviderInfo();info.authority=service.getPackageName()+".artwork";info.exported=true;
    QuranArtworkProvider provider=new QuranArtworkProvider();provider.attachInfo(service,info);
    for(int n=1;n<=114;n++){
      MediaItem item=children("surahs").get(n-1);android.net.Uri uri=item.mediaMetadata.artworkUri;
      assertNotNull(uri);assertEquals("content",uri.getScheme());assertEquals(info.authority,uri.getAuthority());assertEquals("image/png",provider.getType(uri));
      try(java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(provider.openFile(uri,"r"))){assertEquals(137,in.read());assertEquals(80,in.read());}
    }
    for(String path:Arrays.asList("/surah/000.png","/surah/115.png","/surah/../secret","/surah/001.png?file=private","/anything")){
      try{provider.openFile(android.net.Uri.parse("content://"+info.authority+path),"r");fail(path);}catch(java.io.FileNotFoundException expected){}
    }
    try{provider.openFile(children("surahs").get(0).mediaMetadata.artworkUri,"rw");fail("Allowed writes");}catch(java.io.FileNotFoundException expected){}
  }
  @Test public void appLanguageControlsMenusDigitsAndPersistsWithoutResettingPlayback()throws Exception{
    assertEquals("خانه",children("root").get(0).mediaMetadata.title.toString());
    Method update=QuranCarService.class.getDeclaredMethod("updateLanguage",String.class);update.setAccessible(true);
    assertEquals(true,update.invoke(service,"en"));assertEquals("Home",children("root").get(0).mediaMetadata.title.toString());
    MediaSession.MediaItemsWithStartPosition selected=callback().onSetMediaItems(null,null,Arrays.asList(children("s/minshawi-murattal/20").get(71)),0,2345).get();
    Field field=QuranCarService.class.getDeclaredField("player");field.setAccessible(true);Player player=(Player)field.get(service);
    player.setMediaItems(selected.mediaItems,selected.startIndex,selected.startPositionMs);
    int index=player.getCurrentMediaItemIndex();long position=player.getCurrentPosition();String id=player.getCurrentMediaItem().mediaId;
    assertEquals(true,update.invoke(service,"fa"));
    assertEquals("خانه",children("root").get(0).mediaMetadata.title.toString());
    assertTrue(player.getCurrentMediaItem().mediaMetadata.title.toString().contains("۷۲"));
    assertEquals(id,player.getCurrentMediaItem().mediaId);assertEquals(index,player.getCurrentMediaItemIndex());assertEquals(position,player.getCurrentPosition());
    assertEquals(135,player.getMediaItemCount());assertEquals("fa",service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).getString("language",""));
    assertEquals(false,update.invoke(service,"unsupported"));assertEquals("خانه",children("root").get(0).mediaMetadata.title.toString());
    service.getSharedPreferences("quran-auto",Context.MODE_PRIVATE).edit().putString("language","ar").commit();
    controller.destroy();controller=Robolectric.buildService(QuranCarService.class);service=controller.get();controller.create();
    assertEquals("الرئيسية",children("root").get(0).mediaMetadata.title.toString());
  }
  Object field(String name)throws Exception{Field f=QuranCarService.class.getDeclaredField(name);f.setAccessible(true);return f.get(service);}
  void option(String key,String value)throws Exception{Method m=QuranCarService.class.getDeclaredMethod("applySetting",String.class,String.class);m.setAccessible(true);m.invoke(service,key,value);}
  MediaSession.ControllerInfo own(){return MediaSession.ControllerInfo.createTestOnlyControllerInfo("app.quranmubarak.reader",100,100,1,1,true,android.os.Bundle.EMPTY);}
  @Test public void listeningLibraryMergesFavoritesAndValidatesBeforeSaving()throws Exception{
    QuranCarLibrary data=(QuranCarLibrary)field("library");
    data.mutate(new org.json.JSONObject("{\"action\":\"favorite\",\"s\":20,\"a\":72}"));
    data.mutate(new org.json.JSONObject("{\"action\":\"favorite\",\"s\":20,\"a\":72}"));assertEquals(1,data.array("favorites").length());
    data.mutate(new org.json.JSONObject("{\"action\":\"favorite\",\"s\":20,\"a\":73}"));assertEquals(2,data.array("favorites").length());
    try{data.mutate(new org.json.JSONObject("{\"action\":\"favorite\",\"s\":1,\"a\":8}"));fail();}catch(IllegalArgumentException expected){}assertEquals(2,data.array("favorites").length());
    data.mutate(new org.json.JSONObject("{\"action\":\"favorite\",\"s\":20,\"a\":72,\"add\":false}"));assertFalse(data.favorite(20,72));assertTrue(data.favorite(20,73));
    assertEquals(1,children("favorites").size());
  }
  @Test public void phoneReadingAndNamedPlaylistsResolveWithoutMutatingPlaybackOnSave()throws Exception{
    QuranCarLibrary data=(QuranCarLibrary)field("library");Player player=(Player)field("player");
    data.mutate(new org.json.JSONObject("{\"action\":\"reading\",\"s\":20,\"a\":72}"));assertEquals(0,player.getMediaItemCount());
    MediaSession.MediaItemsWithStartPosition point=callback().onSetMediaItems(null,own(),Arrays.asList(new MediaItem.Builder().setMediaId("reading").build()),0,0).get();assertEquals(71,point.startIndex);assertTrue(point.mediaItems.get(71).mediaId.endsWith("/20/72"));
    data.mutate(new org.json.JSONObject("{\"action\":\"saveList\",\"listId\":\"commute\",\"title\":\"Morning\",\"surahs\":[20,114]}"));
    assertEquals("Morning",children("playlists").get(0).mediaMetadata.title.toString());
    MediaSession.MediaItemsWithStartPosition plan=callback().onSetMediaItems(null,own(),children("playlists"),0,0).get();assertEquals(135,plan.mediaItems.size());assertTrue(plan.mediaItems.get(0).mediaId.endsWith("/20/1"));
    assertEquals("commute",field("activeList"));
  }
  @Test public void repeatAndNormalPlaybackAreExplicitAndRestoreTheFullSurah()throws Exception{
    Player player=(Player)field("player");MediaSession.MediaItemsWithStartPosition start=callback().onSetMediaItems(null,own(),Arrays.asList(children("s/minshawi-murattal/20").get(71)),0,1234).get();player.setMediaItems(start.mediaItems,start.startIndex,start.startPositionMs);
    callback().onCustomCommand(null,own(),new SessionCommand("repeatVerse",android.os.Bundle.EMPTY),android.os.Bundle.EMPTY).get();assertEquals(3,field("verseRepeats"));
    callback().onCustomCommand(null,own(),new SessionCommand("repeatVerse",android.os.Bundle.EMPTY),android.os.Bundle.EMPTY).get();assertEquals(1,field("verseRepeats"));
    option("range","5");assertEquals(5,player.getMediaItemCount());assertEquals(72,field("rangeFrom"));assertEquals(76,field("rangeTo"));assertEquals(5,field("pauseSeconds"));
    option("speed","1.5");option("verse","0");option("normal","off");
    assertEquals(135,player.getMediaItemCount());assertEquals(71,player.getCurrentMediaItemIndex());assertEquals(1f,player.getPlaybackParameters().speed,0);assertEquals(1,field("verseRepeats"));assertEquals(1,field("surahRepeats"));assertEquals(0,field("pauseSeconds"));assertEquals(0,field("rangeSurah"));
    for(MediaItem item:children("settings/speed")){assertEquals(Boolean.FALSE,item.mediaMetadata.isPlayable);assertTrue(item.mediaMetadata.supportedCommands.contains("applySetting"));}
  }
  @Test public void explicitPauseCancelsPracticeResumeAndTimerStopsPlayback()throws Exception{
    Player player=(Player)field("player");option("pause","5");Method gap=QuranCarService.class.getDeclaredMethod("playAfterGap");gap.setAccessible(true);gap.invoke(service);
    ((MediaLibrarySession)field("session")).getPlayer().pause();org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(6));assertFalse(player.getPlayWhenReady());assertNull(field("pendingGap"));
    option("timer","15");player.play();org.robolectric.Shadows.shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMinutes(15));assertFalse(player.getPlayWhenReady());assertEquals(0L,field("sleepDeadline"));
    option("timer","end");player.play();Method finish=QuranCarService.class.getDeclaredMethod("finishQueue");finish.setAccessible(true);finish.invoke(service);assertFalse(player.getPlayWhenReady());assertEquals(false,field("sleepAtEnd"));
  }
  @Test public void normalPlaybackResumesAnAutomaticGapButPreservesExplicitPause()throws Exception{
    Player player=(Player)field("player");player.setMediaItem(children("s/minshawi-murattal/20").get(71));
    option("pause","5");Method gap=QuranCarService.class.getDeclaredMethod("playAfterGap");gap.setAccessible(true);gap.invoke(service);
    option("speed","1.25");assertNotNull(field("pendingGap"));option("normal","off");assertNull(field("pendingGap"));assertTrue(player.getPlayWhenReady());
    player.pause();option("normal","off");assertFalse(player.getPlayWhenReady());
  }
  @Test public void personalPlaylistAdvancesInOrderThenStops()throws Exception{
    QuranCarLibrary data=(QuranCarLibrary)field("library");Player player=(Player)field("player");
    data.mutate(new org.json.JSONObject("{\"action\":\"saveList\",\"listId\":\"route\",\"title\":\"Route\",\"surahs\":[20,114]}"));
    MediaSession.MediaItemsWithStartPosition start=callback().onSetMediaItems(null,own(),children("playlists"),0,0).get();player.setMediaItems(start.mediaItems,start.startIndex,0);
    Method finish=QuranCarService.class.getDeclaredMethod("finishQueue");finish.setAccessible(true);finish.invoke(service);assertTrue(player.getCurrentMediaItem().mediaId.endsWith("/114/1"));assertEquals(6,player.getMediaItemCount());
    finish.invoke(service);assertFalse(player.getPlayWhenReady());assertEquals("",field("activeList"));
  }
  @Test public void untrustedAppsCannotEditPrivateListeningData()throws Exception{
    MediaSession.ControllerInfo other=MediaSession.ControllerInfo.createTestOnlyControllerInfo("example.other",200,200,1,1,false,android.os.Bundle.EMPTY);
    assertEquals(SessionError.ERROR_PERMISSION_DENIED,callback().onCustomCommand(null,other,new SessionCommand("favoriteCurrent",android.os.Bundle.EMPTY),android.os.Bundle.EMPTY).get().resultCode);
    assertEquals(SessionError.ERROR_PERMISSION_DENIED,callback().onGetChildren(null,other,"favorites",0,10,null).get().resultCode);
  }
  @Test public void recordedTranslationUsesOneAyahIdentityAndQuranFirstOrdering()throws Exception{
    MediaItem verse=children("s/minshawi-murattal/20").get(71);List<String> requested=new ArrayList<>();
    androidx.media3.exoplayer.source.MediaSource.Factory base=new androidx.media3.exoplayer.source.MediaSource.Factory(){
      public androidx.media3.exoplayer.source.MediaSource.Factory setDrmSessionManagerProvider(androidx.media3.exoplayer.drm.DrmSessionManagerProvider p){return this;}
      public androidx.media3.exoplayer.source.MediaSource.Factory setLoadErrorHandlingPolicy(androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy p){return this;}
      public int[] getSupportedTypes(){return new int[]{C.CONTENT_TYPE_OTHER};}
      public androidx.media3.exoplayer.source.MediaSource createMediaSource(MediaItem item){requested.add(item.localConfiguration.uri.toString());return new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(new androidx.media3.datasource.DefaultDataSource.Factory(service)).createMediaSource(item);}
    };
    String translation="https://tanzil.net/res/audio/fa.fooladvand/020072.mp3";
    androidx.media3.exoplayer.source.MediaSource paired=new QuranVerseMediaSourceFactory(base,item->translation).createMediaSource(verse);
    assertEquals(Arrays.asList("https://verses.quran.com/Minshawi/Murattal/mp3/020072.mp3",translation),requested);assertEquals(verse.mediaId,paired.getMediaItem().mediaId);
    requested.clear();new QuranVerseMediaSourceFactory(base,item->null).createMediaSource(verse);assertEquals(1,requested.size());
    option("translation","translation-fa-fooladvand");assertEquals("translation-fa-fooladvand",field("translationAudioId"));
    try{option("translation","https://example.com/audio.mp3");fail();}catch(InvocationTargetException expected){}assertEquals("translation-fa-fooladvand",field("translationAudioId"));
    option("translation","off");assertEquals("",field("translationAudioId"));
  }
  @Test @SuppressWarnings("unchecked") public void searchCanChooseReciterAndNumericAyah()throws Exception{
    Method search=QuranCarService.class.getDeclaredMethod("search",String.class);search.setAccessible(true);
    for(String query:Arrays.asList("سوره ۲۰ آیه ۷۲ پرهیزگار","طه آیه ۷۲ پرهیزگار","Surah 20 verse 72 parhizgar")){
      List<MediaItem> matches=(List<MediaItem>)search.invoke(service,query);assertEquals(query,1,matches.size());assertEquals("v/parhizgar/20/72",matches.get(0).mediaId);
    }
  }
  @Test public void downloadsRequireEveryVerseAndExplicitPin()throws Exception{
    String r=children("reciters").get(0).mediaId.substring(5);
    assertTrue(children("downloads").isEmpty());
    java.io.File first=QuranAudioBridge.audioFile(service,r,1,1);first.getParentFile().mkdirs();
    java.io.File pin=new java.io.File(first.getParentFile(),"001.pin");pin.createNewFile();
    for(int a=1;a<=6;a++)try(java.io.FileOutputStream out=new java.io.FileOutputStream(QuranAudioBridge.audioFile(service,r,1,a))){out.write(1);}
    assertTrue(children("downloads").isEmpty());
    try(java.io.FileOutputStream out=new java.io.FileOutputStream(QuranAudioBridge.audioFile(service,r,1,7))){out.write(1);}
    assertEquals(1,children("downloads").size());
    pin.delete();for(int a=1;a<=7;a++)QuranAudioBridge.audioFile(service,r,1,a).delete();
  }
}
