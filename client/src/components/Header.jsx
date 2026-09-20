import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X, Zap } from 'lucide-react';

export default function Header({ cartCount, onCart, onSearch }) {
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const submit = (e) => { e.preventDefault(); if (search.trim()) onSearch(search.trim()); };

  return <header className="site-header">
    <Link className="brand" to="/"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span> SIGNAL</Link>
    <nav className={menu ? 'main-nav open' : 'main-nav'}>
      <NavLink to="/" onClick={() => setMenu(false)}>Discover</NavLink>
      <NavLink to="/shop" onClick={() => setMenu(false)}>Shop</NavLink>
      <NavLink to="/admin" onClick={() => setMenu(false)}>Admin</NavLink>
    </nav>
    <div className="header-actions">
      {location.pathname !== '/admin' && <form className="header-search" onSubmit={submit}>
        <Search size={17} /><input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gear" />
      </form>}
      <button className="icon-button cart-button" aria-label="Open cart" onClick={onCart}><ShoppingBag size={20} />{cartCount > 0 && <span>{cartCount}</span>}</button>
      <button className="icon-button menu-button" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
    </div>
  </header>;
}
