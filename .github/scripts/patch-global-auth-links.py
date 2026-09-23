from pathlib import Path
import re

ROOT = Path("app")

pattern = re.compile(
    r'<Link(?P<before>[^>]*)href="/login"(?P<after>[^>]*)>\s*로그인\s*</Link>',
    re.DOTALL,
)

changed = []
for path in ROOT.rglob("*.tsx"):
    text = path.read_text(encoding="utf-8")
    updated, count = pattern.subn("<AccountButton />", text)
    if count == 0:
        continue

    import_line = 'import AccountButton from "@/components/AccountButton";\n'
    if import_line not in updated:
        link_import = 'import Link from "next/link";\n'
        if link_import in updated:
            updated = updated.replace(link_import, link_import + import_line, 1)
        else:
            updated = import_line + updated

    path.write_text(updated, encoding="utf-8")
    changed.append(str(path))

if not changed:
    raise SystemExit("No hardcoded login header links found")

print("Patched:")
for item in changed:
    print(f"- {item}")
