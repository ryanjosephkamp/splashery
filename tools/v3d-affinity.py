#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6).

Run a Linux x86-64 benchmark on fixed CPU cores. Chromium's software renderer
also tries to move individual workers to CPU 0.
Block subsequent affinity changes so every descendant retains the declared cores.
Usage: python3 tools/v3d-affinity.py 0,1 -- node tools/v3d-bench.mjs ...
"""

import ctypes
import errno
import os
import platform
import sys


def main():
    if sys.platform != "linux" or platform.machine() != "x86_64":
        raise SystemExit("Affinity locking requires Linux x86-64.")
    if len(sys.argv) < 4 or sys.argv[2] != "--":
        raise SystemExit("Usage: v3d-affinity.py <cores> -- <command> [arguments]")
    cores = {int(value) for value in sys.argv[1].split(",")}
    if not cores or not cores <= os.sched_getaffinity(0):
        raise SystemExit("Requested cores must be inside the current CPU allowance.")
    os.sched_setaffinity(0, cores)

    class Filter(ctypes.Structure):
        _fields_ = [
            ("code", ctypes.c_ushort),
            ("jt", ctypes.c_ubyte),
            ("jf", ctypes.c_ubyte),
            ("k", ctypes.c_uint32),
        ]

    class Program(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ushort), ("filter", ctypes.POINTER(Filter))]

    # seccomp_data.arch (4), then nr (0). Keep the x32 syscall-number tag from
    # bypassing the affinity rule. All other calls retain the host's policy.
    instructions = [
        (0x20, 0, 0, 4),
        (0x15, 1, 0, 0xC000003E),
        (0x06, 0, 0, 0x80000000),
        (0x20, 0, 0, 0),
        (0x54, 0, 0, 0xBFFFFFFF),
        (0x15, 0, 1, 203),
        (0x06, 0, 0, 0x00050000 | errno.EPERM),
        (0x06, 0, 0, 0x7FFF0000),
    ]
    filters = (Filter * len(instructions))(*(Filter(*row) for row in instructions))
    program = Program(len(filters), filters)
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int] + [ctypes.c_ulong] * 4
    libc.prctl.restype = ctypes.c_int
    for operation, argument in [(38, 1), (22, 2)]:
        pointer = ctypes.addressof(program) if operation == 22 else 0
        if libc.prctl(operation, argument, pointer, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "Could not enforce the CPU affinity lock")
    os.execvp(sys.argv[3], sys.argv[3:])


if __name__ == "__main__":
    main()
