
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function DeployAgent() {
    const navigate = useNavigate();
    const [url, setUrl] = useState('');
    const [alias, setAlias] = useState('');
    const [frequency, setFrequency] = useState('5');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Advanced Settings
    const [checkType, setCheckType] = useState('KEYWORD_MISSING'); // KEYWORD_MISSING, KEYWORD_PRESENT, SELECTOR
    const [keywords, setKeywords] = useState('');
    const [selector, setSelector] = useState('');
    const [condition, setCondition] = useState('EQUALS'); // EQUALS, NOT_EQUALS, CONTAINS
    const [expectedValue, setExpectedValue] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [autoCheckout, setAutoCheckout] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!url) {
            setError('URL is required');
            setLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                setError('You must be logged in');
                setLoading(false);
                return;
            }

            // Construct payload based on check type
            const payload = {
                url,
                alias: alias || new URL(url).hostname, // Use alias if provided, fallback to hostname
                frequency: parseInt(frequency),
                status: 'ENABLED', // Defaults to ENABLED now
                createdAt: serverTimestamp(),
                lastChecked: null,
                name: new URL(url).hostname,
                checkType,
                autoCheckout
            };

            if (checkType === 'SELECTOR') {
                payload.selector = selector;
                payload.condition = condition;
                payload.expectedValue = expectedValue;
                if (!selector) throw new Error("CSS Selector is required for Selector check type");
            } else {
                // Keywords
                payload.keywords = keywords;
            }

            await addDoc(collection(db, 'users', user.uid, 'agents'), payload);

            navigate('/');
        } catch (err) {
            console.error(err);
            setError('Failed to deploy agent: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-display relative overflow-hidden flex items-center justify-center">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Deploy New Agent
                    </h1>
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Target URL</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/product/123"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Agent Name (Alias)</label>
                        <input
                            type="text"
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder="e.g., Nike Shoes Stock Tracker"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                        />
                        <p className="text-gray-500 text-xs ml-1">Leave blank to auto-use the domain name</p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Check Frequency</label>
                        <div className="grid grid-cols-5 gap-2">
                            {['1', '5', '15', '30', '60'].map((mins) => (
                                <button
                                    key={mins}
                                    type="button"
                                    onClick={() => setFrequency(mins)}
                                    className={`px-2 py-2 rounded-xl border text-sm font-medium transition-all ${frequency === mins
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {mins}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Advanced Toggle */}
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <span className="mr-2">{showAdvanced ? 'Hide' : 'Show'} Advanced Configuration</span>
                            <svg className={`w-4 h-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                    </div>

                    {/* Advanced Configuration Section */}
                    {showAdvanced && (
                        <div className="space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="space-y-2">
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Check Logic</label>
                                <select
                                    value={checkType}
                                    onChange={(e) => setCheckType(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                    <option value="KEYWORD_MISSING">Standard (Missing Keywords)</option>
                                    <option value="KEYWORD_PRESENT">Positive Match (Found Keywords)</option>
                                    <option value="SELECTOR">CSS Selector (Advanced)</option>
                                </select>
                                <p className="text-gray-500 text-xs ml-1">
                                    {checkType === 'KEYWORD_MISSING' && "In Stock if specific keywords (e.g. 'Out of Stock') are NOT found."}
                                    {checkType === 'KEYWORD_PRESENT' && "In Stock if specific keywords (e.g. 'Add to Cart') ARE found."}
                                    {checkType === 'SELECTOR' && "In Stock if a specific HTML element matches a condition."}
                                </p>
                            </div>

                            {checkType !== 'SELECTOR' && (
                                <div className="space-y-2">
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">
                                        {checkType === 'KEYWORD_MISSING' ? "Keywords to AVOID (comma separated)" : "Keywords to FIND (comma separated)"}
                                    </label>
                                    <input
                                        type="text"
                                        value={keywords}
                                        onChange={(e) => setKeywords(e.target.value)}
                                        placeholder={checkType === 'KEYWORD_MISSING' ? "out of stock, sold out" : "add to cart, buy now"}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                            )}

                            {checkType === 'SELECTOR' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">CSS Selector</label>
                                        <input
                                            type="text"
                                            value={selector}
                                            onChange={(e) => setSelector(e.target.value)}
                                            placeholder="#add-to-cart-button or .stock-status"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Condition</label>
                                            <select
                                                value={condition}
                                                onChange={(e) => setCondition(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            >
                                                <option value="EQUALS">Text Equals</option>
                                                <option value="NOT_EQUALS">Text Not Equals</option>
                                                <option value="CONTAINS">Text Contains</option>
                                                <option value="EXISTS">Element Exists</option>
                                            </select>
                                        </div>
                                        {condition !== 'EXISTS' && (
                                            <div className="space-y-2">
                                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Expected Value</label>
                                                <input
                                                    type="text"
                                                    value={expectedValue}
                                                    onChange={(e) => setExpectedValue(e.target.value)}
                                                    placeholder="In Stock"
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Auto Checkout Toggle */}
                    <div className="pt-2 border-t border-white/10">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider ml-1 mb-3">Checkout Options</label>
                        <div
                            onClick={() => setAutoCheckout(!autoCheckout)}
                            className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded-xl cursor-pointer hover:bg-black/30 hover:border-white/20 transition-all"
                        >
                            <div>
                                <span className="text-gray-300 font-medium block">Auto Checkout When In Stock</span>
                                <span className="text-gray-500 text-xs">Currently disabled for testing</span>
                            </div>
                            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all flex-shrink-0 ${autoCheckout ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>
                                {autoCheckout && (
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.6)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-t border-white/20"
                        >
                            {loading ? 'Deploying...' : 'Deploy Agent'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
