import React from 'react';
import { Button } from 'reshaped';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const { currentPage, setCurrentPage, theme, setTheme } = useApp();
  
  const navItems = [
    { id: 'page-icons', label: 'Icon Studio' },
    { id: 'page-id-2d', label: '2D Studio' },
    { id: 'page-id-3d', label: '3D Studio' },
    { id: 'page-image', label: 'Image Studio' },
  ];
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };
  
  return (
    <header
      className="app-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color, #e0e0e0)',
      }}
    >
      <div className="logo">
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Creon</h1>
      </div>
      <nav className="main-nav" style={{ display: 'flex', gap: '16px' }}>
        <a
          href="#"
          className={`nav-item ${currentPage === 'page-usages' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage('page-usages');
          }}
          style={{
            padding: '8px 16px',
            textDecoration: 'none',
            color: currentPage === 'page-usages' ? 'var(--accent-color, #2962FF)' : 'var(--text-primary, #212121)',
            borderBottom: currentPage === 'page-usages' ? '2px solid var(--accent-color, #2962FF)' : '2px solid transparent'
          }}
        >
          Home
        </a>
        {navItems.map((item) => (
          <a
            key={item.id}
            href="#"
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(item.id);
            }}
            style={{
              padding: '8px 16px',
              textDecoration: 'none',
              color: currentPage === item.id ? 'var(--accent-color, #2962FF)' : 'var(--text-primary, #212121)',
              borderBottom: currentPage === item.id ? '2px solid var(--accent-color, #2962FF)' : '2px solid transparent'
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
        <Button variant="ghost" size="small">
          <span className="material-symbols-outlined">storage</span>
        </Button>
        <Button
          variant="ghost"
          size="small"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
        >
          <span className="material-symbols-outlined">
            {theme === 'light' ? 'light_mode' : 'dark_mode'}
          </span>
        </Button>
        <Button variant="ghost" size="small">
          <span className="material-symbols-outlined">settings</span>
        </Button>
        <Button variant="ghost" size="small">
          <span className="material-symbols-outlined">account_circle</span>
        </Button>
      </div>
    </header>
  );
};

