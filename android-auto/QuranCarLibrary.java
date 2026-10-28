package app.quranmubarak.reader.auto;

import android.content.SharedPreferences;
import org.json.*;

/** Device-local listening library. Mutations merge with current data, never replace a stale snapshot. */
final class QuranCarLibrary {
  private final SharedPreferences prefs;
  private final int[] counts;
  QuranCarLibrary(SharedPreferences prefs,JSONArray surahs){this.prefs=prefs;counts=new int[surahs.length()];for(int i=0;i<counts.length;i++)counts[i]=surahs.optJSONObject(i).optInt("vc");}
  void validate(int s,int a){if(s<1||s>counts.length||a<1||a>counts[s-1])throw new IllegalArgumentException("Invalid ayah");}
  JSONArray array(String key){try{return new JSONArray(prefs.getString(key,"[]"));}catch(JSONException e){throw new IllegalStateException("Invalid saved library",e);}}
  JSONObject point(){try{return new JSONObject(prefs.getString("readingPoint","{}"));}catch(JSONException e){return new JSONObject();}}
  JSONObject snapshot()throws JSONException{return new JSONObject().put("favorites",array("favorites")).put("playlists",array("playlists")).put("reading",point()).put("revision",prefs.getLong("libraryRevision",0));}
  private void save(String key,String value){prefs.edit().putString(key,value).putLong("libraryRevision",prefs.getLong("libraryRevision",0)+1).apply();}
  boolean favorite(int s,int a){JSONArray values=array("favorites");for(int i=0;i<values.length();i++){JSONObject v=values.optJSONObject(i);if(v.optInt("s")==s&&v.optInt("a")==a)return true;}return false;}
  JSONObject list(String id){JSONArray lists=array("playlists");for(int i=0;i<lists.length();i++){JSONObject list=lists.optJSONObject(i);if(list.optString("id").equals(id))return list;}throw new IllegalArgumentException("Unknown playlist");}
  void mutate(JSONObject command)throws JSONException{
    String op=command.getString("action");
    if(op.equals("reading")){int s=command.getInt("s"),a=command.getInt("a");validate(s,a);JSONObject old=point();if(old.optInt("s")==s&&old.optInt("a")==a)return;save("readingPoint",new JSONObject().put("s",s).put("a",a).toString());return;}
    if(op.equals("favorite")){
      int s=command.getInt("s"),a=command.getInt("a");validate(s,a);boolean add=command.optBoolean("add",true);JSONArray old=array("favorites"),next=new JSONArray();
      for(int i=0;i<old.length();i++){JSONObject v=old.getJSONObject(i);if(v.optInt("s")!=s||v.optInt("a")!=a)next.put(v);}
      if(add){if(next.length()>=256)throw new IllegalArgumentException("Favorites limit");next.put(new JSONObject().put("s",s).put("a",a));}
      save("favorites",next.toString());return;
    }
    if(op.equals("saveList")||op.equals("deleteList")){
      String id=command.getString("listId");if(!id.matches("[a-z0-9-]{1,50}"))throw new IllegalArgumentException("Invalid playlist ID");
      JSONArray old=array("playlists"),next=new JSONArray();for(int i=0;i<old.length();i++)if(!old.getJSONObject(i).optString("id").equals(id))next.put(old.getJSONObject(i));
      if(op.equals("saveList")){
        String title=command.getString("title").trim();JSONArray surahs=command.getJSONArray("surahs");
        if(title.isEmpty()||title.length()>100||surahs.length()<1||surahs.length()>20||next.length()>=20)throw new IllegalArgumentException("Invalid playlist");
        for(int i=0;i<surahs.length();i++)validate(surahs.getInt(i),1);
        next.put(new JSONObject().put("id",id).put("title",title).put("surahs",surahs));
      }
      save("playlists",next.toString());return;
    }
    throw new IllegalArgumentException("Unknown library action");
  }
}
