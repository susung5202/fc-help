from pathlib import Path

path = Path("components/SquadMaker.tsx")
text = path.read_text()
old = 'return Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;'
new = 'return Math.round(ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length);'
if old not in text:
    raise SystemExit("average OVR expression not found")
path.write_text(text.replace(old, new, 1))
