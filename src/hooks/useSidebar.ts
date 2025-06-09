"use client";

import { useState, useSyncExternalStore } from "react";

// Create a store for window size that doesn't use useEffect
function getSnapshot() {
  return typeof window !== "undefined" ? window.innerWidth : 1024;
}

function getServerSnapshot() {
  return 1024; // Default desktop size for SSR
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

export function useSidebar() {
  const windowWidth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDesktop = windowWidth >= 768;
  
  // Initialize state based on localStorage (desktop) or always false for mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    
    if (isDesktop) {
      const saved = localStorage.getItem('t2chat-sidebar-open');
      return saved !== null ? saved === 'true' : true;
    }
    return false; // Always start closed on mobile
  });

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    
    // Save preference to localStorage on desktop only
    if (typeof window !== "undefined" && isDesktop) {
      localStorage.setItem('t2chat-sidebar-open', newState.toString());
    }
  };

  return { sidebarOpen, toggleSidebar, isDesktop };
} 