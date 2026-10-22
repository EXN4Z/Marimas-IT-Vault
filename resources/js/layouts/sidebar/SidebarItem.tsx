import { ChevronDown } from 'lucide-react';
import type { NavItem, NavChild } from '../navigation';
import { matchesPrefix } from '../navigation';

interface SidebarItemProps {
  item: NavItem;
  pathname: string;
  isParentActive: boolean;
  isDropdownOpen: boolean;
  visibleChildren: NavChild[];
  isChildActive: (child: NavChild, isFirst: boolean) => boolean;
  onItemClick: () => void;
  onChildClick: (path: string) => void;
  showDivider: boolean;
}

export default function SidebarItem({
  item,
  pathname,
  isParentActive,
  isDropdownOpen,
  visibleChildren,
  isChildActive,
  onItemClick,
  onChildClick,
  showDivider,
}: SidebarItemProps) {
  const Icon = item.icon;
  const divider = showDivider && (
    <div key={`divider-${item.label}`} className="my-3 border-t border-slate-200" />
  );

  // ITEM DENGAN DROPDOWN (children)
  if (item.children) {
    return (
      <div key={item.label}>
        {divider}
        <div className="mb-1">
          <button
            onClick={onItemClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              isParentActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'
            }`}
          >
            <Icon size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-200 dark:border-zinc-800 flex flex-col gap-1">
              {visibleChildren.map((child, idx) => {
                const ChildIcon = child.icon;
                const active = isChildActive(child, idx === 0);
                return (
                  <button
                    key={child.path}
                    onClick={() => onChildClick(child.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-medium dark:bg-zinc-800 dark:text-white'
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200'
                    }`}
                  >
                    <ChildIcon size={15} />
                    {child.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ITEM BIASA (tanpa dropdown)
  const isActive = item.matchPrefix
    ? matchesPrefix(pathname, item.matchPrefix)
    : item.path === pathname;
  const isDisabled = !item.path;

  return (
    <div key={item.label}>
      {divider}
      <button
        onClick={onItemClick}
        disabled={isDisabled}
        title={isDisabled ? 'Segera hadir' : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition ${
          isActive
            ? 'bg-slate-900 text-white'
            : isDisabled
            ? 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'
        }`}
      >
        <Icon size={18} />
        {item.label}
      </button>
    </div>
  );
}
