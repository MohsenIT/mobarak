/* Standalone Persian editorial document; no reader state or external scripts. */
(() => {
  const slides = Array.from(document.querySelectorAll('.slide'))
  const previous = document.getElementById('prev')
  const next = document.getElementById('next')
  const counter = document.getElementById('counter')
  const navigation = document.querySelector('nav')
  if (!slides.length || !previous || !next || !counter || !navigation) return
  const digits = '۰۱۲۳۴۵۶۷۸۹'
  const fa = value => String(value).replace(/\d/g, digit => digits[Number(digit)])
  const interactive = target => target instanceof Element && target.closest('button,a,input,textarea,select,[contenteditable]')
  let page = 0
  function go(index, focus = true) {
    page = Math.max(0, Math.min(slides.length - 1, index))
    slides.forEach((slide, i) => {
      slide.hidden = i !== page
      slide.classList.toggle('active', i === page)
    })
    counter.textContent = `${fa(page + 1)} از ${fa(slides.length)}`
    previous.disabled = page === 0
    next.disabled = page === slides.length - 1
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (focus) slides[page].querySelector('h1')?.focus({ preventScroll: true })
  }
  previous.addEventListener('click', () => go(page - 1))
  next.addEventListener('click', () => go(page + 1))
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || interactive(event.target)) return
    const destination = event.key === 'ArrowRight' ? page - 1
      : event.key === 'ArrowLeft' ? page + 1
      : event.key === ' ' ? page + (event.shiftKey ? -1 : 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? slides.length - 1 : null
    if (destination === null) return
    event.preventDefault()
    go(destination)
  })
  let touch = null
  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || interactive(event.target)) { touch = null; return }
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }, { passive: true })
  document.addEventListener('touchend', event => {
    const start = touch
    touch = null
    if (!start || event.touches.length || event.changedTouches.length !== 1 || window.getSelection()?.toString()) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) go(page + (dx > 0 ? 1 : -1))
  }, { passive: true })
  document.addEventListener('touchcancel', () => { touch = null }, { passive: true })
  go(0, false)
  navigation.hidden = false
})()
