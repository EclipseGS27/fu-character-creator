import { MODULE_ID } from './rules.mjs';
import { CharacterCreator, getCatalog } from './creator.mjs';

/** Open the creator. Pass an existing (empty) character to fill it in instead of creating a new actor. */
function open(actor = null) {
	if (game.system.id !== 'projectfu') {
		ui.notifications.warn('The Character Creator only works with the Project FU (Fabula Ultima) system.');
		return null;
	}
	if (actor && actor.type !== 'character') {
		ui.notifications.warn('The Character Creator can only fill in character actors.');
		return null;
	}
	if (actor && actor.items.some((i) => i.type === 'class')) {
		ui.notifications.warn(`${actor.name} already has classes. Create a new character instead, or remove the classes first.`);
		return null;
	}
	const app = new CharacterCreator({ actor });
	app.render(true);
	return app;
}

Hooks.once('init', () => {
	game.settings.register(MODULE_ID, 'startingZenit', {
		name: 'Starting zenit budget',
		hint: 'Zenit available for starting equipment. The Core Rulebook default is 500.',
		scope: 'world',
		config: true,
		type: Number,
		default: 500,
	});
	game.settings.register(MODULE_ID, 'rollSavings', {
		name: 'Roll starting savings',
		hint: 'Add 2d6 × 10 zenit to whatever is left of the budget, rolled to chat when the character is created.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});
	game.settings.register(MODULE_ID, 'allowRareEquipment', {
		name: 'Allow rare equipment in the shop',
		hint: 'By default only basic equipment can be bought at creation. Turn this on to list rare items too.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	});
	game.settings.register(MODULE_ID, 'otherBookFeatures', {
		name: 'Starting class features from other books',
		hint: "By default, starting picks such as an Arcanist's first Arcanum come only from the class's own book, as the rules say. Turn this on to also offer features from other sources (for example the extra Arcana).",
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	});
	// Optional rules (all off by default)
	const opt = (key, name, hint) =>
		game.settings.register(MODULE_ID, key, { name, hint, scope: 'world', config: true, type: Boolean, default: false });
	opt('optStartingBonds', 'Optional rule: Starting Bonds', 'Each character begins with one Bond holding a single feeling (Core Rulebook p.220).');
	opt('optHigherHp', 'Optional rule: Higher HP', 'All new characters get +10 maximum Hit Points (Core Rulebook p.168).');
	opt('optCustomWeapons', 'Optional rule: Custom Weapons', 'Adds a custom weapon builder to the Equipment step (High Fantasy Atlas p.106).');
	opt('optQuirks', 'Optional rule: Quirks', "Each character picks one Quirk and types in its rules text. Project FU's own Quirks rule must also be on (Optional Rules in the system settings).");
	opt('optCampActivities', 'Optional rule: Camp Activities', "Each character picks two Camp Activities (Natural Fantasy Atlas p.130). Project FU's Camp Activities rule must also be on.");
	opt('optZeroPowers', 'Optional rule: Zero Powers', "Each character builds a Zero Power from a trigger and an effect (High Fantasy Atlas p.124). Project FU's Zero Powers rule must also be on.");
	opt('optZeroAwakened', 'Zero Powers: Awakened Power variant', 'Players choose only the effect at creation; the trigger is chosen when the power awakens in play (High Fantasy Atlas p.130).');
	game.settings.register(MODULE_ID, 'recordAdvancements', {
		name: 'Fill in the advancement tracker',
		hint: "Record the five starting levels in Project FU's advancement tracker.",
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});
	game.settings.register(MODULE_ID, 'playersCanOpen', {
		name: 'Players can open the creator',
		hint: 'Show the Character Creator button to players. They still need permission to create actors, or an empty character assigned to them.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});
	game.settings.register(MODULE_ID, 'ignoredPacks', {
		name: 'Ignored compendiums',
		hint: 'Comma-separated compendium IDs to skip, e.g. world.homebrew-drafts. Every other Item compendium is read automatically.',
		scope: 'world',
		config: true,
		type: String,
		default: '',
		onChange: () => getCatalog(true),
	});
});

Hooks.once('ready', () => {
	const mod = game.modules.get(MODULE_ID);
	if (mod) mod.api = { open, CharacterCreator };
});

const allowed = () => game.system.id === 'projectfu' && (game.user.isGM || game.settings.get(MODULE_ID, 'playersCanOpen'));

// Button in the Actors sidebar
Hooks.on('renderActorDirectory', (app, html) => {
	if (!allowed()) return;
	const root = html instanceof HTMLElement ? html : html?.[0];
	if (!root || root.querySelector('.fucc-open')) return;
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'fucc-open';
	btn.innerHTML = '<i class="fa-solid fa-hat-wizard"></i> Character Creator';
	btn.addEventListener('click', () => open());
	const bar = root.querySelector('.header-actions') ?? root.querySelector('.directory-header');
	if (bar) bar.append(btn);
});

// Header control on empty character sheets
Hooks.on('getHeaderControlsApplicationV2', (app, controls) => {
	const actor = app.document ?? app.actor;
	if (!(actor instanceof Actor) || actor.type !== 'character' || !actor.isOwner || !allowed()) return;
	if (actor.items.some((i) => i.type === 'class')) return;
	if (controls.some((c) => c.action === 'fuccOpen')) return;
	const handler = () => open(actor);
	controls.unshift({ action: 'fuccOpen', icon: 'fa-solid fa-hat-wizard', label: 'Character Creator', onClick: handler });
	try {
		if (app.options?.actions && !app.options.actions.fuccOpen) app.options.actions.fuccOpen = handler;
	} catch {
		/* options frozen: onClick above still works */
	}
});
