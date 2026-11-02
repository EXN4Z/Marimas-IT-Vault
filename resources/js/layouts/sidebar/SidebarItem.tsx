import type { CSSProperties } from 'react';
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
}

// Baris menu di panel sidebar. Gaya lewat kelas .it / .kids / .kid (index.css, blok "MV SHELL").
// Tanpa wrapper div: struktur harus identik dengan sidebar-gabungan.html.
export default function SidebarItem({
  item,
  pathname,
  isParentActive,
  isDropdownOpen,
  visibleChildren,
  isChildActive,
  onItemClick,
  onChildClick,
}: SidebarItemProps) {
  const Icon = item.icon;

  // ITEM DENGAN DROPDOWN (children)
  if (item.children) {
    return (
      <>
        <button
          type="button"
          onClick={onItemClick}
          className={`it${isParentActive ? ' on' : ''}${isDropdownOpen ? ' open' : ''}`}
        >
          <Icon />
          <span className="t">{item.label}</span>
          <ChevronDown className="chev" />
        </button>
        <div className={`kids${isDropdownOpen ? ' open' : ''}`}>
          <div className="ki">
            {visibleChildren.map((child, idx) => {
              const ChildIcon = child.icon;
              return (
                <button
                  type="button"
                  key={child.path}
                  style={{ '--i': idx } as CSSProperties}
                  className={`kid${isChildActive(child, idx === 0) ? ' on' : ''}`}
                  onClick={() => onChildClick(child.path)}
                >
                  <ChildIcon />
                  {child.label}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ITEM BIASA (tanpa dropdown)
  const isActive = item.matchPrefix ? matchesPrefix(pathname, item.matchPrefix) : item.path === pathname;

  return (
    <button type="button" className={`it${isActive ? ' on' : ''}`} onClick={onItemClick}>
      <Icon />
      <span className="t">{item.label}</span>
    </button>
  );
}
