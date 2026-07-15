// Parser mínimo de iCalendar (.ics) — RFC 5545 — para importar tarefas
// exportadas do Toddle / Google / Outlook Calendar. Puro (sem I/O), pra
// ser testável e rodar tanto no server quanto em testes.

export type ParsedIcsEvent = {
  title: string;
  dueDate: Date | null;
  description: string | null;
  /** Primeira categoria (CATEGORIES) — usada como "matéria" da tarefa quando
   * o calendário do Toddle marca disciplina (ex: "Matemática, EF9"). */
  category: string | null;
};

// Desfaz o "line folding" do iCalendar: linhas de continuação começam com
// espaço ou tab e pertencem à linha anterior.
function unfoldLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

// Decodifica os escapes de texto do iCalendar.
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Converte um valor de data iCalendar em Date. Suporta:
//   20260715              (só data)
//   20260715T090000       (local / flutuante)
//   20260715T090000Z      (UTC)
// Retorna null se não reconhecer. TZID (fuso explícito) é tratado como
// horário local — aproximação aceitável para prazo de tarefa.
export function parseIcsDate(value: string): Date | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    const Y = Number(y), M = Number(mo), D = Number(d);
    // Guard contra JS normalizando data inválida em silêncio.
    // "20261332" (mês 13, dia 32) viraria Feb/2027 sem esse check.
    if (M < 1 || M > 12 || D < 1 || D > 31) return null;
    const dt = new Date(Y, M - 1, D);
    if (dt.getFullYear() !== Y || dt.getMonth() !== M - 1 || dt.getDate() !== D) {
      return null; // rolou overflow silencioso (ex: 30/fev vira 2/mar)
    }
    return dt;
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (dateTime) {
    const [, y, mo, d, h, mi, s, z] = dateTime;
    const Y = Number(y), M = Number(mo), D = Number(d);
    const H = Number(h), Mi = Number(mi), S = Number(s);
    if (M < 1 || M > 12 || D < 1 || D > 31) return null;
    if (H > 23 || Mi > 59 || S > 59) return null;
    if (z) {
      const dt = new Date(Date.UTC(Y, M - 1, D, H, Mi, S));
      if (dt.getUTCFullYear() !== Y || dt.getUTCMonth() !== M - 1 || dt.getUTCDate() !== D) return null;
      return dt;
    }
    const dt = new Date(Y, M - 1, D, H, Mi, S);
    if (dt.getFullYear() !== Y || dt.getMonth() !== M - 1 || dt.getDate() !== D) return null;
    return dt;
  }
  return null;
}

// Separa "NOME;PARAM=x:valor" em { name, value }. O valor pode conter ':'
// (ex: URLs em DESCRIPTION), então quebramos só no PRIMEIRO ':'.
function splitProperty(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = left.indexOf(";");
  const name = (semi === -1 ? left : left.slice(0, semi)).trim().toUpperCase();
  if (!name) return null;
  return { name, value };
}

const RELEVANT = ["SUMMARY", "DTSTART", "DTEND", "DUE", "DESCRIPTION", "CATEGORIES"];

// Extrai os eventos (VEVENT) e afazeres (VTODO) de um arquivo .ics.
// Cada bloco vira uma tarefa: título = SUMMARY, prazo = DUE > DTSTART > DTEND.
// Blocos sem SUMMARY são ignorados (não dá pra criar tarefa sem título).
export function parseIcs(raw: string): ParsedIcsEvent[] {
  if (!raw || typeof raw !== "string") return [];
  const lines = unfoldLines(raw);
  const events: ParsedIcsEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT" || trimmed === "BEGIN:VTODO") {
      cur = {};
      continue;
    }
    if (trimmed === "END:VEVENT" || trimmed === "END:VTODO") {
      if (cur) {
        const title = cur.SUMMARY ? unescapeText(cur.SUMMARY).trim() : "";
        const rawDate = cur.DUE || cur.DTSTART || cur.DTEND || "";
        const dueDate = rawDate ? parseIcsDate(rawDate) : null;
        const description = cur.DESCRIPTION ? unescapeText(cur.DESCRIPTION).trim() : "";
        // CATEGORIES pode ter várias, separadas por vírgula. Pegamos a
        // primeira como "matéria" — geralmente a mais específica (ex:
        // "Matemática, EF9, prova" → "Matemática"). Vazias/whitespace
        // são ignoradas.
        let category: string | null = null;
        if (cur.CATEGORIES) {
          const first = unescapeText(cur.CATEGORIES)
            .split(",")
            .map((s) => s.trim())
            .find((s) => s.length > 0);
          category = first ?? null;
        }
        if (title) {
          events.push({ title, dueDate, description: description || null, category });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const prop = splitProperty(line);
    // Primeira ocorrência de cada campo vence.
    if (prop && RELEVANT.includes(prop.name) && !(prop.name in cur)) {
      cur[prop.name] = prop.value;
    }
  }
  return events;
}
