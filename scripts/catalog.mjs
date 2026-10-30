import { MODULE_ID, bookOf } from './rules.mjs';

const TYPES = new Set(['class', 'skill', 'spell', 'classFeature', 'weapon', 'armor', 'shield', 'accessory']);
const FIELDS = [
	'system.fuid',
	'system.source',
	'system.summary',
	'system.class',
	'system.level',
	'system.benefits',
	'system.traits',
	'system.featureType',
	'system.cost',
	'system.isMartial',
	'system.type',
	'system.category',
	'system.hands',
	'system.def',
	'system.mdef',
	'system.init',
	'system.accuracy',
	'system.damage',
	'system.damageType',
	'system.attributes',
	'system.quality',
	'system.duration',
	'system.isOffensive',
	'system.targeting',
	'system.description',
];

const slug = (s) =>
	String(s ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/**
 * Scan every Item compendium (system packs first, then modules, then world) and
 * build a de-duplicated catalog of everything character creation needs.
 */
export async function loadCatalog() {
	const ignored = String(game.settings.get(MODULE_ID, 'ignoredPacks') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const rank = (p) => (p.metadata.packageType === 'system' ? 0 : p.metadata.packageType === 'module' ? 1 : 2);
	const packs = game.packs
		.filter((p) => p.documentName === 'Item' && !ignored.includes(p.collection))
		.sort((a, b) => rank(a) - rank(b));

	const seen = new Map();
	const all = [];
	const heroics = [];
	for (const pack of packs) {
		let index;
		try {
			index = await pack.getIndex({ fields: FIELDS });
		} catch (err) {
			console.warn(`${MODULE_ID} | could not index ${pack.collection}`, err);
			continue;
		}
		for (const e of index) {
			if (e.type === 'heroic') {
				heroics.push(e);
				continue;
			}
			if (!TYPES.has(e.type)) continue;
			const sys = e.system ?? {};
			const key = `${e.type}|${sys.fuid || slug(e.name)}`;
			if (seen.has(key)) continue;
			const entry = {
				uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`,
				id: e._id,
				pack: pack.collection,
				packLabel: pack.metadata.label,
				name: e.name,
				img: e.img,
				type: e.type,
				fuid: sys.fuid || slug(e.name),
				sys,
				book: bookOf(sys.source),
			};
			seen.set(key, entry);
			all.push(entry);
		}
	}

	const byName = (a, b) => a.name.localeCompare(b.name);
	const classes = all.filter((e) => e.type === 'class').sort(byName);
	const skills = all.filter((e) => e.type === 'skill').sort(byName);
	const locked = heroicSpells(heroics);
	const spells = all.filter((e) => e.type === 'spell').sort(byName);
	// spells a level 1 character may pick: not a Heroic Skill's spell, not an NPC spell
	const legal = spells.filter((s) => {
		const cls = String(s.sys.class?.value ?? '').trim();
		if (!cls || cls.toLowerCase() === 'npc') return false;
		if (/heroic/i.test(s.pack)) return false;
		if (locked.ids.has(s.id) || locked.uuids.has(s.uuid)) return false;
		if (locked.names.has(`${cls}|${s.name.toLowerCase()}`) || locked.names.has(`|${s.name.toLowerCase()}`)) return false;
		return true;
	});
	const features = all.filter((e) => e.type === 'classFeature').sort(byName);
	const equipment = all.filter((e) => ['weapon', 'armor', 'shield', 'accessory'].includes(e.type)).sort((a, b) => (a.sys.cost?.value ?? 0) - (b.sys.cost?.value ?? 0) || byName(a, b));

	return {
		classes,
		skills,
		spells,
		features,
		equipment,
		byUuid: new Map(all.map((e) => [e.uuid, e])),
		skillsOf: (classFuid) => skills.filter((s) => s.sys.class?.value === classFuid),
		spellsOf: (classFuid) => legal.filter((s) => s.sys.class?.value === classFuid),
		featuresOf: (types) => features.filter((f) => types.includes(f.sys.featureType)),
		packCount: packs.length,
	};
}

/**
 * Spells that only a Heroic Skill grants. Project FU links them from the Heroic Skill's
 * description (@UUID[...]) and names them in its summary ("Learn the Comet spell.").
 */
function heroicSpells(heroics) {
	const ids = new Set();
	const uuids = new Set();
	const names = new Set();
	for (const h of heroics) {
		const sys = h.system ?? {};
		const desc = String(sys.description ?? '');
		// only a link the skill hands over ("Add the @UUID[...]{Comet} spell"), not one it merely modifies
		for (const m of desc.matchAll(/\b(?:add|learn|gain)\s+the\s+(?:<[^>]+>\s*)*@UUID\[([^\]]+)\](?:\{[^}]*\})?(?:\s*<[^>]+>)*\s+spell/gi)) {
			uuids.add(m[1]);
			const id = m[1].split('.').pop();
			if (id) ids.add(id);
		}
		const cls = String(sys.class?.value ?? '').trim();
		const text = `${sys.summary?.value ?? ''} ${desc.replace(/<[^>]+>/g, ' ')}`;
		for (const m of text.matchAll(/\b(?:learn|gain|add)\s+the\s+(?:ultimate\s+)?(?:[\w-]+\s+)?spell[:\s]+([A-Z][\w' -]{1,40}?)(?:[.,;]|\s+spell|$)/g)) names.add(`${cls}|${m[1].trim().toLowerCase()}`);
		for (const m of text.matchAll(/\b(?:learn|gain|add)\s+the\s+([A-Z][\w' -]{1,40}?)\s+spell\b/g)) names.add(`${cls}|${m[1].trim().toLowerCase()}`);
	}
	return { ids, uuids, names };
}

const enrichCache = new Map();

/**
 * Class features (Arcana, magiseeds, vehicle modules, dances, symbols, gifts, keys, tones…) keep their rules in
 * feature-specific fields rather than a description, so render them the way Project FU's own sheet tables do:
 * the feature type's expand template, falling back to its preview template.
 */
async function describeFeature(doc) {
	const model = doc.system?.data;
	const Type = model?.constructor;
	if (!Type) return '';
	const render = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
	let additionalData;
	try {
		additionalData = await Type.getAdditionalData?.(model);
	} catch {
		additionalData = undefined;
	}
	const ctx = { ...doc, item: doc, system: doc.system, additionalData };
	for (const key of ['expandTemplate', 'previewTemplate']) {
		let path;
		try {
			path = Type[key];
		} catch {
			continue;
		}
		if (!path) continue;
		try {
			const html = await render(path, ctx);
			if (html && html.replace(/<[^>]+>/g, '').trim()) return html;
		} catch (err) {
			console.debug(`${MODULE_ID} | ${key} for ${doc.name}`, err);
		}
	}
	return '';
}

/** Load a compendium document and return its enriched description HTML (cached). */
export async function describe(uuid) {
	if (enrichCache.has(uuid)) return enrichCache.get(uuid);
	const p = (async () => {
		const doc = await fromUuid(uuid);
		if (!doc) return '<p><em>Not found.</em></p>';
		const sys = doc.system ?? {};
		let raw = typeof sys.description === 'string' ? sys.description : '';
		if (!raw && typeof sys.data === 'object' && typeof sys.data?.description === 'string') raw = sys.data.description;
		const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
		const enrich = async (html) => {
			try {
				return await TE.enrichHTML(html, { async: true, relativeTo: doc });
			} catch {
				return html;
			}
		};
		let out = raw ? await enrich(raw) : '';
		if (doc.type === 'classFeature') {
			const feature = await describeFeature(doc);
			// the feature's own view usually includes its description; only keep both when it doesn't
			if (feature) out = feature.includes(raw.slice(0, 40)) || !raw ? feature : out + feature;
		}
		if (!out.replace(/<[^>]+>/g, '').trim()) {
			const summary = typeof sys.summary?.value === 'string' ? sys.summary.value : '';
			out = summary ? `<p>${summary}</p>` : '<p><em>No description.</em></p>';
		}
		return out;
	})();
	enrichCache.set(uuid, p);
	return p;
}
