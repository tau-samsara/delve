(function boot() {
  'use strict';

  // <html> may not exist yet at document-start; wait for it.
  if (!document.documentElement) { setTimeout(boot, 5); return; }
  const root = document.documentElement;

