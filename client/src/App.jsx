import { useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { Navbar, Footer } from './components/UI.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import Interview from './pages/Interview.jsx';
import Results from './pages/Results.jsx';
import Progress from './pages/Progress.jsx';
export default function App() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) { setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior: 'smooth'}), 50); }
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return <><a className="skip-link" href="#main">Skip to content</a><Navbar/><Routes><Route path="/" element={<Home/>}/><Route path="/practice" element={<Practice/>}/><Route path="/interview/:id" element={<Interview/>}/><Route path="/results/:id" element={<Results/>}/><Route path="/progress" element={<Progress/>}/><Route path="*" element={<main id="main" className="page"><h1>Wrong turn.<br/>Right place.</h1><p>This page doesn't exist.</p><Link className="button coral" to="/">Back to home</Link></main>}/></Routes><Footer/></>;
}
