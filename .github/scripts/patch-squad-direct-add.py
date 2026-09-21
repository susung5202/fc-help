from pathlib import Path

path = Path("components/SquadMaker.tsx")
text = path.read_text()
old = '''                      onClick={() => {
                        setPendingPlayer(player);
                        setPendingGrade(selectedGrade);
                      }}
'''
new = '''                      onClick={() => onChoose(player, selectedGrade)}
'''
if old not in text:
    raise SystemExit("target search-result click handler not found")
text = text.replace(old, new, 1)
path.write_text(text)
