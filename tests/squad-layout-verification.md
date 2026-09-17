# Squad layout regression checks

Run `node --test tests/squad-layout.test.mjs` for formation naming, zone geometry, and saved-layout validation.

The corrected interaction uses invisible regions for all 27 field positions, with GK kept in its protected slot. No region grid is rendered. The dragged card shows the hovered position and its OVR before release. Team-color preview requests are debounced, cancelled when the target changes, and cached by the projected squad.

Additional browser checks cover LS, RS, CF, LF, RF, LCM, RCM, LDM, RDM, LCB, RCB, and SW: every hover displays the requested position and the returned OVR without changing saved positions. A 390px touch drag previews LCB and commits a 5-1-2-2 formation. Existing saved coordinates retain their labels after the regions are subdivided.

Browser checks performed on desktop (1100px) and mobile (390px), using an isolated browser context with sample players and stubbed card/team-color responses:

- Drag ST into the unoccupied central CB area: 11 players remain, the position becomes CB, and the name becomes 5-1-2-2.
- Card and team-color requests use the new CB position.
- Reload restores the custom position and formation.
- Dropping onto an occupied slot swaps both players; dropping onto an empty slot moves the player and leaves the source empty.
- GK-to-field and field-to-GK drops are rejected.
- Dropping outside the pitch preserves the arrangement.
- Real touch input moves a player at 390px without horizontal overflow or a framework error overlay.

The production build passes with temporary build-only VAPID and public Supabase placeholders. Live upstream team-color calculations were not tested with these fixtures. Existing SquadMaker lint findings remain at 7 errors; warnings decreased from 10 to 7. The new layout module and tests pass lint.
