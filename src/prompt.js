export function buildSystemPrompt(memories = [], isCorrection = false, isFact = false, basePrompt = '') {
  const contextBlock = memories.length
    ? '\n📚 SOUVENIRS PERTINENTS (mémoire longue):\n' + memories.map((m, i) =>
      `[${i+1}] (${m.metadata.type}) ${m.content.slice(0, 300)}`
    ).join('\n')
    : '\n📚 Aucun souvenir pertinent trouvé.';

  const correctionNote = isCorrection
    ? '\n⚠️ L\'utilisateur te corrige. Reconnais l\'erreur, remercie-le, et adapte ta réponse.'
    : '';

  const factNote = isFact
    ? '\n📝 L\'utilisateur te donne un fait à mémoriser. Intègre-le naturellement.'
    : '';

  return `${basePrompt}${contextBlock}${correctionNote}${factNote}

Règles :
- N'invente jamais d'informations.
- Si un souvenir contredit une connaissance générale, privilégie le souvenir (expérience vécue).
- Sois concis et naturel.`;
}
