import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function Settings() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [cardNumber, setCardNumber] = useState('');
    const [cvc, setCvc] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [isPrepaid, setIsPrepaid] = useState(false);
    const [balance, setBalance] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Camera scan state
    const [isScanning, setIsScanning] = useState(false);
    
    // Notifications state
    const [activeTab, setActiveTab] = useState('payment'); // 'payment' or 'notifications'
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookType, setWebhookType] = useState('');
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [savingWebhook, setSavingWebhook] = useState(false);

    // Fetch payment methods
    useEffect(() => {
        if (!currentUser) return;

        const methodsRef = collection(db, 'users', currentUser.uid, 'paymentMethods');
        const q = query(methodsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const methods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPaymentMethods(methods);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching payment methods:", error);
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    // Fetch webhook URL
    useEffect(() => {
        if (!currentUser) return;

        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setWebhookUrl(data.notificationWebhook || '');
                detectWebhookType(data.notificationWebhook || '');
            }
        }, (error) => {
            console.error("Error fetching webhook:", error);
        });

        return unsubscribe;
    }, [currentUser]);

    // Fetch webhook settings
    useEffect(() => {
        if (!currentUser) return;

        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setWebhookUrl(data.notificationWebhook || '');
                setWebhookType(detectWebhookType(data.notificationWebhook || ''));
            }
        }, (error) => {
            console.error("Error fetching webhook settings:", error);
        });

        return unsubscribe;
    }, [currentUser]);

    // Detect webhook type from URL
    const detectWebhookType = (url) => {
        if (!url) return '';
        if (url.includes('discord.com')) return 'Discord';
        if (url.includes('hooks.slack.com')) return 'Slack';
        return 'Generic';
    };

    const handleSaveCard = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Validate card data
            if (!cardNumber || !cvc || !expiry || !cardholderName) {
                throw new Error("All card fields are required");
            }

            // Extract last 4 digits
            const last4 = cardNumber.replace(/\s/g, '').slice(-4);

            // Call Firebase Function to encrypt and store
            const functions = getFunctions();
            const addPaymentMethod = httpsCallable(functions, 'addPaymentMethod');
            
            const payload = {
                cardNumber: cardNumber.replace(/\s/g, ''),
                cvc,
                expiry,
                cardholderName,
                last4,
                isPrepaid,
                balance: isPrepaid ? parseFloat(balance) || 0 : null
            };

            if (editingId) {
                // Update existing card
                const updatePaymentMethod = httpsCallable(functions, 'updatePaymentMethod');
                await updatePaymentMethod({ methodId: editingId, ...payload });
            } else {
                // Add new card
                await addPaymentMethod(payload);
            }

            // Reset form
            resetForm();
            alert(editingId ? 'Card updated successfully!' : 'Card added successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save card: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditCard = (method) => {
        setEditingId(method.id);
        setCardholderName(method.cardholderName);
        setExpiry(method.expiry);
        setIsPrepaid(method.isPrepaid || false);
        setBalance(method.balance || '');
        setShowForm(true);
        // Note: We don't populate card number or CVC for security
    };

    const handleDeleteCard = async (methodId) => {
        if (!confirm("Are you sure you want to delete this card?")) return;
        
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'paymentMethods', methodId));
            alert('Card deleted successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to delete card: ' + err.message);
        }
    };

    const resetForm = () => {
        setCardNumber('');
        setCvc('');
        setExpiry('');
        setCardholderName('');
        setIsPrepaid(false);
        setBalance('');
        setShowForm(false);
        setEditingId(null);
    };

    const handleCameraScan = () => {
        // TODO: Implement camera scanning with html5-qrcode or react-webcam
        alert('Camera scanning will be implemented based on library preference');
        setIsScanning(!isScanning);
    };

    // Detect webhook type from URL

    const handleSaveWebhook = async (e) => {
        e.preventDefault();
        setSavingWebhook(true);

        try {
            const functions = getFunctions();
            const saveWebhook = httpsCallable(functions, 'saveWebhook');
            
            await saveWebhook({ webhookUrl });
            alert('Webhook URL saved successfully!');
            setWebhookType(detectWebhookType(webhookUrl));
        } catch (err) {
            console.error(err);
            alert('Failed to save webhook: ' + err.message);
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleTestWebhook = async () => {
        if (!webhookUrl) {
            alert('Please enter a webhook URL first');
            return;
        }

        setTestingWebhook(true);

        try {
            const functions = getFunctions();
            const testWebhook = httpsCallable(functions, 'testWebhook');
            
            await testWebhook({ webhookUrl });
            alert('Test notification sent! Check your channel.');
        } catch (err) {
            console.error(err);
            alert('Failed to send test notification: ' + err.message);
        } finally {
            setTestingWebhook(false);
        }
    };

    // Format card number with spaces
    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];

        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }

        if (parts.length) {
            return parts.join(' ');
        } else {
            return value;
        }
    };

    // Format expiry as MM/YY
    const formatExpiry = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.slice(0, 2) + '/' + v.slice(2, 4);
        }
        return v;
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 relative overflow-hidden font-display">
            {/* Dynamic background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/40 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/30 rounded-full blur-[120px]"></div>
            </div>

            <header className="relative z-10 mb-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Settings
                        </h1>
                        <p className="text-gray-400 text-sm mt-1 font-medium tracking-wide">
                            Manage your payment methods and notifications
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors border border-white/5 font-medium backdrop-blur-md"
                    >
                        Back to Dashboard
                    </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex gap-2 p-4">
                    <button
                        onClick={() => setActiveTab('payment')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            activeTab === 'payment' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                        </svg>
                        Payment Methods
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            activeTab === 'notifications' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        Notifications
                    </button>
                </div>
            </header>

            <main className="relative z-10 max-w-4xl mx-auto">
                {/* Payment Methods Tab */}
                {activeTab === 'payment' && (
                    <>
                        {/* Warning Banner */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
                    <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <div>
                        <h3 className="font-bold text-yellow-200 mb-1">Security Notice</h3>
                        <p className="text-yellow-300/80 text-sm">
                            For maximum security, we recommend using prepaid cards or virtual cards for auto-checkout features. 
                            Card data is encrypted and stored securely, but prepaid cards limit potential exposure.
                        </p>
                    </div>
                </div>

                {/* Add Card Form */}
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="w-full bg-blue-600/20 hover:bg-blue-600/30 border-2 border-dashed border-blue-500/50 rounded-2xl p-6 flex items-center justify-center gap-3 transition-all mb-6 group"
                    >
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        <span className="text-blue-300 font-medium group-hover:text-blue-200">Add Payment Method</span>
                    </button>
                )}

                {showForm && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">
                                {editingId ? 'Edit Payment Method' : 'Add Payment Method'}
                            </h2>
                            <button onClick={resetForm} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveCard} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    Card Number
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                        placeholder="1234 5678 9012 3456"
                                        maxLength="19"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                        required
                                        disabled={editingId}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCameraScan}
                                        className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl px-4 py-3 transition-colors flex items-center gap-2"
                                        title="Scan card with camera"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        </svg>
                                    </button>
                                </div>
                                {editingId && (
                                    <p className="text-gray-500 text-xs mt-1">Card number cannot be edited for security reasons</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        Expiry (MM/YY)
                                    </label>
                                    <input
                                        type="text"
                                        value={expiry}
                                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                        placeholder="12/25"
                                        maxLength="5"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        CVC
                                    </label>
                                    <input
                                        type="text"
                                        value={cvc}
                                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="123"
                                        maxLength="4"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                        required
                                        disabled={editingId}
                                    />
                                    {editingId && (
                                        <p className="text-gray-500 text-xs mt-1">CVC cannot be edited</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    Cardholder Name
                                </label>
                                <input
                                    type="text"
                                    value={cardholderName}
                                    onChange={(e) => setCardholderName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                />
                            </div>

                            <div>
                                <div
                                    onClick={() => setIsPrepaid(!isPrepaid)}
                                    className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl cursor-pointer hover:bg-black/50 transition-colors"
                                >
                                    <span className="text-gray-300 text-sm font-medium">This is a prepaid card</span>
                                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${isPrepaid ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>
                                        {isPrepaid && (
                                            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isPrepaid && (
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        Card Balance
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={balance}
                                            onChange={(e) => setBalance(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    {saving ? 'Saving...' : (editingId ? 'Update Card' : 'Add Card')}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Saved Cards List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white mb-4">Saved Payment Methods</h2>
                    
                    {loading ? (
                        <div className="text-center text-gray-400 py-8">Loading...</div>
                    ) : paymentMethods.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                            </svg>
                            <p className="text-gray-400">No payment methods added yet</p>
                        </div>
                    ) : (
                        paymentMethods.map(method => (
                            <div key={method.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                            </svg>
                                            <div>
                                                <p className="text-white font-bold">•••• •••• •••• {method.last4}</p>
                                                <p className="text-gray-400 text-sm">{method.cardholderName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span>Expires: {method.expiry}</span>
                                            {method.isPrepaid && (
                                                <>
                                                    <span className="text-blue-400 font-medium">• Prepaid</span>
                                                    {method.balance !== null && (
                                                        <span className="text-green-400 font-mono">${method.balance.toFixed(2)}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditCard(method)}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-4 py-2 rounded-xl transition-all text-sm font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCard(method.id)}
                                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-4 py-2 rounded-xl transition-all text-sm font-medium"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                    </>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <>
                        {/* Info Banner */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
                            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div>
                                <h3 className="font-bold text-blue-200 mb-1">Webhook Notifications</h3>
                                <p className="text-blue-300/80 text-sm">
                                    Get notified when items go in or out of stock. Supports Discord webhooks, Slack webhooks, and generic JSON webhooks.
                                </p>
                            </div>
                        </div>

                        {/* Webhook Configuration */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
                            <h2 className="text-xl font-bold text-white mb-6">Webhook Configuration</h2>
                            
                            <form onSubmit={handleSaveWebhook} className="space-y-6">
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                                        Webhook URL
                                    </label>
                                    <input
                                        type="url"
                                        value={webhookUrl}
                                        onChange={(e) => handleWebhookUrlChange(e.target.value)}
                                        placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                    {webhookType && (
                                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs font-medium">
                                                {webhookType}
                                            </span>
                                            Webhook type detected
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={savingWebhook || !webhookUrl}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
                                    >
                                        {savingWebhook ? 'Saving...' : 'Save Webhook'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleTestWebhook}
                                        disabled={testingWebhook || !webhookUrl}
                                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all"
                                    >
                                        {testingWebhook ? 'Testing...' : 'Test Webhook'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Webhook Examples */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Supported Webhook Types</h3>
                            
                            <div className="space-y-4">
                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                            D
                                        </div>
                                        <h4 className="font-bold text-white">Discord</h4>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-2">
                                        Create a webhook in your Discord server settings → Integrations → Webhooks
                                    </p>
                                    <code className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded">
                                        https://discord.com/api/webhooks/...
                                    </code>
                                </div>

                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                            S
                                        </div>
                                        <h4 className="font-bold text-white">Slack</h4>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-2">
                                        Create an incoming webhook in your Slack workspace settings
                                    </p>
                                    <code className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded">
                                        https://hooks.slack.com/services/...
                                    </code>
                                </div>

                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                            ⚙️
                                        </div>
                                        <h4 className="font-bold text-white">Generic JSON</h4>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-2">
                                        Any endpoint that accepts POST requests with JSON payloads
                                    </p>
                                    <code className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded">
                                        https://your-api.com/webhook
                                    </code>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
