
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
                                {agent.name || "Unknown Product"}
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
                                Config
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
    // In a real app, fetch logs from a subcollection here using useEffect
    return (
        <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">Recent activity for <span className="text-white font-mono">{agent.name}</span></p>
            {/* Placeholder logs */}
            {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 text-sm border-l-2 border-white/10 pl-4 py-1">
                    <span className="text-gray-500 font-mono text-xs">2026-02-10 10:{30 + i}:00</span>
                    <span className="text-gray-300">Checked URL, price not found.</span>
                </div>
            ))}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-sm">
                Note: Logs are being generated by the backend but not wired up to this view yet.
            </div>
        </div>
    )
}

function ConfigView({ agent, onUpdateStatus, onDelete }) {
    return (
        <div className="space-y-6">
            <div>
                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Status Control</label>
                <div className="flex gap-3">
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
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Check Type</label>
                        <input type="text" readOnly value={agent.checkType || 'KEYWORD_MISSING'} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono" />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Frequency</label>
                        <input type="text" readOnly value={`${agent.frequency || 5} min`} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono" />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Target URL</label>
                    <input type="text" readOnly value={agent.url} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono" />
                </div>

                {agent.thumbnail && (
                    <div>
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Thumbnail Preview</label>
                        <img src={agent.thumbnail} className="h-24 rounded-lg border border-white/10" alt="Preview" />
                    </div>
                )}
            </div>
        </div>
    )
}
