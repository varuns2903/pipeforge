import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Database, LayoutDashboard, PlayCircle, UserCircle, CreditCard } from 'lucide-react';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Workspaces', path: '/' },
    { icon: Database, label: 'Datasets', path: '/datasets' },
    { icon: PlayCircle, label: 'Executions', path: '/executions' },
    { icon: CreditCard, label: 'Billing', path: '/billing' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border-strong bg-surface-1 flex flex-col justify-between">
        <div>
          <div className="h-14 flex items-center px-6 border-b border-border-subtle">
            <div className="flex items-center gap-2 text-accent-500 font-bold text-lg tracking-wide">
              <div className="w-6 h-6 rounded-md bg-accent-600 flex items-center justify-center">
                <span className="text-white text-xs">DP</span>
              </div>
              pipeforge
            </div>
          </div>
          
          <div className="p-4">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3 px-2">Menu</div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-200 text-sm font-medium ${
                      isActive 
                        ? 'bg-surface-3 text-text-primary' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                    }`}
                  >
                    <item.icon size={18} className={isActive ? 'text-accent-500' : 'text-text-tertiary'} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-2 border border-border-subtle">
            <div className="flex items-center gap-2 overflow-hidden">
              <UserCircle size={20} className="text-text-secondary flex-shrink-0" />
              <div className="truncate">
                <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
                <p className="text-xs-mono text-text-tertiary truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-surface-2 transition-colors duration-200"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
