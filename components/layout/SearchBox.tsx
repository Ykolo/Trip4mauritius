"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { regionLabel } from "@/lib/regions";
import { useTRPC } from "@/lib/trpc/client";

// Barre de recherche avec suggestions.
//
// Deux manques signalés par le client, traités ici :
//
//  1. Ouvrir la barre ne proposait rien. Un champ vide n'apprend au visiteur ni
//     ce qu'il peut chercher, ni que la recherche existe. À l'ouverture, on
//     propose donc les activités les mieux notées.
//  2. Une recherche infructueuse ne disait rien. Elle le dit maintenant à deux
//     endroits : ici sous le champ, et sur la page de résultats.
//
// Le motif suivi est celui d'une `combobox` ARIA : le champ porte
// `aria-expanded` et `aria-activedescendant`, la liste est une `listbox`. Sans
// ça, un lecteur d'écran annonce un champ de texte ordinaire et ne signale
// jamais l'apparition des suggestions.

/** Assez court pour suivre la frappe, assez long pour ne pas requêter chaque lettre. */
const DEBOUNCE_MS = 250;

export function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const trpc = useTRPC();
  const listboxId = useId();

  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // Index de la suggestion survolée au clavier. -1 = aucune, la validation
  // lance alors la recherche plein texte au lieu d'ouvrir une fiche.
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);

  // La requête ne part QUE si la liste est ouverte : sans ce garde-fou, chaque
  // page du site interrogerait le serveur au montage de son en-tête.
  const { data: suggestions = [], isFetching } = useQuery({
    ...trpc.activity.suggest.queryOptions({ q: debounced || undefined }),
    enabled: isOpen,
  });

  // Fermer au clic extérieur. Sans ça, la liste reste ouverte par-dessus le
  // contenu et il faut viser le champ pour s'en débarrasser.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  // La liste a changé sous le curseur : le remettre à zéro évite d'ouvrir la
  // fiche d'une activité que l'utilisateur n'a jamais vue surlignée.
  useEffect(() => setActiveIndex(-1), [suggestions]);

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  /** Recherche plein texte : le mot-clé tel quel, vers la page de résultats. */
  function submitKeyword() {
    const trimmed = keyword.trim();
    router.push(
      trimmed ? `/activities?q=${encodeURIComponent(trimmed)}` : "/activities",
    );
    close();
    inputRef.current?.blur();
    onDone?.();
  }

  function openSuggestion(slug: string) {
    router.push(`/activities/${slug}`);
    close();
    inputRef.current?.blur();
    onDone?.();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Le curseur du champ sauterait en début ou fin de texte sinon.
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (suggestions.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      // On repart de -1 (« aucune ») après le dernier : c'est ce qui permet de
      // revenir à la recherche plein texte sans lâcher le clavier.
      const next = activeIndex + delta;
      setActiveIndex(next >= suggestions.length ? -1 : next < -1 ? suggestions.length - 1 : next);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked) openSuggestion(picked.slug);
      else submitKeyword();
    }
  }

  const showEmptyState =
    isOpen && debounced.length > 0 && !isFetching && suggestions.length === 0;

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitKeyword();
        }}
      >
        {/* La loupe est le bouton de soumission, pas une décoration. Sans bouton
            `submit`, la validation implicite à la touche Entrée n'est pas
            garantie — et rien n'indiquait comment lancer la recherche. */}
        <button
          type="submit"
          aria-label="Lancer la recherche"
          className="absolute left-0 top-0 h-10 w-10 flex items-center justify-center text-primary/60 hover:text-primary transition-colors z-10"
        >
          <Search className="w-5 h-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          // `type="text"` et non `search` : la croix native de Chrome se
          // superpose à la nôtre et n'annonce rien aux lecteurs d'écran.
          autoComplete="off"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher une activité…"
          aria-label="Rechercher une activité"
          className="w-full h-10 pl-10 pr-10 rounded-2xl border border-primary/20 bg-primary/5 text-ink placeholder:text-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/50 font-body text-sm"
        />

        {keyword && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-primary/60 hover:text-primary active:scale-95 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-white shadow-card border border-muted/10 overflow-hidden z-50">
          {/* En-tête seulement quand rien n'est tapé : annoncer « Suggestions »
              au-dessus de résultats de recherche serait faux. */}
          {debounced.length === 0 && suggestions.length > 0 && (
            <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
              Idées de sorties
            </p>
          )}

          {showEmptyState ? (
            <div className="px-4 py-4">
              <p className="text-sm text-ink">
                Aucune activité pour «&nbsp;{debounced}&nbsp;».
              </p>
              <p className="text-sm text-muted mt-1">
                Essayez un lieu (Grand Baie), une région (Nord) ou un type de
                sortie (plongée).
              </p>
            </div>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Suggestions">
              {suggestions.map((s, i) => (
                <li key={s.slug} role="none">
                  <button
                    type="button"
                    id={`${listboxId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // `onMouseDown` et non `onClick` : le clic ferme d'abord la
                    // liste par le `pointerdown` extérieur, et `onClick` ne
                    // partirait jamais.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      openSuggestion(s.slug);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      i === activeIndex ? "bg-primary/10" : "hover:bg-primary/5"
                    }`}
                  >
                    <span className="block text-sm text-ink truncate">
                      {s.title}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden />
                      {regionLabel(s.region)} · {s.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Le renvoi vers la page complète : la liste est plafonnée, et c'est
              le seul moyen de voir le reste. Masqué quand il n'y a rien à voir. */}
          {debounced.length > 0 && !showEmptyState && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                submitKeyword();
              }}
              className="w-full text-left px-4 py-2.5 border-t border-muted/10 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              {isFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Recherche…
                </span>
              ) : (
                <>Voir tous les résultats pour «&nbsp;{debounced}&nbsp;»</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
