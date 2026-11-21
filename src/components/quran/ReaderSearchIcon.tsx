export default function ReaderSearchIcon({quick=false}:{quick?:boolean}) {
  const asset = `/icons/search/${quick ? 'quick-search' : 'advanced-search'}.svg`
  return <span aria-hidden="true" style={{
    display: 'inline-block', width: 24, height: 24, flexShrink: 0,
    backgroundColor: 'currentColor',
    mask: `url("${asset}") center / contain no-repeat`,
    WebkitMask: `url("${asset}") center / contain no-repeat`,
  }} />
}
