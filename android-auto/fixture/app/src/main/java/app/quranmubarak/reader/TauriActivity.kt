package app.quranmubarak.reader
open class TauriActivity : android.app.Activity() {
 open fun onWebViewCreate(webView: android.webkit.WebView) {}
 final override fun onDestroy() { super.onDestroy() }
}
