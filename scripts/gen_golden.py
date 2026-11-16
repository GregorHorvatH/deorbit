"""Generates tests/golden/golden.json: the frozen reference values (forecasts, orbits, speeds, bumps, burns, a catch) that
the TypeScript simulator is tested against.

They were computed by an earlier prototype implementation of the game (Python, a sibling folder `globe/`). That prototype is
not part of this project and is not needed to build or test: the JSON is committed. This script only documents how the
values were made, and can regenerate them if the prototype is at hand. It never modifies the prototype.

Run:  python3 scripts/gen_golden.py
All lengths in the file are in design pixels (globe radius 250); the tests divide by 250."""

import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GLOBE = os.path.join(os.path.dirname(ROOT), "globe")
sys.path.insert(0, GLOBE)

from earth import game, orbits, state  # noqa: E402  (importing earth.game does not open a window)
from earth.config import (  # noqa: E402
    BUMP_LEVELS, PLAYER_REF_ALT, RADIUS, SATELLITE_COUNT, SPEED,
)
from earth.util import cross, orbit_basis, unit  # noqa: E402

rnd = random.Random(1234)


def lst(v):
    return [float(x) for x in v]


# ------------------------------------------------------------------ golden vectors
def reset(score=0):
    state.score = score
    state.tick = 0
    for k in ("layer_on",):
        pass
    state.layer_on.update({k: True for k in state.layer_on})
    game.wrecks.clear()
    game.effects.clear()
    game.player.update(hit=0.0, wobble=0.0)
    game.keys_held.clear()


def set_player(p, t, alt):
    game.player.update(p=tuple(p), t=tuple(t), alt=alt)


def set_iss(alt, u, v, omega, theta):
    game.iss.update(r=alt * RADIUS, u=tuple(u), v=tuple(v), omega=omega, theta=theta)


def random_player():
    p = unit((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
    t = unit(cross(p, (rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))))
    return p, t, rnd.choice(game.alt_levels())


def random_iss(level):
    u, v = orbit_basis((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
    alt = rnd.choice(game.iss_altitudes())
    return alt, u, v, game.iss_omega(alt, level), rnd.uniform(0, 2 * math.pi)


def snap():
    pl, iss = game.player, game.iss
    return {"player": {"p": lst(pl["p"]), "t": lst(pl["t"]), "alt": pl["alt"], "hit": pl["hit"], "wobble": pl["wobble"]},
            "iss": {"r": iss["r"], "u": lst(iss["u"]), "v": lst(iss["v"]), "omega": iss["omega"], "theta": iss["theta"]}}


def gen_golden():
    g = {"radius": RADIUS}

    g["alt_levels"] = game.alt_levels()
    g["iss_altitudes"] = game.iss_altitudes()
    g["turtle_speed"] = [[a, game.turtle_speed(a)] for a in game.alt_levels()]
    g["iss_fraction"] = [[lvl, game.iss_speed_fraction(lvl)] for lvl in range(1, 21)]
    g["iss_omega"] = [[a, lvl, game.iss_omega(a, lvl)] for a in game.iss_altitudes() for lvl in (1, 2, 5, 13)]
    g["orbits"] = [{"r": r, "u": lst(u), "v": lst(v), "omega": w, "phase": ph} for r, u, v, w, ph in orbits.ORBITS]
    g["iss_default"] = {"r": orbits.ISS_R, "u": lst(orbits.ISS_U), "v": lst(orbits.ISS_V),
                        "omega": game.iss_omega(1.18, 1)}

    # rotate_heading
    g["rotate"] = []
    for _ in range(8):
        p, t, _a = random_player()
        ang = rnd.uniform(-math.pi, math.pi)
        g["rotate"].append({"p": lst(p), "t": lst(t), "rad": ang, "out": lst(game.rotate_heading(p, t, ang))})

    # forecast + bearing on random configurations ...
    g["forecast"] = []
    for i in range(60):
        reset()
        p, t, alt = random_player()
        ia, u, v, om, th = random_iss(rnd.randint(1, 13))
        set_player(p, t, alt)
        set_iss(ia, u, v, om, th)
        eta, miss = game.intercept_forecast()
        g["forecast"].append({**snap(), "eta": eta, "miss": miss, "bearing": game.iss_bearing()})
    # ... and on guaranteed passes: the ISS sits on the turtle's own orbit (a sharp pass of ~0 px, first-lap logic)
    for i in range(10):
        reset()
        p, t, alt = random_player()
        om = game.iss_omega(alt, rnd.randint(1, 8)) if alt in game.iss_altitudes() else 0.002
        set_player(p, t, alt)
        set_iss(alt if alt in game.iss_altitudes() else 1.22, p, t, om, rnd.uniform(0.3, 3.0))
        eta, miss = game.intercept_forecast()
        g["forecast"].append({**snap(), "eta": eta, "miss": miss, "bearing": game.iss_bearing()})

    # satellites (no activation, so the phases are the frozen seed phases)
    g["sats"] = []
    for score in (0, 1, 5, 11, 14):
        reset(score)
        for tick in (0.0, 37.5, 400.0):
            state.tick = tick
            g["sats"].append({"score": score, "tick": tick, "active": game.active_satellites(),
                              "pos": [lst(p) for p in game.satellite_positions()]})
    reset(3)
    state.layer_on["game"] = False
    g["sats_game_off"] = game.active_satellites()
    reset()

    # climb / turn
    g["climb"] = []
    for alt in game.alt_levels():
        for sign in (1, -1):
            set_player(*random_player()[:2], alt)
            game.player["alt"] = alt
            game.climb_player(sign)
            g["climb"].append({"alt": alt, "sign": sign, "out": game.player["alt"]})
    g["turn"] = []
    for _ in range(6):
        p, t, alt = random_player()
        set_player(p, t, alt)
        sign = rnd.choice((1, -1))
        game.turn_player(sign)
        g["turn"].append({"p": lst(p), "t": lst(t), "sign": sign, "out": lst(game.player["t"])})

    # wrecks: start_burn from three different altitudes, then wreck_state over time
    g["wrecks"] = []
    for alt in (1.12, 1.22, 1.32):
        reset()
        u, v = orbit_basis((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
        set_iss(alt, u, v, game.iss_omega(alt, 4), rnd.uniform(0, 6))
        game.start_burn()
        w = game.wrecks[0]
        states = []
        for age in (0.0, 2.0, 5.0, 8.0, 12.0, 17.0, 20.0, 25.0, 30.0, 40.0):
            pos, phase, q = game.wreck_state(w, age)
            states.append({"age": age, "p": lst(pos), "phase": phase, "q": q})
        g["wrecks"].append({**snap(), "wreck": {"u0": lst(w["u0"]), "r0": w["r0"], "drift": lst(w["drift"]),
                                                "t_fall": w["t_fall"], "t_fire": w["t_fire"], "p": lst(w["p"])},
                            "states": states})
    reset()

    # bump: the random parts are pinned (uniform -> middle of its range, choice -> first item)
    class Stub:
        def uniform(self, a, b):
            return (a + b) / 2

        def choice(self, seq):
            return seq[0]

    real_rng = game.game_rng
    game.game_rng = Stub()
    g["bump"] = []
    for _ in range(8):
        reset()
        p, t, alt = random_player()
        set_player(p, t, alt)
        pos = game.player_pos()
        # a satellite somewhere near, at a random altitude
        off = tuple(rnd.gauss(0, 6) for _ in range(3))
        sat = tuple(pos[i] + off[i] for i in range(3))
        game.bump_player(sat)
        g["bump"].append({"p": lst(p), "t": lst(t), "alt": alt, "sat": lst(sat),
                          "out": {"t": lst(game.player["t"]), "alt": game.player["alt"],
                                  "hit": game.player["hit"], "wobble": game.player["wobble"]}})
    game.game_rng = real_rng
    reset()

    # step simulation without random events: the ISS is far from the turtle's path for the whole run
    def run(steps_list):
        for s in steps_list:
            game.iss["theta"] += game.iss["omega"] * s
            game.update_game(s)
            state.tick += s
            state.angle = (state.angle + SPEED * s) % (2 * math.pi)

    g["run"] = None
    for attempt in range(200):
        reset()
        p, t, alt = random_player()
        ia, u, v, om, th = random_iss(2)
        set_player(p, t, alt)
        set_iss(ia, u, v, om, th)
        steps_list = [rnd.choice((1.0, 1.0, 0.5, 2.3, 3.9)) for _ in range(150)]
        before = snap()
        run(steps_list)
        if state.score == 0:
            g["run"] = {"before": before, "steps": steps_list, "after": snap(), "tick": state.tick, "angle": state.angle}
            break
    assert g["run"], "no quiet scenario found"

    # a catch: the ISS stands slightly ahead on the turtle's orbit; the step that catches it starts the burn
    reset()
    game.game_rng = random.Random(0)
    p, t, alt = _p0 = game.player["p"], game.player["t"], 1.22
    set_player(p, t, alt)
    set_iss(1.22, p, t, 0.0005, 0.35)
    before = snap()
    n = 0
    while state.score == 0 and n < 400:
        game.iss["theta"] += game.iss["omega"] * 1.0
        game.update_game(1.0)
        state.tick += 1.0
        n += 1
        if state.score == 0:
            last = snap()
    w = game.wrecks[0]
    g["catch"] = {"before": before, "steps": n, "score": state.score,
                  "wreck": {"u0": lst(w["u0"]), "r0": w["r0"], "drift": lst(w["drift"]), "age": w["age"],
                            "p": lst(w["p"]), "t_fall": w["t_fall"], "t_fire": w["t_fire"]},
                  "effect0": [game.effects[0][0], game.effects[0][1], game.effects[0][2]],
                  "player": snap()["player"]}
    reset()

    path = os.path.join(ROOT, "tests/golden/golden.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(g, f)
    return g


if __name__ == "__main__":
    g = gen_golden()
    print("catch after", g["catch"]["steps"], "steps;", len(g["forecast"]), "forecast cases")
