import { create } from 'zustand'

export const useAppStore = create((set) => ({
  socket: null,
  status: 'disconnected',
  apiStatusText: '',
  activePage: 'home',
  collapsed: false,
  mobileOpen: false,

  setSocket: (socket) => set({ socket }),
  setStatus: (status) => set({ status }),
  setApiStatusText: (apiStatusText) => set({ apiStatusText }),
  setActivePage: (activePage) => set({ activePage }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setMobileOpen: (mobileOpen) => set({ mobileOpen })
}))
