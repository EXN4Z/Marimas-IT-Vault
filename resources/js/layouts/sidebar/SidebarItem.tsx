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

// [DASHBOARD-V2] Gaya lewat kelas .sb-item / .sb-child (index.css).
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
  const divider = showDivider && <div className="sb-sep" />;

  // ITEM DENGAN DROPDOWN (children)
  if (item.children) {
    return (
      <div key={item.label}>
        {divider}
        <div className="mb-1">
          <button type="button" onClick={onItemClick} className={`sb-item ${isParentActive ? 'is-active' : ''}`}>
            <Icon size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="sb-children">
              {visibleChildren.map((child, idx) => {
                const ChildIcon = child.icon;
                const active = isChildActive(child, idx === 0);
                return (
                  <button
                    type="button"
                    key={child.path}
                    onClick={() => onChildClick(child.path)}
                    className={`sb-child ${active ? 'is-active' : ''}`}
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
  const isActive = item.matchPrefix ? matchesPrefix(pathname, item.matchPrefix) : item.path === pathname;
  const isDisabled = !item.path;

  return (
    <div key={item.label}>
      {divider}
      <button
        type="button"
        onClick={onItemClick}
        disabled={isDisabled}
        title={isDisabled ? 'Segera hadir' : undefined}
        className={`sb-item mb-1 ${isActive ? 'is-active' : ''} ${isDisabled ? 'is-disabled' : ''}`}
      >
        <Icon size={18} />
        {item.label}
      </button>
    </div>
  );
}
