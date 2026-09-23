#!/usr/bin/env python3
"""Check compatible and incompatible local tarball peers without Octane code."""
import io
import json
import os
import subprocess
import sys
import tarfile
from pathlib import Path

root = Path(sys.argv[1]).resolve()
root.mkdir(parents=True, exist_ok=False)
results = []
for arm in ('11', '12'):
    binary = os.path.abspath(os.environ['PNPM_BENCH_' + arm])
    version = subprocess.check_output([binary, '--version'], text=True).strip()
    for provider_version in ('1.0.0', '2.0.0'):
        for overrides in (False, True):
            case = root / f'{arm}-{provider_version}-overrides-{overrides}'
            app = case / 'app'
            app.mkdir(parents=True)
            manifests = {
                'provider': {'name': '@repro/provider', 'version': provider_version},
                'consumer': {'name': '@repro/consumer', 'version': '1.0.0',
                             'peerDependencies': {'@repro/provider': '^1.0.0'}},
            }
            for name, manifest in manifests.items():
                content = json.dumps(manifest).encode()
                info = tarfile.TarInfo('package/package.json')
                info.size = len(content)
                with tarfile.open(case / f'{name}.tgz', 'w:gz') as archive:
                    archive.addfile(info, io.BytesIO(content))
            dependencies = {f'@repro/{name}': f'file:../{name}.tgz' for name in manifests}
            (app / 'package.json').write_text(json.dumps({
                'name': 'peer-repro', 'private': True, 'dependencies': dependencies,
            }))
            # JSON is valid YAML and avoids requiring an extra fixture dependency.
            (app / 'pnpm-workspace.yaml').write_text(json.dumps({
                'autoInstallPeers': False, 'strictPeerDependencies': True,
                **({'overrides': dependencies} if overrides else {}),
            }))
            command = [binary, 'install', '--offline', '--ignore-scripts',
                       '--no-frozen-lockfile', '--store-dir', str(case / 'store')]
            completed = subprocess.run(command, cwd=app, capture_output=True, text=True)
            output = completed.stdout + completed.stderr
            (case / 'install.log').write_text(output)
            expected_success = provider_version == '1.0.0'
            accepted = completed.returncode == 0 if expected_success else (
                completed.returncode != 0 and 'ERR_PNPM_PEER_DEP_ISSUES' in output)
            row = {'arm': arm, 'binary_version': version, 'provider': provider_version,
                   'overrides': overrides, 'exit_code': completed.returncode,
                   'expected_success': expected_success, 'contract_passed': accepted,
                   'command': command, 'log': str(case / 'install.log')}
            results.append(row)
            (root / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
            print(json.dumps(row), flush=True)
            if not accepted:
                raise SystemExit(f'Unexpected peer validation result: {case}')
