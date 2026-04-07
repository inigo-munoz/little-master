"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Swords,
  BookOpen,
  MessageSquare,
  Settings,
  ScrollText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
  MapPin,
  User,
  Flag,
  History,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "../../store/app.store";

const NAV_ITEMS = [
  { href: "/campaigns", label: "Campaigns", icon: Swords },
  { href: "/players", label: "Jugadores", icon: User },
  { href: "/npcs", label: "NPCs", icon: Users },
  { href: "/sessions", label: "Sesiones", icon: ScrollText },
  { href: "/locations", label: "Localizaciones", icon: MapPin },
  { href: "/factions", label: "Facciones", icon: Flag },
  { href: "/documents", label: "Documents", icon: BookOpen },
  { href: "/chat", label: "Assistant", icon: MessageSquare },
  { href: "/encounter", label: "Encounter", icon: Zap },
  { href: "/changelog", label: "Changelog", icon: History },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, activeCampaign } = useAppStore();

  return (
    <aside
      className={clsx(
        "flex flex-col bg-stone-900 border-r border-stone-800 transition-all duration-200 shrink-0",
        sidebarOpen ? "w-64" : "w-14"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-stone-800">
        <Shield className="text-amber-500 shrink-0" size={20} />
        {sidebarOpen && (
          <span className="font-bold text-amber-400 text-sm tracking-wide truncate">
            D&D Assistant
          </span>
        )}
      </div>

      {/* Active campaign indicator */}
      {activeCampaign && sidebarOpen && (
        <div className="px-4 py-3 border-b border-stone-800 bg-stone-800/50">
          <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Active Campaign</p>
          <p className="text-sm text-amber-400 font-medium truncate">{activeCampaign.title}</p>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-amber-900/40 text-amber-400 font-medium"
                  : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              )}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={16} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center p-3 border-t border-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </aside>
  );
}
