"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UsersRound,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
} from "lucide-react";
import { useState } from "react";
export function BeaconMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`beacon-mark ${small ? "small" : ""}`}>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/employees", label: "Employee credentials", icon: UsersRound },
    { href: "/assistant", label: "Credential assistant", icon: Sparkles },
  ];
  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <PanelLeftClose size={20} />
        ) : (
          <PanelLeftOpen size={20} />
        )}
      </button>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <BeaconMark />
          <span>
            beacon<span className="brand-sub">CREDENTIAL INTELLIGENCE</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">BH</span>
          <span>
            <strong>Beacon Health</strong>
            <small>Kalamazoo · Michigan</small>
          </span>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`nav-link ${pathname === href ? "selected" : ""}`}
            >
              <Icon size={18} />
              {label}
              {href === "/assistant" && <span className="ai-tag">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-guide">
          <span className="guide-icon">
            <ShieldCheck size={20} />
          </span>
          <strong>Confidence in every check.</strong>
          <p>One place to keep your team’s credentials in view.</p>
          <Link href="/assistant">
            Ask your assistant <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="source-box">
          <div>
            <span className="status-dot" />
            Michigan MILARA
          </div>
          <small>Registered Nurse · State source</small>
          <span className="source-scope">
            <Activity size={12} /> Focused proof of concept
          </span>
        </div>
        <div className="sidebar-user">
          <span className="user-avatar">BM</span>
          <div>
            <strong>Beacon Manager</strong>
            <small>Local demo workspace</small>
          </div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
