import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export function MultiSelect({
  placeholder, opcoes, selecionadas, onChange, mono = false,
}: {
  placeholder: string
  opcoes: { value: string; label: string }[]
  selecionadas: string[]
  onChange: (v: string[]) => void
  mono?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) =>
    onChange(selecionadas.includes(v) ? selecionadas.filter(s => s !== v) : [...selecionadas, v])

  const btnLabel = selecionadas.length === 0
    ? placeholder
    : selecionadas.length === 1
      ? (opcoes.find(o => o.value === selecionadas[0])?.label ?? selecionadas[0])
      : `${selecionadas.length} selecionados`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[150px] justify-between"
      >
        <span className={selecionadas.length > 0 ? 'text-blue-700 font-medium' : 'text-gray-500'}>
          {btnLabel}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[180px] py-1 max-h-64 overflow-y-auto">
          {selecionadas.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 font-medium border-b border-gray-100"
            >
              Limpar seleção
            </button>
          )}
          {opcoes.map(op => (
            <label key={op.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selecionadas.includes(op.value)}
                onChange={() => toggle(op.value)}
                className="w-3.5 h-3.5 rounded accent-blue-600"
              />
              <span className={mono ? 'font-mono font-semibold text-xs text-blue-800' : 'text-gray-700 text-xs'}>
                {op.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
