"""Create original CC0 reference pictures for the modeling-kit demonstration, not a truth test.
Blender --python showcase.py -- /outside/repo/showcase-pack
"""
import json
import runpy
import sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).parent))
from rendering import render_pack
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
(out/'images').mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
pack={'schema':1,'id':'modeling-kit-showcase','name':'Modeling kit showcase','images':[{'file':'images/00.png','view':'three-quarter','camera':{'yaw':35,'pitch':20,'fov':40,'distance':3,'orthoScale':2.0,'target':[-.05,.45,0]}}],'notes':'Original procedural demonstration, not a reconstruction benchmark. Drawer, door, and swivel move as solid pieces.','moves':[{'part':'drawer','how':'slide','axis':'z','amount':.20},{'part':'door','how':'hinge','axis':'y','amount':-70},{'part':'swivel','how':'spin','axis':'y','amount':360}],'budget':{'minutes':30,'quality':'good'},'license':{'images':'CC0','source':'Original procedural kit demonstration','author':'Codex (GPT-6)'}}
runpy.run_path(str(Path(__file__).parent/'examples/modeling-kit.py'),init_globals={'QUALITY':'good','PACK':pack,'PACK_DIR':str(out),'SEED':1})
render_pack(pack,out,256,16)
(out/'renders/000.png').rename(out/'images/00.png')
(out/'pack.json').write_text(json.dumps(pack,indent=2)+'\n')
