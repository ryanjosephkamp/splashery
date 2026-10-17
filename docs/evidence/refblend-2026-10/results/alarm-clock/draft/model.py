"""Picture-led alarm clock. No source mesh is imported or fitted.
Codex (GPT-6); original generated geometry CC0.
"""
import math
from refblend import *
segments = 32 if QUALITY == 'draft' else 64 if QUALITY == 'good' else 96
mint = material('Mint enamel', 'plastic', (.28,.56,.46), .3)
chrome = material('Polished rim', 'metal', (.5,.52,.5), .25)
face = material('Dark face', 'plastic', (.025,.027,.028), .65)
# Turn around Z, then orient the body along Y. Center and depth judged from side picture.
body = lathe('Clock body', [(.35,-.16),(.37,-.145),(.376,-.12),(.376,.12),(.36,.15),(.34,.16)], segments=segments, material=mint)
body.rotation_euler[0] = math.pi/2
body.location = (0,0,.375)
front = lathe('Face', [(.001,0),(.35,0),(.351,.008)], segments=segments, material=face)
front.rotation_euler[0] = math.pi/2
front.location = (0,-.182,.375)
rim = lathe('Front rim', [(.35,-.008),(.37,-.008),(.378,0),(.37,.008),(.35,.008)], segments=segments, material=chrome, closed=True)
rim.rotation_euler[0] = math.pi/2
rim.location = (0,-.184,.375)
for side in [-1,1]:
    foot = box('Foot '+str(side), (.045,.07,.10), (side*.215,0,.055), .018, chrome)
    foot.rotation_euler[1] = side*.55
    bell = lathe('Bell '+str(side), [(.135,0),(.14,.02),(.13,.055),(.10,.085),(.04,.11),(.025,.12)], segments=segments, material=chrome)
    bell.location = (side*.20,0,.72)
    bell.rotation_euler[1] = side*.4
    if side == 1:
        moving_part('bell', [bell], (side*.20,0,.72))
    if QUALITY != 'draft':
        lathe('Bell bolt '+str(side), [(.018,0),(.018,.03),(.009,.04)], (side*.17,0,.86), segments=24, material=chrome)
tube('Top handle', [(-.14,.01,.82),(-.13,.01,.98),(0,.01,1),(.13,.01,.98),(.14,.01,.82)], .009, chrome)
if QUALITY != 'draft':
    box('Top button', (.06,.045,.035), (0,0,.82), .008, chrome)

if QUALITY != 'draft':
    rear = lathe('Rear plate',[(.001,0),(.335,0),(.337,.008)],segments=segments,material=face)
    rear.rotation_euler[0] = -math.pi/2
    rear.location = (0,.165,.375)
    box('Battery cover',(.23,.012,.18),(0,.18,.235),.008,face)
    for side in [-1,1]:
        knob=lathe('Rear knob '+str(side),[(.022,0),(.022,.018),(.018,.022)],segments=24,material=face)
        knob.rotation_euler[0]=-math.pi/2
        knob.location=(side*.12,.175,.47)
