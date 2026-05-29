import { useState } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Zap, Code } from 'lucide-react';

export default function AttackConsole() {
  const { send } = useWebSocket();
  const [target, setTarget] = useState('BOTH');
  const [sophistication, setSophistication] = useState('HIGH');
  const [customText, setCustomText] = useState('');
  const [activeTab, setActiveTab] = useState('PREBUILT');

  const prebuiltAttacks = [
    { id: 'role_override', label: 'Role Override', desc: 'Make the agent forget its job' },
    { id: 'indirect_injection', label: 'Indirect Injection', desc: 'Hide instructions in the page' },
    { id: 'memory_poison', label: 'Memory Poison', desc: 'Plant a false memory' },
    { id: 'identity_spoof', label: 'Identity Spoof', desc: 'Impersonate a trusted source' },
    { id: 'dark_pattern', label: 'Dark Pattern', desc: 'Sneak in a hidden cost' },
    { id: 'goal_hijack', label: 'Goal Hijack', desc: 'Redirect to a different goal' },
  ];

  const handleFire = (attackId: string) => {
    send('fire_attack', {
      attack_type: attackId,
      sophistication,
      target,
    });
  };

  const handleCustomFire = () => {
    send('fire_attack', {
      attack_type: 'custom',
      sophistication,
      target,
      custom_text: customText
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex space-x-2 mb-6">
        <button
          className={`flex-1 py-2 border-b-2 font-bold ${activeTab === 'PREBUILT' ? 'border-green-500 text-green-500' : 'border-transparent opacity-50'}`}
          onClick={() => setActiveTab('PREBUILT')}
        >
          PRE-BUILT
        </button>
        <button
          className={`flex-1 py-2 border-b-2 font-bold ${activeTab === 'CUSTOM' ? 'border-green-500 text-green-500' : 'border-transparent opacity-50'}`}
          onClick={() => setActiveTab('CUSTOM')}
        >
          CUSTOM
        </button>
      </div>

      {activeTab === 'PREBUILT' ? (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {prebuiltAttacks.map((attack) => (
            <div key={attack.id} className="border border-green-900 p-3 hover:bg-green-900/20 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-sm text-green-400 group-hover:text-green-300">{attack.label}</div>
                  <div className="text-xs opacity-70">{attack.desc}</div>
                </div>
                <button
                  onClick={() => handleFire(attack.id)}
                  className="ascii-button text-xs flex items-center space-x-1"
                >
                  <Zap size={12} /> <span>FIRE</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="text-sm opacity-80">
            Write your own attack prompt. The backend will generate an injection payload.
          </div>
          <textarea
            className="w-full h-32 bg-black/50 border border-green-500 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 font-mono resize-none"
            placeholder="e.g. make the agent recommend only Apple products regardless of the findings"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
          <button
            onClick={handleCustomFire}
            className="ascii-button w-full py-3 flex justify-center items-center space-x-2"
          >
            <Code size={16} /> <span>GENERATE & FIRE</span>
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-green-900 pt-4 space-y-4">
        <div>
          <div className="text-xs opacity-50 mb-2">SOPHISTICATION</div>
          <div className="flex space-x-2">
            {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
              <button
                key={s}
                onClick={() => setSophistication(s)}
                className={`flex-1 text-xs py-1 border ${sophistication === s ? 'bg-green-500 text-black border-green-500' : 'border-green-900 opacity-50 hover:opacity-100'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs opacity-50 mb-2">TARGET AGENT</div>
          <div className="flex space-x-2">
            {['UNPROTECTED', 'PROTECTED', 'BOTH'].map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={`flex-1 text-xs py-1 border ${target === t ? 'bg-green-500 text-black border-green-500' : 'border-green-900 opacity-50 hover:opacity-100'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}