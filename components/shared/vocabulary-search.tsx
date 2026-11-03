"use client";

import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Word } from "@/types/domain";

export function VocabularySearch({
  words,
  onSearch,
}: {
  words: Word[];
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return [];
    return words
      .filter((word) =>
        `${word.term} ${word.translation || ""}`.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [value, words]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(value.trim());
    setOpen(false);
  }

  function choose(term: string) {
    setValue(term);
    onSearch(term);
    setOpen(false);
  }

  return (
    <div className="search-autocomplete vocabulary-search">
      <form className="search-box" role="search" onSubmit={submit}>
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Pesquisar no seu vocabulário..."
          aria-label="Pesquisar no vocabulário"
        />
        <button
          className="button search-submit"
          type="submit"
          aria-label="Pesquisar no vocabulário"
          title="Pesquisar"
        >
          <Search aria-hidden="true" />
        </button>
      </form>
      {open && suggestions.length > 0 && (
        <div className="suggestion-list" role="listbox">
          {suggestions.map((word) => (
            <button
              type="button"
              className="suggestion-option"
              key={word.normalized}
              onClick={() => choose(word.term)}
            >
              <strong>{word.term}</strong>
              {word.translation && <small>{word.translation}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
