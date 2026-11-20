# State

Updated: 2026-11-20

- M1, M2, M3, M6, M7: done. M7 still needs manual verification (`docs/milestones/07-ux-polish.md`).
- M4 restyle: partial. Done: emoji -> lucide-animated icons (`components/icons/`, `JournalIcon`), muted tag palette, outlines. Dead mood code removed.
- M5 month hints + tag filtering: **not done**.
- Cleanup pass (items 1-17) done 2026-11-20; see CHANGELOG. Decision: tombstone TTL stays 90 days.

## Known limits
- Replace-import tombstones only local records; records that exist only on Drive resurrect on next sync.
- Icons without an animated twin stay on lucide-react (Trash2, Pencil, Edit2, Minus, Repeat, Tag, Diamond, List, CheckSquare, CalendarRange, Command, Menu, Lightbulb, Music, Sprout, Star, Target).

## Deploy checks
- Cloudflare build variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set; build `npm run build`, output `out`.
- Google Cloud: scopes `drive.appdata`, `userinfo.email`, `userinfo.profile`; authorized JS origins include localhost + production; no client secret.
