import { useState, useRef, useCallback } from 'react'
import { X, Upload, Paperclip, Image, FileText, Trash2, Eye, Download } from 'lucide-react'
import type { Obra, Anexo } from '../types'
import { useAnexos } from '../contexts/AnexosContext'

interface Props {
  obra: Obra
  onClose: () => void
}

const MAX_FILE_SIZE = 8 * 1024 * 1024  // 8 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(tipo: string) { return tipo.startsWith('image/') }

export default function AnexosModal({ obra, onClose }: Props) {
  const { getAnexosObra, addAnexo, deleteAnexo, updateAnexo } = useAnexos()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState<Anexo | null>(null)
  const [editDesc, setEditDesc] = useState<{ id: string; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const anexos = getAnexosObra(obra.id)
  const fotos = anexos.filter(a => isImage(a.tipo))
  const arquivos = anexos.filter(a => !isImage(a.tipo))

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setErro('')
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setErro(`Tipo não suportado: ${file.name}`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        setErro(`Arquivo muito grande (máx 8 MB): ${file.name}`)
        continue
      }
      const reader = new FileReader()
      await new Promise<void>(resolve => {
        reader.onload = () => {
          addAnexo({
            obraId: obra.id,
            nome: file.name,
            tipo: file.type,
            tamanho: file.size,
            dados: reader.result as string,
            data: new Date().toISOString().split('T')[0],
          })
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }
    setUploading(false)
  }, [obra.id, addAnexo])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files)
    e.target.value = ''
  }

  const handleDownload = (anexo: Anexo) => {
    const a = document.createElement('a')
    a.href = anexo.dados
    a.download = anexo.nome
    a.click()
  }

  const fmtDate = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}/${y}`
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Paperclip size={18} className="text-purple-600" />
                Anexos e Fotos
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{obra.localidade}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {anexos.length} arquivo{anexos.length !== 1 ? 's' : ''}
              </span>
              <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/40'
              }`}
            >
              <input ref={inputRef} type="file" multiple accept={ALLOWED_TYPES.join(',')} onChange={onInputChange} className="hidden" />
              <Upload size={24} className={`mx-auto mb-2 ${dragging ? 'text-purple-500' : 'text-gray-300'}`} />
              {uploading
                ? <p className="text-sm text-purple-600 font-medium">Processando...</p>
                : <>
                  <p className="text-sm font-medium text-gray-600">Arraste arquivos ou clique para selecionar</p>
                  <p className="text-xs text-gray-400 mt-1">Imagens, PDF, Word, Excel — máx 8 MB cada</p>
                </>
              }
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">
                {erro}
              </div>
            )}

            {/* Fotos */}
            {fotos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Image size={14} className="text-blue-500" />
                  Fotos ({fotos.length})
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {fotos.map(a => (
                    <div key={a.id} className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                      <img src={a.dados} alt={a.nome} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => setPreview(a)}
                          className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:text-blue-600 transition-colors">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => handleDownload(a)}
                          className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:text-green-600 transition-colors">
                          <Download size={14} />
                        </button>
                        <button onClick={() => deleteAnexo(a.id)}
                          className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                        <p className="text-[9px] text-white truncate">{a.nome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Arquivos */}
            {arquivos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-amber-500" />
                  Documentos ({arquivos.length})
                </h3>
                <div className="space-y-2">
                  {arquivos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <FileText size={16} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editDesc?.id === a.id
                          ? <input autoFocus value={editDesc.texto} onChange={e => setEditDesc({ id: a.id, texto: e.target.value })}
                              onBlur={() => { updateAnexo(a.id, { descricao: editDesc.texto }); setEditDesc(null) }}
                              onKeyDown={e => { if (e.key === 'Enter') { updateAnexo(a.id, { descricao: editDesc.texto }); setEditDesc(null) } }}
                              className="text-sm text-gray-700 w-full border-b border-blue-400 outline-none bg-transparent" />
                          : <p className="text-sm text-gray-700 truncate cursor-pointer hover:text-blue-600"
                              onClick={() => setEditDesc({ id: a.id, texto: a.descricao || a.nome })}>
                              {a.descricao || a.nome}
                            </p>
                        }
                        <p className="text-[10px] text-gray-400">{fmtSize(a.tamanho)} · {fmtDate(a.data)}</p>
                      </div>
                      <button onClick={() => handleDownload(a)}
                        className="p-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <Download size={14} />
                      </button>
                      <button onClick={() => deleteAnexo(a.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {anexos.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum arquivo anexado ainda</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview lightbox */}
      {preview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <img src={preview.dados} alt={preview.nome}
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button onClick={e => { e.stopPropagation(); handleDownload(preview) }}
                className="p-2 bg-white/90 rounded-xl text-gray-700 hover:text-green-600 shadow transition-colors">
                <Download size={16} />
              </button>
              <button onClick={() => setPreview(null)}
                className="p-2 bg-white/90 rounded-xl text-gray-700 hover:text-red-500 shadow transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-white/70 text-xs mt-2 text-center">{preview.nome}</p>
          </div>
        </div>
      )}
    </>
  )
}
