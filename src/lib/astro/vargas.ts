import { degInSign, isOddSign, signModality, signOf } from "./constants";

/**
 * Parashari divisional charts (vargas). Each function maps a sidereal longitude to the sign
 * index (0-11) it occupies in that division.
 */
export type Varga = "D1" | "D2" | "D3" | "D4" | "D7" | "D9" | "D10" | "D12" | "D16" | "D20" | "D24" | "D30" | "D60";

export const VARGA_INFO: Record<Varga, { en: string; ru: string; area: string }> = {
  D1: { en: "Rashi", ru: "Раши", area: "body, life as a whole" },
  D2: { en: "Hora", ru: "Хора", area: "wealth" },
  D3: { en: "Drekkana", ru: "Дреккана", area: "siblings, courage" },
  D4: { en: "Chaturthamsha", ru: "Чатуртхамша", area: "property, home, fortune" },
  D7: { en: "Saptamsha", ru: "Саптамша", area: "children, progeny" },
  D9: { en: "Navamsha", ru: "Навамша", area: "marriage, dharma, inner strength of planets" },
  D10: { en: "Dashamsha", ru: "Дашамша", area: "career, profession" },
  D12: { en: "Dwadashamsha", ru: "Двадашамша", area: "parents, ancestry" },
  D16: { en: "Shodashamsha", ru: "Шодашамша", area: "vehicles, comforts, happiness" },
  D20: { en: "Vimshamsha", ru: "Вимшамша", area: "spiritual practice" },
  D24: { en: "Chaturvimshamsha", ru: "Чатурвимшамша", area: "education, learning" },
  D30: { en: "Trimshamsha", ru: "Тримшамша", area: "misfortunes, character flaws" },
  D60: { en: "Shashtiamsha", ru: "Шаштиамша", area: "past karma, overall verification" },
};

export const VARGAS = Object.keys(VARGA_INFO) as Varga[];

const mod12 = (x: number) => ((x % 12) + 12) % 12;

export function vargaSign(lon: number, varga: Varga): number {
  const s = signOf(lon);
  const d = degInSign(lon);
  const odd = isOddSign(s);
  const mod = signModality(s);
  switch (varga) {
    case "D1":
      return s;
    case "D2": // Parashara hora: odd signs Sun (Leo) then Moon (Cancer); even signs reversed
      return d < 15 === odd ? 4 : 3;
    case "D3":
      return mod12(s + 4 * Math.floor(d / 10));
    case "D4":
      return mod12(s + 3 * Math.floor(d / 7.5));
    case "D7":
      return mod12((odd ? s : s + 6) + Math.floor(d / (30 / 7)));
    case "D9":
      return mod12(s * 9 + Math.floor(d / (30 / 9)));
    case "D10":
      return mod12((odd ? s : s + 8) + Math.floor(d / 3));
    case "D12":
      return mod12(s + Math.floor(d / 2.5));
    case "D16": {
      const start = mod === "movable" ? 0 : mod === "fixed" ? 4 : 8;
      return mod12(start + Math.floor(d / (30 / 16)));
    }
    case "D20": {
      const start = mod === "movable" ? 0 : mod === "fixed" ? 8 : 4;
      return mod12(start + Math.floor(d / 1.5));
    }
    case "D24":
      return mod12((odd ? 4 : 3) + Math.floor(d / 1.25));
    case "D30": {
      // Unequal divisions ruled by Mars, Saturn, Jupiter, Mercury, Venus.
      if (odd) {
        if (d < 5) return 0; // Aries (Mars)
        if (d < 10) return 10; // Aquarius (Saturn)
        if (d < 18) return 8; // Sagittarius (Jupiter)
        if (d < 25) return 2; // Gemini (Mercury)
        return 6; // Libra (Venus)
      }
      if (d < 5) return 1; // Taurus (Venus)
      if (d < 12) return 5; // Virgo (Mercury)
      if (d < 20) return 11; // Pisces (Jupiter)
      if (d < 25) return 9; // Capricorn (Saturn)
      return 7; // Scorpio (Mars)
    }
    case "D60":
      return mod12(s + Math.floor(d * 2));
  }
}

/**
 * Vargottama: a planet occupying the same sign in D1 and D9, traditionally a source of strength.
 */
export const isVargottama = (lon: number) => vargaSign(lon, "D1") === vargaSign(lon, "D9");
