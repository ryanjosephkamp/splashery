"""Chess assembly inferred from the pictures and the pack size, not truth geometry.
Codex (GPT-6); original generated geometry CC0.
"""
from refblend import *
segments = 24 if QUALITY == 'draft' else 48 if QUALITY == 'good' else 72
board = material('Wood board', 'wood', (.18,.12,.06), .65, (40,2,2))
white = material('Light pieces', 'plastic', (.72,.69,.61), .45)
black = material('Dark pieces', 'plastic', (.025,.022,.018), .45)
box('Board', (1,1,.031), (0,0,.0155), .005, board)
if QUALITY != 'draft':
    for x in range(8):
        for y in range(8):
            box(f'Square {x} {y}', (.103,.103,.0015), ((x-3.5)*.105,(y-3.5)*.105,.032), .0002, white if (x+y)%2 else black)
# White and black full starting ranks; silhouettes determine approximate turned profiles.
for side in [-1,1]:
    mat = white if side==1 else black
    for x in range(8):
        at=((x-3.5)*.105,side*.262,.033)
        obj=lathe(f'Pawn {side} {x}', [(.025,0),(.026,.007),(.021,.012),(.016,.017),(.011,.05),(.018,.06),(.019,.073),(.014,.087),(.002,.096)], at, segments, mat)
        if side==1 and x==0:
            moving_part('white-pawn',[obj],at)
        kind=['rook','knight','bishop','queen','king','bishop','knight','rook'][x]
        height={'rook':.109,'knight':.136,'bishop':.155,'queen':.164,'king':.172}[kind]
        p=[(.032,0),(.034,.01),(.028,.016),(.022,.025),(.014,height*.62),(.021,height*.70),(.018,height*.76),(.025,height*.86),(.015,height*.96),(.002,height)]
        if kind=='rook':
            p=[(.032,0),(.033,.008),(.027,.018),(.023,.03),(.021,.078),(.031,.083),(.033,.109)]
        piece=lathe(f'{kind} {side} {x}',p,((x-3.5)*.105,side*.366,.033),segments,mat)
        if QUALITY=='best' and kind=='king':
            box(f'King cross {side}',(.012,.012,.032),((x-3.5)*.105,side*.366,.207),.002,mat)
            box(f'King crossbar {side}',(.028,.012,.009),((x-3.5)*.105,side*.366,.21),.002,mat)
