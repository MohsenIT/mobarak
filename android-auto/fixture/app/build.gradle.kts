plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
 namespace = "app.quranmubarak.reader"
 compileSdk = 35
 defaultConfig { applicationId = "app.quranmubarak.reader"; minSdk = 24; targetSdk = 35 }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 kotlinOptions { jvmTarget = "17" }
 testOptions { unitTests.isIncludeAndroidResources = true }
}
dependencies { testImplementation("junit:junit:4.13.2"); testImplementation("org.robolectric:robolectric:4.14.1") }
tasks.withType<Test>().configureEach { systemProperty("user.home", System.getenv("QURAN_TEST_HOME") ?: System.getProperty("user.home")); systemProperty("robolectric.dependency.repo.url", "https://repo.maven.apache.org/maven2") }
