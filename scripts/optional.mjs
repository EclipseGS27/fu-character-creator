// Optional rules from the Core Rulebook and the three Atlases that touch character creation.
// Rules text is not bundled: Quirks are listed by name and page for the player to fill in,
// and Zero Power / Camp Activity entries carry short summaries the player can edit.

import { MODULE_ID } from './rules.mjs';

export const OPT = {
	bonds: () => game.settings.get(MODULE_ID, 'optStartingBonds'),
	higherHp: () => game.settings.get(MODULE_ID, 'optHigherHp'),
	customWeapons: () => game.settings.get(MODULE_ID, 'optCustomWeapons'),
	quirks: () => game.settings.get(MODULE_ID, 'optQuirks'),
	camp: () => game.settings.get(MODULE_ID, 'optCampActivities'),
	zero: () => game.settings.get(MODULE_ID, 'optZeroPowers'),
	awakened: () => game.settings.get(MODULE_ID, 'optZeroAwakened'),
};
export const anyExtras = () => OPT.bonds() || OPT.quirks() || OPT.camp() || OPT.zero();

/** Project FU only registers these item types when its own optional rule is switched on. */
export function systemSupports(kind) {
	const key = { quirk: 'optionQuirks', zeroPower: 'optionZeroPower', campActivity: 'optionCampingRules' }[kind];
	try {
		return game.settings.get('projectfu', key) !== false;
	} catch {
		return true;
	}
}

/* ---------------- Starting Bonds (Core Rulebook p.220) ---------------- */

export const BOND_FEELINGS = [
	['admInf', 'Admiration'],
	['admInf', 'Inferiority'],
	['loyMis', 'Loyalty'],
	['loyMis', 'Mistrust'],
	['affHat', 'Affection'],
	['affHat', 'Hatred'],
];

/* ---------------- Quirks ---------------- */

const Q = (name, pages) => ({ name, pages });
const H = 'High Fantasy Atlas';
const N = 'Natural Fantasy Atlas';
const T = 'Techno Fantasy Atlas';
export const QUIRKS = [
	Q('Agitator', [[T, 121]]),
	Q('Ancient Weapon', [[N, 121]]),
	Q('Arboreal', [[H, 115], [N, 121]]),
	Q('Big Bro', [[N, 122]]),
	Q('Cognitive Ghost', [[T, 121]]),
	Q('Cursed', [[H, 115], [N, 122]]),
	Q('Diabolist', [[T, 122]]),
	Q('Elemental Soul', [[H, 116], [N, 123]]),
	Q('Empty Hands', [[H, 116]]),
	Q('Enigmatic Relic', [[T, 123]]),
	Q('Fettered Heart', [[H, 117]]),
	Q('Flight', [[H, 118]]),
	Q('From a Distant World', [[H, 118], [T, 124]]),
	Q('Fugitive Experiment', [[T, 124]]),
	Q('Glorious Fate', [[H, 119]]),
	Q('Heirloom', [[H, 120]]),
	Q('Hundred Faces', [[T, 124]]),
	Q('Inventor Prodigy', [[T, 125]]),
	Q('Mysterious Grimoire', [[N, 124]]),
	Q('Neo-Human', [[T, 125]]),
	Q('Old Transport', [[H, 120]]),
	Q('Outcast Fairy', [[N, 125]]),
	Q('Planet Oracle', [[T, 125]]),
	Q('Repentant Enforcer', [[T, 126]]),
	Q('Revenant', [[H, 121]]),
	Q('Rival Prodigies', [[H, 121]]),
	Q('Robot', [[H, 122], [N, 125], [T, 127]]),
	Q('Ruinbringer', [[H, 122]]),
	Q('Souls Entwined', [[H, 123]]),
	Q('Stolen Transport', [[T, 127]]),
	Q('Stubborn Scion', [[N, 126]]),
	Q('Survivor', [[N, 127], [T, 127]]),
	Q('The Beast Who Spoke', [[N, 127], [T, 128]]),
	Q('The Long Dream', [[N, 128]]),
	Q('Traveling Workshop', [[N, 128]]),
	Q('Underchild', [[N, 129]]),
	Q('Xiphosymbiosis', [[T, 129]]),
];
export const pagesText = (pages) => pages.map(([b, p]) => `${b.replace(' Atlas', '')} p.${p}`).join(', ');

/* ---------------- Camp Activities (Natural Fantasy Atlas pp.131-133) ---------------- */

const C = (name, target, page, summary) => ({ name, target, page, summary });
export const CAMP_ACTIVITIES = [
	C('Camp Forge', 'Yourself', 131, 'Repair a damaged group item, craft one basic weapon, armor or shield for free, or break down a group item into a material worth its cost.'),
	C('Cartography', 'Yourself', 131, 'Once before the next rest, reroll the group’s travel roll and keep the new result.'),
	C('Combat Lesson', 'One ally', 131, 'Once before the next rest, the ally adds +4 to the Result of one Accuracy Check or offensive Magic Check.'),
	C('Daydream', 'Yourself', 132, 'Once before the next rest, halve one Hit Point loss.'),
	C('Double Portion', 'One ally', 132, 'Once before the next rest, the ally doubles one Hit Point recovery.'),
	C('Exploration', 'Yourself or one ally', 132, 'Roll 1d6 to find Inventory Points (and zenit on a 6). On a 1 you recover less from this rest.'),
	C('Gathering', 'A Gourmet', 132, 'Roll 1d6 to find ingredients for a Gourmet. On a 1, the group is ambushed after the rest.'),
	C('Magic Lesson', 'One ally', 132, 'Teach one of your spells: once before the next rest, the ally can cast it (paying its cost).'),
	C('Martial Practice', 'Yourself', 132, 'Once before the next rest, give one attack multi (2) or raise its multi by 1.'),
	C('Massage', 'One ally', 133, 'Once before the next rest, the ally halves one Mind Point cost (not Rituals).'),
	C('Midnight Oil', 'Yourself', 133, 'Generate 3 progress for one Project.'),
	C('Pep Talk', 'One ally', 133, 'Once before the next rest, the ally doubles one Mind Point recovery.'),
	C('Planning', 'One ally', 133, 'Once before the next rest, +4 to a Group Check the ally leads, or to a Check to examine something.'),
	C('Sleep Soundly', 'Yourself', 133, 'Once before the next rest, take an extra Equipment, Hinder or Inventory action on your turn in a conflict.'),
	C('Training', 'Yourself', 133, 'Once before the next rest, ignore all status effects from one source.'),
];
export const CAMP_PICKS = 2;

/* ---------------- Zero Powers (High Fantasy Atlas pp.124-131) ---------------- */

export const ZERO_TRIGGERS = [
	{ id: 'compassion', name: 'Compassion', fill: '1 per trigger', summary: 'You restore Hit Points or Mind Points to one or more allies.' },
	{ id: 'defiance', name: 'Defiance', fill: '1 per trigger', summary: 'At the start of your turn in a conflict, if a Villain or champion-rank enemy is on the scene.' },
	{ id: 'love', name: 'Love', fill: '1 per trigger', summary: 'The Player Character you love loses Hit Points (not self-inflicted) or Surrenders where you can see them. If they Sacrifice themselves before your eyes, your Zero Clock fills and you pick a new trigger after the scene.', extra: 'love' },
	{ id: 'revenge', name: 'Revenge', fill: '3 per trigger', summary: 'You enter Crisis for the first time during the scene.' },
	{ id: 'sequence', name: 'Sequence', fill: '2 per trigger', summary: 'An ally you can see unleashes their zero effect.' },
	{ id: 'strategy', name: 'Strategy', fill: '1 per trigger', summary: 'At the end of your turn, enemies on the scene suffer two or more different status effects in total.' },
	{ id: 'synergy', name: 'Synergy', fill: '1 per Vulnerable creature', summary: 'You deal damage, filling 1 section per creature Vulnerable to that damage type.' },
];
export const ZERO_EFFECTS = [
	{ id: 'blitz', name: 'Zero Blitz', summary: 'A free attack with each equipped weapon: 20 extra damage with a single weapon, or +5 Accuracy per attack with two.' },
	{ id: 'chance', name: 'Zero Chance', summary: 'Call odd or even and roll 3d6. The number of matching dice picks one of four outcomes, from recharging Zero Clocks plus an extra action to healing the whole party. Triples grant an extra action.' },
	{ id: 'cost', name: 'Zero Cost', summary: 'Inventory Point costs are halved until the end of the scene, and you perform the Inventory action for free.' },
	{ id: 'elements', name: 'Zero Elements', summary: 'Until the scene ends, your damage becomes one of your two chosen types, ignores Resistances, Immunities and Absorption, and deals 5 extra damage. You also gain an extra action.', extra: 'elements' },
	{ id: 'limits', name: 'Zero Limits', summary: 'All your Attributes are one die size higher (max d12) until the end of the scene, and you gain an extra action.' },
	{ id: 'magic', name: 'Zero Magic', summary: 'Cast a spell you know for free at 0 MP. It deals 10 extra damage and, if offensive, gets +5 to the Magic Check.' },
	{ id: 'objective', name: 'Zero Objective', summary: 'Fill or erase 3 sections of a Clock tied to the current scene.' },
	{ id: 'remedy', name: 'Zero Remedy', summary: 'You and any allies you can see recover from all status effects and recover (40 + half your level) Hit Points.' },
	{ id: 'scourge', name: 'Zero Scourge', summary: 'Any creatures you can see take (30 + half your level) damage of your chosen type and suffer your two chosen status effects.', extra: 'scourge' },
	{ id: 'shield', name: 'Zero Shield', summary: 'Until the start of your next turn, all damage to you and your allies on the scene is halved (before Affinities).' },
	{ id: 'triangle', name: 'Zero Triangle', summary: 'You and up to two allies you can see perform a free attack with +5 to the Accuracy Check.' },
];
export const ELEMENTS = ['air', 'bolt', 'dark', 'earth', 'fire', 'ice', 'light', 'poison'];
export const STATUSES = ['dazed', 'shaken', 'slow', 'weak'];
export const ZERO_RULES =
	'<p><b>Zero Clock (6 sections).</b> During conflicts, fill 1 section each time you spend a Fabula Point to invoke a Trait or Bond, 1 each time you lose Hit Points (not self-inflicted), and more when your trigger activates. When the Clock is full, on your turn you may use the Skill action to unleash your zero effect (once per turn); this empties the Clock. The Clock also empties at the end of every scene. <i>High Fantasy Atlas p.124.</i></p>';

/* ---------------- Custom Weapons (any Atlas, High Fantasy p.106) ---------------- */

export const CATEGORIES = ['arcane', 'bow', 'brawling', 'dagger', 'firearm', 'flail', 'heavy', 'spear', 'sword', 'thrown'];
export const CUSTOMIZATIONS = [
	{ id: 'accurate', name: 'Accurate', martial: false, slots: 1, summary: '+2 to the Accuracy Check.' },
	{ id: 'defense', name: 'Defense Boost', martial: false, slots: 1, summary: '+2 Defense, and you count as having a shield equipped for your Skills.' },
	{ id: 'elemental', name: 'Elemental', martial: false, slots: 1, summary: 'Deals a chosen damage type instead of physical, plus 2 extra damage.' },
	{ id: 'mdefense', name: 'Magic Defense Boost', martial: true, slots: 1, summary: '+2 Magic Defense.' },
	{ id: 'powerful', name: 'Powerful', martial: true, slots: 1, summary: '5 extra damage (7 if heavy). Not for arcane or dagger weapons, or with Quick.' },
	{ id: 'quick', name: 'Quick', martial: true, slots: 2, summary: 'Counts as two customizations. The Attack action can make two attacks with it, following two-weapon fighting rules.' },
	{ id: 'transforming', name: 'Transforming', martial: false, slots: 1, summary: '+100 z. Has a second form, built as its own custom weapon, that you can switch to once per turn.' },
];

export function blankForm() {
	return { name: '', category: 'sword', type: 'melee', primary: 'dex', secondary: 'ins', custom: [], element: 'fire' };
}
export function blankCustomWeapon() {
	return { name: '', a: blankForm(), b: blankForm() };
}

/** Customization rules check for one form. Returns a list of problems. */
export function formProblems(f, label) {
	const out = [];
	const slots = f.custom.reduce((n, id) => n + (CUSTOMIZATIONS.find((c) => c.id === id)?.slots ?? 0), 0);
	if (slots !== 3) out.push(`${label}: choose exactly 3 customizations (Quick counts as 2); ${slots} chosen.`);
	if (f.custom.includes('powerful') && (['arcane', 'dagger'].includes(f.category) || f.custom.includes('quick'))) out.push(`${label}: Powerful can't go on arcane or dagger weapons, or with Quick.`);
	return out;
}

export function formStats(f) {
	const has = (id) => f.custom.includes(id);
	let damage = 5;
	if (has('powerful')) damage += f.category === 'heavy' ? 7 : 5;
	if (has('elemental')) damage += 2;
	return {
		name: f.name,
		category: f.category,
		type: f.type,
		attributes: { primary: f.primary, secondary: f.secondary },
		accuracy: has('accurate') ? 2 : 0,
		damage: { value: damage, type: has('elemental') ? f.element : 'physical' },
		def: has('defense') ? 2 : 0,
		mdef: has('mdefense') ? 2 : 0,
		martial: f.custom.some((id) => CUSTOMIZATIONS.find((c) => c.id === id)?.martial),
	};
}

export function customWeaponSummary(cw) {
	const transforming = cw.a.custom.includes('transforming');
	const forms = transforming ? [cw.a, cw.b] : [cw.a];
	const stats = forms.map(formStats);
	return {
		transforming,
		forms,
		stats,
		cost: 300 + (transforming ? 100 : 0),
		martial: stats.some((s) => s.martial),
		problems: [
			...formProblems(cw.a, transforming ? 'Form I' : 'Weapon'),
			...(transforming ? formProblems(cw.b, 'Form II') : []),
			...(transforming && !cw.b.custom.includes('transforming') ? ['Form II must also have the Transforming customization.'] : []),
			...(!cw.name.trim() ? ['Name your custom weapon.'] : []),
		],
	};
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function formLine(st) {
	const acc = st.accuracy ? ` +${st.accuracy}` : '';
	const extras = [st.def ? `DEF +${st.def}` : '', st.mdef ? `M.DEF +${st.mdef}` : ''].filter(Boolean).join(', ');
	return `${cap(st.category)} · ${st.type} · two-handed · 【${st.attributes.primary.toUpperCase()} + ${st.attributes.secondary.toUpperCase()}】${acc} · HR + ${st.damage.value} ${st.damage.type}${extras ? ' · ' + extras : ''}${st.martial ? ' · martial' : ''}`;
}

/** Catalog-like entry so the shop, equip slots and derived stats can treat it like any item. */
export function customWeaponEntry(cw) {
	const sum = customWeaponSummary(cw);
	const s0 = sum.stats[0];
	return {
		uuid: null,
		name: cw.name || 'Custom weapon',
		img: 'icons/svg/sword.svg',
		type: 'customWeapon',
		custom: true,
		forms: sum.stats,
		sys: {
			cost: { value: sum.cost },
			isMartial: { value: sum.martial },
			def: { value: s0.def },
			mdef: { value: s0.mdef },
			init: { value: 0 },
			hands: { value: 'two-handed' },
			type: { value: s0.type },
		},
	};
}

export function customWeaponItem(cw) {
	const sum = customWeaponSummary(cw);
	const form = (st, f) => ({ name: f.name || '', def: st.def, mdef: st.mdef, attributes: st.attributes, accuracy: st.accuracy, damage: st.damage, type: st.type, category: st.category });
	const names = (f) => f.custom.map((id) => CUSTOMIZATIONS.find((c) => c.id === id)?.name).join(', ');
	const desc = sum.forms
		.map((f, i) => `<p><b>${sum.transforming ? (i ? 'Form II' : 'Form I') + ': ' : ''}${names(f)}</b></p>${f.custom.includes('quick') ? '<p>Quick: when you perform the Attack action with this weapon, you may make two attacks, following the rules for two-weapon fighting.</p>' : ''}${f.custom.includes('defense') ? '<p>Defense Boost: you count as having a shield equipped for your Skills.</p>' : ''}`)
		.join('');
	return {
		name: cw.name.trim(),
		type: 'customWeapon',
		img: 'icons/svg/sword.svg',
		system: {
			cost: sum.cost,
			isMartial: sum.martial,
			isTransforming: sum.transforming,
			activeForm: 'primaryForm',
			primaryForm: form(sum.stats[0], sum.forms[0]),
			secondaryForm: sum.transforming ? form(sum.stats[1], sum.forms[1]) : undefined,
			description: `${desc}<p><i>Custom weapon, High Fantasy Atlas p.106.</i></p>`,
			source: 'FUHF106',
		},
	};
}

/* ---------------- item builders for optional features ---------------- */

const para = (t) =>
	String(t ?? '')
		.split(/\n{2,}/)
		.map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(/\n/g, '<br>')}</p>`)
		.join('');

export function quirkItem(q) {
	return {
		name: q.name.trim(),
		type: 'optionalFeature',
		img: 'icons/svg/aura.svg',
		system: {
			optionalType: 'projectfu.quirk',
			summary: { value: '' },
			fuid: q.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
			source: q.source ?? '',
			data: { description: para(q.text) + (q.ref ? `<p><i>${q.ref}</i></p>` : ''), hasClock: { value: false }, hasResource: { value: false } },
		},
	};
}

export function campItem(c) {
	return {
		name: c.name,
		type: 'optionalFeature',
		img: 'icons/svg/fire.svg',
		system: { optionalType: 'projectfu.campActivity', summary: { value: `Target: ${c.target}` }, fuid: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), source: `FUNF${c.page}`, data: { description: para(c.text) + `<p><i>Target: ${c.target}. Natural Fantasy Atlas p.${c.page}.</i></p>` } },
	};
}

export function zeroItem(z, awakened) {
	const trig = ZERO_TRIGGERS.find((t) => t.id === z.trigger);
	const eff = ZERO_EFFECTS.find((e) => e.id === z.effect);
	let effText = z.effectText;
	if (eff?.extra === 'elements' && z.elements.length) effText += `\n\nChosen types: ${z.elements.join(' and ')}.`;
	if (eff?.extra === 'scourge') effText += `\n\nChosen type: ${z.scourgeType || '—'}. Status effects: ${z.scourgeStatus.join(' and ') || '—'}.`;
	let trigText = trig ? `${z.triggerText}\n\nFills: ${trig.fill}.` : '';
	if (trig?.extra === 'love' && z.love) trigText += `\n\nTied to: ${z.love}.`;
	return {
		name: z.name.trim() || eff?.name || 'Zero Power',
		type: 'optionalFeature',
		img: 'icons/svg/sun.svg',
		system: {
			optionalType: 'projectfu.zeroPower',
			summary: { value: awakened && !trig ? 'Not yet awakened' : '' },
			fuid: 'zero-power',
			source: 'FUHF124',
			data: {
				zeroTrigger: { value: trig?.name ?? (awakened ? 'Not yet awakened' : ''), description: trig ? para(trigText) : '<p>Chosen when the power awakens (Awakened Power, High Fantasy Atlas p.130).</p>' },
				zeroEffect: { value: eff?.name ?? '', description: para(effText) + ZERO_RULES },
				hasClock: { value: true },
				progress: { id: 'zero-power', name: 'Zero Clock', current: 0, max: 6, step: 1, enabled: true },
			},
		},
	};
}

/** Names of options other characters in the world already took (for the "no duplicates" rules). */
export function takenInWorld(exclude) {
	const out = { quirk: new Map(), trigger: new Map(), effect: new Map(), camp: new Map() };
	for (const a of game.actors?.filter?.((x) => x.type === 'character' && x !== exclude) ?? []) {
		for (const i of a.items) {
			if (i.type !== 'optionalFeature') continue;
			const t = i.system?.optionalType;
			if (t === 'projectfu.quirk') out.quirk.set(i.name.toLowerCase(), a.name);
			if (t === 'projectfu.campActivity') out.camp.set(i.name.toLowerCase(), a.name);
			if (t === 'projectfu.zeroPower') {
				const d = i.system.data ?? {};
				if (d.zeroTrigger?.value) out.trigger.set(String(d.zeroTrigger.value).toLowerCase(), a.name);
				if (d.zeroEffect?.value) out.effect.set(String(d.zeroEffect.value).toLowerCase(), a.name);
			}
		}
	}
	return out;
}
