import { loadCatalog, describe } from './catalog.mjs';
import {
	MODULE_ID,
	START_LEVEL,
	MIN_CLASSES,
	MAX_CLASSES,
	STARTING_FP,
	ATTRS,
	PROFILES,
	THEMES,
	SOURCE_BOOKS,
	FEATURE_GRANTS,
	SKILL_NOTES,
	SPELL_SKILL_TRAIT,
	classBenefits,
	canEquip,
} from './rules.mjs';
import {
	OPT,
	anyExtras,
	systemSupports,
	BOND_FEELINGS,
	QUIRKS,
	pagesText,
	CAMP_ACTIVITIES,
	CAMP_PICKS,
	ZERO_TRIGGERS,
	ZERO_EFFECTS,
	ELEMENTS,
	STATUSES,
	CATEGORIES,
	CUSTOMIZATIONS,
	blankCustomWeapon,
	customWeaponSummary,
	customWeaponEntry,
	customWeaponItem,
	formLine,
	quirkItem,
	campItem,
	zeroItem,
	takenInWorld,
} from './optional.mjs';

const { ApplicationV2 } = foundry.applications.api;

const ALL_STEPS = [
	['identity', 'Identity'],
	['classes', 'Classes & Skills'],
	['choices', 'Spells & Features'],
	['attributes', 'Attributes'],
	['extras', 'Optional Rules'],
	['equipment', 'Equipment'],
	['review', 'Review'],
];

const esc = (s) =>
	String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const traitsOf = (sys) => {
	const t = sys?.traits;
	if (!t) return [];
	if (Array.isArray(t)) return t;
	if (t instanceof Set) return [...t];
	return Object.values(t);
};

let catalogPromise = null;
export function getCatalog(force = false) {
	if (force || !catalogPromise) catalogPromise = loadCatalog();
	return catalogPromise;
}

export class CharacterCreator extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ['fucc'],
		tag: 'div',
		window: { title: 'Character Creator', icon: 'fa-solid fa-hat-wizard', resizable: true },
		position: { width: 1120, height: 800 },
		actions: {
			step: CharacterCreator.#onStep,
			next: CharacterCreator.#onNext,
			back: CharacterCreator.#onBack,
			pickTheme: CharacterCreator.#onPickTheme,
			toggleClass: CharacterCreator.#onToggleClass,
			classInfo: CharacterCreator.#onClassInfo,
			skillPlus: CharacterCreator.#onSkillPlus,
			skillMinus: CharacterCreator.#onSkillMinus,
			expand: CharacterCreator.#onExpand,
			togglePick: CharacterCreator.#onTogglePick,
			profile: CharacterCreator.#onProfile,
			buy: CharacterCreator.#onBuy,
			unbuy: CharacterCreator.#onUnbuy,
			shopTab: CharacterCreator.#onShopTab,
			portrait: CharacterCreator.#onPortrait,
			create: CharacterCreator.#onCreate,
			reloadPacks: CharacterCreator.#onReloadPacks,
			pickQuirk: CharacterCreator.#onPickQuirk,
			toggleCamp: CharacterCreator.#onToggleCamp,
			pickZero: CharacterCreator.#onPickZero,
			toggleZeroOpt: CharacterCreator.#onToggleZeroOpt,
			cwToggle: CharacterCreator.#onCwToggle,
			cwForm: CharacterCreator.#onCwForm,
			cwAdd: CharacterCreator.#onCwAdd,
		},
	};

	/** @param {{actor?: Actor}} [options] */
	constructor(options = {}) {
		super(options);
		this.target = options.actor ?? null;
		this.catalog = null;
		this.descs = new Map(); // uuid -> enriched html
		this.expanded = new Set();
		this.busy = false;
		this.s = {
			step: 0,
			name: this.target?.name && this.target.name !== 'New Actor' ? this.target.name : '',
			identity: '',
			theme: '',
			origin: '',
			img: this.target?.img && !this.target.img.includes('mystery-man') ? this.target.img : 'icons/svg/mystery-man.svg',
			classes: [], // class fuids, in pick order
			skills: {}, // skill uuid -> SL
			picks: {}, // grant key -> [uuid]
			profile: 'jack',
			attrs: { dex: 8, ins: 8, mig: 8, wlp: 8 },
			cart: [], // [{key, uuid}]
			equip: { mainHand: null, offHand: null, armor: null, accessory: null }, // cart keys
			classQuery: '',
			classBook: '',
			info: null, // class fuid shown in detail pane
			shopTab: 'weapon',
			shopQuery: '',
			shopAll: false,
			bond: { name: '', feeling: '' },
			quirk: { pick: '', name: '', text: '' },
			camp: { picks: [], text: {} },
			zero: { name: '', trigger: '', effect: '', triggerText: '', effectText: '', love: '', elements: [], scourgeType: '', scourgeStatus: [] },
			cw: blankCustomWeapon(),
			cwForm: 'a',
		};
		this.taken = takenInWorld(this.target);
		this.cartSeq = 0;
	}

	get steps() {
		return ALL_STEPS.filter(([id]) => id !== 'extras' || anyExtras());
	}
	get stepId() {
		return this.steps[Math.min(this.s.step, this.steps.length - 1)][0];
	}
	stepIndex(id) {
		return this.steps.findIndex((x) => x[0] === id);
	}

	get title() {
		return this.target ? `Character Creator: ${this.target.name}` : 'Character Creator';
	}

	/* ---------------- data helpers ---------------- */

	get budget() {
		return Number(game.settings.get(MODULE_ID, 'startingZenit')) || 0;
	}
	classEntry(fuid) {
		return this.catalog.classes.find((c) => c.fuid === fuid);
	}
	classLevel(fuid) {
		return sum(this.catalog.skillsOf(fuid).map((sk) => this.s.skills[sk.uuid] ?? 0));
	}
	get totalLevels() {
		return sum(Object.values(this.s.skills));
	}
	get martials() {
		const m = { melee: false, ranged: false, armor: false, shields: false };
		for (const f of this.s.classes) {
			const b = this.classEntry(f)?.sys.benefits?.martials ?? {};
			for (const k of Object.keys(m)) if (b[k]?.value) m[k] = true;
		}
		return m;
	}
	get resourceBonus() {
		const r = { hp: 0, mp: 0, ip: 0 };
		for (const f of this.s.classes) {
			const b = this.classEntry(f)?.sys.benefits?.resources ?? {};
			if (b.hp?.value) r.hp += 5;
			if (b.mp?.value) r.mp += 5;
			if (b.ip?.value) r.ip += 2;
		}
		return r;
	}
	cartEntry(c) {
		if (!c) return null;
		return c.custom ? customWeaponEntry(c.custom) : this.catalog.byUuid.get(c.uuid);
	}
	cartItem(key) {
		return this.cartEntry(this.s.cart.find((x) => x.key === key));
	}
	get spent() {
		return sum(this.s.cart.map((c) => this.cartEntry(c)?.sys.cost?.value ?? 0));
	}

	/** Every pick the chosen Skills require (spells + class features). */
	get grants() {
		const out = [];
		for (const fuid of this.s.classes) {
			for (const sk of this.catalog.skillsOf(fuid)) {
				const sl = this.s.skills[sk.uuid] ?? 0;
				if (!sl) continue;
				if (traitsOf(sk.sys).includes(SPELL_SKILL_TRAIT)) {
					const options = this.catalog.spellsOf(fuid);
					out.push({ key: `spell:${fuid}`, kind: 'spell', label: `${this.classEntry(fuid)?.name ?? fuid} spells`, source: sk.name, count: Math.min(sl, options.length), options, note: `${sk.name} teaches one spell per Skill Level.` });
				}
				const g = FEATURE_GRANTS[sk.fuid];
				if (g) {
					g.picks.forEach((p, i) => {
						const all = this.catalog.featuresOf(p.types);
						// Starting picks come from the class's own book (e.g. the Core Rulebook's nine Arcana).
						// Features from other sources are story rewards unless the GM opens them up.
						const book = this.classEntry(fuid)?.book;
						const sameBook = all.filter((f) => f.book === book);
						const options = game.settings.get(MODULE_ID, 'otherBookFeatures') || !sameBook.length ? all : sameBook;
						if (!options.length) return;
						out.push({ key: `feat:${sk.fuid}:${i}`, kind: 'feature', label: p.label, source: sk.name, count: Math.min(p.count(sl), options.length), options, note: p.note });
					});
				}
			}
		}
		return out;
	}
	get autoFeatures() {
		const out = [];
		for (const fuid of this.s.classes)
			for (const sk of this.catalog.skillsOf(fuid)) {
				if (!this.s.skills[sk.uuid]) continue;
				for (const type of FEATURE_GRANTS[sk.fuid]?.auto ?? []) {
					const f = this.catalog.featuresOf([type])[0];
					if (f && !out.includes(f)) out.push(f);
				}
			}
		return out;
	}
	get notes() {
		const out = [];
		for (const fuid of this.s.classes)
			for (const sk of this.catalog.skillsOf(fuid)) if (this.s.skills[sk.uuid] && SKILL_NOTES[sk.fuid]) out.push(SKILL_NOTES[sk.fuid]);
		return [...new Set(out)];
	}

	get derived() {
		const a = this.s.attrs;
		const r = this.resourceBonus;
		const hp = START_LEVEL + a.mig * 5 + r.hp + (OPT.higherHp() ? 10 : 0);
		const mp = START_LEVEL + a.wlp * 5 + r.mp;
		const ip = 6 + r.ip;
		const armor = this.cartItem(this.s.equip.armor);
		const off = this.cartItem(this.s.equip.offHand);
		const shield = off?.type === 'shield' ? off : null;
		const acc = this.cartItem(this.s.equip.accessory);
		const main = this.cartItem(this.s.equip.mainHand);
		const cw = main?.type === 'customWeapon' ? main : null;
		const parts = [armor, shield, acc, cw].filter(Boolean);
		let def = a.dex;
		if (armor?.sys.isMartial?.value) def = armor.sys.def?.value ?? def;
		else if (armor) def += armor.sys.def?.value ?? 0;
		def += sum([shield, acc, cw].filter(Boolean).map((x) => x.sys.def?.value ?? 0));
		const mdef = a.ins + sum(parts.map((x) => x.sys.mdef?.value ?? 0));
		const init = sum(parts.map((x) => x.sys.init?.value ?? 0));
		return { hp, mp, ip, crisis: Math.floor(hp / 2), def, mdef, init };
	}

	/* ---------------- validation ---------------- */

	issues(stepId) {
		const s = this.s;
		const out = [];
		if (!this.catalog) return out;
		if (!stepId || stepId === 'identity') {
			if (!s.name.trim()) out.push(['identity', 'Give your character a name.']);
			if (!s.identity.trim()) out.push(['identity', 'Write an Identity: a short sentence about who your character is.']);
			if (!s.theme.trim()) out.push(['identity', 'Choose or write a Theme.']);
			if (!s.origin.trim()) out.push(['identity', 'Write an Origin: where your character comes from.']);
		}
		if (!stepId || stepId === 'classes') {
			if (s.classes.length < MIN_CLASSES) out.push(['classes', `Choose at least ${MIN_CLASSES} classes (you have ${s.classes.length}).`]);
			const t = this.totalLevels;
			if (t !== START_LEVEL) out.push(['classes', `Spend exactly ${START_LEVEL} levels on Skills (${t} spent).`]);
			for (const f of s.classes) if (!this.classLevel(f)) out.push(['classes', `${this.classEntry(f)?.name} needs at least one level.`]);
		}
		if (!stepId || stepId === 'choices') {
			for (const g of this.grants) {
				const n = (s.picks[g.key] ?? []).length;
				if (n !== g.count) out.push(['choices', `${g.label}: choose ${g.count} (${n} chosen).`]);
			}
		}
		if (!stepId || stepId === 'attributes') {
			const want = [...PROFILES[s.profile].dice].sort().join(',');
			const have = ATTRS.map(([k]) => s.attrs[k]).sort().join(',');
			if (want !== have) out.push(['attributes', `Assign the ${PROFILES[s.profile].label} dice: ${PROFILES[s.profile].dice.map((d) => 'd' + d).join(', ')}.`]);
		}
		if (!stepId || stepId === 'equipment') {
			if (this.spent > this.budget) out.push(['equipment', `You are ${this.spent - this.budget} z over your ${this.budget} z budget.`]);
			const m = this.martials;
			for (const c of s.cart) {
				const it = this.cartEntry(c);
				if (it && !canEquip(it, m)) out.push(['equipment', `${it.name} is martial and none of your classes let you equip it.`]);
			}
		}
		if ((!stepId || stepId === 'extras') && anyExtras()) out.push(...this.#extraIssues());
		return out;
	}

	/* ---------------- rendering ---------------- */

	async _prepareContext() {
		if (!this.catalog) this.catalog = await getCatalog();
		// prefetch descriptions for selected classes' skills
		for (const f of this.s.classes) for (const sk of this.catalog.skillsOf(f)) this.#want(sk.uuid);
		if (this.s.info) {
			const c = this.classEntry(this.s.info);
			if (c) this.#want(c.uuid);
		}
		return {};
	}

	#want(uuid) {
		if (this.descs.has(uuid)) return;
		this.descs.set(uuid, null);
		describe(uuid).then((html) => {
			this.descs.set(uuid, html);
			if (this.rendered) this.render();
		});
	}
	#desc(uuid) {
		const d = this.descs.get(uuid);
		return d ?? '<p class="fucc-muted">Loading…</p>';
	}

	async _renderHTML() {
		if (!this.catalog) return '<div class="fucc-loading">Reading compendiums…</div>';
		if (!this.catalog.classes.length)
			return `<div class="fucc-empty"><h2>No classes found</h2><p>The creator reads classes from your Item compendiums, but none were found. Make sure the Project FU system compendiums are present, or check the <b>Ignored compendiums</b> setting.</p><button type="button" data-action="reloadPacks">Scan again</button></div>`;
		const s = this.s;
		const STEPS = this.steps;
		if (s.step >= STEPS.length) s.step = STEPS.length - 1;
		const stepId = STEPS[s.step][0];
		const nav = STEPS.map(([id, label], i) => {
			const bad = id !== 'review' && (this.issues(id).length || (id === 'choices' && this.issues('classes').length));
			return `<button type="button" class="fucc-step ${i === s.step ? 'is-active' : ''} ${bad ? '' : 'is-done'}" data-action="step" data-step="${i}"><span class="n"><i>${i + 1}</i></span>${label}</button>`;
		}).join('');
		const body = this.#stepHtml(stepId);
		const issues = stepId === 'review' ? [] : this.issues(stepId);
		const isLast = s.step === STEPS.length - 1;
		return `
		<nav class="fucc-steps">${nav}</nav>
		<section class="fucc-body" data-scroll="body">${body}</section>
		<footer class="fucc-foot">
			<div class="fucc-foot-msg">${issues.length ? `<i class="fa-solid fa-circle-info"></i> ${esc(issues[0][1])}${issues.length > 1 ? ` <span class="fucc-muted">(+${issues.length - 1} more)</span>` : ''}` : stepId === 'review' ? '' : '<i class="fa-solid fa-check"></i> This step is complete.'}</div>
			<div class="fucc-foot-btns">
				${s.step > 0 ? '<button type="button" data-action="back"><i class="fa-solid fa-arrow-left"></i> Back</button>' : ''}
				${isLast ? `<button type="button" class="fucc-primary" data-action="create" ${this.issues().length || this.busy ? 'disabled' : ''}>${this.busy ? 'Creating…' : this.target ? `<i class="fa-solid fa-check"></i> Apply to ${esc(this.target.name)}` : '<i class="fa-solid fa-check"></i> Create character'}</button>` : '<button type="button" class="fucc-primary" data-action="next">Next <i class="fa-solid fa-arrow-right"></i></button>'}
			</div>
		</footer>`;
	}

	_replaceHTML(result, content) {
		const scroll = {};
		content.querySelectorAll('[data-scroll]').forEach((el) => (scroll[el.dataset.scroll] = el.scrollTop));
		const focus = document.activeElement && content.contains(document.activeElement) ? document.activeElement.name : null;
		content.innerHTML = result;
		content.querySelectorAll('[data-scroll]').forEach((el) => {
			if (scroll[el.dataset.scroll]) el.scrollTop = scroll[el.dataset.scroll];
		});
		if (focus) {
			const el = content.querySelector(`[name="${focus}"]`);
			if (el) {
				el.focus();
				if (el.setSelectionRange && typeof el.value === 'string') el.setSelectionRange(el.value.length, el.value.length);
			}
		}
	}

	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.element.addEventListener('input', (ev) => this.#onInput(ev));
		this.element.addEventListener('change', (ev) => this.#onChange(ev));
	}

	#onInput(ev) {
		const t = ev.target;
		const n = t.name;
		if (['name', 'identity', 'theme', 'origin'].includes(n)) {
			this.s[n] = t.value;
			this.#refreshChrome();
		} else if (n?.startsWith('opt.') || n === 'cw.name' || n === 'cw.form.name') {
			this.#setOpt(n, t.value);
			this.#refreshChrome();
		} else if (n === 'classQuery' || n === 'shopQuery') {
			this.s[n] = t.value;
			this.render();
		}
	}
	#onChange(ev) {
		const t = ev.target;
		const n = t.name;
		if (n === 'classBook') {
			this.s.classBook = t.value;
			this.render();
		} else if (n === 'shopAll') {
			this.s.shopAll = t.checked;
			this.render();
		} else if (n?.startsWith('attr.')) {
			const k = n.slice(5);
			const v = Number(t.value);
			// swap with whichever Attribute currently holds that die, so the profile stays valid
			const old = this.s.attrs[k];
			const other = ATTRS.map(([a]) => a).find((a) => a !== k && this.s.attrs[a] === v);
			if (other) this.s.attrs[other] = old;
			this.s.attrs[k] = v;
			this.render();
		} else if (n === 'opt.bond.feeling' || n?.startsWith('cw.form.')) {
			this.#setOpt(n, t.value);
			this.render();
		} else if (n?.startsWith('equip.')) {
			const slot = n.slice(6);
			this.#setEquip(slot, t.value || null);
			this.render();
		}
	}
	#setOpt(n, v) {
		const s = this.s;
		const form = () => s.cw[customWeaponSummary(s.cw).transforming ? s.cwForm : 'a'];
		if (n === 'opt.bond.name') s.bond.name = v;
		else if (n === 'opt.bond.feeling') s.bond.feeling = v;
		else if (n === 'opt.quirk.name') s.quirk.name = v;
		else if (n === 'opt.quirk.text') s.quirk.text = v;
		else if (n.startsWith('opt.camp.')) s.camp.text[n.slice(9)] = v;
		else if (n.startsWith('opt.zero.')) s.zero[n.slice(9)] = v;
		else if (n === 'cw.name') s.cw.name = v;
		else if (n === 'cw.form.name') form().name = v;
		else if (n === 'cw.form.category') {
			const f = form();
			f.category = v;
			if (['arcane', 'dagger'].includes(v)) f.custom = f.custom.filter((x) => x !== 'powerful');
		} else if (n === 'cw.form.type') form().type = v;
		else if (n === 'cw.form.acc') [form().primary, form().secondary] = v.split('+');
		else if (n === 'cw.form.element') form().element = v;
	}
	/** Update the footer/step badges without re-rendering inputs being typed in. */
	#refreshChrome() {
		const stepId = this.stepId;
		const issues = this.issues(stepId);
		const msg = this.element.querySelector('.fucc-foot-msg');
		if (msg) msg.innerHTML = issues.length ? `<i class="fa-solid fa-circle-info"></i> ${esc(issues[0][1])}${issues.length > 1 ? ` <span class="fucc-muted">(+${issues.length - 1} more)</span>` : ''}` : '<i class="fa-solid fa-check"></i> This step is complete.';
		const btn = this.element.querySelectorAll('.fucc-step')[this.s.step];
		if (btn) btn.classList.toggle('is-done', !issues.length);
	}

	#stepHtml(id) {
		switch (id) {
			case 'identity':
				return this.#identityHtml();
			case 'classes':
				return this.#classesHtml();
			case 'choices':
				return this.#choicesHtml();
			case 'attributes':
				return this.#attributesHtml();
			case 'extras':
				return this.#extrasHtml();
			case 'equipment':
				return this.#equipmentHtml();
			case 'review':
				return this.#reviewHtml();
		}
		return '';
	}

	#identityHtml() {
		const s = this.s;
		return `
		<div class="fucc-identity">
			<div class="fucc-portrait">
				<img src="${esc(s.img)}" alt="">
				<button type="button" data-action="portrait"><i class="fa-solid fa-image"></i> Choose portrait</button>
			</div>
			<div class="fucc-form">
				<label>Name<input type="text" name="name" value="${esc(s.name)}" placeholder="Camilla"></label>
				<label>Identity <span class="fucc-hint">A short sentence summarizing who they are right now.</span>
					<input type="text" name="identity" value="${esc(s.identity)}" placeholder="The Last Princess of Platea"></label>
				<label>Theme <span class="fucc-hint">The ideal or emotion that drives them. Pick one or write your own.</span>
					<input type="text" name="theme" value="${esc(s.theme)}" placeholder="Hope"></label>
				<div class="fucc-chips">${THEMES.map((t) => `<button type="button" class="fucc-chip ${s.theme === t ? 'is-on' : ''}" data-action="pickTheme" data-value="${t}">${t}</button>`).join('')}</div>
				<label>Origin <span class="fucc-hint">The place they hail from.</span>
					<input type="text" name="origin" value="${esc(s.origin)}" placeholder="Platea, a citadel above the lake"></label>
				<p class="fucc-muted fucc-small">Identity, Theme and Origin are your first three Traits; you can invoke them to reroll dice. Starting level ${START_LEVEL}, ${STARTING_FP} Fabula Points.</p>
			</div>
		</div>`;
	}

	#classesHtml() {
		const s = this.s;
		const books = [...new Set(this.catalog.classes.map((c) => c.book))].sort((a, b) => SOURCE_BOOKS.findIndex((x) => x[1] === a) - SOURCE_BOOKS.findIndex((x) => x[1] === b));
		const q = s.classQuery.trim().toLowerCase();
		const list = this.catalog.classes.filter((c) => (!s.classBook || c.book === s.classBook) && (!q || (c.name + ' ' + (c.sys.summary?.value ?? '')).toLowerCase().includes(q)));
		const total = this.totalLevels;
		const cards = list
			.map((c) => {
				const on = s.classes.includes(c.fuid);
				const full = !on && s.classes.length >= MAX_CLASSES;
				return `<div class="fucc-class ${on ? 'is-on' : ''} ${s.info === c.fuid ? 'is-info' : ''}">
					<img src="${esc(c.img)}" alt="">
					<div class="fucc-class-txt">
						<div class="fucc-class-name">${esc(c.name)} <span class="fucc-book">${esc(c.book)}</span></div>
						<div class="fucc-badges">${classBenefits(c.sys).map((b) => `<span>${esc(b)}</span>`).join('')}</div>
					</div>
					<div class="fucc-class-btns">
						<button type="button" class="fucc-mini ${s.info === c.fuid ? 'is-reading' : ''}" data-action="classInfo" data-fuid="${c.fuid}" title="${s.info === c.fuid ? 'Close' : `Read about ${esc(c.name)}`}" aria-expanded="${s.info === c.fuid}"><i class="fa-solid fa-book-open"></i></button>
						<button type="button" class="fucc-mini ${on ? 'is-on' : ''}" data-action="toggleClass" data-fuid="${c.fuid}" ${full ? 'disabled title="You already have 3 classes"' : ''}>${on ? '<i class="fa-solid fa-check"></i> Taken' : 'Take'}</button>
					</div>
					${s.info === c.fuid ? this.#classDetail(c) : ''}
				</div>`;
			})
			.join('');


		const picked = s.classes
			.map((f) => {
				const c = this.classEntry(f);
				const lv = this.classLevel(f);
				const skills = this.catalog
					.skillsOf(f)
					.map((sk) => {
						const sl = s.skills[sk.uuid] ?? 0;
						const max = sk.sys.level?.max ?? 1;
						const open = this.expanded.has(sk.uuid);
						return `<div class="fucc-skill ${sl ? 'is-on' : ''}">
							<div class="fucc-skill-row">
								<div class="fucc-stepper"><button type="button" data-action="skillMinus" data-uuid="${sk.uuid}" ${sl ? '' : 'disabled'} aria-label="Lower">−</button><span>${sl}</span><button type="button" data-action="skillPlus" data-uuid="${sk.uuid}" ${sl >= max || total >= START_LEVEL ? 'disabled' : ''} aria-label="Raise">+</button></div>
								<div class="fucc-txt">
									<button type="button" class="fucc-link" data-action="expand" data-uuid="${sk.uuid}" aria-expanded="${open}">${esc(sk.name)}</button>
									<span class="fucc-muted fucc-small">max SL ${max}${traitsOf(sk.sys).includes(SPELL_SKILL_TRAIT) ? ' · <span class="fucc-tag">grants spells</span>' : ''}${FEATURE_GRANTS[sk.fuid]?.picks?.length ? ' · <span class="fucc-tag">grants choices</span>' : ''}</span>
								</div>
							</div>
							${open ? `<div class="fucc-desc">${this.#desc(sk.uuid)}</div>` : ''}
						</div>`;
					})
					.join('');
				return `<div class="fucc-picked">
					<div class="fucc-picked-h"><img src="${esc(c.img)}" alt=""><b>${esc(c.name)}</b><span class="fucc-lv">Level ${lv}</span><button type="button" class="fucc-x" data-action="toggleClass" data-fuid="${f}" title="Remove ${esc(c.name)}" aria-label="Remove ${esc(c.name)}"><i class="fa-solid fa-xmark"></i></button></div>
					<div class="fucc-badges">${classBenefits(c.sys).map((b) => `<span>${esc(b)}</span>`).join('')}</div>
					${skills || '<p class="fucc-muted">No Skills for this class were found in your compendiums.</p>'}
				</div>`;
			})
			.join('');

		return `
		<div class="fucc-classes">
			<div class="fucc-col">
				<div class="fucc-toolbar">
					<input type="search" name="classQuery" value="${esc(s.classQuery)}" placeholder="Search ${this.catalog.classes.length} classes…">
					<select name="classBook"><option value="">All books</option>${books.map((b) => `<option ${s.classBook === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
				</div>
				<div class="fucc-class-list" data-scroll="classes">${cards || '<p class="fucc-muted">No classes match.</p>'}</div>
			</div>
			<div class="fucc-col">
				<div class="fucc-meter"><div><b>${total}</b> / ${START_LEVEL} levels</div><div class="fucc-bar"><i style="width:${Math.min(100, (total / START_LEVEL) * 100)}%"></i></div><div class="fucc-muted fucc-small">${s.classes.length} of ${MIN_CLASSES}–${MAX_CLASSES} classes. Each level buys one Skill Level in that class.</div></div>
				<div class="fucc-picked-list" data-scroll="picked">${picked || '<div class="fucc-empty-box">Take two or three classes on the left, then spend your five levels on their Skills here.</div>'}</div>
			</div>
		</div>`;
	}

	/** The class's write-up, opened in place under its card */
	#classDetail(c) {
		const summary = String(c.sys.summary?.value ?? '').trim();
		return `<div class="fucc-classmore">
			${summary ? `<p class="fucc-classsum">${esc(summary)}</p>` : ''}
			<div class="fucc-classdesc">${this.#desc(c.uuid)}</div>
			<div class="fucc-classmore-f"><span class="fucc-muted fucc-small">${esc(c.book)} · ${esc(c.packLabel)}</span><button type="button" class="fucc-mini" data-action="classInfo" data-fuid="${c.fuid}">Close</button></div>
		</div>`;
	}

	#choicesHtml() {
		const grants = this.grants;
		const auto = this.autoFeatures;
		if (!grants.length && !auto.length)
			return `<div class="fucc-empty-box">None of your Skills ask you to pick spells or class features. ${this.s.classes.length ? 'Continue to Attributes.' : 'Choose classes first.'}</div>`;
		const blocks = grants
			.map((g) => {
				const chosen = this.s.picks[g.key] ?? [];
				const opts = g.options
					.map((o) => {
						const on = chosen.includes(o.uuid);
						const full = !on && chosen.length >= g.count;
						const open = this.expanded.has(o.uuid);
						if (open) this.#want(o.uuid);
						return `<div class="fucc-opt ${on ? 'is-on' : ''}">
							<div class="fucc-opt-row">
								<button type="button" class="fucc-check" data-action="togglePick" data-key="${g.key}" data-uuid="${o.uuid}" ${full ? 'disabled' : ''} aria-pressed="${on}">${on ? '<i class="fa-solid fa-check"></i>' : ''}</button>
								<img src="${esc(o.img)}" alt="">
								<div class="fucc-txt">
									<button type="button" class="fucc-link" data-action="expand" data-uuid="${o.uuid}" aria-expanded="${open}">${esc(o.name)}</button>
									${this.#optMeta(o) ? `<span class="fucc-muted fucc-small">${esc(this.#optMeta(o))}</span>` : ''}
								</div>
							</div>
							${open ? `<div class="fucc-desc">${this.#desc(o.uuid)}</div>` : ''}
						</div>`;
					})
					.join('');
				return `<section class="fucc-grant"><header><h3>${esc(g.label)}</h3><span class="fucc-count ${chosen.length === g.count ? 'is-ok' : ''}">${chosen.length} / ${g.count}</span></header><p class="fucc-muted fucc-small">From ${esc(g.source)}. ${esc(g.note ?? '')}</p><div class="fucc-optlist">${opts}</div></section>`;
			})
			.join('');
		const autoHtml = auto.length ? `<p class="fucc-muted fucc-small">Added automatically: ${auto.map((a) => esc(a.name)).join(', ')}.</p>` : '';
		return `<div class="fucc-choices" data-scroll="choices">${blocks}${autoHtml}</div>`;
	}
	#optMeta(o) {
		const s = o.sys;
		if (o.type === 'spell') {
			const bits = [];
			if (s.cost?.amount) bits.push(`${s.cost.amount} MP${s.cost.perTarget ? ' × T' : ''}`);
			if (s.targeting?.rule) bits.push(s.targeting.rule === 'multiple' ? `up to ${s.targeting.max ?? 3} creatures` : s.targeting.rule);
			if (s.duration?.value) bits.push(s.duration.value);
			if (s.isOffensive?.value) bits.push('offensive');
			return bits.join(' · ');
		}
		return o.book;
	}

	#attributesHtml() {
		const s = this.s;
		const d = this.derived;
		const r = this.resourceBonus;
		const dice = PROFILES[s.profile].dice;
		const uniq = [...new Set(dice)].sort((a, b) => b - a);
		return `
		<div class="fucc-attrs">
			<div class="fucc-profiles">${Object.entries(PROFILES)
				.map(([k, p]) => `<button type="button" class="fucc-profile ${s.profile === k ? 'is-on' : ''}" data-action="profile" data-profile="${k}"><b>${p.label}</b><span>${p.dice.map((x) => 'd' + x).join(' · ')}</span></button>`)
				.join('')}</div>
			<div class="fucc-attr-grid">${ATTRS.map(
				([k, label, abbr, hint]) => `<div class="fucc-attr"><div class="fucc-attr-h"><b>${abbr}</b> ${label}</div><select name="attr.${k}">${uniq.map((v) => `<option value="${v}" ${s.attrs[k] === v ? 'selected' : ''}>d${v}</option>`).join('')}</select><div class="fucc-muted fucc-small">${hint}</div></div>`,
			).join('')}</div>
			<div class="fucc-derived">
				<div><span>Max HP</span><b>${d.hp}</b><small>${START_LEVEL} + 5 × MIG${r.hp ? ` + ${r.hp} from classes` : ''} · Crisis ${d.crisis}</small></div>
				<div><span>Max MP</span><b>${d.mp}</b><small>${START_LEVEL} + 5 × WLP${r.mp ? ` + ${r.mp} from classes` : ''}</small></div>
				<div><span>Max IP</span><b>${d.ip}</b><small>6${r.ip ? ` + ${r.ip} from classes` : ''}</small></div>
				<div><span>Defense</span><b>${d.def}</b><small>DEX die, then armor and shield</small></div>
				<div><span>M. Defense</span><b>${d.mdef}</b><small>INS die, then equipment</small></div>
				<div><span>Initiative</span><b>${d.init >= 0 ? '+' : ''}${d.init}</b><small>from armor and shield</small></div>
			</div>
			<p class="fucc-muted fucc-small">Choosing a die for one Attribute swaps it with the Attribute that held it, so the profile always stays valid.</p>
		</div>`;
	}

	#equipmentHtml() {
		const s = this.s;
		const m = this.martials;
		const left = this.budget - this.spent;
		const tabs = [
			['weapon', 'Weapons'],
			['armor', 'Armor'],
			['shield', 'Shields'],
			['accessory', 'Accessories'],
		];
		if (OPT.customWeapons()) tabs.push(['custom', 'Custom weapon']);
		if (s.shopTab === 'custom' && !OPT.customWeapons()) s.shopTab = 'weapon';
		const q = s.shopQuery.trim().toLowerCase();
		const allowed = this.#shopPacks();
		const inTab = this.catalog.equipment.filter((e) => e.type === s.shopTab && allowed(e) && (!q || e.name.toLowerCase().includes(q)));
		// Only what this character can equip; martial gear their classes don't grant is hidden unless asked for
		const list = s.shopAll ? inTab : inTab.filter((e) => canEquip(e, m));
		const hidden = inTab.length - list.length;
		const rows = list
			.map((e) => {
				const cost = e.sys.cost?.value ?? 0;
				const ok = canEquip(e, m);
				return `<tr class="${ok ? '' : 'is-blocked'}">
					<td><div class="fucc-item"><img src="${esc(e.img)}" alt=""><div><b>${esc(e.name)}</b>${e.sys.isMartial?.value ? ' <span class="fucc-martial" title="Martial">M</span>' : ''}<div class="fucc-muted fucc-small">${esc(this.#itemMeta(e))}</div></div></div></td>
					<td class="num">${cost} z</td>
					<td class="num"><button type="button" class="fucc-mini" data-action="buy" data-uuid="${e.uuid}" ${!ok || cost > left ? 'disabled' : ''} title="${ok ? (cost > left ? 'Not enough zenit' : 'Buy') : 'Your classes cannot equip this martial item'}">Buy</button></td>
				</tr>`;
			})
			.join('');
		const cart = s.cart
			.map((c) => {
				const e = this.cartEntry(c);
				return `<div class="fucc-cart-row"><span>${esc(e?.name ?? '?')}</span><span class="num">${e?.sys.cost?.value ?? 0} z</span><button type="button" class="fucc-x" data-action="unbuy" data-key="${c.key}" title="Remove" aria-label="Remove ${esc(e?.name ?? '')}"><i class="fa-solid fa-xmark"></i></button></div>`;
			})
			.join('');
		const slotSel = (slot, label, types) => {
			const opts = s.cart.filter((c) => types.includes(this.cartEntry(c)?.type));
			return `<label>${label}<select name="equip.${slot}"><option value="">—</option>${opts.map((c) => `<option value="${c.key}" ${s.equip[slot] === c.key ? 'selected' : ''}>${esc(this.cartEntry(c).name)}</option>`).join('')}</select></label>`;
		};
		const martialTxt = Object.entries(m)
			.filter(([, v]) => v)
			.map(([k]) => k)
			.join(', ');
		return `
		<div class="fucc-shop">
			<div class="fucc-col">
				<div class="fucc-toolbar">
					<div class="fucc-tabs">${tabs.map(([k, l]) => `<button type="button" class="${s.shopTab === k ? 'is-on' : ''}" data-action="shopTab" data-tab="${k}">${l}</button>`).join('')}</div>
					<input type="search" name="shopQuery" value="${esc(s.shopQuery)}" placeholder="Search…">
				</div>
				<div class="fucc-shopnote fucc-muted fucc-small"><span>Showing what you can equip: ${martialTxt ? `everything, plus martial ${esc(martialTxt)}` : 'non-martial items'}.${hidden ? ` ${hidden} martial item${hidden === 1 ? '' : 's'} hidden.` : ''}</span>${hidden || s.shopAll ? `<label class="fucc-toggle"><input type="checkbox" name="shopAll" ${s.shopAll ? 'checked' : ''}> Show all</label>` : ''}</div>
				${s.shopTab === 'custom' ? this.#customWeaponHtml(left) : `<div class="fucc-table-wrap" data-scroll="shop"><table class="fucc-table"><thead><tr><th>Item</th><th class="num">Cost</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="fucc-muted">${hidden ? `None of these ${s.shopTab}s suit your classes.` : `No ${s.shopTab}s in the allowed compendiums.`}</td></tr>`}</tbody></table></div>`}
			</div>
			<div class="fucc-col">
				<div class="fucc-meter"><div><b>${left}</b> z left of ${this.budget} z</div><div class="fucc-bar ${left < 0 ? 'is-bad' : ''}"><i style="width:${Math.max(0, Math.min(100, (this.spent / Math.max(1, this.budget)) * 100))}%"></i></div><div class="fucc-muted fucc-small">${game.settings.get(MODULE_ID, 'rollSavings') ? 'Leftover zenit plus 2d6 × 10 z of savings go to your character when you finish.' : 'Leftover zenit goes to your character when you finish.'}</div></div>
				<div class="fucc-cart">${cart || '<p class="fucc-muted">Nothing bought yet.</p>'}</div>
				<div class="fucc-slots">${slotSel('mainHand', 'Main hand', ['weapon', 'shield', 'customWeapon'])}${slotSel('offHand', 'Off hand', ['weapon', 'shield', 'customWeapon'])}${slotSel('armor', 'Armor', ['armor'])}${slotSel('accessory', 'Accessory', ['accessory'])}</div>
				<p class="fucc-muted fucc-small">Two-handed weapons take both hands. Items are added to the sheet and equipped as chosen here.</p>
			</div>
		</div>`;
	}
	#shopPacks() {
		const rare = game.settings.get(MODULE_ID, 'allowRareEquipment');
		// System packs: only the equipment compendiums (other system packs hold class-specific weapons such as
		// Mutant unarmed strikes). World and module packs are treated as homebrew shops and always included.
		return (e) => {
			if ((e.sys.cost?.value ?? 0) <= 0) return false;
			if (!e.pack.startsWith('projectfu.')) return true;
			if (e.pack === 'projectfu.basic-equipment') return true;
			return rare && e.pack === 'projectfu.rare-equipment';
		};
	}
	#itemMeta(e) {
		const s = e.sys;
		const A = (k) => (k ? k.toUpperCase() : '');
		if (e.type === 'weapon') {
			const acc = s.accuracy?.value ? ` +${s.accuracy.value}` : '';
			return `${s.category?.value ?? ''} · ${s.type?.value ?? ''} · ${s.hands?.value ?? ''} · 【${A(s.attributes?.primary?.value)} + ${A(s.attributes?.secondary?.value)}】${acc} · HR + ${s.damage?.value ?? 0} ${s.damageType?.value ?? ''}`;
		}
		const parts = [];
		const dv = s.def?.value ?? 0;
		if (e.type === 'armor' && s.isMartial?.value) parts.push(`DEF ${dv}`);
		else if (dv) parts.push(`DEF +${dv}`);
		if (s.mdef?.value) parts.push(`M.DEF +${s.mdef.value}`);
		if (s.init?.value) parts.push(`Init ${s.init.value > 0 ? '+' : ''}${s.init.value}`);
		if (s.quality?.value) parts.push(String(s.quality.value).replace(/<[^>]+>/g, '').slice(0, 80));
		return parts.join(' · ') || '—';
	}
	#setEquip(slot, key) {
		const e = this.s.equip;
		const it = key ? this.cartItem(key) : null;
		// clear this key from other slots
		for (const k of Object.keys(e)) if (e[k] === key && k !== slot) e[k] = null;
		const twoH = (x) => x?.type === 'customWeapon' || (x?.type === 'weapon' && x.sys.hands?.value === 'two-handed');
		if ((slot === 'mainHand' || slot === 'offHand') && twoH(it)) {
			e.mainHand = key;
			e.offHand = key;
			return;
		}
		// equipping a one-hander/shield while a two-hander occupies both hands
		if ((slot === 'mainHand' || slot === 'offHand') && twoH(this.cartItem(e.mainHand))) {
			e.mainHand = null;
			e.offHand = null;
		}
		e[slot] = key;
	}
	#autoEquip(key) {
		const it = this.cartItem(key);
		const e = this.s.equip;
		if (it.type === 'armor' && !e.armor) e.armor = key;
		else if (it.type === 'accessory' && !e.accessory) e.accessory = key;
		else if (it.type === 'shield' && !e.offHand) this.#setEquip('offHand', key);
		else if (it.type === 'customWeapon' && !e.mainHand && !e.offHand) this.#setEquip('mainHand', key);
		else if (it.type === 'weapon' && !e.mainHand) this.#setEquip('mainHand', key);
		else if (it.type === 'weapon' && !e.offHand && it.sys.hands?.value !== 'two-handed') this.#setEquip('offHand', key);
	}

	#reviewHtml() {
		const s = this.s;
		const d = this.derived;
		const issues = this.issues();
		const classes = s.classes
			.map((f) => {
				const c = this.classEntry(f);
				const sk = this.catalog
					.skillsOf(f)
					.filter((x) => s.skills[x.uuid])
					.map((x) => `${esc(x.name)}${s.skills[x.uuid] > 1 ? ` <span class="fucc-muted">SL ${s.skills[x.uuid]}</span>` : ''}`)
					.join(', ');
				return `<li><b>${esc(c.name)} ${this.classLevel(f)}</b><div>${sk}</div></li>`;
			})
			.join('');
		const picks = this.grants
			.map((g) => {
				const names = (s.picks[g.key] ?? []).map((u) => esc(this.catalog.byUuid.get(u)?.name ?? '?'));
				return `<li><b>${esc(g.label)}</b><div>${names.join(', ') || '<span class="fucc-muted">none yet</span>'}</div></li>`;
			})
			.join('');
		const equipName = (k) => (k ? esc(this.cartItem(k)?.name) : '—');
		const gear = s.cart.map((c) => esc(this.cartEntry(c)?.name)).join(', ');
		const notes = this.notes;
		return `
		<div class="fucc-review">
			<div class="fucc-review-h">
				<img src="${esc(s.img)}" alt="">
				<div><h2>${esc(s.name || 'Unnamed hero')}</h2>
				<div class="fucc-traits"><span><small>Identity</small>${esc(s.identity || '—')}</span><span><small>Theme</small>${esc(s.theme || '—')}</span><span><small>Origin</small>${esc(s.origin || '—')}</span></div></div>
			</div>
			<div class="fucc-review-stats">
				${ATTRS.map(([k, , abbr]) => `<div><small>${abbr}</small><b>d${s.attrs[k]}</b></div>`).join('')}
				<div><small>HP</small><b>${d.hp}</b></div><div><small>MP</small><b>${d.mp}</b></div><div><small>IP</small><b>${d.ip}</b></div>
				<div><small>DEF</small><b>${d.def}</b></div><div><small>M.DEF</small><b>${d.mdef}</b></div><div><small>Init</small><b>${d.init >= 0 ? '+' : ''}${d.init}</b></div>
			</div>
			<div class="fucc-review-cols">
				<div><h3>Classes</h3><ul class="fucc-ul">${classes || '<li class="fucc-muted">None</li>'}</ul>${picks ? `<h3>Spells &amp; features</h3><ul class="fucc-ul">${picks}</ul>` : ''}${this.#extrasReview()}</div>
				<div><h3>Equipment</h3><ul class="fucc-ul"><li><b>Main hand</b><div>${equipName(s.equip.mainHand)}</div></li><li><b>Off hand</b><div>${equipName(s.equip.offHand)}</div></li><li><b>Armor</b><div>${equipName(s.equip.armor)}</div></li><li><b>Accessory</b><div>${equipName(s.equip.accessory)}</div></li><li><b>Bought</b><div>${gear || '—'}</div></li><li><b>Zenit</b><div>${this.budget - this.spent} z left${game.settings.get(MODULE_ID, 'rollSavings') ? ' + 2d6 × 10 z savings (rolled on creation)' : ''}</div></li></ul>
				${notes.length ? `<h3>Reminders</h3><ul class="fucc-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>
			</div>
			${issues.length ? `<div class="fucc-issues"><h3>Before you can finish</h3><ul>${issues.map(([st, t]) => `<li><button type="button" class="fucc-link" data-action="step" data-step="${this.stepIndex(st)}">${esc(this.steps.find((x) => x[0] === st)?.[1] ?? st)}</button> ${esc(t)}</li>`).join('')}</ul></div>` : `<div class="fucc-ready"><i class="fa-solid fa-check"></i> Ready.${OPT.bonds() ? '' : ' Bonds are formed during play, so the sheet starts without any.'}</div>`}
		</div>`;
	}

	/* ---------------- optional rules ---------------- */

	#extraIssues() {
		const s = this.s;
		const out = [];
		const add = (t) => out.push(['extras', t]);
		if (OPT.bonds()) {
			if (!s.bond.name.trim()) add('Starting Bond: name who or what the Bond is toward.');
			if (!s.bond.feeling) add('Starting Bond: choose one feeling.');
		}
		if (OPT.quirks()) {
			if (!systemSupports('quirk')) add("GM: turn on Quirks in Project FU's Optional Rules settings, or turn off the creator's Quirks option.");
			if (!s.quirk.pick) add('Quirk: choose one, or write your own.');
			else {
				if (!s.quirk.name.trim()) add('Quirk: give it a name.');
				if (!s.quirk.text.trim()) add('Quirk: type its rules into the text box so they are on your sheet.');
				const who = this.taken.quirk.get(s.quirk.name.trim().toLowerCase());
				if (who) add(`Quirk: ${s.quirk.name} is already taken by ${who}. No two characters may share a Quirk.`);
			}
		}
		if (OPT.camp()) {
			if (!systemSupports('campActivity')) add("GM: turn on Camp Activities in Project FU's Optional Rules settings, or turn off the creator's Camp Activities option.");
			if (s.camp.picks.length !== CAMP_PICKS) add(`Camp Activities: choose ${CAMP_PICKS} (${s.camp.picks.length} chosen).`);
		}
		if (OPT.zero()) {
			const z = s.zero;
			if (!systemSupports('zeroPower')) add("GM: turn on Zero Powers in Project FU's Optional Rules settings, or turn off the creator's Zero Powers option.");
			if (!OPT.awakened() && !z.trigger) add('Zero Power: choose a trigger.');
			if (!z.effect) add('Zero Power: choose an effect.');
			const trig = ZERO_TRIGGERS.find((t) => t.id === z.trigger);
			const eff = ZERO_EFFECTS.find((e) => e.id === z.effect);
			if (trig && !OPT.awakened() && this.taken.trigger.get(trig.name.toLowerCase())) add(`Zero Power: the ${trig.name} trigger is already used by ${this.taken.trigger.get(trig.name.toLowerCase())}.`);
			if (eff && this.taken.effect.get(eff.name.toLowerCase())) add(`Zero Power: ${eff.name} is already used by ${this.taken.effect.get(eff.name.toLowerCase())}.`);
			if (trig?.extra === 'love' && !z.love.trim()) add('Zero Power: name the character your Love trigger is tied to.');
			if (eff?.extra === 'elements' && z.elements.length !== 2) add('Zero Power: Zero Elements needs exactly two damage types.');
			if (eff?.extra === 'scourge' && (!z.scourgeType || z.scourgeStatus.length !== 2)) add('Zero Power: Zero Scourge needs one damage type and two status effects.');
		}
		return out;
	}

	#extrasHtml() {
		const s = this.s;
		const blocks = [];
		if (OPT.bonds()) {
			blocks.push(`<section class="fucc-grant"><header><h3>Starting Bond</h3></header>
				<p class="fucc-muted fucc-small">You begin play with one Bond holding a single feeling. Core Rulebook p.220.</p>
				<div class="fucc-row2 fucc-form"><label>Toward<input type="text" name="opt.bond.name" value="${esc(s.bond.name)}" placeholder="My mentor, the Empire, Mira…"></label>
				<label>Feeling<select name="opt.bond.feeling"><option value="">—</option>${BOND_FEELINGS.map(([, f]) => `<option ${s.bond.feeling === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div></section>`);
		}
		if (OPT.quirks()) {
			const q = s.quirk;
			const opts = QUIRKS.map((x) => {
				const on = q.pick === x.name;
				const who = this.taken.quirk.get(x.name.toLowerCase());
				return `<div class="fucc-opt ${on ? 'is-on' : ''}"><div class="fucc-opt-row"><button type="button" class="fucc-check" data-action="pickQuirk" data-name="${esc(x.name)}" aria-pressed="${on}">${on ? '<i class="fa-solid fa-check"></i>' : ''}</button><span></span><b>${esc(x.name)}</b><span class="fucc-muted fucc-small">${esc(pagesText(x.pages))}${who ? ` · <span class="fucc-warn">taken by ${esc(who)}</span>` : ''}</span></div></div>`;
			}).join('');
			const custom = q.pick === '__custom';
			const picked = QUIRKS.find((x) => x.name === q.pick);
			blocks.push(`<section class="fucc-grant"><header><h3>Quirk</h3><span class="fucc-count ${q.pick ? 'is-ok' : ''}">${q.pick ? 1 : 0} / 1</span></header>
				<p class="fucc-muted fucc-small">One Quirk per character, and no two characters in the group may share one. Pick from the Atlases or write your own with the GM.</p>
				<div class="fucc-opts fucc-opts-tight">${opts}<div class="fucc-opt ${custom ? 'is-on' : ''}"><div class="fucc-opt-row"><button type="button" class="fucc-check" data-action="pickQuirk" data-name="__custom" aria-pressed="${custom}">${custom ? '<i class="fa-solid fa-check"></i>' : ''}</button><span></span><b>Write your own</b><span class="fucc-muted fucc-small">agree it with your GM</span></div></div></div>
				${q.pick ? `<div class="fucc-form fucc-textblock"><label>Quirk name<input type="text" name="opt.quirk.name" value="${esc(q.name)}"></label>
				<label>Rules text <span class="fucc-hint">${picked ? `Copy or summarize ${esc(picked.name)} from ${esc(pagesText(picked.pages))}. ` : ''}This becomes the Quirk's description on your sheet.</span><textarea name="opt.quirk.text" rows="7">${esc(q.text)}</textarea></label></div>` : ''}
			</section>`);
		}
		if (OPT.camp()) {
			const c = s.camp;
			const opts = CAMP_ACTIVITIES.map((a) => {
				const on = c.picks.includes(a.name);
				const full = !on && c.picks.length >= CAMP_PICKS;
				const who = this.taken.camp.get(a.name.toLowerCase());
				return `<div class="fucc-opt ${on ? 'is-on' : ''}"><div class="fucc-opt-row"><button type="button" class="fucc-check" data-action="toggleCamp" data-name="${esc(a.name)}" aria-pressed="${on}" ${full ? 'disabled' : ''}>${on ? '<i class="fa-solid fa-check"></i>' : ''}</button><span></span><b>${esc(a.name)}</b><span class="fucc-muted fucc-small">${esc(a.target)} · p.${a.page}${who ? ` · <span class="fucc-warn">also taken by ${esc(who)}</span>` : ''}</span></div><div class="fucc-small fucc-opt-sum">${esc(a.summary)}</div></div>`;
			}).join('');
			const texts = c.picks
				.map((n) => `<label>${esc(n)} <span class="fucc-hint">Edit to match the book's wording if you like.</span><textarea name="opt.camp.${esc(n)}" rows="3">${esc(c.text[n] ?? '')}</textarea></label>`)
				.join('');
			blocks.push(`<section class="fucc-grant"><header><h3>Camp Activities</h3><span class="fucc-count ${c.picks.length === CAMP_PICKS ? 'is-ok' : ''}">${c.picks.length} / ${CAMP_PICKS}</span></header>
				<p class="fucc-muted fucc-small">During a resting scene, perform one of your two activities. Try not to double up with the rest of the group. Natural Fantasy Atlas p.130.</p>
				<div class="fucc-opts">${opts}</div>${texts ? `<div class="fucc-form fucc-textblock">${texts}</div>` : ''}</section>`);
		}
		if (OPT.zero()) {
			const z = s.zero;
			const awakened = OPT.awakened();
			const trig = ZERO_TRIGGERS.find((t) => t.id === z.trigger);
			const eff = ZERO_EFFECTS.find((e) => e.id === z.effect);
			const list = (items, kind, cur, takenMap) =>
				items
					.map((x) => {
						const on = cur === x.id;
						const who = takenMap.get(x.name.toLowerCase());
						return `<div class="fucc-opt ${on ? 'is-on' : ''}"><div class="fucc-opt-row"><button type="button" class="fucc-check" data-action="pickZero" data-kind="${kind}" data-id="${x.id}" aria-pressed="${on}">${on ? '<i class="fa-solid fa-check"></i>' : ''}</button><span></span><b>${esc(x.name)}</b><span class="fucc-muted fucc-small">${x.fill ? esc(x.fill) : ''}${who ? `${x.fill ? ' · ' : ''}<span class="fucc-warn">used by ${esc(who)}</span>` : ''}</span></div><div class="fucc-small fucc-opt-sum">${esc(x.summary)}</div></div>`;
					})
					.join('');
			const chips = (kind, values, chosen) => `<div class="fucc-chips">${values.map((v) => `<button type="button" class="fucc-chip ${chosen.includes(v) ? 'is-on' : ''}" data-action="toggleZeroOpt" data-kind="${kind}" data-value="${v}">${v}</button>`).join('')}</div>`;
			let extra = '';
			if (trig?.extra === 'love') extra += `<label>Love is tied to <input type="text" name="opt.zero.love" value="${esc(z.love)}" placeholder="Another Player Character"></label>`;
			if (eff?.extra === 'elements') extra += `<div><b class="fucc-small">Two damage types</b>${chips('elements', ELEMENTS, z.elements)}</div>`;
			if (eff?.extra === 'scourge') extra += `<div><b class="fucc-small">One damage type</b>${chips('scourgeType', ELEMENTS, [z.scourgeType])}</div><div><b class="fucc-small">Two status effects</b>${chips('scourgeStatus', STATUSES, z.scourgeStatus)}</div>`;
			blocks.push(`<section class="fucc-grant"><header><h3>Zero Power</h3></header>
				<p class="fucc-muted fucc-small">Your limit break: a 6-section Zero Clock fills when you lose HP, spend Fabula Points on invocations, or your trigger fires. When full, use the Skill action to unleash the effect. No two characters may share a trigger or an effect. High Fantasy Atlas p.124.${awakened ? ' <b>Awakened Power:</b> pick the effect now; the trigger is chosen when the power awakens in play (p.130).' : ''}</p>
				<div class="fucc-form"><label>Power name <span class="fucc-hint">Name it yourself, or use the name tables on p.128.</span><input type="text" name="opt.zero.name" value="${esc(z.name)}" placeholder="Thundering Fang"></label></div>
				${awakened ? '' : `<h4 class="fucc-sub">Trigger</h4><div class="fucc-opts">${list(ZERO_TRIGGERS, 'trigger', z.trigger, this.taken.trigger)}</div>`}
				<h4 class="fucc-sub">Effect</h4><div class="fucc-opts">${list(ZERO_EFFECTS, 'effect', z.effect, this.taken.effect)}</div>
				${extra ? `<div class="fucc-form fucc-textblock">${extra}</div>` : ''}
				${trig || eff ? `<div class="fucc-form fucc-textblock">${trig ? `<label>Trigger text <span class="fucc-hint">Edit to match the book if you like.</span><textarea name="opt.zero.triggerText" rows="3">${esc(z.triggerText)}</textarea></label>` : ''}${eff ? `<label>Effect text<textarea name="opt.zero.effectText" rows="3">${esc(z.effectText)}</textarea></label>` : ''}</div>` : ''}
			</section>`);
		}
		return `<div class="fucc-choices" data-scroll="extras">${blocks.join('')}</div>`;
	}

	#customWeaponHtml(left) {
		const s = this.s;
		const cw = s.cw;
		const sumr = customWeaponSummary(cw);
		const formKey = sumr.transforming ? s.cwForm : 'a';
		const f = cw[formKey];
		const entry = customWeaponEntry(cw);
		const ok = canEquip(entry, this.martials);
		const used = f.custom.reduce((n, id) => n + (CUSTOMIZATIONS.find((c) => c.id === id)?.slots ?? 0), 0);
		const custom = CUSTOMIZATIONS.map((c) => {
			const on = f.custom.includes(c.id);
			const lockedTransform = c.id === 'transforming' && formKey === 'b';
			const blocked = !on && (used + c.slots > 3 || (c.id === 'powerful' && (['arcane', 'dagger'].includes(f.category) || f.custom.includes('quick'))) || (c.id === 'quick' && f.custom.includes('powerful')));
			return `<div class="fucc-opt ${on ? 'is-on' : ''}"><div class="fucc-opt-row"><button type="button" class="fucc-check" data-action="cwToggle" data-id="${c.id}" aria-pressed="${on}" ${blocked || lockedTransform ? 'disabled' : ''}>${on ? '<i class="fa-solid fa-check"></i>' : ''}</button><span></span><b>${c.name}${c.martial ? ' <span class="fucc-martial" title="Makes the weapon martial">M</span>' : ''}</b><span class="fucc-muted fucc-small">${c.slots > 1 ? 'counts as 2' : ''}</span></div><div class="fucc-small fucc-opt-sum">${esc(c.summary)}</div></div>`;
		}).join('');
		const sel = (name, value, options) => `<select name="${name}">${options.map(([v, l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
		return `<div class="fucc-cw" data-scroll="cw">
			<p class="fucc-muted fucc-small">Two-handed, 300 z, HR + 5 physical, then three customizations. High Fantasy Atlas p.106 (same rules in every Atlas).</p>
			<div class="fucc-form"><label>Weapon name<input type="text" name="cw.name" value="${esc(cw.name)}" placeholder="Gunblade, battle umbrella…"></label></div>
			${sumr.transforming ? `<div class="fucc-tabs fucc-cw-tabs"><button type="button" class="${formKey === 'a' ? 'is-on' : ''}" data-action="cwForm" data-f="a">Form I</button><button type="button" class="${formKey === 'b' ? 'is-on' : ''}" data-action="cwForm" data-f="b">Form II</button></div>` : ''}
			<div class="fucc-cw-grid">
				${sumr.transforming ? `<label>Form name<input type="text" name="cw.form.name" value="${esc(f.name)}"></label>` : ''}
				<label>Category${sel('cw.form.category', f.category, CATEGORIES.map((c) => [c, c[0].toUpperCase() + c.slice(1)]))}</label>
				<label>Type${sel('cw.form.type', f.type, [['melee', 'Melee'], ['ranged', 'Ranged']])}</label>
				<label>Accuracy${sel('cw.form.acc', `${f.primary}+${f.secondary}`, [['dex+ins', 'DEX + INS'], ['dex+mig', 'DEX + MIG']])}</label>
				${f.custom.includes('elemental') ? `<label>Element${sel('cw.form.element', f.element, ELEMENTS.map((e) => [e, e[0].toUpperCase() + e.slice(1)]))}</label>` : ''}
			</div>
			<div class="fucc-opts fucc-opts-tight">${custom}</div>
			<div class="fucc-cw-sum">
				${sumr.stats.map((st, i) => `<div><b>${sumr.transforming ? (i ? 'Form II' : 'Form I') : 'Stats'}</b> ${esc(formLine(st))}</div>`).join('')}
				<div><b>Cost</b> ${sumr.cost} z${sumr.martial ? ' · martial' : ''}</div>
				${sumr.problems.length ? `<ul class="fucc-notes">${sumr.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
				${!ok ? '<p class="fucc-warn fucc-small">None of your classes can equip this martial weapon.</p>' : ''}
				<button type="button" class="fucc-primary fucc-mini" data-action="cwAdd" ${sumr.problems.length || !ok || sumr.cost > left ? 'disabled' : ''}>Add to purchases (${sumr.cost} z)</button>
			</div>
		</div>`;
	}

	#extrasReview() {
		const s = this.s;
		const rows = [];
		if (OPT.bonds()) rows.push(`<li><b>Starting Bond</b><div>${esc(s.bond.name || '—')}${s.bond.feeling ? ` (${esc(s.bond.feeling)})` : ''}</div></li>`);
		if (OPT.quirks()) rows.push(`<li><b>Quirk</b><div>${esc(s.quirk.name || '—')}</div></li>`);
		if (OPT.camp()) rows.push(`<li><b>Camp Activities</b><div>${esc(s.camp.picks.join(', ') || '—')}</div></li>`);
		if (OPT.zero()) {
			const t = ZERO_TRIGGERS.find((x) => x.id === s.zero.trigger)?.name ?? (OPT.awakened() ? 'awakens in play' : '—');
			const e = ZERO_EFFECTS.find((x) => x.id === s.zero.effect)?.name ?? '—';
			rows.push(`<li><b>Zero Power</b><div>${esc(s.zero.name || e)}: ${esc(t)} → ${esc(e)}</div></li>`);
		}
		if (OPT.higherHp()) rows.push('<li><b>Higher HP</b><div>+10 maximum HP</div></li>');
		return rows.length ? `<h3>Optional rules</h3><ul class="fucc-ul">${rows.join('')}</ul>` : '';
	}

	static #onPickQuirk(ev, t) {
		const q = this.s.quirk;
		const n = t.dataset.name;
		if (q.pick === n) {
			this.s.quirk = { pick: '', name: '', text: '' };
		} else {
			const keepText = q.pick === '__custom' || !q.text.trim() ? '' : q.text;
			this.s.quirk = { pick: n, name: n === '__custom' ? '' : n, text: keepText };
		}
		this.render();
	}
	static #onToggleCamp(ev, t) {
		const c = this.s.camp;
		const n = t.dataset.name;
		if (c.picks.includes(n)) c.picks = c.picks.filter((x) => x !== n);
		else if (c.picks.length < CAMP_PICKS) {
			c.picks.push(n);
			c.text[n] ??= CAMP_ACTIVITIES.find((a) => a.name === n)?.summary ?? '';
		}
		this.render();
	}
	static #onPickZero(ev, t) {
		const z = this.s.zero;
		const { kind, id } = t.dataset;
		const list = kind === 'trigger' ? ZERO_TRIGGERS : ZERO_EFFECTS;
		const item = list.find((x) => x.id === id);
		if (z[kind] === id) {
			z[kind] = '';
			z[`${kind}Text`] = '';
		} else {
			z[kind] = id;
			z[`${kind}Text`] = item?.summary ?? '';
		}
		this.render();
	}
	static #onToggleZeroOpt(ev, t) {
		const z = this.s.zero;
		const { kind, value } = t.dataset;
		if (kind === 'scourgeType') z.scourgeType = z.scourgeType === value ? '' : value;
		else {
			const arr = z[kind];
			if (arr.includes(value)) z[kind] = arr.filter((x) => x !== value);
			else if (arr.length < 2) arr.push(value);
		}
		this.render();
	}
	static #onCwToggle(ev, t) {
		const cw = this.s.cw;
		const key = customWeaponSummary(cw).transforming ? this.s.cwForm : 'a';
		const f = cw[key];
		const id = t.dataset.id;
		if (f.custom.includes(id)) {
			f.custom = f.custom.filter((x) => x !== id);
			if (id === 'transforming' && key === 'a') {
				cw.b = { ...cw.b, custom: [] };
				this.s.cwForm = 'a';
			}
		} else {
			f.custom.push(id);
			if (id === 'transforming' && key === 'a' && !cw.b.custom.includes('transforming')) cw.b.custom = ['transforming', ...cw.b.custom];
		}
		this.render();
	}
	static #onCwForm(ev, t) {
		this.s.cwForm = t.dataset.f;
		this.render();
	}
	static #onCwAdd() {
		const key = `c${++this.cartSeq}`;
		this.s.cart.push({ key, custom: foundry.utils.deepClone ? foundry.utils.deepClone(this.s.cw) : JSON.parse(JSON.stringify(this.s.cw)) });
		this.#autoEquip(key);
		this.s.cw = blankCustomWeapon();
		this.s.cwForm = 'a';
		this.render();
	}

	/* ---------------- actions ---------------- */

	static #onStep(ev, t) {
		this.s.step = Number(t.dataset.step);
		this.render();
	}
	static #onNext() {
		this.s.step = Math.min(this.steps.length - 1, this.s.step + 1);
		this.render();
	}
	static #onBack() {
		this.s.step = Math.max(0, this.s.step - 1);
		this.render();
	}
	static #onPickTheme(ev, t) {
		this.s.theme = t.dataset.value;
		this.render();
	}
	static #onToggleClass(ev, t) {
		const f = t.dataset.fuid;
		const s = this.s;
		if (s.classes.includes(f)) {
			s.classes = s.classes.filter((x) => x !== f);
			for (const sk of this.catalog.skillsOf(f)) delete s.skills[sk.uuid];
			this.#prunePicks();
		} else if (s.classes.length < MAX_CLASSES) {
			s.classes.push(f);
			// give the new class its first level automatically when there is room and a single obvious Skill
		}
		this.#pruneCart();
		this.render();
	}
	static async #onClassInfo(ev, t) {
		this.s.info = this.s.info === t.dataset.fuid ? null : t.dataset.fuid;
		await this.render();
		// bring the opened write-up into view without jumping the list around
		if (this.s.info) this.element?.querySelector('.fucc-class.is-info')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}
	static #onSkillPlus(ev, t) {
		const sk = this.catalog.byUuid.get(t.dataset.uuid);
		const cur = this.s.skills[sk.uuid] ?? 0;
		if (cur < (sk.sys.level?.max ?? 1) && this.totalLevels < START_LEVEL) this.s.skills[sk.uuid] = cur + 1;
		this.render();
	}
	static #onSkillMinus(ev, t) {
		const cur = this.s.skills[t.dataset.uuid] ?? 0;
		if (cur <= 1) delete this.s.skills[t.dataset.uuid];
		else this.s.skills[t.dataset.uuid] = cur - 1;
		this.#prunePicks();
		this.render();
	}
	static #onExpand(ev, t) {
		const u = t.dataset.uuid;
		if (this.expanded.has(u)) this.expanded.delete(u);
		else {
			this.expanded.add(u);
			this.#want(u);
		}
		this.render();
	}
	static #onTogglePick(ev, t) {
		const { key, uuid } = t.dataset;
		const g = this.grants.find((x) => x.key === key);
		const cur = this.s.picks[key] ?? [];
		if (cur.includes(uuid)) this.s.picks[key] = cur.filter((u) => u !== uuid);
		else if (g && cur.length < g.count) this.s.picks[key] = [...cur, uuid];
		this.render();
	}
	static #onProfile(ev, t) {
		const p = t.dataset.profile;
		const s = this.s;
		s.profile = p;
		// keep the current ordering of strengths: highest die to the Attribute that was highest
		const order = ATTRS.map(([k]) => k).sort((a, b) => s.attrs[b] - s.attrs[a]);
		const dice = [...PROFILES[p].dice].sort((a, b) => b - a);
		order.forEach((k, i) => (s.attrs[k] = dice[i]));
		this.render();
	}
	static #onBuy(ev, t) {
		const key = `c${++this.cartSeq}`;
		this.s.cart.push({ key, uuid: t.dataset.uuid });
		this.#autoEquip(key);
		this.render();
	}
	static #onUnbuy(ev, t) {
		const key = t.dataset.key;
		this.s.cart = this.s.cart.filter((c) => c.key !== key);
		for (const k of Object.keys(this.s.equip)) if (this.s.equip[k] === key) this.s.equip[k] = null;
		this.render();
	}
	static #onShopTab(ev, t) {
		this.s.shopTab = t.dataset.tab;
		this.render();
	}
	static #onPortrait() {
		const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
		new FP({
			type: 'image',
			current: this.s.img,
			callback: (path) => {
				this.s.img = path;
				this.render();
			},
		}).render(true);
	}
	static async #onReloadPacks() {
		this.catalog = await getCatalog(true);
		this.render();
	}
	static async #onCreate() {
		if (this.busy || this.issues().length) return;
		this.busy = true;
		this.render();
		try {
			const actor = await this.#build();
			ui.notifications.info(`${actor.name} is ready.`);
			actor.sheet?.render(true);
			this.close();
		} catch (err) {
			console.error(`${MODULE_ID} |`, err);
			const perm = /permission|lacks/i.test(String(err?.message));
			ui.notifications.error(perm ? 'You do not have permission to create actors. Ask your GM to make a blank character for you, then open the creator from its sheet.' : `Character creation failed: ${err?.message ?? err}`);
			this.busy = false;
			this.render();
		}
	}

	#prunePicks() {
		const valid = new Map(this.grants.map((g) => [g.key, g]));
		for (const k of Object.keys(this.s.picks)) {
			const g = valid.get(k);
			if (!g) delete this.s.picks[k];
			else this.s.picks[k] = this.s.picks[k].slice(0, g.count);
		}
	}
	#pruneCart() {
		/* martial legality is reported as an issue rather than silently removing purchases */
	}

	/* ---------------- building the actor ---------------- */

	async #build() {
		const s = this.s;
		const cat = this.catalog;
		const fromPack = async (uuid) => {
			const doc = await fromUuid(uuid);
			if (!doc) throw new Error(`Could not load ${uuid}`);
			const data = game.items.fromCompendium(doc, { keepId: false });
			delete data.folder;
			return data;
		};

		// --- items, remembering where each came from
		const items = [];
		const meta = []; // parallel: {role, ref}
		for (const f of s.classes) {
			const c = this.classEntry(f);
			const d = await fromPack(c.uuid);
			foundry.utils.setProperty(d, 'system.level.value', this.classLevel(f));
			items.push(d);
			meta.push({ role: 'class', ref: f });
			for (const sk of cat.skillsOf(f)) {
				const sl = s.skills[sk.uuid];
				if (!sl) continue;
				const ds = await fromPack(sk.uuid);
				foundry.utils.setProperty(ds, 'system.level.value', sl);
				items.push(ds);
				meta.push({ role: 'skill', ref: sk.uuid, cls: f, sl, grantsSpell: traitsOf(sk.sys).includes(SPELL_SKILL_TRAIT) });
			}
		}
		for (const g of this.grants)
			for (const u of s.picks[g.key] ?? []) {
				items.push(await fromPack(u));
				meta.push({ role: g.kind, ref: u, grant: g.key });
			}
		for (const f of this.autoFeatures) {
			items.push(await fromPack(f.uuid));
			meta.push({ role: 'feature', ref: f.uuid });
		}
		for (const c of s.cart) {
			items.push(c.custom ? customWeaponItem(c.custom) : await fromPack(c.uuid));
			meta.push({ role: 'gear', ref: c.key });
		}
		// optional rules
		if (OPT.quirks() && s.quirk.pick) {
			const q = QUIRKS.find((x) => x.name === s.quirk.pick);
			items.push(quirkItem({ name: s.quirk.name, text: s.quirk.text, ref: q ? pagesText(q.pages) : 'Custom Quirk' }));
			meta.push({ role: 'optional' });
		}
		if (OPT.camp())
			for (const n of s.camp.picks) {
				const a = CAMP_ACTIVITIES.find((x) => x.name === n);
				items.push(campItem({ ...a, text: s.camp.text[n] ?? a.summary }));
				meta.push({ role: 'optional' });
			}
		if (OPT.zero() && s.zero.effect) {
			items.push(zeroItem(s.zero, OPT.awakened()));
			meta.push({ role: 'optional' });
		}

		// --- savings
		let zenit = Math.max(0, this.budget - this.spent);
		if (game.settings.get(MODULE_ID, 'rollSavings')) {
			const roll = await new Roll('2d6 * 10').evaluate();
			zenit += roll.total;
			await roll.toMessage({ flavor: `${s.name}: starting savings (2d6 × 10 zenit)` });
		}

		const system = {
			level: { value: START_LEVEL },
			attributes: Object.fromEntries(ATTRS.map(([k]) => [k, { base: s.attrs[k] }])),
			resources: {
				identity: { name: s.identity.trim() },
				theme: { name: s.theme.trim() },
				origin: { name: s.origin.trim() },
				zenit: { value: zenit },
				fp: { value: STARTING_FP },
				exp: { value: 0 },
			},
		};
		if (OPT.higherHp()) system.resources.hp = { bonus: 10 };
		if (OPT.bonds() && s.bond.name.trim()) {
			const field = BOND_FEELINGS.find(([, f]) => f === s.bond.feeling)?.[0];
			system.bonds = [{ name: s.bond.name.trim(), admInf: '', loyMis: '', affHat: '', ...(field ? { [field]: s.bond.feeling } : {}) }];
		}

		let actor = this.target;
		if (actor) {
			await actor.update({ name: s.name.trim(), img: s.img, system, 'prototypeToken.name': s.name.trim() });
		} else {
			const data = { name: s.name.trim(), type: 'character', img: s.img, system, prototypeToken: { name: s.name.trim(), actorLink: true, disposition: 1 } };
			if (!s.img.includes('mystery-man')) data.prototypeToken.texture = { src: s.img };
			actor = await Actor.create(data);
		}
		if (!actor) throw new Error('The actor could not be created.');

		// Tag every item so it can be found again: the system may add, drop or reorder items while creating them,
		// so position in the returned list can't be trusted (that put spells into weapon slots).
		const runTag = foundry.utils.randomID(6);
		items.forEach((d, i) => {
			const tag = `${runTag}-${i}`;
			foundry.utils.setProperty(d, `flags.${MODULE_ID}.tag`, tag);
			meta[i].tag = tag;
		});
		const created = await actor.createEmbeddedDocuments('Item', items);
		const byTag = new Map();
		for (const doc of [...created, ...actor.items]) {
			const tag = doc?.getFlag?.(MODULE_ID, 'tag') ?? doc?.flags?.[MODULE_ID]?.tag;
			if (tag && !byTag.has(tag)) byTag.set(tag, doc.id);
		}
		const idOf = (pred) => {
			const m = meta.find(pred);
			return m ? (byTag.get(m.tag) ?? null) : null;
		};
		const idAt = (i) => (meta[i] ? (byTag.get(meta[i].tag) ?? '') : '');

		// --- equipment slots
		const equipped = {};
		for (const [slot, key] of Object.entries(s.equip)) equipped[slot] = key ? idOf((m) => m.role === 'gear' && m.ref === key) : null;

		const update = { 'system.equipped': equipped };

		// --- advancement log: one entry per level, in the order the Skills were bought
		if (game.settings.get(MODULE_ID, 'recordAdvancements')) {
			try {
				const adv = [];
				const usedSpell = new Set();
				for (const f of s.classes) {
					let first = true;
					meta.forEach((m, i) => {
						if (m.role !== 'skill' || m.cls !== f) return;
						for (let n = 0; n < m.sl; n++) {
							const entry = { class: { id: first ? (idOf((x) => x.role === 'class' && x.ref === f) ?? '') : '', locked: false }, skill: { id: idAt(i), value: n + 1, max: m.sl }, entries: {} };
							first = false;
							if (m.grantsSpell) {
								const sp = meta.findIndex((x, j) => x.role === 'spell' && x.grant === `spell:${f}` && !usedSpell.has(j));
								if (sp >= 0) {
									usedSpell.add(sp);
									entry.entries.spell = { id: idAt(sp), locked: false };
								} else entry.entries.spell = { id: '', locked: false };
							}
							adv.push(entry);
						}
					});
				}
				update['system.advancements'] = adv.slice(0, START_LEVEL);
			} catch (err) {
				console.warn(`${MODULE_ID} | skipped advancement log`, err);
			}
		}
		await actor.update(update);

		// --- start at full resources (max values are computed from the items just added)
		const r = actor.system.resources;
		await actor.update({ 'system.resources.hp.value': r.hp.max, 'system.resources.mp.value': r.mp.max, 'system.resources.ip.value': r.ip.max });
		return actor;
	}
}
