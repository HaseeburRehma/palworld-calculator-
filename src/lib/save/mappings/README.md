# Save-file mappings

Two tables bridge Palworld's internal identifiers to the data this calculator uses:

- `pal-ids.ts` maps `Pal_<Name>` → our `Pal.id` (slug from `data/pals.json`).
- `passive-ids.ts` maps `Trait_<Name>` (and a few stat-tier conventions like `PAL_ALL_ATK_up1`) → our `PassiveSkill.id`.

These tables drift every patch. The parser is built around tolerating drift: anything missing surfaces in `unmappedPalIds` / `unmappedPassiveIds` on the parse result, and the import UI shows them in a yellow row so the user can either skip-import them or report the gap.

## Updating after a patch

1. Drop a fresh save file into `tests/fixtures/saves/`.
2. Run `pnpm verify-mappings`. The script parses each fixture and prints any unmapped ids it sees.
3. For each unmapped Pal id:
   - Look the species up by name in `data/pals.json`.
   - Add an entry to `PAL_ID_MAP` in `pal-ids.ts`.
   - If the species isn't in `data/pals.json` yet, the scraper needs to fill it in first — open an issue.
4. For each unmapped passive id:
   - Find or add the equivalent in `data/passives.json`.
   - Add the mapping entry.
5. Re-run `pnpm verify-mappings`. It should report 0 unmapped.

If you find **a lot** of unmapped ids at once after a patch, the format itself may have changed (new GVAS version, new container variant). Check `extractors/version.ts` first.

## Variant prefixes

Boss / raid / gym / predator forms share the underlying species id for breeding. `mapRawIdToPalId` strips these prefixes before lookup:

- `BOSS_Pal_<X>`
- `RAID_Pal_<X>`
- `GYM_Pal_<X>`
- `PREDATOR_Pal_<X>`
- `SUMMON_Pal_<X>`

If new prefixes show up, add them to the `VARIANT_PREFIXES` array in `pal-ids.ts`.

## Don't put logic here

These files are intentionally **data**, not code. The lookup helpers are tiny and lookup-only. If you find yourself wanting to encode policy ("variants of Pal X count as Pal Y for breeding purposes"), put it in `extractors/pals.ts` instead so it's one layer up from the raw mapping.
