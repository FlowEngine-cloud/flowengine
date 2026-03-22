'use client'

import { useState } from 'react'
import { X, Server, ChevronRight, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Instance {
  id: string
  instance_name: string
  instance_url: string
  status: string
  hasApiKey: boolean
  type?: 'dedicated' | 'pay-per-instance'
}

interface InstancePickerModalProps {
  isOpen: boolean
  onClose: () => void
  instances: Instance[]
  onSelect: (instance: Instance) => void
  onManualImport?: (instance: Instance) => void
  isLoading?: boolean
}

export default function InstancePickerModal({
  isOpen,
  onClose,
  instances,
  onSelect,
  onManualImport,
  isLoading = false,
}: InstancePickerModalProps) {
  // Close on ESC key
  useEscapeKey(isOpen, onClose)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (instance: Instance) => {
    setSelectedId(instance.id)
    if (instance.hasApiKey) {
      onSelect(instance)
    } else if (onManualImport) {
      onManualImport(instance)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md mx-4 bg-gray-900/50 border border-gray-800 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-white">Import to n8n</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 text-sm text-white/60">
              <p><span className="text-white">Auto-import:</span> Workflow imports automatically</p>
              <p><span className="text-white">Manual import:</span> Opens n8n, click paste to import</p>
            </div>
          </div>

          {/* Instance List */}
          <div className="p-4 max-h-80 overflow-y-auto">
            {instances.length === 0 ? (
              <div className="text-center py-8">
                <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-white/60">No instances found</p>
                <p className="text-sm text-white/40 mt-1">
                  Deploy an n8n instance first
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {instances.map((instance) => {
                  const isRunning = instance.status === 'running' || instance.status === 'active' || instance.status === 'ready'
                  const isClickable = instance.hasApiKey ? isRunning : true
                  const isSelected = selectedId === instance.id

                  return (
                    <button
                      key={instance.id}
                      onClick={() => isClickable && handleSelect(instance)}
                      disabled={!isClickable || isLoading}
                      className={`w-full p-4 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-gray-800/50 border-gray-600'
                          : isClickable
                          ? 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                          : 'bg-gray-800/20 border-gray-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isClickable ? 'bg-gray-800/50' : 'bg-gray-800/30'
                          }`}>
                            <Server className={`w-5 h-5 ${
                              isClickable ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-white">
                                {instance.instance_name}
                              </h3>
                            </div>
                            <p className="text-xs text-white/40 truncate max-w-48">
                              {instance.instance_url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {instance.hasApiKey ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-white/60">
                              Auto-import
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-white/60">
                              Manual import
                            </span>
                          )}
                          {isClickable && (
                            isSelected && isLoading ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
