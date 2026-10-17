"""Original CC0 kit showcase, not a reconstruction benchmark. Codex (GPT-6).
A drawer, hinged door, and cushioned swivel chair demonstrate three rigid tap motions.
"""
from refblend import *
wood=material('Warm wood','wood',(.27,.12,.045),.5,(2,4,35))
legwood=material('Vertical wood grain','wood',(.22,.09,.03),.5,(30,30,2))
fabric=material('Blue woven fabric','fabric',(.035,.13,.19),.88)
metal=material('Brushed handle','metal',(.35,.38,.4),.32)
# A hollow carcass: the opening drawer and door reveal actual interior surfaces.
for x in [-.75,-.15]:box('Cabinet side',(.025,.42,.65),(x,0,.425),.006,wood)
box('Cabinet back',(.6,.025,.65),(-.45,.20,.425),.005,wood)
box('Cabinet bottom',(.6,.42,.03),(-.45,0,.115),.004,wood)
box('Cabinet top',(.64,.46,.035),(-.45,0,.76),.008,wood)
box('Inner shelf',(.57,.4,.025),(-.45,0,.50),.004,wood)
legs('Cabinet legs',[(-.70,-.16,0),(-.20,-.16,0),(-.70,.16,0),(-.20,.16,0)],[(.025,0),(.033,.02),(.021,.07),(.029,.10)],legwood)
drawer=[box('Drawer front',(.56,.025,.16),(-.45,-.22,.625),.006,wood),box('Drawer floor',(.54,.37,.015),(-.45,-.02,.55),.003,wood),box('Drawer back',(.54,.018,.12),(-.45,.155,.61),.003,wood)]
for x in [-.72,-.18]:drawer.append(box('Drawer side',(.018,.36,.12),(x,-.02,.61),.003,wood))
drawer.append(tube('Drawer handle',[(-.51,-.24,.63),(-.50,-.27,.63),(-.40,-.27,.63),(-.39,-.24,.63)],.008,metal))
moving_part('drawer',drawer,(-.45,0,.60))
door=box('Door panel',(.56,.025,.33),(-.45,-.22,.30),.007,wood)
knob=box('Door knob',(.025,.04,.025),(-.24,-.25,.33),.01,metal)
moving_part('door',[door,knob],(-.73,-.23,.30))
# Turned legs stay fixed while the seat, cushion, and slatted back swivel together.
legs('Chair legs',[(.25,-.16,0),(.65,-.16,0),(.25,.16,0),(.65,.16,0)],[(.025,0),(.033,.035),(.022,.20),(.035,.35),(.028,.42)],legwood)
lathe('Swivel collar',[(.06,.40),(.06,.45)],(.45,0,0),material=metal)
seat=[box('Seat base',(.52,.48,.05),(.45,0,.45),.015,wood),cushion('Soft seat',(.50,.46,.12),(.45,0,.52),fabric)]
seat+=slats('Back slat',4,(.035,.04,.35),(.27,.20,.70),(.12,0,0),wood,.006)
seat.append(box('Back rail',(.48,.045,.045),(.45,.20,.90),.009,wood))
moving_part('swivel',seat,(.45,0,.43))
