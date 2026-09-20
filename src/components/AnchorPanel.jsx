import React, { useState } from 'react';
import { Plus, Trash2, Radio } from 'lucide-react';

export default function AnchorPanel({ anchors, onAddAnchor, onDeleteAnchor }) {
  const [name, setName] = useState('');
  const [x, setX] = useState(20);
  const [y, setY] = useState(20);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddAnchor({ name: name.trim(), x: Number(x), y: Number(y) });
    setName('');
  };

  return (
    <div className="space-y-6">
      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-4 flex items-center space-x-2">
          <Plus className="w-4 h-4 text-cyber-cyan" />
          <span>Deploy New Anchor Node</span>
        </h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <input type="text" placeholder="Anchor ID (e.g. A5)" value={name} onChange={e => setName(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <input type="number" min="0" max="50" placeholder="X (0-50m)" value={x} onChange={e => setX(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <input type="number" min="0" max="50" placeholder="Y (0-50m)" value={y} onChange={e => setY(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <button type="submit" className="py-2 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/30 rounded font-bold">DEPLOY</button>
        </form>
      </div>

      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-3">Configured Anchors ({anchors.length})</h3>
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-charcoal-850 text-slate-400 border-b border-charcoal-700">
            <tr>
              <th className="p-2.5">ID</th><th className="p-2.5">Position</th><th className="p-2.5">RSSI</th><th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800">
            {anchors.map(a => (
              <tr key={a.id}>
                <td className="p-2.5 font-bold text-lavender-400">{a.name || a.id}</td>
                <td className="p-2.5 text-slate-300">({a.x}m, {a.y}m)</td>
                <td className="p-2.5 text-cyber-cyan">{a.rssi ?? '--'} dBm</td>
                <td className="p-2.5 text-right">
                  <button onClick={() => onDeleteAnchor(a.id)} className="text-slate-500 hover:text-cyber-rose"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
