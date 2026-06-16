import { useState, useEffect } from 'react'

const API_BASE = `http://${window.location.hostname}:46447/api`

type Role = {
  id: string
  name: string
  adapter: string
  fallback: string[]
  configDir: string
  hasAgentsMd: boolean
  hasSkillMd: boolean
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [promptContent, setPromptContent] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newRole, setNewRole] = useState({ id: '', name: '', adapter: 'mimo', fallback: ['claude'] })
  const [testMessage, setTestMessage] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => { loadRoles() }, [])

  const loadRoles = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/roles`)
      const data = await res.json()
      setRoles(data)
    } catch (err) {
      console.error('Failed to load roles:', err)
    }
    setLoading(false)
  }

  const createRole = async () => {
    if (!newRole.id || !newRole.name) return
    try {
      await fetch(`${API_BASE}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      })
      setShowNewForm(false)
      setNewRole({ id: '', name: '', adapter: 'mimo', fallback: ['claude'] })
      loadRoles()
    } catch (err) {
      console.error('Failed to create role:', err)
    }
  }

  const deleteRole = async (id: string) => {
    if (!confirm(`Delete role "${id}"?`)) return
    try {
      await fetch(`${API_BASE}/roles/${id}`, { method: 'DELETE' })
      loadRoles()
    } catch (err) {
      console.error('Failed to delete role:', err)
    }
  }

  const loadPrompt = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/roles/${id}/prompt`)
      const data = await res.json()
      setPromptContent(data.content)
      setEditingRole(id)
    } catch (err) {
      console.error('Failed to load prompt:', err)
    }
  }

  const savePrompt = async () => {
    if (!editingRole) return
    try {
      await fetch(`${API_BASE}/roles/${editingRole}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: promptContent }),
      })
      setEditingRole(null)
      loadRoles()
    } catch (err) {
      console.error('Failed to save prompt:', err)
    }
  }

  const testRole = async (id: string) => {
    if (!testMessage.trim()) return
    setTesting(true)
    setTestResult('')
    try {
      const res = await fetch(`${API_BASE}/roles/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      })
      const data = await res.json()
      setTestResult(data.response ?? data.error ?? 'No response')
    } catch (err) {
      setTestResult(`Error: ${err}`)
    }
    setTesting(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Role Management</h2>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + New Role
        </button>
      </div>

      {/* New Role Form */}
      {showNewForm && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 mb-4">
          <h3 className="text-white font-medium mb-3">Create New Role</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="角色名称 (e.g. Analyst)"
              value={newRole.name}
              onChange={e => {
                const name = e.target.value
                const id = name.toLowerCase().replace(/[^a-z0-9]/g, '')
                setNewRole({ ...newRole, name, id })
              }}
              className="px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            />
            <select
              value={newRole.adapter}
              onChange={e => setNewRole({ ...newRole, adapter: e.target.value })}
              className="px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            >
              <option value="mimo">MiMo Code</option>
              <option value="claude">Claude Code</option>
              <option value="reasonix">Reasonix</option>
            </select>
            <div className="flex gap-2">
              <button onClick={createRole} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 text-sm">Create</button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm">Cancel</button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">ID will be auto-generated from name: "{newRole.name}" → {newRole.id || '(enter name)'}</p>
        </div>
      )}

      {/* Role List */}
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg">
                {role.id === 'munger' ? '🧠' : role.id === 'woz' ? '🔧' : role.id === 'ogilvy' ? '📢' : role.id === 'taleb' ? '🛡️' : '👤'}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">{role.name}</div>
                <div className="text-xs text-gray-500">
                  Adapter: {role.adapter} | Fallback: {role.fallback.join(', ') || 'none'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadPrompt(role.id)}
                  className="px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                >
                  Edit Prompt
                </button>
                <button
                  onClick={() => deleteRole(role.id)}
                  className="px-3 py-1.5 bg-red-900/50 rounded hover:bg-red-900 text-xs text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Test Area */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Test message..."
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && testRole(role.id)}
                className="flex-1 px-3 py-1.5 bg-gray-800 text-gray-200 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button
                onClick={() => testRole(role.id)}
                disabled={testing || !testMessage.trim()}
                className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {testing ? '...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className="mt-2 p-3 bg-gray-800 rounded text-sm text-gray-300 max-h-40 overflow-y-auto">
                {testResult}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prompt Editor Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl max-h-[80vh] flex flex-col border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Edit Prompt: {editingRole}</h3>
              <div className="flex gap-2">
                <button onClick={savePrompt} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 text-sm">Save</button>
                <button onClick={() => setEditingRole(null)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm">Cancel</button>
              </div>
            </div>
            <textarea
              value={promptContent}
              onChange={e => setPromptContent(e.target.value)}
              className="flex-1 min-h-[300px] p-4 bg-gray-800 text-gray-200 rounded font-mono text-sm border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">Changes take effect on next new session. Existing sessions are not affected.</p>
          </div>
        </div>
      )}
    </div>
  )
}
