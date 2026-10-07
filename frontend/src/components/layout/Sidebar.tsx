'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Scale, 
  LayoutDashboard, 
  ArrowLeftRight, 
  Truck, 
  Users, 
  Building2, 
  Package, 
  Layers, 
  CheckCircle2, 
  FileText, 
  BarChart3, 
  History, 
  Settings, 
  Database,
  Sliders,
  Cpu, 
  ChevronDown, 
  ChevronRight, 
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, hasPermission, isRole } = useAuth();

  // Collapsible categories state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  // Hover & pin state
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Expanded if pinned OR hovered
  const isExpanded = isPinned || isHovered;

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navCategories = [
    {
      title: 'INTELLIGENCE & OVERVIEW',
      shortTitle: 'OVERVIEW',
      items: [
        {
          label: 'Dashboard',
          href: '/',
          icon: LayoutDashboard,
          allowed: hasPermission('view_dashboards') || isRole('Administrator') || isRole('Manager') || isRole('Supervisor') || isRole('Operator') || isRole('Weighbridge Operator'),
        },
        {
          label: 'Reports & Analytics',
          href: '/reports',
          icon: BarChart3,
          allowed: hasPermission('generate_reports') || isRole('Supervisor') || isRole('Manager') || isRole('Administrator'),
        },
      ],
    },
    {
      title: 'OPERATIONS',
      shortTitle: 'OPERATIONS',
      items: [
        {
          label: 'Weighbridge Console',
          href: '/transactions',
          icon: ArrowLeftRight,
          allowed: hasPermission('capture_weights') || hasPermission('view_transactions'),
        },
        {
          label: 'Tickets & Slips',
          href: '/tickets',
          icon: FileText,
          allowed: hasPermission('generate_tickets') || hasPermission('view_transactions'),
        },
      ],
    },
    {
      title: 'MASTER REGISTRIES',
      shortTitle: 'REGISTRIES',
      items: [
        {
          label: 'Vehicles',
          href: '/vehicles',
          icon: Truck,
          allowed: hasPermission('register_vehicles') || hasPermission('manage_master_records') || isRole('Administrator'),
        },
        {
          label: 'Drivers',
          href: '/drivers',
          icon: Users,
          allowed: hasPermission('register_drivers') || hasPermission('manage_master_records') || isRole('Administrator'),
        },
        {
          label: 'Carriers & Fleets',
          href: '/carriers',
          icon: Layers,
          allowed: hasPermission('manage_master_records') || isRole('Administrator'),
        },
        {
          label: 'Suppliers / Vendors',
          href: '/suppliers',
          icon: Building2,
          allowed: hasPermission('manage_master_records') || isRole('Administrator'),
        },
        {
          label: 'Materials',
          href: '/materials',
          icon: Package,
          allowed: hasPermission('manage_master_records') || isRole('Administrator'),
        },
      ],
    },
    {
      title: 'COMPLIANCE & AUDIT',
      shortTitle: 'COMPLIANCE',
      items: [
        {
          label: 'Approvals Queue',
          href: '/approvals',
          icon: CheckCircle2,
          allowed: hasPermission('approve_corrections') || hasPermission('approve_reversals') || isRole('Supervisor') || isRole('Administrator'),
        },
        {
          label: 'Audit Trail',
          href: '/audit',
          icon: History,
          allowed: hasPermission('view_audit_logs') || isRole('Supervisor') || isRole('Administrator'),
        },
      ],
    },
    {
      title: 'ADMINISTRATION',
      shortTitle: 'ADMIN',
      items: [
        {
          label: 'User Accounts',
          href: '/admin',
          icon: Users,
          allowed: hasPermission('manage_users') || isRole('Administrator'),
        },
        {
          label: 'Database & Backups',
          href: '/backups',
          icon: Database,
          allowed: hasPermission('manage_system') || isRole('Administrator'),
        },
        {
          label: 'System Settings',
          href: '/settings',
          icon: Sliders,
          allowed: hasPermission('manage_system_settings') || hasPermission('manage_system') || isRole('Administrator') || isRole('Supervisor'),
        },
        {
          label: 'Hardware & Scales',
          href: '/scale-settings',
          icon: Cpu,
          allowed: hasPermission('manage_hardware') || isRole('Administrator') || isRole('Supervisor'),
        },
      ],
    },
  ];

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative z-40 bg-white border-r border-zinc-200 flex flex-col justify-between select-none transition-all duration-300 ease-in-out shadow-xs ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-zinc-200 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <Scale className="w-4 h-4" />
            </div>
            {isExpanded && (
              <div className="overflow-hidden transition-opacity duration-200">
                <h1 className="font-black text-zinc-900 text-xs tracking-tight truncate leading-none">SMART-WEIGH</h1>
                <p className="text-[8px] uppercase font-bold text-zinc-400 tracking-wider truncate mt-0.5">Enterprise Terminal</p>
              </div>
            )}
          </Link>

          {isExpanded && (
            <button
              onClick={() => setIsPinned(!isPinned)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
              title={isPinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar expanded'}
            >
              {isPinned ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Scrollable Nav Sections */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {navCategories.map((cat) => {
            const visibleItems = cat.items.filter((item) => item.allowed);
            if (visibleItems.length === 0) return null;

            const isCollapsed = !!collapsedSections[cat.title];

            return (
              <div key={cat.title} className="space-y-0.5">
                {/* Category Header */}
                {isExpanded ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(cat.title)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[9px] font-mono font-bold text-zinc-400 tracking-wider uppercase hover:text-zinc-600 transition-colors"
                  >
                    <span className="truncate">{cat.title}</span>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                  </button>
                ) : (
                  <div className="w-full flex justify-center py-1">
                    <span className="w-4 h-0.5 rounded-full bg-zinc-200" />
                  </div>
                )}

                {/* Category Items */}
                {(!isCollapsed || !isExpanded) && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!isExpanded ? item.label : undefined}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-zinc-900 text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                          } ${!isExpanded ? 'justify-center px-0' : ''}`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                          {isExpanded && <span className="truncate text-xs">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Operator User Card & Logout */}
      <div className="p-2 border-t border-zinc-200 bg-zinc-50 shrink-0">
        {isExpanded ? (
          <>
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-white border border-zinc-200">
              <div className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {user?.username?.slice(0, 2).toUpperCase() || 'OP'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 truncate leading-none">{user?.username || 'Operator'}</p>
                <p className="text-[9px] text-zinc-500 truncate capitalize mt-0.5">
                  {user?.role_details?.name || (user?.is_superuser ? 'Administrator' : 'User')}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div 
              className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px]"
              title={user?.username || 'Operator'}
            >
              {user?.username?.slice(0, 2).toUpperCase() || 'OP'}
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
