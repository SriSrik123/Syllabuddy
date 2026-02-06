import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  Users,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assignments', label: 'Assignments', icon: ClipboardList },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/chat', label: 'Ask AI', icon: MessageSquare },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/friends', label: 'Friends', icon: Users },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col fixed h-full transition-colors duration-200">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-200 dark:border-gray-800">
          <img src="/logo.png" alt="Syllabuddy" className="w-9 h-9" />
          <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">Syllabuddy</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate leading-tight">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
