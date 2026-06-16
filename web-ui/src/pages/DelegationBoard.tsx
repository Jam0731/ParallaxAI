type DelegationTask = {
  id: string
  conversationId: string
  delegating_agent: string
  target_agent: string
  task: string
  status: string
  result?: string
  created_at: number
  completed_at?: number
}

const AGENT_EMOJI: Record<string, string> = {
  munger: '🧠', woz: '🔧', ogilvy: '📢', taleb: '🛡️'
}

const COLUMNS = ['pending', 'running', 'completed', 'needs_decision'] as const

export default function DelegationBoard({ tasks, onRefresh }: { tasks: DelegationTask[]; onRefresh: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Delegation Tasks</h2>
        <button onClick={onRefresh} className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 text-xs text-gray-300">
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(status => {
          const columnTasks = tasks.filter(t => t.status === status)
          return (
            <div key={status} className="bg-gray-900 rounded-lg p-3 border border-gray-800 min-h-[200px]">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 capitalize flex items-center justify-between">
                <span>{status.replace('_', ' ')}</span>
                <span className="bg-gray-800 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="text-xs text-gray-600 italic py-4 text-center">No tasks</div>
                ) : (
                  columnTasks.map(task => (
                    <div key={task.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{AGENT_EMOJI[task.delegating_agent] ?? '👤'}</span>
                        <span className="text-xs text-gray-400">→</span>
                        <span>{AGENT_EMOJI[task.target_agent] ?? '👤'}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(task.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 line-clamp-3">{task.task}</div>
                      {task.result && (
                        <div className="mt-2 text-xs text-gray-500 line-clamp-2 border-t border-gray-700 pt-2">
                          {task.result}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
