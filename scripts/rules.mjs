// Character creation rules (Fabula Ultima Core Rulebook, "Press Start", pp. 154-165)
// plus the class-feature grants written into individual class Skills.

export const MODULE_ID = 'fu-character-creator';

export const START_LEVEL = 5;
export const MIN_CLASSES = 2;
export const MAX_CLASSES = 3;
export const STARTING_FP = 3;

export const ATTRS = [
	['dex', 'Dexterity', 'DEX', 'Precision, coordination, finesse and reflexes.'],
	['ins', 'Insight', 'INS', 'Observation, understanding and reasoning.'],
	['mig', 'Might', 'MIG', 'Strength, resilience and physical fortitude.'],
	['wlp', 'Willpower', 'WLP', 'Determination, charisma and influence over others.'],
];

export const PROFILES = {
	jack: { label: 'Jack of All Trades', dice: [8, 8, 8, 8] },
	average: { label: 'Average', dice: [10, 8, 8, 6] },
	specialized: { label: 'Specialized', dice: [10, 10, 6, 6] },
};

export const THEMES = ['Ambition', 'Anger', 'Belonging', 'Doubt', 'Duty', 'Guilt', 'Hope', 'Justice', 'Mercy', 'Vengeance'];

// Which book a `system.source` code points at.
export const SOURCE_BOOKS = [
	['FUCR', 'Core Rulebook'],
	['FUHF', 'High Fantasy Atlas'],
	['FUNF', 'Natural Fantasy Atlas'],
	['FUTF', 'Techno Fantasy Atlas'],
	['FUBC', 'Bonus content'],
];
export function bookOf(source) {
	const s = String(source ?? '');
	const hit = SOURCE_BOOKS.find(([code]) => s.startsWith(code));
	return hit ? hit[1] : 'Other';
}

/**
 * Skills that hand out picks from class features when taken.
 * key: skill fuid -> list of grants. `count(sl)` = picks needed at that Skill Level.
 * `auto` = feature fuids/types added automatically (containers the sheet expects).
 */
export const FEATURE_GRANTS = {
	'bind-and-summon': {
		picks: [{ types: ['projectfu.arcanum'], label: 'Bound Arcanum', count: () => 1, note: 'At creation you begin play with one Arcanum of your choice already bound, chosen from the Core Rulebook list. Further Arcana are found through exploration and story.' }],
	},
	dance: { picks: [{ types: ['projectfu.dance'], label: 'Dances', count: (sl) => sl, note: 'You learn one dance each time you take this Skill.' }] },
	symbolism: { picks: [{ types: ['projectfu.symbol'], label: 'Symbols', count: (sl) => sl * 2, note: 'You learn two symbols each time you take this Skill.' }] },
	theriomorphosis: { picks: [{ types: ['projectfu.therioform'], label: 'Therioforms', count: (sl) => sl, note: 'You learn one therioform each time you take this Skill.' }] },
	'psychic-gifts': { picks: [{ types: ['projectfu.psychicGift'], label: 'Psychic gifts', count: (sl) => sl, note: 'You gain one gift each time you take this Skill.' }] },
	magichant: {
		picks: [
			{ types: ['projectfu.key'], label: 'Key', count: () => 1, note: 'Magichant teaches all three volumes plus one key and one tone.' },
			{ types: ['projectfu.tone'], label: 'Tone', count: () => 1 },
		],
		auto: ['projectfu.verse'],
	},
	chloromancy: { picks: [{ types: ['projectfu.magiseed'], label: 'Magiseeds', count: (sl) => sl, note: 'You discover a new type of magiseed each time you take this Skill.' }], auto: ['projectfu.garden'] },
	gadgets: {
		picks: [{ types: ['projectfu.alchemy', 'projectfu.infusions', 'projectfu.magitech'], label: 'Gadget types', count: (sl) => Math.min(sl, 3), note: 'Your first level picks a gadget type. Later levels can add another type or upgrade one; upgrades are tracked on the sheet.' }],
	},
	'personal-vehicle': {
		picks: [
			{ types: ['projectfu.vehicle'], label: 'Vehicle frame', count: () => 1, note: 'You gain a personal vehicle with a frame and three modules, plus two modules per extra Skill Level.' },
			{ types: ['projectfu.weaponModule', 'projectfu.armorModule', 'projectfu.supportModule'], label: 'Vehicle modules', count: (sl) => 3 + 2 * (sl - 1) },
		],
	},
	invocation: { picks: [], auto: ['projectfu.invocations'] },
	cooking: { picks: [], auto: ['projectfu.cookbook'] },
};

// Reminders shown on the review step; nothing to pick in the wizard.
export const SKILL_NOTES = {
	cooking: 'Cooking at creation: you begin play with ten ingredients of random tastes. Roll them on the Ingredient Taste table.',
	'winds-of-trade': 'Winds of Trade at creation: begin play with 2 Trade Points.',
	'spell-mimic': 'Spell Mimic: Chimerist spells are learned in play from creatures you see cast them.',
	'faithful-companion': 'Faithful Companion: build your companion with your GM.',
	'bind-and-summon': 'Arcanum: equip your bound Arcanum from the sheet when you summon it.',
};

export const SPELL_SKILL_TRAIT = 'grant-spell';

// Benefit flags on class items -> human labels
export const MARTIAL_LABEL = { melee: 'Martial melee', ranged: 'Martial ranged', armor: 'Martial armor', shields: 'Martial shields' };

export function classBenefits(sys) {
	const b = sys?.benefits ?? {};
	const out = [];
	if (b.resources?.hp?.value) out.push('+5 max HP');
	if (b.resources?.mp?.value) out.push('+5 max MP');
	if (b.resources?.ip?.value) out.push('+2 max IP');
	for (const [k, label] of Object.entries(MARTIAL_LABEL)) if (b.martials?.[k]?.value) out.push(label);
	const rituals = Object.entries(b.rituals ?? {}).filter(([, v]) => v?.value).map(([k]) => k);
	if (rituals.length) out.push('Rituals');
	return out;
}

/** Can a character with these class benefit flags equip this item? */
export function canEquip(item, martials) {
	const s = item.sys;
	if (!s?.isMartial?.value) return true;
	switch (item.type) {
		case 'weapon':
			return s.type?.value === 'ranged' ? martials.ranged : martials.melee;
		case 'armor':
			return martials.armor;
		case 'shield':
			return martials.shields;
		case 'customWeapon':
			return (item.forms ?? []).every((f) => !f.martial || (f.type === 'ranged' ? martials.ranged : martials.melee));
		default:
			return true;
	}
}
