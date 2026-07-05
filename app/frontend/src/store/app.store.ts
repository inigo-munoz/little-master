import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Campaign, AssistantMode, ExtendedMessage } from "../lib/api";

interface AppState {
  // Active campaign context
  activeCampaignId: string | null;
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;

  // Chat state
  chatMode: AssistantMode;
  setChatMode: (mode: AssistantMode) => void;

  // Chat history — persists across navigation, resets on page reload
  messages: ExtendedMessage[];
  addMessage: (message: ExtendedMessage) => void;
  clearMessages: () => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Hydration guard — false until localStorage has been rehydrated by persist middleware
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeCampaignId: null,
      activeCampaign: null,
      setActiveCampaign: (campaign) =>
        set({ activeCampaign: campaign, activeCampaignId: campaign?.id ?? null }),

      chatMode: "archivista",
      setChatMode: (mode) => set({ chatMode: mode }),

      messages: [],
      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      clearMessages: () => set({ messages: [] }),

      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "dnd-assistant-store",
      // Solo persiste la campaña activa; el resto es estado de sesión
      partialize: (state) => ({
        activeCampaignId: state.activeCampaignId,
        activeCampaign: state.activeCampaign,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
