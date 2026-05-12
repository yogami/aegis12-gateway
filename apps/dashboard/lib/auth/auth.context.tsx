'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
    id: string;
    email?: string;
    name: string;
    organization?: string;
}

interface AuthContextType {
    user: User | null;
    login: () => Promise<void>;
    loginWithEmail: (email: string) => Promise<{ success: boolean; message: string }>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load mock session from local storage on mount
        const storedUser = localStorage.getItem('aegis_mock_user');
        if (storedUser) {
            try {
                // eslint-disable-next-line
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse mock user", e);
            }
        }
        setIsLoading(false);
    }, []);

    const setAndStoreUser = (newUser: User | null) => {
        setUser(newUser);
        if (newUser) {
            localStorage.setItem('aegis_mock_user', JSON.stringify(newUser));
        } else {
            localStorage.removeItem('aegis_mock_user');
        }
    };

    const login = async () => {
        setIsLoading(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockEmail = `demo-${Math.random().toString(36).slice(2)}@example.com`;
        
        setAndStoreUser({
            id: 'mock-user-id',
            email: mockEmail,
            name: 'Demo Admin',
            organization: 'Aegis-12 Security'
        });
        
        setIsLoading(false);
    };

    const loginWithEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setAndStoreUser({
            id: 'mock-user-id',
            email: email,
            name: email.split('@')[0],
            organization: 'Aegis-12 Security'
        });
        
        setIsLoading(false);
        return { success: true, message: 'Logged in securely.' };
    };

    const loginWithGoogle = async (): Promise<void> => {
        await login(); // Just use the same mock flow
    };

    const logout = async () => {
        setAndStoreUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, loginWithEmail, loginWithGoogle, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
