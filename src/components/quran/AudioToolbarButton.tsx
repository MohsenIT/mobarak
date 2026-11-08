'use client'

import { AudioLines, LoaderCircle, Play } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { RecitationTransportStatus } from './RecitationPlayer'

/**
 * The toolbar's recitation button.
 *
 * One control, three interaction phases — closed (offer to play from the
 * current ayah), open with its controls visible (collapse them), and
 * collapsed (bring them back and resume). The click policy lives here; the
 * session state it reads and mutates stays with the screen, which owns the
 * player and the reading position the recitation follows.
 *
 * The face reflects the transport while open: the activity bars while
 * playing, a spinner while loading, the audio-lines icon while idle with
 * controls visible, and the play icon when closed.
 */
export default function AudioToolbarButton({
  open,
  controlsVisible,
  status,
  onOpen,
  onCollapse,
  onExpandAndResume,
}: {
  open: boolean
  controlsVisible: boolean
  status: RecitationTransportStatus
  /** Open the player with its controls. */
  onOpen: () => void
  /** Collapse the controls without closing the player. */
  onCollapse: () => void
  /** Show the controls again and resume if the transport is not loading. */
  onExpandAndResume: () => void
}) {
  const handleClick = () => {
    if (!open) onOpen()
    else if (controlsVisible) onCollapse()
    else onExpandAndResume()
  }
  return (
    <button
      className="icon-btn"
      aria-label={!open ? t('ui.facfd50c31') : controlsVisible ? t('ui.feabb65c6a') : status === 'playing' ? t('ui.7851ddb1df') : t('ui.f432f383bf')}
      title={!open ? t('ui.1f7cc9473a') : controlsVisible ? t('ui.0b17cf0f81') : t('ui.0884ec3e62')}
      aria-expanded={open && controlsVisible}
      aria-busy={status === 'loading'}
      style={open ? { color: 'var(--sage)', background: 'var(--word-root)' } : undefined}
      onClick={handleClick}
    >
      {status === 'playing' && open ? (
        <span className="recitation-activity" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
        </span>
      ) : status === 'loading' && open ? (
        <LoaderCircle size={20} className="recitation-start-spinner animate-spin" />
      ) : open && controlsVisible ? (
        <AudioLines size={20} />
      ) : (
        <Play size={20} fill="currentColor" />
      )}
    </button>
  )
}
