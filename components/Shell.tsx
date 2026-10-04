"use client";
import { VerificationViewer } from "@/components/verification/VerificationViewer";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UsersRound,
  Sparkles,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/employees", label: "Employee credentials", icon: UsersRound },
    { href: "/alerts", label: "Alerts", icon: Bell },
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
        <Link
          href="/dashboard"
          className="brand"
          aria-label="Beacon Health System credential dashboard"
        >
          <Image
            src="/branding/beacon-health-system-white.png"
            alt="Beacon Health System"
            width={203}
            height={160}
            priority
          />
          <span className="brand-sub">CREDENTIAL MANAGEMENT</span>
        </Link>
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
        <div className="sidebar-user">
          <span className="user-avatar">BM</span>
          <div>
            <strong>Credential Manager</strong>
            <small>Local demo workspace</small>
          </div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
      <VerificationViewer />
    </div>
  );
}
