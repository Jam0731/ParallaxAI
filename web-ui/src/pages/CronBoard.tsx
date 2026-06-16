import { useState } from 'react'

type CronJob = {
  id: string
  name: string
  description?: string
  scheduleType: string
  scheduleValue: string
  targetAgent?: string
  enabled: boolean
  lastRunAt?: number
  lastStatus?: string
  consecutiveFailures: number
}

type CronRun = {
  id: string
  jobId: string
  startedAt: number
  completedAt?: number
  status: string
  output?: string
  error?: string
  agentId?: string
}

const AGENT_EMOJI: Record<string, string> = {
  munger: '🧠', woz: '🔧', ogilvy: '📢', taleb: '🛡️'
}

const SCHEDULE_PRESETS = [
  { label: 'Every morning', scheduleType: 'cron', scheduleValue: '0 8 * * *', icon: '🌅' },
  { label: 'Every evening', scheduleType: 'cron', scheduleValue: '0 18 * * *', icon: '🌆' },
  { label: 'Hourly', scheduleType: 'every', scheduleValue: '3600000', icon: '⏰' },
  { label: 'Weekdays 9AM', scheduleType: 'cron', scheduleValue: '0 9 * * 1-5', icon: '📅' },
  { label: 'Weekly Monday', scheduleType: 'cron', scheduleValue: '0 9 * * 1', icon: '📆' },
  { label: 'Every 5min', scheduleType: 'every', scheduleValue: '300000', icon: '⚡' },
]

export default function CronBoard({ jobs, runs, onRefresh, onAdd, onRemove, onToggle, onRun }: {
  jobs: CronJob[]; runs: CronRun[]; onRefresh: () => void;
  onAdd: (job: any) => void; onRemove: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void; onRun: (id: string) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', scheduleType: 'cron', scheduleValue: '0 9 * * *',
    targetAgent: '', payloadMessage: '',
  })

  const filteredRuns = selectedJob ? runs.filter(r => r.jobId === selectedJob) : runs

  const handleCreate = () => {
    if (!form.name.trim()) return
    onAdd({
      name: form.name,
      description: form.description || undefined,
      scheduleType: form.scheduleType,
      scheduleValue: form.scheduleValue,
      targetAgent: form.targetAgent || undefined,
      payloadType: 'agent_turn',
      payloadData: JSON.stringify({ message: form.payloadMessage || `Execute task: ${form.name}` }),
    })
    setForm({ name: '', description: '', scheduleType: 'cron', scheduleValue: '0 9 * * *', targetAgent: '', payloadMessage: '' })
    setShowCreate(false)
  }

  const applyPreset = (preset: typeof SCHEDULE_PRESETS[0]) => {
    setForm(f => ({ ...f, scheduleType: preset.scheduleType, scheduleValue: preset.scheduleValue }))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Scheduled Tasks</h2>
          <p className="text-sm text-gray-500 mt-1">{jobs.length} jobs, {runs.length} recent runs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 text-xs text-gray-300">
            Refresh
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 text-xs text-white">
            + New Job
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-gray-900 rounded-lg p-5 border border-gray-700 mb-6">
          <h3 className="text-white font-medium mb-4">Create Scheduled Task</h3>

          {/* Quick presets */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Quick Schedule</label>
            <div className="grid grid-cols-6 gap-2">
              {SCHEDULE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 rounded text-xs text-left border transition-colors ${
                    form.scheduleValue === preset.scheduleValue
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="text-base mb-1">{preset.icon}</div>
                  <div>{preset.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name *</label>
              <input
                type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Daily report"
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Agent</label>
              <select
                value={form.targetAgent} onChange={e => setForm(f => ({ ...f, targetAgent: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value="">Auto (Munger)</option>
                <option value="munger">Munger</option>
                <option value="woz">Woz</option>
                <option value="ogilvy">Ogilvy</option>
                <option value="taleb">Taleb</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Schedule Type</label>
              <select
                value={form.scheduleType} onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value="cron">Cron Expression</option>
                <option value="every">Interval (ms)</option>
                <option value="at">One-time</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                {form.scheduleType === 'cron' ? 'Cron Expression' : form.scheduleType === 'every' ? 'Interval (ms)' : 'Datetime'}
              </label>
              <input
                type="text" value={form.scheduleValue} onChange={e => setForm(f => ({ ...f, scheduleValue: e.target.value }))}
                placeholder={form.scheduleType === 'cron' ? '0 9 * * *' : '3600000'}
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input
                type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Task Message (sent to agent)</label>
              <textarea
                value={form.payloadMessage} onChange={e => setForm(f => ({ ...f, payloadMessage: e.target.value }))}
                placeholder="Generate a daily report of all agent activities and costs..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={!form.name.trim()}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 text-sm text-white disabled:opacity-50">
              Create
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm text-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {jobs.length === 0 ? (
          <div className="col-span-2 text-center text-gray-600 py-8">
            No scheduled tasks. Click "+ New Job" to create one.
          </div>
        ) : (
          jobs.map(job => (
            <div
              key={job.id}
              className={`bg-gray-900 rounded-lg p-4 border transition-colors cursor-pointer ${
                selectedJob === job.id ? 'border-blue-500' : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={e => { e.stopPropagation(); onToggle(job.id, !job.enabled) }}
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${job.enabled ? 'bg-green-400' : 'bg-gray-600'}`}
                  title={job.enabled ? 'Disable' : 'Enable'}
                />
                <span className="text-white font-medium text-sm flex-1">{job.name}</span>
                {job.targetAgent && <span>{AGENT_EMOJI[job.targetAgent] ?? '👤'}</span>}
              </div>
              {job.description && <div className="text-xs text-gray-500 mb-2">{job.description}</div>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="font-mono">{job.scheduleType}: {job.scheduleValue}</span>
                {job.lastRunAt && (
                  <span>Last: {new Date(job.lastRunAt).toLocaleString()} ({job.lastStatus})</span>
                )}
                {job.consecutiveFailures > 0 && (
                  <span className="text-red-400">{job.consecutiveFailures} failures</span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={e => { e.stopPropagation(); onRun(job.id) }}
                  className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700">
                  Run Now
                </button>
                <button onClick={e => { e.stopPropagation(); onRemove(job.id) }}
                  className="px-2 py-1 bg-gray-800 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Runs History */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Run History{selectedJob ? ' (filtered)' : ''}</h3>
      </div>
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="px-4 py-2 text-left">Job</th>
              <th className="px-4 py-2 text-left">Agent</th>
              <th className="px-4 py-2 text-left">Started</th>
              <th className="px-4 py-2 text-left">Duration</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Output</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-600">No runs yet</td></tr>
            ) : (
              filteredRuns.map(run => {
                const job = jobs.find(j => j.id === run.jobId)
                const duration = run.completedAt ? `${((run.completedAt - run.startedAt) / 1000).toFixed(1)}s` : '-'
                return (
                  <tr key={run.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-300">{job?.name ?? run.jobId}</td>
                    <td className="px-4 py-2">{run.agentId ? (AGENT_EMOJI[run.agentId] ?? '👤') : '-'}</td>
                    <td className="px-4 py-2 text-gray-400">{new Date(run.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-400">{duration}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        run.status === 'success' ? 'bg-green-900/50 text-green-300' :
                        run.status === 'failed' ? 'bg-red-900/50 text-red-300' :
                        'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{run.output ?? run.error ?? '-'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
