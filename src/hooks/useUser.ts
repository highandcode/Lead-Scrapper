"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

interface UseUserReturn {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUserAndProfile(u: User | null) {
      setUser(u);
      if (u) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .single();
        setProfile(data ?? null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      loadUserAndProfile(u);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserAndProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
  };
}
