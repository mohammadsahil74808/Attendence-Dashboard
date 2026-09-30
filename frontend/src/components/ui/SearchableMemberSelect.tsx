import React, { useState, useRef, useEffect } from 'react'
import { Search, UserCheck, X, ChevronDown, Check } from 'lucide-react'
import type { User } from '../../types'

interface SearchableMemberSelectProps {
  users: User[]
  value?: number | null
  onChange: (userId: number | null) => void
  name?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  allowUnassigned?: boolean
  currentUserId?: number
}

export const SearchableMemberSelect: React.FC<SearchableMemberSelectProps> = ({
  users,
  value,
  onChange,
  name,
  placeholder = 'Select member...',
  className = '',
  disabled = false,
  allowUnassigned = true,
  currentUserId,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Find currently selected user
  const selectedUser = users.find((u) => u.id === value)

  // Filter members by query
  const query = search.trim().toLowerCase()
  const filteredUsers = users.filter((u) => {
    if (!query) return true
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    )
  })

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input on open
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (userId: number | null) => {
    onChange(userId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for form submission via FormData */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg border transition-all text-xs ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-neutral-900'
            : 'border-neutral-700 bg-neutral-900/80 hover:border-neutral-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedUser ? (
            <>
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xs font-bold text-indigo-300 shrink-0">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-medium text-neutral-100 truncate">
                  {selectedUser.name}
                </span>
                {selectedUser.id === currentUserId && (
                  <span className="text-2xs text-indigo-400 shrink-0">(You)</span>
                )}
                <span
                  className={`text-2xs px-1.5 py-0.2 rounded font-semibold uppercase shrink-0 ${
                    selectedUser.role === 'admin'
                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {selectedUser.role}
                </span>
              </div>
            </>
          ) : (
            <span className="text-neutral-400 italic flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-neutral-500" />
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-neutral-400">
          {selectedUser && allowUnassigned && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(null)
              }}
              className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              title="Clear assignment"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-neutral-900 border border-neutral-700/80 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Live Search Input */}
          <div className="p-2 border-b border-neutral-800 bg-neutral-950/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member name or email..."
                className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-800/40">
            {allowUnassigned && !search && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-neutral-800/60 transition-colors ${
                  value === null || value === undefined
                    ? 'bg-indigo-500/10 text-indigo-300 font-medium'
                    : 'text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-2xs">
                    —
                  </div>
                  <span>Unassigned (Anyone can pick)</span>
                </div>
                {(value === null || value === undefined) && (
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>
            )}

            {filteredUsers.length === 0 ? (
              <div className="py-6 px-3 text-center text-neutral-500 text-xs">
                No members found matching &quot;{search}&quot;
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = value === u.id
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelect(u.id)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-neutral-800/70 transition-colors ${
                      isSelected
                        ? 'bg-indigo-500/10 text-indigo-200 font-medium'
                        : 'text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-neutral-100 truncate">
                            {u.name}
                          </span>
                          {u.id === currentUserId && (
                            <span className="text-2xs text-indigo-400 font-normal shrink-0">
                              (You)
                            </span>
                          )}
                          <span
                            className={`text-2xs px-1.5 py-0.2 rounded font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <div className="text-2xs font-mono text-neutral-400 truncate">
                          {u.email}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
