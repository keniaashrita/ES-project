import React, { useState } from 'react';
import { Radio, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';

export default function AnchorPanel({ anchors, onAddAnchor, onDeleteAnchor, onUpdateAnchor }) {
  const [newAnchorName, setNewAnchorName] = useState('');
  const [newAnchorX, setNewAnchorX] = useState(20);
  const [newAnchorY, setNewAnchorY] = useState(20);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newAnchorName.trim()) return;
    onAddAnchor({
      name: newAnchorName.trim(),
      x: Number(newAnchorX),
      y: Number(newAnchorY)
    });
    setNewAnchorName('');
  };

  return (
    <div className="space-y-6">
      {/* Minimum Anchor Constraint Warning */}
      {anchors.length < 3 && (
        <div className="p-4 rounded-xl bg-cyber-rose/10 border border-cyber-rose/30 flex items-center space-x-3 text-cyber-rose text-sm font-mono">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Insufficient anchors for 2D trilateration. Minimum 3 required!</span>
        </div>
      )}

      {/* Add New Anchor Form */}
      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-4 flex items-center space-x-2">
          <Plus className="w-4 h-4 text-cyber-cyan" />
          <span>Deploy New LoRa Anchor Node</span>
        </h3>

        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">Anchor Name / ID</label>
            <input
              type="text"
              placeholder="e.g. A5"
              value={newAnchorName}
              onChange={e => setNewAnchorName(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">X Position (0-50m)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={newAnchorX}
              onChange={e => setNewAnchorX(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Y Position (0-50m)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={newAnchorY}
              onChange={e => setNewAnchorY(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/30 rounded font-bold transition flex items-center justify-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>DEPLOY ANCHOR</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Anchors Table */}
      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-3 flex items-center space-x-2">
          <Radio className="w-4 h-4 text-lavender-400" />
          <span>Configured Anchor Nodes ({anchors.length} Active)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-charcoal-850 text-slate-400 uppercase border-b border-charcoal-700">
              <tr>
                <th className="py-2.5 px-3">Node ID</th>
                <th className="py-2.5 px-3">Coordinate X</th>
                <th className="py-2.5 px-3">Coordinate Y</th>
                <th className="py-2.5 px-3">Measured RSSI</th>
                <th className="py-2.5 px-3">Est. Distance</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {anchors.map(a => (
                <tr key={a.id} className="hover:bg-charcoal-800/40">
                  <td className="py-2.5 px-3 font-bold text-lavender-400">{a.name || a.id}</td>
                  <td className="py-2.5 px-3 text-slate-200">{a.x} m</td>
                  <td className="py-2.5 px-3 text-slate-200">{a.y} m</td>
                  <td className="py-2.5 px-3 text-cyber-cyan font-bold">{a.rssi ?? '--'} dBm</td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {a.estimatedDistance ? `${a.estimatedDistance.toFixed(2)} m` : '--'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-cyber-green/10 text-cyber-green border border-cyber-green/30">
                      ONLINE
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onDeleteAnchor(a.id)}
                      className="text-slate-500 hover:text-cyber-rose p-1 transition"
                      title="Delete Anchor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}