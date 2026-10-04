/**
 * Destaque prévio de palavras "difíceis" do passage (Trilha C).
 * Heurística leve: palavras longas (>= 10 letras) ou pouco frequentes
 * (>= 8 letras fora da lista de palavras comuns do inglês).
 */

// eslint-disable-next-line prettier/prettier
const COMMON = new Set(
  (
    "the be to of and a in that have it for not on with he as do at this but his by from they we say her she or an " +
    "will my one all would there their what so up out if about who get which go me when make can like time no just " +
    "him know take people into year your good some could them see other than then now look only come its over think " +
    "also back after use two how our work first well way even new want because any these give day most us is are was " +
    "were been has had did having may should must shall being does done made many much before between during through " +
    "under above below both few more same such very you your i my myself our ours themselves itself himself herself " +
    "say says said get gets got make makes made go goes went come comes came take takes took see sees saw know knows " +
    "think thinks use uses used find finds found tell told ask asked seem seems feel felt try tried leave left call " +
    "called need needs keep kept let begin began help helps talking talk turn started start show showed play read " +
    "readers reading study studies learn learned live lives believe hold bring happens happen set sit stand lose pay " +
    "include continue lead learn change mean means produce provide build stay key major public government social " +
    "high different small large great important young early little national right own old next early local young " +
    "important few public bad same able"
  ).split(" "),
);

function clean(word: string): string {
  return word.replace(/[^A-Za-z'-]/g, "");
}

/** Índices das palavras que merecem destaque prévio de leitura. */
export function hardWordIndexes(words: string[]): number[] {
  const out: number[] = [];
  words.forEach((word, i) => {
    const w = clean(word);
    if (w.length === 0) return;
    const isHard = w.length >= 10 || (w.length >= 8 && !COMMON.has(w.toLowerCase()));
    if (isHard) out.push(i);
  });
  return out;
}
