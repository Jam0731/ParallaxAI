import { useState, useRef, useEffect } from 'react'
import { useGateway } from './hooks/useGateway'
import RolesPage from './pages/Roles'
import SkillsPage from './pages/Skills'
import DelegationBoard from './pages/DelegationBoard'
import CronBoard from './pages/CronBoard'

const AGENTS: Record<string, { name: string; emoji: string; role: string }> = {
  munger: { name: 'Munger', emoji: '🧠', role: 'strategist' },
  woz: { name: 'Woz', emoji: '🔧', role: 'builder' },
  ogilvy: { name: 'Ogilvy', emoji: '📢', role: 'growth' },
  taleb: { name: 'Taleb', emoji: '🛡️', role: 'guardian' },
}

const AGENT_COLORS: Record<string, string> = {
  munger: 'border-purple-500',
  woz: 'border-blue-500',
  ogilvy: 'border-green-500',
  taleb: 'border-orange-500',
}

const SLASH_COMMANDS = [
  // Most used — shown by default
  { name: '/compact', description: 'Summarize & compact context', icon: '📦', scope: 'forward', agentAware: true },
  { name: '/clear', description: 'Clear conversation', icon: '🗑️', scope: 'session' },
  { name: '/search', description: 'Search knowledge base', icon: '🔍', scope: 'session' },
  { name: '/cost', description: 'Cost & token summary', icon: '💰', scope: 'session' },
  // Rest — accessible via scroll/filter
  { name: '/new', description: 'New conversation', icon: '🆕', scope: 'session' },
  { name: '/undo', description: 'Undo last message pair', icon: '↩️', scope: 'session' },
  { name: '/help', description: 'Show all commands', icon: '❓', scope: 'session' },
  { name: '/status', description: 'System status', icon: '📊', scope: 'session' },
  { name: '/export', description: 'Export conversation', icon: '📤', scope: 'session' },
  { name: '/copy', description: 'Copy last response', icon: '📋', scope: 'session' },
  { name: '/dream', description: 'Consolidate memory', icon: '💤', scope: 'session' },
  { name: '/review', description: 'Review code changes', icon: '🔎', scope: 'forward', agentAware: true },
  { name: '/init', description: 'Initialize AGENTS.md', icon: '📝', scope: 'forward', agentAware: true },
  { name: '/cron', description: 'Manage scheduled tasks', icon: '⏰', scope: 'session' },
]

const WS_URL = `ws://${window.location.hostname}:46446`

type Tab = 'chat' | 'agents' | 'roles' | 'skills' | 'tasks' | 'cron'

export default function App() {
  const {
    connected, messages, agents, streaming, send, cancel,
    workspaces, activeWorkspace, conversationId, conversations,
    switchWorkspace, createWorkspace, newConversation, switchConversation,
    delegationTasks, refreshDelegationTasks,
    cronJobs, cronRuns, refreshCronData,
    costSummary, setMessages,
    addCronJob, removeCronJob, toggleCronJob, runCronJob,
  } = useGateway(WS_URL)

  const [input, setInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [commandIndex, setCommandIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [newWsPath, setNewWsPath] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    send(text)
    setInput('')
    setShowMentions(false)
    setShowCommands(false)
  }

  const filteredAgents = Object.entries(AGENTS).filter(([id]) =>
    !mentionFilter || id.startsWith(mentionFilter) || AGENTS[id].name.toLowerCase().startsWith(mentionFilter)
  )

  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    !commandFilter || cmd.name.slice(1).startsWith(commandFilter)
  )

  const insertMention = (agentId: string) => {
    const newInput = input.replace(/@\w*$/, `@${agentId} `)
    setInput(newInput)
    setShowMentions(false)
  }

  const executeCommand = (cmd: typeof SLASH_COMMANDS[0], args?: string) => {
    setInput('')
    setShowCommands(false)

    switch (cmd.name) {
      case '/clear':
      case '/new':
        newConversation()
        break
      case '/help': {
        const helpText = SLASH_COMMANDS.map(c => `  ${c.name.padEnd(12)} ${c.description}`).join('\n')
        addSystemMessage(`Commands:\n\n${helpText}\n\nTip: /compact @woz forwards compact to a specific agent.`)
        break
      }
      case '/cost':
        addSystemMessage(`Today: ${costSummary.today.totalTokens.toLocaleString()} tokens, $${costSummary.today.totalUsd.toFixed(4)}`)
        break
      case '/status': {
        const agentList = Object.entries(AGENTS).map(([id, a]) => `${a.emoji} ${a.name}: ${agents[id] ?? 'offline'}`).join('\n')
        addSystemMessage(`System Status\n\nWorkspace: ${activeWorkspace?.name ?? 'none'}\nConnected: ${connected}\nConversations: ${conversations.length}\n\nAgents:\n${agentList}`)
        break
      }
      case '/export': {
        const text = messages.map(m => `[${m.role}${m.agentId ? `/${m.agentId}` : ''}] ${m.content}`).join('\n\n')
        navigator.clipboard.writeText(text)
        addSystemMessage('Conversation copied to clipboard.')
        break
      }
      case '/copy': {
        const last = [...messages].reverse().find(m => m.role === 'assistant')
        if (last) { navigator.clipboard.writeText(last.content); addSystemMessage('Last response copied.') }
        else { addSystemMessage('No assistant response found.') }
        break
      }
      case '/undo': {
        // Remove last user+assistant pair
        setMessages(m => {
          const lastAssistant = m.findLastIndex(x => x.role === 'assistant')
          const lastUser = m.findLastIndex(x => x.role === 'user')
          if (lastAssistant < 0 && lastUser < 0) return m
          const cutAt = Math.max(lastAssistant, lastUser)
          return m.slice(0, cutAt)
        })
        addSystemMessage('Undid last message pair.')
        break
      }
      case '/search': {
        const query = args?.trim()
        if (!query) { addSystemMessage('Usage: /search <query>'); break }
        // Fetch from knowledge API
        fetch(`http://${window.location.hostname}:46447/api/knowledge/search?q=${encodeURIComponent(query)}&limit=5`)
          .then(r => r.json())
          .then(results => {
            if (results.length === 0) { addSystemMessage('No results found.'); return }
            const text = results.map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.chunkContent?.slice(0, 150)}...`).join('\n\n')
            addSystemMessage(`Knowledge search results:\n\n${text}`)
          })
          .catch(() => addSystemMessage('Search failed. Is the API server running?'))
        break
      }
      case '/dream':
        addSystemMessage('Memory consolidation triggered. Check cron board for results.')
        break
      case '/cron':
        setActiveTab('cron')
        break
      case '/compact': {
        const agentMatch = args?.match(/@(\w+)/)
        const targetAgent = agentMatch?.[1] ?? null
        const compactMsg = targetAgent ? `@${targetAgent} /compact` : '/compact'
        send(compactMsg)
        break
      }
      case '/review': {
        const reviewAgentMatch = args?.match(/@(\w+)/)
        const reviewTarget = reviewAgentMatch?.[1] ?? 'woz'
        send(`@${reviewTarget} /review ${args?.replace(/@\w+/g, '').trim() ?? ''}`)
        break
      }
      case '/init': {
        const initAgentMatch = args?.match(/@(\w+)/)
        const initTarget = initAgentMatch?.[1] ?? 'woz'
        send(`@${initTarget} /init ${args?.replace(/@\w+/g, '').trim() ?? ''}`)
        break
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCommandIndex(i => Math.min(i + 1, filteredCommands.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCommandIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const cmd = filteredCommands[commandIndex]
        const args = input.replace(/^\/\w+/, '').trim()
        executeCommand(cmd, args)
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowCommands(false); return }
    }
    if (showMentions && filteredAgents.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredAgents.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const [id] = filteredAgents[mentionIndex]; if (id) insertMention(id); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowMentions(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    const cursorPos = e.target.selectionStart
    const beforeCursor = val.slice(0, cursorPos)
    const mentionMatch = beforeCursor.match(/@(\w*)$/)
    if (mentionMatch) { setShowMentions(true); setMentionFilter(mentionMatch[1].toLowerCase()); setMentionIndex(0); setShowCommands(false); return }
    const commandMatch = beforeCursor.match(/^\/(\w*)$/)
    if (commandMatch) { setShowCommands(true); setCommandFilter(commandMatch[1].toLowerCase()); setCommandIndex(0); setShowMentions(false); return }
    setShowMentions(false); setShowCommands(false)
  }

  const handleCreateWorkspace = () => {
    if (newWsPath.trim()) { createWorkspace(newWsPath.trim()); setNewWsPath(''); setShowWorkspaceMenu(false) }
  }

  const addSystemMessage = (content: string) => {
    setMessages(m => [...m, { id: `sys-${Date.now()}`, role: 'system' as const, content, timestamp: Date.now() }])
  }

  const TABS: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'agents', label: 'Agents', icon: '🤖' },
    { id: 'roles', label: 'Roles', icon: '👤' },
    { id: 'skills', label: 'Skills', icon: '⚡' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'cron', label: 'Cron', icon: '⏰' },
  ]

  return (
    <div className="h-screen flex bg-gray-950 text-gray-200">
      {/* ─── Left Sidebar ─── */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Brand */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          {!sidebarCollapsed && <h1 className="text-sm font-bold text-white tracking-wide">ParallaxAI</h1>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300">
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Workspace Selector */}
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-gray-800 relative flex-shrink-0">
            <button onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 text-sm">
              <span>📁</span>
              <span className="flex-1 text-left truncate">{activeWorkspace?.name ?? 'Select'}</span>
              <span className="text-gray-600 text-xs">▼</span>
            </button>
            {showWorkspaceMenu && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-30 max-h-60 overflow-y-auto">
                {workspaces.map(ws => (
                  <button key={ws.id} onClick={() => { switchWorkspace(ws.id); setShowWorkspaceMenu(false) }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 ${ws.id === activeWorkspace?.id ? 'bg-gray-700' : ''}`}>
                    <span className="text-gray-400">📁</span><span className="truncate">{ws.name}</span>
                  </button>
                ))}
                <div className="border-t border-gray-700 p-2">
                  <input type="text" value={newWsPath} onChange={e => setNewWsPath(e.target.value)}
                    placeholder="/path/to/project" className="w-full px-2 py-1 bg-gray-900 text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleCreateWorkspace()} />
                  <button onClick={handleCreateWorkspace} className="w-full mt-1 px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700">+ New</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="border-b border-gray-800 flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white border-l-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border-l-2 border-transparent'
              }`}>
              <span className="text-base">{tab.icon}</span>
              {!sidebarCollapsed && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Agent Status */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} py-3 flex-shrink-0`}>
          {!sidebarCollapsed && <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 px-1">Agents</div>}
          {Object.entries(AGENTS).map(([id, agent]) => (
            <div key={id} className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''} px-2 py-1.5 rounded hover:bg-gray-800/50`}>
              <span className="text-base">{agent.emoji}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="text-sm text-gray-300 flex-1">{agent.name}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    agents[id] === 'idle' ? 'bg-green-400' :
                    agents[id] === 'busy' ? 'bg-yellow-400 animate-pulse' :
                    agents[id] === 'error' ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Conversations */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto border-t border-gray-800 min-h-0">
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-gray-600 uppercase tracking-wider">Conversations</span>
              <button onClick={newConversation} className="text-xs text-blue-400 hover:text-blue-300">+ New</button>
            </div>
            {conversations.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-700 italic">No conversations</div>
            ) : (
              conversations.slice(0, 30).map(conv => (
                <button key={conv.id} onClick={() => switchConversation(conv.id)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-800/50 flex items-center gap-2 ${
                    conv.id === conversationId ? 'bg-gray-800 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                  }`}>
                  <span className="text-gray-600 text-xs">💬</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-300 truncate">{conv.title || 'Untitled'}</div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      {conv.workspaceName && <span className="text-gray-500">{conv.workspaceName}</span>}
                      {conv.workspaceName && <span>·</span>}
                      <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} py-2 border-t border-gray-800 flex-shrink-0`}>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''} text-xs`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {!sidebarCollapsed && <span className="text-gray-600">{connected ? 'Connected' : 'Disconnected'}</span>}
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-12 bg-gray-900/60 backdrop-blur border-b border-gray-800 flex items-center px-4 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">/</span>
            <span className="text-white font-medium capitalize">{activeTab}</span>
          </div>
          {activeTab === 'chat' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>•</span>
              <span>{conversationId.slice(0, 20)}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Tokens: {costSummary.today.totalTokens.toLocaleString()}</span>
            <span>Cost: ${costSummary.today.totalUsd.toFixed(4)}</span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !streaming && (
                  <div className="flex items-center justify-center h-full text-gray-600">
                    <div className="text-center">
                      <div className="text-5xl mb-3">🧠</div>
                      <div className="text-lg text-gray-400 mb-1">ParallaxAI</div>
                      <div className="text-sm">Send a message to start • @agent to mention • / for commands</div>
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-4 py-2.5 ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' :
                      msg.role === 'system' ? 'bg-gray-800/80 text-gray-400 text-sm border border-gray-700' :
                      `bg-gray-800 text-gray-200 border-l-2 ${msg.agentId ? AGENT_COLORS[msg.agentId] : 'border-gray-600'}`
                    }`}>
                      {msg.agentId && (
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <span>{AGENTS[msg.agentId]?.emoji}</span>
                          <span>{AGENTS[msg.agentId]?.name ?? msg.agentId}</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    </div>
                  </div>
                ))}

                {streaming && (
                  <div className="flex justify-start">
                    <div className={`max-w-[70%] rounded-lg px-4 py-2.5 bg-gray-800 border-l-2 ${AGENT_COLORS[streaming.agentId] ?? 'border-gray-600'}`}>
                      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <span>{AGENTS[streaming.agentId]?.emoji}</span>
                        <span>{AGENTS[streaming.agentId]?.name ?? streaming.agentId}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {streaming.content || <span className="animate-pulse text-gray-500">thinking...</span>}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="border-t border-gray-800 p-4 relative flex-shrink-0">
                {showCommands && filteredCommands.length > 0 && (
                  <div className="absolute bottom-full left-4 mb-2 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl z-10 w-72 max-h-52 overflow-y-auto">
                    {filteredCommands.map((cmd, idx) => (
                      <button key={cmd.name} onClick={() => executeCommand(cmd, input.replace(/^\/\w+/, '').trim())}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 ${idx === commandIndex ? 'bg-gray-700' : ''}`}>
                        <span>{cmd.icon}</span>
                        <span className="text-sm font-mono text-blue-300">{cmd.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">{cmd.description}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showMentions && filteredAgents.length > 0 && (
                  <div className="absolute bottom-full left-4 mb-2 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl z-10">
                    {filteredAgents.map(([id, agent], idx) => (
                      <button key={id} onClick={() => insertMention(id)}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 ${idx === mentionIndex ? 'bg-gray-700' : ''}`}>
                        <span>{agent.emoji}</span>
                        <span className="text-sm text-gray-200">@{id}</span>
                        <span className="text-xs text-gray-500 ml-auto">{agent.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
                    placeholder="Type a message... @agent or /commands" rows={1}
                    className="flex-1 bg-gray-800 text-gray-200 rounded-lg px-4 py-2.5 resize-none border border-gray-700 focus:border-blue-500 focus:outline-none text-sm" />
                  {streaming ? (
                    <button onClick={cancel} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">Cancel</button>
                  ) : (
                    <button onClick={handleSend} disabled={!connected || !input.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 text-sm">Send</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg font-bold text-white mb-4">Agent Status</h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(AGENTS).map(([id, agent]) => (
                  <div key={id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{agent.emoji}</span>
                      <div className="flex-1">
                        <div className="text-white font-medium">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.role}</div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        agents[id] === 'idle' ? 'bg-green-400' :
                        agents[id] === 'busy' ? 'bg-yellow-400 animate-pulse' :
                        agents[id] === 'error' ? 'bg-red-400' : 'bg-gray-600'
                      }`} />
                    </div>
                    <div className="text-xs text-gray-500">Status: {agents[id] ?? 'offline'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'roles' && <RolesPage />}

        {activeTab === 'skills' && <SkillsPage />}

          {activeTab === 'tasks' && (
            <DelegationBoard tasks={delegationTasks} onRefresh={refreshDelegationTasks} />
          )}

          {activeTab === 'cron' && (
            <CronBoard
              jobs={cronJobs} runs={cronRuns} onRefresh={refreshCronData}
              onAdd={addCronJob} onRemove={removeCronJob}
              onToggle={toggleCronJob} onRun={runCronJob}
            />
          )}
        </div>
      </main>
    </div>
  )
}
