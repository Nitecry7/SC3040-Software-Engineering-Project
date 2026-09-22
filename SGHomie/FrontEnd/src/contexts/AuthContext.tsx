import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import InitialProfileSetup from '../components/InitialProfileSetup';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  needsProfileSetup: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  signOut: async () => {},
  needsProfileSetup: false,
  isAdmin: false,
  isSeller: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        checkProfile(currentUser.id);
      } else {
        setIsAdmin(false);
        setIsSeller(false);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        checkProfile(currentUser.id);
      } else {
        setNeedsProfileSetup(false);
        setIsAdmin(false);
        setIsSeller(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, income_range, preferred_property_type, preferred_locations, family_members, is_admin, is_seller')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const admin = data?.is_admin === true;
      const seller = data?.is_seller === true;
      setIsAdmin(admin);
      setIsSeller(seller);

      // Administrators do not need to complete the normal buyer profile and
      // should go directly to admin functionality.
      if (admin) {
        setNeedsProfileSetup(false);
        return;
      }

      const needsSetup = !data || !data.name || !data.income_range || 
                        !data.preferred_property_type || !data.preferred_locations || 
                        !data.family_members;

      setNeedsProfileSetup(needsSetup);
    } catch (error) {
      console.error('Error checking profile:', error);
      setIsAdmin(false);
      setIsSeller(false);
      setNeedsProfileSetup(true);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      setUser(null);
      setNeedsProfileSetup(false);
      setIsAdmin(false);
      setIsSeller(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, signOut, needsProfileSetup, isAdmin, isSeller, loading }}>
      {children}
      {user && needsProfileSetup && (
        <InitialProfileSetup
          userId={user.id}
          onComplete={() => setNeedsProfileSetup(false)}
        />
      )}
    </AuthContext.Provider>
  );
};
