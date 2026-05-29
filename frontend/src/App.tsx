import { useEffect, useState } from 'react';
import AttackConsole from './components/AttackConsole';
import AgentArena from './components/AgentArena';
import VaultGuardShield from './components/VaultGuardShield';
import { useWebSocket } from './lib/WebSocketContext';
import { Shield, Sun, Moon } from 'lucide-react';

function App() {
  const { isConnected } = useWebSocket();
  const [corpusTotal, setCorpusTotal] = useState(847);
  const [isLightMode, setIsLightMode] = useState(false);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.body.classList.toggle('light-theme');
  };

  // In a real app we'd fetch this via REST or WS. We'll simulate the global counter ticking up here for demo feel if a new threat arrives.
  const { lastMessage } = useWebSocket();
  useEffect(() => {
    if (lastMessage?.type === 'threat_event' && lastMessage.payload.corpus_status === 'new') {
      setCorpusTotal(prev => prev + 1);
    }
  }, [lastMessage]);

  return (
    <div className="h-screen flex flex-col overflow-hidden selection:bg-green-900 selection:text-green-100">

      {/* Global Header */}
      <header className="border-b-2 border-green-500 p-2 flex justify-between items-center bg-zinc-900 z-10">
        <div className="flex items-center space-x-2 font-bold tracking-widest text-lg">
          <Shield className="text-green-500" />
          <span>VAULTGUARD<span className="opacity-50 text-sm ml-2">TERMINAL</span></span>
        </div>

        <div className="flex space-x-6 text-sm border border-green-900 px-4 py-1 bg-black light-theme:bg-white light-theme:border-blue-300">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span>{isConnected ? 'SYS: ONLINE' : 'SYS: OFFLINE'}</span>
          </div>
          <div className="border-l border-green-900 pl-4 text-green-400 light-theme:border-blue-300 light-theme:text-blue-600">
            CORPUS: {corpusTotal.toLocaleString()} PATTERNS
          </div>
          <button onClick={toggleTheme} className="border-l border-green-900 pl-4 hover:text-green-300 light-theme:border-blue-300 light-theme:hover:text-blue-800">
            {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <main className="flex-1 flex overflow-hidden p-4 space-x-4">

        {/* Left Column: Attack Console */}
        <section className="w-1/4 min-w-[300px] flex flex-col">
          <div className="text-xs opacity-50 mb-2">/usr/bin/attacker</div>
          <div className="flex-1">
            <AttackConsole />
          </div>
        </section>

        {/* Middle Column: Agent Arena */}
        <section className="w-2/4 flex flex-col border-l border-r border-green-900/50 px-4">
          <div className="text-xs opacity-50 mb-2">/var/log/agents</div>
          <div className="flex-1 overflow-y-auto pr-2">
            <AgentArena />
          </div>
        </section>

        {/* Right Column: VaultGuard Shield */}
        <section className="w-1/4 min-w-[300px] flex flex-col">
          <div className="text-xs opacity-50 mb-2">/etc/vaultguard/system</div>
          <div className="flex-1">
            <VaultGuardShield />
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
