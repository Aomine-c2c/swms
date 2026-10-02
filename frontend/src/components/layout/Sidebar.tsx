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
  ShieldCheck,
  History,
  Settings,
  Cpu,
  ChevronDown,
  ChevronRight,
  LogOut 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, hasPermission, isRole } = useAuth();

  // Collapsible categories state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navCategories = [
    {
      title: 'OPERATIONS',
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
      title: 'INTELLIGENCE',
      items: [
        {
          label: 'Dashboard',
          href: '/',
          icon: LayoutDashboard,
          allowed: hasPermission('view_dashboards') || isRole('Administrator') || isRole('Manager') || isRole('Supervisor'),
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
      title: 'ADMINISTRATION',
      items: [
        {
          label: 'System & Users',
          href: '/admin',
          icon: Settings,
          allowed: hasPermission('manage_users') || hasPermission('manage_system') || isRole('Administrator'),
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
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-200 gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 text-xs tracking-tight">SMART-WEIGH</h1>
            <p className="text-[9px] uppercase font-semibold text-zinc-400 tracking-wider">Enterprise Terminal</p>
          </div>
        </div>

        {/* Scrollable Nav Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {navCategories.map((cat) => {
            const visibleItems = cat.items.filter((item) => item.allowed);
            if (visibleItems.length === 0) return null;

            const isCollapsed = !!collapsedSections[cat.title];

            return (
              <div key={cat.title} className="space-y-1">
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(cat.title)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold text-zinc-400 tracking-wider uppercase hover:text-zinc-600 transition-colors"
                >
                  <span>{cat.title}</span>
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Category Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-zinc-900 text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                          <span className="truncate">{item.label}</span>
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
      <div className="p-3 border-t border-zinc-200 bg-zinc-50 shrink-0">
        <div className="flex items-center gap-2.5 mb-2 px-2 py-1.5 rounded-lg bg-white border border-zinc-200">
          <div className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px]">
            {user?.username?.slice(0, 2).toUpperCase() || 'OP'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.username || 'Operator'}</p>
            <p className="text-[9px] text-zinc-500 truncate capitalize">
              {user?.role_details?.name || (user?.is_superuser ? 'Administrator' : 'User')}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
