# Voice entry

`DictationInput` and `DictationTextarea` add an optional microphone beside editable
fields. All reader text/search inputs use the shared component; numeric sliders,
checkboxes and radio controls do not. Text still works normally without voice.

The current adapter detects browser SpeechRecognition / webkitSpeechRecognition.
A microphone appears only when the browser exposes an engine. OS keyboard
speech availability alone is not detectable from a web page; native WebViews that
do not expose this API will need a native speech adapter. No native speech plugin
or remote transcription backend has been installed by this change.

Recognition begins only on a microphone click, in the selected UI language. Its
transcript replaces the selected span, respects maxLength without truncating
unrelated suffix text, and goes through the controlled input's normal React change
handler. It does not submit a form or send a message automatically. Fields become
read-only while listening and editable again after recognition finishes/stops.
Closing/unmounting the field aborts recognition. Only one field listens at a time.
Microphone permission and unavailable/network errors are displayed through i18n.
No audio recording is stored by this feature. Engine availability, connectivity
and permissions remain browser/platform responsibilities.

Browser automation uses a mock speech engine to verify controlled-state updates,
filtering, stop/cleanup, disabled capability and layout. This is not a physical
microphone or provider transcription accuracy test.
