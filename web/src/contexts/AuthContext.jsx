
import React, { useContext, useState, useEffect, createContext } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);

    // Check if user has an active Stripe subscription with a timeout
    async function checkSubscription(user) {
        if (!user) {
            setIsPaying(false);
            return;
        }

        // Timeout promise (fail fast after 5 seconds)
        const timeout = new Promise((resolve) => {
            setTimeout(() => {
                console.warn("Subscription check timed out. Assuming free tier.");
                resolve(null);
            }, 5000);
        });

        try {
            // Standard path for Firebase Extensions: Run Payments with Stripe
            const subRef = collection(db, 'customers', user.uid, 'subscriptions');
            // Only active or trialing
            const q = query(subRef, where('status', 'in', ['active', 'trialing']));

            const firestorePromise = getDocs(q);

            // Race against the timeout
            const snapshot = await Promise.race([firestorePromise, timeout]);

            if (snapshot) {
                setIsPaying(!snapshot.empty);
            } else {
                // Timed out
                setIsPaying(false);
            }
        } catch (error) {
            // PERMISSION_DENIED or other errors
            console.error("Error checking subscription:", error.code, error.message);
            setIsPaying(false);
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                await checkSubscription(user);
            } else {
                setIsPaying(false);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        isPaying,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="flex h-screen items-center justify-center bg-black">
                    <div className="relative w-16 h-16">
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-white/10 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-white rounded-full animate-spin"></div>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
