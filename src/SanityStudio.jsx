import React from 'react';
import { Studio } from 'sanity';
import sanityConfig from '../sanity.config';

export default function SanityStudioView() {
  return (
    <div className="w-full h-[calc(100vh-5rem)] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
      <Studio config={sanityConfig} />
    </div>
  );
}
