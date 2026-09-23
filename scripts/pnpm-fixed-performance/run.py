#!/usr/bin/env python3
"""Compare exact pnpm releases serially in a disposable Git worktree."""
import hashlib, json, os, platform, re, shutil, statistics, subprocess, sys, time
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('BENCH_WORKTREE', str(BASE.parent / 'octane'))).resolve()
assert (ROOT / '.git').is_file(), 'Use a dedicated Git worktree'
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip() not in ('main', 'master')
VERSIONS = {'11': '11.15.1', '12': '12.6.0+90422c7'}
BINARIES = {v: os.path.abspath(os.environ['PNPM_BENCH_' + v]) for v in VERSIONS}
ORIGINAL = (ROOT / 'package.json').read_text()
LOCK = hashlib.sha256((ROOT / 'pnpm-lock.yaml').read_bytes()).hexdigest()
ENV = os.environ.copy()
ENV.update({'CI': 'true', 'NO_COLOR': '1', 'PNPM_DISABLE_SELF_UPDATE_CHECK': '1', 'PLAYWRIGHT_BROWSERS_PATH': str(BASE / 'browsers')})
(BASE / 'logs').mkdir(exist_ok=True)


def select(v):
    env = ENV.copy()
    env['PATH'] = str(Path(BINARIES[v]).parent) + os.pathsep + env['PATH']
    env['XDG_CACHE_HOME'] = str(BASE / ('cache' + v))
    env['XDG_CONFIG_HOME'] = str(BASE / 'empty-config')
    env['npm_config_manage_package_manager_versions'] = 'false'
    env['pnpm_config_manage_package_manager_versions'] = 'false'
    env['pnpm_config_pm_on_fail'] = 'ignore'
    env['pnpm_config_enable_global_virtual_store'] = 'false'
    env['npm_config_enable_global_virtual_store'] = 'false'
    Path(env['XDG_CACHE_HOME']).mkdir(exist_ok=True)
    return env


def clear_modules():
    for parent, dirs, _ in os.walk(ROOT, followlinks=False):
        dirs[:] = [d for d in dirs if d != '.git']
        if 'node_modules' in dirs:
            p = Path(parent) / 'node_modules'
            assert p.is_relative_to(ROOT)
            p.unlink() if p.is_symlink() else shutil.rmtree(p)
            dirs.remove('node_modules')


def measure(v, scenario, iteration, args):
    env = select(v)
    stem = f'{scenario}-{v}-{iteration}'
    cmd = [BINARIES[v], *args]
    if args == ['__dev__']:
        cmd = ['node', str(ROOT / 'scripts/pnpm-fixed-performance/dev-start.mjs'), BINARIES[v]]
    if args[0] == 'install':
        cmd += ['--store-dir', str(BASE / ('store' + v)), '--reporter', 'append-only']
    timing = BASE / 'logs' / (stem + '.time')
    timer = ['/usr/bin/time', '-l', '-o', str(timing)] if platform.system() == 'Darwin' else ['/usr/bin/time', '-f', '%e %U %S %M', '-o', str(timing)]
    load_before = os.getloadavg()
    disk_free_before = shutil.disk_usage(BASE).free
    start = time.perf_counter()
    with (BASE / 'logs' / (stem + '.log')).open('w') as log:
        result = subprocess.run([*timer, *cmd], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    wall = time.perf_counter() - start
    if args == ['__dev__'] and result.returncode == 0:
        dev = json.loads((BASE / 'logs' / (stem + '.log')).read_text().splitlines()[-1])
        wall = dev['ready_seconds']
    usage = timing.read_text()
    if platform.system() == 'Darwin':
        rss = int(re.search(r'(\d+)\s+maximum resident set size', usage)[1])
    else:
        rss = int(usage.strip().splitlines()[-1].split()[-1]) * 1024
    row = {'version': VERSIONS[v], 'scenario': scenario, 'iteration': iteration, 'wall_seconds': wall, 'rss_bytes': rss, 'exit_code': result.returncode, 'command': cmd, 'log': 'logs/' + stem + '.log', 'lock_unchanged': hashlib.sha256((ROOT / 'pnpm-lock.yaml').read_bytes()).hexdigest() == LOCK, 'load_before': load_before, 'load_after': os.getloadavg(), 'disk_free_before': disk_free_before, 'disk_free_after': shutil.disk_usage(BASE).free}
    with (BASE / 'results.jsonl').open('a') as f:
        f.write(json.dumps(row) + '\n')
    print(json.dumps(row), flush=True)
    if result.returncode or not row['lock_unchanged']:
        print((BASE / row['log']).read_text()[-9000:], flush=True)
        raise SystemExit(result.returncode or 1)


def inventory(v, label):
    packages = []
    for entry in (ROOT / 'node_modules/.pnpm').iterdir():
        nm = entry / 'node_modules'
        if not nm.is_dir() or entry.name == 'node_modules':
            continue
        for p in nm.iterdir():
            for candidate in (list(p.iterdir()) if p.name.startswith('@') and p.is_dir() else [p]):
                manifest = candidate / 'package.json'
                if not candidate.is_symlink() and manifest.is_file():
                    data = json.loads(manifest.read_text())
                    packages.append([data.get('name'), data.get('version')])
    packages.sort(key=str)
    encoded = json.dumps(packages) + '\n'
    (BASE / f'installed-{v}.json').write_text(encoded)
    (BASE / 'logs' / f'inventory-{v}-{label}.json').write_text(encoded)
    reference = BASE / 'inventory-reference.json'
    if reference.exists():
        assert reference.read_text() == encoded, f'Package inventory changed: {v} {label}'
    else:
        reference.write_text(encoded)
    directories = [ROOT / 'node_modules', BASE / ('store' + v), BASE / ('cache' + v)]
    sizes = ''.join(subprocess.check_output(['du', '-sk', str(directory)], text=True) for directory in directories)
    union = subprocess.check_output(['du', '-sk', *map(str, directories)], text=True)
    (BASE / f'sizes-{v}.txt').write_text(sizes)
    (BASE / f'sizes-union-{v}.txt').write_text(union)
    (BASE / 'logs' / f'sizes-{v}-{label}.txt').write_text(sizes)
    (BASE / 'logs' / f'sizes-union-{v}-{label}.txt').write_text(union)


def build_inventory(v, iteration):
    output = ROOT / 'packages/octane/dist'
    files = [[str(p.relative_to(output)), hashlib.sha256(p.read_bytes()).hexdigest()]
             for p in sorted(output.rglob('*')) if p.is_file() and not p.is_symlink()]
    assert files, 'Build must produce regular files'
    encoded = json.dumps(files) + '\n'
    (BASE / 'logs' / f'build-output-{v}-{iteration}.json').write_text(encoded)
    reference = BASE / 'build-output-reference.json'
    if reference.exists():
        expected = dict(json.loads(reference.read_text()))
        actual = dict(files)
        changed = sorted(k for k in expected.keys() | actual.keys() if expected.get(k) != actual.get(k))
        assert not changed, f'Build output changed: {v} iteration {iteration}: {changed[:20]}'
    else:
        reference.write_text(encoded)


def run(phase):
    if phase == 'cold':
        for v in ('11', '12'):
            assert not (BASE / ('store' + v)).exists(), 'Cold stores must start empty'
            clear_modules()
            measure(v, 'cold-download', 1, ['install', '--frozen-lockfile', '--ignore-scripts'])
            inventory(v, 'cold')
        assert (BASE/'installed-11.json').read_bytes() == (BASE/'installed-12.json').read_bytes()
    elif phase == 'warm':
        for i in range(4):
            for v in (('11', '12') if i % 2 == 0 else ('12', '11')):
                clear_modules()
                measure(v, 'warmup' if i == 0 else 'warm-reinstall', i, ['install', '--frozen-lockfile', '--offline', '--ignore-scripts'])
                if i:
                    measure(v, 'noop-ignore-scripts', i, ['install', '--frozen-lockfile', '--offline', '--ignore-scripts'])
                inventory(v, f'warm-{i}')
    elif phase == 'developer':
        for i in range(4):
            for v in (('11', '12') if i % 2 == 0 else ('12', '11')):
                clear_modules()
                measure(v, 'lifecycle-warmup' if i == 0 else 'lifecycle-install', i, ['install', '--frozen-lockfile', '--offline'])
                for repeat in range(1, 3):
                    measure(v, 'noop-with-scripts-warmup' if i == 0 else 'noop-with-scripts', i*2+repeat, ['install', '--frozen-lockfile', '--offline'])
                measure(v, 'build-warmup' if i == 0 else 'build', i, ['build'])
                build_inventory(v, i)
                measure(v, 'tooling-tests-warmup' if i == 0 else 'tooling-tests', i, ['ci:workflow:test'])
                measure(v, 'dev-start-warmup' if i == 0 else 'dev-start', i, ['__dev__'])
                inventory(v, f'developer-{i}')
        assert (BASE/'installed-11.json').read_bytes() == (BASE/'installed-12.json').read_bytes()
    elif phase == 'summary':
        rows = [json.loads(line) for line in (BASE/'results.jsonl').read_text().splitlines()]
        summary = {}
        for scenario in sorted(set(r['scenario'] for r in rows)):
            if 'warmup' in scenario: continue
            summary[scenario] = {}
            for version in VERSIONS.values():
                samples = [r for r in rows if r['scenario']==scenario and r['version']==version]
                assert all(r['exit_code']==0 and r['lock_unchanged'] for r in samples)
                summary[scenario][version] = {'n':len(samples),'median_s':statistics.median(r['wall_seconds'] for r in samples),'min_s':min(r['wall_seconds'] for r in samples),'max_s':max(r['wall_seconds'] for r in samples),'median_rss_mib':statistics.median(r['rss_bytes'] for r in samples)/2**20}
        (BASE/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
        print(json.dumps(summary,indent=2))

if __name__ == '__main__':
    for v, version in VERSIONS.items():
        actual = subprocess.check_output([BINARIES[v], '--version'], cwd=ROOT, env=select(v), text=True).strip()
        assert actual == version.split('+')[0], (actual, version)
        nested = subprocess.check_output(['pnpm', '--version'], cwd=ROOT, env=select(v), text=True).strip()
        assert nested == actual, ('PATH selected another pnpm', nested, actual)
    (BASE/'binary-provenance.json').write_text(json.dumps({v: {'label': VERSIONS[v], 'path': BINARIES[v], 'sha256': hashlib.sha256(Path(BINARIES[v]).read_bytes()).hexdigest()} for v in VERSIONS}, indent=2)+'\n')
    metadata = {'platform':platform.platform(),'machine':platform.machine(),'cpus':os.cpu_count(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'lock_sha256':LOCK,'harness_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'versions':VERSIONS,'ci_run':os.environ.get('GITHUB_RUN_ID'),'timestamp':time.time()}
    if not (BASE/'environment.json').exists(): (BASE/'environment.json').write_text(json.dumps(metadata,indent=2)+'\n')
    (BASE/'source-status.txt').write_bytes(subprocess.check_output(['git', 'status', '--short'], cwd=ROOT))
    (BASE/'source.patch').write_bytes(subprocess.check_output(['git', 'diff', 'HEAD', '--binary'], cwd=ROOT))
    try:
        for phase in (['cold','warm','developer','summary'] if sys.argv[1]=='all' else sys.argv[1:]): run(phase)
    finally:
        assert (ROOT/'package.json').read_text() == ORIGINAL, 'Application manifest changed'
