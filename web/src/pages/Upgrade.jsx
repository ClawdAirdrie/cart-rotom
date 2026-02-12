
import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';

export default function Upgrade() {
    const [loading, setLoading] = useState(false);

    const handleLogout = () => {
        signOut(auth);
    };

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                alert("Please log in first.");
                setLoading(false);
                return;
            }

            // 1. Find the price ID from Firestore (synced from Stripe)
            const productsRef = collection(db, 'products');
            const q = query(productsRef, where('active', '==', true));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("No active products found. Please check your Stripe Dashboard and Firebase interactions.");
                setLoading(false);
                return;
            }

            // Just take the first active product and its first active price
            let priceId = null;
            for (const doc of querySnapshot.docs) {
                const pricesRef = collection(db, 'products', doc.id, 'prices');
                const priceQuery = query(pricesRef, where('active', '==', true));
                const priceSnapshot = await getDocs(priceQuery);

                if (!priceSnapshot.empty) {
                    priceId = priceSnapshot.docs[0].id; // Use the first Price ID found
                    break;
                }
            }

            if (!priceId) {
                alert("No active prices found for the product. Please check Stripe.");
                setLoading(false);
                return;
            }

            // 2. Create a checkout session in Firestore
            const checkoutRef = await addDoc(collection(db, 'customers', user.uid, 'checkout_sessions'), {
                price: priceId,
                success_url: window.location.origin,
                cancel_url: window.location.origin,
                // allow_promotion_codes: true,
                allow_promotion_codes: true
            });

            // 3. Listen for the `url` field to be populated by the extension
            onSnapshot(checkoutRef, (snap) => {
                const { error, url } = snap.data();
                if (error) {
                    alert(`An error occurred: ${error.message}`);
                    setLoading(false);
                }
                if (url) {
                    window.location.assign(url);
                }
            });

        } catch (error) {
            console.error("Error starting checkout:", error);
            alert("Failed to start checkout. Check console for details.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 relative flex items-center justify-center font-display overflow-hidden">
            {/* Abstract Background */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-l from-purple-800/20 to-transparent rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-r from-blue-900/20 to-transparent rounded-full blur-[80px]"></div>

            <div className="relative z-10 max-w-lg w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-8 shadow-2xl transition-all hover:scale-105 active:scale-100 group">
                <div className="text-center mb-8">
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        Early Access
                    </span>
                    <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 mb-2">
                        Pro Access
                    </h2>
                    <p className="text-gray-400 text-sm">Unlock the full power of Rotom Cart Agents</p>
                </div>

                <div className="bg-black/20 rounded-2xl p-8 mb-8 border border-white/5 text-center relative overflow-hidden">
                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rotate-45"></div>

                    <div className="flex items-center justify-center gap-1 mb-2">
                        <span className="text-5xl font-bold text-white tracking-tighter">$29</span>
                        <span className="text-gray-500 text-lg translate-y-2">/mo</span>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-2">Billed Monthly</p>
                </div>

                <ul className="space-y-4 mb-8">
                    {[
                        "Unlimited Agent Deployments",
                        "Real-time Stock Notifications",
                        "Priority Discord Support",
                        "Advanced Configuration",
                        "Analytics Dashboard"
                    ].map((item, idx) => (
                        <li key={idx} className="flex items-center text-gray-300 gap-3 group/item">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 group-hover/item:border-green-400 transition-colors shadow-[0_0_10px_rgba(74,222,128,0.1)]">
                                <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span className="group-hover/item:text-white transition-colors text-sm font-medium">{item}</span>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.6)] transition-all active:scale-95 mb-4 border-t border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Redirecting to Stripe...
                        </span>
                    ) : (
                        "Subscribe Now"
                    )}
                </button>

                <button
                    onClick={handleLogout}
                    className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                >
                    Sign out
                </button>
            </div>
        </div>
    );
}
