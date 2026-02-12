
import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { signOut } from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext'
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
    const { currentUser } = useAuth()
    const navigate = useNavigate()
    const [agents, setAgents] = useState([])
    const [loading, setLoading] = useState(true)

    // Modal states
    const [selectedAgent, setSelectedAgent] = useState(null)
    const [modalType, setModalType] = useState(null) // 'LOGS' or 'CONFIG'

    useEffect(() => {
        if (!currentUser) return;

        const agentsRef = collection(db, 'users', currentUser.uid, 'agents');
        // const q = query(agentsRef, orderBy('createdAt', 'desc')); // Requires index, use simple query first
        const q = query(agentsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const agentList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAgents(agentList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching agents:", error);
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleOpenLogs = (agent) => {
        setSelectedAgent(agent);
        setModalType('LOGS');
    };

    const handleOpenConfig = (agent) => {
        setSelectedAgent(agent);
        setModalType('CONFIG');
    };

    const handleCloseModal = () => {
        setSelectedAgent(null);
        setModalType(null);
    };

    const handleUpdateStatus = async (agentId, newStatus) => {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid, 'agents', agentId), {
                status: newStatus
            });
            if (selectedAgent && selectedAgent.id === agentId) {
                setSelectedAgent(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        }
    };

    const handleDeleteAgent = async (agentId) => {
        if (!confirm("Are you sure you want to delete this agent?")) return;
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'agents', agentId));
            handleCloseModal();
        } catch (err) {
            console.error(err);
            alert("Failed to delete agent");
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 relative overflow-hidden font-display">
            {/* Dynamic background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/40 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/30 rounded-full blur-[120px]"></div>
            </div>

            <header className="relative z-10 mb-12 flex justify-between items-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Rotom Dashboard
                    </h1>
                    {currentUser && <p className="text-gray-400 text-sm mt-1 font-medium tracking-wide">
                        Connected as <span className="text-blue-400">{currentUser.email}</span>
                    </p>}
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/deploy')}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-95 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Deploy Agent
                    </button>
                    <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors border border-white/5 font-medium backdrop-blur-md">
                        Logout
                    </button>
                </div>
            </header>

            <main className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                    <div key={agent.id} className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden">

                        {/* Thumbnail Background Effect */}
                        {agent.thumbnail && (
                            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                <img src={agent.thumbnail} alt="" className="w-full h-full object-cover mask-image-linear-to-l" />
                                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#111]"></div>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            {/* Status logic */}
                            <span className={`inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border 
                                ${agent.status === 'ENABLED'
                                    ? (agent.lastChecked ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse')
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'}
                            `}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${agent.status === 'ENABLED'
                                        ? (agent.lastChecked ? 'bg-green-400 animate-pulse' : 'bg-blue-400 animate-pulse')
                                        : 'bg-red-400'
                                    }`}></span>
                                {agent.status === 'ENABLED' && !agent.lastChecked ? 'INITIALIZING' : agent.status}
                            </span>
                            <span className="text-white/30 text-xs font-mono bg-black/20 px-2 py-1 rounded-md border border-white/5 hover:text-white cursor-help" title={agent.id}>
                                ID
                            </span>
                        </div>

                        <div className="mb-6 relative z-10">
                            <h3 className="font-semibold text-white/90 truncate mb-1 text-lg group-hover:text-blue-400 transition-colors">
                                {agent.alias || agent.name || "Unknown Product"}
                            </h3>
                            <a href={agent.url} target="_blank" rel="noreferrer" className="text-gray-500 text-xs truncate font-mono hover:underline hover:text-blue-400 flex items-center gap-1">
                                {new URL(agent.url).hostname}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 relative z-10">
                            <div>
                                <span className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider">Last Check</span>
                                <span className="text-white font-medium">
                                    {agent.lastChecked ? new Date(agent.lastChecked.toDate()).toLocaleString() : 'Waiting...'}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="block text-gray-500 text-[10px] uppercase font-bold tracking-wider">Result</span>
                                <span className={`font-bold ${agent.lastResult === 'IN_STOCK' ? 'text-green-400' : 'text-orange-400'}`}>
                                    {agent.lastResult || '-'}
                                </span>
                            </div>
                        </div>

                        <div className="flex space-x-3 relative z-10">
                            <button
                                onClick={() => handleOpenLogs(agent)}
                                className="flex-1 bg-white/5 border border-white/10 text-gray-300 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
                            >
                                Logs
                            </button>
                            <button
                                onClick={() => handleOpenConfig(agent)}
                                className="flex-1 bg-white/5 border border-white/10 text-gray-300 py-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
                            >
                                Configure
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => navigate('/deploy')}
                    className="bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 transition-all group h-full min-h-[260px]"
                >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all text-white/30">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <span className="text-gray-400 font-medium group-hover:text-white transition-colors">Deploy New Agent</span>
                </button>
            </main>

            {/* Modals */}
            {selectedAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCloseModal}></div>
                    <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col relative z-10 shadow-2xl">

                        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-white/5">
                            <h2 className="text-xl font-bold text-white">
                                {modalType === 'LOGS' ? 'Agent Logs' : 'Agent Configuration'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {modalType === 'LOGS' ? (
                                <LogsView agent={selectedAgent} />
                            ) : (
                                <ConfigView
                                    agent={selectedAgent}
                                    onUpdateStatus={handleUpdateStatus}
                                    onDelete={handleDeleteAgent}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function LogsView({ agent }) {
    const { currentUser } = useAuth();
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || !agent.id) return;

        const logsRef = collection(db, 'users', currentUser.uid, 'agents', agent.id, 'logs');
        const logsQuery = query(logsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
            const logList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLogs(logList);
            setLogsLoading(false);
        }, (error) => {
            console.error("Error fetching logs:", error);
            setLogsLoading(false);
        });

        return unsubscribe;
    }, [currentUser, agent.id]);

    if (logsLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-gray-400">Loading logs...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">Check history for <span className="text-white font-semibold">{agent.alias || agent.name}</span></p>
            
            {logs.length === 0 ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm">
                    No logs yet. Agent checks will appear here as they run.
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map(log => (
                        <div key={log.id} className="flex items-start gap-4 text-sm border-l-2 border-white/10 pl-4 py-2">
                            <div className="flex-shrink-0">
                                <span className="text-gray-500 font-mono text-xs whitespace-nowrap">
                                    {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : 'Unknown'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md ${
                                        log.result === 'IN_STOCK' 
                                            ? 'bg-green-500/20 text-green-300' 
                                            : log.result === 'OUT_OF_STOCK'
                                            ? 'bg-orange-500/20 text-orange-300'
                                            : 'bg-red-500/20 text-red-300'
                                    }`}>
                                        {log.result}
                                    </span>
                                    {log.httpStatus && (
                                        <span className="text-gray-500 text-xs">HTTP {log.httpStatus}</span>
                                    )}
                                </div>
                                <p className="text-gray-300 text-xs break-words">{log.message || 'Check completed'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function ConfigView({ agent, onUpdateStatus, onDelete }) {
    const { currentUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit state - all fields
    const [editedUrl, setEditedUrl] = useState(agent.url);
    const [editedAlias, setEditedAlias] = useState(agent.alias || agent.name || '');
    const [editedFrequency, setEditedFrequency] = useState(agent.frequency || 5);
    const [editedCheckType, setEditedCheckType] = useState(agent.checkType || 'KEYWORD_MISSING');
    const [editedKeywords, setEditedKeywords] = useState(agent.keywords || '');
    const [editedSelector, setEditedSelector] = useState(agent.selector || '');
    const [editedCondition, setEditedCondition] = useState(agent.condition || 'EQUALS');
    const [editedExpectedValue, setEditedExpectedValue] = useState(agent.expectedValue || '');
    const [editedAutoCheckout, setEditedAutoCheckout] = useState(agent.autoCheckout || false);
    const [saving, setSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = {
                alias: editedAlias || agent.name,
                url: editedUrl,
                frequency: parseInt(editedFrequency),
                checkType: editedCheckType,
                autoCheckout: editedAutoCheckout
            };

            if (editedCheckType === 'SELECTOR') {
                updates.selector = editedSelector;
                updates.condition = editedCondition;
                updates.expectedValue = editedExpectedValue;
                if (!editedSelector) throw new Error("CSS Selector is required for Selector check type");
            } else {
                updates.keywords = editedKeywords;
            }

            await updateDoc(doc(db, 'users', currentUser.uid, 'agents', agent.id), updates);
            setIsEditing(false);
            alert('Agent configuration updated successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to update agent: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Status Control</label>
                <div className="flex gap-3 flex-wrap">
                    {agent.status !== 'ENABLED' && (
                        <button
                            onClick={() => onUpdateStatus(agent.id, 'ENABLED')}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            Enable Agent
                        </button>
                    )}
                    {agent.status === 'ENABLED' && (
                        <button
                            onClick={() => onUpdateStatus(agent.id, 'DISABLED')}
                            className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            Disable Agent
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(agent.id)}
                        className="bg-red-900/50 hover:bg-red-900 text-red-200 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-red-500/20"
                    >
                        Delete Agent
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
                {!isEditing ? (
                    <>
                        {/* Display Mode */}
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Agent Name</label>
                            <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">{editedAlias}</div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Target URL</label>
                            <a href={agent.url} target="_blank" rel="noreferrer" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-blue-400 text-sm font-mono hover:underline block truncate">{agent.url}</a>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Frequency</label>
                                <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm">{editedFrequency} min</div>
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Type</label>
                                <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono">{editedCheckType}</div>
                            </div>
                        </div>

                        {editedCheckType !== 'SELECTOR' && editedKeywords && (
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Keywords</label>
                                <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm">{editedKeywords}</div>
                            </div>
                        )}

                        {editedCheckType === 'SELECTOR' && (
                            <>
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">CSS Selector</label>
                                    <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono">{editedSelector}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Condition</label>
                                        <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm">{editedCondition}</div>
                                    </div>
                                    {editedCondition !== 'EXISTS' && (
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Expected Value</label>
                                            <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm">{editedExpectedValue}</div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Auto Checkout</label>
                            <div className="flex items-center gap-3 p-3 bg-black/20 border border-white/10 rounded-lg">
                                <div className={`w-5 h-5 rounded border ${editedAutoCheckout ? 'bg-blue-600 border-blue-500' : 'border-white/10'}`}>
                                    {editedAutoCheckout && (
                                        <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    )}
                                </div>
                                <span className="text-gray-300 text-sm">{editedAutoCheckout ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all mt-4"
                        >
                            Edit Configuration
                        </button>
                    </>
                ) : (
                    <>
                        {/* Edit Mode */}
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Agent Name</label>
                            <input
                                type="text"
                                value={editedAlias}
                                onChange={(e) => setEditedAlias(e.target.value)}
                                placeholder="e.g., Nike Shoes Stock Tracker"
                                className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Target URL</label>
                            <input
                                type="url"
                                value={editedUrl}
                                onChange={(e) => setEditedUrl(e.target.value)}
                                className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Frequency</label>
                                <select
                                    value={editedFrequency}
                                    onChange={(e) => setEditedFrequency(e.target.value)}
                                    className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    {['1', '5', '15', '30', '60'].map(min => (
                                        <option key={min} value={min}>{min} min</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Type</label>
                                <select
                                    value={editedCheckType}
                                    onChange={(e) => setEditedCheckType(e.target.value)}
                                    className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="KEYWORD_MISSING">Standard (Missing Keywords)</option>
                                    <option value="KEYWORD_PRESENT">Positive Match (Found Keywords)</option>
                                    <option value="SELECTOR">CSS Selector (Advanced)</option>
                                </select>
                            </div>
                        </div>

                        {editedCheckType !== 'SELECTOR' && (
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
                                    {editedCheckType === 'KEYWORD_MISSING' ? "Keywords to AVOID (comma separated)" : "Keywords to FIND (comma separated)"}
                                </label>
                                <input
                                    type="text"
                                    value={editedKeywords}
                                    onChange={(e) => setEditedKeywords(e.target.value)}
                                    placeholder={editedCheckType === 'KEYWORD_MISSING' ? "out of stock, sold out" : "add to cart, buy now"}
                                    className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>
                        )}

                        {editedCheckType === 'SELECTOR' && (
                            <div className="space-y-4 p-4 bg-black/20 border border-white/10 rounded-xl">
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">CSS Selector</label>
                                    <input
                                        type="text"
                                        value={editedSelector}
                                        onChange={(e) => setEditedSelector(e.target.value)}
                                        placeholder="#add-to-cart-button or .stock-status"
                                        className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Condition</label>
                                        <select
                                            value={editedCondition}
                                            onChange={(e) => setEditedCondition(e.target.value)}
                                            className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        >
                                            <option value="EQUALS">Text Equals</option>
                                            <option value="NOT_EQUALS">Text Not Equals</option>
                                            <option value="CONTAINS">Text Contains</option>
                                            <option value="EXISTS">Element Exists</option>
                                        </select>
                                    </div>
                                    {editedCondition !== 'EXISTS' && (
                                        <div>
                                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Expected Value</label>
                                            <input
                                                type="text"
                                                value={editedExpectedValue}
                                                onChange={(e) => setEditedExpectedValue(e.target.value)}
                                                placeholder="In Stock"
                                                className="w-full bg-black/40 border border-blue-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Auto Checkout Toggle */}
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Checkout Options</label>
                            <div
                                onClick={() => setEditedAutoCheckout(!editedAutoCheckout)}
                                className="flex items-center justify-between p-3 bg-black/40 border border-blue-500/50 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                            >
                                <span className="text-gray-300 text-sm font-medium">Auto Checkout When In Stock</span>
                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${editedAutoCheckout ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>
                                    {editedAutoCheckout && (
                                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-500 text-xs mt-1 ml-1">Currently disabled for testing</p>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}

                {agent.thumbnail && !isEditing && (
                    <div className="pt-4 border-t border-white/10">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Thumbnail Preview</label>
                        <img src={agent.thumbnail} className="h-24 rounded-lg border border-white/10 object-cover" alt="Preview" />
                    </div>
                )}
            </div>
        </div>
    )
}
