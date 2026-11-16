'use client'

import { Eye } from 'lucide-react'
import { t } from '@/lib/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ReaderDisplayControls, { type ReaderDisplayProps } from './ReaderDisplayControls'

export default function ReaderDisplayMenu({ showTranslation, onTranslation, ...display }: ReaderDisplayProps & {
  showTranslation: boolean
  onTranslation: (visible: boolean) => void
}) {
  return <Popover>
    <PopoverTrigger asChild><button type="button" className="icon-btn" aria-label={t('ui.8308380b89')} title={t('ui.8308380b89')}><Eye size={22} /></button></PopoverTrigger>
    <PopoverContent className="reader-display-menu" dir="rtl" aria-label={t('ui.8308380b89')} sideOffset={10}>
      <ReaderDisplayControls {...display} translation={{ visible: showTranslation, onChange: onTranslation }} />
    </PopoverContent>
  </Popover>
}
