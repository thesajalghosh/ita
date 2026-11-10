import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ children, onClose, panelClassName = '' }) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={() => onClose?.()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Dialog"
        tabIndex={-1}
        className={`slide-up relative z-10 w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-2xl ${panelClassName}`}
      >
        {children}
      </section>
    </div>,
    document.body
  )
}
