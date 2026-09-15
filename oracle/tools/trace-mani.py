"""Trace the supplied mechanical triskelion into compact, transparent SVG paths.

Build-time only: Pillow is used to read the source, and the browser gets plain SVG.
Usage: python oracle/tools/trace-mani.py INPUT.png OUTPUT.svg
"""
import math
import sys
from pathlib import Path

from PIL import Image


def simplify(points, tolerance=0.55):
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    denom = math.hypot(dx, dy)
    distances = [abs(dy * (x - ax) - dx * (y - ay)) / denom if denom else math.hypot(x - ax, y - ay) for x, y in points[1:-1]]
    if not distances or max(distances) <= tolerance:
        return [points[0], points[-1]]
    split = distances.index(max(distances)) + 1
    return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)


def trace(source):
    image = Image.open(source).convert("L")
    width, height = image.size
    pixels = image.load()
    dark = {(x, y) for y in range(height) for x in range(width) if pixels[x, y] < 150}
    edges = {}
    for x, y in dark:
        for neighbour, start, end in (
            ((x, y - 1), (x, y), (x + 1, y)),
            ((x + 1, y), (x + 1, y), (x + 1, y + 1)),
            ((x, y + 1), (x + 1, y + 1), (x, y + 1)),
            ((x - 1, y), (x, y + 1), (x, y)),
        ):
            if neighbour not in dark:
                edges.setdefault(start, set()).add(end)
    loops = []
    while edges:
        start = next(iter(edges))
        cursor = start
        loop = []
        while True:
            loop.append(cursor)
            candidates = edges[cursor]
            # At a diagonal junction, keep the occupied pixel on the right.
            if len(candidates) > 1 and len(loop) > 1:
                px, py = loop[-2]
                vx, vy = cursor[0] - px, cursor[1] - py
                end = max(candidates, key=lambda p: vx * (p[1] - cursor[1]) - vy * (p[0] - cursor[0]))
            else:
                end = min(candidates)
            candidates.remove(end)
            if not candidates:
                del edges[cursor]
            cursor = end
            if cursor == start:
                break
        if len(loop) < 8:
            continue
        middle = len(loop) // 2
        reduced = simplify(loop[:middle + 1])[:-1] + simplify(loop[middle:] + [loop[0]])[:-1]
        loops.append("M" + "L".join(f"{x},{y}" for x, y in reduced) + "Z")
    return loops


if __name__ == "__main__":
    paths = trace(sys.argv[1])
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-620 -620 1240 1240">\n'
    svg += '<title>Mani — mechanical Three Legs of Man</title>\n'
    svg += '<desc>Vector tracing of the supplied mechanical triskelion, with three articulated legs around a circular hub.</desc>\n'
    svg += '<g transform="translate(-841 -391)" fill="#86ecc0" stroke="#86ecc0" stroke-width="0.3" fill-rule="evenodd">\n'
    svg += '<path d="' + "\n".join(paths) + '"/>\n</g>\n</svg>\n'
    Path(sys.argv[2]).write_text(svg, encoding="utf-8")
    print(f"Traced {len(paths)} contours; {len(svg):,} bytes")
