import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps) => {
  const handleNavigation = (href: string) => {
    window.location.href = href;
  };

  return (
    <nav className={`flex items-center space-x-2 text-sm text-muted-foreground ${className}`} aria-label="Breadcrumb" dir="rtl">
      <button
        onClick={() => handleNavigation('/')}
        className="hover:text-foreground transition-colors cursor-pointer"
        aria-label="الصفحة الرئيسية"
      >
        الرئيسية
      </button>
      
      {items.map((item, index) => (
        <Fragment key={index}>
          <span className="mx-2">/</span>
          
          {item.href && !item.active ? (
            <button
              onClick={() => handleNavigation(item.href!)}
              className="hover:text-foreground transition-colors cursor-pointer"
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </button>
          ) : (
            <span 
              className={item.active ? 'text-foreground font-medium' : ''}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
};