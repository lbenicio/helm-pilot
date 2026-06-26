'use client';

import { Activity, Heart, LayoutDashboard, Library } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/charts', icon: Library, label: 'Charts' },
  { path: '/events', icon: Activity, label: 'Events' },
  { path: '/health', icon: Heart, label: 'Health' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[#E1E4E8] dark:border-slate-800 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            onClick={() => router.push(path)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-12 min-h-12 rounded-lg transition-colors tap-highlight-transparent ${
              isActive(path) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
