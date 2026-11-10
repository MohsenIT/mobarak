package app.quranmubarak.reader.auto;

import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.drm.DrmSessionManagerProvider;
import androidx.media3.exoplayer.source.*;
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy;
import java.util.function.Function;
import java.util.function.ToLongFunction;

/** One queue item per ayah: Quran first, optional recorded translation second. */
@UnstableApi
final class QuranVerseMediaSourceFactory implements MediaSource.Factory {
  private final MediaSource.Factory base;
  private final Function<MediaItem,String> translation;
  private final ToLongFunction<MediaItem> quranDuration,translationDuration;
  QuranVerseMediaSourceFactory(MediaSource.Factory base,Function<MediaItem,String> translation){this(base,translation,item->60000,item->60000);}
  QuranVerseMediaSourceFactory(MediaSource.Factory base,Function<MediaItem,String> translation,ToLongFunction<MediaItem> quranDuration,ToLongFunction<MediaItem> translationDuration){this.base=base;this.translation=translation;this.quranDuration=quranDuration;this.translationDuration=translationDuration;}
  @Override public MediaSource.Factory setDrmSessionManagerProvider(DrmSessionManagerProvider p){base.setDrmSessionManagerProvider(p);return this;}
  @Override public MediaSource.Factory setLoadErrorHandlingPolicy(LoadErrorHandlingPolicy p){base.setLoadErrorHandlingPolicy(p);return this;}
  @Override public int[] getSupportedTypes(){return base.getSupportedTypes();}
  @Override public MediaSource createMediaSource(MediaItem item){
    String uri=translation.apply(item);
    String[] parts=item.mediaId.split("/");
    boolean opening=parts.length==4&&parts[0].equals("v")&&parts[3].equals("1")&&!parts[2].equals("1")&&!parts[2].equals("9")&&item.localConfiguration!=null;
    if(uri==null&&!opening)return base.createMediaSource(item);
    ConcatenatingMediaSource2.Builder sequence=new ConcatenatingMediaSource2.Builder().setMediaItem(item).setMediaSourceFactory(base);
    if(opening){
      String source=item.localConfiguration.uri.toString();
      int slash=source.lastIndexOf('/');
      MediaItem basmalah=item.buildUpon().setMediaId("v/"+parts[1]+"/1/1").setUri(source.substring(0,slash+1)+"001001.mp3").build();
      sequence.add(basmalah,6000);
    }
    sequence.add(item,Math.max(1,quranDuration.applyAsLong(item)));
    if(uri==null)return sequence.build();
    MediaItem translated=item.buildUpon().setMediaId(item.mediaId+"#translation").setUri(uri).build();
    return sequence.add(translated,Math.max(1,translationDuration.applyAsLong(item))).build();
  }
}
