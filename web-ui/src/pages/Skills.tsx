import { useState, useEffect } from 'react'

const API_BASE = `http://${window.location.hostname}:46447/api`

type Role = {
  id: string
  name: string
  adapter: string
  hasSkillMd: boolean
}

const AGENT_EMOJI: Record<string, string> = {
  munger: '🧠', woz: '🔧', ogilvy: '📢', taleb: '🛡️'
}

export default function SkillsPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [skillContent, setSkillContent] = useState('')
  const [saving, setSaving] = useState(false)

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

  const loadSkill = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/roles/${id}/skill`)
      const data = await res.json()
      setSkillContent(data.content ?? '')
      setEditingRole(id)
    } catch (err) {
      console.error('Failed to load skill:', err)
    }
  }

  const saveSkill = async () => {
    if (!editingRole) return
    setSaving(true)
    try {
      await fetch(`${API_BASE}/roles/${editingRole}/skill`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: skillContent }),
      })
      setEditingRole(null)
      loadRoles()
    } catch (err) {
      console.error('Failed to save skill:', err)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading...</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Skills Management</h2>
          <p className="text-sm text-gray-500 mt-1">Edit SKILL.md for each agent — defines capabilities and workflows</p>
        </div>
      </div>

      {/* Skill List */}
      <div className="space-y-3">
        {roles.map(role => (
          <div key={role.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{AGENT_EMOJI[role.id] ?? '👤'}</span>
              <div className="flex-1">
                <div className="text-white font-medium">{role.name}</div>
                <div className="text-xs text-gray-500">
                  Adapter: {role.adapter}
                  {role.hasSkillMd
                    ? <span className="text-green-400 ml-2">● SKILL.md exists</span>
                    : <span className="text-yellow-400 ml-2">○ No SKILL.md</span>
                  }
                </div>
              </div>
              <button
                onClick={() => loadSkill(role.id)}
                className="px-4 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-xs text-gray-300"
              >
                Edit Skill
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Skill Editor Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">{AGENT_EMOJI[editingRole] ?? '👤'}</span>
                <div>
                  <h3 className="text-white font-medium">Edit Skill: {editingRole}</h3>
                  <p className="text-xs text-gray-500">agent-configs/{editingRole}/SKILL.md</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveSkill}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 text-sm text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                value={skillContent}
                onChange={e => setSkillContent(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 bg-gray-800 text-gray-200 rounded font-mono text-sm border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-800 text-xs text-gray-500">
              Changes take effect on next new session. Existing sessions are not affected.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
