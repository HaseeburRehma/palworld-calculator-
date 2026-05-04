/**
 * Pal-image asset name mapping.
 *
 * Palworld's internal asset filenames don't match our slugs (Lamball is
 * `T_SheepBall_icon_normal.png` internally). This module bridges the two so
 * `PalImage` can resolve a CDN URL when the Pal record doesn't have its own
 * `imageUrl` set and no local PNG exists under `public/pals/`.
 *
 * Source of asset names: the public icon catalog at https://palworld.gg
 * (a community fan site, like this one). Their `/_ipx/.../images/full_palicon/`
 * paths point at the underlying `T_*_icon_normal.png` files; we hit the
 * un-optimized originals directly.
 *
 * Attribution: Pal art is © Pocketpair, Inc. We're a fan tool, like
 * palworld.gg, and treat their published asset names as the same kind of
 * community-maintained reference data the breeding combos and passive math
 * already are. See README CREDITS.
 *
 * Updating after the game adds new Pals:
 *   1. Find the new Pal at https://palworld.gg/pals (or look at its
 *      breeding-calculator HTML — image src ends in `T_<Name>_icon_normal.png`).
 *   2. Add an entry below: `"<our-slug>": "T_<Name>"`.
 *   3. Done — the mapping flows through `getPalImageUrl()`.
 *
 * If the Pal isn't in this map, `getPalImageUrl()` returns null and the
 * caller falls back to `/pals/<slug>.png` and ultimately the styled placeholder.
 */

const CDN_BASE = "https://palworld.gg/images/full_palicon";

/** Slug (matches `Pal.id`) → palworld.gg asset basename (no extension). */
const PAL_IMAGE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  /* ---- Hand-curated Phase 1 set: matches data/pals.json. ---- */
  lamball: "T_SheepBall",
  cattiva: "T_PinkCat",
  chikipi: "T_ChickenPal",
  lifmunk: "T_Carbunclo",
  foxparks: "T_Kitsunebi",
  fuack: "T_BluePlatypus",
  sparkit: "T_ElecCat",
  tanzee: "T_Monkey",
  rooby: "T_FlameBambi",
  pengullet: "T_Penguin",
  penking: "T_CaptainPenguin",
  jolthog: "T_Hedgehog",
  gumoss: "T_PlantSlime",
  vixy: "T_CuteFox",
  hoocrates: "T_WizardOwl",
  teafant: "T_Ganesha",
  depresso: "T_NegativeKoala",
  cremis: "T_WoolFox",
  daedream: "T_DreamDemon",
  rushoar: "T_Boar",
  nox: "T_NightFox",
  fuddler: "T_CuteMole",
  killamari: "T_NegativeOctopus",
  mau: "T_Bastet",
  "mau-cryst": "T_Bastet_Ice",

  /* ---- Extended set: ready for when data/pals.json grows. ---- */
  /* Names below are extracted from palworld.gg's published catalog; if a
     Pal isn't in data/pals.json yet, the entry is harmless — it only
     activates when a matching record exists. */
  anubis: "T_Anubis",
  incineram: "T_Baphomet",
  "incineram-noct": "T_Baphomet_Dark",
  "fuack-ignis": "T_BluePlatypus_Fire",
  tocotoco: "T_ColorfulBird",
  eikthyrdeer: "T_Deer",
  "eikthyrdeer-terra": "T_Deer_Ground",
  digtoise: "T_DrillGame",
  galeclaw: "T_Eagle",
  grizzbolt: "T_ElecPanda",
  direhowl: "T_Garm",
  gorirat: "T_Gorilla",
  "gorirat-terra": "T_Gorilla_Ground",
  "jolthog-cryst": "T_Hedgehog_Ice",
  univolt: "T_Kirin",
  "foxparks-cryst": "T_Kitsunebi_Ice",
  bristla: "T_LittleBriarRose",
  lunaris: "T_Mutant",
  "pengullet-lux": "T_Penguin_Electric",
  dazzi: "T_RaijinDaughter",
  "dazzi-noct": "T_RaijinDaughter_Water",
  gobfin: "T_SharkKid",
  "gobfin-ignis": "T_SharkKid_Fire",
  jormuntide: "T_Umihebi",
  "jormuntide-ignis": "T_Umihebi_Fire",
  loupmoon: "T_Werewolf",
  "loupmoon-cryst": "T_Werewolf_Ice",
  hangyu: "T_WindChimes",
  "hangyu-cryst": "T_WindChimes_Ice",
  suzaku: "T_Suzaku",
  "suzaku-aqua": "T_Suzaku_Water",
  pyrin: "T_FireKirin",
  "pyrin-noct": "T_FireKirin_Dark",
  elphidran: "T_FairyDragon",
  "elphidran-aqua": "T_FairyDragon_Water",
  woolipop: "T_SweetsSheep",
  cryolinx: "T_WhiteTiger",
  "cryolinx-terra": "T_WhiteTiger_Ground",
  melpaca: "T_Alpaca",
  surfent: "T_Serpent",
  "surfent-terra": "T_Serpent_Ground",
  cawgnito: "T_DarkCrow",
  azurobe: "T_BlueDragon",
  "azurobe-cryst": "T_BlueDragon_Ice",
  fenglope: "T_FengyunDeeper",
  "fenglope-lux": "T_FengyunDeeper_Electric",
  reptyro: "T_VolcanicMonster",
  "reptyro-cryst": "T_VolcanicMonster_Ice",
  maraith: "T_GhostBeast",
  robinquill: "T_RobinHood",
  "robinquill-terra": "T_RobinHood_Ground",
  relaxaurus: "T_LazyDragon",
  "relaxaurus-lux": "T_LazyDragon_Electric",
  kitsun: "T_AmaterasuWolf",
  "kitsun-noct": "T_AmaterasuWolf_Dark",
  leezpunk: "T_LizardMan",
  "leezpunk-ignis": "T_LizardMan_Fire",
  vanwyrm: "T_BirdDragon",
  "vanwyrm-cryst": "T_BirdDragon_Ice",
  dinossom: "T_FlowerDinosaur",
  "dinossom-lux": "T_FlowerDinosaur_Electric",
  frostallion: "T_IceHorse",
  "frostallion-noct": "T_IceHorse_Dark",
  mammorest: "T_GrassMammoth",
  "mammorest-cryst": "T_GrassMammoth_Ice",
  felbat: "T_CatVampire",
  broncherry: "T_SakuraSaurus",
  "broncherry-aqua": "T_SakuraSaurus_Water",
  faleris: "T_Horus",
  "faleris-aqua": "T_Horus_Water",
  blazamut: "T_KingBahamut",
  "blazamut-ryu": "T_KingBahamut_Dragon",
  caprity: "T_BerryGoat",
  "caprity-noct": "T_BerryGoat_Dark",
  reindrix: "T_IceDeer",
  shadowbeak: "T_BlackGriffon",
  sibelyx: "T_WhiteMoth",
  wixen: "T_FoxMage",
  "wixen-noct": "T_FoxMage_Dark",
  lovander: "T_PinkLizard",
  kelpsea: "T_Kelpie",
  "kelpsea-ignis": "T_Kelpie_Fire",
  "killamari-primo": "T_NegativeOctopus_Neutral",
  mozzarina: "T_CowPal",
  wumpo: "T_Yeti",
  "wumpo-botan": "T_Yeti_Grass",
  vaelet: "T_VioletFairy",
  nitewing: "T_HawkBird",
  flopie: "T_FlowerRabbit",
  lyleen: "T_LilyQueen",
  "lyleen-noct": "T_LilyQueen_Dark",
  elizabee: "T_QueenBee",
  beegarde: "T_SoldierBee",
  tombat: "T_CatBat",
  mossanda: "T_GrassPanda",
  "mossanda-lux": "T_GrassPanda_Electric",
  arsox: "T_FlameBuffalo",
  rayhound: "T_ThunderDog",
  astegon: "T_BlackMetalDragon",
  verdash: "T_GrassRabbitMan",
  foxcicle: "T_IceFox",
  jetragon: "T_JetDragon",
  blazehowl: "T_Manticore",
  "blazehowl-noct": "T_Manticore_Dark",
  kingpaca: "T_KingAlpaca",
  "kingpaca-cryst": "T_KingAlpaca_Ice",
  swee: "T_MopBaby",
  sweepa: "T_MopKing",
  katress: "T_CatMage",
  "katress-ignis": "T_CatMage_Fire",
  ribbuny: "T_PinkRabbit",
  "ribbuny-botan": "T_PinkRabbit_Grass",
  beakon: "T_ThunderBird",
  warsect: "T_HerculesBeetle",
  "warsect-terra": "T_HerculesBeetle_Ground",
  paladius: "T_SaintCentaur",
  chillet: "T_WeaselDragon",
  "chillet-ignis": "T_WeaselDragon_Fire",
  quivern: "T_SkyDragon",
  "quivern-botan": "T_SkyDragon_Grass",
  helzephyr: "T_HadesBird",
  "helzephyr-lux": "T_HadesBird_Electric",
  ragnahawk: "T_RedArmorBird",
  bushi: "T_Ronin",
  "bushi-noct": "T_Ronin_Dark",
  celaray: "T_FlyingManta",
  "celaray-lux": "T_FlyingManta_Thunder",
  necromus: "T_BlackCentaur",
  petallia: "T_FlowerDoll",
  grintale: "T_NaughtyCat",
  cinnamoth: "T_CuteButterfly",
  menasting: "T_DarkScorpion",
  "menasting-terra": "T_DarkScorpion_Ground",
  orserk: "T_ThunderDragonMan",
  "penking-lux": "T_CaptainPenguin_Black",
  dumud: "T_LazyCatfish",
  "dumud-gild": "T_LazyCatfish_Gold",
  flambelle: "T_LavaGirl",
  bellanoir: "T_NightLady",
  "bellanoir-libero": "T_NightLady_Dark",
  selyne: "T_MoonQueen",
  croajiro: "T_KendoFrog",
  "croajiro-noct": "T_KendoFrog_Dark",
  lullu: "T_LeafPrincess",
  shroomer: "T_MushroomDragon",
  "shroomer-noct": "T_MushroomDragon_Dark",
  kikit: "T_SmallArmadillo",
  sootseer: "T_CandleGhost",
  prixter: "T_ScorpionMan",
  knocklem: "T_WingGolem",
  yakumo: "T_GuardianDog",
  dogen: "T_SifuDog",
  dazemu: "T_FeatherOstrich",
  mimog: "T_MimicDog",
  xenovader: "T_DarkAlien",
  xenogard: "T_WhiteAlienDragon",
  xenolord: "T_DarkMechaDragon",
  nitemary: "T_GhostRabbit",
  starryon: "T_NightBlueHorse",
  silvegis: "T_WhiteShieldDragon",
  smokie: "T_BlackPuppy",
  celesdir: "T_WhiteDeer",
  omascul: "T_MysteryMask",
  splatterina: "T_GrimGirl",
  tarantriss: "T_PurpleSpider",
  azurmane: "T_BlueThunderHorse",
  gloopie: "T_OctopusGirl",
  whalaska: "T_IceNarwhal",
  "whalaska-ignis": "T_IceNarwhal_Fire",
  jelliette: "T_JellyfishFairy",
  bastigor: "T_SnowTigerBeastman",
  ghangler: "T_GhostAnglerfish",
  "ghangler-ignis": "T_GhostAnglerfish_Fire",
  icelyn: "T_IceWitch",
  herbil: "T_LeafMomonga",
  munchill: "T_IceCrocodile",
  finsider: "T_StuffedShark",
  "finsider-ignis": "T_StuffedShark_Fire",
  polapup: "T_IceSeal",
  braloha: "T_Plesiosaur",
  palumba: "T_TropicalOstrich",
  frostplume: "T_SnowPeafowl",
  jellroy: "T_JellyfishGhost",
  neptilius: "T_PoseidonOrca",
  nyafia: "T_BadCatgirl",
  prunelia: "T_BlueberryFairy",
  gildane: "T_GoldenHorse",
  turtacle: "T_TentacleTurtle",
  "turtacle-terra": "T_TentacleTurtle_Ground",
});

/**
 * Resolve a Pal id (the slug we use in `data/pals.json`) to a usable image
 * URL, or null when we don't have a mapping. Returning null lets the caller
 * fall through to other strategies (local file, placeholder).
 *
 * The id lookup is case-insensitive — the data file is lowercase but a typo
 * shouldn't take down the avatar.
 */
export function getPalImageUrl(palId: string | undefined | null): string | null {
  if (!palId) return null;
  const direct = PAL_IMAGE_NAMES[palId];
  if (direct) return `${CDN_BASE}/${direct}_icon_normal.png`;
  const lower = palId.toLowerCase();
  const fallback = PAL_IMAGE_NAMES[lower];
  if (fallback) return `${CDN_BASE}/${fallback}_icon_normal.png`;
  return null;
}

/**
 * Lookup the underlying asset basename (e.g. "T_SheepBall"). Used by the
 * download script to write files under `public/pals/<slug>.png`.
 */
export function getPalAssetName(palId: string): string | null {
  return PAL_IMAGE_NAMES[palId] ?? PAL_IMAGE_NAMES[palId.toLowerCase()] ?? null;
}

/** All known mapped slugs — useful for diagnostics + scripts. */
export function listMappedPalIds(): string[] {
  return Object.keys(PAL_IMAGE_NAMES);
}
