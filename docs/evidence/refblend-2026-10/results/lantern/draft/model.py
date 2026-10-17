"""Rebuilt by eye from four CC0 pictures, without reading the truth mesh.
Codex (GPT-6). Original generated geometry CC0; source credit travels in result.json.
"""
from refblend import *
segments = 32 if QUALITY == 'draft' else 64 if QUALITY == 'good' else 96
brass = material('Aged warm metal', 'metal', (.14,.105,.055), .58)
glass = material('Dark globe', 'glass', (.12,.15,.16), .24)
lathe('Fuel base', [(.16,0),(.167,.018),(.163,.04),(.145,.055),(.14,.09),(.12,.112),(.10,.124),(.10,.16),(.08,.17)], segments=segments, material=brass)
globe_profile = [(.065,.17),(.09,.19),(.115,.24),(.12,.32),(.11,.39),(.075,.45),(.068,.46)]
lathe('Globe', globe_profile + [(max(.005,r-.006),z) for r,z in reversed(globe_profile)], segments=segments, material=glass, closed=True)
hood_profile = [(.085,.46),(.075,.48),(.072,.50),(.08,.53),(.09,.55),(.095,.58),(.10,.60),(.095,.62),(.075,.65)]
lathe('Chimney', hood_profile + [(max(.005,r-.01),z) for r,z in reversed(hood_profile)], segments=segments, material=brass, closed=True)
lathe('Top cap', [(.065,.645),(.083,.66),(.09,.68),(.08,.70),(.04,.705)], segments=segments, material=brass)
for side in [-1,1]:
    tube('Cage '+str(side), [(side*.10,0,.12),(side*.17,0,.16),(side*.175,0,.26),(side*.15,0,.44),(side*.125,0,.57),(side*.08,0,.61)], .015 if QUALITY == 'draft' else .023, brass)
carry = tube('Carry handle', [(-.14,0,.61),(-.16,0,.69),(-.14,0,.86),(-.11,0,.93),(0,0,1),(.11,0,.93),(.14,0,.86),(.16,0,.69),(.14,0,.61)], .006, brass)
moving_part('handle', [carry], (0,0,.65))
if QUALITY != 'draft':
    tube('Small cap loop', [(-.025,0,.70),(-.038,0,.77),(0,0,.815),(.038,0,.77),(.025,0,.70)], .005, brass)
    for side in [-1,1]:
        tube('Cross guard '+str(side), [(-.09,-side*.08,.22),(0,-side*.12,.32),(.09,-side*.08,.42)], .0035, brass)
