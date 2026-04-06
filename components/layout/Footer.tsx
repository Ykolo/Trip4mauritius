"use client";

import { useState } from "react";
import { Globe, ChevronUp, Instagram, Facebook, Ghost, Video, Apple, Shield, Trophy, Zap } from "lucide-react";

const languages = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

const currencies = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "MUR", symbol: "Rs", label: "Roupie Mauricienne" },
  { code: "GBP", symbol: "£", label: "Livre Sterling" },
];

export function Footer() {
  const [selectedLang, setSelectedLang] = useState(languages[0]);
  const [isLangOpen, setIsLangOpen] = useState(false);
  
  const [selectedCur, setSelectedCur] = useState(currencies[0]);
  const [isCurOpen, setIsCurOpen] = useState(false);

  return (
    <footer className="bg-primary pt-10 pb-32 px-4 text-center mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">
        
        {/* Ligne 1 : Marque & Réseaux Sociaux */}
        <div className="flex flex-col items-center gap-4">
          <span className="font-display text-3xl text-white drop-shadow-sm">MauriExplore</span>
          
          <div className="flex items-center gap-4">
            <a href="https://instagram.com" target="_blank" className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 hover:scale-110 transition-all">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="https://facebook.com" target="_blank" className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 hover:scale-110 transition-all">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="https://snapchat.com" target="_blank" className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 hover:scale-110 transition-all">
              <Ghost className="w-5 h-5" />
            </a>
            <a href="https://tiktok.com" target="_blank" className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 hover:scale-110 transition-all">
              <Video className="w-5 h-5" />
            </a>
          </div>
        </div>
        
        {/* Ligne 2 : Sélecteurs de Langue et Devise (côte à côte) */}
        <div className="flex items-center gap-4">
          {/* Menu Langue */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-white/30 bg-white/15 text-white active:scale-95 transition-transform min-w-[140px]"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-white/70" />
                <span className="font-body text-sm font-semibold">{selectedLang.flag} {selectedLang.label}</span>
              </div>
              <ChevronUp className={`w-4 h-4 text-white/70 transition-transform ${isLangOpen ? "rotate-180" : ""}`} />
            </button>

            {isLangOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 mb-1 z-50 bg-surface rounded-2xl shadow-card border border-muted/20 py-2 w-full min-w-[160px]">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setSelectedLang(lang); setIsLangOpen(false); }}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 font-body text-sm hover:bg-base transition-colors ${
                        selectedLang.code === lang.code ? "text-primary font-bold bg-primary/5" : "text-ink"
                      }`}
                    >
                      <span className="text-lg leading-none">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Menu Devise */}
          <div className="relative">
            <button
              onClick={() => setIsCurOpen(!isCurOpen)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-white/30 bg-white/15 text-white active:scale-95 transition-transform min-w-[100px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-semibold">{selectedCur.code} ({selectedCur.symbol})</span>
              </div>
              <ChevronUp className={`w-4 h-4 text-white/70 transition-transform ${isCurOpen ? "rotate-180" : ""}`} />
            </button>

            {isCurOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsCurOpen(false)} />
                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 mb-1 z-50 bg-surface rounded-2xl shadow-card border border-muted/20 py-2 w-full min-w-[140px]">
                  {currencies.map((cur) => (
                    <button
                      key={cur.code}
                      onClick={() => { setSelectedCur(cur); setIsCurOpen(false); }}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 font-body text-sm hover:bg-base transition-colors ${
                        selectedCur.code === cur.code ? "text-primary font-bold bg-primary/5" : "text-ink"
                      }`}
                    >
                      <span>{cur.code}</span>
                      <span className="text-muted ml-auto">{cur.symbol}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Séparateur */}
        <div className="w-16 h-px bg-white/20" />

        {/* Réassurance : Pourquoi nous ? */}
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-body text-xs font-semibold text-white">Paiement Sécurisé</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="font-body text-xs font-semibold text-white">Guides Locaux</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-body text-xs font-semibold text-white">Confirmation Instantanée</span>
            </div>
          </div>
        </div>
        
        {/* Ligne 3 : Moyens de Paiement (Logos vectoriels / CSS Mockup) */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold text-white/80 font-body uppercase tracking-widest">Paiement 100% Sécurisé</p>
          <div className="flex items-center gap-3 mt-1">
             {/* Visa (CSS Mockup) */}
             <div className="bg-white border border-muted/20 px-2 py-1 rounded shadow-sm flex items-center justify-center">
               <span className="text-[#1434CB] font-bold text-sm italic font-sans tracking-tighter">VISA</span>
             </div>
             {/* Mastercard (CSS Mockup) */}
             <div className="bg-white border border-muted/20 px-2 py-1.5 rounded shadow-sm flex items-center justify-center gap-[-4px]">
               <div className="w-4 h-4 bg-[#EB001B] rounded-full mix-blend-multiply opacity-90 -mr-1.5"></div>
               <div className="w-4 h-4 bg-[#F79E1B] rounded-full mix-blend-multiply opacity-90"></div>
             </div>
             {/* Apple Pay */}
             <div className="bg-white border border-muted/20 px-2 py-1.5 rounded shadow-sm flex items-center justify-center gap-1">
               <Apple className="w-3.5 h-3.5 fill-black text-black" />
               <span className="text-black font-semibold text-xs tracking-tight">Pay</span>
             </div>
             {/* Google Pay */}
             <div className="bg-white border border-muted/20 px-2 py-1.5 rounded shadow-sm flex items-center justify-center gap-0.5">
               <span className="text-blue-500 font-bold text-[13px] tracking-tighter">G</span>
               <span className="text-gray-500 font-medium text-[13px] tracking-tight">Pay</span>
             </div>
             {/* PayPal */}
             <div className="bg-white border border-muted/20 px-2 py-1.5 rounded shadow-sm flex items-center justify-center">
               <span className="text-[#003087] font-bold text-[13px] italic">Pay</span>
               <span className="text-[#0079C1] font-bold text-[13px] italic">Pal</span>
             </div>
          </div>
        </div>
        
        {/* Links & Copyright */}
        <div className="flex flex-col items-center mt-4">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
              <a href="#" className="font-body text-xs text-white/70 hover:text-white">Mentions Légales</a>
              <a href="#" className="font-body text-xs text-white/70 hover:text-white">Politique de Confidentialité</a>
              <a href="#" className="font-body text-xs text-white/70 hover:text-white">Devenir Opérateur</a>
          </div>
          <p className="text-[10px] text-white/50 font-body uppercase tracking-widest">
            © {new Date().getFullYear()} MauriExplore Luxury
          </p>
        </div>

      </div>
    </footer>
  );
}
