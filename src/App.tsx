import React from 'react';
import { RealPillSyncApp } from './components/RealPillSyncApp';

export default function App() {
  return (
    <div className="min-h-screen w-full bg-slate-100 flex justify-center text-[#1F2937] font-sans antialiased">
      <main className="w-full sm:max-w-md h-[100dvh] bg-[#F9FAFB] sm:shadow-2xl flex flex-col relative overflow-hidden">
        <RealPillSyncApp />
      </main>
    </div>
  );
}
