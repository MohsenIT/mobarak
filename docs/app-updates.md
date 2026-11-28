# Versioned app updates

`src/lib/app-releases.ts` is the append-only user-facing release catalogue, newest
first. Add a new semantic version, date, short title and plain-language changes
for every user-facing release. Retain older entries. Do not invent past versions.
The initial catalogue starts at 0.3.0; earlier builds did not record a versioned
history, so exact historical notes cannot be reconstructed automatically.

The installed release number comes from the bundled catalogue, not the latest
server response. Merely opening or dismissing notes never marks a release installed.
`/api/version` keeps its existing `version` build identifier for old clients and
adds the public release number and catalogue. Build IDs still detect a changed
deployment; public release numbers group changes for users. Installer package/build
numbers are currently separate from this content release version.

The slim top banner reserves measured space, rather than covering reading controls.
Only “version X” is styled as a link; “arrived” is plain text. The left update button
is always available, with a close icon. Small screens ellipsize text, not the action.
Updating directly does not require opening notes. The version link opens a dialog
showing every recorded release newer than the bundled installed version, newest
first, with Later and Update now actions. Technical builds without a new catalogue
entry still offer an update but honestly say that no new details were recorded.
A known older server release is not offered as an upgrade.

The version footer in the main menu opens update controls and offline-readable
release history. On Web and PWA, the installed public version comes from the
bundled catalogue and update checks compare build IDs from `/api/version`.
The shared Tauri frontend for Desktop and Android also shows the installer
version injected from the packaging workflow. It checks GitHub Releases for
a newer installer and links to the downloads. Installing it is a manual step.

Verification: numeric version sorting, six skipped releases, legacy API compatibility,
malformed/duplicate history, mobile banner geometry, popup contents and actions,
dismissal and manual access from the main menu. Synthetic future versions are test fixtures,
not entries in the published catalogue. Web updates continue to verify a fresh HTML
document before navigating; offline/data preservation behavior is unchanged.

## UI references

The following public source references were inspected for placement, not current
App Store ratings or pixel-identical designs:
- Firefox iOS groups Version in Settings → About:
  https://github.com/mozilla-mobile/firefox-ios/blob/main/firefox-ios/Client/Frontend/Settings/Main/AppSettingsTableViewController.swift
- Telegram Desktop's Advanced settings has a Version/Update section:
  https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/settings/sections/settings_advanced.cpp
- VS Code offers update release notes inside its update commands, separately from updating:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/update/browser/update.ts

History is available from the main-menu version footer, alongside the installed
version. The top strip is a shortcut when an update is available. At widths below 300px the optional
version text hides, while Update and Close remain. Otherwise the text may ellipsize.

Release rows keep the backward-compatible `changes: string[]` payload and may
supply parallel `changeKinds` values (feature, improvement, fix, security, removed).
Unknown/legacy kinds default to improvement. The dialog shows a distinct icon and
localized accessible label instead of a bullet. Public notes describe user
behavior, not internal implementation. It renders five versions initially and
loads five more when the list's end enters its scroll viewport, with a manual
older-versions button as fallback. This paginates rendering; the small version API
catalogue still arrives together for compatibility and offline history.
