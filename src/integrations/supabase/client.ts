// src/integrations/supabase/index.ts
// Fully fake supabase client to stop crashes

const fakeQuery = {
  eq: () => fakeQuery,
  select: async () => ({ data: [], error: null }),
  insert: async () => ({ data: [], error: null }),
  update: async () => ({ data: [], error: null }),
  delete: async () => ({ data: [], error: null }),
};

export const supabase = {
  auth: {
    signUp: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: null } }),
  },
  from: () => fakeQuery,
  channel: () => ({
    on: () => {},
    subscribe: () => {},
  }),
  removeChannel: () => {},
};
