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
