import { tr } from './i18n.js';

export const CHARACTERS = [
  { id: 'kai', name: 'Kai', color: '#4aa3ff', roleKey: 'charKaiRole', bioKey: 'charKaiBio' },
  { id: 'nora', name: 'Nora', color: '#7dffd4', roleKey: 'charNoraRole', bioKey: 'charNoraBio' },
  { id: 'max', name: 'Max', color: '#e7c36a', roleKey: 'charMaxRole', bioKey: 'charMaxBio' },
  { id: 'lina', name: 'Lina', color: '#ff7a6a', roleKey: 'charLinaRole', bioKey: 'charLinaBio' }
];

export const FRIENDS = [
  { id: 'daan', name: 'Daan', city: 'Keulen', pronoun: 'hij', poss: 'zijn', color: '#7dffd4', traitKey: 'friendDaan' },
  { id: 'yara', name: 'Yara', city: 'Keulen', pronoun: 'zij', poss: 'haar', color: '#e7c36a', traitKey: 'friendYara' },
  { id: 'finn', name: 'Finn', city: 'Keulen', pronoun: 'hij', poss: 'zijn', color: '#4aa3ff', traitKey: 'friendFinn' }
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function getFriend(id) {
  return FRIENDS.find((f) => f.id === id) || FRIENDS[0];
}

export function localizeCharacter(c) {
  return { ...c, role: tr(c.roleKey), bio: tr(c.bioKey) };
}

export function localizeFriend(f) {
  return { ...f, city: tr('locCologne'), trait: tr(f.traitKey) };
}

export function storyBeats(character, friend) {
  return [
    {
      kicker: tr('storyKicker1'),
      title: tr('storyTitle1'),
      speaker: friend.name,
      text: tr('storyText1', { name: character.name }),
      btn: tr('storyBtn1')
    },
    {
      kicker: tr('storyKicker2', { friend: friend.name }),
      title: tr('storyTitle2'),
      speaker: friend.name,
      text: tr('storyText2'),
      btn: tr('storyBtn2')
    },
    {
      kicker: tr('storyKicker3'),
      title: tr('storyTitle3'),
      speaker: tr('storySpeaker3'),
      text: tr('storyText3'),
      btn: tr('storyBtn3')
    }
  ];
}

export function airportBeat(character, friend) {
  return {
    kicker: tr('storyAirKicker'),
    title: tr('storyAirTitle'),
    speaker: friend.name,
    text: tr('storyAirText', { name: character.name }),
    btn: tr('storyAirBtn')
  };
}

export function boardingBeat(character) {
  return {
    kicker: tr('storyBoardKicker'),
    title: tr('storyBoardTitle'),
    speaker: tr('storyBoardSpeaker'),
    text: tr('storyBoardText', { name: character.name }),
    btn: tr('storyBoardBtn')
  };
}

export function freedomBeat(character, friend) {
  return {
    kicker: tr('storyFreeKicker'),
    title: tr('storyFreeTitle'),
    speaker: friend.name,
    text: tr('storyFreeText', { name: character.name }),
    btn: tr('storyFreeBtn')
  };
}
