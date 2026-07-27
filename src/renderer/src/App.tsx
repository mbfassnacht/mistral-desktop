import { useState } from 'react'
import SettingsModal from './components/SettingsModal'
import ChatWindow from './components/ChatWindow'
import Sidebar from './components/Sidebar'
import { ChatProvider } from './state/ChatContext'

function App(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <ChatProvider>
      <div className="app-shell">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <main className="app-main">
          <ChatWindow />
        </main>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    </ChatProvider>
  )
}

export default App
