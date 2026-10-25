import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import InitialProfileSetup from '../components/InitialProfileSetup';

const PROFILE_LOOKUP_TIMEOUT_MS = 10_000;

interface AuthContextType {
  user: User | null;
  authTransition: 'intentional-sign-out' | 'inactivity-sign-out' | 'session-ended' | null;
  signOut: (reason?: 'manual' | 'inactivity') => Promise<void>;
  refreshProfile: () => Promise<{ needsProfileSetup: boolean; isAdmin: boolean; isSeller: boolean } | null>;
  needsProfileSetup: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  authLoading: boolean;
  profileLoading: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authTransition: null,
  signOut: async () => {},
  refreshProfile: async () => null,
  needsProfileSetup: false,
  isAdmin: false,
  isSeller: false,
  authLoading: true,
  profileLoading: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authTransition, setAuthTransition] = useState<AuthContextType['authTransition']>(null);
  const authTransitionRef = useRef<AuthContextType['authTransition']>(null);
  const setTransition = useCallback((transition: AuthContextType['authTransition']) => {
    authTransitionRef.current = transition;
    setAuthTransition(transition);
  }, []);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileChecks = useRef(new Map<string, Promise<{
    needsProfileSetup: boolean;
    isAdmin: boolean;
    isSeller: boolean;
  }>>());
  const authRevision = useRef(0);
  const activeUserId = useRef<string | null | undefined>(undefined);
  const activeUserIsRegistered = useRef(false);
  const profileLoadingRef = useRef(false);

  const checkProfile = useCallback((userId: string): Promise<{
    needsProfileSetup: boolean;
    isAdmin: boolean;
    isSeller: boolean;
  }> => {
    const existingCheck = profileChecks.current.get(userId);
    if (existingCheck) return existingCheck;

    const profileCheck = (async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const profileRequest = supabase
          .from('user_profiles')
          .select('name, income_range, preferred_property_type, preferred_locations, family_members, is_admin, is_seller')
          .eq('id', userId)
          .single();
        const timeout = new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Profile lookup timed out')), PROFILE_LOOKUP_TIMEOUT_MS);
        });
        const { data, error } = await Promise.race([profileRequest, timeout]);

        if (error) throw error;

        const admin = data?.is_admin === true;
        const seller = data?.is_seller === true;

        // Administrators do not need to complete the normal buyer profile and
        // should go directly to admin functionality.
        if (admin) {
          return { needsProfileSetup: false, isAdmin: true, isSeller: false };
        }

        const needsSetup = !data || !data.name || !data.income_range ||
                          !data.preferred_property_type || !data.preferred_locations ||
                          !data.family_members;

        return { needsProfileSetup: needsSetup, isAdmin: false, isSeller: seller };
      } catch (error) {
        console.error('Error checking profile:', error);
        return { needsProfileSetup: true, isAdmin: false, isSeller: false };
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    })();

    profileChecks.current.set(userId, profileCheck);
    void profileCheck.then(() => {
      if (profileChecks.current.get(userId) === profileCheck) {
        profileChecks.current.delete(userId);
      }
    });
    return profileCheck;
  }, []);

  const applySession = useCallback((currentUser: User | null) => {
    const userId = currentUser?.id ?? null;
    activeUserIsRegistered.current = Boolean(currentUser && currentUser.is_anonymous !== true);
    if (currentUser && currentUser.is_anonymous !== true && activeUserId.current !== userId) {
      setTransition(null);
    }
    setAuthLoading(false);

    // getSession() and INITIAL_SESSION can report the same user concurrently.
    // Keep the existing profile request instead of briefly clearing resolved roles.
    if (activeUserId.current === userId && (userId === null || currentUser?.is_anonymous === true || profileLoadingRef.current)) {
      setUser(currentUser);
      return;
    }

    const revision = ++authRevision.current;
    activeUserId.current = userId;
    setUser(currentUser);

    if (!currentUser || currentUser.is_anonymous === true) {
      profileLoadingRef.current = false;
      setProfileLoading(false);
      setNeedsProfileSetup(false);
      setIsAdmin(false);
      setIsSeller(false);
      return;
    }

    // Role and profile-gated routes remain in their loading state until this
    // authenticated user's current profile has been resolved.
    profileLoadingRef.current = true;
    setProfileLoading(true);
    setNeedsProfileSetup(false);
    setIsAdmin(false);
    setIsSeller(false);

    void checkProfile(currentUser.id).then(profile => {
      if (authRevision.current !== revision || activeUserId.current !== userId) return;
      setNeedsProfileSetup(profile.needsProfileSetup);
      setIsAdmin(profile.isAdmin);
      setIsSeller(profile.isSeller);
      profileLoadingRef.current = false;
      setProfileLoading(false);
    });
  }, [checkProfile, setTransition]);

  const refreshProfile = useCallback(async () => {
    if (!user || user.is_anonymous === true || activeUserId.current !== user.id) return null;
    const userId = user.id;
    const revision = ++authRevision.current;
    profileLoadingRef.current = true;
    setProfileLoading(true);

    // Registration may have changed a role while another profile lookup is
    // still pending; force this refresh to read the updated database row.
    profileChecks.current.delete(userId);
    const profile = await checkProfile(userId);
    if (authRevision.current === revision && activeUserId.current === userId) {
      setNeedsProfileSetup(profile.needsProfileSetup);
      setIsAdmin(profile.isAdmin);
      setIsSeller(profile.isSeller);
      profileLoadingRef.current = false;
      setProfileLoading(false);
    }
    return profile;
  }, [checkProfile, user]);

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;

    // Subscribe first so a sign-out or account change cannot be overwritten by
    // a slower startup getSession() response.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      authEventReceived = true;
      if (!session?.user && activeUserIsRegistered.current && !['intentional-sign-out', 'inactivity-sign-out'].includes(authTransitionRef.current ?? '')) {
        setTransition('session-ended');
      }
      applySession(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventReceived) return;
      applySession(error ? null : data.session?.user ?? null);
    }).catch(() => {
      if (mounted && !authEventReceived) applySession(null);
    });

    return () => {
      mounted = false;
      authRevision.current += 1;
      activeUserId.current = undefined;
      activeUserIsRegistered.current = false;
      profileLoadingRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession, setTransition]);

  const signOut = useCallback(async (reason: 'manual' | 'inactivity' = 'manual') => {
    // Keep the reason through SIGNED_OUT and the redirect, regardless of whether
    // the auth event arrives before or after the sign-out promise resolves.
    setTransition(reason === 'manual' ? 'intentional-sign-out' : 'inactivity-sign-out');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (reason === 'manual') throw error;
        // An idle deadline must remove protected access even if the remote
        // refresh-token revocation endpoint is unavailable.
        console.error('Remote sign-out failed at inactivity deadline:', error);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* local UI state is still ended below */ }
        localStorage.clear();
        applySession(null);
        return;
      }
      localStorage.clear();
      applySession(null);
    } catch (error) {
      if (reason === 'inactivity') {
        console.error('Remote sign-out failed at inactivity deadline:', error);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch (localError) {
          console.error('Local sign-out fallback failed:', localError);
        }
        localStorage.clear();
        applySession(null);
        return;
      }
      setTransition(null);
      console.error('Error signing out:', error);
      throw error;
    }
  }, [applySession, setTransition]);

  return (
    <AuthContext.Provider value={{
      user,
      authTransition,
      signOut,
      refreshProfile,
      needsProfileSetup,
      isAdmin,
      isSeller,
      authLoading,
      profileLoading,
      loading: authLoading || profileLoading,
    }}>
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
