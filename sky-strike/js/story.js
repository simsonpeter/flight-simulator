export const CHARACTERS = [
  { id: 'kai', name: 'Kai', role: 'Durfal', color: '#4aa3ff', bio: 'Houdt van snelheid. Blijft rijden als het gevaarlijk wordt.' },
  { id: 'nora', name: 'Nora', role: 'Strateeg', color: '#7dffd4', bio: 'Ziet de valkuil eerder dan de rest. Koel onder druk.' },
  { id: 'max', name: 'Max', role: 'Racer', color: '#e7c36a', bio: 'Niemand trekt harder op. De Autobahn is zijn thuis.' },
  { id: 'lina', name: 'Lina', role: 'Koelbloedig', color: '#ff7a6a', bio: 'Praat weinig, handelt snel. Perfect voor een ontsnapping.' }
];

export const FRIENDS = [
  { id: 'daan', name: 'Daan', city: 'Keulen', pronoun: 'hij', poss: 'zijn', color: '#7dffd4', trait: 'Grapt zelfs als de sirenes loeien.' },
  { id: 'yara', name: 'Yara', city: 'Keulen', pronoun: 'zij', poss: 'haar', color: '#e7c36a', trait: 'Regelt alles, inclusief de Tesla.' },
  { id: 'finn', name: 'Finn', city: 'Keulen', pronoun: 'hij', poss: 'zijn', color: '#4aa3ff', trait: 'Heeft de sleutels al in de aanslag.' }
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function getFriend(id) {
  return FRIENDS.find((f) => f.id === id) || FRIENDS[0];
}

export function storyBeats(character, friend) {
  return [
    {
      kicker: 'DUITSLAND · KEULEN',
      title: 'Een bericht',
      speaker: friend.name,
      text: `Hey ${character.name}! Kom je langs bij mij thuis? Ik woon in Keulen. Ik heb iets groots voor je.`,
      btn: 'NAAR KEULEN'
    },
    {
      kicker: `${friend.poss.toUpperCase()} HUIS`,
      title: 'Tesla Model X',
      speaker: friend.name,
      text: `Verrassing. Jij krijgt de Tesla Model X. Maar we moeten nú weg. Er zitten gevaarlijke boeven achter ons aan. Rijd naar het vliegveld.`,
      btn: 'PAK DE SLEUTELS'
    },
    {
      kicker: 'AUTOBAHN A4',
      title: 'Ontsnapping',
      speaker: 'Doel',
      text: `Rijd van Keulen naar het vliegveld. Ontwijk de boeven. Daarna koop je een vliegticket en vlieg je als passagier naar België.`,
      btn: 'START RIT'
    }
  ];
}

export function airportBeat(character, friend) {
  return {
    kicker: 'VLIEGVELD KEULEN',
    title: 'Vliegticket',
    speaker: friend.name,
    text: `We zijn er, ${character.name}. Hier is €400. Koop een ticket naar Brussel bij de balie. Daarna stappen we in het vliegtuig.`,
    btn: 'NAAR CHECK-IN'
  };
}

export function boardingBeat(character) {
  return {
    kicker: 'GATE A12',
    title: 'Boarding',
    speaker: 'Steward',
    text: `Welkom aan boord, ${character.name}. Stoel 12A bij het raam. Bestemming Brussel. Gelieve te gaan zitten.`,
    btn: 'GA ZITTEN'
  };
}

export function freedomBeat(character, friend) {
  return {
    kicker: 'BELGIË · BRUSSEL',
    title: 'Freedom',
    speaker: friend.name,
    text: `We zijn er, ${character.name}. Je bent vrij. Loop naar de groene lichten, druk op E, en je krijgt een job. Verdien geld, koop een huis, doe wat je wilt.`,
    btn: 'DE STAD IN'
  };
}
