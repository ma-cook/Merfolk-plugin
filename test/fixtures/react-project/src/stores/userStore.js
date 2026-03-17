import { create } from 'zustand';

export const useUserStore = create((set) => ({
  users: [],
  loading: false,
  setUsers: (users) => set({ users }),
  setLoading: (loading) => set({ loading }),
}));
