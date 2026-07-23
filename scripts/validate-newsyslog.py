#!/usr/bin/env python3
"""Validate newsyslog.conf entries without requiring root or installation.
Syntax:
  <logpath> <owner:group> <mode> <count> <size> <when> <flags> [<command>]
Accepts space or tab separated fields. Ignores blank/comment lines.
"""

import re
import sys

LINE_RE = re.compile(
    r'^(?P<logpath>\S+)\s+'
    r'(?P<owner>[A-Za-z_][A-Za-z0-9_]*|[-*])'
    r'(?::(?P<group>[A-Za-z_][A-Za-z0-9_]*|[-*]))?\s+'
    r'(?P<mode>[0-7]{3}|-)\s+'
    r'(?P<count>\d+|\*)\s+'
    r'(?P<size>\d+[KkMmGgTtPp]?|\*)\s+'
    r'(?P<when>\$[DWM][0-9]*|\*|\d+|@[T0-9]+|[0-7][0-9]{2,3}|\*/[0-9]+|W[0-6][0-9]{2}|M[0-9]{2})\s*'
    r'(?P<flags>[BCGJNUWZ-]+)?\s*'
    r'(?P<rest>.*)$'
)

WHEN_RE = re.compile(
    r'^(\$[DWM][0-9]*|\*|\d+|@[T0-9]+|[0-7][0-9]{2,3}|\*/[0-9]+|W[0-6][0-9]{2}|M[0-9]{2})$'
)

VALID_FLAGS = set('BCGJNUWZ-')

# Flag combinations that are likely mistakes.
# G is a glob pattern flag; using it on a fixed path is almost always inverted.
# We still accept G if the logpath contains glob metacharacters, but warn.
GLOB_METACHARS = set('*?[')


def validate(line, lineno):
    if not line.strip() or line.strip().startswith('#'):
        return True
    m = LINE_RE.match(line)
    if not m:
        print(f'line {lineno}: malformed entry: {line.strip()}', file=sys.stderr)
        return False

    flags_str = m.group('flags') or ''
    flags = set(flags_str) if flags_str else set()
    rest = m.group('rest').strip()

    invalid_flags = flags - VALID_FLAGS
    if invalid_flags:
        print(
            f'line {lineno}: invalid flags "{ "".join(sorted(invalid_flags)) }" '
            f'in field "{flags_str}"',
            file=sys.stderr,
        )
        return False

    if 'G' in flags:
        logpath = m.group('logpath')
        if not any(ch in logpath for ch in GLOB_METACHARS):
            print(
                f'line {lineno}: flag "G" is a glob-pattern flag, not a '
                f'compression flag. Use "Z" for gzip compression and "N" to '
                f'suppress the syslogd signal. Path: {logpath}',
                file=sys.stderr,
            )
            return False

    if 'Z' in flags and 'J' in flags:
        print(
            f'line {lineno}: cannot use both Z (gzip) and J (bzip2) compression flags',
            file=sys.stderr,
        )
        return False

    if rest:
        parts = rest.split()
        for p in parts[:-1] if len(parts) > 1 else parts:
            if not re.match(r'^[A-Za-z]+$', p):
                print(f'line {lineno}: invalid flag or command tail: {rest}', file=sys.stderr)
                return False
    return True


def main():
    ok = True
    for path in sys.argv[1:]:
        with open(path, 'r') as f:
            for i, line in enumerate(f, start=1):
                if not validate(line, i):
                    ok = False
    if ok:
        print('newsyslog syntax OK')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
