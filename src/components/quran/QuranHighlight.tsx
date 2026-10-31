import QuranText from './QuranText'

/** Read-only matches use the same color/decorations contract as reader words. */
export default function QuranHighlight({text,state='match'}:{text:string;state?:'match'|'selected'}) {
 return <span className="reader-highlight" data-highlight-state={state} data-search-match="true"><QuranText text={text}/></span>
}
