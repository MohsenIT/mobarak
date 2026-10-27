package app.quranmubarak.reader.auto;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;

/** Public read-only bundled cover art for media hosts. No user data or arbitrary paths. */
public final class QuranArtworkProvider extends ContentProvider {
  @Override public boolean onCreate(){return true;}
  static String coverName(Uri uri)throws FileNotFoundException{
    String path=uri.getPath();
    if(path==null||!path.matches("/surah/[0-9]{3}\\.png")||uri.getQuery()!=null||uri.getFragment()!=null)throw new FileNotFoundException("Unknown artwork");
    int n=Integer.parseInt(path.substring(7,10));if(n<1||n>114)throw new FileNotFoundException("Unknown surah");
    return path.substring(7);
  }
  @Override public String getType(Uri uri){try{coverName(uri);return "image/png";}catch(FileNotFoundException e){return null;}}
  @Override public synchronized ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
    if(!"r".equals(mode)||getContext()==null||!(getContext().getPackageName()+".artwork").equals(uri.getAuthority()))throw new FileNotFoundException("Read-only artwork");
    String name=coverName(uri);File directory=new File(getContext().getCacheDir(),"quran-artwork"),file=new File(directory,name);
    try{
      if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Cannot create cover cache");
      if(!file.isFile()||file.length()==0){
        File temp=File.createTempFile("cover-",".part",directory);
        try{
          try(InputStream in=getContext().getAssets().open("surah-artwork/"+name);OutputStream out=new FileOutputStream(temp)){
            byte[] bytes=new byte[8192];int count;while((count=in.read(bytes))!=-1)out.write(bytes,0,count);
          }
          if(!temp.renameTo(file))throw new IOException("Cannot cache cover");
        }finally{temp.delete();}
      }
      return ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
    }catch(IOException e){throw new FileNotFoundException("Unavailable cover: "+name);}
  }
  @Override public Cursor query(Uri uri,String[] projection,String selection,String[] selectionArgs,String sortOrder){return null;}
  @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException("Read-only artwork");}
  @Override public int update(Uri uri,ContentValues values,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read-only artwork");}
  @Override public int delete(Uri uri,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read-only artwork");}
}
